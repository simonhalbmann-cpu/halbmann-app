export const EMAIL_SIGNATURE_SETTINGS_DOC_ID = 'emailSignature';

export type EmailSignatureSettings = {
  templateHtml?: string;
  updatedAt?: unknown;
};

export const DEFAULT_EMAIL_SIGNATURE_TEMPLATE_HTML = `<div style="font-family:Tahoma, Arial, sans-serif;font-size:13px;line-height:1.45;color:#475569;">
  <p style="margin:0;">{{CLOSING}}</p>
  <p style="margin:18px 0 0 0;color:#0f172a;">{{NAME}}</p>
  <p style="margin:6px 0 0 0;color:#0f172a;">{{COMPANY_LINE}}</p>
  <p style="margin:12px 0 0 0;">{{STREET_LINE}} · {{CITY_LINE}}</p>
  <p style="margin:4px 0 0 0;">Telefon: {{PHONE}} · {{EMAIL}}</p>
  <div style="margin:16px 0 0 0;">{{LOGO}}</div>
  <p style="margin:12px 0 0 0;font-size:11px;color:#64748b;">{{REGISTER_COURT_LINE}} · {{HRB_LINE}} · {{MANAGING_DIRECTOR_LINE}}</p>
  <p style="margin:4px 0 0 0;font-size:11px;color:#64748b;">{{TAX_NUMBER_LINE}} · {{VAT_ID_LINE}}</p>
</div>`;

export function cleanEmailSignatureTemplate(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_EMAIL_SIGNATURE_TEMPLATE_HTML;
}
