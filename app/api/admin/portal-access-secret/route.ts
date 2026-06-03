import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';
import {
  findLocalPortalAccessByTarget,
  readLocalPortalAccess,
} from '../../../../lib/localPortalAccess';
import { cleanPortalText, type PortalTargetType } from '../../../../lib/portalAccess';
import { decryptPortalPassword } from '../../../../lib/portalSecrets';

export const runtime = 'nodejs';

type PortalSecretPayload = {
  targetId?: string;
  targetType?: PortalTargetType;
  username?: string;
};

async function requireAdmin(request: Request) {
  if (!hasFirebaseAdminConfig() && process.env.NODE_ENV !== 'production') {
    return { error: null };
  }

  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    return {
      error: NextResponse.json({ ok: false, error: 'missing_auth_token' }, { status: 401 }),
    };
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const profile = await getAdminDb().collection('userProfiles').doc(decoded.uid).get();
    if (!profile.exists || profile.data()?.role !== 'admin') {
      return {
        error: NextResponse.json({ ok: false, error: 'admin_required' }, { status: 403 }),
      };
    }

    return { error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_auth_token';
    return {
      error: NextResponse.json({ ok: false, error: message }, { status: 401 }),
    };
  }
}

export async function POST(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) {
    return adminCheck.error;
  }

  try {
    const payload = (await request.json()) as PortalSecretPayload;
    const targetType =
      payload.targetType === 'contact'
        ? 'contact'
        : payload.targetType === 'tenant'
          ? 'tenant'
          : null;
    const targetId = cleanPortalText(payload.targetId);
    const username = cleanPortalText(payload.username).toLowerCase();

    if (!targetType || (!targetId && !username)) {
      return NextResponse.json({ ok: false, error: 'portal_secret_target_missing' }, { status: 400 });
    }

    if (!hasFirebaseAdminConfig()) {
      const record =
        (username ? await readLocalPortalAccess(username) : null) ??
        (targetId ? await findLocalPortalAccessByTarget(targetType, targetId) : null);

      if (!record) {
        return NextResponse.json({ ok: false, error: 'portal_secret_not_found' }, { status: 404 });
      }

      return NextResponse.json({
        ok: true,
        password: decryptPortalPassword(record.passwordCipher),
        portalUsername: record.username,
      });
    }

    const targetCollection = targetType === 'tenant' ? 'tenants' : 'people';
    const targetData = (await getAdminDb().collection(targetCollection).doc(targetId).get()).data() ?? null;
    if (!targetData) {
      return NextResponse.json({ ok: false, error: 'portal_target_not_found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      password: decryptPortalPassword(targetData.portalPasswordCipher),
      portalUsername: cleanPortalText(targetData.portalUsername),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'portal_secret_load_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
