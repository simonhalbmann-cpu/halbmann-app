export const EMAIL_SIGNATURE_SETTINGS_DOC_ID = 'emailSignature';

export type EmailSignatureSettings = {
  templateHtml?: string;
  updatedAt?: unknown;
};

export const DEFAULT_EMAIL_SIGNATURE_TEMPLATE_HTML = `<div style="font-family:Arial, Helvetica, sans-serif;font-size:13px;line-height:1.45;color:#334155;max-width:560px;">
  <p style="margin:0 0 14px 0;">Mit freundlichen Gr&uuml;&szlig;en</p>
  <div style="margin:0 0 12px 0;">{{LOGO}}</div>
  <p style="margin:0;font-size:15px;font-weight:700;color:#111827;">{{NAME}}</p>
  <p style="margin:2px 0 8px 0;font-size:13px;font-weight:700;color:#111827;">{{COMPANY_LINE}}</p>
  <p style="margin:0 0 2px 0;">{{STREET_LINE}}</p>
  <p style="margin:0 0 2px 0;">{{CITY_LINE}}</p>
  <p style="margin:8px 0 2px 0;">Telefon: {{PHONE}}</p>
  <p style="margin:0 0 2px 0;">E-Mail: {{EMAIL}}</p>
  <p style="margin:0 0 12px 0;">{{WEBSITE}}</p>
  <div style="border-top:2px solid #cbd5e1;padding-top:8px;font-size:11px;line-height:1.45;color:#64748b;">
    <p style="margin:0;">{{LEGAL_LINE_1}}</p>
    <p style="margin:2px 0 0 0;">{{LEGAL_LINE_2}}</p>
  </div>
</div>`;

export function cleanEmailSignatureTemplate(value: unknown) {
  if (typeof value !== 'string') return DEFAULT_EMAIL_SIGNATURE_TEMPLATE_HTML;
  const cleaned = value.trim();
  if (!cleaned) return DEFAULT_EMAIL_SIGNATURE_TEMPLATE_HTML;

  const isOldBrokenDefault =
    cleaned.includes('GrÃ') ||
    cleaned.includes('Â') ||
    cleaned.includes('border-left:2px solid #c23b2e') ||
    cleaned.includes('width:38px;border-top:2px solid #c23b2e') ||
    (cleaned.includes('font-family:Tahoma') && cleaned.includes('{{CLOSING}}'));

  return isOldBrokenDefault ? DEFAULT_EMAIL_SIGNATURE_TEMPLATE_HTML : cleaned;
}
