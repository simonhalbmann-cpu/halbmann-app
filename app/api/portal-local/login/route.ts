import { NextResponse } from 'next/server';
import { readLocalPortalAccess } from '../../../../lib/localPortalAccess';
import { createLocalPortalSessionCookie } from '../../../../lib/localPortalSession';
import { normalizePortalUsername } from '../../../../lib/portalAccess';
import { decryptPortalPassword } from '../../../../lib/portalSecrets';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { password?: string; username?: string };
    const username = normalizePortalUsername(payload.username);
    const password = typeof payload.password === 'string' ? payload.password : '';

    if (!username || !password) {
      return NextResponse.json({ ok: false, error: 'local_portal_credentials_missing' }, { status: 400 });
    }

    const record = await readLocalPortalAccess(username);
    if (!record) {
      return NextResponse.json({ ok: false, error: 'portal_user_not_found' }, { status: 404 });
    }

    const storedPassword = decryptPortalPassword(record.passwordCipher);
    if (!storedPassword || storedPassword !== password) {
      return NextResponse.json({ ok: false, error: 'invalid_local_portal_password' }, { status: 401 });
    }

    await createLocalPortalSessionCookie({
      targetId: record.targetId,
      targetType: record.targetType,
      uid: record.uid,
      username: record.username,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'local_portal_login_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
