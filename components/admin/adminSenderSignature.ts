'use client';

import type { User } from 'firebase/auth';
import type { UserProfile } from '../../lib/auth';
import { cleanSignatureText, type SignatureRecord } from '../../lib/signatures';

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function nameFromEmail(value: unknown) {
  const email = cleanText(value);
  const localPart = email.split('@')[0] || '';
  return localPart
    .split(/[._-]+/)
    .map((part) => (part ? `${part.charAt(0).toLocaleUpperCase('de-DE')}${part.slice(1)}` : ''))
    .filter(Boolean)
    .join(' ');
}

export function resolveAdminSenderName(profile: UserProfile | null, user: User | null) {
  return (
    cleanText(profile?.displayName) ||
    cleanText(user?.displayName) ||
    nameFromEmail(profile?.email) ||
    nameFromEmail(user?.email) ||
    cleanText(profile?.username) ||
    ''
  );
}

export function resolveAdminSenderContact(profile: UserProfile | null, user: User | null) {
  return {
    mobilePhone: cleanText(profile?.mobilePhone),
    name: resolveAdminSenderName(profile, user),
    phone: cleanText(profile?.phone),
  };
}

export function applyAdminSenderToSignature(
  signature: SignatureRecord,
  sender: string | ReturnType<typeof resolveAdminSenderContact>
) {
  const resolvedName = cleanSignatureText(typeof sender === 'string' ? sender : sender.name);
  const resolvedMobilePhone = typeof sender === 'string' ? '' : cleanSignatureText(sender.mobilePhone);
  const resolvedPhone = typeof sender === 'string' ? '' : cleanSignatureText(sender.phone);

  if (!resolvedName && !resolvedMobilePhone && !resolvedPhone) return signature;

  return {
    ...signature,
    mobilePhone: resolvedMobilePhone || signature.mobilePhone,
    name: resolvedName || signature.name,
    phone: resolvedPhone || signature.phone,
    portalName: resolvedName || signature.portalName,
  };
}
