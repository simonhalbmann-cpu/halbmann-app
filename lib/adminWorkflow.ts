import type { DocumentData, Timestamp } from 'firebase/firestore';

export type WorkflowRecord = {
  data: DocumentData;
  id: string;
};

export type WorkflowAnalysis = {
  category: string;
  confidence: 'high' | 'medium' | 'low';
  contactId: string;
  contactLabel: string;
  needsReview: boolean;
  priority: 'notfall' | 'hoch' | 'normal';
  propertyId: string;
  propertyLabel: string;
  reasons: string[];
  senderType: 'tenant' | 'contact' | 'unknown';
  tenantId: string;
  tenantLabel: string;
  ticketType: string;
  trade: string;
  tradeLabel: string;
  unitId: string;
  unitLabel: string;
};

export type ContactSummary = {
  email: string;
  salutation: string;
  name: string;
  phone: string;
};

export type IssueSuggestion = {
  focus: string;
  title: string;
};

type MessageLike = {
  bodyText?: unknown;
  category?: unknown;
  fromEmail?: unknown;
  fromName?: unknown;
  priority?: unknown;
  propertyId?: unknown;
  subject?: unknown;
  tenantId?: unknown;
  unitId?: unknown;
};

const categoryConfig: Record<
  string,
  {
    keywords: string[];
    label: string;
    serviceField?: string;
    ticketType: string;
    trade: string;
    tradeLabel: string;
  }
> = {
  billing: {
    keywords: ['abrechnung', 'nebenkosten', 'zahlung', 'miete', 'rechnung'],
    label: 'Abrechnung',
    serviceField: 'billingServiceId',
    ticketType: 'billing',
    trade: 'billing_service',
    tradeLabel: 'Abrechnungsunternehmen',
  },
  cleaning: {
    keywords: ['treppenhausreinigung', 'hausreinigung', 'reinigung', 'putz', 'schmutz im treppenhaus'],
    label: 'Hausreinigung',
    serviceField: 'cleaningServiceId',
    ticketType: 'maintenance',
    trade: 'cleaning_service',
    tradeLabel: 'Hausreinigung',
  },
  electrical: {
    keywords: ['elektrik', 'strom', 'sicherung', 'steckdose', 'licht'],
    label: 'Elektrik',
    serviceField: 'electricianId',
    ticketType: 'damage',
    trade: 'electrician',
    tradeLabel: 'Elektriker',
  },
  general: {
    keywords: [],
    label: 'Allgemein',
    ticketType: 'general_request',
    trade: 'general',
    tradeLabel: 'Allgemeine Anfrage',
  },
  heating: {
    keywords: ['heizung', 'warmwasser', 'heizkörper', 'therme', 'heizzähler'],
    label: 'Heizung',
    serviceField: 'heatingServiceId',
    ticketType: 'maintenance',
    trade: 'heating_service',
    tradeLabel: 'Heizungsdienst',
  },
  mold: {
    keywords: ['schimmel', 'feuchtigkeit'],
    label: 'Schimmel / Feuchtigkeit',
    ticketType: 'damage',
    trade: 'plumbing',
    tradeLabel: 'Sanitär / Rohrreinigung',
  },
  plumbing: {
    keywords: ['wasser', 'rohr', 'abfluss', 'sanitär', 'wc', 'toilette'],
    label: 'Wasser / Sanitär',
    serviceField: 'plumbingServiceId',
    ticketType: 'damage',
    trade: 'plumbing',
    tradeLabel: 'Sanitär / Rohrreinigung',
  },
  roof: {
    keywords: ['dach', 'regenrinne', 'sturm'],
    label: 'Dach / Regenrinne',
    serviceField: 'roofMaintenanceId',
    ticketType: 'maintenance',
    trade: 'roof_maintenance',
    tradeLabel: 'Dachwartung',
  },
  termination: {
    keywords: ['kündigung', 'kuendigung', 'auszug', 'mietende'],
    label: 'Kündigung',
    ticketType: 'termination',
    trade: 'general',
    tradeLabel: 'Kündigung',
  },
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalize(text: string) {
  return text
    .toLocaleLowerCase('de-DE')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

function toTitleCase(value: string) {
  if (!value) return value;
  const normalized = value
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('de-DE');
  return normalized.charAt(0).toLocaleUpperCase('de-DE') + normalized.slice(1);
}

function buildIssueTitle(fragment: string) {
  const source = normalize(fragment);
  if (source.includes('verstopf') && (source.includes('toilette') || source.includes('wc'))) {
    return 'Verstopfte Toilette';
  }
  if (source.includes('treppenhaus') && source.includes('reinig')) {
    return 'Mangelhafte Treppenhausreinigung';
  }
  if (source.includes('verstopf') && source.includes('kuche')) {
    return 'Verstopfung in Küche';
  }
  if ((source.includes('toilette') || source.includes('wc')) && source.includes('tropf')) {
    return 'Tropfende Toilette';
  }
  if ((source.includes('wasser') || source.includes('rohr')) && source.includes('tropf')) {
    return 'Wasserleck';
  }
  if (source.includes('steckdose')) {
    return 'Defekte Steckdose';
  }
  if (source.includes('elektrik') || source.includes('strom')) {
    return 'Elektrikproblem';
  }
  if (source.includes('heizung') || source.includes('warmwasser')) {
    return 'Heizungsproblem';
  }
  if (source.includes('schimmel')) {
    return 'Schimmelproblem';
  }

  const cleaned = fragment
    .replace(/^[,;:\-\s]+/, '')
    .replace(/[.]+$/, '')
    .trim();
  if (!cleaned) return 'Allgemeines Anliegen';
  return toTitleCase(cleaned.length > 48 ? `${cleaned.slice(0, 45).trim()}…` : cleaned);
}

export function buildIssueSuggestionsFromText(text: string) {
  const cleaned = cleanText(text);
  if (!cleaned) return [];

  const normalizedWholeText = normalize(cleaned);
  const knownSuggestions: IssueSuggestion[] = [];
  const pushKnown = (title: string, focus: string) => {
    if (!knownSuggestions.some((entry) => normalize(entry.title) === normalize(title))) {
      knownSuggestions.push({ title, focus });
    }
  };

  if (normalizedWholeText.includes('verstopf') && normalizedWholeText.includes('kuche')) {
    pushKnown('Verstopfung in Küche', 'Verstopfung in Küche');
  }
  if (
    (normalizedWholeText.includes('tropf') || normalizedWholeText.includes('leck')) &&
    (normalizedWholeText.includes('toilette') || normalizedWholeText.includes('wc'))
  ) {
    pushKnown('Tropfende Toilette', 'Tropfende Toilette');
  }
  if (normalizedWholeText.includes('treppenhaus') && normalizedWholeText.includes('reinig')) {
    pushKnown('Mangelhafte Treppenhausreinigung', 'Mangelhafte Treppenhausreinigung');
  }
  if (normalizedWholeText.includes('steckdose')) {
    pushKnown('Defekte Steckdose', 'Defekte Steckdose');
  }
  if (normalizedWholeText.includes('heizung') || normalizedWholeText.includes('warmwasser')) {
    pushKnown('Heizungsproblem', 'Heizungsproblem');
  }

  const parts = cleaned
    .split(/\r?\n|[.;!?](?:\s+|$)|,\s+(?=(?:und\s+)?(?:die|der|das|ein|eine|mangel|verstopf|tropf|heizung|strom|treppenhaus|küche|kuche|wc|toilette))/i)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const suggestions = parts
    .map((focus) => ({
      focus,
      title: buildIssueTitle(focus),
    }))
    .filter((entry) => entry.focus.length > 6);

  const unique: IssueSuggestion[] = [];
  for (const suggestion of suggestions) {
    const key = `${normalize(suggestion.title)}::${normalize(suggestion.focus)}`;
    if (unique.some((entry) => `${normalize(entry.title)}::${normalize(entry.focus)}` === key)) {
      continue;
    }
    unique.push(suggestion);
  }

  const merged = [...knownSuggestions, ...unique].filter((entry, index, array) => {
    const key = `${normalize(entry.title)}::${normalize(entry.focus)}`;
    return array.findIndex((candidate) => `${normalize(candidate.title)}::${normalize(candidate.focus)}` === key) === index;
  });

  if (merged.length > 0) {
    return merged.slice(0, 6);
  }

  return [
    {
      focus: cleaned,
      title: buildIssueTitle(cleaned),
    },
  ];
}

export function formatDateTime(value: unknown) {
  const date = toDate(value);
  if (!date) return '–';
  return date.toLocaleString('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatMoney(value: unknown) {
  const text = cleanText(value);
  return text || '–';
}

export function formatTimestampSort(value: unknown) {
  return toMillis(value);
}

function toDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object' && value !== null) {
    const maybeTimestamp = value as Timestamp & { seconds?: number };
    if (typeof maybeTimestamp.toDate === 'function') {
      return maybeTimestamp.toDate();
    }
    if (typeof maybeTimestamp.seconds === 'number') {
      return new Date(maybeTimestamp.seconds * 1000);
    }
  }
  return null;
}

export function toMillis(value: unknown) {
  const date = toDate(value);
  return date ? date.getTime() : 0;
}

function buildPersonLabel(record?: WorkflowRecord | null) {
  if (!record) return '';
  const lastName = cleanText(record.data.lastName);
  const firstName = cleanText(record.data.firstName);
  const company = cleanText(record.data.partnerCompanyName);
  return [lastName, firstName].filter(Boolean).join(', ') || company || cleanText(record.data.name) || record.id;
}

function buildTenantLabel(record?: WorkflowRecord | null) {
  if (!record) return '';
  return (
    [cleanText(record.data.lastName), cleanText(record.data.firstName)].filter(Boolean).join(', ') ||
    cleanText(record.data.companyName) ||
    record.id
  );
}

function matchCategory(text: string) {
  const source = normalize(text);
  if (source.includes('treppenhaus') && source.includes('reinig')) {
    return 'cleaning';
  }
  if ((source.includes('toilette') || source.includes('wc')) && (source.includes('tropf') || source.includes('leck'))) {
    return 'plumbing';
  }
  if (source.includes('verstopf') && (source.includes('kuche') || source.includes('küche'))) {
    return 'plumbing';
  }
  if (source.includes('zahler') || source.includes('zahlerstand') || source.includes('zaehler') || source.includes('zaehlerstand')) {
    return 'general';
  }
  for (const [category, config] of Object.entries(categoryConfig)) {
    if (config.keywords.some((keyword) => source.includes(normalize(keyword)))) {
      return category;
    }
  }
  return 'general';
}

function detectPriority(text: string): WorkflowAnalysis['priority'] {
  const source = normalize(text);
  if (['brand', 'funken', 'gefahr', 'stromschlag', 'notfall', 'wasser lauft', 'wasser läuft'].some((keyword) => source.includes(keyword))) {
    return 'notfall';
  }
  if (['dringend', 'sofort', 'schnell', 'heute', 'ausfall'].some((keyword) => source.includes(keyword))) {
    return 'hoch';
  }
  return 'normal';
}

function resolveUnitFromTenant(tenant?: WorkflowRecord | null) {
  const selectedKey = cleanText(tenant?.data.selectedUnitKey);
  if (!selectedKey.includes('::')) {
    return {
      propertyId: cleanText(tenant?.data.propertyId),
      unitId: cleanText(tenant?.data.unitId),
    };
  }
  const [propertyId, unitId] = selectedKey.split('::');
  return { propertyId, unitId };
}

function findUnitLabel(property: WorkflowRecord | null, unitId: string, fallback: string) {
  if (!property || !Array.isArray(property.data.units)) return fallback;
  const unit = property.data.units.find(
    (entry: DocumentData) => entry && typeof entry === 'object' && cleanText(entry.id) === unitId
  );
  if (!unit) return fallback;
  return [cleanText(unit.unitLabel), cleanText(unit.floor), cleanText(unit.unitPosition)].filter(Boolean).join(' · ') || fallback;
}

export function inferMessageAnalysis(
  message: MessageLike,
  tenants: WorkflowRecord[],
  properties: WorkflowRecord[],
  people: WorkflowRecord[]
): WorkflowAnalysis {
  const subject = cleanText(message.subject);
  const bodyText = cleanText(message.bodyText);
  const fromEmail = cleanText(message.fromEmail).toLocaleLowerCase('de-DE');
  const combinedText = `${subject}\n${bodyText}`;

  const tenantById = tenants.find((record) => record.id === cleanText(message.tenantId)) ?? null;
  const tenantByMail =
    tenants.find((record) => cleanText(record.data.email).toLocaleLowerCase('de-DE') === fromEmail) ?? null;
  const tenant = tenantById ?? tenantByMail;
  const contact =
    people.find((record) => cleanText(record.data.email).toLocaleLowerCase('de-DE') === fromEmail) ?? null;

  const unitFromTenant = resolveUnitFromTenant(tenant);
  const propertyId = cleanText(message.propertyId) || unitFromTenant.propertyId;
  const unitId = cleanText(message.unitId) || unitFromTenant.unitId;
  const property = properties.find((record) => record.id === propertyId) ?? null;
  const category = cleanText(message.category) || matchCategory(combinedText);
  const config = categoryConfig[category] ?? categoryConfig.general;

  const reasons: string[] = [];
  if (tenant) reasons.push('Absender über bekannte Mieteradresse erkannt');
  if (!tenant && contact) reasons.push('Absender über bekannte Kontaktadresse erkannt');
  if (category !== 'general') reasons.push(`Thema als ${config.label} erkannt`);
  if (!propertyId) reasons.push('Kein Objekt eindeutig zugeordnet');

  return {
    category,
    confidence: tenant && propertyId ? 'high' : tenant || contact ? 'medium' : 'low',
    contactId: contact?.id ?? '',
    contactLabel: buildPersonLabel(contact),
    needsReview: !tenant || !propertyId,
    priority: (cleanText(message.priority) as WorkflowAnalysis['priority']) || detectPriority(combinedText),
    propertyId,
    propertyLabel: cleanText(property?.data.name),
    reasons,
    senderType: tenant ? 'tenant' : contact ? 'contact' : 'unknown',
    tenantId: tenant?.id ?? '',
    tenantLabel: buildTenantLabel(tenant),
    ticketType: config.ticketType,
    trade: config.trade,
    tradeLabel: config.tradeLabel,
    unitId,
    unitLabel: findUnitLabel(property, unitId, cleanText(tenant?.data.unitLabel)),
  };
}

export function resolveServiceContact(
  analysis: WorkflowAnalysis,
  property: WorkflowRecord | null,
  people: WorkflowRecord[]
) {
  const serviceField = (categoryConfig[analysis.category] ?? categoryConfig.general).serviceField;
  const contactId = serviceField ? cleanText(property?.data[serviceField]) : '';
  const contact = people.find((record) => record.id === contactId) ?? null;
  return {
    contact,
    contactId,
    label: buildPersonLabel(contact),
  };
}

export function buildReplyDraft(message: WorkflowRecord, analysis: WorkflowAnalysis) {
  const senderName = analysis.tenantLabel || cleanText(message.data.fromName) || 'Guten Tag';
  return {
    body: [
      `Guten Tag ${senderName},`,
      '',
      'vielen Dank für Ihre Nachricht.',
      `Wir haben Ihr Anliegen zum Thema ${categoryConfig[analysis.category]?.label ?? 'Allgemeines'} aufgenommen und kümmern uns darum.`,
      'Sobald es einen nächsten Schritt gibt, melden wir uns wieder bei Ihnen.',
    ].join('\n'),
    subject: cleanText(message.data.subject) || 'Ihre Nachricht an Halbmann',
  };
}

export function buildServiceDraft(
  message: WorkflowRecord,
  analysis: WorkflowAnalysis,
  property: WorkflowRecord | null,
  serviceContactLabel: string,
  tenantContact?: ContactSummary | null
) {
  const objectLabel = cleanText(property?.data.name) || analysis.propertyLabel || 'ohne Objektzuordnung';
  const unitLabel = analysis.unitLabel || 'ohne Einheitsangabe';
  const senderName = analysis.tenantLabel || cleanText(message.data.fromName) || 'dem Mieter';
  const greetingTarget = cleanText(serviceContactLabel);
  const tenantPhone = cleanText(tenantContact?.phone);
  const tenantEmail = cleanText(tenantContact?.email);
  return {
    body: [
      greetingTarget ? `Guten Tag ${greetingTarget},` : 'Guten Tag,',
      '',
      `bitte nehmen Sie Kontakt mit ${senderName} auf und vereinbaren Sie einen Vor-Ort-Termin.`,
      '',
      `Objekt: ${objectLabel}`,
      `Einheit: ${unitLabel}`,
      `Thema: ${categoryConfig[analysis.category]?.label ?? 'Allgemeines Anliegen'}`,
      tenantPhone ? `Telefon Mieter: ${tenantPhone}` : '',
      tenantEmail ? `E-Mail Mieter: ${tenantEmail}` : '',
      '',
      'Bitte geben Sie nach Rückmeldung oder Termin kurz Bescheid.',
    ]
      .filter(Boolean)
      .join('\n'),
    subject: `${categoryConfig[analysis.category]?.label ?? 'Anliegen'} – ${objectLabel}`,
  };
}

export function buildTenantContact(tenant?: WorkflowRecord | null): ContactSummary | null {
  if (!tenant) return null;
  const salutation =
    cleanText(tenant.data.salutation) ||
    cleanText(tenant.data.anrede) ||
    (cleanText(tenant.data.gender).toLocaleLowerCase('de-DE').startsWith('w')
      ? 'Frau'
      : cleanText(tenant.data.gender).toLocaleLowerCase('de-DE').startsWith('m')
        ? 'Herr'
        : '');
  return {
    email: cleanText(tenant.data.email),
    salutation,
    name:
      [cleanText(tenant.data.firstName), cleanText(tenant.data.lastName)].filter(Boolean).join(' ') ||
      cleanText(tenant.data.companyName),
    phone:
      cleanText(tenant.data.phone) ||
      cleanText(tenant.data.mobile) ||
      cleanText(tenant.data.telephone),
  };
}

export function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    closed: 'Geschlossen',
    done: 'Erledigt',
    draft_ready: 'Entwürfe bereit',
    in_progress: 'In Bearbeitung',
    new: 'Neu',
    needs_review: 'Zu prüfen',
    ticket_created: 'Ticket erstellt',
  };
  return map[status] ?? status ?? 'Offen';
}

export function getTicketTypeLabel(type: string) {
  const map: Record<string, string> = {
    billing: 'Abrechnung',
    damage: 'Schaden',
    general_request: 'Allgemeine Anfrage',
    maintenance: 'Wartung',
    meter: 'Zähler',
    new_lease: 'Neuvermietung',
    termination: 'Kündigung',
  };
  return map[type] ?? type ?? 'Allgemein';
}
