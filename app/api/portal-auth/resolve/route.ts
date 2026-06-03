import { NextResponse } from 'next/server';
import { getAdminDb, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';
import { readLocalPortalAccess } from '../../../../lib/localPortalAccess';
import { normalizePortalUsername } from '../../../../lib/portalAccess';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { username?: string };
    const username = normalizePortalUsername(payload.username);

    if (!username) {
      return NextResponse.json({ ok: false, error: 'username_missing' }, { status: 400 });
    }

    if (!hasFirebaseAdminConfig()) {
      const localRecord = await readLocalPortalAccess(username);
      if (!localRecord?.authEmail) {
        return NextResponse.json({ ok: false, error: 'portal_user_not_found' }, { status: 404 });
      }

      return NextResponse.json({ authEmail: localRecord.authEmail, ok: true });
    }

    const snapshot = await getAdminDb()
      .collection('userProfiles')
      .where('role', '==', 'portal')
      .where('username', '==', username)
      .limit(1)
      .get();

    const profile = snapshot.docs[0];
    if (!profile?.exists) {
      return NextResponse.json({ ok: false, error: 'portal_user_not_found' }, { status: 404 });
    }

    const data = profile.data();
    const authEmail =
      (typeof data.authEmail === 'string' && data.authEmail.trim()) ||
      (typeof data.email === 'string' && data.email.trim());

    if (!authEmail) {
      return NextResponse.json({ ok: false, error: 'portal_auth_email_missing' }, { status: 500 });
    }

    return NextResponse.json({ authEmail, ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'portal_auth_resolve_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
