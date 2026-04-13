export const PORTAL_INBOX_EMAIL = 'portal@halbmann-holding.de';

export function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function extractFirstEmail(value: unknown) {
  if (typeof value !== 'string') return '';
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return normalizeEmail(match?.[0] ?? '');
}
