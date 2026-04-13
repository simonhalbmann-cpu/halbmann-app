'use client';

import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, type DocumentData } from 'firebase/firestore';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { formatDateTime, formatTimestampSort, type WorkflowRecord } from '../../lib/adminWorkflow';
import { db } from '../../lib/firebase';
import { buildRecipientGreeting, stripAiEnvelope } from '../../lib/draftComposer';
import LetterComposeEditor from './LetterComposeEditor';
import {
  buildLetterHtml,
  buildLetterText,
  buildPortalSignatureText,
  createSignatureRecord,
  mergeBodyWithSignature,
  type SignatureRecord,
} from '../../lib/signatures';
import { buildExternalMessageKey } from '../../lib/mailIdentity';
import { printLetterHtml } from './letterPrint';

type MailboxTab = 'archive' | 'compose' | 'inbox' | 'sent';
type ComposeScope = 'all_tenants' | 'company_tenants' | 'manual' | 'property_tenants' | 'service_contacts';
type DeliveryMode = 'both' | 'email' | 'letter';
type ComposeRecipient = {
  companyId: string;
  contactId?: string;
  email: string;
  recipientType: 'contact' | 'email' | 'tenant';
  tenantId: string;
};
type ManualRecipientRow = {
  email: string;
  propertyId: string;
  tenantId: string;
};
type ServiceRecipientRow = {
  companyId: string;
  contactId: string;
  email: string;
};

type MailboxSettingsResponse = {
  ok?: boolean;
  settings?: {
    inboxEmail?: string;
  };
};

const tabs: Array<{ key: MailboxTab; label: string }> = [
  { key: 'inbox', label: 'Posteingang' },
  { key: 'archive', label: 'Alte Nachrichten' },
  { key: 'compose', label: 'Mail senden' },
  { key: 'sent', label: 'Gesendet' },
];

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readCollection(
  name: string,
  onError: (message: string) => void,
  setState: (value: WorkflowRecord[]) => void
) {
  return onSnapshot(
    query(collection(db, name)),
    (snapshot) => setState(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id }))),
    (caughtError) => {
      console.error(`Fehler beim Laden von ${name}:`, caughtError);
      onError(`Daten aus ${name} konnten nicht geladen werden.`);
    }
  );
}

function TabButton({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? 'border border-stone-200 bg-[linear-gradient(180deg,rgba(255,250,240,0.94)_0%,rgba(244,236,224,0.92)_100%)] text-slate-950 shadow-[0_18px_40px_-32px_rgba(148,119,77,0.45)]'
          : 'border border-stone-300 bg-white text-slate-700 hover:border-stone-400'
      }`}
      href={href}
      scroll={false}
    >
      {label}
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-sm leading-7 text-slate-600">
      {text}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">{children}</p>;
}

function Input({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="block">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <input
        className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs text-slate-900 outline-none transition focus:border-amber-700/60"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function Select({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="block">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <select
        className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs text-slate-900 outline-none transition focus:border-amber-700/60"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
  tone = 'default',
}: {
  children: string;
  disabled?: boolean;
  onClick: () => void;
  tone?: 'default' | 'solid';
}) {
  return (
    <button
      className={`rounded-full px-4 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === 'solid'
          ? 'bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] text-stone-100 hover:brightness-105'
          : 'border border-stone-300 bg-white text-slate-700 hover:border-stone-400'
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function buildTenantLabel(record: WorkflowRecord) {
  return (
    [cleanText(record.data.lastName), cleanText(record.data.firstName)].filter(Boolean).join(', ') ||
    cleanText(record.data.companyName) ||
    cleanText(record.data.email) ||
    record.id
  );
}

function buildServiceLabel(record: WorkflowRecord) {
  return (
    [cleanText(record.data.lastName), cleanText(record.data.firstName)].filter(Boolean).join(', ') ||
    cleanText(record.data.partnerCompanyName) ||
    cleanText(record.data.companyName) ||
    cleanText(record.data.name) ||
    cleanText(record.data.email) ||
    record.id
  );
}

function InlineLabelButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-stone-300 bg-white text-[11px] font-medium text-slate-700 transition hover:border-stone-400"
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function buildRecipientSignature(
  companies: WorkflowRecord[],
  companyId: string,
  fallbackCompanyId?: string
) {
  const company =
    companies.find((entry) => entry.id === companyId) ??
    companies.find((entry) => entry.id === cleanText(fallbackCompanyId)) ??
    null;
  return createSignatureRecord((company?.data as Record<string, unknown>) ?? null);
}

function buildAddressLine(parts: Array<unknown>) {
  return parts.map((entry) => cleanText(entry)).filter(Boolean).join(' ');
}

function buildAddressBlock(lines: Array<unknown>) {
  return lines.map((entry) => cleanText(entry)).filter(Boolean).join('\n');
}

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase('de-DE')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

function subjectNeedsMeters(subject: string) {
  const normalized = normalizeText(subject);
  return ['zahler', 'zaehler', 'ablesung', 'tausch', 'wechsel'].some((keyword) =>
    normalized.includes(keyword)
  );
}

function stripTrailingSignature(body: string, signatureText: string) {
  if (!signatureText) return body.trim();
  const trimmedBody = body.trimEnd();
  if (!trimmedBody.endsWith(signatureText)) return trimmedBody;
  return trimmedBody.slice(0, trimmedBody.length - signatureText.length).trimEnd();
}

export default function MessagesWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const currentTab = (searchParams.get('tab') as MailboxTab) || 'inbox';

  const [messages, setMessages] = useState<WorkflowRecord[]>([]);
  const [tenants, setTenants] = useState<WorkflowRecord[]>([]);
  const [properties, setProperties] = useState<WorkflowRecord[]>([]);
  const [people, setPeople] = useState<WorkflowRecord[]>([]);
  const [companies, setCompanies] = useState<WorkflowRecord[]>([]);
  const [search, setSearch] = useState('');
  const [composeScope, setComposeScope] = useState<ComposeScope>('manual');
  const [composeDeliveryMode, setComposeDeliveryMode] = useState<DeliveryMode>('email');
  const [composeLetterRecipientKey, setComposeLetterRecipientKey] = useState('property');
  const [composeRecipientEmail, setComposeRecipientEmail] = useState('');
  const [composeContactId, setComposeContactId] = useState('');
  const [composeTenantId, setComposeTenantId] = useState('');
  const [composeCompanyId, setComposeCompanyId] = useState('');
  const [composePropertyId, setComposePropertyId] = useState('');
  const [extraManualRecipients, setExtraManualRecipients] = useState<ManualRecipientRow[]>([]);
  const [extraServiceRecipients, setExtraServiceRecipients] = useState<ServiceRecipientRow[]>([]);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeAiInstruction, setComposeAiInstruction] = useState('');
  const [composeFollowUpDate, setComposeFollowUpDate] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isGeneratingComposeAiDraft, setIsGeneratingComposeAiDraft] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const unsubscribers = [
      readCollection('messages', setError, setMessages),
      readCollection('tenants', setError, setTenants),
      readCollection('properties', setError, setProperties),
      readCollection('people', setError, setPeople),
      readCollection('companies', setError, setCompanies),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    authorizedFetch('/api/admin/mailbox-settings')
      .then(async (response) => {
        const result = (await response.json()) as MailboxSettingsResponse;
        if (!cancelled && response.ok && result.ok) {
          setSenderEmail(cleanText(result.settings?.inboxEmail));
        }
      })
      .catch((caughtError) => {
        console.error('Fehler beim Laden der Mailbox-Einstellungen:', caughtError);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const inboxMessages = useMemo(
    () =>
      messages
        .filter((record) => cleanText(record.data.direction || 'inbound') === 'inbound')
        .filter((record) => !['deleted', 'done', 'ticket_created'].includes(cleanText(record.data.status)))
        .sort(
          (left, right) =>
            formatTimestampSort(right.data.receivedAt ?? right.data.createdAt) -
            formatTimestampSort(left.data.receivedAt ?? left.data.createdAt)
        ),
    [messages]
  );

  const sentMessages = useMemo(
    () =>
      messages
        .filter((record) => cleanText(record.data.direction) === 'outbound')
        .sort(
          (left, right) =>
            formatTimestampSort(right.data.sentAt ?? right.data.createdAt) -
            formatTimestampSort(left.data.sentAt ?? left.data.createdAt)
        ),
    [messages]
  );

  const archivedMessages = useMemo(
    () =>
      messages
        .filter((record) => cleanText(record.data.direction || 'inbound') === 'inbound')
        .filter((record) => ['done', 'ticket_created'].includes(cleanText(record.data.status)))
        .sort(
          (left, right) =>
            formatTimestampSort(right.data.receivedAt ?? right.data.createdAt) -
            formatTimestampSort(left.data.receivedAt ?? left.data.createdAt)
        ),
    [messages]
  );

  const filteredInbox = useMemo(() => {
    const needle = search.toLocaleLowerCase('de-DE').trim();
    if (!needle) return inboxMessages;
    return inboxMessages.filter((record) =>
      [
        cleanText(record.data.fromName),
        cleanText(record.data.fromEmail),
        cleanText(record.data.subject),
        cleanText(record.data.bodyText),
      ]
        .join(' ')
        .toLocaleLowerCase('de-DE')
        .includes(needle)
    );
  }, [inboxMessages, search]);

  const availableTenantsForProperty = useMemo(
    () => tenants.filter((tenant) => cleanText(tenant.data.propertyId) === composePropertyId),
    [composePropertyId, tenants]
  );

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === composeTenantId) ?? null,
    [composeTenantId, tenants]
  );

  const selectedContact = useMemo(
    () => people.find((person) => person.id === composeContactId) ?? null,
    [composeContactId, people]
  );
  const manualRecipientRows = useMemo<ManualRecipientRow[]>(
    () => [
      { email: composeRecipientEmail, propertyId: composePropertyId, tenantId: composeTenantId },
      ...extraManualRecipients,
    ],
    [composePropertyId, composeRecipientEmail, composeTenantId, extraManualRecipients]
  );
  const serviceRecipientRows = useMemo<ServiceRecipientRow[]>(
    () => [
      { companyId: composeCompanyId, contactId: composeContactId, email: composeRecipientEmail },
      ...extraServiceRecipients,
    ],
    [composeCompanyId, composeContactId, composeRecipientEmail, extraServiceRecipients]
  );

  const manualRecipientSignature = useMemo(() => {
    const selectedProperty = properties.find((property) => property.id === composePropertyId) ?? null;
    const inferredCompanyId =
      cleanText(selectedTenant?.data.companyId) ||
      cleanText(selectedProperty?.data.ownerId) ||
      composeCompanyId;
    return buildRecipientSignature(companies, inferredCompanyId, composeCompanyId);
  }, [companies, composeCompanyId, composePropertyId, composeTenantId, properties, selectedTenant]);
  const composePreviewSignature = useMemo(() => {
    if (composeScope === 'manual' || composeScope === 'service_contacts') {
      return manualRecipientSignature;
    }
    if (composeScope === 'property_tenants') {
      const propertyRecord = properties.find((property) => property.id === composePropertyId) ?? null;
      return buildRecipientSignature(
        companies,
        cleanText(propertyRecord?.data.ownerId),
        composeCompanyId
      );
    }
    return buildRecipientSignature(companies, composeCompanyId, composeCompanyId);
  }, [
    companies,
    composeCompanyId,
    composePropertyId,
    composeScope,
    manualRecipientSignature,
    properties,
  ]);
  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === composePropertyId) ?? null,
    [composePropertyId, properties]
  );
  const composePreviewRecipient = useMemo(() => {
    if (composeScope === 'service_contacts') {
      return {
        address: buildAddressBlock([
          buildAddressLine([selectedContact?.data.street, selectedContact?.data.houseNumber]),
          buildAddressLine([selectedContact?.data.postalCode, selectedContact?.data.city]),
        ]),
        company: cleanText(selectedContact?.data.partnerCompanyName) || cleanText(selectedContact?.data.companyName),
        name:
          [cleanText(selectedContact?.data.firstName), cleanText(selectedContact?.data.lastName)]
            .filter(Boolean)
            .join(' ') || cleanText(selectedContact?.data.name),
      };
    }

    return {
      address: buildAddressBlock([
        buildAddressLine([selectedProperty?.data.street, selectedProperty?.data.houseNumber]),
        buildAddressLine([selectedProperty?.data.postalCode, selectedProperty?.data.city]),
      ]),
      company: cleanText(selectedTenant?.data.companyName),
      name: selectedTenant ? buildTenantLabel(selectedTenant) : '',
    };
  }, [composeScope, selectedContact, selectedProperty, selectedTenant]);

  const composeRecipientOptions = useMemo(() => {
    if (composeScope === 'service_contacts') {
      return [];
    }

    const propertyRecipient = {
      address: buildAddressBlock([
        buildAddressLine([selectedProperty?.data.street, selectedProperty?.data.houseNumber]),
        buildAddressLine([selectedProperty?.data.postalCode, selectedProperty?.data.city]),
      ]),
      company: cleanText(selectedTenant?.data.companyName),
      name: selectedTenant ? buildTenantLabel(selectedTenant) : '',
    };

    const companyRecipient = {
      address: buildAddressBlock([
        buildAddressLine([selectedTenant?.data.companyStreet, selectedTenant?.data.companyHouseNumber]),
        buildAddressLine([selectedTenant?.data.companyPostalCode, selectedTenant?.data.companyCity]),
      ]),
      company: cleanText(selectedTenant?.data.companyName),
      name:
        cleanText(selectedTenant?.data.companyContactName) ||
        (selectedTenant ? buildTenantLabel(selectedTenant) : ''),
    };

    const options = [
      {
        description: propertyRecipient.address,
        key: 'property',
        label: 'Objektadresse',
        recipient: propertyRecipient,
      },
    ];

    if (companyRecipient.address) {
      options.push({
        description: companyRecipient.address,
        key: 'company',
        label: 'Firmenadresse / Zentrale',
        recipient: companyRecipient,
      });
    }

    return options;
  }, [composeScope, selectedProperty, selectedTenant]);

  const selectedComposeLetterRecipient =
    composeRecipientOptions.find((option) => option.key === composeLetterRecipientKey)?.recipient ??
    composePreviewRecipient;

  useEffect(() => {
    const defaultKey =
      composeScope !== 'service_contacts' && composeRecipientOptions.some((option) => option.key === 'company')
        ? 'company'
        : 'property';
    setComposeLetterRecipientKey((current) =>
      composeRecipientOptions.some((option) => option.key === current) ? current : defaultKey
    );
  }, [composeRecipientOptions, composeScope, composeTenantId]);

  const selectedUnit = useMemo(() => {
    if (!selectedProperty || !selectedTenant) return null;
    const units = Array.isArray(selectedProperty.data.units) ? (selectedProperty.data.units as DocumentData[]) : [];
    return units.find((unit) => cleanText(unit.id) === cleanText(selectedTenant.data.unitId)) ?? null;
  }, [selectedProperty, selectedTenant]);

  const meterOptions = useMemo(() => {
    const propertyMeters = Array.isArray(selectedProperty?.data.meters)
      ? (selectedProperty.data.meters as DocumentData[])
      : [];
    const unitMeters = Array.isArray(selectedUnit?.meters) ? (selectedUnit.meters as DocumentData[]) : [];
    const seen = new Set<string>();

    return [...unitMeters, ...propertyMeters]
      .map((meter, index) => {
        const id = cleanText(meter.id) || `meter-${index}`;
        if (!id || seen.has(id)) return null;
        seen.add(id);
        return {
          id,
          label:
            [cleanText(meter.label || meter.type), cleanText(meter.meterNumber)]
              .filter(Boolean)
              .join(' · ') || id,
        };
      })
      .filter((entry): entry is { id: string; label: string } => Boolean(entry));
  }, [selectedProperty, selectedUnit]);

  const selectedMetersSummary = useMemo(() => {
    if (!subjectNeedsMeters(composeSubject)) return [];
    return meterOptions.map((meter) => meter.label);
  }, [composeSubject, meterOptions]);

  const composeRecipients = useMemo<ComposeRecipient[]>(() => {
    const includeRecipient = (entry: ComposeRecipient) =>
      composeDeliveryMode === 'letter'
        ? Boolean(entry.tenantId || entry.contactId || entry.email)
        : Boolean(entry.email);

    if (composeScope === 'manual') {
      return manualRecipientRows
        .map((row) => {
          const tenantRecord = tenants.find((tenant) => tenant.id === row.tenantId) ?? null;
          return {
            companyId: cleanText(tenantRecord?.data.companyId) || composeCompanyId,
            contactId: '',
            email: cleanText(tenantRecord?.data.email) || cleanText(row.email),
            recipientType: tenantRecord ? ('tenant' as const) : ('email' as const),
            tenantId: tenantRecord?.id || '',
          };
        })
        .filter(includeRecipient);
    }

    if (composeScope === 'service_contacts') {
      return serviceRecipientRows
        .map((row) => {
          const contactRecord = people.find((person) => person.id === row.contactId) ?? null;
          return {
            companyId: cleanText(row.companyId),
            contactId: contactRecord?.id || '',
            email: cleanText(contactRecord?.data.email) || cleanText(row.email),
            recipientType: contactRecord ? ('contact' as const) : ('email' as const),
            tenantId: '',
          };
        })
        .filter(includeRecipient);
    }

    if (composeScope === 'all_tenants') {
      return tenants
        .map((tenant) => ({
          companyId: cleanText(tenant.data.companyId),
          contactId: '',
          email: cleanText(tenant.data.email),
          recipientType: 'tenant' as const,
          tenantId: tenant.id,
        }))
        .filter(includeRecipient);
    }

    if (composeScope === 'company_tenants') {
      const propertyIdsForCompany = properties
        .filter((property) => cleanText(property.data.ownerId) === composeCompanyId)
        .map((property) => property.id);
      return tenants
        .filter(
          (tenant) =>
            cleanText(tenant.data.companyId) === composeCompanyId ||
            propertyIdsForCompany.includes(cleanText(tenant.data.propertyId))
        )
        .map((tenant) => ({
          companyId: composeCompanyId,
          contactId: '',
          email: cleanText(tenant.data.email),
          recipientType: 'tenant' as const,
          tenantId: tenant.id,
        }))
        .filter(includeRecipient);
    }

    if (composeScope === 'property_tenants') {
      const selectedProperty = properties.find((property) => property.id === composePropertyId) ?? null;
      const fallbackCompanyId = cleanText(selectedProperty?.data.ownerId);
      return tenants
        .filter((tenant) => cleanText(tenant.data.propertyId) === composePropertyId)
        .map((tenant) => ({
          companyId: cleanText(tenant.data.companyId) || fallbackCompanyId,
          contactId: '',
          email: cleanText(tenant.data.email),
          recipientType: 'tenant' as const,
          tenantId: tenant.id,
        }))
        .filter(includeRecipient);
    }

    return [];
  }, [
    composeCompanyId,
    composeDeliveryMode,
    composeScope,
    manualRecipientRows,
    properties,
    serviceRecipientRows,
    tenants,
    people,
  ]);

  function buildTabHref(tab: MailboxTab) {
    return tab === 'inbox' ? pathname : `${pathname}?tab=${tab}`;
  }

  async function authorizedFetch(url: string, init?: RequestInit) {
    if (!user) {
      throw new Error('Du bist nicht angemeldet.');
    }

    const token = await user.getIdToken();
    return fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
  }

  function runAction(action: () => Promise<void>) {
    setMessage('');
    setError('');
    startTransition(async () => {
      try {
        await action();
      } catch (caughtError) {
        console.error('Fehler im Nachrichtenbereich:', caughtError);
        setError(
          caughtError instanceof Error ? caughtError.message : 'Die Aktion konnte nicht ausgeführt werden.'
        );
      }
    });
  }

  function resetCompose() {
    setComposeAiInstruction('');
    setComposeBody('');
    setComposeContactId('');
    setComposeDeliveryMode('email');
    setExtraManualRecipients([]);
    setExtraServiceRecipients([]);
    setComposeFollowUpDate('');
    setComposeRecipientEmail('');
    setComposeSubject('');
    setComposeTenantId('');
    setComposePropertyId('');
    setComposeCompanyId('');
  }

  function addManualRecipientRow() {
    setExtraManualRecipients((current) => [...current, { email: '', propertyId: '', tenantId: '' }]);
  }

  function updateManualRecipientRow(index: number, nextValue: Partial<ManualRecipientRow>) {
    setExtraManualRecipients((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...nextValue } : entry
      )
    );
  }

  function removeManualRecipientRow(index: number) {
    setExtraManualRecipients((current) => current.filter((_, entryIndex) => entryIndex !== index));
  }

  function addServiceRecipientRow() {
    setExtraServiceRecipients((current) => [...current, { companyId: '', contactId: '', email: '' }]);
  }

  function updateServiceRecipientRow(index: number, nextValue: Partial<ServiceRecipientRow>) {
    setExtraServiceRecipients((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...nextValue } : entry
      )
    );
  }

  function removeServiceRecipientRow(index: number) {
    setExtraServiceRecipients((current) => current.filter((_, entryIndex) => entryIndex !== index));
  }

  async function createLetterHistoryMessage({
    propertyId,
    recipient,
    signature,
    subject,
    unitId,
  }: {
    propertyId?: string;
    recipient: ComposeRecipient;
    signature: SignatureRecord;
    subject: string;
    unitId?: string;
  }) {
    const baseBody = cleanText(composeBody);
    const portalBody = [baseBody, buildPortalSignatureText(signature)].filter(Boolean).join('\n\n');
    const tenantRecord = recipient.tenantId
      ? tenants.find((entry) => entry.id === recipient.tenantId) ?? null
      : null;
    const contactRecord = recipient.contactId
      ? people.find((entry) => entry.id === recipient.contactId) ?? null
      : null;
    const propertyRecord = properties.find((entry) => entry.id === cleanText(propertyId)) ?? null;
    const letterRecipient =
      recipient.recipientType === 'contact'
        ? {
            address: buildAddressBlock([
              buildAddressLine([contactRecord?.data.street, contactRecord?.data.houseNumber]),
              buildAddressLine([contactRecord?.data.postalCode, contactRecord?.data.city]),
            ]),
            company:
              cleanText(contactRecord?.data.partnerCompanyName) || cleanText(contactRecord?.data.companyName),
            name:
              [cleanText(contactRecord?.data.firstName), cleanText(contactRecord?.data.lastName)]
                .filter(Boolean)
                .join(' ') || cleanText(contactRecord?.data.name),
          }
        : {
            address:
              selectedComposeLetterRecipient.address ||
              buildAddressBlock([
                buildAddressLine([propertyRecord?.data.street, propertyRecord?.data.houseNumber]),
                buildAddressLine([propertyRecord?.data.postalCode, propertyRecord?.data.city]),
              ]),
            company:
              selectedComposeLetterRecipient.company || cleanText(tenantRecord?.data.companyName),
            name:
              selectedComposeLetterRecipient.name || (tenantRecord ? buildTenantLabel(tenantRecord) : ''),
          };

    const letterHtml = buildLetterHtml({
      body: baseBody,
      context: {
        propertyName: cleanText(propertyRecord?.data.name),
        unitLabel: cleanText(tenantRecord?.data.unitLabel),
      },
      recipient: letterRecipient,
      signature,
      subject,
    });

    await addDoc(collection(db, 'messages'), {
      attachments: [],
      bodyHtml: letterHtml,
      bodyText: portalBody,
      category: '',
      channel: 'letter',
      createdAt: serverTimestamp(),
      draftKind: 'letter',
      direction: 'outbound',
      fromEmail: senderEmail || 'portal@halbmann-holding.de',
      fromName: 'Halbmann Holding',
      priority: 'normal',
      propertyId: cleanText(propertyId),
      receivedAt: serverTimestamp(),
      recipientId: recipient.tenantId || null,
      recipientType: recipient.recipientType,
      status: 'sent',
      subject,
      tenantId: recipient.tenantId || '',
      toEmail: recipient.email,
      unitId: cleanText(unitId),
      updatedAt: serverTimestamp(),
      letterText: buildLetterText(baseBody, signature),
    });

    printLetterHtml(letterHtml, subject || 'Brief');
  }

  async function createChatHistoryMessage({
    propertyId,
    recipient,
    signature,
    subject,
    unitId,
  }: {
    propertyId?: string;
    recipient: ComposeRecipient;
    signature: SignatureRecord;
    subject: string;
    unitId?: string;
  }) {
    const baseBody = cleanText(composeBody);
    const portalBody = [baseBody, buildPortalSignatureText(signature)].filter(Boolean).join('\n\n');

    await addDoc(collection(db, 'messages'), {
      attachments: [],
      bodyText: portalBody,
      category: '',
      channel: 'portal',
      createdAt: serverTimestamp(),
      direction: 'outbound',
      fromEmail: senderEmail || 'portal@halbmann-holding.de',
      fromName: 'Halbmann Holding',
      priority: 'normal',
      propertyId: cleanText(propertyId),
      receivedAt: serverTimestamp(),
      recipientId: recipient.tenantId || recipient.contactId || null,
      recipientType: recipient.recipientType,
      status: 'sent',
      subject,
      tenantId: recipient.tenantId || '',
      toEmail: recipient.email,
      unitId: cleanText(unitId),
      updatedAt: serverTimestamp(),
    });
  }

  function permanentlyDeleteMessage(record: WorkflowRecord) {
    runAction(async () => {
      const externalMessageId = cleanText(record.data.messageId);
      const externalMessageKey =
        cleanText(record.data.externalMessageKey) ||
        buildExternalMessageKey({
          fromEmail: record.data.fromEmail,
          receivedAt: record.data.receivedAt ?? record.data.createdAt,
          subject: record.data.subject,
          text: record.data.bodyText,
        });
      if (externalMessageId) {
        await addDoc(collection(db, 'deletedMessages'), {
          createdAt: serverTimestamp(),
          externalMessageKey,
          messageId: externalMessageId,
          originalMessageDocId: record.id,
        });
      } else if (externalMessageKey) {
        await addDoc(collection(db, 'deletedMessages'), {
          createdAt: serverTimestamp(),
          externalMessageKey,
          originalMessageDocId: record.id,
        });
      }
      await deleteDoc(doc(db, 'messages', record.id));
      setMessage('Nachricht wurde endgültig gelöscht.');
    });
  }

  async function sendMessageNow() {
    if (!composeRecipients.length || !cleanText(composeBody)) {
      setError('Bitte wähle Empfänger und Nachricht aus.');
      return;
    }
    if (
      (composeDeliveryMode === 'letter' || composeDeliveryMode === 'both') &&
      composeScope === 'manual' &&
      !selectedTenant
    ) {
      setError('Für Briefe bitte einen Mieter auswählen, damit der Vorgang sauber zugeordnet werden kann.');
      return;
    }
    if (
      (composeDeliveryMode === 'letter' || composeDeliveryMode === 'both') &&
      composeScope === 'service_contacts' &&
      !selectedContact
    ) {
      setError('Für Briefe an Dienstleister bitte einen Dienstleister auswählen.');
      return;
    }

    runAction(async () => {
      const bodyWithoutManualSignature = cleanText(composeBody);
      for (const recipient of composeRecipients) {
        const recipientSignature = buildRecipientSignature(companies, recipient.companyId, composeCompanyId);
        const tenantRecord = recipient.tenantId
          ? tenants.find((entry) => entry.id === recipient.tenantId) ?? null
          : null;
        const subject = cleanText(composeSubject) || 'Nachricht von Halbmann Holding';

        if (composeDeliveryMode === 'email' || composeDeliveryMode === 'both') {
          const finalBody = mergeBodyWithSignature(bodyWithoutManualSignature, recipientSignature);
          const draftRef = await addDoc(collection(db, 'messageDrafts'), {
            attachments: [],
            body: finalBody,
            createdAt: serverTimestamp(),
            kind: 'broadcast',
            messageId: null,
            propertyId: cleanText(tenantRecord?.data.propertyId),
            signature: recipientSignature,
            portalBodyText: bodyWithoutManualSignature,
            recipientEmail: recipient.email,
            recipientId: recipient.tenantId || recipient.contactId || null,
            recipientType: recipient.recipientType,
            status: 'draft',
            subject,
            ticketId: null,
            unitId: cleanText(tenantRecord?.data.unitId),
            updatedAt: serverTimestamp(),
          });

          const response = await authorizedFetch('/api/message-drafts/send', {
            body: JSON.stringify({ draftId: draftRef.id }),
            method: 'POST',
          });
          const result = (await response.json()) as { error?: string; ok?: boolean };
          if (!response.ok || !result.ok) {
            throw new Error(result.error || 'Die Nachricht konnte nicht versendet werden.');
          }
        }

        if (composeDeliveryMode === 'both') {
          await createChatHistoryMessage({
            propertyId: cleanText(tenantRecord?.data.propertyId),
            recipient,
            signature: recipientSignature,
            subject,
            unitId: cleanText(tenantRecord?.data.unitId),
          });
        }

        if (composeDeliveryMode === 'letter') {
          await createLetterHistoryMessage({
            propertyId: cleanText(tenantRecord?.data.propertyId),
            recipient,
            signature: recipientSignature,
            subject,
            unitId: cleanText(tenantRecord?.data.unitId),
          });
        }
        if (cleanText(composeFollowUpDate) && (recipient.tenantId || recipient.contactId)) {
          await addDoc(collection(db, 'followUps'), {
            createdAt: serverTimestamp(),
            dueDate: composeFollowUpDate,
            message: 'Rückmeldung auf gesendete Nachricht prüfen',
            propertyId: cleanText(tenantRecord?.data.propertyId),
            status: 'open',
            targetId: recipient.tenantId || recipient.contactId || '',
            targetType: recipient.tenantId ? 'tenant' : recipient.contactId ? 'contact' : 'email',
            ticketId: '',
            unitId: cleanText(tenantRecord?.data.unitId),
          });
        }
      }

      resetCompose();
      setMessage(
        composeDeliveryMode === 'both'
          ? 'Mail und Chat wurden verarbeitet.'
          : composeDeliveryMode === 'letter'
            ? 'Brief wurde im Verlauf erfasst.'
            : 'Nachricht wurde versendet.'
      );
      router.push(`${pathname}?tab=sent`);
    });
  }

  async function generateComposeAiDraft() {
    if (composeRecipients.length === 0 && composeScope !== 'manual') {
      setError('Bitte wähle zuerst Empfänger aus.');
      return;
    }

    if (composeScope === 'manual' && !selectedTenant && !cleanText(composeRecipientEmail)) {
      setError('Bitte wähle zuerst einen Mieter oder eine E-Mail-Adresse aus.');
      return;
    }

    if (composeScope === 'service_contacts' && !selectedContact && !cleanText(composeRecipientEmail)) {
      setError('Bitte wähle zuerst einen Dienstleister oder eine E-Mail-Adresse aus.');
      return;
    }

    setMessage('');
    setError('');
    setIsGeneratingComposeAiDraft(true);

    try {
      const selectedCompany =
        companies.find((company) => company.id === composeCompanyId) ??
        companies.find((company) => company.id === cleanText(selectedProperty?.data.ownerId)) ??
        companies.find((company) => company.id === cleanText(selectedTenant?.data.companyId)) ??
        null;

      const response = await authorizedFetch('/api/ai/message-draft', {
        method: 'POST',
        body: JSON.stringify({
          companyName: cleanText(selectedCompany?.data.name),
          currentBody: cleanText(composeBody),
          instruction: composeAiInstruction,
          meters: selectedMetersSummary,
          propertyName: cleanText(selectedProperty?.data.name),
          recipientCount: composeRecipients.length || (composeScope === 'manual' ? 1 : 0),
          recipientEmail:
            composeScope === 'manual'
              ? cleanText(selectedTenant?.data.email) || cleanText(composeRecipientEmail)
              : composeScope === 'service_contacts'
                ? cleanText(selectedContact?.data.email) || cleanText(composeRecipientEmail)
              : '',
          recipientName:
            composeScope === 'manual' && selectedTenant ? buildTenantLabel(selectedTenant) : '',
          senderEmail: senderEmail || 'portal@halbmann-holding.de',
          scope: composeScope,
          subject: cleanText(composeSubject),
        }),
      });

      const result = (await response.json()) as { draftText?: string; error?: string; ok?: boolean };
      if (!response.ok || !result.ok || !result.draftText) {
        throw new Error(result.error || 'Der KI-Entwurf konnte nicht erzeugt werden.');
      }

      let nextComposeBody = '';

      if (composeScope === 'manual') {
        const greeting = buildRecipientGreeting({
          recipientName: selectedTenant ? buildTenantLabel(selectedTenant) : '',
          recipientSalutation:
            cleanText(selectedTenant?.data.salutation) ||
            cleanText(selectedTenant?.data.anrede) ||
            (cleanText(selectedTenant?.data.gender).toLocaleLowerCase('de-DE').startsWith('w')
              ? 'Frau'
              : cleanText(selectedTenant?.data.gender).toLocaleLowerCase('de-DE').startsWith('m')
                ? 'Herr'
                : ''),
        });
        nextComposeBody = [greeting, stripAiEnvelope(result.draftText)].filter(Boolean).join('\n\n').trim();
      } else if (composeScope === 'service_contacts') {
        const greeting = buildRecipientGreeting({
          recipientName: selectedContact ? buildServiceLabel(selectedContact) : '',
          recipientSalutation: '',
        });
        nextComposeBody = [greeting, stripAiEnvelope(result.draftText)].filter(Boolean).join('\n\n').trim();
      } else {
        nextComposeBody = stripAiEnvelope(result.draftText);
      }

      if (composeDeliveryMode === 'letter') {
        nextComposeBody =
          stripTrailingSignature(nextComposeBody, buildPortalSignatureText(composePreviewSignature)) ||
          stripAiEnvelope(result.draftText);
      }
      setComposeBody(nextComposeBody);
      setMessage('KI-Entwurf wurde erzeugt.');
    } catch (caughtError) {
      console.error('Fehler bei KI-Mailentwurf:', caughtError);
      setError(caughtError instanceof Error ? caughtError.message : 'Der KI-Entwurf konnte nicht erzeugt werden.');
    } finally {
      setIsGeneratingComposeAiDraft(false);
    }
  }

  function renderInbox() {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white shadow-[0_28px_70px_-42px_rgba(148,119,77,0.28)]">
        <div className="flex flex-wrap items-center justify-end gap-4 border-b border-stone-200 px-6 py-4">
          <input
            className="w-full max-w-[360px] rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nach Absender, Objekt oder Inhalt suchen"
            type="search"
            value={search}
          />
        </div>

        <div className="divide-y divide-stone-200">
          {filteredInbox.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState text="Im Posteingang liegen aktuell keine offenen Nachrichten." />
            </div>
          ) : (
            filteredInbox.map((record) => {
              const sender = cleanText(record.data.fromName || record.data.fromEmail) || 'Unbekannter Absender';
              const subject = cleanText(record.data.subject) || 'Ohne Betreff';
              const preview = cleanText(record.data.bodyText).replace(/\s+/g, ' ');
              const status = cleanText(record.data.status);
              return (
                <div
                  className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto_auto] items-center gap-4 px-6 py-4 transition hover:bg-stone-50"
                  key={record.id}
                >
                  <Link className="min-w-0" href={`/admin/nachrichten/${record.id}`}>
                    <p className="truncate text-sm font-semibold text-slate-950">{sender}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {formatDateTime(record.data.receivedAt ?? record.data.createdAt)}
                    </p>
                  </Link>
                  <Link className="min-w-0" href={`/admin/nachrichten/${record.id}`}>
                    <p className="truncate text-sm text-slate-900">
                      {subject}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {preview || 'Keine Vorschau vorhanden.'}
                    </p>
                  </Link>
                  <span className="justify-self-end rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-slate-600">
                    {status === 'needs_review' ? 'Zu prüfen' : 'Neu'}
                  </span>
                  <p className="whitespace-nowrap text-xs text-slate-500">{cleanText(record.data.channel) || 'Posteingang'}</p>
                </div>
              );
            })
          )}
        </div>
      </section>
    );
  }

  function renderCompose() {
    const composeScopeOptions: Array<{ key: ComposeScope; label: string }> = [
      { key: 'manual', label: 'Einzelne Empfänger' },
      { key: 'service_contacts', label: 'Dienstleister' },
      { key: 'property_tenants', label: 'Alle Mieter eines Objekts' },
      { key: 'company_tenants', label: 'Alle Mieter einer Firma' },
      { key: 'all_tenants', label: 'Alle Mieter' },
    ];

    return (
      <div>
        <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_28px_70px_-42px_rgba(148,119,77,0.28)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <SectionLabel>Mail senden</SectionLabel>
              <h2 className="mt-2 text-xl text-slate-950">Neue Nachricht</h2>
            </div>
            <div className="flex min-w-[520px] flex-wrap items-end justify-end gap-3">
              <label className="block min-w-[180px]">
                <p className="text-right text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">
                  Versand
                </p>
                <select
                  className="mt-2 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-xs text-slate-900 outline-none transition focus:border-amber-700/60"
                  onChange={(event) => setComposeDeliveryMode(event.target.value as DeliveryMode)}
                  value={composeDeliveryMode}
                >
                  <option value="email">Mail</option>
                  <option value="letter">Brief</option>
                  <option value="both">Beides</option>
                </select>
              </label>
              <label className="block min-w-[260px]">
                <p className="text-right text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">
                  Empfänger
                </p>
                <select
                  className="mt-2 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-xs text-slate-900 outline-none transition focus:border-amber-700/60"
                  onChange={(event) => setComposeScope(event.target.value as ComposeScope)}
                  value={composeScope}
                >
                  {composeScopeOptions.map((entry) => (
                    <option key={entry.key} value={entry.key}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {composeScope === 'manual' ? (
              <>
                <label className="block">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Immobilie</p>
                    <InlineLabelButton label="+" onClick={addManualRecipientRow} />
                  </div>
                  <select
                    className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs text-slate-900 outline-none transition focus:border-amber-700/60"
                    onChange={(event) => {
                      setComposePropertyId(event.target.value);
                      setComposeTenantId('');
                    }}
                    value={composePropertyId}
                  >
                    <option value="">Immobilie wählen</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {cleanText(property.data.name) || property.id}
                      </option>
                    ))}
                  </select>
                </label>
                <Select
                  label="Mieter"
                  onChange={setComposeTenantId}
                  options={[
                    { label: 'Mieter wählen', value: '' },
                    ...availableTenantsForProperty.map((tenant) => ({
                      label: buildTenantLabel(tenant),
                      value: tenant.id,
                    })),
                  ]}
                  value={composeTenantId}
                />
                <Input
                  label="Oder E-Mail manuell"
                  onChange={setComposeRecipientEmail}
                  placeholder="name@example.de"
                  value={composeRecipientEmail}
                />
                {extraManualRecipients.map((row, index) => {
                  const rowTenants = tenants.filter(
                    (tenant) => cleanText(tenant.data.propertyId) === cleanText(row.propertyId)
                  );

                  return (
                    <div className="contents" key={`manual-row-${index}`}>
                      <label className="block">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">
                            Weitere Immobilie
                          </p>
                          <button
                            className="text-[11px] text-slate-500 transition hover:text-slate-900"
                            onClick={() => removeManualRecipientRow(index)}
                            type="button"
                          >
                            Entfernen
                          </button>
                        </div>
                        <select
                          className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs text-slate-900 outline-none transition focus:border-amber-700/60"
                          onChange={(event) =>
                            updateManualRecipientRow(index, {
                              propertyId: event.target.value,
                              tenantId: '',
                            })
                          }
                          value={row.propertyId}
                        >
                          <option value="">Immobilie wählen</option>
                          {properties.map((property) => (
                            <option key={property.id} value={property.id}>
                              {cleanText(property.data.name) || property.id}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Select
                        label="Weiterer Mieter"
                        onChange={(value) => updateManualRecipientRow(index, { tenantId: value })}
                        options={[
                          { label: 'Mieter wählen', value: '' },
                          ...rowTenants.map((tenant) => ({
                            label: buildTenantLabel(tenant),
                            value: tenant.id,
                          })),
                        ]}
                        value={row.tenantId}
                      />
                      <Input
                        label="Oder E-Mail manuell"
                        onChange={(value) => updateManualRecipientRow(index, { email: value })}
                        placeholder="name@example.de"
                        value={row.email}
                      />
                    </div>
                  );
                })}
              </>
            ) : null}

            {composeScope === 'service_contacts' ? (
              <>
                <label className="block">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Firma</p>
                    <InlineLabelButton label="+" onClick={addServiceRecipientRow} />
                  </div>
                  <select
                    className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs text-slate-900 outline-none transition focus:border-amber-700/60"
                    onChange={(event) => setComposeCompanyId(event.target.value)}
                    value={composeCompanyId}
                  >
                    <option value="">Firma wählen</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {cleanText(company.data.name) || company.id}
                      </option>
                    ))}
                  </select>
                </label>
                <Select
                  label="Dienstleister"
                  onChange={setComposeContactId}
                  options={[
                    { label: 'Dienstleister wählen', value: '' },
                    ...people
                      .filter((person) => cleanText(person.data.email))
                      .sort((left, right) =>
                        buildServiceLabel(left).localeCompare(buildServiceLabel(right), 'de')
                      )
                      .map((person) => ({
                        label: buildServiceLabel(person),
                        value: person.id,
                      })),
                  ]}
                  value={composeContactId}
                />
                <Input
                  label="Oder E-Mail manuell"
                  onChange={setComposeRecipientEmail}
                  placeholder="name@example.de"
                  value={composeRecipientEmail}
                />
                {extraServiceRecipients.map((row, index) => (
                  <div className="contents" key={`service-row-${index}`}>
                    <label className="block">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">
                          Weitere Firma
                        </p>
                        <button
                          className="text-[11px] text-slate-500 transition hover:text-slate-900"
                          onClick={() => removeServiceRecipientRow(index)}
                          type="button"
                        >
                          Entfernen
                        </button>
                      </div>
                      <select
                        className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs text-slate-900 outline-none transition focus:border-amber-700/60"
                        onChange={(event) =>
                          updateServiceRecipientRow(index, {
                            companyId: event.target.value,
                            contactId: '',
                          })
                        }
                        value={row.companyId}
                      >
                        <option value="">Firma wählen</option>
                        {companies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {cleanText(company.data.name) || company.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Select
                      label="Weiterer Dienstleister"
                      onChange={(value) => updateServiceRecipientRow(index, { contactId: value })}
                      options={[
                        { label: 'Dienstleister wählen', value: '' },
                        ...people
                          .filter((person) => cleanText(person.data.email))
                          .sort((left, right) =>
                            buildServiceLabel(left).localeCompare(buildServiceLabel(right), 'de')
                          )
                          .map((person) => ({
                            label: buildServiceLabel(person),
                            value: person.id,
                          })),
                      ]}
                      value={row.contactId}
                    />
                    <Input
                      label="Oder E-Mail manuell"
                      onChange={(value) => updateServiceRecipientRow(index, { email: value })}
                      placeholder="name@example.de"
                      value={row.email}
                    />
                  </div>
                ))}
              </>
            ) : null}

            {composeScope === 'company_tenants' ? (
              <Select
                label="Firma"
                onChange={setComposeCompanyId}
                options={[
                  { label: 'Firma wählen', value: '' },
                  ...companies.map((company) => ({
                    label: cleanText(company.data.name) || company.id,
                    value: company.id,
                  })),
                ]}
                value={composeCompanyId}
              />
            ) : null}

            {composeScope === 'property_tenants' ? (
              <Select
                label="Immobilie"
                onChange={setComposePropertyId}
                options={[
                  { label: 'Immobilie wählen', value: '' },
                  ...properties.map((property) => ({
                    label: cleanText(property.data.name) || property.id,
                    value: property.id,
                  })),
                ]}
                value={composePropertyId}
              />
            ) : null}

            <Input label="Betreff" onChange={setComposeSubject} value={composeSubject} />
          </div>

          <div className="mt-4 flex w-full items-center gap-2">
            <ActionButton disabled={isPending || isGeneratingComposeAiDraft} onClick={generateComposeAiDraft}>
              {isGeneratingComposeAiDraft ? 'KI schreibt…' : 'KI-Entwurf'}
            </ActionButton>
            <div className="min-w-0 flex-1">
              <input
                className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs text-slate-900 outline-none transition focus:border-amber-700/60"
                onChange={(event) => setComposeAiInstruction(event.target.value)}
                placeholder="KI-Hinweis"
                value={composeAiInstruction}
              />
            </div>
            <ActionButton disabled={isPending || isGeneratingComposeAiDraft} onClick={generateComposeAiDraft}>
                Anwenden
            </ActionButton>
          </div>

          {selectedMetersSummary.length > 0 ? (
            <div className="mt-4 rounded-[18px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-slate-600">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Automatisch erkannte Zähler</p>
              <p className="mt-2">
                {selectedMetersSummary.join(' · ')}
              </p>
            </div>
          ) : null}

          {composeDeliveryMode === 'letter' ? (
            <LetterComposeEditor
              body={composeBody}
              className="mt-5 rounded-2xl border border-stone-300 bg-stone-50"
              onChange={setComposeBody}
              onRecipientChange={setComposeLetterRecipientKey}
              placeholder={
                composeScope === 'service_contacts'
                  ? 'Nachricht an den Dienstleister'
                  : 'Nachricht an den Mieter'
              }
              context={{
                propertyName: cleanText(selectedProperty?.data.name),
                unitLabel: cleanText(selectedUnit?.label),
              }}
              recipient={selectedComposeLetterRecipient}
              recipientOptions={composeScope === 'service_contacts' ? undefined : composeRecipientOptions}
              selectedRecipientKey={composeLetterRecipientKey}
              signature={composePreviewSignature}
              subject={cleanText(composeSubject) || 'Vorschau Firmenbrief'}
            />
          ) : (
            <label className="mt-5 block">
              <textarea
                className="min-h-[490px] w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-xs leading-6 text-slate-900 outline-none transition focus:border-amber-700/60"
                lang="de"
                onChange={(event) => setComposeBody(event.target.value)}
                placeholder={
                  composeScope === 'service_contacts'
                    ? 'Nachricht an den Dienstleister'
                    : 'Nachricht an den Mieter'
                }
                spellCheck={false}
                value={composeBody}
              />
            </label>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {(composeRecipients.length > 0 || composeScope === 'manual') ? (
              <label className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-2 text-xs text-slate-700">
                <span>Wiedervorlage</span>
                <input
                  className="bg-transparent text-xs text-slate-900 outline-none"
                  onChange={(event) => setComposeFollowUpDate(event.target.value)}
                  type="date"
                  value={composeFollowUpDate}
                />
              </label>
            ) : null}
            <ActionButton disabled={isPending} onClick={sendMessageNow} tone="solid">
              Senden
            </ActionButton>
          </div>

        </section>
      </div>
    );
  }

  function renderSimpleList(records: WorkflowRecord[], emptyText: string) {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white shadow-[0_28px_70px_-42px_rgba(148,119,77,0.28)]">
        <div className="divide-y divide-stone-200">
          {records.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState text={emptyText} />
            </div>
          ) : (
            records.map((record) => (
              <div className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] items-center gap-4 px-6 py-4 transition hover:bg-stone-50" key={record.id}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {cleanText(record.data.toEmail || record.data.subject) || 'Gesendete Nachricht'}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {formatDateTime(record.data.sentAt ?? record.data.receivedAt ?? record.data.createdAt)}
                  </p>
                </div>
                <p className="truncate text-sm text-slate-600">
                  {cleanText(record.data.subject || record.data.bodyText) || 'Ohne Inhalt'}
                </p>
                <span className="justify-self-end rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-slate-600">
                  {cleanText(record.data.channel) === 'letter'
                    ? 'Brief'
                    : cleanText(record.data.channel) === 'portal'
                      ? 'Chat'
                      : 'Gesendet'}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  function renderArchive() {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white shadow-[0_28px_70px_-42px_rgba(148,119,77,0.28)]">
        <div className="divide-y divide-stone-200">
          {archivedMessages.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState text="Noch keine alten Nachrichten vorhanden." />
            </div>
          ) : (
            archivedMessages.map((record) => {
              const sender = cleanText(record.data.fromName || record.data.fromEmail) || 'Unbekannter Absender';
              const subject = cleanText(record.data.subject) || 'Ohne Betreff';
              const preview = cleanText(record.data.bodyText).replace(/\s+/g, ' ');
              return (
                <div
                  className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto_auto] items-center gap-4 px-6 py-4 transition hover:bg-stone-50"
                  key={record.id}
                >
                  <Link className="min-w-0" href={`/admin/nachrichten/${record.id}`}>
                    <p className="truncate text-sm font-semibold text-slate-950">{sender}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {formatDateTime(record.data.receivedAt ?? record.data.createdAt)}
                    </p>
                  </Link>
                  <Link className="min-w-0" href={`/admin/nachrichten/${record.id}`}>
                    <p className="truncate text-sm text-slate-900">
                      {subject}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {preview || 'Keine Vorschau vorhanden.'}
                    </p>
                  </Link>
                  <span className="justify-self-end rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-slate-600">
                    Archiv
                  </span>
                  <button
                    className="rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-400"
                    onClick={() => permanentlyDeleteMessage(record)}
                    type="button"
                  >
                    Endgültig löschen
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>
    );
  }

  function renderContent() {
    if (currentTab === 'compose') return renderCompose();
    if (currentTab === 'archive') return renderArchive();
    if (currentTab === 'sent') return renderSimpleList(sentMessages, 'Noch keine gesendeten Nachrichten vorhanden.');
    return renderInbox();
  }

  return (
    <div className="space-y-3 pt-1">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <TabButton active={currentTab === tab.key} href={buildTabHref(tab.key)} key={tab.key} label={tab.label} />
        ))}
      </div>

      {renderContent()}

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}


