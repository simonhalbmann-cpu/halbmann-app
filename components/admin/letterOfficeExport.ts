'use client';

import {
  buildCompanyLine,
  cleanSignatureText,
  DEFAULT_SIGNATURE_EMAIL,
  formatCommercialRegisterDisplay,
  formatManagingDirectorDisplay,
  formatRegisterCourtDisplay,
  formatTaxNumberDisplay,
  formatVatIdDisplay,
  normalizeLegalFormDisplay,
  type SignatureRecord,
} from '../../lib/signatures';

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
  signature,
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
  signature?: SignatureRecord;
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
  const senderCompanyName = cleanSignatureText(signature?.companyName) || cleanText(companyName);
  const senderLegalForm = cleanSignatureText(signature?.legalForm);
  const companyLine = buildCompanyLine(senderCompanyName, senderLegalForm);
  const streetLine = [signature?.street, signature?.houseNumber].map(cleanSignatureText).filter(Boolean).join(' ');
  const cityLine = [signature?.postalCode, signature?.city].map(cleanSignatureText).filter(Boolean).join(' ');
  const registeredOffice = cleanSignatureText(signature?.registeredOffice) || cleanSignatureText(signature?.city);
  const registerCourtLine = formatRegisterCourtDisplay(signature?.registerCourt);
  const commercialRegisterLine = formatCommercialRegisterDisplay(signature?.commercialRegisterNumber);
  const managingDirectorLine = formatManagingDirectorDisplay(signature?.managingDirector);
  const taxNumberLine = formatTaxNumberDisplay(signature?.taxNumber);
  const vatIdLine = formatVatIdDisplay(signature?.vatId);
  const email = DEFAULT_SIGNATURE_EMAIL;
  const senderLine = [companyLine, streetLine, cityLine].filter(Boolean).join(' • ');
  const footerLine1 = [companyLine, streetLine, cityLine, email, cleanSignatureText(signature?.website)]
    .filter(Boolean)
    .join(' • ');
  const footerLine2 = [registerCourtLine, commercialRegisterLine, managingDirectorLine, taxNumberLine, vatIdLine]
    .filter(Boolean)
    .join(' • ');
  const footerLine3 = [cleanSignatureText(signature?.bankName), cleanSignatureText(signature?.iban), cleanSignatureText(signature?.bic)]
    .filter(Boolean)
    .join(' • ');
  const closingText = [cleanText(closing) || 'Mit freundlichen Grüßen', cleanText(senderName), companyLine]
    .filter(Boolean)
    .join('\n');

  return {
    ABSCHLUSS: closingText,
    ABSENDER_ZEILE: senderLine,
    ANREDE: greeting,
    BANK: cleanSignatureText(signature?.bankName),
    BETREFF: cleanText(subject),
    BETREFF_ZEILE_2: cleanText(subjectLine2),
    BIC: cleanSignatureText(signature?.bic),
    BODY: body,
    BODY_TEXT: body,
    BRIEFTEXT: body,
    CITY_DATE: `${cleanSignatureText(signature?.city) || 'Berlin'}, ${today}`,
    CITY_LINE: cityLine,
    CLOSING: closingText,
    CLOSING_BLOCK: closingText,
    COMPANY_LINE: companyLine,
    COMPANY_NAME: senderCompanyName,
    DATE: today,
    DATUM: today,
    EMAIL: email,
    EMPFAENGER: recipientBlock,
    EMPFAENGER_BLOCK: recipientBlock,
    FOOTER: [footerLine1, footerLine2, footerLine3].filter(Boolean).join('\n'),
    FOOTER_LINE_1: footerLine1,
    FOOTER_LINE_2: footerLine2,
    FOOTER_LINE_3: footerLine3,
    FORMAL_SALUTATION: greeting,
    GREETING: greeting,
    HRB: cleanSignatureText(signature?.commercialRegisterNumber),
    HRB_LINE: commercialRegisterLine,
    IBAN: cleanSignatureText(signature?.iban),
    LEGAL_FORM: normalizeLegalFormDisplay(senderLegalForm),
    LOGO_ALT: cleanSignatureText(signature?.logoAlt) || 'Halbmann',
    MANAGING_DIRECTOR: cleanSignatureText(signature?.managingDirector),
    MANAGING_DIRECTOR_LINE: managingDirectorLine,
    PHONE: cleanSignatureText(signature?.phone) || cleanSignatureText(signature?.mobilePhone),
    RECIPIENT_ADDRESS: cleanText(recipientAddress),
    RECIPIENT_BLOCK: recipientBlock,
    RECIPIENT_COMPANY: cleanText(recipientCompany),
    RECIPIENT_NAME: cleanText(recipientName),
    REGISTER_COURT: cleanSignatureText(signature?.registerCourt),
    REGISTER_COURT_LINE: registerCourtLine,
    REGISTERED_OFFICE: registeredOffice,
    SENDER_LINE: senderLine,
    SIGNATURE_NAME: cleanText(senderName),
    STREET_LINE: streetLine,
    SUBJECT: cleanText(subject),
    SUBJECT_LINE_2: cleanText(subjectLine2),
    TAX_NUMBER: cleanSignatureText(signature?.taxNumber),
    TAX_NUMBER_LINE: taxNumberLine,
    VAT_ID: cleanSignatureText(signature?.vatId),
    VAT_ID_LINE: vatIdLine,
    WEBSITE: cleanSignatureText(signature?.website),
  };
}
