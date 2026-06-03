import { NextResponse } from 'next/server';
import { buildMessageThemes } from '../../../../lib/messageThemes';
import { getAdminAuth, getAdminDb, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';
import { readLocalPortalAccess } from '../../../../lib/localPortalAccess';
import { listLocalMessageThemes } from '../../../../lib/localMessageThemes';
import { readLocalPortalSessionCookie } from '../../../../lib/localPortalSession';
import { listLocalPortalMessages } from '../../../../lib/localPortalMessages';
import { cleanPortalText, getPortalCollectionName, type PortalTargetType } from '../../../../lib/portalAccess';

export const runtime = 'nodejs';

type PortalAuthState = {
  error: NextResponse | null;
  profile: Record<string, unknown> | null;
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

export async function GET(request: Request) {
  try {
    const authState = await requireAuthenticatedPortalUser(request);
    if (authState.error) {
      return authState.error;
    }
    if (!authState.profile) {
      return NextResponse.json({ ok: false, error: 'portal_profile_missing' }, { status: 403 });
    }

    const targetId = cleanPortalText(authState.profile.targetId);
    const targetType = cleanPortalText(authState.profile.targetType) as PortalTargetType;

    if (!targetId || (targetType !== 'tenant' && targetType !== 'contact')) {
      return NextResponse.json({ ok: false, error: 'portal_target_missing' }, { status: 400 });
    }

    if (!hasFirebaseAdminConfig()) {
      const localRecord = await readLocalPortalAccess(cleanPortalText(authState.profile.username));
      if (!localRecord) {
        return NextResponse.json({ ok: false, error: 'portal_target_not_found' }, { status: 404 });
      }

      const targetData =
        localRecord.targetData && typeof localRecord.targetData === 'object'
          ? localRecord.targetData
          : null;
      const allMessages = (await listLocalPortalMessages(targetType, targetId))
        .filter((message) => message.visibleToTenant !== false)
        .map((message) => ({
        data: message,
        id: message.id,
      }));
      const themes = buildMessageThemes(
        allMessages,
        (await listLocalMessageThemes()).filter((theme) => theme.tenantId === targetId)
      );

      return NextResponse.json({
        messages: allMessages,
        ok: true,
        propertyData:
          (localRecord.propertyData && typeof localRecord.propertyData === 'object'
            ? localRecord.propertyData
            : null) ?? {
            city: cleanPortalText(targetData?.city),
            meters: Array.isArray(targetData?.meters) ? targetData.meters : [],
            name: cleanPortalText(targetData?.propertyName),
            postalCode: cleanPortalText(targetData?.postalCode),
            street: cleanPortalText(targetData?.street),
            units: [
              {
                floor: cleanPortalText(targetData?.floor),
                id: cleanPortalText(targetData?.unitId),
                meters: Array.isArray(targetData?.unitMeters) ? targetData.unitMeters : [],
                section: cleanPortalText(targetData?.section),
                unitLabel: cleanPortalText(targetData?.unitLabel),
                unitPosition: cleanPortalText(targetData?.unitPosition),
              },
            ],
          },
        targetData,
        themes,
      });
    }

    const db = getAdminDb();
    const targetCollection = getPortalCollectionName(targetType);
    const targetSnapshot = await db.collection(targetCollection).doc(targetId).get();
    if (!targetSnapshot.exists) {
      return NextResponse.json({ ok: false, error: 'portal_target_not_found' }, { status: 404 });
    }

    const targetData = targetSnapshot.data() ?? null;
    const propertyId = cleanPortalText(targetData?.propertyId);
    const propertyData = propertyId
      ? (await db.collection('properties').doc(propertyId).get()).data() ?? null
      : null;
    const fieldName = targetType === 'tenant' ? 'tenantId' : 'recipientId';
    const messagesSnapshot = await db
      .collection('messages')
      .where(fieldName, '==', targetId)
      .orderBy('createdAt', 'desc')
      .get();
    const messages = messagesSnapshot.docs.map((documentSnapshot) => ({
      data: documentSnapshot.data(),
      id: documentSnapshot.id,
    }));
    const themes = buildMessageThemes(messages);

    return NextResponse.json({
      messages,
      ok: true,
      propertyData,
      targetData,
      themes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'portal_context_load_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
