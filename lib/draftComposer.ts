function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRecipientName(name: string) {
  const trimmed = cleanText(name);
  if (!trimmed.includes(',')) return trimmed;
  const [lastName, firstName] = trimmed
    .split(',')
    .map((part) => cleanText(part))
    .filter(Boolean);
  return [firstName, lastName].filter(Boolean).join(' ').trim();
}

function lastNameFromRecipient(name: string) {
  const normalized = normalizeRecipientName(name);
  if (!normalized) return '';
  const segments = normalized.split(/\s+/).filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : normalized;
}

function removeLeadingGreetingClause(text: string) {
  const normalized = cleanText(text);
  if (!normalized) return '';

  return normalized.replace(
    /^(?:guten tag|guten morgen|guten abend|hallo|sehr geehrte?r?(?:\s+(?:frau|herr))?)(?:\s+[^\n,]+){0,6},\s*/i,
    ''
  );
}

function inferSalutationFromContext(contextText: string) {
  const source = cleanText(contextText);
  if (!source) return '';
  const match = source.match(/\b(Frau|Herr)\s+([A-ZÄÖÜ][a-zäöüßA-ZÄÖÜ-]+)/u);
  if (!match) return '';
  return cleanText(match[1]);
}

function normalizeSalutation(value: string) {
  const normalized = cleanText(value).toLocaleLowerCase('de-DE');
  if (['frau', 'ms', 'mrs', 'w', 'weiblich'].includes(normalized)) return 'Frau';
  if (['herr', 'mr', 'm', 'männlich', 'maennlich'].includes(normalized)) return 'Herr';
  return cleanText(value);
}

export function buildRecipientGreeting({
  contextText,
  recipientName,
  recipientSalutation,
}: {
  contextText?: string;
  recipientName?: string;
  recipientSalutation?: string;
}) {
  const explicitSalutation = normalizeSalutation(cleanText(recipientSalutation));
  const inferredSalutation = inferSalutationFromContext(cleanText(contextText));
  const salutation = explicitSalutation || inferredSalutation;
  const normalizedName = normalizeRecipientName(cleanText(recipientName));

  if (salutation) {
    const lastName = lastNameFromRecipient(normalizedName);
    if (lastName) {
      return `Guten Tag ${salutation} ${lastName},`;
    }
  }

  if (normalizedName) {
    return `Guten Tag ${normalizedName},`;
  }

  return 'Guten Tag,';
}

export function stripAiEnvelope(text: string) {
  const lines = cleanText(text)
    .split('\n')
    .map((line) => line.trimEnd());

  const isGreetingLine = (value: string) =>
    /^(guten tag|guten morgen|guten abend|sehr geehrt|hallo|frau\s+\S+|herr\s+\S+)\b/i.test(
      cleanText(value)
    );

  while (lines.length > 0 && !cleanText(lines[0])) {
    lines.shift();
  }

  while (lines.length > 0 && isGreetingLine(lines[0])) {
    lines.shift();
    while (lines.length > 0 && !cleanText(lines[0])) {
      lines.shift();
    }
  }

  const closingIndex = lines.findIndex((line) =>
    /^(mit freundlichen grüßen|mit freundlichem gruß|freundliche grüße|viele grüße|beste grüße|besten dank)\b/i.test(
      cleanText(line)
    )
  );

  const contentLines = closingIndex >= 0 ? lines.slice(0, closingIndex) : lines;

  while (contentLines.length > 0 && !cleanText(contentLines[contentLines.length - 1])) {
    contentLines.pop();
  }

  const content = contentLines.join('\n').trim();
  return removeLeadingGreetingClause(content);
}

export function composePortalDraft({
  aiText,
  contextText,
  portalSignature,
  recipientName,
  recipientSalutation,
}: {
  aiText: string;
  contextText?: string;
  portalSignature?: string;
  recipientName?: string;
  recipientSalutation?: string;
}) {
  const greeting = buildRecipientGreeting({
    contextText,
    recipientName,
    recipientSalutation,
  });
  const body = stripAiEnvelope(aiText);

  return [greeting, body, cleanText(portalSignature)].filter(Boolean).join('\n\n').trim();
}
