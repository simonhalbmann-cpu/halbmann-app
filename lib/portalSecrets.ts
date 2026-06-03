import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getSecretKey() {
  const raw =
    process.env.PORTAL_SECRET_KEY ||
    process.env.FIREBASE_PRIVATE_KEY ||
    `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'halbmann'}:${process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'portal'}`;

  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptPortalPassword(password: string) {
  if (!password) return '';

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptPortalPassword(payload: unknown) {
  if (typeof payload !== 'string' || !payload.trim()) return '';

  const [ivText, tagText, encryptedText] = payload.split(':');
  if (!ivText || !tagText || !encryptedText) return '';

  try {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getSecretKey(),
      Buffer.from(ivText, 'base64')
    );
    decipher.setAuthTag(Buffer.from(tagText, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedText, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}
