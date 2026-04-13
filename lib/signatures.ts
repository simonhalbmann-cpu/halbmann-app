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
  return [cleanSignatureText(companyName), normalizeLegalFormDisplay(legalForm)].filter(Boolean).join(' ');
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
  '{{RECIPIENT_ADDRESS}}',
  '{{RECIPIENT_BLOCK}}',
  '{{PROPERTY_NAME}}',
  '{{UNIT_LABEL}}',
  '{{SENDER_LINE}}',
  '{{CITY_DATE}}',
  '{{SUBJECT}}',
  '{{GREETING}}',
  '{{SIGNATURE_NAME}}',
  '{{BODY_HTML}}',
  '{{CLOSING_BLOCK}}',
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
  const email = firstRecordText(data?.email);
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

function buildLetterTemplateTokenMap(
  signature: SignatureRecord,
  subject: string,
  bodyHtml: string,
  emptyBodyPlaceholder?: string,
  recipient?: {
    address?: string;
    company?: string;
    name?: string;
  },
  context?: {
    propertyName?: string;
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
  const propertyName = cleanSignatureText(context?.propertyName) || 'Immobilie';
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
  const headerHtml = renderedTemplate.slice(0, firstLine.index ?? 0);
  const middleHtml = renderedTemplate.slice(firstLine.index ?? 0, (lastLine.index ?? 0) + lastLine[0].length);
  const footerHtml = renderedTemplate.slice((lastLine.index ?? 0) + lastLine[0].length).trim();

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
        pickStyle(existingStyle, allowedCellStyleProps),
      ]);
    } else if (tag === 'div' || tag === 'p') {
      const picked = pickStyle(existingStyle, allowedTextStyleProps);
      const hasOwnAlign = /text-align\s*:|text-align-last\s*:/i.test(picked);
      applyStyle(element, [
        'margin:0 0 1em 0',
        'display:block',
        'width:100%',
        'max-width:none',
        'box-sizing:border-box',
        'font:inherit',
        'line-height:inherit',
        'color:inherit',
        picked,
        hasOwnAlign ? '' : 'text-align:justify;text-align-last:left',
      ]);
    } else if (tag === 'span' || tag === 'strong' || tag === 'b' || tag === 'em' || tag === 'i' || tag === 'u') {
      applyStyle(element, [pickStyle(existingStyle, allowedTextStyleProps)]);
    } else if (tag === 'ul' || tag === 'ol' || tag === 'blockquote') {
      const picked = pickStyle(existingStyle, allowedTextStyleProps);
      const hasOwnAlign = /text-align\s*:|text-align-last\s*:/i.test(picked);
      applyStyle(element, [
        'margin:0 0 1em 0',
        'width:100%',
        'max-width:none',
        'box-sizing:border-box',
        'font:inherit',
        'line-height:inherit',
        'color:inherit',
        picked,
        hasOwnAlign ? '' : 'text-align:justify;text-align-last:left',
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
      supportedTextStyles,
    ]
      .filter(Boolean)
      .join(';');
    const normalizedStyle = combinedStyle.toLowerCase();
    const finalStyle = /text-align\s*:/.test(normalizedStyle)
      ? combinedStyle
      : `${combinedStyle};text-align:justify;text-align-last:left`;

    return `<div style="${finalStyle}">${content}</div>`;
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
    if (!/text-align\s*:/.test(normalizedStyle)) {
      additions.push('text-align:justify', 'text-align-last:left');
    }
    clone.setAttribute('style', [existingStyle, additions.join(';')].filter(Boolean).join(';'));
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
        return;
      }
      if (hasNestedBlockContent(element)) {
        flushParagraphParts();
        blocks.push(buildParagraphBlock(element.innerHTML, cleanSignatureText(element.getAttribute('style'))));
        return;
      }
      paragraphParts.push(element.innerHTML.trim());
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
    unitLabel?: string;
  };
  customTemplate: string;
  emptyBodyPlaceholder?: string;
  pagePadding: string;
  recipient?: {
    address?: string;
    company?: string;
    name?: string;
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

    return { bodyPlaceholder, bodySection, closingTarget, page };
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
    const sectionRect = page.bodySection.getBoundingClientRect();
    const bodyRect = page.bodyPlaceholder.getBoundingClientRect();
    const closingRect = page.closingTarget.getBoundingClientRect();
    const contentBottom = Math.max(bodyRect.bottom, closingRect.bottom);
    const sectionStyle = window.getComputedStyle(page.bodySection);
    const paddingBottom = Number.parseFloat(sectionStyle.paddingBottom || '0') || 0;
    const reservePx = isFirstPage ? 0 : 24;
    const availableBottom = sectionRect.bottom - paddingBottom - reservePx;
    return contentBottom <= availableBottom + 0.5;
  };

  const pages: Array<{ bodyText: string; isFirstPage: boolean; includeClosing: boolean }> = [];

  try {
    if (bodyIsHtml) {
      const joinedHtml = htmlBlocks.join('');
      if (!joinedHtml) {
        const singleEmptyPage = createPage(true, true, '', '');
        return singleEmptyPage ? singleEmptyPage.page.outerHTML : null;
      }

      if (fitsOnPage('', true, true, joinedHtml)) {
        const singlePage = createPage(true, true, '', joinedHtml);
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

        if (!chunkHtml || consumedCount === 0) {
          return null;
        }

        pages.push({ bodyText: chunkHtml, includeClosing: false, isFirstPage });
        remainingBlocks = remainingBlocks.slice(consumedCount);
        isFirstPage = false;
      }

      return pages
        .map(({ bodyText, includeClosing, isFirstPage }, index) => {
          const page = createPage(isFirstPage, includeClosing, '', bodyText);
          if (!page) return '';
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
      return singleEmptyPage ? singleEmptyPage.page.outerHTML : null;
    }

    if (fitsOnPage(normalizedBody, true, true)) {
      const singlePage = createPage(true, true, normalizedBody);
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

export function createSignatureRecord(data?: Record<string, unknown> | null): SignatureRecord {
  return {
    bankName: firstRecordText(data?.bankName, data?.bank),
    bic: firstRecordText(data?.bic),
    city: firstRecordText(data?.city),
    closing: cleanSignatureText(data?.signatureClosing) || 'Mit freundlichen GrÃ¼ÃŸen',
    commercialRegisterNumber:
      firstRecordText(data?.commercialRegisterNumber, data?.hrb),
    companyName: normalizeCompanyDisplayName(firstRecordText(data?.name)),
    country: firstRecordText(data?.country),
    department: cleanSignatureText(data?.signatureDepartment),
    email: firstRecordText(data?.email),
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
      'Mit freundlichen GrÃ¼ÃŸen',
    letterClosingBlock: cleanSignatureText(data?.signatureLetterClosingBlock),
    letterFooter: cleanSignatureText(data?.signatureLetterFooter),
    letterGreeting: cleanSignatureText(data?.signatureLetterGreeting),
    letterMarginBottom: Number(data?.signatureLetterMarginBottom ?? 64) || 64,
    letterMarginLeft: Number(data?.signatureLetterMarginLeft ?? 56) || 56,
    letterMarginRight: Number(data?.signatureLetterMarginRight ?? 56) || 56,
    letterMarginTop: Number(data?.signatureLetterMarginTop ?? 48) || 48,
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
    portalClosing: cleanSignatureText(data?.signaturePortalClosing) || 'Mit freundlichen GrÃ¼ÃŸen',
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

export function buildPortalSignatureText(signature: SignatureRecord) {
  return [
    signature.portalClosing || 'Mit freundlichen GrÃ¼ÃŸen',
    '',
    signature.portalName,
    signature.portalCompanyName || signature.companyName,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildSignatureAddress(signature: SignatureRecord) {
  const firstLine = [signature.street, signature.houseNumber].filter(Boolean).join(' ');
  const secondLine = [signature.postalCode, signature.city].filter(Boolean).join(' ');
  const countryLine = signature.country;
  return [firstLine, secondLine, countryLine].filter(Boolean).join('\n');
}

export function buildSignatureText(signature: SignatureRecord) {
  const address = buildSignatureAddress(signature);
  return [
    signature.closing || 'Mit freundlichen GrÃ¼ÃŸen',
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
    signature.letterClosing || signature.closing || 'Mit freundlichen GrÃ¼ÃŸen',
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
    unitLabel?: string;
  };
  emptyBodyPlaceholder?: string;
  includePageFrame?: boolean;
  recipient?: {
    address?: string;
    company?: string;
    name?: string;
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
    ? `<div style="margin:0 0 20px 0;font-size:18px;font-weight:600;color:#1f2937;">${encodeHtml(
        cleanSignatureText(subject)
      )}</div>`
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
        ${encodeHtml(signature.letterClosing || signature.closing || 'Mit freundlichen GrÃ¼ÃŸen')}
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
    unitLabel?: string;
  };
  emptyBodyPlaceholder?: string;
  includePageFrame?: boolean;
  recipient?: {
    address?: string;
    company?: string;
    name?: string;
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
  if (!customTemplate) {
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

  const hasStructuredSections =
    renderedTemplate.includes('data-letter-section="header"') &&
    renderedTemplate.includes('data-letter-section="body"') &&
    renderedTemplate.includes('data-letter-section="footer"');
  if (!hasStructuredSections) {
    return null;
  }

  const headerHtml = extractSectionInnerHtml(renderedTemplate, 'header', 'body');
  const bodySectionHtml = extractSectionInnerHtml(renderedTemplate, 'body', 'footer');
  const footerHtml = extractSectionInnerHtml(renderedTemplate, 'footer');
  const [bodyBeforeHtml, ...bodyAfterParts] = bodySectionHtml.split(bodyMarker);

  return {
    bodyAfterHtml: bodyAfterParts.join(bodyMarker),
    bodyBeforeHtml,
    bodyHeight: extractSectionMinHeight(customTemplate, 'body', 520),
    footerHtml,
    headerHtml,
  };
}

