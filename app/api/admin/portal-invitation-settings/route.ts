import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';
import {
  deleteLocalPortalInvitationSettings,
  writeLocalPortalInvitationSettings,
} from '../../../../lib/localPortalInvitationSettings';
import { getPortalInvitationSettingsStateServer } from '../../../../lib/portalInvitationConfigServer';
import {
  PORTAL_INVITATION_SETTINGS_COLLECTION,
  PORTAL_INVITATION_SETTINGS_DOC_ID,
  type PortalInvitationSettings,
} from '../../../../lib/portalInvitationSettings';

export const runtime = 'nodejs';

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

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

export async function GET(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const state = await getPortalInvitationSettingsStateServer();
  return NextResponse.json({ ok: true, exists: state.exists, settings: state.settings });
}

export async function POST(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  try {
    const payload = (await request.json()) as PortalInvitationSettings;
    const normalized = {
      bodyTemplate: cleanText(payload.bodyTemplate),
      subject: cleanText(payload.subject),
    };

    if (!hasFirebaseAdminConfig() && process.env.NODE_ENV !== 'production') {
      await writeLocalPortalInvitationSettings(normalized);
    } else {
      await getAdminDb()
        .collection(PORTAL_INVITATION_SETTINGS_COLLECTION)
        .doc(PORTAL_INVITATION_SETTINGS_DOC_ID)
        .set({
          ...normalized,
          deletedAt: null,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: adminCheck.uid,
        });
    }

    const state = await getPortalInvitationSettingsStateServer();
    return NextResponse.json({ ok: true, exists: state.exists, settings: state.settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'portal_invitation_settings_save_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  try {
    if (!hasFirebaseAdminConfig() && process.env.NODE_ENV !== 'production') {
      await deleteLocalPortalInvitationSettings();
    } else {
      await getAdminDb()
        .collection(PORTAL_INVITATION_SETTINGS_COLLECTION)
        .doc(PORTAL_INVITATION_SETTINGS_DOC_ID)
        .set({
          bodyTemplate: '',
          subject: '',
          deletedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: adminCheck.uid,
        });
    }

    const state = await getPortalInvitationSettingsStateServer();
    return NextResponse.json({ ok: true, exists: false, settings: state.settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'portal_invitation_settings_delete_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
