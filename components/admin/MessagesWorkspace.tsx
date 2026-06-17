'use client';

import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, type DocumentData } from 'firebase/firestore';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { formatDateTime, formatTimestampSort, type WorkflowRecord } from '../../lib/adminWorkflow';
import { db } from '../../lib/firebase';
import { sanitizeAiContext } from '../../lib/aiContext';
import type { LocalMessageTheme } from '../../lib/localMessageThemes';
import { buildMessageThemes, type MessageTheme } from '../../lib/messageThemes';
import { buildRecipientGreeting, stripAiEnvelope } from '../../lib/draftComposer';
import {
  buildLetterHtml,
  buildLetterText,
  buildPortalSignatureText,
  createSignatureRecord,
  mergeBodyWithSignature,
  type SignatureRecord,
} from '../../lib/signatures';
import { buildExternalMessageKey } from '../../lib/mailIdentity';
import { applyAdminSenderToSignature, resolveAdminSenderContact } from './adminSenderSignature';
import { buildLetterTemplateReplacements, downloadFilledLetterTemplate } from './letterOfficeExport';
import { appendDeliveryLabel } from './messageDeliveryLabel';
import OutgoingAttachmentPicker, { type PendingOutgoingAttachment } from './OutgoingAttachmentPicker';
import MessageAttachmentPreview from './MessageAttachmentPreview';
import TenantDetailView from './TenantDetailView';
import { uploadOutgoingMessageAttachments } from '../../lib/outgoingMessageAttachments';

type MailboxTab = 'archive' | 'compose' | 'inbox';
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

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildMessageTargetHref(record: WorkflowRecord) {
  const tenantId = cleanText(record.data.tenantId);
  if (tenantId) {
    return `/admin/mieter/${tenantId}?messageId=${record.id}`;
  }
  return `/admin/nachrichten/${record.id}`;
}

function getCompanyEmail(record?: WorkflowRecord | null) {
  return (
    cleanText(record?.data.email) ||
    cleanText(record?.data.contactEmail) ||
    cleanText(record?.data.companyEmail) ||
    cleanText(record?.data.officeEmail)
  );
}

function getPersonCompanyId(record?: WorkflowRecord | null) {
  return (
    cleanText(record?.data.companyId) ||
    cleanText(record?.data.partnerCompanyId) ||
    cleanText(record?.data.serviceCompanyId)
  );
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

function getPropertyOwnerCompanyId(record?: WorkflowRecord | null) {
  return cleanText(record?.data.ownerId) || cleanText(record?.data.companyId);
}

function buildAddressLine(parts: Array<unknown>) {
  return parts.map((entry) => cleanText(entry)).filter(Boolean).join(' ');
}

function buildAddressBlock(lines: Array<unknown>) {
  return lines.map((entry) => cleanText(entry)).filter(Boolean).join('\n');
}

function buildLetterSubjectLine2(property: WorkflowRecord | null | undefined, unitLabel?: string) {
  const address = buildAddressBlock([
    buildAddressLine([property?.data.street, property?.data.houseNumber]),
    buildAddressLine([property?.data.postalCode, property?.data.city]),
  ]).replace(/\n/g, ', ');
  return [address, cleanText(unitLabel)].filter(Boolean).join(' · ');
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
  const { profile, user } = useAuth();
  const currentTab = (searchParams.get('tab') as MailboxTab) || 'inbox';

  const [firestoreMessages, setFirestoreMessages] = useState<WorkflowRecord[]>([]);
  const [localPortalMessages, setLocalPortalMessages] = useState<WorkflowRecord[]>([]);
  const [messageThemes, setMessageThemes] = useState<LocalMessageTheme[]>([]);
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
  const [composeAttachments, setComposeAttachments] = useState<PendingOutgoingAttachment[]>([]);
  const [senderEmail, setSenderEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingDeleteThemeId, setPendingDeleteThemeId] = useState('');
  const [unknownAssignTenantId, setUnknownAssignTenantId] = useState('');
  const [isGeneratingComposeAiDraft, setIsGeneratingComposeAiDraft] = useState(false);
  const [isPending, startTransition] = useTransition();
  const appliedComposePresetRef = useRef('');
  const autoDraftPresetRef = useRef('');
  const currentMailboxView: 'archive' | 'inbox' = currentTab === 'archive' ? 'archive' : 'inbox';

  useEffect(() => {
    const unsubscribers = [
      readCollection('messages', setError, setFirestoreMessages),
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

    async function loadLocalPortalMessages() {
      try {
        const response = await authorizedFetch('/api/admin/local-portal-messages');
        const result = (await response.json()) as {
          messages?: WorkflowRecord[];
          ok?: boolean;
        };

        if (!cancelled && response.ok && result.ok) {
          setLocalPortalMessages(Array.isArray(result.messages) ? result.messages : []);
        }
      } catch (caughtError) {
        console.error('Fehler beim Laden der lokalen Portalnachrichten:', caughtError);
      }
    }

    void loadLocalPortalMessages();
    const intervalId = window.setInterval(() => {
      void loadLocalPortalMessages();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function loadMessageThemes() {
      try {
        const response = await authorizedFetch('/api/admin/message-themes');
        const result = (await response.json()) as {
          ok?: boolean;
          themes?: LocalMessageTheme[];
        };

        if (!cancelled && response.ok && result.ok) {
          setMessageThemes(Array.isArray(result.themes) ? result.themes : []);
        }
      } catch (caughtError) {
        console.error('Fehler beim Laden der Themen:', caughtError);
      }
    }

    void loadMessageThemes();
    const intervalId = window.setInterval(() => {
      void loadMessageThemes();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [user]);

  const messages = useMemo(() => {
    const combined = [...firestoreMessages, ...localPortalMessages];
    const unique = new Map<string, WorkflowRecord>();
    combined.forEach((record) => {
      unique.set(record.id, record);
    });
    return Array.from(unique.values());
  }, [firestoreMessages, localPortalMessages]);

  const themes = useMemo(() => buildMessageThemes(messages, messageThemes), [messageThemes, messages]);

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

  const inboxThemes = useMemo(
    () =>
      themes.filter((theme) => !theme.archived && cleanText(theme.status) !== 'deleted'),
    [themes]
  );

  const archivedThemes = useMemo(
    () => themes.filter((theme) => theme.archived || cleanText(theme.status) === 'done'),
    [themes]
  );

  const filteredInbox = useMemo(() => {
    const needle = search.toLocaleLowerCase('de-DE').trim();
    if (!needle) return inboxThemes;
    return inboxThemes.filter((theme) =>
      [
        cleanText(theme.latestInbound?.data.fromName),
        cleanText(theme.latestInbound?.data.fromEmail),
        cleanText(theme.subject),
        cleanText(theme.latestEntry.data.bodyText),
      ]
        .join(' ')
        .toLocaleLowerCase('de-DE')
        .includes(needle)
    );
  }, [inboxThemes, search]);

  const filteredArchivedThemes = useMemo(() => {
    const needle = search.toLocaleLowerCase('de-DE').trim();
    if (!needle) return archivedThemes;
    return archivedThemes.filter((theme) =>
      [
        cleanText(theme.latestInbound?.data.fromName),
        cleanText(theme.latestInbound?.data.fromEmail),
        cleanText(theme.subject),
        cleanText(theme.latestEntry.data.bodyText),
      ]
        .join(' ')
        .toLocaleLowerCase('de-DE')
        .includes(needle)
    );
  }, [archivedThemes, search]);

  const activeThemeList = currentTab === 'archive' ? filteredArchivedThemes : filteredInbox;
  const selectedGlobalThemeId = cleanText(searchParams.get('themeId'));
  const selectedGlobalTheme =
    selectedGlobalThemeId
      ? activeThemeList.find((theme) => theme.id === selectedGlobalThemeId) ?? null
      : null;
  const selectedGlobalTenantId = cleanText(selectedGlobalTheme?.tenantId);
  const pendingDeleteTheme =
    themes.find((theme) => theme.id === pendingDeleteThemeId) ??
    activeThemeList.find((theme) => theme.id === pendingDeleteThemeId) ??
    null;

  useEffect(() => {
    if (!selectedGlobalThemeId || !selectedGlobalTheme || !selectedGlobalTenantId) return;
    if (selectedGlobalTenantId.startsWith('unknown:')) return;
    router.replace(`/admin/mieter/${selectedGlobalTenantId}?messageId=${selectedGlobalTheme.id}`);
  }, [router, selectedGlobalTenantId, selectedGlobalTheme, selectedGlobalThemeId]);

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
  const unknownAssignTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === unknownAssignTenantId) ?? null,
    [tenants, unknownAssignTenantId]
  );
  const unknownAssignTenantOptions = useMemo(
    () =>
      [...tenants]
        .sort((left, right) => buildTenantLabel(left).localeCompare(buildTenantLabel(right), 'de'))
        .map((tenant) => {
          const property = properties.find(
            (entry) => entry.id === cleanText(tenant.data.propertyId)
          );
          const detail = [
            cleanText(property?.data.name),
            cleanText(tenant.data.unitLabel),
            cleanText(tenant.data.email),
          ]
            .filter(Boolean)
            .join(' · ');
          return {
            label: detail ? `${buildTenantLabel(tenant)} · ${detail}` : buildTenantLabel(tenant),
            value: tenant.id,
          };
        }),
    [properties, tenants]
  );

  useEffect(() => {
    setUnknownAssignTenantId('');
  }, [selectedGlobalTheme?.id]);
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
        salutation: cleanText(selectedContact?.data.salutation),
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
      salutation:
        cleanText(selectedTenant?.data.salutation) ||
        cleanText(selectedTenant?.data.anrede) ||
        (cleanText(selectedTenant?.data.gender).toLocaleLowerCase('de-DE').startsWith('w')
          ? 'Frau'
          : cleanText(selectedTenant?.data.gender).toLocaleLowerCase('de-DE').startsWith('m')
            ? 'Herr'
            : ''),
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
      salutation:
        cleanText(selectedTenant?.data.companyContactSalutation) ||
        cleanText(selectedTenant?.data.salutation) ||
        cleanText(selectedTenant?.data.anrede) ||
        (cleanText(selectedTenant?.data.gender).toLocaleLowerCase('de-DE').startsWith('w')
          ? 'Frau'
          : cleanText(selectedTenant?.data.gender).toLocaleLowerCase('de-DE').startsWith('m')
            ? 'Herr'
            : ''),
      name: selectedTenant ? buildTenantLabel(selectedTenant) : '',
    };

    const companyRecipient = {
      address: buildAddressBlock([
        buildAddressLine([selectedTenant?.data.companyStreet, selectedTenant?.data.companyHouseNumber]),
        buildAddressLine([selectedTenant?.data.companyPostalCode, selectedTenant?.data.companyCity]),
      ]),
      company: cleanText(selectedTenant?.data.companyName),
      salutation:
        cleanText(selectedTenant?.data.salutation) ||
        cleanText(selectedTenant?.data.anrede) ||
        (cleanText(selectedTenant?.data.gender).toLocaleLowerCase('de-DE').startsWith('w')
          ? 'Frau'
          : cleanText(selectedTenant?.data.gender).toLocaleLowerCase('de-DE').startsWith('m')
            ? 'Herr'
            : ''),
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

  function resolveServiceRecipient(propertyId: string, serviceField: string) {
    const property = properties.find((entry) => entry.id === propertyId) ?? null;
    const rawServiceId = cleanText(property?.data[serviceField]);
    const normalizedServiceId = rawServiceId.startsWith('company:')
      ? rawServiceId.slice('company:'.length)
      : rawServiceId;
    const contact =
      people.find((person) => person.id === rawServiceId || person.id === normalizedServiceId) ?? null;

    if (contact) {
      return {
        companyId: getPersonCompanyId(contact),
        contactId: contact.id,
        email: '',
      };
    }

    const company =
      companies.find((entry) => entry.id === normalizedServiceId || `company:${entry.id}` === rawServiceId) ?? null;

    return {
      companyId: company?.id || '',
      contactId: '',
      email: getCompanyEmail(company),
    };
  }

  useEffect(() => {
    const preset = cleanText(searchParams.get('composePreset'));
    if (currentTab !== 'compose' || !preset) return;

    const presetKey = searchParams.toString();
    if (appliedComposePresetRef.current === presetKey) return;

    const propertyId = cleanText(searchParams.get('propertyId'));
    const tenantId = cleanText(searchParams.get('tenantId'));
    const serviceField = cleanText(searchParams.get('serviceField'));
    const subject = cleanText(searchParams.get('subject'));
    const instruction = cleanText(searchParams.get('instruction'));

    if (preset === 'maintenance') {
      if (!propertyId || properties.length === 0) return;
      const serviceRecipient = resolveServiceRecipient(propertyId, serviceField);
      setComposeScope('service_contacts');
      setComposeDeliveryMode('email');
      setComposePropertyId(propertyId);
      setComposeTenantId('');
      setComposeCompanyId(serviceRecipient.companyId);
      setComposeContactId(serviceRecipient.contactId);
      setComposeRecipientEmail(serviceRecipient.email);
      setExtraManualRecipients([]);
      setExtraServiceRecipients([]);
      setComposeSubject(subject);
      setComposeAiInstruction(instruction);
      setComposeBody('');
      setMessage(serviceRecipient.contactId || serviceRecipient.email ? '' : 'Für diese Frist ist noch kein Dienstleister mit E-Mail hinterlegt.');
      setError('');
      appliedComposePresetRef.current = presetKey;
      return;
    }

    if (preset === 'tenant') {
      if (!tenantId || tenants.length === 0) return;
      const tenant = tenants.find((entry) => entry.id === tenantId) ?? null;
      setComposeScope('manual');
      setComposeDeliveryMode('email');
      setComposePropertyId(propertyId || cleanText(tenant?.data.propertyId));
      setComposeTenantId(tenantId);
      setComposeCompanyId(cleanText(tenant?.data.companyId));
      setComposeContactId('');
      setComposeRecipientEmail('');
      setExtraManualRecipients([]);
      setExtraServiceRecipients([]);
      setComposeSubject(subject);
      setComposeAiInstruction(instruction);
      setComposeBody('');
      setMessage('');
      setError('');
      appliedComposePresetRef.current = presetKey;
    }
  }, [companies, currentTab, people, properties, searchParams, tenants]);

  useEffect(() => {
    if (currentTab !== 'compose' || cleanText(searchParams.get('autoDraft')) !== '1') return;
    const presetKey = searchParams.toString();
    if (autoDraftPresetRef.current === presetKey) return;
    if (!cleanText(composeSubject) || !cleanText(composeAiInstruction) || isGeneratingComposeAiDraft) return;

    const canDraft =
      composeScope === 'manual'
        ? Boolean(selectedTenant || cleanText(composeRecipientEmail))
        : composeScope === 'service_contacts'
          ? composeRecipients.length > 0
          : composeRecipients.length > 0;

    if (!canDraft) return;

    autoDraftPresetRef.current = presetKey;
    window.setTimeout(() => {
      void generateComposeAiDraft();
    }, 120);
  }, [
    composeAiInstruction,
    composeRecipientEmail,
    composeRecipients.length,
    composeScope,
    composeSubject,
    currentTab,
    isGeneratingComposeAiDraft,
    searchParams,
    selectedContact,
    selectedTenant,
  ]);

  function buildTabHref(tab: MailboxTab) {
    return tab === 'inbox' ? pathname : `${pathname}?tab=${tab}`;
  }

  function buildInboxThemeHref(themeId: string) {
    const tabParam = currentTab === 'archive' ? 'archive' : 'inbox';
    return tabParam === 'inbox'
      ? `${pathname}?themeId=${themeId}`
      : `${pathname}?tab=${tabParam}&themeId=${themeId}`;
  }

  function handleMailboxViewChange(nextTab: 'archive' | 'inbox') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('admin-mailbox-view', {
          detail: { view: nextTab },
        })
      );
    }
    router.push(buildTabHref(nextTab));
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

  async function updateThemeState(
    themeId: string,
    tenantId: string,
    title: string,
    messageIds: string[],
    status: 'done' | 'in_progress' | 'needs_review' | 'new',
    archived: boolean
  ) {
    const response = await authorizedFetch('/api/admin/message-themes', {
      method: 'POST',
      body: JSON.stringify({
        archived,
        id: themeId,
        messageIds,
        status,
        tenantId,
        title,
      }),
    });
    const result = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Der Themenstatus konnte nicht aktualisiert werden.');
    }

    setMessageThemes((current) => {
      const now = new Date().toISOString();
      return current.some((theme) => theme.id === themeId)
        ? current.map((theme) =>
            theme.id === themeId
              ? { ...theme, archived, lastActivityAt: now, messageIds, status, title, updatedAt: now }
              : theme
          )
        : [
            ...current,
            {
              archived,
              createdAt: now,
              id: themeId,
              lastActivityAt: now,
              messageIds,
              sourceType: 'tenant_message',
              status,
              tenantId,
              title,
              updatedAt: now,
            },
          ];
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
    setComposeAttachments([]);
  }

  function startUnknownSenderReply(theme: MessageTheme) {
    const recipientEmail =
      cleanText(theme.latestInbound?.data.fromEmail) || cleanText(theme.latestEntry.data.fromEmail);
    if (!recipientEmail) {
      setError('Für diesen Absender ist keine E-Mail-Adresse vorhanden.');
      return;
    }

    const subject = cleanText(theme.subject) || cleanText(theme.latestEntry.data.subject) || 'Nachricht';
    resetCompose();
    setComposeScope('manual');
    setComposeDeliveryMode('email');
    setComposeRecipientEmail(recipientEmail);
    setComposeSubject(subject.toLocaleLowerCase('de-DE').startsWith('re:') ? subject : `Re: ${subject}`);
    setMessage('Antwort ist vorbereitet.');
    setError('');
    router.push(`${pathname}?tab=compose`);
  }

  function assignUnknownThemeToTenant(theme: MessageTheme, tenantId: string) {
    runAction(async () => {
      const tenant = tenants.find((entry) => entry.id === tenantId) ?? null;
      if (!tenant) {
        throw new Error('Bitte wähle zuerst einen Mieter aus.');
      }

      const firestoreMessageIds = theme.records
        .filter((record) => firestoreMessages.some((entry) => entry.id === record.id))
        .map((record) => record.id);

      if (firestoreMessageIds.length === 0) {
        throw new Error('Diese lokale Nachricht kann noch nicht automatisch zugeordnet werden.');
      }

      const propertyId = cleanText(tenant.data.propertyId);
      const unitId = cleanText(tenant.data.unitId);
      await Promise.all(
        firestoreMessageIds.map((messageId) =>
          updateDoc(doc(db, 'messages', messageId), {
            propertyId,
            recipientId: tenant.id,
            recipientType: 'tenant',
            tenantId: tenant.id,
            unitId,
            updatedAt: serverTimestamp(),
            updatedByEmail: user?.email ?? null,
            updatedByUid: user?.uid ?? null,
          })
        )
      );

      await updateThemeState(
        theme.id,
        tenant.id,
        cleanText(theme.subject) || cleanText(theme.latestEntry.data.subject) || 'Nachricht',
        theme.records.map((record) => record.id),
        'in_progress',
        false
      );

      setUnknownAssignTenantId('');
      setMessage('Nachricht wurde dem Mieter zugeordnet.');
      router.push(`${pathname}?themeId=${theme.id}`);
    });
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
    deliveryMode,
  }: {
    propertyId?: string;
    recipient: ComposeRecipient;
    signature: SignatureRecord;
    subject: string;
    unitId?: string;
    deliveryMode?: DeliveryMode;
  }) {
    const baseBody = cleanText(composeBody);
    const portalBody = [baseBody, buildPortalSignatureText(signature)].filter(Boolean).join('\n\n');
    const tenantRecord = recipient.tenantId
      ? tenants.find((entry) => entry.id === recipient.tenantId) ?? null
      : null;
    const contactRecord = recipient.contactId
      ? people.find((entry) => entry.id === recipient.contactId) ?? null
      : null;
    const recipientCompanyRecord =
      composeScope === 'service_contacts'
        ? companies.find((entry) => entry.id === cleanText(recipient.companyId)) ?? null
        : null;
    const propertyRecord = properties.find((entry) => entry.id === cleanText(propertyId)) ?? null;
    const subjectLine2 = buildLetterSubjectLine2(propertyRecord, cleanText(tenantRecord?.data.unitLabel));
    const propertyOwnerCompanyId = getPropertyOwnerCompanyId(propertyRecord);
    const templateCompany =
      companies.find((entry) => entry.id === propertyOwnerCompanyId) ??
      companies.find((entry) => entry.id === cleanText(composeCompanyId)) ??
      companies.find((entry) => entry.id === cleanText(recipient.companyId)) ??
      null;
    const letterRecipient =
      recipient.recipientType === 'contact'
        ? {
            address: buildAddressBlock([
              buildAddressLine([contactRecord?.data.street, contactRecord?.data.houseNumber]),
              buildAddressLine([contactRecord?.data.postalCode, contactRecord?.data.city]),
            ]),
            company:
              cleanText(contactRecord?.data.partnerCompanyName) || cleanText(contactRecord?.data.companyName),
            salutation: cleanText(contactRecord?.data.salutation),
            name:
              [cleanText(contactRecord?.data.firstName), cleanText(contactRecord?.data.lastName)]
                .filter(Boolean)
                .join(' ') || cleanText(contactRecord?.data.name),
          }
        : recipient.recipientType === 'email' && recipientCompanyRecord
          ? {
              address: buildAddressBlock([
                buildAddressLine([recipientCompanyRecord.data.street, recipientCompanyRecord.data.houseNumber]),
                buildAddressLine([recipientCompanyRecord.data.postalCode, recipientCompanyRecord.data.city]),
              ]),
              company: cleanText(recipientCompanyRecord.data.name),
              salutation: '',
              name: cleanText(recipientCompanyRecord.data.contactPerson),
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
            salutation:
              selectedComposeLetterRecipient.salutation ||
              cleanText(tenantRecord?.data.salutation) ||
              cleanText(tenantRecord?.data.anrede) ||
              (cleanText(tenantRecord?.data.gender).toLocaleLowerCase('de-DE').startsWith('w')
                ? 'Frau'
                : cleanText(tenantRecord?.data.gender).toLocaleLowerCase('de-DE').startsWith('m')
                  ? 'Herr'
                  : ''),
            name:
              selectedComposeLetterRecipient.name || (tenantRecord ? buildTenantLabel(tenantRecord) : ''),
          };

    const letterHtml = buildLetterHtml({
      body: baseBody,
      context: {
        propertyName: cleanText(propertyRecord?.data.name),
        subjectLine2,
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
      contactId: recipient.contactId || '',
      createdAt: serverTimestamp(),
      deliveryMode: deliveryMode || 'letter',
      draftKind: 'letter',
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
      letterText: buildLetterText(baseBody, signature),
    });

    await downloadFilledLetterTemplate({
      fallbackHtml: letterHtml,
      fileName: subject || 'Brief',
      getAuthToken: user ? () => user.getIdToken() : undefined,
      replacements: buildLetterTemplateReplacements({
        body: baseBody,
        closing: signature.letterClosing || signature.closing,
        companyName: signature.companyName,
        recipientAddress: letterRecipient.address,
        recipientCompany: letterRecipient.company,
        recipientName: letterRecipient.name,
        recipientSalutation: letterRecipient.salutation,
        senderName: signature.name,
        subject,
        subjectLine2,
      }),
      templateUrl: cleanText(templateCompany?.data.letterTemplateUrl),
    });
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

  function permanentlyDeleteTheme(theme: MessageTheme) {
    runAction(async () => {
      const response = await authorizedFetch('/api/admin/message-themes', {
        method: 'POST',
        body: JSON.stringify({
          archived: true,
          deleted: true,
          id: theme.id,
          lastActivityAt: new Date().toISOString(),
          messageIds: theme.records.map((entry) => entry.id),
          sourceType: theme.sourceType || 'manual',
          status: 'done',
          tenantId: theme.tenantId,
          title: cleanText(theme.subject) || 'Geloeschte Nachricht',
        }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Die Nachricht konnte nicht geloescht werden.');
      }

      const now = new Date().toISOString();
      setMessageThemes((current) =>
        current.some((entry) => entry.id === theme.id)
          ? current.map((entry) =>
              entry.id === theme.id
                ? { ...entry, archived: true, deleted: true, status: 'done', updatedAt: now }
                : entry
            )
          : [
              ...current,
              {
                archived: true,
                createdAt: now,
                deleted: true,
                id: theme.id,
                lastActivityAt: now,
                messageIds: theme.records.map((entry) => entry.id),
                sourceType: (theme.sourceType as 'admin_message' | 'manual' | 'tenant_message') || 'manual',
                status: 'done',
                tenantId: theme.tenantId,
                title: cleanText(theme.subject) || 'Geloeschte Nachricht',
                updatedAt: now,
              },
            ]
      );

      setPendingDeleteThemeId('');
      if (selectedGlobalTheme?.id === theme.id) {
        router.push(buildTabHref(currentTab === 'archive' ? 'archive' : 'inbox'));
      }
      setMessage('Nachricht wurde endgültig gelöscht.');
    });
  }

  async function saveOutgoingAttachmentsAsRecipientDocuments(
    recipient: ComposeRecipient,
    uploadedAttachments: Array<{
      contentType: string;
      name: string;
      path: string;
      size: number;
      uploadedAt: string;
      url: string;
    }>
  ) {
    if (uploadedAttachments.length === 0) return;
    const attachmentDocuments = uploadedAttachments.map((attachment) => ({
      category: 'Anhänge',
      contentType: attachment.contentType,
      name: attachment.name,
      path: attachment.path,
      size: attachment.size,
      source: 'message-attachment',
      uploadedAt: attachment.uploadedAt,
      uploadedByEmail: user?.email ?? '',
      url: attachment.url,
    }));

    if (recipient.tenantId) {
      const tenantRecord = tenants.find((entry) => entry.id === recipient.tenantId) ?? null;
      const currentDocuments = Array.isArray(tenantRecord?.data.tenantDocuments)
        ? tenantRecord.data.tenantDocuments
        : [];
      await updateDoc(doc(db, 'tenants', recipient.tenantId), {
        tenantDocuments: [...currentDocuments, ...attachmentDocuments],
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });
      return;
    }

    if (recipient.contactId) {
      const personRecord = people.find((entry) => entry.id === recipient.contactId) ?? null;
      const currentDocuments = Array.isArray(personRecord?.data.personDocuments)
        ? personRecord.data.personDocuments
        : [];
      await updateDoc(doc(db, 'people', recipient.contactId), {
        personDocuments: [...currentDocuments, ...attachmentDocuments],
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });
    }
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
      const uploadedAttachments =
        composeDeliveryMode === 'email' || composeDeliveryMode === 'both'
          ? await uploadOutgoingMessageAttachments(composeAttachments, `compose-${Date.now()}`)
          : [];
      for (const recipient of composeRecipients) {
        const tenantRecord = recipient.tenantId
          ? tenants.find((entry) => entry.id === recipient.tenantId) ?? null
          : null;
        const messagePropertyId = cleanText(tenantRecord?.data.propertyId) || cleanText(composePropertyId);
        const messageUnitId = cleanText(tenantRecord?.data.unitId);
        const messageProperty =
          properties.find((entry) => entry.id === messagePropertyId) ??
          selectedProperty ??
          null;
        const messageCompanyId =
          getPropertyOwnerCompanyId(messageProperty) ||
          cleanText(tenantRecord?.data.companyId) ||
          cleanText(composeCompanyId) ||
          cleanText(recipient.companyId);
        const recipientSignature = applyAdminSenderToSignature(
          buildRecipientSignature(companies, messageCompanyId, composeCompanyId),
          resolveAdminSenderContact(profile, user)
        );
        const subject = cleanText(composeSubject) || 'Nachricht von Halbmann Holding';

        if (composeDeliveryMode === 'email' || composeDeliveryMode === 'both') {
          const draftRef = await addDoc(collection(db, 'messageDrafts'), {
            attachments: uploadedAttachments,
            body: bodyWithoutManualSignature,
            companyId: messageCompanyId,
            deliveryMode: composeDeliveryMode,
            createdAt: serverTimestamp(),
            kind: 'broadcast',
            messageId: null,
            propertyId: messagePropertyId,
            signature: recipientSignature,
            portalBodyText: bodyWithoutManualSignature,
            recipientEmail: recipient.email,
            recipientId: recipient.tenantId || recipient.contactId || null,
            recipientType: recipient.recipientType,
            status: 'draft',
            subject,
            ticketId: null,
            unitId: messageUnitId,
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
          await saveOutgoingAttachmentsAsRecipientDocuments(recipient, uploadedAttachments);
        }

        if (composeDeliveryMode === 'both') {
          await createLetterHistoryMessage({
            propertyId: messagePropertyId,
            recipient,
            signature: recipientSignature,
            subject,
            unitId: messageUnitId,
            deliveryMode: composeDeliveryMode,
          });
        }

        if (composeDeliveryMode === 'letter') {
          await createLetterHistoryMessage({
            propertyId: messagePropertyId,
            recipient,
            signature: recipientSignature,
            subject,
            unitId: messageUnitId,
            deliveryMode: composeDeliveryMode,
          });
        }
        if (cleanText(composeFollowUpDate) && (recipient.tenantId || recipient.contactId)) {
          await addDoc(collection(db, 'followUps'), {
            createdAt: serverTimestamp(),
            dueDate: composeFollowUpDate,
            message: 'Rückmeldung auf gesendete Nachricht prüfen',
            propertyId: messagePropertyId,
            status: 'open',
            targetId: recipient.tenantId || recipient.contactId || '',
            targetType: recipient.tenantId ? 'tenant' : recipient.contactId ? 'contact' : 'email',
            ticketId: '',
            unitId: messageUnitId,
          });
        }
      }

      resetCompose();
      setMessage(
        composeDeliveryMode === 'both'
          ? 'Brief und Mail wurden verarbeitet.'
          : composeDeliveryMode === 'letter'
            ? 'Brief wurde im Verlauf erfasst.'
            : 'Nachricht wurde versendet.'
      );
      router.push(pathname);
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
        companies.find((company) => company.id === getPropertyOwnerCompanyId(selectedProperty)) ??
        companies.find((company) => company.id === cleanText(selectedTenant?.data.companyId)) ??
        companies.find((company) => company.id === composeCompanyId) ??
        null;

      const response = await authorizedFetch('/api/ai/message-draft', {
        method: 'POST',
        body: JSON.stringify({
          companyName: cleanText(selectedCompany?.data.name),
          contextBundle: sanitizeAiContext({
            selected: {
              company: selectedCompany,
              contact: selectedContact,
              property: selectedProperty,
              tenant: selectedTenant,
            },
            collections: {
              companies,
              contacts: people,
              messages: [...firestoreMessages, ...localPortalMessages].slice(-80),
              properties,
              tenants,
            },
            currentCompose: {
              deliveryMode: composeDeliveryMode,
              scope: composeScope,
              subject: composeSubject,
            },
          }),
          currentBody: cleanText(composeBody),
          deliveryMode: composeDeliveryMode,
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
          recipientSalutation:
            composeScope === 'manual'
              ? cleanText(selectedTenant?.data.salutation) ||
                cleanText(selectedTenant?.data.anrede) ||
                (cleanText(selectedTenant?.data.gender).toLocaleLowerCase('de-DE').startsWith('w')
                  ? 'Frau'
                  : cleanText(selectedTenant?.data.gender).toLocaleLowerCase('de-DE').startsWith('m')
                    ? 'Herr'
                    : '')
              : composeScope === 'service_contacts'
                ? cleanText(selectedContact?.data.salutation)
                : '',
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

      if (composeDeliveryMode === 'letter') {
        nextComposeBody = stripAiEnvelope(result.draftText);
      } else if (composeScope === 'manual') {
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
    const globalThemesPanel = (
      <div className="px-0 py-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
              Nachrichten
            </p>
            <span className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {activeThemeList.length}
            </span>
          </div>
        </div>
        <div className="mt-3">
          <input
            className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nach Mieter, Objekt oder Inhalt suchen"
            type="search"
            value={search}
          />
        </div>
        <div className="mt-3 max-h-[72vh] divide-y divide-stone-200 overflow-y-auto border-y border-stone-200 pr-1">
          {activeThemeList.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-stone-300 bg-white px-3 py-6 text-sm text-slate-600">
              {currentTab === 'archive'
                ? 'Keine archivierten Nachrichten vorhanden.'
                : 'Im Posteingang liegen aktuell keine offenen Nachrichten.'}
            </div>
          ) : (
            activeThemeList.map((theme) => {
              const themeListKey = `${theme.tenantId || 'unknown'}-${theme.id}-${theme.latestEntry.id}`;
              const isSelected = selectedGlobalTheme?.id === theme.id && selectedGlobalTheme?.tenantId === theme.tenantId;
              const linkedTenant =
                tenants.find((tenant) => tenant.id === cleanText(theme.tenantId)) ?? null;
              const sender =
                buildTenantLabel(linkedTenant ?? ({ data: theme.latestInbound?.data ?? {}, id: cleanText(theme.tenantId) || theme.id } as WorkflowRecord)) ||
                cleanText(theme.latestInbound?.data.fromName || theme.latestInbound?.data.fromEmail) ||
                'Unbekannter Mieter';
              return (
                <div
                  className={`relative px-3 py-3 !text-slate-950 transition ${
                    isSelected
                      ? '!bg-amber-50 !text-slate-950'
                      : '!bg-white hover:!bg-stone-50'
                  }`}
                  key={themeListKey}
                >
                  <button
                    aria-label="Nachricht löschen"
                    className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-stone-200 bg-white text-xs font-medium text-stone-500 transition hover:border-rose-300 hover:text-rose-600"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setPendingDeleteThemeId(theme.id);
                    }}
                    type="button"
                  >
                    x
                  </button>
                  <Link
                    className="block pr-8"
                    href={
                      cleanText(theme.tenantId).startsWith('unknown:')
                        ? `/admin/nachrichten/${theme.latestInbound?.id || theme.latestEntry.id}`
                        : `/admin/mieter/${cleanText(theme.tenantId)}?messageId=${theme.id}`
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`truncate text-sm font-medium ${isSelected ? '!text-amber-950' : '!text-slate-950'}`}>
                          {sender}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 !text-slate-900">
                          {appendDeliveryLabel(
                            cleanText(theme.subject) || 'Nachricht ohne Betreff',
                            theme.latestEntry.data as Record<string, unknown>
                          )}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {currentTab === 'archive'
                          ? 'Archiv'
                          : cleanText(theme.status) === 'needs_review'
                            ? 'Zu prüfen'
                            : cleanText(theme.status) === 'new'
                              ? 'Neu'
                              : 'In Bearbeitung'}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[11px] !text-slate-900">
                      {cleanText(theme.latestEntry.data.bodyText) || 'Kein Nachrichtentext vorhanden.'}
                    </p>
                    <p className="mt-2 text-[11px] !text-slate-800">{formatDateTime(theme.latestActivityAt)}</p>
                  </Link>
                </div>
              );
            })
          )}
        </div>
      </div>
    );

    const unknownSenderPanel =
      selectedGlobalTheme && selectedGlobalTenantId.startsWith('unknown:') ? (
        <section className="min-w-0 rounded-[24px] border border-stone-200 bg-white p-4 shadow-[0_28px_70px_-42px_rgba(148,119,77,0.28)] sm:p-6">
          <div className="grid min-w-0 gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="min-w-0">{globalThemesPanel}</aside>
            <div className="min-w-0 xl:border-l xl:border-stone-200 xl:pl-5">
              <div className="border-b border-stone-200 pb-5">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Unbekannter Absender</p>
                    <h2 className="mt-1 break-words text-xl text-slate-950">
                    {cleanText(selectedGlobalTheme.latestInbound?.data.fromName) ||
                      cleanText(selectedGlobalTheme.latestInbound?.data.fromEmail) ||
                      'Neue E-Mail'}
                  </h2>
                    <p className="mt-1 break-all text-sm text-slate-600">{cleanText(selectedGlobalTheme.latestInbound?.data.fromEmail)}</p>
                  </div>
                  <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-slate-600">
                    {selectedGlobalTheme.records.length} Nachrichten
                  </span>
                </div>
                <div className="mt-5 grid min-w-0 gap-3 lg:grid-cols-3">
                  <div className="min-w-0 rounded-[18px] border border-stone-200 bg-stone-50 p-4">
                    <p className="text-sm font-semibold text-slate-950">Antworten</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Schreibt direkt an die Absenderadresse, ohne sie vorher anzulegen.
                    </p>
                    <button
                      className="mt-4 w-full rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-4 py-2 text-sm font-medium text-stone-100 transition hover:brightness-105"
                      onClick={() => startUnknownSenderReply(selectedGlobalTheme)}
                      type="button"
                    >
                      Antworten
                    </button>
                  </div>
                  <div className="min-w-0 rounded-[18px] border border-stone-200 bg-stone-50 p-4">
                    <p className="text-sm font-semibold text-slate-950">Mieter zuordnen</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Danach erscheint der Verlauf auf der normalen Mieterseite.
                    </p>
                    <select
                      className="mt-3 w-full min-w-0 rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs text-slate-900 outline-none transition focus:border-amber-700/60"
                      onChange={(event) => setUnknownAssignTenantId(event.target.value)}
                      value={unknownAssignTenantId}
                    >
                      <option value="">Mieter auswählen</option>
                      {unknownAssignTenantOptions.map((tenant) => (
                        <option key={`unknown-tenant-${tenant.value}`} value={tenant.value}>
                          {tenant.label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="mt-3 w-full rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!unknownAssignTenant || isPending}
                      onClick={() => assignUnknownThemeToTenant(selectedGlobalTheme, unknownAssignTenantId)}
                      type="button"
                    >
                      Zuordnen
                    </button>
                  </div>
                  <div className="min-w-0 rounded-[18px] border border-stone-200 bg-stone-50 p-4">
                    <p className="text-sm font-semibold text-slate-950">Dienstleister anlegen</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Öffnet den Kontaktbereich mit dieser E-Mail als Vorlage.
                    </p>
                    <button
                      className="mt-4 w-full rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400"
                      onClick={() => {
                        const email = cleanText(selectedGlobalTheme.latestInbound?.data.fromEmail);
                        router.push(`/admin/personen?email=${encodeURIComponent(email)}&fromMessageId=${encodeURIComponent(selectedGlobalTheme.latestEntry.id)}`);
                      }}
                      type="button"
                    >
                      Neu anlegen
                    </button>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-stone-200 border-b border-stone-200">
                {selectedGlobalTheme.records
                  .slice()
                  .sort(
                    (left, right) =>
                      formatTimestampSort(left.data.receivedAt ?? left.data.createdAt) -
                      formatTimestampSort(right.data.receivedAt ?? right.data.createdAt)
                  )
                  .map((entry) => (
                    <article className="py-4" key={`${selectedGlobalTheme.tenantId || 'unknown'}-${selectedGlobalTheme.id}-${entry.id}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-950">
                          {cleanText(entry.data.subject) || 'Eingehende E-Mail'}
                        </p>
                        <span className="text-xs text-slate-500">{formatDateTime(entry.data.receivedAt ?? entry.data.createdAt)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {cleanText(entry.data.bodyText) || 'Kein Nachrichtentext vorhanden.'}
                      </p>
                      <MessageAttachmentPreview attachments={entry.data.attachments} />
                    </article>
                  ))}
              </div>
            </div>
          </div>
        </section>
      ) : null;

    const selectedGlobalTenant =
      selectedGlobalTenantId
        ? tenants.find((tenant) => tenant.id === selectedGlobalTenantId) ?? null
        : null;

    return (
      <div className="min-w-0">
        {unknownSenderPanel ? (
          unknownSenderPanel
        ) : selectedGlobalTheme && selectedGlobalTenant ? (
          <TenantDetailView
            activeThemeListMode={currentTab === 'archive' ? 'archive' : 'open'}
            detailLayout="messages"
            externalThemesPanel={globalThemesPanel}
            headerClassName="flex flex-wrap items-center justify-end gap-4 pr-14 xl:pr-16"
            messageHrefBuilder={(_tenantId, messageId) =>
              messageId ? `${pathname}?themeId=${messageId}` : pathname
            }
            selectedMessageId={selectedGlobalTheme.id}
            showEditButton={false}
            showInvitationButton={false}
            showOverviewButton={false}
            sectionTitle={buildTenantLabel(selectedGlobalTenant)}
            tenantId={selectedGlobalTenant.id}
          />
        ) : (
          <section className="min-w-0 rounded-[24px] border border-stone-200 bg-white p-4 shadow-[0_28px_70px_-42px_rgba(148,119,77,0.28)] sm:p-6">
            {globalThemesPanel}
          </section>
        )}
      </div>
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
      <div className="min-w-0">
        <section className="min-w-0 rounded-[24px] border border-stone-200 bg-white p-4 shadow-[0_28px_70px_-42px_rgba(148,119,77,0.28)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <SectionLabel>Mail senden</SectionLabel>
              <h2 className="mt-2 text-xl text-slate-950">Neue Nachricht</h2>
            </div>
            <div className="flex min-w-0 flex-wrap items-end justify-start gap-3 sm:justify-end lg:min-w-[520px]">
              <label className="block min-w-0 flex-1 sm:min-w-[180px]">
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
              <label className="block min-w-0 flex-1 sm:min-w-[260px]">
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

          <div className="mt-6 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
          </div>

          {selectedMetersSummary.length > 0 ? (
            <div className="mt-4 rounded-[18px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-slate-600">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Automatisch erkannte Zähler</p>
              <p className="mt-2">
                {selectedMetersSummary.join(' · ')}
              </p>
            </div>
          ) : null}

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

          {composeDeliveryMode === 'email' || composeDeliveryMode === 'both' ? (
            <OutgoingAttachmentPicker
              attachments={composeAttachments}
              disabled={isPending}
              inputId="compose-message-attachments"
              onChange={setComposeAttachments}
            />
          ) : null}

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

  function renderContent() {
    if (currentTab === 'compose') return renderCompose();
    return renderInbox();
  }

  return (
    <div className="min-w-0 space-y-3 pt-1">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-2 text-sm text-slate-700">
          <span>Ansicht</span>
          <select
            className="bg-transparent text-sm text-slate-900 outline-none"
            onChange={(event) => {
              const nextValue = event.target.value as MailboxTab;
              if (nextValue === 'compose') {
                router.push(buildTabHref('compose'));
                return;
              }
              handleMailboxViewChange(nextValue);
            }}
            value={currentTab === 'compose' ? 'compose' : currentMailboxView}
          >
            <option value="inbox">Posteingang</option>
            <option value="compose">Neue Nachricht</option>
            <option value="archive">Archiv</option>
          </select>
        </label>
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
      {pendingDeleteTheme ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/30 px-4">
          <div className="w-full max-w-md rounded-[20px] border border-stone-200 bg-white px-5 py-5 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.35)]">
            <p className="text-lg font-medium text-slate-950">Nachricht endgültig löschen?</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400"
                onClick={() => setPendingDeleteThemeId('')}
                type="button"
              >
                Abbruch
              </button>
              <button
                className="rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-400"
                onClick={() => void permanentlyDeleteTheme(pendingDeleteTheme)}
                type="button"
              >
                Ja
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}



