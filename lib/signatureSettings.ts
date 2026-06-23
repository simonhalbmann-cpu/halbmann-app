export const EMAIL_SIGNATURE_SETTINGS_DOC_ID = 'emailSignature';

export type EmailSignatureSettings = {
  templateHtml?: string;
  updatedAt?: unknown;
};

export const DEFAULT_EMAIL_SIGNATURE_TEMPLATE_HTML = `<div style="font-family:Arial, Helvetica, sans-serif;font-size:13px;line-height:1.45;color:#334155;">
  <p style="margin:0 0 14px 0;">Mit freundlichen Gr&uuml;&szlig;en</p>
  <table cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
    <tr>
      <td style="padding:0 16px 0 0;vertical-align:top;width:132px;">
        <div style="margin:1px 0 10px 0;">{{LOGO}}</div>
        <div style="width:38px;border-top:2px solid #c23b2e;"></div>
      </td>
      <td style="padding:0;vertical-align:top;">
        <p style="margin:0;font-size:15px;font-weight:700;color:#111827;">{{NAME}}</p>
        <p style="margin:2px 0 9px 0;font-size:13px;font-weight:700;color:#111827;">{{COMPANY_LINE}}</p>
        <p style="margin:0 0 2px 0;">{{STREET_LINE}}, {{CITY_LINE}}</p>
        <p style="margin:0 0 2px 0;">Telefon: {{PHONE}} | E-Mail: {{EMAIL}}</p>
        <p style="margin:0 0 10px 0;">{{WEBSITE}}</p>
        <div style="padding-top:8px;border-top:1px solid #e5e7eb;font-size:11px;line-height:1.45;color:#64748b;">
          <p style="margin:0;">{{REGISTER_COURT_LINE}} | {{HRB_LINE}}</p>
          <p style="margin:2px 0 0 0;">{{MANAGING_DIRECTOR_LINE}}</p>
          <p style="margin:2px 0 0 0;">{{TAX_NUMBER_LINE}} | {{VAT_ID_LINE}}</p>
        </div>
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
    cleaned.includes('Â') ||
    cleaned.includes('border-left:2px solid #c23b2e') ||
    (cleaned.includes('font-family:Tahoma') && cleaned.includes('{{CLOSING}}'));

  return isOldBrokenDefault ? DEFAULT_EMAIL_SIGNATURE_TEMPLATE_HTML : cleaned;
}
