import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';
import {
  findLocalPortalAccessByTarget,
  readLocalPortalAccess,
  writeLocalPortalAccess,
} from '../../../../lib/localPortalAccess';
import {
  buildPortalAuthEmail,
  buildPortalDisplayName,
  cleanPortalText,
  getPortalCollectionName,
  normalizePortalUsername,
  type PortalTargetType,
} from '../../../../lib/portalAccess';
import { decryptPortalPassword, encryptPortalPassword } from '../../../../lib/portalSecrets';

export const runtime = 'nodejs';

type PortalAccessPayload = {
  contactEmail?: string;
  existingPasswordCipher?: string;
  password?: string;
  propertySnapshot?: Record<string, unknown>;
  targetId?: string;
  targetSnapshot?: Record<string, unknown>;
  targetType?: PortalTargetType;
  username?: string;
};

async function requireAdmin(request: Request) {
  if (!hasFirebaseAdminConfig() && process.env.NODE_ENV !== 'production') {
    return { error: null, uid: 'local-dev-admin' };
  }

  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    return {
      error: NextResponse.json({ ok: false, error: 'missing_auth_token' }, { status: 401 }),
      uid: '',
    };
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const profile = await getAdminDb().collection('userProfiles').doc(decoded.uid).get();
    if (!profile.exists || profile.data()?.role !== 'admin') {
      return {
        error: NextResponse.json({ ok: false, error: 'admin_required' }, { status: 403 }),
        uid: '',
      };
    }

    return { error: null, uid: decoded.uid };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_auth_token';
    return {
      error: NextResponse.json({ ok: false, error: message }, { status: 401 }),
      uid: '',
    };
  }
}

export async function POST(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) {
    return adminCheck.error;
  }

  try {
    const payload = (await request.json()) as PortalAccessPayload;
    const targetType = payload.targetType === 'contact' ? 'contact' : payload.targetType === 'tenant' ? 'tenant' : null;
    const targetId = cleanPortalText(payload.targetId);
    const username = normalizePortalUsername(payload.username);
    const password = cleanPortalText(payload.password);
    const clientToken = request.headers.get('authorization')?.replace(/^Bearer\s+/, '') || '';
    const localTargetData =
      payload.targetSnapshot && typeof payload.targetSnapshot === 'object'
        ? payload.targetSnapshot
        : null;
    const localPropertyData =
      payload.propertySnapshot && typeof payload.propertySnapshot === 'object'
        ? payload.propertySnapshot
        : null;

    if (!targetType || !targetId) {
      return NextResponse.json({ ok: false, error: 'portal_target_missing' }, { status: 400 });
    }
    if (!username) {
      return NextResponse.json({ ok: false, error: 'portal_username_missing' }, { status: 400 });
    }

    const targetCollection = getPortalCollectionName(targetType);
    const useAdmin = hasFirebaseAdminConfig();
    const db = useAdmin ? getAdminDb() : null;
    const targetData = useAdmin
      ? ((await db!.collection(targetCollection).doc(targetId).get()).data() ?? null)
      : localTargetData;

    if (!targetData) {
      return NextResponse.json({ ok: false, error: 'portal_target_not_found' }, { status: 404 });
    }
    const invitationEmail = cleanPortalText(payload.contactEmail || targetData.email);

    if (!invitationEmail) {
      return NextResponse.json({ ok: false, error: 'portal_target_email_missing' }, { status: 400 });
    }

    const existingByUsernameProfile = useAdmin
      ? (await db!.collection('userProfiles').where('role', '==', 'portal').where('username', '==', username).limit(1).get()).docs[0] ?? null
      : null;
    const existingByUsernameLocal = useAdmin ? null : await readLocalPortalAccess(username);
    const existingUidFromTarget = cleanPortalText(
      targetData.portalAuthUid || (await findLocalPortalAccessByTarget(targetType, targetId))?.uid
    );
    const existingByUsernameId = existingByUsernameProfile?.id ?? '';
    if (
      (useAdmin && existingByUsernameId && existingByUsernameId !== existingUidFromTarget) ||
      (!useAdmin &&
        existingByUsernameLocal &&
        (existingByUsernameLocal.targetId !== targetId ||
          existingByUsernameLocal.targetType !== targetType))
    ) {
      return NextResponse.json({ ok: false, error: 'portal_username_exists' }, { status: 409 });
    }

    let uid = existingUidFromTarget;
    const authEmail = buildPortalAuthEmail(username);
    const previousPassword = decryptPortalPassword(
      targetData.portalPasswordCipher || payload.existingPasswordCipher
    );

    if (useAdmin) {
      const auth = getAdminAuth();

      if (uid) {
        await auth.updateUser(uid, {
          email: authEmail,
          ...(password ? { password } : {}),
        });
      } else {
        if (!password) {
          return NextResponse.json({ ok: false, error: 'portal_password_missing' }, { status: 400 });
        }
        const createdUser = await auth.createUser({
          email: authEmail,
          password,
        });
        uid = createdUser.uid;
      }
    } else {
      if (!previousPassword && !password) {
        return NextResponse.json({ ok: false, error: 'portal_password_missing' }, { status: 400 });
      }
      uid = uid || `local-portal-${targetType}-${targetId}`;
    }

    const nextPassword = password || previousPassword;
    const passwordCipher = nextPassword ? encryptPortalPassword(nextPassword) : cleanPortalText(targetData.portalPasswordCipher);

    if (useAdmin) {
      await db!.collection('userProfiles').doc(uid).set(
        {
          authEmail,
          contactEmail: invitationEmail,
          displayName: buildPortalDisplayName(targetType, targetData),
          email: authEmail,
          role: 'portal',
          targetId,
          targetType,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: adminCheck.uid,
          username,
          ...(existingUidFromTarget ? {} : { createdAt: FieldValue.serverTimestamp() }),
        },
        { merge: true }
      );

      await db!.collection(targetCollection).doc(targetId).set(
        {
          authEmail,
          portalAccessEnabled: true,
          portalAuthUid: uid,
          portalPassword: FieldValue.delete(),
          portalPasswordCipher: passwordCipher,
          portalUsername: username,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      await writeLocalPortalAccess({
        authEmail,
        contactEmail: invitationEmail,
        passwordCipher,
        propertyData: localPropertyData ?? undefined,
        targetId,
        targetData: {
          ...targetData,
          authEmail,
          portalAccessEnabled: true,
          portalAuthUid: uid,
          portalPasswordCipher: passwordCipher,
          portalUsername: username,
          updatedAt: new Date().toISOString(),
        },
        targetType,
        uid,
        username,
      });
    }

    return NextResponse.json({
      authEmail,
      ok: true,
      portalAuthUid: uid,
      portalPasswordCipher: passwordCipher,
      portalUsername: username,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'portal_access_save_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
