import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';
import {
  readLocalPortalAccess,
  writeLocalPortalAccess,
} from '../../../../lib/localPortalAccess';
import { readLocalPortalSessionCookie } from '../../../../lib/localPortalSession';
import { cleanPortalText, type PortalTargetType } from '../../../../lib/portalAccess';

export const runtime = 'nodejs';

type PortalAuthState = {
  error: NextResponse | null;
  profile: Record<string, unknown> | null;
};

type MeterUpdatePayload = {
  meterId?: string;
  readingDate?: string;
  readingValue?: string;
};

async function requireAuthenticatedPortalUser(request: Request): Promise<PortalAuthState> {
  if (!hasFirebaseAdminConfig()) {
    const localSession = await readLocalPortalSessionCookie();
    if (!localSession) {
      return {
        error: NextResponse.json({ ok: false, error: 'missing_auth_token' }, { status: 401 }),
        profile: null,
      };
    }

    return {
      error: null,
      profile: {
        role: 'portal',
        targetId: localSession.targetId,
        targetType: localSession.targetType,
        username: localSession.username,
      },
    };
  }

  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    return {
      error: NextResponse.json({ ok: false, error: 'missing_auth_token' }, { status: 401 }),
      profile: null,
    };
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const profileSnapshot = await getAdminDb().collection('userProfiles').doc(decoded.uid).get();
    const profile = profileSnapshot.data() ?? null;

    if (!profileSnapshot.exists || profile?.role !== 'portal') {
      return {
        error: NextResponse.json({ ok: false, error: 'portal_required' }, { status: 403 }),
        profile: null,
      };
    }

    return {
      error: null,
      profile,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_auth_token';
    return {
      error: NextResponse.json({ ok: false, error: message }, { status: 401 }),
      profile: null,
    };
  }
}

function updateMeterList(
  source: unknown,
  meterId: string,
  readingValue: string,
  readingDate: string
) {
  if (!Array.isArray(source)) return { list: [], updated: null };

  let updatedMeter: Record<string, unknown> | null = null;
  const list = source.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    const current = entry as Record<string, unknown>;
    if (cleanPortalText(current.id) !== meterId) return current;

    const nextHistory = Array.isArray(current.readingHistory) ? [...current.readingHistory] : [];
    nextHistory.unshift({
      date: readingDate,
      source: 'portal',
      value: readingValue,
    });

    updatedMeter = {
      ...current,
      latestReading: readingValue,
      latestReadingDate: readingDate,
      readingHistory: nextHistory,
    };
    return updatedMeter;
  });

  return { list, updated: updatedMeter };
}

export async function POST(request: Request) {
  try {
    const authState = await requireAuthenticatedPortalUser(request);
    if (authState.error) return authState.error;
    if (!authState.profile) {
      return NextResponse.json({ ok: false, error: 'portal_profile_missing' }, { status: 403 });
    }

    const targetId = cleanPortalText(authState.profile.targetId);
    const targetType = cleanPortalText(authState.profile.targetType) as PortalTargetType;
    const username = cleanPortalText(authState.profile.username);
    const payload = (await request.json()) as MeterUpdatePayload;
    const meterId = cleanPortalText(payload.meterId);
    const readingValue = cleanPortalText(payload.readingValue);
    const readingDate = cleanPortalText(payload.readingDate);

    if (!targetId || targetType !== 'tenant') {
      return NextResponse.json({ ok: false, error: 'portal_target_missing' }, { status: 400 });
    }
    if (!meterId || !readingValue || !readingDate) {
      return NextResponse.json({ ok: false, error: 'meter_payload_incomplete' }, { status: 400 });
    }

    if (!hasFirebaseAdminConfig()) {
      const record = await readLocalPortalAccess(username);
      if (!record) {
        return NextResponse.json({ ok: false, error: 'portal_target_not_found' }, { status: 404 });
      }

      const propertyData =
        record.propertyData && typeof record.propertyData === 'object' ? { ...record.propertyData } : null;
      const unitId = cleanPortalText(record.targetData?.unitId);
      let updatedMeter: Record<string, unknown> | null = null;

      if (propertyData) {
        const propertyMetersResult = updateMeterList(propertyData.meters, meterId, readingValue, readingDate);
        propertyData.meters = propertyMetersResult.list;
        updatedMeter = propertyMetersResult.updated;

        if (!updatedMeter && Array.isArray(propertyData.units)) {
          propertyData.units = propertyData.units.map((unit) => {
            if (!unit || typeof unit !== 'object') return unit;
            const currentUnit = unit as Record<string, unknown>;
            if (cleanPortalText(currentUnit.id) !== unitId) return currentUnit;
            const unitMetersResult = updateMeterList(currentUnit.meters, meterId, readingValue, readingDate);
            if (unitMetersResult.updated) {
              updatedMeter = unitMetersResult.updated;
            }
            return {
              ...currentUnit,
              meters: unitMetersResult.list,
            };
          });
        }
      }

      const targetData =
        record.targetData && typeof record.targetData === 'object' ? { ...record.targetData } : {};
      if (!updatedMeter) {
        const targetMetersResult = updateMeterList(targetData.unitMeters, meterId, readingValue, readingDate);
        targetData.unitMeters = targetMetersResult.list;
        updatedMeter = targetMetersResult.updated;
      }

      if (!updatedMeter) {
        return NextResponse.json({ ok: false, error: 'meter_not_found' }, { status: 404 });
      }

      await writeLocalPortalAccess({
        ...record,
        propertyData: propertyData ?? record.propertyData,
        targetData,
      });

      return NextResponse.json({ meter: updatedMeter, ok: true });
    }

    const db = getAdminDb();
    const tenantSnapshot = await db.collection('tenants').doc(targetId).get();
    const tenantData = tenantSnapshot.data() ?? null;
    if (!tenantSnapshot.exists || !tenantData) {
      return NextResponse.json({ ok: false, error: 'portal_target_not_found' }, { status: 404 });
    }

    const propertyId = cleanPortalText(tenantData.propertyId);
    const unitId = cleanPortalText(tenantData.unitId);
    if (!propertyId) {
      return NextResponse.json({ ok: false, error: 'property_missing' }, { status: 400 });
    }

    const propertyRef = db.collection('properties').doc(propertyId);
    const propertySnapshot = await propertyRef.get();
    const propertyData = propertySnapshot.data() ?? null;
    if (!propertySnapshot.exists || !propertyData) {
      return NextResponse.json({ ok: false, error: 'property_not_found' }, { status: 404 });
    }

    let updatedMeter: Record<string, unknown> | null = null;
    const propertyMetersResult = updateMeterList(propertyData.meters, meterId, readingValue, readingDate);
    const nextPropertyData: Record<string, unknown> = {
      ...propertyData,
      meters: propertyMetersResult.list,
    };
    updatedMeter = propertyMetersResult.updated;

    if (!updatedMeter && Array.isArray(propertyData.units)) {
      nextPropertyData.units = propertyData.units.map((unit: unknown) => {
        if (!unit || typeof unit !== 'object') return unit;
        const currentUnit = unit as Record<string, unknown>;
        if (cleanPortalText(currentUnit.id) !== unitId) return currentUnit;
        const unitMetersResult = updateMeterList(currentUnit.meters, meterId, readingValue, readingDate);
        if (unitMetersResult.updated) {
          updatedMeter = unitMetersResult.updated;
        }
        return {
          ...currentUnit,
          meters: unitMetersResult.list,
        };
      });
    }

    if (!updatedMeter) {
      return NextResponse.json({ ok: false, error: 'meter_not_found' }, { status: 404 });
    }

    await propertyRef.set(
      {
        meters: nextPropertyData.meters,
        units: nextPropertyData.units,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ meter: updatedMeter, ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'portal_meter_update_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
