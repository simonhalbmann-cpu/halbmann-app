export type SignatureRecord = {
  bankName: string;
  bic: string;
  city: string;
  closing: string;
  commercialRegisterNumber: string;
  companyName: string;
  country: string;
  department: string;
  email: string;
  emailTemplateHtml: string;
  fontBold: boolean;
  fontFamily: string;
  fontItalic: boolean;
  fontSize: string;
  fontUnderline: boolean;
  houseNumber: string;
  iban: string;
  legalForm: string;
  logoAlt: string;
  logoUrl: string;
  letterRightBlock: string;
  letterRightBlockBold: boolean;
  letterRightBlockFontFamily: string;
  letterRightBlockFontSize: string;
  letterRightBlockItalic: boolean;
  letterRightBlockTextAlign: 'center' | 'left';
  letterRightBlockUnderline: boolean;
  letterSenderLine: string;
  letterShowLogo: boolean;
  letterFooterBold: boolean;
  letterFooterDivider: boolean;
  letterClosing: string;
  letterClosingBlock: string;
  letterFooter: string;
  letterGreeting: string;
  letterMarginBottom: number;
  letterMarginLeft: number;
  letterMarginRight: number;
  letterMarginTop: number;
  letterFooterFontFamily: string;
  letterFooterFontSize: string;
  letterFooterItalic: boolean;
  letterFooterTextAlign: 'center' | 'left';
  letterFooterUnderline: boolean;
  letterHeaderBold: boolean;
  letterHeader: string;
  letterHeaderDivider: boolean;
  letterHeaderFontFamily: string;
  letterHeaderFontSize: string;
  letterHeaderItalic: boolean;
  letterSubheader: string;
  letterTemplateHtml: string;
  letterHeaderTextAlign: 'center' | 'left';
  letterHeaderUnderline: boolean;
  managingDirector: string;
  mobilePhone: string;
  name: string;
  phone: string;
  portalClosing: string;
  portalCompanyName: string;
  portalName: string;
  postalCode: string;
  registerCourt: string;
  registeredOffice: string;
  street: string;
  taxNumber: string;
  textAlign: 'center' | 'left';
  useDivider: boolean;
  vatId: string;
  website: string;
};

export const DEFAULT_SIGNATURE_EMAIL = 'portal@halbmann-holding.de';

export function cleanSignatureText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

const LETTER_PAGE_WIDTH_PX = 794;
const LETTER_PAGE_HEIGHT_PX = 1123;

export function normalizeLegalFormDisplay(value: unknown) {
  const normalized = cleanSignatureText(value).replace(/\s+/g, ' ');
  if (!normalized) return '';

  const compact = normalized.replace(/[.\s]/g, '').toLowerCase();
  const knownForms: Record<string, string> = {
    ag: 'AG',
    ek: 'e. K.',
    eg: 'eG',
    ev: 'e. V.',
    gbr: 'GbR',
    gmbh: 'GmbH',
    'gmbh&co.kg': 'GmbH & Co. KG',
    kg: 'KG',
    kgaa: 'KGaA',
    ohg: 'OHG',
    ug: 'UG',
    'ughaftungsbeschrankt': 'UG (haftungsbeschränkt)',
  };

  return knownForms[compact] || normalized;
}

function ensureSpaceBeforeLegalForm(value: string) {
  return value
    .replace(/([A-Za-zÄÖÜäöüß])(?=(GmbH|UG|GbR|KG|AG|OHG|KGaA)\b)/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCompanyDisplayName(value: unknown) {
  return ensureSpaceBeforeLegalForm(cleanSignatureText(value));
}

export function buildCompanyLine(companyName: string, legalForm: string) {
  const normalizedCompanyName = normalizeCompanyDisplayName(companyName);
  const normalizedLegalForm = normalizeLegalFormDisplay(legalForm);
  if (!normalizedCompanyName) return normalizedLegalForm;
  if (!normalizedLegalForm) return normalizedCompanyName;

  const compactCompanyName = normalizedCompanyName.replace(/[.\s]/g, '').toLowerCase();
  const compactLegalForm = normalizedLegalForm.replace(/[.\s]/g, '').toLowerCase();
  if (compactCompanyName.endsWith(compactLegalForm)) return normalizedCompanyName;

  return `${normalizedCompanyName} ${normalizedLegalForm}`;
}

function splitListValues(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => cleanSignatureText(entry))
      .filter(Boolean);
  }

  return cleanSignatureText(value)
    .split(/\r?\n|,/)
    .map((entry) => cleanSignatureText(entry))
    .filter(Boolean);
}

export function formatRegisterCourtDisplay(value: unknown) {
  const normalized = cleanSignatureText(value);
  if (!normalized) return '';
  if (/^(AG|Amtsgericht)\b/i.test(normalized)) return normalized;
  return `AG ${normalized}`;
}

export function formatCommercialRegisterDisplay(value: unknown) {
  const normalized = cleanSignatureText(value);
  if (!normalized) return '';
  if (/^(HRB|HRA)\b/i.test(normalized)) return normalized.replace(/\s+/g, ' ');
  return `HRB ${normalized}`;
}

export function formatManagingDirectorDisplay(value: unknown) {
  const directors = splitListValues(value);
  if (directors.length === 0) return '';
  return `Geschäftsführer: ${directors.join(', ')}`;
}

export function formatTaxNumberDisplay(value: unknown) {
  const normalized = cleanSignatureText(value);
  if (!normalized) return '';
  if (/^Steuer\s*ID:/i.test(normalized)) return normalized;
  return `Steuer ID: ${normalized}`;
}

export function formatVatIdDisplay(value: unknown) {
  const normalized = cleanSignatureText(value);
  if (!normalized) return '';
  if (/^USt\.?-?Id(?:Nr)?\.?:/i.test(normalized)) return normalized;
  return `USt.-ID: ${normalized}`;
}

function getManagingDirectorAt(value: unknown, index: number) {
  return splitListValues(value)[index] || '';
}

function firstSignatureText(...values: unknown[]) {
  for (const value of values) {
    const text = cleanSignatureText(value);
    if (text) return text;
  }
  return '';
}

function firstRecordText(...values: unknown[]) {
  for (const value of values) {
    if (Array.isArray(value)) {
      const joined = value.map((entry) => cleanSignatureText(entry)).filter(Boolean).join(', ');
      if (joined) return joined;
      continue;
    }

    const text = cleanSignatureText(value);
    if (text) return text;
  }
  return '';
}

export const LETTER_TEMPLATE_TOKENS = [
  '{{LOGO}}',
  '{{BANK}}',
  '{{BIC}}',
  '{{COMPANY_NAME}}',
  '{{LEGAL_FORM}}',
  '{{COMPANY_LINE}}',
  '{{STREET_LINE}}',
  '{{CITY_LINE}}',
  '{{EMAIL}}',
  '{{PHONE}}',
  '{{WEBSITE}}',
  '{{REGISTER_COURT}}',
  '{{REGISTER_COURT_LINE}}',
  '{{HRB}}',
  '{{HRB_LINE}}',
  '{{IBAN}}',
  '{{MANAGING_DIRECTOR}}',
  '{{MANAGING_DIRECTOR_1}}',
  '{{MANAGING_DIRECTOR_2}}',
  '{{MANAGING_DIRECTOR_LINE}}',
  '{{TAX_NUMBER}}',
  '{{TAX_NUMBER_LINE}}',
  '{{VAT_ID}}',
  '{{VAT_ID_LINE}}',
  '{{REGISTERED_OFFICE}}',
  '{{RECIPIENT_COMPANY}}',
  '{{RECIPIENT_NAME}}',
  '{{FORMAL_SALUTATION}}',
  '{{GEEHRTE_SUFFIX}}',
  '{{RECIPIENT_ADDRESS}}',
  '{{RECIPIENT_BLOCK}}',
  '{{PROPERTY_NAME}}',
  '{{UNIT_LABEL}}',
  '{{SENDER_LINE}}',
  '{{CITY_DATE}}',
  '{{SUBJECT}}',
  '{{SUBJECT_LINE_2}}',
  '{{BETREFF_ZEILE_2}}',
  '{{GREETING}}',
  '{{SIGNATURE_NAME}}',
  '{{BODY_HTML}}',
  '{{CLOSING_BLOCK}}',
  '{{LOGO_URL}}',
  '{{LOGO_ALT}}',
] as const;

export const EMAIL_SIGNATURE_TOKENS = [
  '{{CLOSING}}',
  '{{NAME}}',
  '{{SIGNATURE_NAME}}',
  '{{COMPANY_NAME}}',
  '{{LEGAL_FORM}}',
  '{{COMPANY_LINE}}',
  '{{DEPARTMENT}}',
  '{{STREET_LINE}}',
  '{{CITY_LINE}}',
  '{{ADDRESS}}',
  '{{MOBILE}}',
  '{{PHONE}}',
  '{{EMAIL}}',
  '{{WEBSITE}}',
  '{{REGISTERED_OFFICE}}',
  '{{MANAGING_DIRECTOR}}',
  '{{MANAGING_DIRECTOR_LINE}}',
  '{{REGISTER_COURT}}',
  '{{REGISTER_COURT_LINE}}',
  '{{HRB}}',
  '{{HRB_LINE}}',
  '{{TAX_NUMBER}}',
  '{{TAX_NUMBER_LINE}}',
  '{{VAT_ID}}',
  '{{VAT_ID_LINE}}',
  '{{LEGAL_LINE_1}}',
  '{{LEGAL_LINE_2}}',
  '{{LOGO}}',
  '{{LOGO_URL}}',
  '{{LOGO_ALT}}',
] as const;

function hasLetterTemplateDataTokens(template: string) {
  return LETTER_TEMPLATE_TOKENS.some((token) => template.includes(token));
}

function buildDefaultLetterRightBlock(data?: Record<string, unknown> | null) {
  const companyName = firstRecordText(data?.name);
  const legalForm = normalizeLegalFormDisplay(firstRecordText(data?.legalForm));
  const street = firstRecordText(data?.street);
  const houseNumber = firstRecordText(data?.houseNumber);
  const postalCode = firstRecordText(data?.postalCode);
  const city = firstRecordText(data?.city);
  const email = DEFAULT_SIGNATURE_EMAIL;
  const phone = firstRecordText(data?.phone);
  const website = firstRecordText(data?.website);
  const registerCourt = formatRegisterCourtDisplay(
    firstRecordText(data?.registerCourt)
  );
  const commercialRegisterNumber =
    formatCommercialRegisterDisplay(
      firstRecordText(data?.commercialRegisterNumber, data?.hrb)
    );
  const managingDirector = formatManagingDirectorDisplay(
    firstRecordText(data?.managingDirector)
  );
  const taxNumber = formatTaxNumberDisplay(firstRecordText(data?.taxNumber));
  const vatId = formatVatIdDisplay(firstRecordText(data?.vatId));

  return [
    buildCompanyLine(companyName, legalForm),
    [street, houseNumber].filter(Boolean).join(' '),
    [postalCode, city].filter(Boolean).join(' '),
    [email, phone].filter(Boolean).join(' Â· '),
    website,
    registerCourt,
    commercialRegisterNumber,
    managingDirector,
    taxNumber,
    vatId,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildDefaultLetterSenderLine(data?: Record<string, unknown> | null) {
  const companyName = firstRecordText(data?.name);
  const street = firstRecordText(data?.street);
  const houseNumber = firstRecordText(data?.houseNumber);
  const postalCode = firstRecordText(data?.postalCode);
  const city = firstRecordText(data?.city);

  return [
    companyName,
    [street, houseNumber].filter(Boolean).join(' '),
    [postalCode, city].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(' Â· ');
}

function buildTemplateInfoLines(signature: SignatureRecord) {
  return [
    '{{COMPANY_LINE}}',
    '{{STREET_LINE}}',
    '{{CITY_LINE}}',
    '{{EMAIL}} · {{PHONE}}',
    '{{WEBSITE}}',
    '{{REGISTER_COURT_LINE}}',
    '{{HRB_LINE}}',
    '{{MANAGING_DIRECTOR_LINE}}',
    '{{TAX_NUMBER_LINE}}',
    '{{VAT_ID_LINE}}',
  ].filter(Boolean);
}

function buildTemplateFooterLines(signature: SignatureRecord) {
  return [
    'Sitz: {{REGISTERED_OFFICE}}',
    '{{REGISTER_COURT_LINE}}',
    '{{HRB_LINE}}',
    '{{MANAGING_DIRECTOR_LINE}}',
    '{{TAX_NUMBER_LINE}}',
    '{{VAT_ID_LINE}}',
  ].filter(Boolean);
}

function buildDefaultLetterTemplate(signature: SignatureRecord, variant: number) {
  const infoLines = buildTemplateInfoLines(signature);
  const footerLines = buildTemplateFooterLines(signature);
  const logoHtml =
    signature.logoUrl && signature.letterShowLogo
      ? `<img src="{{LOGO_URL}}" alt="{{LOGO_ALT}}" style="max-height:78px;max-width:220px;object-fit:contain;" />`
      : '';
  const subjectBlock =
    '<div style="margin:0 0 22px 0;font-size:18px;font-weight:600;color:#1f2937;">{{SUBJECT}}</div>';
  const bodyBlock =
    '<div style="white-space:pre-wrap;min-height:28px;text-align:justify;text-align-last:left;">{{BODY_HTML}}</div>';
  const closingBlock =
    '<div style="margin-top:28px;white-space:pre-line;">{{CLOSING_BLOCK}}</div>';
  const senderLine =
    '<div style="margin:0 0 18px 0;padding-bottom:6px;font-size:11px;color:#6b7280;border-bottom:1px solid #e7e5e4;">{{SENDER_LINE}}</div>';
  const footerBlock = footerLines.length
    ? `<div style="margin-top:28px;padding-top:14px;border-top:1px solid #d6d3d1;font-size:11px;line-height:1.6;color:#57534e;">${footerLines
        .map((line) => `<div>${line}</div>`)
        .join('')}</div>`
    : '';

  if (variant === 1) {
    return `
      <div style="font-family:Segoe UI, Arial, sans-serif;font-size:14px;line-height:1.65;color:#1f2937;background:#ffffff;padding:52px 56px;">
        <div style="margin-bottom:30px;">
          ${logoHtml ? `<div style="margin-bottom:14px;">${logoHtml}</div>` : ''}
          <div style="font-size:28px;font-weight:700;letter-spacing:0.04em;color:#111827;">{{COMPANY_NAME}}</div>
          ${
            signature.letterSubheader
              ? `<div style="margin-top:6px;font-size:13px;color:#6b7280;">${encodeHtml(signature.letterSubheader)}</div>`
              : ''
          }
          <div style="margin-top:16px;font-size:12px;line-height:1.6;color:#57534e;">
            ${infoLines.map((line) => `<div>${line}</div>`).join('')}
          </div>
        </div>
        ${senderLine}
        ${subjectBlock}
        ${bodyBlock}
        ${closingBlock}
        ${footerBlock}
      </div>
    `;
  }

  if (variant === 2) {
    return `
      <div style="font-family:Georgia, 'Times New Roman', serif;font-size:14px;line-height:1.7;color:#1f2937;background:#ffffff;padding:48px 60px;">
        <div style="border-bottom:2px solid #a78b68;padding-bottom:18px;margin-bottom:24px;">
          ${logoHtml ? `<div style="margin-bottom:14px;">${logoHtml}</div>` : ''}
          <div style="font-size:22px;font-weight:700;color:#111827;">{{COMPANY_NAME}}</div>
          ${
            signature.letterSubheader
              ? `<div style="margin-top:5px;font-size:12px;color:#6b7280;">${encodeHtml(signature.letterSubheader)}</div>`
              : ''
          }
          <div style="margin-top:14px;font-size:11px;line-height:1.65;color:#57534e;">
            ${infoLines.map((line) => `<div>${line}</div>`).join('')}
          </div>
        </div>
        ${senderLine}
        ${subjectBlock}
        ${bodyBlock}
        ${closingBlock}
        ${footerBlock}
      </div>
    `;
  }

  return `
    <div style="font-family:Garamond, 'Times New Roman', serif;font-size:12pt;line-height:1.6;color:#111827;background:#ffffff;padding:0 0 32px 0;">
      <div style="padding:0 56px;">
        ${logoHtml ? `<div style="margin:0 0 12px 0;">${logoHtml}</div>` : ''}
        <div style="margin:0 0 32px 0;font-family:Arial, sans-serif;font-size:8pt;font-weight:700;text-decoration:underline;color:#000000;">{{SENDER_LINE}}</div>
        <div style="min-height:70px;font-family:Arial, sans-serif;font-size:11pt;line-height:1.45;color:#111827;">
          {{RECIPIENT_BLOCK}}
        </div>
        <div style="margin:10px 0 0 0;text-align:right;">{{CITY_DATE}}</div>
        <div style="margin:34px 0 0 0;font-family:Arial, sans-serif;font-size:11pt;">
          <span style="font-weight:700;font-style:italic;">Betreff:</span>
          <span style="font-weight:700;font-style:italic;"> {{SUBJECT}}</span>
        </div>
        <div style="margin:4px 0 22px 0;font-family:Arial, sans-serif;font-style:italic;">Objekt: {{PROPERTY_NAME}} {{UNIT_LABEL}}</div>
        ${bodyBlock}
        ${closingBlock}
        <div style="margin-top:28px;font-family:Arial, sans-serif;font-size:8pt;color:#111827;">{{COMPANY_NAME}}</div>
      </div>
      ${
        footerLines.length > 0
          ? `<div style="margin-top:26px;padding:0 56px;font-family:Arial, sans-serif;font-size:8pt;line-height:1.5;color:#57534e;text-align:center;">${footerLines
              .map((line) => `<div>${line}</div>`)
              .join('')}</div>`
          : ''
      }
    </div>
  `;
}

export function buildLetterTemplateSuggestions(signature: SignatureRecord) {
  return [0, 1, 2].map((variant) => buildDefaultLetterTemplate(signature, variant));
}

function escapeTokenForRegex(token: string) {
  return token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasHtmlMarkup(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function renderRichTextTemplate(
  value: string,
  fallback: string,
  replacements: Record<string, string>
) {
  const raw = cleanSignatureText(value) || fallback;
  const isHtml = hasHtmlMarkup(raw);
  let result = raw;

  Object.entries(replacements).forEach(([token, replacement]) => {
    result = result.replace(new RegExp(escapeTokenForRegex(token), 'g'), isHtml ? encodeHtml(replacement) : replacement);
  });

  return isHtml ? result : encodeHtml(result).replace(/\n/g, '<br />');
}

function normalizeGreetingTemplate(value: string) {
  return value
    .replace(/,(?:&(?:amp;)?nbsp;|\u00a0|\s)+(?=(?:<\/(?:div|p|span)>|\s|$))/gi, ',')
    .replace(/(?:&(?:amp;)?nbsp;|\u00a0)+(?![^<]*>)/gi, ' ')
    .replace(/(?:<br\s*\/?>\s*)+$/gi, '')
    .replace(/\s+(?=<\/(?:div|p|span)>)/gi, '')
    .trim();
}

function normalizeRecipientSalutationValue(value: unknown) {
  const normalized = cleanSignatureText(value).toLocaleLowerCase('de-DE');
  if (['frau', 'ms', 'mrs', 'w', 'weiblich'].includes(normalized)) return 'female';
  if (['herr', 'mr', 'm', 'männlich', 'maennlich'].includes(normalized)) return 'male';
  if (['divers', 'diverse', 'd'].includes(normalized)) return 'diverse';
  return '';
}

function buildGeehrteSuffix(value: unknown) {
  return normalizeRecipientSalutationValue(value) === 'male' ? 'r' : '';
}

function buildFormalSalutation(value: unknown) {
  const normalized = normalizeRecipientSalutationValue(value);
  if (normalized === 'male') return 'Sehr geehrter Herr';
  if (normalized === 'female') return 'Sehr geehrte Frau';
  return 'Sehr geehrte';
}

function buildLetterTemplateTokenMap(
  signature: SignatureRecord,
  subject: string,
  bodyHtml: string,
  emptyBodyPlaceholder?: string,
  recipient?: {
    address?: string;
    company?: string;
    name?: string;
    salutation?: string;
  },
  context?: {
    propertyName?: string;
    subjectLine2?: string;
    unitLabel?: string;
  }
) {
  const today = new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  const cityDate = [signature.city, today].filter(Boolean).join(', ');
  const resolvedBodyHtml = bodyHtml || '';
  const recipientCompany = normalizeCompanyDisplayName(recipient?.company) || 'Firma Empfänger';
  const recipientName = cleanSignatureText(recipient?.name) || 'Name EmpfÃ¤nger';
  const recipientAddress = cleanSignatureText(recipient?.address) || 'Adresse EmpfÃ¤nger';
  const recipientSalutation = cleanSignatureText(recipient?.salutation);
  const propertyName = cleanSignatureText(context?.propertyName) || 'Immobilie';
  const subjectLine2 = cleanSignatureText(context?.subjectLine2);
  const unitLabel = cleanSignatureText(context?.unitLabel) || 'Einheit';
  const registerCourtDisplay = formatRegisterCourtDisplay(signature.registerCourt);
  const commercialRegisterDisplay = formatCommercialRegisterDisplay(signature.commercialRegisterNumber);
  const managingDirectorDisplay = formatManagingDirectorDisplay(signature.managingDirector);
  const taxNumberDisplay = formatTaxNumberDisplay(signature.taxNumber);
  const vatIdDisplay = formatVatIdDisplay(signature.vatId);
  const managingDirector1 = getManagingDirectorAt(signature.managingDirector, 0);
  const managingDirector2 = getManagingDirectorAt(signature.managingDirector, 1);
  const greeting = normalizeGreetingTemplate(
    renderRichTextTemplate(signature.letterGreeting, 'Guten Tag {{RECIPIENT_NAME}},', {
      '{{FORMAL_SALUTATION}}': buildFormalSalutation(recipientSalutation),
      '{{GEEHRTE_SUFFIX}}': buildGeehrteSuffix(recipientSalutation),
      '{{RECIPIENT_ADDRESS}}': recipientAddress,
      '{{RECIPIENT_COMPANY}}': recipientCompany,
      '{{RECIPIENT_NAME}}': recipientName,
    })
  );
  const closingBlock = signature.letterClosingBlock
    ? renderRichTextTemplate(signature.letterClosingBlock, '', {
        '{{COMPANY_NAME}}': signature.companyName,
        '{{LEGAL_FORM}}': normalizeLegalFormDisplay(signature.legalForm),
        '{{LETTER_CLOSING}}': signature.letterClosing || signature.closing || 'Mit freundlichen Grüßen',
        '{{SIGNATURE_NAME}}': signature.name,
      })
    : '';
  return {
    '{{BODY_HTML}}': `<div data-letter-body="true" style="min-height:28px;white-space:pre-wrap;outline:none;text-align:justify;text-align-last:left;line-height:inherit;font:inherit;color:inherit;">${
      resolvedBodyHtml || encodeHtml(cleanSignatureText(emptyBodyPlaceholder))
    }</div>`,
    '{{BANK}}': encodeHtml(signature.bankName),
    '{{BIC}}': encodeHtml(signature.bic),
    '{{CITY_DATE}}': encodeHtml(cityDate || today),
    '{{CLOSING_BLOCK}}': closingBlock
      ? closingBlock
      : [
          encodeHtml(signature.letterClosing || signature.closing || 'Mit freundlichen GrÃ¼ÃŸen'),
          signature.name ? encodeHtml(signature.name) : '',
          signature.companyName
            ? encodeHtml(buildCompanyLine(signature.companyName, signature.legalForm))
            : '',
        ]
          .filter(Boolean)
          .join('<br /><br />')
          .replace('<br /><br /><br /><br />', '<br /><br />'),
    '{{COMPANY_LINE}}': encodeHtml(buildCompanyLine(signature.companyName, signature.legalForm)),
    '{{COMPANY_NAME}}': encodeHtml(signature.companyName),
    '{{EMAIL}}': encodeHtml(signature.email),
    '{{FORMAL_SALUTATION}}': encodeHtml(buildFormalSalutation(recipientSalutation)),
    '{{GEEHRTE_SUFFIX}}': encodeHtml(buildGeehrteSuffix(recipientSalutation)),
    '{{GREETING}}': greeting,
    '{{HRB}}': encodeHtml(commercialRegisterDisplay),
    '{{HRB_LINE}}': encodeHtml(commercialRegisterDisplay),
    '{{IBAN}}': encodeHtml(signature.iban),
    '{{LEGAL_FORM}}': encodeHtml(normalizeLegalFormDisplay(signature.legalForm)),
    '{{LOGO}}': resolveSignatureLogoUrl(signature.logoUrl)
      ? `<img src="{{LOGO_URL}}" alt="Logo" style="display:block;width:100%;height:auto;object-fit:contain;" />`
      : 'Logo',
    '{{LOGO_ALT}}': encodeHtml(signature.logoAlt || signature.companyName || 'Logo'),
    '{{LOGO_URL}}': encodeHtml(resolveSignatureLogoUrl(signature.logoUrl)),
    '{{MANAGING_DIRECTOR}}': encodeHtml(signature.managingDirector),
    '{{MANAGING_DIRECTOR_1}}': encodeHtml(managingDirector1),
    '{{MANAGING_DIRECTOR_2}}': encodeHtml(managingDirector2),
    '{{MANAGING_DIRECTOR_LINE}}': encodeHtml(managingDirectorDisplay),
    '{{PHONE}}': encodeHtml(signature.phone),
    '{{PROPERTY_NAME}}': encodeHtml(propertyName),
    '{{RECIPIENT_ADDRESS}}': encodeHtml(recipientAddress),
    '{{RECIPIENT_BLOCK}}': [recipientCompany, recipientName, recipientAddress]
      .filter(Boolean)
      .map((line) => encodeHtml(line))
      .join('<br />'),
    '{{RECIPIENT_COMPANY}}': encodeHtml(recipientCompany),
    '{{RECIPIENT_NAME}}': encodeHtml(recipientName),
    '{{REGISTERED_OFFICE}}': encodeHtml(signature.registeredOffice),
    '{{REGISTER_COURT}}': encodeHtml(registerCourtDisplay),
    '{{REGISTER_COURT_LINE}}': encodeHtml(registerCourtDisplay),
    '{{SENDER_LINE}}': encodeHtml(
      signature.letterSenderLine ||
        [signature.companyName, signature.street, signature.houseNumber, signature.postalCode, signature.city]
          .filter(Boolean)
          .join(' Â· ')
    ),
    '{{STREET_LINE}}': encodeHtml([signature.street, signature.houseNumber].filter(Boolean).join(' ')),
    '{{SUBJECT}}': encodeHtml(cleanSignatureText(subject) || 'Betreff'),
    '{{SUBJECT_LINE_2}}': encodeHtml(subjectLine2),
    '{{BETREFF_ZEILE_2}}': encodeHtml(subjectLine2),
    '{{SIGNATURE_NAME}}': encodeHtml(signature.name),
    '{{TAX_NUMBER}}': encodeHtml(cleanSignatureText(signature.taxNumber)),
    '{{TAX_NUMBER_LINE}}': encodeHtml(taxNumberDisplay),
    '{{UNIT_LABEL}}': encodeHtml(unitLabel),
    '{{VAT_ID}}': encodeHtml(cleanSignatureText(signature.vatId)),
    '{{VAT_ID_LINE}}': encodeHtml(vatIdDisplay),
    '{{WEBSITE}}': encodeHtml(signature.website),
    '{{CITY_LINE}}': encodeHtml([signature.postalCode, signature.city].filter(Boolean).join(' ')),
  };
}

function normalizeLetterTemplateTokens(template: string) {
  return LETTER_TEMPLATE_TOKENS.reduce((current, token) => {
    const core = token.slice(2, -2).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return current
      .replace(new RegExp(`(?<!\\{)\\{${core}\\}\\}`, 'g'), token)
      .replace(new RegExp(`\\{\\{${core}\\}(?!\\})`, 'g'), token)
      .replace(new RegExp(`(?<!\\{)\\{${core}\\}(?!\\})`, 'g'), token);
  }, template);
}

const LINE_ELEMENT_REGEX =
  /<div data-letter-element="line"[\s\S]*?<div data-letter-line="true"[\s\S]*?<\/div><\/div>/g;
const HEADER_SECTION_SEPARATOR_REGEX =
  /<div[^>]*data-letter-fixed-separator="header"[^>]*><\/div>/i;
const FOOTER_SECTION_SEPARATOR_REGEX =
  /<div[^>]*data-letter-fixed-separator="footer"[^>]*><\/div>/i;
function extractSectionInnerHtml(
  template: string,
  key: 'header' | 'body' | 'footer',
  nextKey?: 'body' | 'footer'
) {
  const openTagRegex = new RegExp(`<div[^>]*data-letter-section="${key}"[^>]*>`, 'i');
  const openMatch = template.match(openTagRegex);
  if (!openMatch || openMatch.index === undefined) return '';

  const contentStart = openMatch.index + openMatch[0].length;
  if (nextKey) {
    const nextRegex = new RegExp(`<div[^>]*data-letter-section="${nextKey}"[^>]*>`, 'i');
    const nextSlice = template.slice(contentStart);
    const nextMatch = nextSlice.match(nextRegex);
    if (!nextMatch || nextMatch.index === undefined) return '';
    const raw = template.slice(contentStart, contentStart + nextMatch.index);
    return raw.replace(/<\/div>\s*$/i, '').trim();
  }

  const raw = template.slice(contentStart);
  return raw.replace(/<\/div>\s*$/i, '').trim();
}

function wrapTemplateWithFixedFooter(
  renderedTemplate: string,
  options: { includePageFrame: boolean; pagePadding: string }
) {
  const paddingValues = options.pagePadding
    .split(/\s+/)
    .map((value) => Number.parseFloat(value))
    .filter((value) => Number.isFinite(value));
  const paddingTop = paddingValues[0] ?? 0;
  const paddingBottom = paddingValues[2] ?? paddingValues[0] ?? 0;
  const contentMinHeight = Math.max(320, 1123 - paddingTop - paddingBottom);
  const hasStructuredSections =
    renderedTemplate.includes('data-letter-section="header"') &&
    renderedTemplate.includes('data-letter-section="body"') &&
    renderedTemplate.includes('data-letter-section="footer"');
  if (hasStructuredSections) {
    const headerInner = extractSectionInnerHtml(renderedTemplate, 'header', 'body');
    const bodyInner = extractSectionInnerHtml(renderedTemplate, 'body', 'footer');
    const footerInner = extractSectionInnerHtml(renderedTemplate, 'footer');
    const headerHeight = extractSectionMinHeight(renderedTemplate, 'header', 150);
    const bodyHeight = extractSectionMinHeight(renderedTemplate, 'body', 520);
    const footerHeight = extractSectionMinHeight(renderedTemplate, 'footer', 120);
    const layoutStyle = options.includePageFrame
      ? `display:flex;height:${contentMinHeight}px;min-height:${contentMinHeight}px;flex-direction:column;box-sizing:border-box;overflow:hidden;`
      : `display:grid;height:${contentMinHeight}px;grid-template-rows:auto 1fr auto;box-sizing:border-box;overflow:hidden;`;
    const inner = `
      <div style="${layoutStyle}">
        <div style="position:relative;flex:0 0 auto;min-height:${headerHeight}px;">${headerInner}</div>
        <div style="position:relative;flex:1 1 auto;min-height:${bodyHeight}px;overflow:hidden;">${bodyInner}</div>
        <div style="position:relative;min-height:${footerHeight}px;${options.includePageFrame ? 'margin-top:auto;' : ''}">${footerInner}</div>
      </div>
    `;
    return options.includePageFrame
      ? `<div data-letter-page="true" style="position:relative;width:794px;max-width:100%;height:1123px;min-height:1123px;margin:0 auto;padding:${options.pagePadding};overflow:hidden;background:#ffffff;box-sizing:border-box;">${inner}</div>`
      : inner;
  }

  const headerMatch = renderedTemplate.match(HEADER_SECTION_SEPARATOR_REGEX);
  const footerMatch = renderedTemplate.match(FOOTER_SECTION_SEPARATOR_REGEX);
  if (headerMatch && footerMatch && headerMatch.index !== undefined && footerMatch.index !== undefined) {
    const headerHtml = renderedTemplate.slice(0, headerMatch.index);
    const bodyHtml = renderedTemplate.slice(
      headerMatch.index + headerMatch[0].length,
      footerMatch.index
    );
    const footerHtml = renderedTemplate.slice(footerMatch.index + footerMatch[0].length);
    const layoutStyle = options.includePageFrame
      ? `display:flex;height:${contentMinHeight}px;min-height:${contentMinHeight}px;flex-direction:column;box-sizing:border-box;overflow:hidden;`
      : `display:grid;height:${contentMinHeight}px;grid-template-rows:auto 1fr auto;box-sizing:border-box;overflow:hidden;`;
    const inner = `
      <div style="${layoutStyle}">
        <div style="flex:0 0 auto;">${headerHtml}</div>
        <div style="margin:20px 0 24px 0;border-top:2px solid #cbd5e1;"></div>
        <div style="flex:1 1 auto;min-height:0;overflow:hidden;">${bodyHtml}</div>
        <div style="margin:24px 0 20px 0;border-top:2px solid #cbd5e1;"></div>
        <div style="flex:0 0 auto;">${footerHtml}</div>
      </div>
    `;
    return options.includePageFrame
      ? `<div data-letter-page="true" style="position:relative;width:794px;max-width:100%;height:1123px;min-height:1123px;margin:0 auto;padding:${options.pagePadding};overflow:hidden;background:#ffffff;box-sizing:border-box;">${inner}</div>`
      : inner;
  }

  const matches = [...renderedTemplate.matchAll(LINE_ELEMENT_REGEX)];
  if (matches.length < 2) {
    return options.includePageFrame
      ? `<div data-letter-page="true" style="position:relative;width:794px;max-width:100%;height:1123px;min-height:1123px;margin:0 auto;padding:${options.pagePadding};overflow:hidden;background:#ffffff;box-sizing:border-box;">${renderedTemplate}</div>`
      : renderedTemplate;
  }

  const firstLine = matches[0];
  const lastLine = matches[matches.length - 1];
  const firstIndex = firstLine.index ?? 0;
  const lastIndex = lastLine.index ?? 0;
  const headerHtml = renderedTemplate.slice(0, firstIndex);
  const middleHtml = renderedTemplate.slice(firstIndex, lastIndex + lastLine[0].length);
  const footerHtml = renderedTemplate.slice(lastIndex + lastLine[0].length).trim();

  const inner = footerHtml
    ? `${headerHtml}${middleHtml}<div style="position:absolute;left:0;right:0;bottom:0;">${footerHtml}</div>`
    : renderedTemplate;

  return options.includePageFrame
    ? `<div data-letter-page="true" style="position:relative;width:794px;max-width:100%;height:1123px;min-height:1123px;margin:0 auto;padding:${options.pagePadding};overflow:hidden;background:#ffffff;box-sizing:border-box;">${inner}</div>`
    : `<div style="position:relative;height:1123px;min-height:1123px;overflow:hidden;box-sizing:border-box;">${inner}</div>`;
}

function extractSectionMinHeight(template: string, key: 'header' | 'body' | 'footer', fallback: number) {
  const match = template.match(
    new RegExp(`<div[^>]*data-letter-section="${key}"[^>]*min-height:([0-9.]+)px`, 'i')
  );
  const value = Number.parseFloat(match?.[1] || '');
  return Number.isFinite(value) ? value : fallback;
}

function applyLetterTemplateTokens(template: string, tokenMap: Record<string, string>) {
  let result = normalizeLetterTemplateTokens(template);
  const bodyToken = '{{BODY_HTML}}';
  const bodyValue = tokenMap[bodyToken];
  if (bodyValue !== undefined) {
    const parts = result.split(bodyToken);
    if (parts.length > 1) {
      result = `${parts.slice(0, -1).join('')}${bodyValue}${parts[parts.length - 1]}`;
    }
  }
  Object.entries(tokenMap).forEach(([token, value]) => {
    if (token === bodyToken) return;
    result = result.replace(new RegExp(token.replace(/[{}]/g, '\\$&'), 'g'), value);
  });
  result = result.replace(/<div>\s*(?:Registergericht|Handelsregister|GeschÃ¤ftsfÃ¼hrung|Steuernummer|USt-IdNr\.|HRB|Sitz):\s*<\/div>/g, '');
  result = result.replace(/<div>\s*Â·\s*<\/div>/g, '');
  result = result.replace(/<div>\s*<\/div>/g, '');
  return result;
}

function normalizeLetterBodyText(value: string) {
  return value.replace(/\r\n?/g, '\n').trim();
}

function paragraphsFromPlainLetterBody(value: string) {
  return normalizeLetterBodyText(value)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);
}

function encodeLetterBodyText(value: string) {
  return paragraphsFromPlainLetterBody(value)
    .map((paragraph) => `<div style="margin:0 0 1em 0;">${encodeHtml(paragraph)}</div>`)
    .join('');
}

function sanitizeLetterBodyHtmlForTemplate(value: string) {
  if (typeof document === 'undefined') return value;

  const template = document.createElement('template');
  template.innerHTML = value;

  const allowedTextStyleProps = new Set([
    'text-align',
    'text-align-last',
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'text-decoration',
    'line-height',
    'color',
    'background-color',
  ]);
  const allowedCellStyleProps = new Set([
    ...allowedTextStyleProps,
    'border',
    'border-top',
    'border-right',
    'border-bottom',
    'border-left',
    'padding',
    'vertical-align',
  ]);

  const pickStyle = (styleValue: string, allowedProps: Set<string>) =>
    styleValue
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .filter((entry) => allowedProps.has(entry.split(':')[0]?.trim().toLowerCase() || ''))
      .join(';');

  const applyStyle = (element: HTMLElement, parts: string[]) => {
    const styleValue = parts.filter(Boolean).join(';');
    if (styleValue) {
      element.setAttribute('style', styleValue);
    } else {
      element.removeAttribute('style');
    }
  };

  const resolveTextAlignLast = (styleValue: string) => {
    const normalized = styleValue.toLowerCase();
    const alignMatch = normalized.match(/text-align\s*:\s*(left|right|center|justify)/);
    if (!alignMatch) return '';
    if (/text-align-last\s*:/.test(normalized)) return '';
    const align = alignMatch[1];
    return align === 'justify' ? 'text-align-last:left' : `text-align-last:${align}`;
  };

  const ensureBlockTextAlignment = (styleValue: string, fallback = 'text-align:justify;text-align-last:left') => {
    const normalized = styleValue.toLowerCase();
    if (!/text-align\s*:|text-align-last\s*:/i.test(normalized)) {
      return [styleValue, fallback].filter(Boolean).join(';');
    }

    const alignLast = resolveTextAlignLast(styleValue);
    return [styleValue, alignLast].filter(Boolean).join(';');
  };

  const sanitizeNode = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (name === 'style') return;
      if (tag === 'table' && ['cellpadding', 'cellspacing', 'border'].includes(name)) return;
      if ((tag === 'td' || tag === 'th') && ['colspan', 'rowspan'].includes(name)) return;
      element.removeAttribute(attribute.name);
    });

    const existingStyle = cleanSignatureText(element.getAttribute('style'));

    if (tag === 'table') {
      applyStyle(element, [
        'width:100%',
        'max-width:none',
        'table-layout:fixed',
        'border-collapse:collapse',
        'margin:8px 0',
        pickStyle(existingStyle, allowedTextStyleProps),
      ]);
    } else if (tag === 'td' || tag === 'th') {
      applyStyle(element, [
        'box-sizing:border-box',
        'border:1px solid #111827',
        'padding:6px 8px',
        'vertical-align:top',
        pickStyle(existingStyle, allowedCellStyleProps),
      ]);
    } else if (tag === 'div' || tag === 'p') {
      const picked = pickStyle(existingStyle, allowedTextStyleProps);
      applyStyle(element, [
        'margin:0 0 1em 0',
        'display:block',
        'width:100%',
        'max-width:none',
        'box-sizing:border-box',
        'font:inherit',
        'line-height:inherit',
        'color:inherit',
        ensureBlockTextAlignment(picked),
      ]);
    } else if (tag === 'span' || tag === 'strong' || tag === 'b' || tag === 'em' || tag === 'i' || tag === 'u') {
      applyStyle(element, [pickStyle(existingStyle, allowedTextStyleProps)]);
    } else if (tag === 'ul' || tag === 'ol' || tag === 'blockquote') {
      const picked = pickStyle(existingStyle, allowedTextStyleProps);
      applyStyle(element, [
        'margin:0 0 1em 0',
        'width:100%',
        'max-width:none',
        'box-sizing:border-box',
        'font:inherit',
        'line-height:inherit',
        'color:inherit',
        ensureBlockTextAlignment(picked),
      ]);
    } else if (tag !== 'br') {
      applyStyle(element, [pickStyle(existingStyle, allowedTextStyleProps)]);
    }

    Array.from(element.childNodes).forEach(sanitizeNode);
  };

  Array.from(template.content.childNodes).forEach(sanitizeNode);
  return template.innerHTML;
}

function htmlBlocksFromEditorHtml(value: string) {
  if (typeof document === 'undefined') return [value];
  const template = document.createElement('template');
  template.innerHTML = sanitizeLetterBodyHtmlForTemplate(value);

  const blocks: string[] = [];
  let paragraphParts: string[] = [];

  const extractSupportedTextStyles = (styleValue: string) => {
    const supported = new Set([
      'text-align',
      'text-align-last',
      'font-family',
      'font-size',
      'font-weight',
      'font-style',
      'text-decoration',
      'line-height',
      'color',
      'background-color',
    ]);

    return styleValue
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .filter((entry) => supported.has(entry.split(':')[0]?.trim().toLowerCase() || ''))
      .join(';');
  };

  const ensureBlockTextAlignment = (styleValue: string, fallback = 'text-align:justify;text-align-last:left') => {
    const normalized = styleValue.toLowerCase();
    if (!/text-align\s*:|text-align-last\s*:/i.test(normalized)) {
      return [styleValue, fallback].filter(Boolean).join(';');
    }

    const alignMatch = normalized.match(/text-align\s*:\s*(left|right|center|justify)/);
    if (!alignMatch || /text-align-last\s*:/.test(normalized)) {
      return styleValue;
    }

    const align = alignMatch[1];
    return [styleValue, align === 'justify' ? 'text-align-last:left' : `text-align-last:${align}`]
      .filter(Boolean)
      .join(';');
  };

  const buildParagraphBlock = (content: string, styleValue = '') => {
    const supportedTextStyles = extractSupportedTextStyles(styleValue);
    const combinedStyle = [
      'margin:0 0 1em 0',
      'display:block',
      'width:100%',
      'max-width:none',
      'box-sizing:border-box',
      'font:inherit',
      'line-height:inherit',
      'color:inherit',
      ensureBlockTextAlignment(supportedTextStyles),
    ].filter(Boolean).join(';');

    return `<div style="${combinedStyle}">${content}</div>`;
  };

  const buildStyledBlockOuterHtml = (element: HTMLElement) => {
    const clone = element.cloneNode(true) as HTMLElement;
    const existingStyle = cleanSignatureText(clone.getAttribute('style'));
    const normalizedStyle = existingStyle.toLowerCase();
    const additions = [
      'margin:0 0 1em 0',
      'display:block',
      'width:100%',
      'max-width:none',
      'box-sizing:border-box',
      'font:inherit',
      'line-height:inherit',
      'color:inherit',
    ];
    const alignedStyle = ensureBlockTextAlignment(existingStyle);
    clone.setAttribute('style', [alignedStyle, additions.join(';')].filter(Boolean).join(';'));
    return clone.outerHTML;
  };

  const flushParagraphParts = () => {
    const content = paragraphParts
      .map((entry) => entry.trim())
      .filter(Boolean)
      .join(' ')
      .trim();
    if (!content) {
      paragraphParts = [];
      return;
    }
    blocks.push(buildParagraphBlock(content));
    paragraphParts = [];
  };

  const isEmptyEditorLine = (element: HTMLElement) => {
    const inner = cleanSignatureText(element.innerHTML)
      .replace(/&nbsp;/gi, '')
      .replace(/<br\s*\/?>/gi, '')
      .trim();
    return inner.length === 0;
  };

  const hasNestedBlockContent = (element: HTMLElement) =>
    Boolean(element.querySelector('table,ul,ol,blockquote,div,p'));

  template.content.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim()) {
        paragraphParts.push(encodeHtml(text));
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();

    if (tag === 'br') {
      flushParagraphParts();
      return;
    }

    if (tag === 'table') {
      flushParagraphParts();
      blocks.push(`<div style="margin:0 0 1em 0;">${element.outerHTML}</div>`);
      return;
    }

    if (['div', 'p'].includes(tag)) {
      if (isEmptyEditorLine(element)) {
        flushParagraphParts();
        blocks.push(buildParagraphBlock('<br />', cleanSignatureText(element.getAttribute('style'))));
        return;
      }
      if (hasNestedBlockContent(element)) {
        flushParagraphParts();
        blocks.push(buildParagraphBlock(element.innerHTML, cleanSignatureText(element.getAttribute('style'))));
        return;
      }
      flushParagraphParts();
      blocks.push(buildParagraphBlock(element.innerHTML.trim(), cleanSignatureText(element.getAttribute('style'))));
      return;
    }

    if (['ul', 'ol', 'blockquote'].includes(tag)) {
      flushParagraphParts();
      blocks.push(buildStyledBlockOuterHtml(element));
      return;
    }

    paragraphParts.push(element.outerHTML);
  });

  flushParagraphParts();
  return blocks.length ? blocks : [value];
}

function tokenizeLetterBodyText(value: string) {
  return value.match(/\S+|\s+/g) ?? [];
}

function splitHtmlBlockAtWordBoundary(
  blockHtml: string,
  fitsHtml: (candidateHtml: string) => boolean
) {
  if (typeof document === 'undefined') return null;
  const template = document.createElement('template');
  template.innerHTML = blockHtml.trim();
  const element = template.content.firstElementChild as HTMLElement | null;
  if (!element) return null;

  const tag = element.tagName.toLowerCase();
  if (!['div', 'p'].includes(tag)) return null;

  const text = (element.textContent || '').replace(/\u00a0/g, ' ').trim();
  if (!text) return null;

  const tokens = tokenizeLetterBodyText(text);
  const style = cleanSignatureText(element.getAttribute('style'));
  const textNodes: Array<{ end: number; node: Text; start: number }> = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();
  let offset = 0;
  while (currentNode) {
    const textNode = currentNode as Text;
    const value = (textNode.textContent || '').replace(/\u00a0/g, ' ');
    const length = value.length;
    textNodes.push({ node: textNode, start: offset, end: offset + length });
    offset += length;
    currentNode = walker.nextNode();
  }

  const locateBoundary = (targetOffset: number) => {
    for (const entry of textNodes) {
      if (targetOffset <= entry.end) {
        return {
          node: entry.node,
          offset: Math.max(0, targetOffset - entry.start),
        };
      }
    }
    const last = textNodes[textNodes.length - 1];
    return last ? { node: last.node, offset: last.node.textContent?.length || 0 } : null;
  };

  const serializeFragment = (fragment: DocumentFragment) => {
    const container = document.createElement('div');
    container.appendChild(fragment.cloneNode(true));
    return container.innerHTML;
  };

  const wrapChunkHtml = (innerHtml: string) =>
    `<${tag}${style ? ` style="${encodeHtml(style)}"` : ''}>${innerHtml}</${tag}>`;

  const sliceByTextLength = (length: number) => {
    const boundary = locateBoundary(length);
    if (!boundary) return null;

    const consumedRange = document.createRange();
    consumedRange.selectNodeContents(element);
    consumedRange.setEnd(boundary.node, boundary.offset);

    const remainingRange = document.createRange();
    remainingRange.selectNodeContents(element);
    remainingRange.setStart(boundary.node, boundary.offset);

    const consumedHtml = serializeFragment(consumedRange.cloneContents()).trim();
    const remainingHtml = serializeFragment(remainingRange.cloneContents()).trim();

    return {
      consumedHtml: consumedHtml ? wrapChunkHtml(consumedHtml) : '',
      remainingHtml: remainingHtml ? wrapChunkHtml(remainingHtml) : '',
    };
  };

  let bestLength = 0;
  let candidateLength = 0;

  for (const token of tokens) {
    candidateLength += token.length;
    const candidateText = text.slice(0, candidateLength).trimEnd();
    if (!candidateText) {
      bestLength = candidateLength;
      continue;
    }

    const sliced = sliceByTextLength(candidateLength);
    if (sliced?.consumedHtml && fitsHtml(sliced.consumedHtml)) {
      bestLength = candidateLength;
      continue;
    }

    break;
  }

  if (!bestLength) return null;
  const result = sliceByTextLength(bestLength);
  if (!result?.consumedHtml) return null;
  return result;
}

function findPreferredSplitIndex(text: string, proposedIndex: number) {
  if (proposedIndex >= text.length) return text.length;
  const minimumIndex = Math.max(1, Math.floor(proposedIndex * 0.65));
  for (let index = proposedIndex; index >= minimumIndex; index -= 1) {
    const current = text[index];
    const previous = text[index - 1];
    if (current === '\n' || previous === '\n' || /\s/.test(current || '') || /\s/.test(previous || '')) {
      return index;
    }
  }
  return proposedIndex;
}

function maximizeSplitIndex(
  text: string,
  startIndex: number,
  predicate: (candidateText: string) => boolean
) {
  let bestIndex = startIndex;
  let cursor = startIndex;

  while (cursor < text.length) {
    const nextProbe = Math.min(text.length, cursor + 160);
    const candidateIndex = findPreferredSplitIndex(text, nextProbe);
    if (candidateIndex <= bestIndex) break;

    const candidateText = text.slice(0, candidateIndex).trimEnd();
    if (!candidateText || !predicate(candidateText)) break;

    bestIndex = candidateIndex;
    cursor = candidateIndex;
  }

  return bestIndex;
}

function maximizeSplitIndexPrecisely(
  text: string,
  startIndex: number,
  predicate: (candidateText: string) => boolean
) {
  let bestIndex = startIndex;
  let cursor = startIndex + 1;

  while (cursor <= text.length) {
    const candidateText = text.slice(0, cursor).trimEnd();
    if (candidateText && predicate(candidateText)) {
      bestIndex = cursor;
      cursor += 1;
      continue;
    }

    break;
  }

  return findPreferredSplitIndex(text, bestIndex);
}

function cloneBodyTemplateForContinuation(
  bodySource: HTMLElement,
  bodyPlaceholderSource: HTMLElement
) {
  const sectionClone = bodySource.cloneNode(false) as HTMLElement;
  const ancestors: HTMLElement[] = [];
  let current = bodyPlaceholderSource.parentElement;

  while (current && current !== bodySource) {
    ancestors.push(current);
    current = current.parentElement;
  }

  let parent = sectionClone;
  ancestors.reverse().forEach((ancestor) => {
    const clone = ancestor.cloneNode(false) as HTMLElement;
    parent.appendChild(clone);
    parent = clone;
  });

  const placeholderClone = bodyPlaceholderSource.cloneNode(false) as HTMLElement;
  placeholderClone.innerHTML = '';
  parent.appendChild(placeholderClone);

  return { placeholderClone, sectionClone };
}

function buildPaginatedLetterHtml({
  body,
  bodyHtml,
  bodyIsHtml = false,
  context,
  customTemplate,
  emptyBodyPlaceholder,
  pagePadding,
  recipient,
  signature,
  subject,
}: {
  body: string;
  bodyHtml?: string;
  bodyIsHtml?: boolean;
  context?: {
    propertyName?: string;
    subjectLine2?: string;
    unitLabel?: string;
  };
  customTemplate: string;
  emptyBodyPlaceholder?: string;
  pagePadding: string;
  recipient?: {
    address?: string;
    company?: string;
    name?: string;
    salutation?: string;
  };
  signature: SignatureRecord;
  subject?: string;
}) {
  if (typeof document === 'undefined') return null;

  const normalizedBody = normalizeLetterBodyText(body);
  const htmlBlocks = bodyIsHtml ? htmlBlocksFromEditorHtml(bodyHtml || body) : [];
  const baseTokenMap = buildLetterTemplateTokenMap(
    signature,
    cleanSignatureText(subject),
    '',
    emptyBodyPlaceholder,
    recipient,
    context
  );
  const closingHtml = baseTokenMap['{{CLOSING_BLOCK}}'] || '';
  const bodyMarkerHtml =
    '<div data-letter-body="true" style="min-height:28px;white-space:pre-wrap;outline:none;text-align:justify;text-align-last:left;line-height:inherit;font:inherit;color:inherit;"></div>';
  const templateHtml = applyLetterTemplateTokens(customTemplate, {
    ...baseTokenMap,
    '{{BODY_HTML}}': bodyMarkerHtml,
    '{{CLOSING_BLOCK}}': '<div data-letter-closing="true"></div>',
  });

  const template = document.createElement('template');
  template.innerHTML = templateHtml;

  const headerSource = template.content.querySelector('[data-letter-section="header"]') as HTMLElement | null;
  const bodySource = template.content.querySelector('[data-letter-section="body"]') as HTMLElement | null;
  const footerSource = template.content.querySelector('[data-letter-section="footer"]') as HTMLElement | null;
  const bodyPlaceholderSource = bodySource?.querySelector('[data-letter-body="true"]') as HTMLElement | null;

  if (!headerSource || !bodySource || !footerSource || !bodyPlaceholderSource) {
    return null;
  }

  const paddingValues = pagePadding
    .split(/\s+/)
    .map((value) => Number.parseFloat(value.replace('px', '')))
    .filter((value) => Number.isFinite(value));
  const paddingTop = paddingValues[0] ?? 0;
  const paddingRight = paddingValues[1] ?? paddingTop;
  const paddingBottom = paddingValues[2] ?? paddingTop;
  const paddingLeft = paddingValues[3] ?? paddingRight;
  const contentWidth = LETTER_PAGE_WIDTH_PX - paddingLeft - paddingRight;
  const contentHeight = LETTER_PAGE_HEIGHT_PX - paddingTop - paddingBottom;

  const headerHeight = extractSectionMinHeight(templateHtml, 'header', 150);
  const bodyHeight = extractSectionMinHeight(templateHtml, 'body', 520);
  const footerHeight = extractSectionMinHeight(templateHtml, 'footer', 120);

  const measurementHost = document.createElement('div');
  measurementHost.style.position = 'fixed';
  measurementHost.style.left = '-10000px';
  measurementHost.style.top = '0';
  measurementHost.style.width = '0';
  measurementHost.style.height = '0';
  measurementHost.style.overflow = 'hidden';
  measurementHost.style.visibility = 'hidden';
  measurementHost.style.pointerEvents = 'none';
  document.body.appendChild(measurementHost);

  const continuationTemplate = cloneBodyTemplateForContinuation(bodySource, bodyPlaceholderSource);

  const createPage = (
    isFirstPage: boolean,
    includeClosing: boolean,
    bodyText: string,
    bodyHtmlContent = ''
  ) => {
    const page = document.createElement('div');
    page.setAttribute('data-letter-page', 'true');
    page.style.position = 'relative';
    page.style.width = `${LETTER_PAGE_WIDTH_PX}px`;
    page.style.maxWidth = '100%';
    page.style.height = `${LETTER_PAGE_HEIGHT_PX}px`;
    page.style.margin = '0 auto';
    page.style.padding = pagePadding;
    page.style.overflow = 'hidden';
    page.style.background = '#ffffff';
    page.style.boxSizing = 'border-box';
    page.style.breakAfter = 'page';
    page.style.pageBreakAfter = 'always';

    const layout = document.createElement('div');
    layout.style.display = 'flex';
    layout.style.width = `${contentWidth}px`;
    layout.style.minHeight = `${contentHeight}px`;
    layout.style.height = `${contentHeight}px`;
    layout.style.flexDirection = 'column';
    layout.style.boxSizing = 'border-box';

    const header = headerSource.cloneNode(true) as HTMLElement;
    header.style.position = 'relative';
    header.style.flex = '0 0 auto';
    header.style.minHeight = `${headerHeight}px`;

    const bodySection = (isFirstPage ? bodySource : continuationTemplate.sectionClone).cloneNode(true) as HTMLElement;
    bodySection.style.position = 'relative';
    bodySection.style.flex = '1 1 auto';
    bodySection.style.minHeight = `${bodyHeight}px`;
    bodySection.style.overflow = 'hidden';

    const footer = footerSource.cloneNode(true) as HTMLElement;
    footer.style.position = 'relative';
    footer.style.flex = '0 0 auto';
    footer.style.minHeight = `${footerHeight}px`;
    footer.style.marginTop = 'auto';

    const bodyPlaceholder = bodySection.querySelector('[data-letter-body="true"]') as HTMLElement | null;
    if (!bodyPlaceholder) {
      return null;
    }
    bodyPlaceholder.innerHTML = bodyIsHtml
      ? bodyHtmlContent || '<br />'
      : bodyText
        ? encodeLetterBodyText(bodyText)
        : '<br />';

    const closingTarget =
      (bodySection.querySelector('[data-letter-closing="true"]') as HTMLElement | null) ||
      (() => {
        const element = document.createElement('div');
        element.setAttribute('data-letter-closing', 'true');
        bodySection.appendChild(element);
        return element;
      })();
    closingTarget.innerHTML = includeClosing ? closingHtml : '';

    layout.append(header, bodySection, footer);
    page.appendChild(layout);

    return { bodyPlaceholder, bodySection, closingTarget, footer, layout, page };
  };

  const applyPageNumber = (
    page: NonNullable<ReturnType<typeof createPage>>,
    pageNumber: number,
    totalPages: number
  ) => {
    const marker = document.createElement('div');
    marker.setAttribute('data-letter-page-number', 'true');
    marker.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:10px;">
        <span style="display:block;width:54px;height:1px;background:linear-gradient(90deg, rgba(168,162,158,0) 0%, rgba(168,162,158,0.7) 100%);"></span>
        <span style="display:inline-block;">Seite ${pageNumber} von ${totalPages}</span>
        <span style="display:block;width:54px;height:1px;background:linear-gradient(90deg, rgba(168,162,158,0.7) 0%, rgba(168,162,158,0) 100%);"></span>
      </span>
    `;
    marker.style.flex = '0 0 auto';
    marker.style.margin = '10px 0 8px';
    marker.style.textAlign = 'center';
    marker.style.fontFamily = signature.fontFamily || 'Segoe UI, Arial, sans-serif';
    marker.style.fontSize = '10px';
    marker.style.fontWeight = '500';
    marker.style.letterSpacing = '0.08em';
    marker.style.color = '#a8a29e';
    marker.style.opacity = '0.9';
    marker.style.textTransform = 'none';
    marker.style.fontStyle = 'normal';
    marker.style.userSelect = 'none';
    page.layout.insertBefore(marker, page.footer);
  };

  const fitsOnPage = (
    candidateText: string,
    isFirstPage: boolean,
    includeClosing: boolean,
    candidateHtml = ''
  ) => {
    const page = createPage(isFirstPage, includeClosing, candidateText, candidateHtml);
    if (!page) return false;
    measurementHost.replaceChildren(page.page);
    const reservePx = 24;
    return page.bodySection.scrollHeight <= page.bodySection.clientHeight - reservePx + 0.5;
  };

  const pages: Array<{ bodyText: string; isFirstPage: boolean; includeClosing: boolean }> = [];

  try {
    if (bodyIsHtml) {
      const joinedHtml = htmlBlocks.join('');
      if (!joinedHtml) {
        const singleEmptyPage = createPage(true, true, '', '');
        if (singleEmptyPage) applyPageNumber(singleEmptyPage, 1, 1);
        return singleEmptyPage ? singleEmptyPage.page.outerHTML : null;
      }

      if (fitsOnPage('', true, true, joinedHtml)) {
        const singlePage = createPage(true, true, '', joinedHtml);
        if (singlePage) applyPageNumber(singlePage, 1, 1);
        return singlePage ? singlePage.page.outerHTML : null;
      }

      let remainingBlocks = [...htmlBlocks];
      let isFirstPage = true;

      while (remainingBlocks.length > 0) {
        if (fitsOnPage('', isFirstPage, true, remainingBlocks.join(''))) {
          pages.push({ bodyText: remainingBlocks.join(''), includeClosing: true, isFirstPage });
          break;
        }

        let chunkHtml = '';
        let consumedCount = 0;
        for (let index = 0; index < remainingBlocks.length; index += 1) {
          const nextChunkHtml = chunkHtml + remainingBlocks[index];
          if (fitsOnPage('', isFirstPage, false, nextChunkHtml)) {
            chunkHtml = nextChunkHtml;
            consumedCount = index + 1;
            continue;
          }
          break;
        }

        const nextBlock = remainingBlocks[consumedCount] || remainingBlocks[0];
        const canTrySplitNextBlock = Boolean(nextBlock);
        const splitBlock =
          canTrySplitNextBlock
            ? splitHtmlBlockAtWordBoundary(nextBlock, (candidateHtml) =>
                fitsOnPage('', isFirstPage, false, chunkHtml + candidateHtml)
              )
            : null;

        if (!chunkHtml || consumedCount === 0) {
          if (!splitBlock) {
            return null;
          }
          pages.push({ bodyText: splitBlock.consumedHtml, includeClosing: false, isFirstPage });
          remainingBlocks = [
            ...(splitBlock.remainingHtml ? [splitBlock.remainingHtml] : []),
            ...remainingBlocks.slice(1),
          ];
          isFirstPage = false;
          continue;
        }

        if (splitBlock?.consumedHtml) {
          pages.push({ bodyText: chunkHtml + splitBlock.consumedHtml, includeClosing: false, isFirstPage });
          remainingBlocks = [
            ...(splitBlock.remainingHtml ? [splitBlock.remainingHtml] : []),
            ...remainingBlocks.slice(consumedCount + 1),
          ];
          isFirstPage = false;
          continue;
        }

        if (!chunkHtml || consumedCount === 0) {
          const fallbackSplitBlock = splitHtmlBlockAtWordBoundary(remainingBlocks[0], (candidateHtml) =>
            fitsOnPage('', isFirstPage, false, candidateHtml)
          );
          if (!fallbackSplitBlock) {
            return null;
          }
          pages.push({ bodyText: fallbackSplitBlock.consumedHtml, includeClosing: false, isFirstPage });
          remainingBlocks = [
            ...(fallbackSplitBlock.remainingHtml ? [fallbackSplitBlock.remainingHtml] : []),
            ...remainingBlocks.slice(1),
          ];
          isFirstPage = false;
          continue;
        }

        pages.push({ bodyText: chunkHtml, includeClosing: false, isFirstPage });
        remainingBlocks = remainingBlocks.slice(consumedCount);
        isFirstPage = false;
      }

      return pages
        .map(({ bodyText, includeClosing, isFirstPage }, index) => {
          const page = createPage(isFirstPage, includeClosing, '', bodyText);
          if (!page) return '';
          applyPageNumber(page, index + 1, pages.length);
          if (index === pages.length - 1) {
            page.page.style.breakAfter = 'auto';
            page.page.style.pageBreakAfter = 'auto';
          }
          return page.page.outerHTML;
        })
        .filter(Boolean)
        .join('');
    }

    if (!normalizedBody) {
      const singleEmptyPage = createPage(true, true, '');
      if (singleEmptyPage) applyPageNumber(singleEmptyPage, 1, 1);
      return singleEmptyPage ? singleEmptyPage.page.outerHTML : null;
    }

    if (fitsOnPage(normalizedBody, true, true)) {
      const singlePage = createPage(true, true, normalizedBody);
      if (singlePage) applyPageNumber(singlePage, 1, 1);
      return singlePage ? singlePage.page.outerHTML : null;
    }

    let remainingText = normalizedBody;
    let isFirstPage = true;

    while (remainingText) {
      if (fitsOnPage(remainingText, isFirstPage, true)) {
        pages.push({ bodyText: remainingText, includeClosing: true, isFirstPage });
        break;
      }

      const tokens = tokenizeLetterBodyText(remainingText);
      let bestRawChunk = '';
      let candidateRawChunk = '';

      for (const token of tokens) {
        candidateRawChunk += token;
        const candidateText = candidateRawChunk.trimEnd();
        if (!candidateText) {
          bestRawChunk = candidateRawChunk;
          continue;
        }

        if (fitsOnPage(candidateText, isFirstPage, false)) {
          bestRawChunk = candidateRawChunk;
          continue;
        }

        break;
      }

      const bodyText = bestRawChunk.trimEnd();
      if (!bodyText) {
        const fallbackPage = createPage(isFirstPage, true, remainingText);
        return fallbackPage ? fallbackPage.page.outerHTML : null;
      }

      pages.push({ bodyText, includeClosing: false, isFirstPage });
      remainingText = remainingText.slice(bestRawChunk.length).replace(/^\s+/, '');
      isFirstPage = false;
    }

    return pages
      .map(({ bodyText, includeClosing, isFirstPage }, index) => {
        const page = createPage(isFirstPage, includeClosing, bodyText);
        if (!page) return '';
        applyPageNumber(page, index + 1, pages.length);
        if (index === pages.length - 1) {
          page.page.style.breakAfter = 'auto';
          page.page.style.pageBreakAfter = 'auto';
        }
        return page.page.outerHTML;
      })
      .filter(Boolean)
      .join('');
  } finally {
    measurementHost.remove();
  }
}

export type LetterBodyPageFragment = {
  bodyHtml: string;
  includeClosing: boolean;
  isFirstPage: boolean;
};

export type LetterEditorPageTemplates = {
  closingHtml: string;
  continuationPageHtml: string;
  firstPageHtml: string;
};

export function buildLetterEditorPageTemplates({
  context,
  customTemplate,
  emptyBodyPlaceholder,
  pagePadding,
  recipient,
  signature,
  subject,
}: {
  context?: {
    propertyName?: string;
    subjectLine2?: string;
    unitLabel?: string;
  };
  customTemplate: string;
  emptyBodyPlaceholder?: string;
  pagePadding: string;
  recipient?: {
    address?: string;
    company?: string;
    name?: string;
    salutation?: string;
  };
  signature: SignatureRecord;
  subject?: string;
}) {
  if (typeof document === 'undefined') return null;

  const baseTokenMap = buildLetterTemplateTokenMap(
    signature,
    cleanSignatureText(subject),
    '',
    emptyBodyPlaceholder,
    recipient,
    context
  );
  const closingHtml = baseTokenMap['{{CLOSING_BLOCK}}'] || '';
  const bodyMarkerHtml =
    '<div data-letter-body="true" style="min-height:28px;white-space:pre-wrap;outline:none;text-align:justify;text-align-last:left;line-height:inherit;font:inherit;color:inherit;"></div>';
  const templateHtml = applyLetterTemplateTokens(customTemplate, {
    ...baseTokenMap,
    '{{BODY_HTML}}': bodyMarkerHtml,
    '{{CLOSING_BLOCK}}': '<div data-letter-closing="true"></div>',
  });

  const template = document.createElement('template');
  template.innerHTML = templateHtml;

  const headerSource = template.content.querySelector('[data-letter-section="header"]') as HTMLElement | null;
  const bodySource = template.content.querySelector('[data-letter-section="body"]') as HTMLElement | null;
  const footerSource = template.content.querySelector('[data-letter-section="footer"]') as HTMLElement | null;
  const bodyPlaceholderSource = bodySource?.querySelector('[data-letter-body="true"]') as HTMLElement | null;

  if (!headerSource || !bodySource || !footerSource || !bodyPlaceholderSource) {
    return null;
  }

  const paddingValues = pagePadding
    .split(/\s+/)
    .map((value) => Number.parseFloat(value.replace('px', '')))
    .filter((value) => Number.isFinite(value));
  const paddingTop = paddingValues[0] ?? 0;
  const paddingRight = paddingValues[1] ?? paddingTop;
  const paddingBottom = paddingValues[2] ?? paddingTop;
  const paddingLeft = paddingValues[3] ?? paddingRight;
  const contentWidth = LETTER_PAGE_WIDTH_PX - paddingLeft - paddingRight;
  const contentHeight = LETTER_PAGE_HEIGHT_PX - paddingTop - paddingBottom;

  const headerHeight = extractSectionMinHeight(templateHtml, 'header', 150);
  const bodyHeight = extractSectionMinHeight(templateHtml, 'body', 520);
  const footerHeight = extractSectionMinHeight(templateHtml, 'footer', 120);

  const continuationTemplate = cloneBodyTemplateForContinuation(bodySource, bodyPlaceholderSource);

  const createPageTemplate = (isFirstPage: boolean) => {
    const page = document.createElement('div');
    page.setAttribute('data-letter-page', 'true');
    page.style.position = 'relative';
    page.style.width = `${LETTER_PAGE_WIDTH_PX}px`;
    page.style.maxWidth = '100%';
    page.style.height = `${LETTER_PAGE_HEIGHT_PX}px`;
    page.style.margin = '0 auto';
    page.style.padding = pagePadding;
    page.style.overflow = 'hidden';
    page.style.background = '#ffffff';
    page.style.boxSizing = 'border-box';

    const layout = document.createElement('div');
    layout.style.display = 'flex';
    layout.style.width = `${contentWidth}px`;
    layout.style.minHeight = `${contentHeight}px`;
    layout.style.height = `${contentHeight}px`;
    layout.style.flexDirection = 'column';
    layout.style.boxSizing = 'border-box';

    const header = headerSource.cloneNode(true) as HTMLElement;
    header.style.position = 'relative';
    header.style.flex = '0 0 auto';
    header.style.minHeight = `${headerHeight}px`;

    const bodySection = (isFirstPage ? bodySource : continuationTemplate.sectionClone).cloneNode(true) as HTMLElement;
    bodySection.style.position = 'relative';
    bodySection.style.flex = '1 1 auto';
    bodySection.style.minHeight = `${bodyHeight}px`;
    bodySection.style.display = 'flex';
    bodySection.style.flexDirection = 'column';
    bodySection.style.overflow = 'hidden';

    const footer = footerSource.cloneNode(true) as HTMLElement;
    footer.style.position = 'relative';
    footer.style.flex = '0 0 auto';
    footer.style.minHeight = `${footerHeight}px`;
    footer.style.marginTop = 'auto';

    const bodyPlaceholder = bodySection.querySelector('[data-letter-body="true"]') as HTMLElement | null;
    if (!bodyPlaceholder) {
      return '';
    }
    bodyPlaceholder.innerHTML =
      '<div data-letter-flow-host="true" data-letter-editor-host="true" style="display:block;flex:1 1 auto;width:100%;max-width:none;min-height:28px;overflow:hidden;box-sizing:border-box;"></div>';
    bodyPlaceholder.style.display = 'flex';
    bodyPlaceholder.style.flexDirection = 'column';
    bodyPlaceholder.style.flex = '1 1 auto';
    bodyPlaceholder.style.minHeight = '28px';
    bodyPlaceholder.style.overflow = 'hidden';

    const closingTarget =
      (bodySection.querySelector('[data-letter-closing="true"]') as HTMLElement | null) ||
      (() => {
        const element = document.createElement('div');
        element.setAttribute('data-letter-closing', 'true');
        bodySection.appendChild(element);
        return element;
      })();
    closingTarget.innerHTML = '<div data-letter-closing-host="true" style="display:block;flex:0 0 auto;"></div>';
    closingTarget.style.flex = '0 0 auto';

    layout.append(header, bodySection, footer);
    page.appendChild(layout);
    return page.outerHTML;
  };

  return {
    closingHtml,
    continuationPageHtml: createPageTemplate(false),
    firstPageHtml: createPageTemplate(true),
  };
}

export function buildLetterBodyPageFragments({
  body,
  bodyHtml,
  bodyIsHtml = false,
  context,
  customTemplate,
  emptyBodyPlaceholder,
  pagePadding,
  recipient,
  signature,
  startOnFirstPage = true,
  subject,
}: {
  body: string;
  bodyHtml?: string;
  bodyIsHtml?: boolean;
  context?: {
    propertyName?: string;
    subjectLine2?: string;
    unitLabel?: string;
  };
  customTemplate: string;
  emptyBodyPlaceholder?: string;
  pagePadding: string;
  recipient?: {
    address?: string;
    company?: string;
    name?: string;
    salutation?: string;
  };
  signature: SignatureRecord;
  startOnFirstPage?: boolean;
  subject?: string;
}) {
  if (typeof document === 'undefined') return null;

  const normalizedBody = normalizeLetterBodyText(body);
  const htmlBlocks = bodyIsHtml
    ? htmlBlocksFromEditorHtml(bodyHtml || body)
    : normalizedBody
      ? normalizedBody
          .split(/\n{2,}/)
          .map((entry) => cleanSignatureText(entry))
          .filter(Boolean)
          .map(
            (entry) =>
              `<div style="margin:0 0 1em 0;display:block;width:100%;max-width:none;box-sizing:border-box;font:inherit;line-height:inherit;color:inherit;text-align:justify;text-align-last:left;">${encodeLetterBodyText(
                entry
              )}</div>`
          )
      : [];
  const editorTemplates = buildLetterEditorPageTemplates({
    context,
    customTemplate,
    emptyBodyPlaceholder,
    pagePadding,
    recipient,
    signature,
    subject,
  });

  if (!editorTemplates) {
    return null;
  }

  const { closingHtml } = editorTemplates;

  const measurementHost = document.createElement('div');
  measurementHost.style.position = 'fixed';
  measurementHost.style.left = '-10000px';
  measurementHost.style.top = '0';
  measurementHost.style.width = '0';
  measurementHost.style.height = '0';
  measurementHost.style.overflow = 'hidden';
  measurementHost.style.visibility = 'hidden';
  measurementHost.style.pointerEvents = 'none';
  document.body.appendChild(measurementHost);

  try {
    const createWorkingPage = (isFirstPage: boolean) => {
      const template = document.createElement('template');
      template.innerHTML = isFirstPage
        ? editorTemplates.firstPageHtml
        : editorTemplates.continuationPageHtml;
      const page = template.content.firstElementChild as HTMLElement | null;
      if (!page) return null;
      measurementHost.replaceChildren(page);

      const flowHost = page.querySelector('[data-letter-flow-host="true"]') as HTMLElement | null;
      const bodyPlaceholder = page.querySelector('[data-letter-body="true"]') as HTMLElement | null;
      const bodySection = page.querySelector('[data-letter-section="body"]') as HTMLElement | null;
      const closingTarget = page.querySelector('[data-letter-closing-host="true"]') as HTMLElement | null;
      if (!flowHost || !bodyPlaceholder || !bodySection || !closingTarget) {
        return null;
      }

      flowHost.innerHTML = '';
      closingTarget.innerHTML = '';
      bodyPlaceholder.scrollTop = 0;
      return {
        bodyPlaceholder,
        bodySection,
        closingTarget,
        flowHost,
        page,
        isFirstPage,
      };
    };

    const hasVisibleBodyContent = (page: NonNullable<ReturnType<typeof createWorkingPage>>) =>
      cleanSignatureText(page.flowHost.textContent || '').length > 0 ||
      page.flowHost.querySelector('table,ul,ol,blockquote,img') !== null;

    const pageFits = (page: NonNullable<ReturnType<typeof createWorkingPage>>) => {
      const reservePx = 24;
      return page.bodySection.scrollHeight <= page.bodySection.clientHeight - reservePx + 0.5;
    };

    const tryAppendBlock = (page: NonNullable<ReturnType<typeof createWorkingPage>>, blockHtml: string) => {
      const snapshot = page.flowHost.innerHTML;
      const blockTemplate = document.createElement('template');
      blockTemplate.innerHTML = blockHtml;
      page.flowHost.appendChild(blockTemplate.content);
      if (pageFits(page)) {
        return true;
      }
      page.flowHost.innerHTML = snapshot;
      return false;
    };

    const tryApplyClosing = (page: NonNullable<ReturnType<typeof createWorkingPage>>) => {
      const previousClosing = page.closingTarget.innerHTML;
      page.closingTarget.innerHTML = closingHtml;
      if (pageFits(page)) {
        return true;
      }
      page.closingTarget.innerHTML = previousClosing;
      return false;
    };

    const splitBlockForPage = (page: NonNullable<ReturnType<typeof createWorkingPage>>, blockHtml: string) =>
      splitHtmlBlockAtWordBoundary(blockHtml, (candidateHtml) => {
        const snapshot = page.flowHost.innerHTML;
        const blockTemplate = document.createElement('template');
        blockTemplate.innerHTML = candidateHtml;
        page.flowHost.appendChild(blockTemplate.content);
        const fits = pageFits(page);
        page.flowHost.innerHTML = snapshot;
        return fits;
      });

    const finalizePage = (
      page: NonNullable<ReturnType<typeof createWorkingPage>>,
      includeClosing: boolean
    ): LetterBodyPageFragment => ({
      bodyHtml: page.flowHost.innerHTML,
      includeClosing,
      isFirstPage: page.isFirstPage,
    });

    if (htmlBlocks.length === 0) {
      return [{ bodyHtml: '', includeClosing: true, isFirstPage: startOnFirstPage }];
    }

    const fragments: LetterBodyPageFragment[] = [];
    const remainingBlocks = [...htmlBlocks];
    let currentPage = createWorkingPage(startOnFirstPage);
    if (!currentPage) return null;

    while (remainingBlocks.length > 0) {
      const nextBlock = remainingBlocks[0];

      if (tryAppendBlock(currentPage, nextBlock)) {
        remainingBlocks.shift();
        continue;
      }

      const splitBlock = splitBlockForPage(currentPage, nextBlock);

      if (splitBlock?.consumedHtml) {
        const appendTemplate = document.createElement('template');
        appendTemplate.innerHTML = splitBlock.consumedHtml;
        currentPage.flowHost.appendChild(appendTemplate.content);
        remainingBlocks[0] = splitBlock.remainingHtml || '';
        if (!remainingBlocks[0]) {
          remainingBlocks.shift();
        }
      } else if (!hasVisibleBodyContent(currentPage)) {
        // If a single block cannot be split further (e.g. a tall table), place it on its own page.
        currentPage.flowHost.innerHTML = nextBlock;
        remainingBlocks.shift();
      }

      fragments.push(finalizePage(currentPage, false));
      currentPage = createWorkingPage(false);
      if (!currentPage) return null;
    }

    if (tryApplyClosing(currentPage)) {
      fragments.push(finalizePage(currentPage, true));
      return fragments;
    }

    if (hasVisibleBodyContent(currentPage)) {
      fragments.push(finalizePage(currentPage, false));
      const closingPage = createWorkingPage(false);
      if (!closingPage) return fragments;
      closingPage.closingTarget.innerHTML = closingHtml;
      fragments.push(finalizePage(closingPage, true));
      return fragments;
    }

    currentPage.closingTarget.innerHTML = closingHtml;
    fragments.push(finalizePage(currentPage, true));
    return fragments;
  } finally {
    measurementHost.remove();
  }
}

export function createSignatureRecord(data?: Record<string, unknown> | null): SignatureRecord {
  return {
    bankName: firstRecordText(data?.bankName, data?.bank),
    bic: firstRecordText(data?.bic),
    city: firstRecordText(data?.city),
    closing: cleanSignatureText(data?.signatureClosing) || 'Mit freundlichen Grüßen',
    commercialRegisterNumber:
      firstRecordText(data?.commercialRegisterNumber, data?.hrb),
    companyName: normalizeCompanyDisplayName(firstRecordText(data?.name)),
    country: firstRecordText(data?.country),
    department: cleanSignatureText(data?.signatureDepartment),
    email: DEFAULT_SIGNATURE_EMAIL,
    emailTemplateHtml: cleanSignatureText(data?.signatureEmailTemplateHtml),
    fontBold: data?.signatureFontBold === true,
    fontFamily: cleanSignatureText(data?.signatureFontFamily) || 'Segoe UI, Arial, sans-serif',
    fontItalic: data?.signatureFontItalic === true,
    fontSize: cleanSignatureText(data?.signatureFontSize) || '14',
    fontUnderline: data?.signatureFontUnderline === true,
    houseNumber: firstRecordText(data?.houseNumber),
    iban: firstRecordText(data?.iban),
    legalForm: firstRecordText(data?.legalForm),
    logoAlt: cleanSignatureText(data?.signatureLogoAlt) || cleanSignatureText(data?.name),
    logoUrl: cleanSignatureText(data?.signatureLogoUrl),
    letterRightBlock:
      cleanSignatureText(data?.signatureLetterRightBlock) || buildDefaultLetterRightBlock(data),
    letterRightBlockBold: data?.signatureLetterRightBlockBold === true,
    letterRightBlockFontFamily:
      cleanSignatureText(data?.signatureLetterRightBlockFontFamily) ||
      cleanSignatureText(data?.signatureFontFamily) ||
      'Segoe UI, Arial, sans-serif',
    letterRightBlockFontSize:
      cleanSignatureText(data?.signatureLetterRightBlockFontSize) ||
      cleanSignatureText(data?.signatureFontSize) ||
      '12',
    letterRightBlockItalic: data?.signatureLetterRightBlockItalic === true,
    letterRightBlockTextAlign:
      data?.signatureLetterRightBlockTextAlign === 'left' ? 'left' : 'center',
    letterRightBlockUnderline: data?.signatureLetterRightBlockUnderline === true,
    letterSenderLine:
      cleanSignatureText(data?.signatureLetterSenderLine) || buildDefaultLetterSenderLine(data),
    letterShowLogo: data?.signatureLetterShowLogo !== false,
    letterFooterBold: data?.signatureLetterFooterBold === true,
    letterFooterDivider: data?.signatureLetterFooterDivider !== false,
    letterClosing:
      cleanSignatureText(data?.signatureLetterClosing) ||
      cleanSignatureText(data?.signatureClosing) ||
      'Mit freundlichen Grüßen',
    letterClosingBlock: cleanSignatureText(data?.signatureLetterClosingBlock),
    letterFooter: cleanSignatureText(data?.signatureLetterFooter),
    letterGreeting: cleanSignatureText(data?.signatureLetterGreeting),
    letterMarginBottom: Number(data?.signatureLetterMarginBottom) || 64,
    letterMarginLeft: Number(data?.signatureLetterMarginLeft) || 56,
    letterMarginRight: Number(data?.signatureLetterMarginRight) || 56,
    letterMarginTop: Number(data?.signatureLetterMarginTop) || 48,
    letterFooterFontFamily:
      cleanSignatureText(data?.signatureLetterFooterFontFamily) ||
      cleanSignatureText(data?.signatureFontFamily) ||
      'Segoe UI, Arial, sans-serif',
    letterFooterFontSize:
      cleanSignatureText(data?.signatureLetterFooterFontSize) ||
      cleanSignatureText(data?.signatureFontSize) ||
      '12',
    letterFooterItalic: data?.signatureLetterFooterItalic === true,
    letterFooterTextAlign: data?.signatureLetterFooterTextAlign === 'left' ? 'left' : 'center',
    letterFooterUnderline: data?.signatureLetterFooterUnderline === true,
    letterHeaderBold: data?.signatureLetterHeaderBold === true,
    letterHeader:
      cleanSignatureText(data?.signatureLetterHeader) || cleanSignatureText(data?.name),
    letterHeaderDivider: data?.signatureLetterHeaderDivider !== false,
    letterHeaderFontFamily:
      cleanSignatureText(data?.signatureLetterHeaderFontFamily) ||
      cleanSignatureText(data?.signatureFontFamily) ||
      'Segoe UI, Arial, sans-serif',
    letterHeaderFontSize:
      cleanSignatureText(data?.signatureLetterHeaderFontSize) ||
      cleanSignatureText(data?.signatureFontSize) ||
      '18',
    letterHeaderItalic: data?.signatureLetterHeaderItalic === true,
    letterSubheader: cleanSignatureText(data?.signatureLetterSubheader),
    letterTemplateHtml: cleanSignatureText(data?.signatureLetterTemplateHtml),
    letterHeaderTextAlign: data?.signatureLetterHeaderTextAlign === 'left' ? 'left' : 'center',
    letterHeaderUnderline: data?.signatureLetterHeaderUnderline === true,
    managingDirector: splitListValues(data?.managingDirector).join(', '),
    mobilePhone:
      cleanSignatureText(data?.signatureMobilePhone) ||
      cleanSignatureText(data?.signatureRoleLabel),
    name: cleanSignatureText(data?.signatureName),
    phone: firstRecordText(data?.phone),
    portalClosing: cleanSignatureText(data?.signaturePortalClosing) || 'Mit freundlichen Grüßen',
    portalCompanyName:
      normalizeCompanyDisplayName(data?.signaturePortalCompanyName) || normalizeCompanyDisplayName(data?.name),
    portalName:
      cleanSignatureText(data?.signaturePortalName) || cleanSignatureText(data?.signatureName),
    postalCode: firstRecordText(data?.postalCode),
    registerCourt:
      formatRegisterCourtDisplay(firstRecordText(data?.registerCourt)),
    registeredOffice:
      firstRecordText(data?.registeredOffice),
    street: firstRecordText(data?.street),
    taxNumber: cleanSignatureText(firstRecordText(data?.taxNumber)),
    textAlign: data?.signatureTextAlign === 'left' ? 'left' : 'center',
    useDivider: data?.signatureUseDivider !== false,
    vatId: cleanSignatureText(firstRecordText(data?.vatId)),
    website: firstRecordText(data?.website),
  };
}

export function buildMessageSignatureText(_signature: SignatureRecord) {
  void _signature;
  return '';
}

export function buildSignatureAddress(signature: SignatureRecord) {
  const firstLine = [signature.street, signature.houseNumber].filter(Boolean).join(' ');
  const secondLine = [signature.postalCode, signature.city].filter(Boolean).join(' ');
  const countryLine = signature.country;
  return [firstLine, secondLine, countryLine].filter(Boolean).join('\n');
}

function normalizeEmailSignatureTokens(template: string) {
  return EMAIL_SIGNATURE_TOKENS.reduce((current, token) => {
    const core = token.slice(2, -2).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return current
      .replace(new RegExp(`(?<!\\{)\\{${core}\\}\\}`, 'g'), token)
      .replace(new RegExp(`\\{\\{${core}\\}(?!\\})`, 'g'), token)
      .replace(new RegExp(`(?<!\\{)\\{${core}\\}(?!\\})`, 'g'), token);
  }, template);
}

function sanitizeEmailSignatureHtml(value: string) {
  return value
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\sjavascript:/gi, '');
}

function buildEmailSignatureTokenMap(signature: SignatureRecord) {
  const address = buildSignatureAddress(signature);
  const companyLine = buildCompanyLine(signature.companyName, signature.legalForm);
  const registerCourtDisplay = formatRegisterCourtDisplay(signature.registerCourt);
  const commercialRegisterDisplay = formatCommercialRegisterDisplay(signature.commercialRegisterNumber);
  const managingDirectorDisplay = formatManagingDirectorDisplay(signature.managingDirector);
  const taxNumberDisplay = formatTaxNumberDisplay(signature.taxNumber);
  const vatIdDisplay = formatVatIdDisplay(signature.vatId);
  const resolvedLogoUrl = resolveSignatureLogoUrl(signature.logoUrl);
  const legalLine1 = [
    signature.registeredOffice ? `Sitz: ${signature.registeredOffice}` : '',
    registerCourtDisplay,
    commercialRegisterDisplay,
  ].filter(Boolean).join(' | ');
  const legalLine2 = [
    managingDirectorDisplay,
    taxNumberDisplay,
    vatIdDisplay,
  ].filter(Boolean).join(' | ');

  return {
    '{{ADDRESS}}': encodeHtml(address).replace(/\n/g, '<br />'),
    '{{CITY_LINE}}': encodeHtml([signature.postalCode, signature.city].filter(Boolean).join(' ')),
    '{{CLOSING}}': encodeHtml(signature.closing || 'Mit freundlichen Grüßen'),
    '{{COMPANY_LINE}}': encodeHtml(companyLine),
    '{{COMPANY_NAME}}': encodeHtml(signature.companyName),
    '{{DEPARTMENT}}': encodeHtml(signature.department),
    '{{EMAIL}}': encodeHtml(signature.email),
    '{{HRB}}': encodeHtml(commercialRegisterDisplay),
    '{{HRB_LINE}}': encodeHtml(commercialRegisterDisplay),
    '{{LEGAL_FORM}}': encodeHtml(normalizeLegalFormDisplay(signature.legalForm)),
    '{{LEGAL_LINE_1}}': encodeHtml(legalLine1),
    '{{LEGAL_LINE_2}}': encodeHtml(legalLine2),
    '{{LOGO}}': resolvedLogoUrl
      ? `<img src="${encodeHtml(resolvedLogoUrl)}" alt="${encodeHtml(
          signature.logoAlt || signature.companyName || 'Logo'
        )}" width="150" style="display:block;width:150px;max-width:150px;height:auto;object-fit:contain;" />`
      : '',
    '{{LOGO_ALT}}': encodeHtml(signature.logoAlt || signature.companyName || 'Logo'),
    '{{LOGO_URL}}': encodeHtml(resolvedLogoUrl),
    '{{MANAGING_DIRECTOR}}': encodeHtml(signature.managingDirector),
    '{{MANAGING_DIRECTOR_LINE}}': encodeHtml(managingDirectorDisplay),
    '{{MOBILE}}': encodeHtml(signature.mobilePhone),
    '{{NAME}}': encodeHtml(signature.name),
    '{{PHONE}}': encodeHtml(signature.phone),
    '{{REGISTERED_OFFICE}}': encodeHtml(signature.registeredOffice),
    '{{REGISTER_COURT}}': encodeHtml(registerCourtDisplay),
    '{{REGISTER_COURT_LINE}}': encodeHtml(registerCourtDisplay),
    '{{SIGNATURE_NAME}}': encodeHtml(signature.name),
    '{{STREET_LINE}}': encodeHtml([signature.street, signature.houseNumber].filter(Boolean).join(' ')),
    '{{TAX_NUMBER}}': encodeHtml(cleanSignatureText(signature.taxNumber)),
    '{{TAX_NUMBER_LINE}}': encodeHtml(taxNumberDisplay),
    '{{VAT_ID}}': encodeHtml(cleanSignatureText(signature.vatId)),
    '{{VAT_ID_LINE}}': encodeHtml(vatIdDisplay),
    '{{WEBSITE}}': encodeHtml(signature.website),
  };
}

function renderEmailSignatureTemplate(signature: SignatureRecord) {
  const template = cleanSignatureText(signature.emailTemplateHtml);
  if (!template) return '';
  const tokenMap = buildEmailSignatureTokenMap(signature);
  let rendered = normalizeEmailSignatureTokens(template);
  Object.entries(tokenMap).forEach(([token, value]) => {
    rendered = rendered.replace(new RegExp(token.replace(/[{}]/g, '\\$&'), 'g'), value);
  });
  return sanitizeEmailSignatureHtml(rendered);
}

function emailSignatureHtmlToText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|tr|table)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildSignatureText(signature: SignatureRecord) {
  const customTemplate = renderEmailSignatureTemplate(signature);
  if (customTemplate) return emailSignatureHtmlToText(customTemplate);

  const address = buildSignatureAddress(signature);
  return [
    signature.closing || 'Mit freundlichen Grüßen',
    '',
    signature.name,
    buildCompanyLine(signature.companyName, signature.legalForm),
    signature.department,
    address,
    signature.registeredOffice ? `Sitz: ${signature.registeredOffice}` : '',
    formatManagingDirectorDisplay(signature.managingDirector),
    signature.mobilePhone ? `Mobilfunk: ${signature.mobilePhone}` : '',
    signature.phone ? `Telefon: ${signature.phone}` : '',
    signature.email,
    signature.website,
    formatRegisterCourtDisplay(signature.registerCourt),
    formatCommercialRegisterDisplay(signature.commercialRegisterNumber),
    formatTaxNumberDisplay(signature.taxNumber),
    formatVatIdDisplay(signature.vatId),
  ]
    .filter(Boolean)
    .join('\n');
}

export function mergeBodyWithSignature(body: string, signature: SignatureRecord) {
  const trimmedBody = body.trim();
  const signatureBlock = buildSignatureText(signature);
  if (!signatureBlock) return trimmedBody;
  return [trimmedBody, signatureBlock].filter(Boolean).join('\n\n');
}

export function buildLetterText(body: string, signature: SignatureRecord) {
  const trimmedBody = cleanSignatureText(body);
  const address = buildSignatureAddress(signature);
  return [
    signature.letterHeader || signature.companyName,
    signature.letterSubheader,
    '',
    trimmedBody,
    '',
    signature.letterClosing || signature.closing || 'Mit freundlichen Grüßen',
    signature.name,
    buildCompanyLine(signature.companyName, signature.legalForm),
    address,
    signature.letterFooter,
  ]
    .filter(Boolean)
    .join('\n');
}

function encodeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;');
}

function resolveSignatureLogoUrl(url: string) {
  const cleaned = cleanSignatureText(url);
  if (!cleaned) return '';
  if (/^https?:\/\//i.test(cleaned) || cleaned.startsWith('data:')) {
    return cleaned;
  }

  if (cleaned.startsWith('/')) {
    const origin =
      cleanSignatureText(process.env.NEXT_PUBLIC_APP_URL) ||
      cleanSignatureText(process.env.APP_URL) ||
      (process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : '');
    return origin ? `${origin}${cleaned}` : cleaned;
  }

  return cleaned;
}

function resolveFontSize(value: string, fallback: string) {
  const normalized = cleanSignatureText(value).replace(/px$/i, '');
  return /^\d{1,2}$/.test(normalized) ? `${normalized}px` : fallback;
}

export function buildEmailSignatureHtml(signature: SignatureRecord) {
  const customTemplate = renderEmailSignatureTemplate(signature);
  if (customTemplate) return customTemplate;

  const line1 = [
    [signature.street, signature.houseNumber].filter(Boolean).join(' '),
    [signature.postalCode, signature.city].filter(Boolean).join(' '),
    signature.country,
  ]
    .filter(Boolean)
    .join(' Â· ');
  const line2 = [
    signature.mobilePhone ? `Mobil: ${signature.mobilePhone}` : '',
    signature.phone ? `Telefon: ${signature.phone}` : '',
    signature.email,
    signature.website,
  ]
    .filter(Boolean)
    .join(' Â· ');
  const line3 = [
    formatRegisterCourtDisplay(signature.registerCourt),
    formatCommercialRegisterDisplay(signature.commercialRegisterNumber),
    formatTaxNumberDisplay(signature.taxNumber),
    formatVatIdDisplay(signature.vatId),
  ]
    .filter(Boolean)
    .join(' Â· ');

  const footerLines = [line1, line2, line3].filter(Boolean);
  const resolvedLogoUrl = resolveSignatureLogoUrl(signature.logoUrl);
  const logoHtml = resolvedLogoUrl
    ? `<div style="margin:0 0 10px 0;"><img src="${encodeHtml(resolvedLogoUrl)}" alt="${encodeHtml(
        signature.logoAlt || signature.companyName || 'Logo'
      )}" style="max-height:60px;max-width:220px;object-fit:contain;" /></div>`
    : '';

  const signatureStyle = [
    `text-align:${signature.textAlign === 'left' ? 'left' : 'center'}`,
    `font-family:${signature.fontFamily || 'Segoe UI, Arial, sans-serif'}`,
    `font-size:${resolveFontSize(signature.fontSize, '14px')}`,
    `font-weight:${signature.fontBold ? '700' : '500'}`,
    `font-style:${signature.fontItalic ? 'italic' : 'normal'}`,
    `text-decoration:${signature.fontUnderline ? 'underline' : 'none'}`,
    'line-height:1.45',
  ].join(';');

  if (!logoHtml && footerLines.length === 0) return '';

  return `
    <div style="margin-top:18px;${signature.useDivider === false ? '' : 'padding-top:14px;border-top:1px solid #d6d3d1;'}color:#57534e;${signatureStyle}">
      ${logoHtml}
      ${footerLines.map((line) => `<div style="margin:0 0 4px 0;">${encodeHtml(line)}</div>`).join('')}
    </div>
  `;
}

export function buildFullEmailSignatureHtml(signature: SignatureRecord) {
  const customTemplate = renderEmailSignatureTemplate(signature);
  if (customTemplate) return customTemplate;

  const address = buildSignatureAddress(signature);
  const resolvedLogoUrl = resolveSignatureLogoUrl(signature.logoUrl);
  const companyLine = [signature.companyName, signature.legalForm].filter(Boolean).join(' · ');
  const signatureStyle = [
    `text-align:${signature.textAlign === 'left' ? 'left' : 'center'}`,
    `font-family:${signature.fontFamily || 'Segoe UI, Arial, sans-serif'}`,
    `font-size:${resolveFontSize(signature.fontSize, '14px')}`,
    `font-weight:${signature.fontBold ? '700' : '500'}`,
    `font-style:${signature.fontItalic ? 'italic' : 'normal'}`,
    `text-decoration:${signature.fontUnderline ? 'underline' : 'none'}`,
    'line-height:1.45',
    'color:#475569',
  ].join(';');

  const details = [
    signature.registeredOffice ? `Sitz: ${signature.registeredOffice}` : '',
    signature.managingDirector ? `Geschäftsführung: ${signature.managingDirector}` : '',
    signature.mobilePhone ? `Mobilfunk: ${signature.mobilePhone}` : '',
    signature.phone ? `Telefon: ${signature.phone}` : '',
    signature.email,
    signature.website,
    signature.registerCourt ? `Registergericht: ${signature.registerCourt}` : '',
    signature.commercialRegisterNumber ? `Handelsregister: ${signature.commercialRegisterNumber}` : '',
    signature.taxNumber ? `Steuernummer: ${signature.taxNumber}` : '',
    signature.vatId ? `USt-IdNr.: ${signature.vatId}` : '',
  ].filter(Boolean);

  if (
    !resolvedLogoUrl &&
    !signature.closing &&
    !signature.name &&
    !companyLine &&
    !signature.department &&
    !address &&
    details.length === 0
  ) {
    return '';
  }

  return `
    <div style="margin-top:18px;color:#57534e;${signatureStyle}">
      ${
        resolvedLogoUrl
          ? `<div style="margin:0 0 20px 0;text-align:center;"><img src="${encodeHtml(
              resolvedLogoUrl
            )}" alt="${encodeHtml(signature.logoAlt || signature.companyName || 'Logo')}" style="max-height:128px;max-width:420px;object-fit:contain;" /></div>`
          : ''
      }
      <div style="${signature.useDivider === false ? '' : 'border-top:1px solid #d6d3d1;padding-top:14px;'}">
        <p style="margin:0;">${encodeHtml(signature.closing || 'Mit freundlichen Grüßen')}</p>
        ${signature.name ? `<p style="margin:14px 0 0 0;color:#0f172a;">${encodeHtml(signature.name)}</p>` : ''}
        ${
          companyLine
            ? `<p style="margin:${signature.name ? '6px' : '14px'} 0 0 0;color:#0f172a;">${encodeHtml(companyLine)}</p>`
            : ''
        }
        ${signature.department ? `<p style="margin:4px 0 0 0;">${encodeHtml(signature.department)}</p>` : ''}
        ${
          address
            ? `<div style="margin:12px 0 0 0;white-space:pre-line;">${encodeHtml(address)}</div>`
            : ''
        }
        ${
          details.length > 0
            ? `<div style="margin-top:12px;color:#57534e;">${details
                .map((line, index) => `<p style="margin:${index === 0 ? '0' : '2px 0 0 0'};">${encodeHtml(line)}</p>`)
                .join('')}</div>`
            : ''
        }
      </div>
    </div>
  `;
}

export function buildLetterHtml({
  body,
  bodyIsHtml = false,
  context,
  emptyBodyPlaceholder,
  includePageFrame = true,
  recipient,
  signature,
  subject,
}: {
  body: string;
  bodyIsHtml?: boolean;
  context?: {
    propertyName?: string;
    subjectLine2?: string;
    unitLabel?: string;
  };
  emptyBodyPlaceholder?: string;
  includePageFrame?: boolean;
  recipient?: {
    address?: string;
    company?: string;
    name?: string;
    salutation?: string;
  };
  signature: SignatureRecord;
  subject?: string;
}) {
  const customTemplate = cleanSignatureText(signature.letterTemplateHtml);
  const bodyHtml = bodyIsHtml ? sanitizeLetterBodyHtmlForTemplate(body) : encodeLetterBodyText(body);
  const pagePadding = `${signature.letterMarginTop}px ${signature.letterMarginRight}px ${signature.letterMarginBottom}px ${signature.letterMarginLeft}px`;
  if (customTemplate) {
    const paginatedHtml = buildPaginatedLetterHtml({
      body,
      bodyHtml,
      bodyIsHtml,
      context,
      customTemplate,
      emptyBodyPlaceholder,
      pagePadding,
      recipient,
      signature,
      subject,
    });
    if (paginatedHtml) {
      return paginatedHtml;
    }
    const renderedTemplate = applyLetterTemplateTokens(
      customTemplate,
      buildLetterTemplateTokenMap(
        signature,
        cleanSignatureText(subject),
        bodyHtml,
        emptyBodyPlaceholder,
        recipient,
        context
      )
    );
    return wrapTemplateWithFixedFooter(renderedTemplate, { includePageFrame, pagePadding });
  }
  const resolvedLogoUrl = resolveSignatureLogoUrl(signature.logoUrl);
  const headerStyle = [
    `text-align:${signature.letterHeaderTextAlign === 'left' ? 'left' : 'center'}`,
    `font-family:${signature.letterHeaderFontFamily || signature.fontFamily || 'Segoe UI, Arial, sans-serif'}`,
    `font-size:${resolveFontSize(signature.letterHeaderFontSize, '18px')}`,
    `font-weight:${signature.letterHeaderBold ? '700' : '500'}`,
    `font-style:${signature.letterHeaderItalic ? 'italic' : 'normal'}`,
    `text-decoration:${signature.letterHeaderUnderline ? 'underline' : 'none'}`,
    'line-height:1.45',
    'color:#111827',
  ].join(';');
  const rightBlockStyle = [
    `text-align:${signature.letterRightBlockTextAlign === 'left' ? 'left' : 'center'}`,
    `font-family:${signature.letterRightBlockFontFamily || signature.fontFamily || 'Segoe UI, Arial, sans-serif'}`,
    `font-size:${resolveFontSize(signature.letterRightBlockFontSize, '12px')}`,
    `font-weight:${signature.letterRightBlockBold ? '700' : '500'}`,
    `font-style:${signature.letterRightBlockItalic ? 'italic' : 'normal'}`,
    `text-decoration:${signature.letterRightBlockUnderline ? 'underline' : 'none'}`,
    'line-height:1.6',
    'color:#57534e',
  ].join(';');
  const footerStyle = [
    `text-align:${signature.letterFooterTextAlign === 'left' ? 'left' : 'center'}`,
    `font-family:${signature.letterFooterFontFamily || signature.fontFamily || 'Segoe UI, Arial, sans-serif'}`,
    `font-size:${resolveFontSize(signature.letterFooterFontSize, '12px')}`,
    `font-weight:${signature.letterFooterBold ? '700' : '500'}`,
    `font-style:${signature.letterFooterItalic ? 'italic' : 'normal'}`,
    `text-decoration:${signature.letterFooterUnderline ? 'underline' : 'none'}`,
    'line-height:1.6',
    'color:#57534e',
  ].join(';');
  const subjectHtml = cleanSignatureText(subject)
    ? `<div style="margin:0 0 20px 0;color:#1f2937;">
        <div style="font-size:18px;font-weight:600;">${encodeHtml(cleanSignatureText(subject))}</div>
        ${
          cleanSignatureText(context?.subjectLine2)
            ? `<div style="margin-top:4px;font-size:13px;font-weight:500;color:#57534e;">${encodeHtml(
                cleanSignatureText(context?.subjectLine2)
              )}</div>`
            : ''
        }
      </div>`
    : '';
  const footerHtml = cleanSignatureText(signature.letterFooter)
    ? `<div style="margin-top:28px;${signature.letterFooterDivider === false ? '' : 'padding-top:14px;border-top:1px solid #d6d3d1;'}${footerStyle}">${encodeHtml(
        cleanSignatureText(signature.letterFooter)
      ).replace(/\n/g, '<br />')}</div>`
    : '';

  const wrapperStyle = includePageFrame
    ? `font-family:${signature.fontFamily || 'Georgia, Times New Roman, serif'};font-size:${resolveFontSize(
        signature.fontSize,
        '14px'
      )};line-height:1.65;color:#1f2937;background:#ffffff;padding:${pagePadding};height:1123px;min-height:1123px;width:794px;max-width:100%;margin:0 auto;box-sizing:border-box;overflow:hidden;`
    : `font-family:${signature.fontFamily || 'Georgia, Times New Roman, serif'};font-size:${resolveFontSize(
        signature.fontSize,
        '14px'
      )};line-height:1.65;color:#1f2937;box-sizing:border-box;overflow:hidden;`;

  return `
    <div style="${wrapperStyle}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:34px;">
        <div>
          ${
            resolvedLogoUrl && signature.letterShowLogo
              ? `<img src="${encodeHtml(resolvedLogoUrl)}" alt="${encodeHtml(
                  signature.logoAlt || signature.companyName || 'Logo'
                )}" style="max-height:72px;max-width:220px;object-fit:contain;" />`
              : ''
          }
          <div style="margin-top:12px;${headerStyle}">${encodeHtml(
            signature.letterHeader || signature.companyName || 'Firmenbrief'
          )}</div>
          ${
            signature.letterSubheader
              ? `<div style="margin-top:6px;${headerStyle};font-size:13px;color:#6b7280;">${encodeHtml(
                  signature.letterSubheader
                )}</div>`
              : ''
          }
        </div>
        <div style="max-width:280px;${rightBlockStyle}">
          ${encodeHtml(cleanSignatureText(signature.letterRightBlock)).replace(/\n/g, '<br />')}
        </div>
      </div>
      ${
        signature.letterSenderLine
          ? `<div style="margin:0 0 18px 0;font-size:11px;color:#6b7280;border-bottom:1px solid #e7e5e4;padding-bottom:6px;">${encodeHtml(
              signature.letterSenderLine
            )}</div>`
          : ''
      }
      ${subjectHtml}
      <div data-letter-body="true" style="min-height:28px;white-space:pre-wrap;outline:none;text-align:justify;text-align-last:left;line-height:inherit;font:inherit;color:inherit;">${
        bodyHtml || encodeHtml(cleanSignatureText(emptyBodyPlaceholder))
      }</div>
      <div style="margin-top:24px;white-space:pre-line;">
        ${encodeHtml(signature.letterClosing || signature.closing || 'Mit freundlichen Grüßen')}
        ${signature.name ? `<br /><br />${encodeHtml(signature.name)}` : ''}
        ${
          signature.companyName
            ? `<br />${encodeHtml(buildCompanyLine(signature.companyName, signature.legalForm))}`
            : ''
        }
      </div>
      ${footerHtml}
    </div>
  `;
}

export function buildLetterTemplatePreviewHtml({
  body,
  bodyIsHtml = false,
  context,
  emptyBodyPlaceholder,
  includePageFrame = false,
  recipient,
  signature,
  subject,
}: {
  body: string;
  bodyIsHtml?: boolean;
  context?: {
    propertyName?: string;
    subjectLine2?: string;
    unitLabel?: string;
  };
  emptyBodyPlaceholder?: string;
  includePageFrame?: boolean;
  recipient?: {
    address?: string;
    company?: string;
    name?: string;
    salutation?: string;
  };
  signature: SignatureRecord;
  subject?: string;
}) {
  const sanitizePreviewHtml = (html: string) =>
    html
      .replace(/\scontenteditable="[^"]*"/gi, '')
      .replace(/\sspellcheck="[^"]*"/gi, '')
      .replace(/\stabindex="[^"]*"/gi, '');

  const customTemplate = cleanSignatureText(signature.letterTemplateHtml);
  if (!customTemplate) {
    return buildLetterHtml({
      body,
      bodyIsHtml,
      context,
      emptyBodyPlaceholder,
      includePageFrame,
      recipient,
      signature,
      subject,
    });
  }

  const bodyHtml = bodyIsHtml ? sanitizeLetterBodyHtmlForTemplate(body) : encodeLetterBodyText(body);
  const renderedTemplate = sanitizePreviewHtml(
    applyLetterTemplateTokens(
      customTemplate,
      buildLetterTemplateTokenMap(
        signature,
        cleanSignatureText(subject),
        bodyHtml,
        emptyBodyPlaceholder,
        recipient,
        context
      )
    )
  );

  if (!includePageFrame) {
    return renderedTemplate;
  }

  const pagePadding = `${signature.letterMarginTop}px ${signature.letterMarginRight}px ${signature.letterMarginBottom}px ${signature.letterMarginLeft}px`;
  return `<div style="position:relative;width:794px;max-width:100%;min-height:1123px;margin:0 auto;padding:${pagePadding};overflow:visible;background:#ffffff;box-sizing:border-box;">${renderedTemplate}</div>`;
}

export function buildLetterComposeLayout({
  body,
  context,
  emptyBodyPlaceholder,
  recipient,
  signature,
  subject,
}: {
  body: string;
  bodyIsHtml?: boolean;
  context?: {
    propertyName?: string;
    subjectLine2?: string;
    unitLabel?: string;
  };
  emptyBodyPlaceholder?: string;
  recipient?: {
    address?: string;
    company?: string;
    name?: string;
  };
  signature: SignatureRecord;
  subject?: string;
}) {
  const customTemplate = cleanSignatureText(signature.letterTemplateHtml);
  if (!customTemplate || typeof document === 'undefined') {
    return null;
  }

  const bodyMarker = '__LETTER_BODY_MARKER__';
  const renderedTemplate = applyLetterTemplateTokens(
    customTemplate,
    buildLetterTemplateTokenMap(
      signature,
      cleanSignatureText(subject),
      bodyMarker,
      emptyBodyPlaceholder,
      recipient,
      context
    )
  );

  const template = document.createElement('template');
  template.innerHTML = renderedTemplate;

  const headerSection = template.content.querySelector('[data-letter-section="header"]') as HTMLElement | null;
  const bodySection = template.content.querySelector('[data-letter-section="body"]') as HTMLElement | null;
  const footerSection = template.content.querySelector('[data-letter-section="footer"]') as HTMLElement | null;
  const bodySource = template.content.querySelector('[data-letter-body="true"]') as HTMLElement | null;

  if (!headerSection || !bodySection || !footerSection || !bodySource) {
    return null;
  }

  const bodySourceHtml = bodySource.outerHTML;
  const [bodyInnerBeforeHtml, ...bodyInnerAfterParts] = bodySection.innerHTML.split(bodySourceHtml);

  return {
    bodyContainerClassName: bodySource.getAttribute('class') || '',
    bodyContainerStyle: bodySource.getAttribute('style') || '',
    bodyHeight: extractSectionMinHeight(customTemplate, 'body', 520),
    bodyInnerAfterHtml: bodyInnerAfterParts.join(bodySourceHtml),
    bodyInnerBeforeHtml,
    bodySectionClassName: bodySection.getAttribute('class') || '',
    bodySectionStyle: bodySection.getAttribute('style') || '',
    footerSectionHtml: footerSection.outerHTML,
    headerSectionHtml: headerSection.outerHTML,
  };
}

