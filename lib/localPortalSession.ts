import crypto from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'halbmann_portal_session';

type LocalPortalSession = {
  targetId: string;
  targetType: 'contact' | 'tenant';
  uid: string;
  username: string;
};

function getSessionSecret() {
  const raw =
    process.env.PORTAL_SESSION_SECRET ||
    process.env.FIREBASE_PRIVATE_KEY ||
    `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'halbmann'}:portal-session`;

  return crypto.createHash('sha256').update(raw).digest('hex');
}

function signValue(value: string) {
  return crypto.createHmac('sha256', getSessionSecret()).update(value).digest('hex');
}

export async function createLocalPortalSessionCookie(session: LocalPortalSession) {
  const serialized = Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
  const signature = signValue(serialized);
  const jar = await cookies();
  jar.set(COOKIE_NAME, `${serialized}.${signature}`, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    sameSite: 'lax',
    secure: false,
  });
}

export async function clearLocalPortalSessionCookie() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: false,
  });
}

export async function readLocalPortalSessionCookie() {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value || '';
  if (!raw.includes('.')) return null;

  const [serialized, signature] = raw.split('.', 2);
  if (!serialized || !signature || signValue(serialized) !== signature) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(serialized, 'base64url').toString('utf8')) as LocalPortalSession;
    if (!parsed?.uid || !parsed?.username || !parsed?.targetId || !parsed?.targetType) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
