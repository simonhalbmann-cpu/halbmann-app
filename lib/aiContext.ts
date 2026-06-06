const SENSITIVE_KEY_PATTERN = /(password|passwort|secret|token|apikey|api_key|privatekey|private_key|smtp|imap)/i;
const MAX_OBJECT_KEYS = 80;
const MAX_ARRAY_ITEMS = 80;
const MAX_STRING_LENGTH = 1200;

export type AiContextValue =
  | null
  | string
  | number
  | boolean
  | AiContextValue[]
  | { [key: string]: AiContextValue };

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function sanitizeAiContext(value: unknown, depth = 0): AiContextValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const text = value.trim();
    return text.length > MAX_STRING_LENGTH ? `${text.slice(0, MAX_STRING_LENGTH)}...` : text;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth > 5) return '[gekürzt]';

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((entry) => sanitizeAiContext(entry, depth + 1));
  }

  if (typeof value === 'object') {
    const output: { [key: string]: AiContextValue } = {};
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SENSITIVE_KEY_PATTERN.test(key))
      .slice(0, MAX_OBJECT_KEYS)
      .forEach(([key, entry]) => {
        output[key] = sanitizeAiContext(entry, depth + 1);
      });
    return output;
  }

  return null;
}

export function formatAiContextForPrompt(value: unknown) {
  const sanitized = sanitizeAiContext(value);
  const text = cleanText(JSON.stringify(sanitized, null, 2));
  if (!text || text === 'null') return '';
  return text.length > 28000 ? `${text.slice(0, 28000)}\n... [Kontext gekürzt]` : text;
}

