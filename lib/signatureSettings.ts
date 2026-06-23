export const EMAIL_SIGNATURE_SETTINGS_DOC_ID = 'emailSignature';

export type EmailSignatureSettings = {
  templateHtml?: string;
  updatedAt?: unknown;
};

export const DEFAULT_EMAIL_SIGNATURE_TEMPLATE_HTML = `<div style="font-family:Arial, Helvetica, sans-serif;font-size:13px;line-height:1.45;color:#334155;">
  <p style="margin:0 0 14px 0;">Mit freundlichen Gr&uuml;&szlig;en</p>
  <table cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
    <tr>
      <td style="padding:2px 18px 2px 0;vertical-align:top;width:150px;">
        {{LOGO}}
      </td>
      <td style="border-left:2px solid #c23b2e;padding:0 0 0 18px;vertical-align:top;">
        <p style="margin:0;font-size:15px;font-weight:700;color:#0f172a;">{{NAME}}</p>
        <p style="margin:2px 0 10px 0;font-size:13px;font-weight:700;color:#0f172a;">{{COMPANY_LINE}}</p>
        <p style="margin:0 0 3px 0;">{{STREET_LINE}}</p>
        <p style="margin:0 0 8px 0;">{{CITY_LINE}}</p>
        <p style="margin:0 0 3px 0;">Telefon: {{PHONE}}</p>
        <p style="margin:0 0 3px 0;">E-Mail: {{EMAIL}}</p>
        <p style="margin:0 0 10px 0;">{{WEBSITE}}</p>
        <p style="margin:0;font-size:11px;line-height:1.45;color:#64748b;">{{REGISTER_COURT_LINE}} | {{HRB_LINE}}</p>
        <p style="margin:2px 0 0 0;font-size:11px;line-height:1.45;color:#64748b;">{{MANAGING_DIRECTOR_LINE}}</p>
        <p style="margin:2px 0 0 0;font-size:11px;line-height:1.45;color:#64748b;">{{TAX_NUMBER_LINE}} | {{VAT_ID_LINE}}</p>
      </td>
    </tr>
  </table>
</div>`;

export function cleanEmailSignatureTemplate(value: unknown) {
  if (typeof value !== 'string') return DEFAULT_EMAIL_SIGNATURE_TEMPLATE_HTML;
  const cleaned = value.trim();
  if (!cleaned) return DEFAULT_EMAIL_SIGNATURE_TEMPLATE_HTML;

  const isOldBrokenDefault =
    cleaned.includes('GrÃ') ||
    cleaned.includes('Â·') ||
    (cleaned.includes('font-family:Tahoma') && cleaned.includes('{{CLOSING}}'));

  return isOldBrokenDefault ? DEFAULT_EMAIL_SIGNATURE_TEMPLATE_HTML : cleaned;
}
