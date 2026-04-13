function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase('de-DE')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildExternalMessageKey(input: {
  fromEmail?: unknown;
  receivedAt?: unknown;
  subject?: unknown;
  text?: unknown;
}) {
  const fromEmail = normalize(cleanText(input.fromEmail));
  const subject = normalize(cleanText(input.subject));
  const textPreview = normalize(cleanText(input.text)).slice(0, 180);

  let receivedBucket = '';
  const received = cleanText(input.receivedAt);
  if (received) {
    const parsed = new Date(received);
    if (!Number.isNaN(parsed.getTime())) {
      receivedBucket = parsed.toISOString().slice(0, 16);
    }
  }

  return [fromEmail, subject, receivedBucket, textPreview].filter(Boolean).join('||');
}
