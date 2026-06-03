'use client';

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeFileName(value: string) {
  return (
    cleanText(value)
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'Brief'
  );
}

export function downloadLetterDocument(letterHtml: string, title = 'Brief') {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const content = cleanText(letterHtml);
  if (!content) return;

  const documentHtml = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="ProgId" content="Word.Document" />
    <meta name="Generator" content="Halbmann App" />
    <style>
      @page { size: A4; margin: 0; }
      body { margin: 0; background: #ffffff; }
      [data-letter-page="true"] {
        box-shadow: none !important;
        margin: 0 auto !important;
        page-break-after: always;
      }
      [data-letter-page="true"]:last-child { page-break-after: auto; }
    </style>
  </head>
  <body>${content}</body>
</html>`;

  const blob = new Blob([documentHtml], { type: 'application/msword;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFileName(title)}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadFilledLetterTemplate({
  fallbackHtml,
  fileName,
  getAuthToken,
  replacements,
  templateUrl,
}: {
  fallbackHtml: string;
  fileName: string;
  getAuthToken?: () => Promise<string>;
  replacements: Record<string, string>;
  templateUrl?: string;
}) {
  const cleanedTemplateUrl = cleanText(templateUrl);
  if (!cleanedTemplateUrl) {
    downloadLetterDocument(fallbackHtml, fileName);
    return;
  }

  const token = getAuthToken ? await getAuthToken() : '';
  const response = await fetch('/api/admin/letter-documents', {
    body: JSON.stringify({
      fileName,
      replacements,
      templateUrl: cleanedTemplateUrl,
    }),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    method: 'POST',
  });

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(result?.error || 'letter_document_create_failed');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFileName(fileName)}.docx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function buildFormalGreeting(salutation: string, name: string) {
  const cleanedSalutation = cleanText(salutation).toLocaleLowerCase('de-DE');
  const cleanedName = cleanText(name);
  if (cleanedSalutation.includes('herr')) return `Sehr geehrter Herr ${cleanedName}`.trim();
  if (cleanedSalutation.includes('frau')) return `Sehr geehrte Frau ${cleanedName}`.trim();
  return cleanedName ? `Sehr geehrte Damen und Herren, ${cleanedName}` : 'Sehr geehrte Damen und Herren';
}

export function buildLetterTemplateReplacements({
  body,
  closing,
  companyName,
  recipientAddress,
  recipientCompany,
  recipientName,
  recipientSalutation,
  senderName,
  subject,
  subjectLine2,
}: {
  body: string;
  closing?: string;
  companyName?: string;
  recipientAddress?: string;
  recipientCompany?: string;
  recipientName?: string;
  recipientSalutation?: string;
  senderName?: string;
  subject: string;
  subjectLine2?: string;
}) {
  const today = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());
  const recipientBlock = [recipientCompany, recipientName, recipientAddress].map(cleanText).filter(Boolean).join('\n');
  const greeting = buildFormalGreeting(cleanText(recipientSalutation), cleanText(recipientName));
  const closingText = [cleanText(closing) || 'Mit freundlichen Grüßen', cleanText(senderName), cleanText(companyName)]
    .filter(Boolean)
    .join('\n');

  return {
    ABSCHLUSS: closingText,
    ANREDE: greeting,
    BETREFF: cleanText(subject),
    BETREFF_ZEILE_2: cleanText(subjectLine2),
    BODY: body,
    BODY_TEXT: body,
    BRIEFTEXT: body,
    CLOSING: closingText,
    CLOSING_BLOCK: closingText,
    DATE: today,
    DATUM: today,
    EMPFAENGER: recipientBlock,
    EMPFAENGER_BLOCK: recipientBlock,
    GREETING: greeting,
    RECIPIENT_ADDRESS: cleanText(recipientAddress),
    RECIPIENT_BLOCK: recipientBlock,
    RECIPIENT_COMPANY: cleanText(recipientCompany),
    RECIPIENT_NAME: cleanText(recipientName),
    SUBJECT: cleanText(subject),
    SUBJECT_LINE_2: cleanText(subjectLine2),
  };
}
