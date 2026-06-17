'use client';

import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, type DocumentData } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  buildTenantContact,
  formatDateTime,
  formatTimestampSort,
  getStatusLabel,
  type WorkflowRecord,
} from '../../lib/adminWorkflow';
import { db, storage } from '../../lib/firebase';
import { sanitizeAiContext } from '../../lib/aiContext';
import { composePortalDraft, stripAiEnvelope } from '../../lib/draftComposer';
import type { LocalMessageTheme } from '../../lib/localMessageThemes';
import { buildMessageThemes, type MessageTheme } from '../../lib/messageThemes';
import {
  buildLetterHtml,
  buildLetterText,
  buildPortalSignatureText,
  createSignatureRecord,
  mergeBodyWithSignature,
} from '../../lib/signatures';
import { applyAdminSenderToSignature, resolveAdminSenderContact } from './adminSenderSignature';
import { buildLetterTemplateReplacements, downloadFilledLetterTemplate } from './letterOfficeExport';
import { appendDeliveryLabel } from './messageDeliveryLabel';
import DocumentUploadControl from './DocumentUploadControl';
import DocumentLibrarySection from './DocumentLibrarySection';
import MessageAttachmentPreview, { type MessageAttachmentEntry } from './MessageAttachmentPreview';
import OutgoingAttachmentPicker, { type PendingOutgoingAttachment } from './OutgoingAttachmentPicker';
import RentHistoryChart, { type RentHistoryChartPoint } from './RentHistoryChart';
import {
  cleanTenantDocuments,
  createClientId,
  getLegacyTenantDocumentNames,
  sanitizeStorageFileName,
  type TenantDocumentEntry,
} from '../../lib/tenantDocuments';
import { uploadOutgoingMessageAttachments } from '../../lib/outgoingMessageAttachments';

type TenantDetailViewProps = {
  activeThemeListMode?: 'archive' | 'open';
  detailLayout?: 'full' | 'messages';
  externalThemesPanel?: ReactNode;
  headerClassName?: string;
  messageHrefBuilder?: (tenantId: string, messageId: string) => string;
  selectedMessageId?: string;
  showEditButton?: boolean;
  showInvitationButton?: boolean;
  showOverviewButton?: boolean;
  showSecondaryDetails?: boolean;
  sectionTitle?: string;
  tenantId: string;
};

type DeliveryMode = 'both' | 'email' | 'letter' | 'note';
type ThemeComposerMode = 'note' | 'tenant' | 'vendor';
const GENERAL_THREAD_ID = 'general';

const statusLabelMap: Record<string, string> = {
  active: 'Aktiv',
  pending: 'In Vorbereitung',
  inactive: 'Beendet',
};

const rentIncreaseLabelMap: Record<string, string> = {
  graduated: 'Staffelmiete',
  index: 'Indexmiete',
  legal: 'Nach Gesetz',
};

const depositTypeLabelMap: Record<string, string> = {
  cash_deposit: 'Barkaution',
  bank_guarantee: 'Bankbürgschaft',
};

const vatRuleLabelMap: Record<string, string> = {
  no_vat: 'Keine Umsatzsteuer',
  rent_only: 'Umsatzsteuer auf Nettomiete',
  rent_and_operating_costs: 'Umsatzsteuer auf Nettomiete und umlegbare Betriebskosten',
};

const relationLabelMap: Record<string, string> = {
  spouse: 'Ehepartner',
  partner: 'Lebenspartner',
  co_tenant: 'Mitmieter',
  child: 'Kind',
  other: 'Sonstige Person',
};

const propertyServiceLabelMap = {
  billingServiceId: 'Abrechnung',
  cleaningServiceId: 'Reinigung',
  electricianId: 'Elektrik',
  heatingServiceId: 'Heizung',
  plumbingServiceId: 'Sanitär',
  roofMaintenanceId: 'Dachwartung',
} as const;

function cleanText(value?: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function inferSalutationFromMessage(bodyText: string, lastName: string) {
  const normalizedLastName = cleanText(lastName);
  if (!normalizedLastName || !bodyText) return '';
  const frauPattern = new RegExp(`frau\\s+${normalizedLastName}`, 'i');
  const herrPattern = new RegExp(`herr\\s+${normalizedLastName}`, 'i');
  if (frauPattern.test(bodyText)) return 'Frau';
  if (herrPattern.test(bodyText)) return 'Herr';
  return '';
}

function stripTrailingSignature(body: string, signatureText: string) {
  if (!signatureText) return body.trim();
  const trimmedBody = body.trimEnd();
  return trimmedBody.endsWith(signatureText)
    ? trimmedBody.slice(0, trimmedBody.length - signatureText.length).trimEnd()
    : trimmedBody;
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

function dedupeLabelParts(parts: Array<unknown>) {
  return Array.from(new Set(parts.map((entry) => cleanText(entry)).filter(Boolean))).join(' · ');
}

function buildPersonLabel(record: WorkflowRecord) {
  return (
    [cleanText(record.data.lastName), cleanText(record.data.firstName)].filter(Boolean).join(', ') ||
    cleanText(record.data.partnerCompanyName) ||
    cleanText(record.data.companyName) ||
    cleanText(record.data.name) ||
    record.id
  );
}

function parseMoney(value?: unknown) {
  const text = cleanText(value);
  if (!text) return 0;
  const normalized = text.replace(/\./g, '').replace(/EUR/gi, '').replace(/\s/g, '').replace(',', '.');
  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function shiftMonths(dateValue: string, months: number) {
  if (!dateValue) return '';
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function formatValue(value?: unknown) {
  const text = cleanText(value);
  if (!text || ['-', '–', '—', 'â€“'].includes(text)) return '–';
  return text;
}

function firstNonEmptyValue(
  source: Record<string, unknown> | null | undefined,
  keys: string[]
) {
  if (!source) return '';
  for (const key of keys) {
    const value = cleanText(source[key]);
    if (value) return value;
  }
  return '';
}

function buildThemeTitle(bodyText: string, fallback: string) {
  const source = cleanText(bodyText);
  if (!source) return fallback;
  const firstLine = source.split(/\r?\n/).map((entry) => entry.trim()).find(Boolean) || '';
  if (!firstLine) return fallback;
  return firstLine.length > 80 ? `${firstLine.slice(0, 77).trim()}...` : firstLine;
}

function translateStatus(value?: unknown) {
  const text = cleanText(value);
  return statusLabelMap[text] ?? text;
}

function translateRentIncreaseType(value?: unknown) {
  const text = cleanText(value);
  return rentIncreaseLabelMap[text] ?? text;
}

function translateDepositType(value?: unknown) {
  const text = cleanText(value);
  return depositTypeLabelMap[text] ?? text;
}

function translateVatRule(value?: unknown) {
  const text = cleanText(value);
  return vatRuleLabelMap[text] ?? text;
}

function translateRelation(value?: unknown) {
  const text = cleanText(value);
  return relationLabelMap[text] ?? text;
}

function formatMoneyAmount(value: number) {
  return new Intl.NumberFormat('de-DE', {
    currency: 'EUR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(value);
}

function formatFileSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatUploadDate(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function buildTenantMessageHref(tenantId: string, messageId: string) {
  return `/admin/mieter/${tenantId}?messageId=${messageId}`;
}

function buildTenantMailboxHref(tenantId: string, mode: 'archive' | 'open', messageId?: string) {
  const params = new URLSearchParams();
  if (mode === 'archive') {
    params.set('tab', 'archive');
  }
  if (messageId) {
    params.set('messageId', messageId);
  }
  const query = params.toString();
  return query ? `/admin/mieter/${tenantId}?${query}` : `/admin/mieter/${tenantId}`;
}

function getThemeStatusLabel(status: string, archived: boolean) {
  if (archived) return 'Archiv';
  if (status === 'new') return 'Neu';
  if (status === 'needs_review') return 'Neu pruefen';
  if (status === 'in_progress') return 'In Bearbeitung';
  if (status === 'done') return 'Erledigt';
  return 'Offen';
}

function getThemeStatusTone(status: string, archived: boolean) {
  if (archived) return 'border-stone-300 bg-stone-100 text-stone-700';
  if (status === 'new') return 'border-sky-200 bg-sky-50 text-sky-700';
  if (status === 'needs_review') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'in_progress') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'done') return 'border-stone-300 bg-stone-100 text-stone-700';
  return 'border-stone-200 bg-white text-slate-600';
}

function getThemeAccentClass(status: string, archived: boolean) {
  if (archived) return 'border-l-stone-300';
  if (status === 'new') return 'border-l-sky-400';
  if (status === 'needs_review') return 'border-l-amber-400';
  if (status === 'in_progress') return 'border-l-emerald-400';
  if (status === 'done') return 'border-l-stone-300';
  return 'border-l-stone-200';
}

function matchesThemeSearch(theme: MessageTheme, needle: string) {
  if (!needle) return true;
  const haystack = [
    cleanText(theme.subject),
    cleanText(theme.latestEntry.data.bodyText),
    cleanText(theme.latestInbound?.data.fromName),
    cleanText(theme.latestInbound?.data.fromEmail),
  ]
    .join(' ')
    .toLocaleLowerCase('de-DE');
  return haystack.includes(needle);
}

function formatReminderDate(value: string) {
  const text = cleanText(value);
  if (!text) return '';
  const date = new Date(`${text}T12:00:00`);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function TenantDetailView({
  activeThemeListMode,
  detailLayout = 'full',
  externalThemesPanel,
  headerClassName,
  messageHrefBuilder = buildTenantMessageHref,
  selectedMessageId = '',
  showEditButton = true,
  showInvitationButton = true,
  showOverviewButton = true,
  showSecondaryDetails = true,
  sectionTitle = 'Kommunikation',
  tenantId,
}: TenantDetailViewProps) {
  const router = useRouter();
  const { profile, user } = useAuth();
  const [tenant, setTenant] = useState<DocumentData | null>(null);
  const [allTenants, setAllTenants] = useState<WorkflowRecord[]>([]);
  const [firestoreMessages, setFirestoreMessages] = useState<WorkflowRecord[]>([]);
  const [localPortalMessages, setLocalPortalMessages] = useState<WorkflowRecord[]>([]);
  const [messageThemes, setMessageThemes] = useState<LocalMessageTheme[]>([]);
  const [companies, setCompanies] = useState<WorkflowRecord[]>([]);
  const [people, setPeople] = useState<WorkflowRecord[]>([]);
  const [properties, setProperties] = useState<WorkflowRecord[]>([]);
  const [replyText, setReplyText] = useState('');
  const [newMessageSubject, setNewMessageSubject] = useState('');
  const [aiInstruction, setAiInstruction] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<PendingOutgoingAttachment[]>([]);
  const [contextMode, setContextMode] = useState<'new' | 'reply'>('reply');
  const [composerMode, setComposerMode] = useState<ThemeComposerMode>('tenant');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('email');
  const [letterRecipientKey, setLetterRecipientKey] = useState('property');
  const [followUpDate, setFollowUpDate] = useState('');
  const [senderEmail, setSenderEmail] = useState('portal@halbmann-holding.de');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [mergeSourceThemeId, setMergeSourceThemeId] = useState('');
  const [themeAction, setThemeAction] = useState<'done' | 'merge' | 'reassign' | 'save' | 'split'>('save');
  const [themeActionTargetId, setThemeActionTargetId] = useState('');
  const [themeTitleDraft, setThemeTitleDraft] = useState('');
  const [themeListMode, setThemeListMode] = useState<'open' | 'archive'>('open');
  const [themeSearch, setThemeSearch] = useState('');
  const [vendorContactId, setVendorContactId] = useState('');
  const [themePendingDeleteId, setThemePendingDeleteId] = useState('');
  const [showInvitationSentModal, setShowInvitationSentModal] = useState(false);
  const [isUploadingTenantDocument, setIsUploadingTenantDocument] = useState(false);
  const [deletingTenantDocumentPath, setDeletingTenantDocumentPath] = useState('');
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState(false);
  const [handoverProtocolKind, setHandoverProtocolKind] = useState<'moveIn' | 'moveOut'>('moveIn');
  const [handoverForm, setHandoverForm] = useState({
    condition: '',
    defects: '',
    handedOverKeys: '',
    meterReadings: '',
    notes: '',
    place: '',
    tenantSignatureName: '',
  });
  const [isEndingTenancy, setIsEndingTenancy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const resolvedThemeListMode = activeThemeListMode ?? themeListMode;
  const isMessagesLayout = detailLayout === 'messages';
  const showArchiveHistoryInline = isMessagesLayout && resolvedThemeListMode === 'archive';
  const showStandaloneMailboxLayout = isMessagesLayout && !externalThemesPanel;
  const showMailboxTwoColumnLayout = isMessagesLayout;

  useEffect(() => {
    const unsubscribeTenant = onSnapshot(
      doc(db, 'tenants', tenantId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setTenant(null);
          setError('Der Mieter wurde nicht gefunden.');
          setIsLoading(false);
          return;
        }

        setTenant(snapshot.data());
        setError('');
        setIsLoading(false);
      },
      (caughtError) => {
        console.error(`Fehler beim Laden des Mieters ${tenantId}:`, caughtError);
        setError('Die Mieterdaten konnten nicht geladen werden.');
        setIsLoading(false);
      }
    );

    const unsubscribeCompanies = onSnapshot(query(collection(db, 'companies')), (snapshot) => {
      setCompanies(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id })));
    });
    const unsubscribeTenants = onSnapshot(query(collection(db, 'tenants')), (snapshot) => {
      setAllTenants(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id })));
    });
    const unsubscribePeople = onSnapshot(query(collection(db, 'people')), (snapshot) => {
      setPeople(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id })));
    });
    const unsubscribeProperties = onSnapshot(query(collection(db, 'properties')), (snapshot) => {
      setProperties(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id })));
    });
    const unsubscribeMessages = onSnapshot(
      query(collection(db, 'messages')),
      (snapshot) => {
        setFirestoreMessages(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id })));
      },
      (caughtError) => {
      console.error(`Fehler beim Laden des Nachrichtenverlaufs für ${tenantId}:`, caughtError);
      }
    );

    return () => {
      unsubscribeTenant();
      unsubscribeTenants();
      unsubscribeCompanies();
      unsubscribePeople();
      unsubscribeProperties();
      unsubscribeMessages();
    };
  }, [tenantId]);

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
        console.warn('Fehler beim Laden der lokalen Portalnachrichten im Mieterbereich:', caughtError);
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
        console.warn('Fehler beim Laden der Themen im Mieterbereich:', caughtError);
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

  const additionalPeople = useMemo(
    () => (Array.isArray(tenant?.additionalPersons) ? tenant.additionalPersons : []),
    [tenant]
  );
  const tenantDocuments = useMemo(() => cleanTenantDocuments(tenant?.tenantDocuments), [tenant]);
  const legacyTenantDocumentNames = useMemo(() => getLegacyTenantDocumentNames(tenant), [tenant]);

  const rentChartPoints = useMemo(() => {
    if (!tenant) return [];

    const history = Array.isArray(tenant.rentHistory) ? tenant.rentHistory : [];
    const currentReferenceDate =
      cleanText(tenant.rentIncreaseReferenceDate) || cleanText(tenant.moveInDate) || '';
    const points = new Map<string, RentHistoryChartPoint>();

    history.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const date = cleanText((entry as DocumentData).effectiveDate);
      if (!date) return;
      points.set(date, {
        coldRent: parseMoney((entry as DocumentData).coldRent),
        date,
        label: cleanText((entry as DocumentData).label) || 'Historie',
        netOperatingCosts: parseMoney((entry as DocumentData).netOperatingCosts),
        pointType: 'history',
      });
    });

    if (currentReferenceDate) {
      points.set(currentReferenceDate, {
        coldRent: parseMoney(tenant.coldRent),
        date: currentReferenceDate,
        label: 'Aktuelle Miete',
        netOperatingCosts: parseMoney(tenant.netOperatingCosts),
        pointType: 'current',
      });
    }

    if (cleanText(tenant.rentIncreaseType) === 'graduated') {
      const rows = Array.isArray(tenant.rentIncreaseRows) ? tenant.rentIncreaseRows : [];
      rows.forEach((row, index) => {
        if (!row || typeof row !== 'object') return;
        const date = cleanText((row as DocumentData).fromDate);
        if (!date) return;
        points.set(date, {
          coldRent: parseMoney((row as DocumentData).coldRent),
          date,
          label: `Staffel ${index + 1}`,
          netOperatingCosts: parseMoney(tenant.netOperatingCosts),
          pointType: 'planned',
        });
      });
    }

    if (cleanText(tenant.rentIncreaseType) === 'legal') {
      const sorted = Array.from(points.values()).sort(
        (left, right) =>
          new Date(`${left.date}T12:00:00`).getTime() - new Date(`${right.date}T12:00:00`).getTime()
      );
      const lastPoint = sorted.at(-1);
      if (lastPoint?.date) {
        for (let step = 1; step <= 3; step += 1) {
          const projectionDate = shiftMonths(lastPoint.date, step * 36);
          points.set(projectionDate, {
            coldRent: Number((lastPoint.coldRent * Math.pow(1.15, step)).toFixed(2)),
            date: projectionDate,
            label: `Prognose ${step}`,
            netOperatingCosts: parseMoney(tenant.netOperatingCosts),
            pointType: 'planned',
          });
        }
      }
    }

    return Array.from(points.values()).sort(
      (left, right) =>
        new Date(`${left.date}T12:00:00`).getTime() - new Date(`${right.date}T12:00:00`).getTime()
    );
  }, [tenant]);

  const tenantDisplayName = useMemo(() => {
    const salutation = cleanText(tenant?.salutation);
    const lastFirst = [cleanText(tenant?.lastName), cleanText(tenant?.firstName)].filter(Boolean).join(', ');
    return [salutation, lastFirst].filter(Boolean).join(' ');
  }, [tenant?.firstName, tenant?.lastName, tenant?.salutation]);
  const tenantRecord = tenant as unknown as Record<string, unknown> | null;
  const resolvedSectionTitle =
    showStandaloneMailboxLayout && cleanText(tenantDisplayName) ? tenantDisplayName : sectionTitle;
  const totalRentDisplay = useMemo(() => {
    const baseRent = parseMoney(tenant?.coldRent) + parseMoney(tenant?.netOperatingCosts);
    const withVat = cleanText(tenant?.vatRule) !== 'no_vat';
    return formatMoneyAmount(withVat ? baseRent * 1.19 : baseRent);
  }, [tenant?.coldRent, tenant?.netOperatingCosts, tenant?.vatRule]);
  const vatAmountDisplay = useMemo(() => {
    const baseRent = parseMoney(tenant?.coldRent) + parseMoney(tenant?.netOperatingCosts);
    const withVat = cleanText(tenant?.vatRule) !== 'no_vat';
    return formatMoneyAmount(withVat ? baseRent * 0.19 : 0);
  }, [tenant?.coldRent, tenant?.netOperatingCosts, tenant?.vatRule]);
  const leaseEndDisplay = useMemo(() => {
    const explicitLeaseEnd = firstNonEmptyValue(tenantRecord, [
      'moveOutDate',
      'leaseEndDate',
      'tenancyEndDate',
      'contractEndDate',
    ]);
    return explicitLeaseEnd || 'Unbefristet';
  }, [tenantRecord]);
  const leaseOptionsDisplay = useMemo(() => {
    const explicitLeaseOptions = firstNonEmptyValue(tenantRecord, [
      'leaseOptions',
      'tenancyOptions',
      'extensionOptions',
      'contractOptions',
      'renewalOptions',
    ]);
    return explicitLeaseOptions || 'Keine Option hinterlegt';
  }, [tenantRecord]);
  const depositSummary = useMemo(() => {
    const depositType = translateDepositType(tenant?.depositType);
    const depositAmountValue = parseMoney(tenant?.depositAmount);
    const depositAmount = depositAmountValue > 0 ? formatMoneyAmount(depositAmountValue) : '';
    if (!depositType) return '';
    if (cleanText(tenant?.depositType) === 'cash_deposit' && depositAmount) {
      return `${depositType} (${depositAmount})`;
    }
    return depositType;
  }, [tenant?.depositAmount, tenant?.depositType]);

  const messages = useMemo(() => {
    const combined = [...firestoreMessages, ...localPortalMessages];
    const unique = new Map<string, WorkflowRecord>();
    combined.forEach((record) => {
      unique.set(record.id, record);
    });
    return Array.from(unique.values());
  }, [firestoreMessages, localPortalMessages]);

  const tenantMessages = useMemo(
    () =>
      messages
        .filter((entry) => cleanText(entry.data.tenantId) === tenantId)
        .sort(
          (left, right) =>
            formatTimestampSort(right.data.receivedAt ?? right.data.createdAt) -
            formatTimestampSort(left.data.receivedAt ?? left.data.createdAt)
        ),
    [messages, tenantId]
  );

  const requestThemes = useMemo(
    () =>
      buildMessageThemes(
        tenantMessages,
        messageThemes.filter((theme) => theme.tenantId === tenantId)
      ),
    [messageThemes, tenantId, tenantMessages]
  );

  const openThemes = useMemo(
    () => requestThemes.filter((theme) => !theme.archived),
    [requestThemes]
  );

  const archivedThemes = useMemo(
    () => requestThemes.filter((theme) => theme.archived),
    [requestThemes]
  );

  const selectedTheme = useMemo(() => {
    if (selectedMessageId === GENERAL_THREAD_ID) return null;
    const selected =
      requestThemes.find(
        (theme) =>
          theme.id === selectedMessageId || theme.records.some((entry) => entry.id === selectedMessageId)
      ) ??
      openThemes.find((theme) => cleanText(theme.status) === 'new') ??
      openThemes.find((theme) => cleanText(theme.status) === 'needs_review') ??
      openThemes[0] ??
      archivedThemes[0] ??
      null;
    return selected;
  }, [archivedThemes, openThemes, requestThemes, selectedMessageId]);

  const selectedRequest = useMemo(
    () => selectedTheme?.latestInbound ?? selectedTheme?.latestEntry ?? null,
    [selectedTheme]
  );

  const mergeableThemes = useMemo(
    () =>
      requestThemes.filter(
        (theme) => theme.id !== selectedTheme?.id && !theme.archived && theme.records.length > 0
      ),
    [requestThemes, selectedTheme?.id]
  );
  const themeActionMergeOptions = useMemo(
    () =>
      requestThemes
        .filter((theme) => theme.id !== selectedTheme?.id && theme.records.length > 0)
        .sort((left, right) => cleanText(left.subject).localeCompare(cleanText(right.subject), 'de')),
    [requestThemes, selectedTheme?.id]
  );

  const splitSourceRecord = useMemo(
    () => (selectedTheme && !selectedTheme!.archived ? selectedTheme.latestEntry : null),
    [selectedTheme]
  );

  const isGeneralConversation = selectedMessageId === GENERAL_THREAD_ID;

  const visibleThemes = resolvedThemeListMode === 'archive' ? archivedThemes : openThemes;
  const filteredVisibleThemes = useMemo(() => {
    const needle = themeSearch.toLocaleLowerCase('de-DE').trim();
    return visibleThemes.filter((theme) => matchesThemeSearch(theme, needle));
  }, [themeSearch, visibleThemes]);
  const themePendingDelete = useMemo(
    () => requestThemes.find((theme) => theme.id === themePendingDeleteId) ?? null,
    [requestThemes, themePendingDeleteId]
  );

  const selectedThreadMessages = useMemo(() => {
    if (isGeneralConversation) {
      return [];
    }
    if (!selectedTheme) return [];
    return [...selectedTheme.records].sort(
      (left, right) =>
        formatTimestampSort(right.data.receivedAt ?? right.data.createdAt) -
        formatTimestampSort(left.data.receivedAt ?? left.data.createdAt)
    );
  }, [isGeneralConversation, selectedTheme, tenantMessages]);
  const threadHistoryPanel = (
    <div className="min-w-0 overflow-x-hidden border-b border-stone-200 pb-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Verlauf</p>
      <div className="mt-4 max-h-[72vh] min-w-0 divide-y divide-stone-200 overflow-y-auto overflow-x-hidden border-y border-stone-200 pr-1">
        {!selectedRequest && !isGeneralConversation ? (
          <div className="rounded-[18px] border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-sm text-slate-600">
            Fuer diesen Mieter gibt es noch keine ausgewaehlte Anfrage.
          </div>
        ) : isGeneralConversation ? (
          <div className="rounded-[18px] border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-sm text-slate-600">
            Mit dem Senden entsteht hier ein neues eigenes Thema mit eigenem Verlauf.
          </div>
        ) : (
          selectedThreadMessages.map((entry) => {
            const isOutbound = cleanText(entry.data.direction) === 'outbound';
            const entryType = cleanText(entry.data.entryType);
            const heading =
              entryType === 'note'
                ? 'Interne Notiz'
                : entryType === 'vendor_message'
                  ? `Gewerk: ${cleanText(entry.data.recipientName) || cleanText(entry.data.recipientEmail) || 'Dienstleister'}`
                  : isOutbound
                    ? cleanText(entry.data.subject) || 'Antwort an Mieter'
                    : cleanText(entry.data.fromName || entry.data.subject || entry.data.fromEmail) || 'Vom Mieter';

            return (
              <div
                className={`min-w-0 overflow-x-hidden py-4 ${isOutbound ? 'sm:pl-10' : 'sm:pr-10'}`}
                key={`${tenantId}-${selectedRequest?.id || 'general'}-${entry.id}`}
              >
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <p className="min-w-0 break-words text-sm font-medium text-slate-950">
                    {appendDeliveryLabel(heading, entry.data as Record<string, unknown>)}
                  </p>
                  <span className="shrink-0 text-xs text-slate-500">
                    {formatDateTime(entry.data.receivedAt ?? entry.data.createdAt)}
                  </span>
                </div>
                <p className="mt-2 min-w-0 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                  {cleanText(entry.data.bodyText) || 'Kein Nachrichtentext vorhanden.'}
                </p>
                <MessageAttachmentPreview
                  attachments={entry.data.attachments}
                  onDelete={(attachment) => deleteMessageAttachment(entry.id, entry.data.attachments, attachment)}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  useEffect(() => {
    if (selectedMessageId === GENERAL_THREAD_ID || !selectedRequest) return;
    const currentStatus = cleanText(selectedTheme?.status);
    if (!['new', 'needs_review'].includes(currentStatus)) return;

    void authorizedFetch('/api/admin/message-themes', {
      method: 'POST',
      body: JSON.stringify({
        id: selectedTheme?.id,
        status: 'in_progress',
        tenantId,
        title:
          cleanText(selectedTheme?.subject) ||
          cleanText(selectedRequest.data.subject) ||
          'Thema ohne Betreff',
        messageIds: selectedTheme?.records.map((entry) => entry.id) ?? [selectedRequest.id],
      }),
    })
      .then(() => {
        setMessageThemes((current) =>
          current.some((theme) => theme.id === selectedTheme?.id)
            ? current.map((theme) =>
                theme.id === selectedTheme?.id ? { ...theme, status: 'in_progress' } : theme
              )
            : [
                ...current,
                {
                  archived: false,
                  createdAt: new Date().toISOString(),
                  id: selectedTheme?.id || selectedRequest.id,
                  lastActivityAt: new Date().toISOString(),
                  messageIds: selectedTheme?.records.map((entry) => entry.id) ?? [selectedRequest.id],
                  sourceType: 'tenant_message',
                  status: 'in_progress',
                  tenantId,
                  title:
                    cleanText(selectedTheme?.subject) ||
                    cleanText(selectedRequest.data.subject) ||
                    'Thema ohne Betreff',
                  updatedAt: new Date().toISOString(),
                },
              ]
        );
      })
      .catch((caughtError) => {
        console.error('Fehler beim Aktualisieren des Themenstatus:', caughtError);
      });
  }, [selectedMessageId, selectedRequest, selectedTheme, tenantId]);

  useEffect(() => {
    setThemeTitleDraft(cleanText(selectedTheme?.subject));
    setMergeSourceThemeId('');
    setThemeActionTargetId('');
    setReplyText('');
    setNewMessageSubject('');
    setAiInstruction('');
    setFollowUpDate('');
    setVendorContactId('');
    setComposerMode('tenant');
    setReplyAttachments([]);
  }, [selectedTheme?.id]);

  useEffect(() => {
    setThemeActionTargetId('');
  }, [themeAction]);

  useEffect(() => {
    setContextMode(isGeneralConversation ? 'new' : 'reply');
  }, [isGeneralConversation, selectedTheme?.id]);

  const selectedProperty = useMemo(
    () => properties.find((entry) => entry.id === cleanText(tenant?.propertyId)) ?? null,
    [properties, tenant?.propertyId]
  );
  const selectedCompany = useMemo(
    () =>
      companies.find((entry) => entry.id === cleanText(tenant?.companyId)) ??
      companies.find((entry) => entry.id === cleanText(selectedProperty?.data.ownerId)) ??
      null,
    [companies, selectedProperty?.data.ownerId, tenant?.companyId]
  );
  const tenantContact = useMemo(() => buildTenantContact({ data: tenant ?? {}, id: tenantId }), [tenant, tenantId]);
  const portalSignature = useMemo(
    () =>
      buildPortalSignatureText(
        applyAdminSenderToSignature(
          createSignatureRecord((selectedCompany?.data as Record<string, unknown>) ?? null),
          resolveAdminSenderContact(profile, user)
        )
      ),
    [profile, selectedCompany, user]
  );
  const inferredTenantSalutation = useMemo(
    () =>
      inferSalutationFromMessage(
        tenantMessages.find((entry) => cleanText(entry.data.direction) !== 'outbound')?.data.bodyText as string,
        cleanText(tenant?.lastName)
      ),
    [tenant?.lastName, tenantMessages]
  );
  const selectedUnit = useMemo(() => {
    const units = Array.isArray(selectedProperty?.data.units) ? (selectedProperty.data.units as DocumentData[]) : [];
    return units.find((entry) => cleanText(entry.id) === cleanText(tenant?.unitId)) ?? null;
  }, [selectedProperty?.data.units, tenant?.unitId]);
  const unitInfoLabel = useMemo(() => {
    if (selectedUnit) {
      return dedupeLabelParts([
        selectedUnit.unitLabel,
        selectedUnit.floor,
        selectedUnit.unitPosition,
        selectedUnit.section,
      ]);
    }
    return dedupeLabelParts(String(tenant?.unitLabel ?? '').split('·'));
  }, [selectedUnit, tenant?.unitLabel]);
  const propertyInfoName = useMemo(
    () => cleanText(selectedProperty?.data.name) || cleanText(tenant?.propertyName),
    [selectedProperty?.data.name, tenant?.propertyName]
  );
  const letterRecipientOptions = useMemo(() => {
    const propertyRecipient = {
      address: buildAddressBlock([
        buildAddressLine([selectedProperty?.data.street, selectedProperty?.data.houseNumber]),
        buildAddressLine([selectedProperty?.data.postalCode, selectedProperty?.data.city]),
      ]),
      company: cleanText(tenant?.companyName),
      name: cleanText(tenantContact?.name),
      salutation: cleanText(tenantContact?.salutation || tenant?.salutation || inferredTenantSalutation),
    };

    const companyRecipient = {
      address: buildAddressBlock([
        buildAddressLine([tenant?.companyStreet, tenant?.companyHouseNumber]),
        buildAddressLine([tenant?.companyPostalCode, tenant?.companyCity]),
      ]),
      company: cleanText(tenant?.companyName),
      name: cleanText(tenant?.companyContactName) || cleanText(tenantContact?.name),
      salutation:
        cleanText(tenant?.companyContactSalutation) ||
        cleanText(tenantContact?.salutation || tenant?.salutation || inferredTenantSalutation),
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
  }, [selectedProperty, tenant, tenantContact]);

  const letterRecipient =
    letterRecipientOptions.find((option) => option.key === letterRecipientKey)?.recipient ??
    letterRecipientOptions[0]?.recipient ??
    { address: '', company: '', name: '', salutation: '' };

  useEffect(() => {
    const defaultKey = letterRecipientOptions.some((option) => option.key === 'company')
      ? 'company'
      : 'property';
    setLetterRecipientKey((current) =>
      letterRecipientOptions.some((option) => option.key === current) ? current : defaultKey
    );
  }, [tenantId, letterRecipientOptions]);
  const meterSummary = useMemo(() => {
    const propertyMeters = Array.isArray(selectedProperty?.data.meters)
      ? (selectedProperty.data.meters as DocumentData[])
      : [];
    const unitMeters = Array.isArray(selectedUnit?.meters) ? (selectedUnit.meters as DocumentData[]) : [];
    return [...propertyMeters, ...unitMeters]
      .map((meter) =>
        [cleanText(meter.label || meter.type), cleanText(meter.meterNumber)].filter(Boolean).join(' â€“ ')
      )
      .filter(Boolean);
  }, [selectedProperty?.data.meters, selectedUnit?.meters]);

  const serviceContacts = useMemo(() => {
    const serviceIds = [
      cleanText(selectedProperty?.data.billingServiceId),
      cleanText(selectedProperty?.data.cleaningServiceId),
      cleanText(selectedProperty?.data.electricianId),
      cleanText(selectedProperty?.data.heatingServiceId),
      cleanText(selectedProperty?.data.plumbingServiceId),
      cleanText(selectedProperty?.data.roofMaintenanceId),
    ].filter(Boolean);

    const matching = people.filter((entry) => serviceIds.includes(entry.id));
    return matching.length > 0
      ? matching
      : people.filter((entry) => cleanText(entry.data.email));
  }, [
    people,
    selectedProperty?.data.billingServiceId,
    selectedProperty?.data.cleaningServiceId,
    selectedProperty?.data.electricianId,
    selectedProperty?.data.heatingServiceId,
    selectedProperty?.data.plumbingServiceId,
    selectedProperty?.data.roofMaintenanceId,
  ]);
  const reassignContactOptions = useMemo(() => {
    const tenantOptions = allTenants.map((entry) => {
      const label =
        [cleanText(entry.data.lastName), cleanText(entry.data.firstName)].filter(Boolean).join(', ') ||
        cleanText(entry.data.email) ||
        entry.id;
      const detail = [cleanText(entry.data.propertyName), cleanText(entry.data.unitLabel)]
        .filter(Boolean)
        .join(' · ');
      return {
        email: cleanText(entry.data.email),
        id: `tenant:${entry.id}`,
        label,
        rawId: entry.id,
        searchLabel: `${label} ${detail}`,
        targetType: 'tenant' as const,
      };
    });
    const personOptions = people.map((entry) => {
      const label =
        [cleanText(entry.data.lastName), cleanText(entry.data.firstName)].filter(Boolean).join(', ') ||
        cleanText(entry.data.partnerCompanyName || entry.data.companyName) ||
        cleanText(entry.data.email) ||
        entry.id;
      const detail = cleanText(entry.data.partnerCompanyName || entry.data.companyName);
      return {
        email: cleanText(entry.data.email),
        id: `contact:${entry.id}`,
        label,
        rawId: entry.id,
        searchLabel: `${label} ${detail}`,
        targetType: 'contact' as const,
      };
    });
    return [
      {
        email: cleanText(selectedTheme?.latestInbound?.data.fromEmail),
        id: `new:${encodeURIComponent(cleanText(selectedTheme?.latestInbound?.data.fromEmail))}`,
        label: 'Neu',
        rawId: '__new__',
        searchLabel: 'Neu',
        targetType: 'contact' as const,
      },
      ...tenantOptions,
      ...personOptions,
    ]
      .filter((entry) => entry.rawId !== tenantId || entry.targetType !== 'tenant')
      .sort((left, right) => left.label.localeCompare(right.label, 'de'));
  }, [allTenants, people, tenantId]);
  const propertyServiceRows = useMemo(() => {
    const serviceAssignments = Object.entries(propertyServiceLabelMap)
      .map(([field, label]) => ({
        id: cleanText(selectedProperty?.data?.[field]),
        label,
      }))
      .filter((entry) => entry.id);

    const uniqueAssignments = serviceAssignments.filter(
      (entry, index, array) => array.findIndex((candidate) => candidate.id === entry.id) === index
    );

    return uniqueAssignments
      .map((assignment) => {
        const person = people.find((entry) => entry.id === assignment.id) ?? null;
        if (!person) return null;
        return {
          company: cleanText(person.data.partnerCompanyName || person.data.companyName) || '–',
          email: cleanText(person.data.email) || '–',
          id: person.id,
          label: assignment.label,
          name:
            [cleanText(person.data.lastName), cleanText(person.data.firstName)].filter(Boolean).join(', ') || '–',
          phone: cleanText(person.data.phone || person.data.mobile) || '–',
        };
      })
      .filter(Boolean) as Array<{
      company: string;
      email: string;
      id: string;
      label: string;
      name: string;
      phone: string;
    }>;
  }, [
    people,
    selectedProperty?.data?.billingServiceId,
    selectedProperty?.data?.cleaningServiceId,
    selectedProperty?.data?.electricianId,
    selectedProperty?.data?.heatingServiceId,
    selectedProperty?.data?.plumbingServiceId,
    selectedProperty?.data?.roofMaintenanceId,
  ]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    user
      .getIdToken()
      .then((token) =>
        fetch('/api/admin/mailbox-settings', {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then(async (response) => {
        const result = (await response.json()) as { ok?: boolean; settings?: { inboxEmail?: string } };
        if (!cancelled && response.ok && result.ok && cleanText(result.settings?.inboxEmail)) {
          setSenderEmail(cleanText(result.settings?.inboxEmail));
        }
      })
      .catch((caughtError) => {
        console.error('Fehler beim Laden der Postfach-Einstellungen im Mieterbereich:', caughtError);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function authorizedFetch(url: string, init?: RequestInit) {
    if (!user) throw new Error('Du bist nicht angemeldet.');
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

  async function uploadTenantDocuments(files: FileList | File[] | null, category = 'Sonstiges') {
    if (!files || files.length === 0 || !tenant) return;

    setError('');
    setMessage('');
    setIsUploadingTenantDocument(true);

    try {
      const uploadedDocuments: TenantDocumentEntry[] = [];

      for (const file of Array.from(files)) {
        const safeName = sanitizeStorageFileName(file.name);
        const storagePath = `tenant-documents/${tenantId}/${Date.now()}-${createClientId('file')}-${safeName}`;
        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, file, {
          contentType: file.type || 'application/octet-stream',
        });

        uploadedDocuments.push({
          category,
          contentType: file.type || 'application/octet-stream',
          name: file.name,
          path: storagePath,
          size: file.size,
          source: 'upload',
          uploadedAt: new Date().toISOString(),
          uploadedByEmail: user?.email ?? '',
          url: await getDownloadURL(storageRef),
        });
      }

      await updateDoc(doc(db, 'tenants', tenantId), {
        tenantDocuments: [...tenantDocuments, ...uploadedDocuments],
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });

      setMessage(uploadedDocuments.length === 1 ? 'Dokument wurde hochgeladen.' : 'Dokumente wurden hochgeladen.');
    } catch (caughtError) {
      console.error(`Fehler beim Hochladen von Dokumenten fuer Mieter ${tenantId}:`, caughtError);
      setError('Dokumente konnten nicht hochgeladen werden.');
    } finally {
      setIsUploadingTenantDocument(false);
    }
  }

  async function deleteTenantDocument(targetDocument: TenantDocumentEntry) {
    const confirmed = window.confirm(`Dokument "${targetDocument.name}" wirklich löschen?`);
    if (!confirmed) return;

    setError('');
    setMessage('');
    setDeletingTenantDocumentPath(targetDocument.path || targetDocument.url);

    try {
      if (targetDocument.path) {
        await deleteObject(ref(storage, targetDocument.path));
      }

      await updateDoc(doc(db, 'tenants', tenantId), {
        tenantDocuments: tenantDocuments.filter(
          (document) =>
            (targetDocument.path && document.path !== targetDocument.path) ||
            (!targetDocument.path && document.url !== targetDocument.url)
        ),
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });

      setMessage('Dokument wurde gelöscht.');
    } catch (caughtError) {
      console.error(`Fehler beim Loeschen eines Dokuments fuer Mieter ${tenantId}:`, caughtError);
      setError('Dokument konnte nicht gelöscht werden.');
    } finally {
      setDeletingTenantDocumentPath('');
    }
  }

  async function deleteLegacyTenantDocument(fieldName: string, documentName: string) {
    const confirmed = window.confirm(`Alten Dateieintrag "${documentName}" wirklich löschen?`);
    if (!confirmed) return;

    setError('');
    setMessage('');

    try {
      await updateDoc(doc(db, 'tenants', tenantId), {
        [fieldName]: '',
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });
      setMessage('Alter Dateieintrag wurde gelöscht.');
    } catch (caughtError) {
      console.error(`Fehler beim Löschen des alten Dateieintrags ${documentName}:`, caughtError);
      setError('Alter Dateieintrag konnte nicht gelöscht werden.');
    }
  }

  async function updateTenantDocumentCategory(targetDocument: TenantDocumentEntry, category: string) {
    setError('');
    setMessage('');

    try {
      await updateDoc(doc(db, 'tenants', tenantId), {
        tenantDocuments: tenantDocuments.map((document) =>
          (targetDocument.path && document.path === targetDocument.path) ||
          (!targetDocument.path && document.url === targetDocument.url)
            ? { ...document, category }
            : document
        ),
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });
      setMessage('Kategorie wurde aktualisiert.');
    } catch (caughtError) {
      console.error(`Fehler beim Aktualisieren der Kategorie fuer Mieter ${tenantId}:`, caughtError);
      setError('Kategorie konnte nicht gespeichert werden.');
    }
  }

  async function endTenancy() {
    if (!tenant || cleanText(tenant.status) === 'inactive') return;
    const confirmed = window.confirm(
      'Mietverhaeltnis beenden? Das Mieterprofil, Chat, Dateien und Kontaktfunktion bleiben erhalten.'
    );
    if (!confirmed) return;

    const propertyId = cleanText(tenant.propertyId);
    const unitId = cleanText(tenant.unitId);
    const today = new Date().toISOString().slice(0, 10);

    setError('');
    setMessage('');
    setIsEndingTenancy(true);

    try {
      await updateDoc(doc(db, 'tenants', tenantId), {
        moveOutDate: firstNonEmptyValue(tenantRecord, [
          'moveOutDate',
          'leaseEndDate',
          'tenancyEndDate',
          'contractEndDate',
        ]) || today,
        status: 'inactive',
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });

      const property = properties.find((entry) => entry.id === propertyId);
      const units = Array.isArray(property?.data.units) ? property.data.units : [];
      if (property && unitId) {
        const nextUnits = units.map((unit: DocumentData) =>
          cleanText(unit?.id) === unitId && cleanText(unit?.tenantId) === tenantId
            ? { ...unit, tenantId: '', tenantName: '' }
            : unit
        );
        await updateDoc(doc(db, 'properties', property.id), {
          units: nextUnits,
          updatedAt: serverTimestamp(),
        });
      }

      setMessage('Mietverhaeltnis wurde beendet. Chat, Dateien und Kontaktfunktion bleiben erhalten.');
    } catch (caughtError) {
      console.error(`Fehler beim Beenden des Mietverhaeltnisses ${tenantId}:`, caughtError);
      setError('Das Mietverhaeltnis konnte nicht beendet werden.');
    } finally {
      setIsEndingTenancy(false);
    }
  }

  async function deleteMessageAttachment(messageId: string, attachments: unknown, targetAttachment: MessageAttachmentEntry) {
    const confirmed = window.confirm(`Anhang "${targetAttachment.name}" wirklich löschen?`);
    if (!confirmed) return;

    const currentAttachments = Array.isArray(attachments) ? attachments : [];

    setError('');
    setMessage('');

    try {
      if (targetAttachment.path) {
        await deleteObject(ref(storage, targetAttachment.path));
      }

      await updateDoc(doc(db, 'messages', messageId), {
        attachments: currentAttachments.filter((entry) => {
          if (!entry || typeof entry !== 'object') return true;
          const record = entry as Record<string, unknown>;
          const path = cleanText(record.path);
          const url = cleanText(record.url ?? record.downloadUrl ?? record.href);
          return targetAttachment.path ? path !== targetAttachment.path : url !== targetAttachment.url;
        }),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'tenants', tenantId), {
        tenantDocuments: tenantDocuments.filter((document) =>
          targetAttachment.path ? document.path !== targetAttachment.path : document.url !== targetAttachment.url
        ),
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });
      setMessage('Anhang wurde gelöscht.');
    } catch (caughtError) {
      console.error(`Fehler beim Löschen des Anhangs ${targetAttachment.name}:`, caughtError);
      setError('Anhang konnte nicht gelöscht werden.');
    }
  }

  async function downloadHandoverProtocol(kind: 'moveIn' | 'moveOut') {
    const templateUrl = cleanText(
      kind === 'moveIn'
        ? selectedCompany?.data.handoverMoveInTemplateUrl
        : selectedCompany?.data.handoverMoveOutTemplateUrl
    );
    if (!templateUrl) {
      setError(
        kind === 'moveIn'
          ? 'Fuer diese Firma ist noch keine Vorlage fuer das Uebergabeprotokoll Einzug hinterlegt.'
          : 'Fuer diese Firma ist noch keine Vorlage fuer das Uebergabeprotokoll Auszug hinterlegt.'
      );
      return;
    }

    const subject = kind === 'moveIn' ? 'Uebergabeprotokoll Einzug' : 'Uebergabeprotokoll Auszug';
    const subjectLine2 = buildLetterSubjectLine2(selectedProperty, unitInfoLabel || cleanText(tenant?.unitLabel));
    const signatureRecord = applyAdminSenderToSignature(
      createSignatureRecord((selectedCompany?.data as Record<string, unknown>) ?? null),
      resolveAdminSenderContact(profile, user)
    );

    try {
      setError('');
      await downloadFilledLetterTemplate({
        fallbackHtml: `<h1>${subject}</h1><p>${subjectLine2}</p>`,
        fileName: subject,
        getAuthToken: user ? () => user.getIdToken() : undefined,
        replacements: buildLetterTemplateReplacements({
          body: subject,
          closing: signatureRecord.letterClosing || signatureRecord.closing,
          companyName: signatureRecord.companyName,
          recipientAddress: letterRecipient.address,
          recipientCompany: letterRecipient.company,
          recipientName: letterRecipient.name,
          recipientSalutation: letterRecipient.salutation,
          senderName: signatureRecord.name,
          subject,
          subjectLine2,
        }),
        templateUrl,
      });
    } catch (caughtError) {
      console.error('Fehler beim Erstellen des Uebergabeprotokolls:', caughtError);
      setError('Das Uebergabeprotokoll konnte nicht erstellt werden.');
    }
  }

  async function saveMobileHandoverProtocol() {
    if (!tenant) return;
    const hasContent = Object.values(handoverForm).some((value) => cleanText(value));
    if (!hasContent) {
      setError('Bitte mindestens eine Angabe für das Übergabeprotokoll eintragen.');
      return;
    }

    try {
      setError('');
      const currentProtocols = Array.isArray(tenant.handoverProtocols)
        ? tenant.handoverProtocols
        : [];
      await updateDoc(doc(db, 'tenants', tenantId), {
        handoverProtocols: [
          ...currentProtocols,
          {
            ...handoverForm,
            createdAt: new Date().toISOString(),
            createdByEmail: user?.email ?? null,
            kind: handoverProtocolKind,
            propertyId: cleanText(tenant.propertyId),
            propertyName: cleanText(selectedProperty?.data.name),
            unitId: cleanText(tenant.unitId),
            unitLabel: unitInfoLabel || cleanText(tenant.unitLabel),
          },
        ],
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });
      setHandoverForm({
        condition: '',
        defects: '',
        handedOverKeys: '',
        meterReadings: '',
        notes: '',
        place: '',
        tenantSignatureName: '',
      });
      setMessage('Übergabeprotokoll wurde gespeichert.');
    } catch (caughtError) {
      console.error('Fehler beim Speichern des Übergabeprotokolls:', caughtError);
      setError('Das Übergabeprotokoll konnte nicht gespeichert werden.');
    }
  }

  async function saveThemeMeta(
    themeId: string,
    payload: {
      archived: boolean;
      reminderDate?: string;
      status: 'done' | 'in_progress' | 'needs_review' | 'new';
      title?: string;
    }
  ) {
    const currentTheme = requestThemes.find((theme) => theme.id === themeId) ?? selectedTheme ?? null;
    const currentThemeMeta = messageThemes.find((theme) => theme.id === themeId) ?? null;
    const currentRequest =
      currentTheme?.latestInbound ??
      currentTheme?.latestEntry ??
      selectedRequest ??
      tenantMessages.find((entry) => entry.id === themeId) ??
      null;
    const nextTitle =
      cleanText(payload.title) ||
      cleanText(currentTheme?.subject) ||
      cleanText(currentThemeMeta?.title) ||
      cleanText(currentRequest?.data.subject) ||
      'Thema ohne Betreff';
    const messageIds =
      currentTheme?.records.map((entry) => entry.id) ??
      (Array.isArray(currentThemeMeta?.messageIds) ? currentThemeMeta.messageIds : []) ??
      (currentRequest ? [currentRequest.id] : []);

    const response = await authorizedFetch('/api/admin/message-themes', {
      method: 'POST',
      body: JSON.stringify({
        archived: payload.archived,
        id: themeId,
        messageIds,
        reminderDate: cleanText(payload.reminderDate) || undefined,
        status: payload.status,
        tenantId,
        title: nextTitle,
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
              ? {
                  ...theme,
                  archived: payload.archived,
                  lastActivityAt: now,
                  reminderDate: cleanText(payload.reminderDate) || undefined,
                  status: payload.status,
                  title: nextTitle || theme.title || 'Thema ohne Betreff',
                  updatedAt: now,
                }
              : theme
          )
        : current;
    });
  }

  async function updateThemeState(
    themeId: string,
    status: 'done' | 'in_progress' | 'needs_review' | 'new',
    archived: boolean
  ) {
    await saveThemeMeta(themeId, { archived, status });
  }

  async function saveThemeTitle() {
    if (!selectedTheme) return;
    const nextTitle =
      cleanText(themeTitleDraft) ||
      cleanText(selectedTheme.subject) ||
      buildThemeTitle(cleanText(selectedTheme.latestEntry?.data.bodyText), 'Thema ohne Betreff');

    await saveThemeMeta(selectedTheme!.id, {
      archived: Boolean(selectedTheme!.archived),
      reminderDate: cleanText(selectedTheme.reminderDate) || undefined,
      status: (cleanText(selectedTheme.status) as 'done' | 'in_progress' | 'needs_review' | 'new') || 'in_progress',
      title: nextTitle,
    });
    setThemeTitleDraft(nextTitle);
  }

  function extractThemeAttachmentDocuments(theme: MessageTheme) {
    const attachmentByKey = new Map<string, TenantDocumentEntry>();

    theme.records.forEach((record) => {
      const attachments = Array.isArray(record.data.attachments) ? record.data.attachments : [];
      attachments.forEach((attachment) => {
        if (!attachment || typeof attachment !== 'object') return;
        const raw = attachment as Record<string, unknown>;
        const path = cleanText(raw.path);
        const url = cleanText(raw.url ?? raw.downloadUrl ?? raw.href);
        const key = path || url;
        if (!key || attachmentByKey.has(key)) return;
        attachmentByKey.set(key, {
          category: 'Anhänge',
          contentType: cleanText(raw.contentType) || 'application/octet-stream',
          name: cleanText(raw.name ?? raw.fileName) || 'Anhang',
          path,
          size: Number(raw.size) || 0,
          source: 'message-attachment',
          uploadedAt: cleanText(raw.uploadedAt ?? record.data.receivedAt ?? record.data.createdAt) || new Date().toISOString(),
          uploadedByEmail: user?.email ?? '',
          url,
        });
      });
    });

    return Array.from(attachmentByKey.values());
  }

  async function reassignSelectedTheme(targetValue: string) {
    if (!selectedTheme) return;
    const [targetType, targetId] = targetValue.split(':');
    if (targetType === 'new') {
      const email = decodeURIComponent(targetId || cleanText(selectedTheme.latestInbound?.data.fromEmail));
      router.push(`/admin/personen?email=${encodeURIComponent(email)}&fromMessageId=${encodeURIComponent(selectedTheme.latestEntry.id)}`);
      return;
    }
    if (!targetId || (targetType !== 'tenant' && targetType !== 'contact')) {
      throw new Error('Bitte einen Empfaenger fuer die Neu-Zuordnung auswaehlen.');
    }

    const targetTenant = targetType === 'tenant' ? allTenants.find((entry) => entry.id === targetId) ?? null : null;
    const targetPerson = targetType === 'contact' ? people.find((entry) => entry.id === targetId) ?? null : null;
    if (targetType === 'tenant' && !targetTenant) {
      throw new Error('Der ausgewaehlte Mieter wurde nicht gefunden.');
    }
    if (targetType === 'contact' && !targetPerson) {
      throw new Error('Der ausgewaehlte Kontakt wurde nicht gefunden.');
    }

    const targetName =
      targetTenant
        ? [cleanText(targetTenant.data.lastName), cleanText(targetTenant.data.firstName)].filter(Boolean).join(', ')
        : targetPerson
          ? [cleanText(targetPerson.data.lastName), cleanText(targetPerson.data.firstName)].filter(Boolean).join(', ') ||
            cleanText(targetPerson.data.partnerCompanyName || targetPerson.data.companyName)
          : '';
    const targetEmail = targetTenant
      ? cleanText(targetTenant.data.email)
      : cleanText(targetPerson?.data.email);
    const firestoreMessageIds = new Set(firestoreMessages.map((entry) => entry.id));
    const messageUpdates = selectedTheme.records
      .filter((record) => firestoreMessageIds.has(record.id))
      .map((record) =>
        updateDoc(doc(db, 'messages', record.id), {
          contactId: targetType === 'contact' ? targetId : '',
          propertyId: targetTenant ? cleanText(targetTenant.data.propertyId) : cleanText(record.data.propertyId),
          recipientEmail: targetEmail,
          recipientId: targetId,
          recipientName: targetName,
          recipientType: targetType,
          tenantId: targetType === 'tenant' ? targetId : '',
          tenantLabel: targetType === 'tenant' ? targetName : '',
          unitId: targetTenant ? cleanText(targetTenant.data.unitId) : cleanText(record.data.unitId),
          updatedAt: serverTimestamp(),
        })
      );
    await Promise.all(messageUpdates);

    const movedDocuments = extractThemeAttachmentDocuments(selectedTheme);
    if (movedDocuments.length > 0) {
      const movedKeys = new Set(movedDocuments.map((entry) => entry.path || entry.url).filter(Boolean));
      await updateDoc(doc(db, 'tenants', tenantId), {
        tenantDocuments: tenantDocuments.filter((entry) => !movedKeys.has(entry.path || entry.url)),
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });

      if (targetType === 'tenant' && targetTenant) {
        const currentDocuments = cleanTenantDocuments(targetTenant.data.tenantDocuments);
        const existingKeys = new Set(currentDocuments.map((entry) => entry.path || entry.url).filter(Boolean));
        const nextDocuments = movedDocuments.filter((entry) => !existingKeys.has(entry.path || entry.url));
        if (nextDocuments.length > 0) {
          await updateDoc(doc(db, 'tenants', targetId), {
            tenantDocuments: [...currentDocuments, ...nextDocuments],
            updatedAt: serverTimestamp(),
            updatedByEmail: user?.email ?? null,
            updatedByUid: user?.uid ?? null,
          });
        }
      }

      if (targetType === 'contact' && targetPerson) {
        const currentDocuments = cleanTenantDocuments(targetPerson.data.personDocuments);
        const existingKeys = new Set(currentDocuments.map((entry) => entry.path || entry.url).filter(Boolean));
        const nextDocuments = movedDocuments.filter((entry) => !existingKeys.has(entry.path || entry.url));
        if (nextDocuments.length > 0) {
          await updateDoc(doc(db, 'people', targetId), {
            personDocuments: [...currentDocuments, ...nextDocuments],
            updatedAt: serverTimestamp(),
            updatedByEmail: user?.email ?? null,
            updatedByUid: user?.uid ?? null,
          });
        }
      }
    }

    const nextTitle =
      cleanText(themeTitleDraft) ||
      cleanText(selectedTheme.subject) ||
      cleanText(selectedTheme.latestEntry?.data.subject) ||
      'Thema ohne Betreff';
    if (targetType === 'tenant') {
      await authorizedFetch('/api/admin/message-themes', {
        method: 'POST',
        body: JSON.stringify({
          archived: Boolean(selectedTheme.archived),
          id: selectedTheme.id,
          lastActivityAt: new Date().toISOString(),
          messageIds: selectedTheme.records.map((entry) => entry.id),
          reminderDate: cleanText(selectedTheme.reminderDate) || undefined,
          status: (cleanText(selectedTheme.status) as 'done' | 'in_progress' | 'needs_review' | 'new') || 'in_progress',
          tenantId: targetId,
          title: nextTitle,
        }),
      });
      router.push(messageHrefBuilder(targetId, selectedTheme.id));
      return;
    }

    router.push(`/admin/personen/${targetId}`);
  }

  async function runThemeAction() {
    if (!selectedTheme || isGeneralConversation) return;
    setMessage('');
    setError('');

    try {
      if (themeAction === 'done') {
        await updateThemeState(selectedTheme.id, 'done', true);
        router.push(messageHrefBuilder(tenantId, ''));
        setMessage('Thema wurde ins Archiv verschoben.');
        return;
      }
      if (themeAction === 'split') {
        await splitSelectedTheme();
        setMessage('Neues Thema wurde abgesplittet.');
        return;
      }
      if (themeAction === 'merge') {
        await mergeThemeIntoSelected(themeActionTargetId);
        setMessage('Themen wurden zusammengefuehrt.');
        return;
      }
      if (themeAction === 'reassign') {
        await reassignSelectedTheme(themeActionTargetId);
        setMessage('Thema wurde neu zugeordnet.');
        return;
      }

      await saveThemeTitle();
      setMessage('Thementitel wurde gespeichert.');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Die Aktion konnte nicht ausgefuehrt werden.');
    }
  }

  async function appendLocalThemeEntry(payload: {
    bodyText: string;
    entryType: 'admin_message' | 'note' | 'vendor_message';
    recipientEmail?: string;
    recipientId?: string;
    recipientName?: string;
    recipientType: 'contact' | 'tenant';
    subject: string;
    themeId?: string;
    visibleToTenant: boolean;
    deliveryMode?: DeliveryMode;
  }) {
    const entryId = createClientId('entry');
    const currentThemeId = cleanText(payload.themeId) || cleanText(selectedTheme?.id);
    if (!currentThemeId) return;
    const createdAt = new Date().toISOString();
    await authorizedFetch('/api/admin/local-portal-messages', {
      method: 'POST',
      body: JSON.stringify({
        action: 'append',
        bodyText: payload.bodyText,
        createdAt,
        entryType: payload.entryType,
        messageId: entryId,
        propertyId: cleanText(tenant?.propertyId),
        recipientEmail: cleanText(payload.recipientEmail),
        recipientId: cleanText(payload.recipientId) || tenantId,
        recipientName: cleanText(payload.recipientName),
        recipientType: payload.recipientType,
        relatedMessageId: currentThemeId,
        deliveryMode: payload.deliveryMode,
        status: payload.visibleToTenant ? 'sent' : 'in_progress',
        subject: payload.subject,
        tenantId,
        unitId: cleanText(tenant?.unitId),
        visibleToTenant: payload.visibleToTenant,
      }),
    });
    setLocalPortalMessages((current) => [
      {
        data: {
          bodyText: payload.bodyText,
          channel: 'portal',
          createdAt,
          direction: 'outbound',
          entryType: payload.entryType,
          fromEmail: senderEmail,
          fromName: 'Halbmann Holding',
          priority: 'normal',
          propertyId: cleanText(tenant?.propertyId),
          receivedAt: createdAt,
          recipientEmail: cleanText(payload.recipientEmail),
          recipientId: cleanText(payload.recipientId) || tenantId,
          recipientName: cleanText(payload.recipientName),
          recipientType: payload.recipientType,
          relatedMessageId: currentThemeId,
          deliveryMode: payload.deliveryMode,
          status: payload.visibleToTenant ? 'sent' : 'in_progress',
          subject: payload.subject,
          tenantId,
          unitId: cleanText(tenant?.unitId),
          visibleToTenant: payload.visibleToTenant,
        },
        id: entryId,
      },
      ...current,
    ]);
    setMessageThemes((current) => {
      const nextTitle =
        cleanText(payload.subject) ||
        current.find((theme) => theme.id === currentThemeId)?.title ||
        'Thema ohne Betreff';
      const nextTheme = {
        archived: false,
        createdAt,
        id: currentThemeId,
        lastActivityAt: createdAt,
        messageIds: Array.from(
          new Set([
            entryId,
            ...(current.find((theme) => theme.id === currentThemeId)?.messageIds ?? []),
          ])
        ),
        sourceType:
          (current.find((theme) => theme.id === currentThemeId)?.sourceType as
            | 'admin_message'
            | 'manual'
            | 'tenant_message'
            | undefined) || 'admin_message',
        status:
          (current.find((theme) => theme.id === currentThemeId)?.status as
            | 'done'
            | 'in_progress'
            | 'needs_review'
            | 'new'
            | undefined) || 'in_progress',
        tenantId,
        title: nextTitle,
        updatedAt: createdAt,
      };
      return current.some((theme) => theme.id === currentThemeId)
        ? current.map((theme) => (theme.id === currentThemeId ? { ...theme, ...nextTheme } : theme))
        : [nextTheme, ...current];
    });
  }

  async function mergeThemeIntoSelected(sourceThemeId: string) {
    if (!selectedTheme || !sourceThemeId) return;
    const sourceTheme = requestThemes.find((theme) => theme.id === sourceThemeId) ?? null;
    if (!sourceTheme) {
      throw new Error('Das ausgewaehlte Thema wurde nicht gefunden.');
    }

    const mergedMessageIds = Array.from(
      new Set([
        ...selectedTheme.records.map((entry) => entry.id),
        ...sourceTheme.records.map((entry) => entry.id),
      ])
    );
    const now = new Date().toISOString();

    const targetResponse = await authorizedFetch('/api/admin/message-themes', {
      method: 'POST',
      body: JSON.stringify({
        archived: false,
        id: selectedTheme!.id,
        lastActivityAt: now,
        messageIds: mergedMessageIds,
        sourceType: selectedTheme.sourceType || 'tenant_message',
        status: 'in_progress',
        tenantId,
        title: cleanText(selectedTheme.subject) || 'Thema ohne Betreff',
      }),
    });
    const targetResult = (await targetResponse.json()) as { ok?: boolean; error?: string };
    if (!targetResponse.ok || !targetResult.ok) {
      throw new Error(targetResult.error || 'Das Zielthema konnte nicht aktualisiert werden.');
    }

    const sourceResponse = await authorizedFetch('/api/admin/message-themes', {
      method: 'POST',
      body: JSON.stringify({
        archived: true,
        id: sourceTheme.id,
        lastActivityAt: now,
        mergedIntoThemeId: selectedTheme!.id,
        messageIds: [],
        sourceType: sourceTheme.sourceType || 'tenant_message',
        status: 'done',
        tenantId,
        title: cleanText(sourceTheme.subject) || 'Zusammengefuehrtes Thema',
      }),
    });
    const sourceResult = (await sourceResponse.json()) as { ok?: boolean; error?: string };
    if (!sourceResponse.ok || !sourceResult.ok) {
      throw new Error(sourceResult.error || 'Das Quellthema konnte nicht abgeschlossen werden.');
    }

    setMessageThemes((current) => {
      const next = [...current];
      const targetIndex = next.findIndex((theme) => theme.id === selectedTheme!.id);
      const sourceIndex = next.findIndex((theme) => theme.id === sourceTheme.id);

      const targetThemeRecord = {
        archived: false,
        createdAt: next[targetIndex]?.createdAt ?? now,
        id: selectedTheme!.id,
        lastActivityAt: now,
        messageIds: mergedMessageIds,
        sourceType: (selectedTheme.sourceType as 'admin_message' | 'manual' | 'tenant_message') || 'tenant_message',
        status: 'in_progress' as const,
        tenantId,
        title: cleanText(selectedTheme.subject) || 'Thema ohne Betreff',
        updatedAt: now,
      };

      const sourceThemeRecord = {
        archived: true,
        createdAt: next[sourceIndex]?.createdAt ?? now,
        id: sourceTheme.id,
        lastActivityAt: now,
        mergedIntoThemeId: selectedTheme!.id,
        messageIds: [],
        sourceType: (sourceTheme.sourceType as 'admin_message' | 'manual' | 'tenant_message') || 'tenant_message',
        status: 'done' as const,
        tenantId,
        title: cleanText(sourceTheme.subject) || 'Zusammengefuehrtes Thema',
        updatedAt: now,
      };

      if (targetIndex >= 0) {
        next[targetIndex] = targetThemeRecord;
      } else {
        next.push(targetThemeRecord);
      }

      if (sourceIndex >= 0) {
        next[sourceIndex] = sourceThemeRecord;
      } else {
        next.push(sourceThemeRecord);
      }

      return next;
    });
    setMergeSourceThemeId('');
  }

  async function saveInternalNote() {
    if (!selectedTheme || !cleanText(replyText)) {
      throw new Error('Bitte eine interne Notiz eingeben.');
    }
    await appendLocalThemeEntry({
      bodyText: cleanText(replyText),
      entryType: 'note',
      recipientType: 'tenant',
      subject: 'Interne Notiz',
      visibleToTenant: false,
    });
    setReplyText('');
    setDeliveryMode('email');
    setComposerMode('tenant');
  }

  async function saveOutgoingAttachmentsAsTenantDocuments(
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
    const attachmentDocuments: TenantDocumentEntry[] = uploadedAttachments.map((attachment) => ({
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
    await updateDoc(doc(db, 'tenants', tenantId), {
      tenantDocuments: [...tenantDocuments, ...attachmentDocuments],
      updatedAt: serverTimestamp(),
      updatedByEmail: user?.email ?? null,
      updatedByUid: user?.uid ?? null,
    });
  }

  async function sendVendorMessage() {
    if (!selectedTheme || !cleanText(replyText)) {
      throw new Error('Bitte eine Nachricht an das Gewerk eingeben.');
    }
    const recipient = serviceContacts.find((entry) => entry.id === vendorContactId) ?? null;
    if (!recipient) {
      throw new Error('Bitte ein Gewerk auswählen.');
    }
    const recipientEmail = cleanText(recipient.data.email);
    if (!recipientEmail) {
      throw new Error('Beim ausgewählten Gewerk ist keine E-Mail hinterlegt.');
    }

    const signatureRecord = applyAdminSenderToSignature(
      createSignatureRecord((selectedCompany?.data as Record<string, unknown>) ?? null),
      resolveAdminSenderContact(profile, user)
    );
    const subject = cleanText(selectedTheme.subject) || 'Rückfrage zu einem Thema';
    const uploadedAttachments = await uploadOutgoingMessageAttachments(
      replyAttachments,
      `tenant-vendor-${tenantId}-${selectedTheme.id}`
    );
    const draftRef = await addDoc(collection(db, 'messageDrafts'), {
      attachments: uploadedAttachments,
      body: mergeBodyWithSignature(cleanText(replyText), signatureRecord),
      createdAt: serverTimestamp(),
      kind: 'reply_to_service',
      messageId: selectedTheme!.id,
      portalBodyText: cleanText(replyText),
      propertyId: cleanText(tenant?.propertyId),
      recipientEmail,
      recipientId: recipient.id,
      recipientType: 'contact',
      signature: signatureRecord,
      status: 'draft',
      subject,
      ticketId: null,
      unitId: cleanText(tenant?.unitId),
      updatedAt: serverTimestamp(),
    });
    const response = await authorizedFetch('/api/message-drafts/send', {
      method: 'POST',
      body: JSON.stringify({ draftId: draftRef.id }),
    });
    const result = (await response.json()) as { error?: string; ok?: boolean };
    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Das Gewerk konnte nicht benachrichtigt werden.');
    }
    await saveOutgoingAttachmentsAsTenantDocuments(uploadedAttachments);

    await appendLocalThemeEntry({
      bodyText: cleanText(replyText),
      entryType: 'vendor_message',
      recipientEmail,
      recipientId: recipient.id,
      recipientName: buildPersonLabel(recipient),
      recipientType: 'contact',
      subject,
      visibleToTenant: false,
    });
    setReplyText('');
    setReplyAttachments([]);
    setVendorContactId('');
  }

  async function splitSelectedTheme() {
    if (!selectedTheme || !splitSourceRecord) return;
    const baseTitle =
      cleanText(splitSourceRecord.data.subject) ||
      buildThemeTitle(cleanText(splitSourceRecord.data.bodyText), 'Abgesplittetes Thema');
    const newThemeId = createClientId('theme');
    const now = new Date().toISOString();

    const targetResponse = await authorizedFetch('/api/admin/message-themes', {
      method: 'POST',
      body: JSON.stringify({
        archived: false,
        id: newThemeId,
        lastActivityAt: now,
        messageIds: [splitSourceRecord.id],
        sourceType: 'manual',
        status: 'new',
        tenantId,
        title: baseTitle,
      }),
    });
    const targetResult = (await targetResponse.json()) as { ok?: boolean; error?: string };
    if (!targetResponse.ok || !targetResult.ok) {
      throw new Error(targetResult.error || 'Das neue Thema konnte nicht erstellt werden.');
    }

    setMessageThemes((current) => {
      const next = [...current];
      const newThemeRecord = {
        archived: false,
        createdAt: now,
        id: newThemeId,
        lastActivityAt: now,
        messageIds: [splitSourceRecord.id],
        sourceType: 'manual' as const,
        status: 'new' as const,
        tenantId,
        title: baseTitle,
        updatedAt: now,
      };
      next.push(newThemeRecord);
      return next;
    });
  }

  async function deleteTheme(themeId: string) {
    const theme = requestThemes.find((entry) => entry.id === themeId) ?? null;
    if (!theme) {
      throw new Error('Das Thema wurde nicht gefunden.');
    }

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
        tenantId,
        title: cleanText(theme.subject) || 'Geloeschtes Thema',
      }),
    });
    const result = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Das Thema konnte nicht geloescht werden.');
    }

    setMessageThemes((current) =>
      current.some((entry) => entry.id === theme.id)
        ? current.map((entry) =>
            entry.id === theme.id
              ? {
                  ...entry,
                  archived: true,
                  deleted: true,
                  status: 'done',
                  updatedAt: new Date().toISOString(),
                }
              : entry
          )
        : [
            ...current,
            {
              archived: true,
              createdAt: new Date().toISOString(),
              deleted: true,
              id: theme.id,
              lastActivityAt: new Date().toISOString(),
              messageIds: theme.records.map((entry) => entry.id),
              sourceType: (theme.sourceType as 'admin_message' | 'manual' | 'tenant_message') || 'manual',
              status: 'done',
              tenantId,
              title: cleanText(theme.subject) || 'Geloeschtes Thema',
              updatedAt: new Date().toISOString(),
            },
          ]
    );

    if (selectedTheme?.id === theme.id) {
      router.push(messageHrefBuilder(tenantId, ''));
    }
  }

  async function generateAiDraft() {
    if (!tenant) return;
    setMessage('');
    setError('');
    setIsGeneratingAiDraft(true);
    try {
      const latestInbound =
        contextMode === 'reply'
          ? selectedRequest ??
            tenantMessages.find((entry) => cleanText(entry.data.direction) !== 'outbound') ??
            null
          : null;
      const currentBody = cleanText(replyText).endsWith(portalSignature)
        ? cleanText(replyText).slice(0, cleanText(replyText).length - portalSignature.length).trimEnd()
        : cleanText(replyText);
      const response = await authorizedFetch('/api/ai/message-reply-draft', {
              method: 'POST',
              body: JSON.stringify({
                companyName: cleanText(selectedCompany?.data.name),
                contextMode,
                currentBody,
                deliveryMode,
                contextBundle: sanitizeAiContext({
                  selected: {
                    company: selectedCompany,
                    property: selectedProperty,
                    tenant: { data: tenant, id: tenantId },
                    tenantContact,
                    unit: selectedUnit,
                  },
                  collections: {
                    companies,
                    contacts: people,
                    properties,
                    tenants: allTenants,
                  },
                  documents: tenantDocuments,
                  messages: selectedThreadMessages.map((entry) => ({
                    createdAt: entry.data.createdAt,
                    direction: entry.data.direction,
                    fromEmail: entry.data.fromEmail,
                    fromName: entry.data.fromName,
                    subject: entry.data.subject,
                    text: entry.data.bodyText,
                    toEmail: entry.data.toEmail,
                  })),
                  themes: requestThemes.map((entry) => ({
                    id: entry.id,
                    lastActivityAt: entry.latestActivityAt,
                    status: entry.status,
                    subject: entry.subject,
                  })),
                }),
                historyText:
                  contextMode === 'reply'
                    ? selectedThreadMessages
                        .slice(-6)
                        .map((entry) => cleanText(entry.data.bodyText))
                        .filter(Boolean)
                        .join('\n\n')
                    : '',
                instruction: aiInstruction,
                issueText: contextMode === 'reply' ? cleanText(latestInbound?.data.bodyText) : '',
                meters: contextMode === 'reply' ? meterSummary : [],
                propertyName: contextMode === 'reply' ? cleanText(selectedProperty?.data.name) : '',
                recipientEmail: cleanText(tenant.email),
                recipientName: cleanText(tenantContact?.name),
                recipientSalutation: cleanText(tenantContact?.salutation || tenant.salutation || inferredTenantSalutation),
                senderEmail,
                subject:
                  contextMode === 'reply'
                    ? cleanText(latestInbound?.data.subject) || cleanText(selectedTheme?.subject) || 'Nachricht an den Mieter'
                    : cleanText(newMessageSubject) || 'Neue Nachricht an den Mieter',
                unitLabel: contextMode === 'reply' ? cleanText(tenant.unitLabel) : '',
              }),
            });
      const result = (await response.json()) as { draftText?: string; error?: string; ok?: boolean };
      if (!response.ok || !result.ok || !result.draftText) {
        throw new Error(result.error || 'Der KI-Entwurf konnte nicht erzeugt werden.');
      }
      let nextReplyText =
        deliveryMode === 'letter'
          ? stripAiEnvelope(result.draftText)
          : composePortalDraft({
        aiText: result.draftText,
        contextText: contextMode === 'reply' ? cleanText(latestInbound?.data.bodyText) : '',
        portalSignature,
        recipientName: cleanText(tenantContact?.name),
        recipientSalutation: cleanText(tenantContact?.salutation || tenant.salutation || inferredTenantSalutation),
      });
      setReplyText(nextReplyText);
      setMessage('KI-Entwurf wurde erzeugt.');
    } catch (caughtError) {
      console.error('Fehler beim KI-Entwurf im Mieterbereich:', caughtError);
      setError(caughtError instanceof Error ? caughtError.message : 'Der KI-Entwurf konnte nicht erzeugt werden.');
    } finally {
      setIsGeneratingAiDraft(false);
    }
  }

  function sendPortalInvitation() {
    startTransition(async () => {
      setMessage('');
      setError('');
      try {
        const response = await authorizedFetch('/api/admin/portal-invitation', {
          body: JSON.stringify({
            targetId: tenantId,
            targetType: 'tenant',
          }),
          method: 'POST',
        });
        const result = (await response.json()) as { error?: string; ok?: boolean };
        if (!response.ok || !result.ok) {
          throw new Error(result.error || 'Die Einladung konnte nicht versendet werden.');
        }
        setMessage('Einladung mit Zugangsdaten wurde per E-Mail versendet.');
        setShowInvitationSentModal(true);
      } catch (caughtError) {
        console.error('Fehler beim Versand der Portaleinladung:', caughtError);
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Die Einladung konnte nicht versendet werden.'
        );
      }
    });
  }

  function sendReply() {
    if (!tenant || !cleanText(replyText)) return;
    startTransition(async () => {
      setMessage('');
      setError('');
      try {
        const baseBody = cleanText(replyText).endsWith(portalSignature)
          ? cleanText(replyText).slice(0, cleanText(replyText).length - portalSignature.length).trimEnd()
          : cleanText(replyText);
        const nextFollowUpDate = cleanText(followUpDate);
        const signatureRecord = applyAdminSenderToSignature(
          createSignatureRecord((selectedCompany?.data as Record<string, unknown>) ?? null),
          resolveAdminSenderContact(profile, user)
        );
        const themeId = isGeneralConversation ? createClientId('theme') : selectedTheme?.id || selectedRequest?.id || null;
        const threadMessageId = themeId;
        const subject = isGeneralConversation
          ? cleanText(newMessageSubject) || buildThemeTitle(baseBody, 'Neue Nachricht von Halbmann Holding')
          : cleanText(selectedTheme?.subject) ||
            cleanText(selectedRequest?.data.subject) ||
            'Nachricht von Halbmann Holding';
        const portalBodyText = [baseBody, portalSignature].filter(Boolean).join('\n\n');
        const uploadedAttachments =
          deliveryMode === 'email' || deliveryMode === 'both'
            ? await uploadOutgoingMessageAttachments(replyAttachments, `tenant-${tenantId}-${threadMessageId || Date.now()}`)
            : [];

        if (deliveryMode === 'email' || deliveryMode === 'both') {
          const response = await authorizedFetch('/api/message-drafts/send', {
            method: 'POST',
            body: JSON.stringify({
              draft: {
                attachments: uploadedAttachments,
                body: baseBody,
                deliveryMode,
                htmlBody: '',
                kind: 'reply_to_tenant',
                messageId: threadMessageId,
                portalBodyText,
                propertyId: cleanText(tenant.propertyId),
                recipientEmail: cleanText(tenant.email),
                recipientId: tenantId,
                recipientType: 'tenant',
                signature: signatureRecord,
                subject,
                ticketId: null,
                unitId: cleanText(tenant.unitId),
              },
            }),
          });
          const result = (await response.json()) as { error?: string; ok?: boolean };
          if (!response.ok || !result.ok) {
            throw new Error(result.error || 'Die Nachricht konnte nicht versendet werden.');
          }
          await saveOutgoingAttachmentsAsTenantDocuments(uploadedAttachments);
        }

        if (deliveryMode === 'letter' || deliveryMode === 'both') {
          const subjectLine2 = buildLetterSubjectLine2(selectedProperty, unitInfoLabel || cleanText(tenant?.unitLabel));
          const letterHtml = buildLetterHtml({
            body: baseBody,
            context: {
              propertyName: cleanText(selectedProperty?.data.name),
              subjectLine2,
              unitLabel: cleanText(tenant?.unitLabel),
            },
            recipient: letterRecipient,
            signature: signatureRecord,
            subject,
          });

          await downloadFilledLetterTemplate({
            fallbackHtml: letterHtml,
            fileName: subject || 'Brief',
            getAuthToken: user ? () => user.getIdToken() : undefined,
            replacements: buildLetterTemplateReplacements({
              body: baseBody,
              closing: signatureRecord.letterClosing || signatureRecord.closing,
              companyName: signatureRecord.companyName,
              recipientAddress: letterRecipient.address,
              recipientCompany: letterRecipient.company,
              recipientName: letterRecipient.name,
              recipientSalutation: letterRecipient.salutation,
              senderName: signatureRecord.name,
              subject,
              subjectLine2,
            }),
            templateUrl: cleanText(selectedCompany?.data.letterTemplateUrl),
          });
        }
        setReplyText('');
        setNewMessageSubject('');
        setAiInstruction('');
        setContextMode('reply');
        setDeliveryMode('email');
        setFollowUpDate('');
        setReplyAttachments([]);
        if (themeId && isGeneralConversation) {
          const now = new Date().toISOString();
          await authorizedFetch('/api/admin/message-themes', {
            method: 'POST',
            body: JSON.stringify({
              archived: false,
              id: themeId,
              lastActivityAt: now,
              messageIds: [],
              reminderDate: nextFollowUpDate || undefined,
              sourceType: 'admin_message',
              status: 'in_progress',
              tenantId,
              title: subject,
            }),
          });
          setMessageThemes((current) => {
            const nextTheme = {
              archived: false,
              createdAt: now,
              id: themeId,
              lastActivityAt: now,
              messageIds: [],
              reminderDate: nextFollowUpDate || undefined,
              sourceType: 'admin_message' as const,
              status: 'in_progress' as const,
              tenantId,
              title: subject,
              updatedAt: now,
            };
            return current.some((theme) => theme.id === themeId)
              ? current.map((theme) => (theme.id === themeId ? { ...theme, ...nextTheme } : theme))
              : [nextTheme, ...current];
          });
        }
        if (themeId && nextFollowUpDate) {
          await saveThemeMeta(themeId, {
            archived: false,
            reminderDate: nextFollowUpDate,
            status: 'in_progress',
            title: subject,
          });
        }
        if (themeId && (deliveryMode === 'letter' || deliveryMode === 'both')) {
          await appendLocalThemeEntry({
            bodyText: portalBodyText,
            deliveryMode,
            entryType: 'admin_message',
            recipientEmail: cleanText(tenant.email),
            recipientId: tenantId,
            recipientName: cleanText(tenantContact?.name),
            recipientType: 'tenant',
            subject,
            themeId,
            visibleToTenant: true,
          });
        }
        if (themeId) {
          router.push(messageHrefBuilder(tenantId, themeId));
        }
        setMessage(
          deliveryMode === 'both'
            ? 'Brief und Mail wurden an den Mieter verarbeitet.'
            : deliveryMode === 'letter'
              ? 'Brief wurde im Verlauf dokumentiert.'
              : 'Nachricht wurde an den Mieter versendet.'
        );
      } catch (caughtError) {
        console.error('Fehler beim Senden im Mieterbereich:', caughtError);
        setError(caughtError instanceof Error ? caughtError.message : 'Die Nachricht konnte nicht versendet werden.');
      }
    });
  }

  function sendCurrentComposer() {
    if (composerMode === 'note') {
      startTransition(async () => {
        setMessage('');
        setError('');
        try {
          await saveInternalNote();
          setMessage('Interne Notiz wurde gespeichert.');
        } catch (caughtError) {
          setError(caughtError instanceof Error ? caughtError.message : 'Notiz konnte nicht gespeichert werden.');
        }
      });
      return;
    }

    if (composerMode === 'vendor') {
      startTransition(async () => {
        setMessage('');
        setError('');
        try {
          await sendVendorMessage();
          setMessage('Gewerk wurde benachrichtigt.');
        } catch (caughtError) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Gewerk konnte nicht benachrichtigt werden.'
          );
        }
      });
      return;
    }

    sendReply();
  }

  if (isLoading) {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm leading-6 text-slate-600">
          Mieter wird geladen...
        </div>
      </section>
    );
  }

  if (!tenant) {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-700">
          {error || 'Der Mieter wurde nicht gefunden.'}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {showStandaloneMailboxLayout ? (
        <div className="flex items-center justify-between gap-3">
          <label className="flex min-w-0 items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-2 text-sm text-slate-700">
            <span>Ansicht</span>
            <select
              className="min-w-0 bg-transparent text-sm text-slate-900 outline-none"
              onChange={(event) => {
                const nextValue = event.target.value;
                if (nextValue === 'new') {
                  router.push(buildTenantMailboxHref(tenantId, resolvedThemeListMode === 'archive' ? 'archive' : 'open', GENERAL_THREAD_ID));
                  return;
                }

                const nextMode = nextValue === 'archive' ? 'archive' : 'open';
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(
                    new CustomEvent('admin-mailbox-view', {
                      detail: {
                        tenantMailbox: true,
                        view: nextMode,
                      },
                    })
                  );
                }
                router.push(buildTenantMailboxHref(tenantId, nextMode));
              }}
              value={isGeneralConversation ? 'new' : resolvedThemeListMode === 'archive' ? 'archive' : 'inbox'}
            >
              <option value="inbox">Posteingang</option>
              <option value="new">Neue Nachricht</option>
              <option value="archive">Archiv</option>
            </select>
          </label>
          <div className="ml-auto flex items-center gap-3">
            <button
              aria-label="Uebergabeprotokoll oeffnen"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
              onClick={() => router.push(`/admin/mieter/${tenantId}/uebergabe`)}
              title="Uebergabeprotokoll"
              type="button"
            >
              <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                <path d="M14 2v5h5" />
                <path d="M8.5 13h7" />
                <path d="M8.5 17h5" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}
      {showEditButton || showOverviewButton ? (
        <div className={headerClassName || '-mt-10 flex flex-wrap items-center justify-between gap-4 pr-14 xl:-mt-11 xl:pr-16'}>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h2 className="min-w-0 text-3xl text-slate-950">
              {formatValue([tenant.lastName, tenant.firstName].filter(Boolean).join(', '))}
            </h2>
            {showEditButton ? (
            <Link
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
              href={`/admin/mieter/${tenantId}/bearbeiten`}
            >
              Bearbeiten
            </Link>
            ) : null}
            {showEditButton && cleanText(tenant.status) !== 'inactive' ? (
              <button
                className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isEndingTenancy}
                onClick={() => void endTenancy()}
                type="button"
              >
                {isEndingTenancy ? 'Beendet...' : 'Mietverhaeltnis beenden'}
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {showOverviewButton ? (
            <Link
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
              href="/admin/mieter"
            >
              Mieterübersicht
            </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {false && isMessagesLayout ? (
        <div className="flex justify-end">
          <div className="grid gap-2 sm:grid-cols-[180px_auto]">
            <select
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => setHandoverProtocolKind(event.target.value === 'moveOut' ? 'moveOut' : 'moveIn')}
              value={handoverProtocolKind}
            >
              <option value="moveIn">Uebergabe Einzug</option>
              <option value="moveOut">Uebergabe Auszug</option>
            </select>
            <button
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
              onClick={() => void downloadHandoverProtocol(handoverProtocolKind)}
              type="button"
            >
              ✓
            </button>
          </div>
        </div>
      ) : null}

      {false && isMessagesLayout ? (
        <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Dokumente</p>
              <h3 className="mt-1 text-xl text-slate-950">Mieterdateien</h3>
            </div>
            <div className="min-w-[min(100%,560px)] flex-1">
              <DocumentUploadControl
                disabled={isUploadingTenantDocument}
                onUpload={(files) => uploadTenantDocuments(files)}
              />
            </div>
          </div>

          {tenantDocuments.length > 0 ? (
            <div className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-[18px] border border-stone-200">
              {tenantDocuments.map((tenantDocument) => {
                const isDeleting =
                  deletingTenantDocumentPath === (tenantDocument.path || tenantDocument.url);
                const meta = [formatFileSize(tenantDocument.size), formatUploadDate(tenantDocument.uploadedAt)]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <div
                    className="grid gap-3 bg-white px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                    key={`${tenantDocument.path}-${tenantDocument.url}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{tenantDocument.name}</p>
                      {meta ? <p className="mt-0.5 text-xs text-slate-500">{meta}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
                        href={tenantDocument.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Anschauen
                      </a>
                      <button
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isDeleting}
                        onClick={() => void deleteTenantDocument(tenantDocument)}
                        type="button"
                      >
                        {isDeleting ? 'Löscht...' : 'Löschen'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-[18px] border border-dashed border-stone-300 bg-stone-50 p-4 text-sm leading-6 text-slate-600">
              Noch keine Dokumente hochgeladen.
            </div>
          )}
        </section>
      ) : null}

      <section className="hidden">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
              Übergabe vor Ort
            </p>
            <h3 className="mt-1 text-xl text-slate-950">Protokoll als Formular</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Für schnelle Erfassung mit dem Handy. Fotos können unten bei den Dokumenten direkt per Kamera ergänzt werden.
            </p>
          </div>
          <select
            className="rounded-full border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
            onChange={(event) => setHandoverProtocolKind(event.target.value === 'moveOut' ? 'moveOut' : 'moveIn')}
            value={handoverProtocolKind}
          >
            <option value="moveIn">Einzug</option>
            <option value="moveOut">Auszug</option>
          </select>
        </div>

        <div className="mt-4 grid gap-3">
          <input
            className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            onChange={(event) => setHandoverForm((current) => ({ ...current, place: event.target.value }))}
            placeholder="Ort / Treffpunkt"
            value={handoverForm.place}
          />
          <textarea
            className="min-h-24 rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            onChange={(event) => setHandoverForm((current) => ({ ...current, condition: event.target.value }))}
            placeholder="Zustand der Einheit"
            value={handoverForm.condition}
          />
          <textarea
            className="min-h-24 rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            onChange={(event) => setHandoverForm((current) => ({ ...current, defects: event.target.value }))}
            placeholder="Mängel / offene Punkte"
            value={handoverForm.defects}
          />
          <textarea
            className="min-h-20 rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            onChange={(event) => setHandoverForm((current) => ({ ...current, meterReadings: event.target.value }))}
            placeholder="Zählerstände"
            value={handoverForm.meterReadings}
          />
          <input
            className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            onChange={(event) => setHandoverForm((current) => ({ ...current, handedOverKeys: event.target.value }))}
            placeholder="Übergebene Schlüssel"
            value={handoverForm.handedOverKeys}
          />
          <textarea
            className="min-h-20 rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            onChange={(event) => setHandoverForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Notizen"
            value={handoverForm.notes}
          />
          <input
            className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            onChange={(event) => setHandoverForm((current) => ({ ...current, tenantSignatureName: event.target.value }))}
            placeholder="Name Mieter / Übergabepartner"
            value={handoverForm.tenantSignatureName}
          />
          <button
            className="rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-4 py-3 text-sm font-medium text-stone-100"
            onClick={() => void saveMobileHandoverProtocol()}
            type="button"
          >
            Protokoll speichern
          </button>
        </div>
      </section>

      <section className="min-w-0 overflow-x-hidden rounded-[24px] border border-stone-200 bg-white px-4 pb-5 pt-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)] sm:px-5">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {showArchiveHistoryInline && selectedTheme?.archived ? (
              <button
                className="rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:border-emerald-400"
                onClick={() =>
                  startTransition(async () => {
                    setMessage('');
                    setError('');
                    try {
                      await updateThemeState(selectedTheme!.id, 'in_progress', false);
                      setMessage('Thema wurde reaktiviert.');
                      router.push(messageHrefBuilder(tenantId, selectedTheme!.id));
                    } catch (caughtError) {
                      setError(caughtError instanceof Error ? caughtError.message : 'Thema konnte nicht reaktiviert werden.');
                    }
                  })
                }
                type="button"
              >
                Reaktivieren
              </button>
            ) : null}
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">{resolvedSectionTitle}</p>
          </div>
          {isGeneralConversation ? (
            <div className="min-w-0 rounded-full border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-slate-600">
              Ausgewaehlt: Neues Thema
            </div>
          ) : selectedRequest ? (
            <div className="min-w-0 break-words rounded-full border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-slate-600">
              Ausgewaehlt: {cleanText(selectedTheme?.subject) || cleanText(selectedRequest.data.subject) || 'Anfrage ohne Betreff'}
            </div>
          ) : null}
        </div>
        <div
          className={`mt-4 grid min-w-0 gap-0 overflow-x-hidden ${
            showMailboxTwoColumnLayout ? 'xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start' : ''
          }`}
        >
          <div className={`min-w-0 space-y-0 overflow-x-hidden ${showMailboxTwoColumnLayout ? 'xl:col-start-2 xl:row-start-1 xl:border-l xl:border-stone-200 xl:pl-5' : ''}`}>
            {selectedTheme && false && !isGeneralConversation && !showArchiveHistoryInline ? (
              <div className="rounded-[16px] border border-stone-200 bg-stone-50 px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {!selectedTheme!.archived ? (
                      <>
                        <button
                          className="rounded-full border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-700 transition hover:border-emerald-400"
                          onClick={() =>
                            startTransition(async () => {
                              setMessage('');
                              setError('');
                                try {
                                  await updateThemeState(selectedTheme!.id, 'done', true);
                                  router.push(messageHrefBuilder(tenantId, ''));
                                  setMessage('Thema wurde ins Archiv verschoben.');
                                } catch (caughtError) {
                                  setError(caughtError instanceof Error ? caughtError.message : 'Thema konnte nicht archiviert werden.');
                                }
                            })
                          }
                          type="button"
                        >
                          Erledigt
                        </button>
                        {splitSourceRecord ? (
                          <button
                            className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-stone-400"
                            onClick={() =>
                              startTransition(async () => {
                                setMessage('');
                                setError('');
                                try {
                                  await splitSelectedTheme();
                                  setMessage('Neues Thema wurde abgesplittet.');
                                } catch (caughtError) {
                                  setError(caughtError instanceof Error ? caughtError.message : 'Thema konnte nicht gesplittet werden.');
                                }
                              })
                            }
                            type="button"
                          >
                            Splitten
                          </button>
                        ) : null}
                      </>
                    ) : null}
                    {!selectedTheme!.archived && mergeableThemes.length > 0 ? (
                      <>
                        <select
                          className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11px] text-slate-700 outline-none transition focus:border-amber-700/60"
                          onChange={(event) => setMergeSourceThemeId(event.target.value)}
                          value={mergeSourceThemeId}
                        >
                          <option value="">Thema zusammenfuehren</option>
                          {mergeableThemes.map((theme) => (
                            <option key={`${theme.tenantId || tenantId}-${theme.id}-${theme.latestEntry.id}`} value={theme.id}>
                              {cleanText(theme.subject) || 'Thema ohne Betreff'}
                            </option>
                          ))}
                        </select>
                        <button
                          className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={!mergeSourceThemeId}
                          onClick={() =>
                            startTransition(async () => {
                              setMessage('');
                              setError('');
                              try {
                                await mergeThemeIntoSelected(mergeSourceThemeId);
                                setMessage('Themen wurden zusammengefuehrt.');
                              } catch (caughtError) {
                                setError(caughtError instanceof Error ? caughtError.message : 'Themen konnten nicht zusammengefuehrt werden.');
                              }
                            })
                          }
                          type="button"
                        >
                          Zusammenfuehren
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
                {!showArchiveHistoryInline ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      className="w-full max-w-[320px] rounded-2xl border border-stone-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-amber-700/60"
                      onChange={(event) => setThemeTitleDraft(event.target.value)}
                      placeholder="Thementitel"
                      value={themeTitleDraft}
                    />
                    <button
                      className="rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!selectedTheme}
                      onClick={() =>
                        startTransition(async () => {
                          setMessage('');
                          setError('');
                          try {
                            await saveThemeTitle();
                            setMessage('Thementitel wurde gespeichert.');
                          } catch (caughtError) {
                            setError(caughtError instanceof Error ? caughtError.message : 'Thementitel konnte nicht gespeichert werden.');
                          }
                        })
                      }
                      type="button"
                    >
                      Speichern
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {showArchiveHistoryInline ? (
              threadHistoryPanel
            ) : (
            <>
            {threadHistoryPanel}
            <div className="flex justify-start border-b border-stone-200 py-3">
              <select
                className="h-9 w-24 rounded-full border border-stone-300 bg-white px-2 text-xs text-slate-900 outline-none transition focus:border-amber-700/60 disabled:bg-stone-100 disabled:text-slate-400"
                onChange={(event) => {
                  const nextMode = event.target.value as DeliveryMode;
                  setDeliveryMode(nextMode);
                  setComposerMode(nextMode === 'note' ? 'note' : 'tenant');
                }}
                value={deliveryMode}
              >
                <option value="email">Mail</option>
                <option value="letter">Brief</option>
                <option value="both">Beides</option>
                <option value="note">Notiz</option>
              </select>
            </div>
            {!isGeneralConversation ? (
              <div className="min-w-0 overflow-x-hidden border-b border-stone-200 py-3">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px] items-center gap-2">
                  <select
                    className="h-9 min-w-0 rounded-full border border-stone-300 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-amber-700/60"
                    onChange={(event) => setThemeAction(event.target.value as 'done' | 'merge' | 'reassign' | 'save' | 'split')}
                    value={themeAction}
                  >
                    <option value="save">Betreff</option>
                    <option value="done">Erledigt</option>
                    <option value="split">Splitten</option>
                    <option value="merge">Zusammenführen</option>
                    <option value="reassign">Neu zuordnen</option>
                  </select>
                  <select
                    className="h-9 min-w-0 rounded-full border border-stone-300 bg-white px-3 text-xs text-slate-700 outline-none transition focus:border-amber-700/60 disabled:bg-stone-100 disabled:text-slate-400"
                    disabled={themeAction !== 'merge' && themeAction !== 'reassign'}
                    onChange={(event) => setThemeActionTargetId(event.target.value)}
                    value={themeActionTargetId}
                  >
                    {themeAction === 'merge' ? (
                      <>
                        <option value="">Nachricht auswählen</option>
                        {themeActionMergeOptions.map((theme) => (
                          <option key={`${theme.tenantId || tenantId}-${theme.id}-${theme.latestEntry.id}`} value={theme.id}>
                            {cleanText(theme.subject) || 'Thema ohne Betreff'}
                          </option>
                        ))}
                      </>
                    ) : themeAction === 'reassign' ? (
                      <>
                        <option value="">Kontakt auswählen</option>
                        {reassignContactOptions.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.label}{entry.targetType === 'tenant' ? ' · Mieter' : ' · Dienstleister'}
                          </option>
                        ))}
                      </>
                    ) : (
                      <option value="">Keine Auswahl nötig</option>
                    )}
                  </select>
                  <button
                    aria-label="Aktion ausführen"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 bg-white text-slate-700 transition hover:border-amber-700/50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      !selectedTheme ||
                      ((themeAction === 'merge' || themeAction === 'reassign') && !themeActionTargetId) ||
                      (Boolean(selectedTheme!.archived) && themeAction !== 'save') ||
                      (themeAction === 'split' && !splitSourceRecord)
                    }
                    onClick={() =>
                      startTransition(async () => {
                        await runThemeAction();
                      })
                    }
                    type="button"
                  >
                    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : null}
            <div className="min-w-0 overflow-x-hidden py-4">
              <div className="grid min-w-0 gap-2">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_40px] items-center gap-2">
                  <input
                    className="h-9 min-w-0 rounded-full border border-stone-300 bg-white px-3 text-xs text-slate-900 outline-none transition focus:border-amber-700/60"
                    onChange={(event) => setAiInstruction(event.target.value)}
                    placeholder="KI-Hinweis"
                    value={aiInstruction}
                  />
                  <button
                    className="flex h-9 w-10 items-center justify-center rounded-full border border-stone-300 bg-white text-xs font-medium text-slate-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={composerMode !== 'tenant' || isGeneratingAiDraft || isPending || (!selectedRequest && !isGeneralConversation)}
                    onClick={generateAiDraft}
                    type="button"
                  >
                    {isGeneratingAiDraft ? '...' : 'KI'}
                  </button>
                </div>
                {isGeneralConversation ? (
                  <label className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] items-center rounded-full border border-stone-300 bg-white px-3">
                    <span className="text-xs font-medium text-slate-500">Betreff</span>
                    <input
                      className="h-9 min-w-0 bg-transparent text-xs text-slate-900 outline-none"
                      onChange={(event) => setNewMessageSubject(event.target.value)}
                      placeholder="Betreff eingeben"
                      value={newMessageSubject}
                    />
                  </label>
                ) : (
                  <label className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] items-center rounded-full border border-stone-300 bg-white px-3">
                    <span className="text-xs font-medium text-slate-500">Betreff</span>
                    <input
                      className="h-9 min-w-0 bg-transparent text-xs text-slate-900 outline-none"
                      onChange={(event) => setThemeTitleDraft(event.target.value)}
                      value={themeTitleDraft}
                    />
                  </label>
                )}
              </div>

              {composerMode === 'vendor' && selectedTheme && !isGeneralConversation ? (
                <label className="mt-3 block max-w-[420px]">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Gewerk</p>
                  <select
                    className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs text-slate-900 outline-none transition focus:border-amber-700/60"
                    onChange={(event) => setVendorContactId(event.target.value)}
                    value={vendorContactId}
                  >
                    <option value="">Gewerk auswaehlen</option>
                    {serviceContacts.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {buildPersonLabel(entry)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <textarea
                className="mt-3 min-h-[320px] w-full min-w-0 rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-700/60"
                lang="de"
                onChange={(event) => setReplyText(event.target.value)}
                placeholder={
                  composerMode === 'note'
                    ? 'Interne Bearbeitungsnotiz'
                    : composerMode === 'vendor'
                      ? 'Nachricht an das Gewerk'
                      : 'Nachricht an den Mieter'
                }
                spellCheck={false}
                value={replyText}
              />

              {composerMode !== 'note' && (deliveryMode === 'email' || deliveryMode === 'both') ? (
                <OutgoingAttachmentPicker
                  attachments={replyAttachments}
                  disabled={isPending}
                  inputId={`tenant-reply-attachments-${tenantId}`}
                  onChange={setReplyAttachments}
                />
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {composerMode === 'tenant' ? (
                  <label className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-2 text-xs text-slate-700">
                    <span>Wiedervorlage</span>
                    <input
                      className="bg-transparent text-xs text-slate-900 outline-none"
                      onChange={(event) => setFollowUpDate(event.target.value)}
                      type="date"
                      value={followUpDate}
                    />
                  </label>
                ) : null}
                <button
                  className="rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-4 py-2 text-sm font-medium text-stone-100 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    isPending ||
                    !cleanText(replyText) ||
                    (composerMode === 'tenant' && (!selectedRequest && !isGeneralConversation)) ||
                    (composerMode === 'vendor' && !vendorContactId)
                  }
                  onClick={sendCurrentComposer}
                  type="button"
                >
                  {composerMode === 'note'
                    ? 'Notiz speichern'
                    : composerMode === 'vendor'
                      ? 'Gewerk senden'
                      : 'Senden'}
                </button>
              </div>

            </div>
            </>
            )}
          </div>
          {externalThemesPanel ? (
            <aside className={`min-w-0 overflow-x-hidden ${showMailboxTwoColumnLayout ? 'xl:col-start-1 xl:row-start-1' : ''}`}>{externalThemesPanel}</aside>
          ) : (
          <aside
            className={`min-w-0 overflow-x-hidden px-0 py-0 ${
              showMailboxTwoColumnLayout ? 'xl:col-start-1 xl:row-start-1' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Nachrichten</p>
                <span className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {filteredVisibleThemes.length}
                </span>
              </div>
            </div>

            {showStandaloneMailboxLayout ? (
              <div className="mt-3">
                <input
                  className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                  onChange={(event) => setThemeSearch(event.target.value)}
                  placeholder="Nach Inhalt suchen"
                  type="search"
                  value={themeSearch}
                />
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <button
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    resolvedThemeListMode === 'open'
                      ? 'bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] text-stone-100'
                      : 'border border-stone-300 bg-white text-slate-700 hover:border-stone-400'
                  }`}
                  onClick={() => setThemeListMode('open')}
                  type="button"
                >
                  Offen {openThemes.length}
                </button>
                <button
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    resolvedThemeListMode === 'archive'
                      ? 'bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] text-stone-100'
                      : 'border border-stone-300 bg-white text-slate-700 hover:border-stone-400'
                  }`}
                  onClick={() => setThemeListMode('archive')}
                  type="button"
                >
                  Archiv {archivedThemes.length}
                </button>
              </div>
            )}

            <div className="mt-3 max-h-[calc(72vh-80px)] min-w-0 divide-y divide-stone-200 overflow-y-auto overflow-x-hidden border-y border-stone-200 pr-1">
              {filteredVisibleThemes.length === 0 ? (
                <div className="rounded-[16px] border border-dashed border-stone-300 bg-white px-3 py-6 text-sm text-slate-600">
                  {resolvedThemeListMode === 'archive'
                    ? 'Keine archivierten Themen.'
                    : 'Fuer diesen Mieter liegen noch keine offenen Themen vor.'}
                </div>
              ) : (
                filteredVisibleThemes.map((theme) => {
                  const isSelected = selectedTheme?.id === theme.id && selectedTheme?.tenantId === theme.tenantId;
                  return (
                    <div
                      className={`relative px-3 py-3 !text-slate-950 transition ${
                        isSelected
                          ? '!bg-amber-50 !text-slate-950'
                          : '!bg-white hover:!bg-stone-50'
                      }`}
                      key={`${theme.tenantId || tenantId}-${theme.id}-${theme.latestEntry.id}`}
                    >
                      <button
                        aria-label="Thema löschen"
                        className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-stone-200 bg-white text-xs font-medium text-stone-500 transition hover:border-red-300 hover:text-red-600"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setThemePendingDeleteId(theme.id);
                        }}
                        type="button"
                      >
                        x
                      </button>
                      <Link
                        className="block min-w-0 pr-8"
                        href={messageHrefBuilder(tenantId, theme.id)}
                      >
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <p className={`min-w-0 break-words text-sm font-medium leading-5 ${isSelected ? '!text-amber-950' : '!text-slate-950'}`}>
                            {cleanText(theme.subject) || cleanText(theme.latestInbound?.data.fromName) || 'Anfrage ohne Betreff'}
                          </p>
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${getThemeStatusTone(
                              cleanText(theme.status),
                              Boolean(theme.archived)
                            )}`}
                          >
                            {getThemeStatusLabel(cleanText(theme.status), Boolean(theme.archived))}
                          </span>
                        </div>
                        <p className="mt-2 truncate text-[11px] !text-slate-800">
                          {cleanText(theme.latestInbound?.data.fromEmail) || 'Mieterportal'}
                        </p>
                        <p className="mt-1 truncate text-[11px] !text-slate-900">
                          {cleanText(theme.latestEntry.data.bodyText) || 'Kein Nachrichtentext vorhanden.'}
                        </p>
                        {cleanText(theme.reminderDate) ? (
                          <p className="mt-1 text-[11px] font-medium !text-amber-700">
                            Wiedervorlage: {formatReminderDate(theme.reminderDate)}
                          </p>
                        ) : null}
                        <p className="mt-2 text-[11px] !text-slate-800">
                          {formatDateTime(theme.latestActivityAt)}
                        </p>
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
          )}
          {false && !showArchiveHistoryInline ? (
            <div
              className={showMailboxTwoColumnLayout ? 'xl:col-span-2 xl:row-start-2' : ''}
            >
              {threadHistoryPanel}
            </div>
          ) : null}
        </div>
      </section>

      {themePendingDelete ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/30 px-4">
          <div className="w-full max-w-md rounded-[20px] border border-stone-200 bg-white px-5 py-5 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.35)]">
            <p className="text-lg font-medium text-slate-950">Thema endgültig löschen?</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Dieses Thema wird aus der Themenliste entfernt. Der Schritt ist für den normalen Arbeitsfluss nicht rückgängig zu machen.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400"
                onClick={() => setThemePendingDeleteId('')}
                type="button"
              >
                Nein
              </button>
              <button
                className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:border-red-400"
                onClick={() =>
                  startTransition(async () => {
                    setMessage('');
                    setError('');
                    try {
                      await deleteTheme(themePendingDelete.id);
                      setThemePendingDeleteId('');
                      setMessage('Thema wurde endgültig gelöscht.');
                    } catch (caughtError) {
                      setError(caughtError instanceof Error ? caughtError.message : 'Thema konnte nicht gelöscht werden.');
                    }
                  })
                }
                type="button"
              >
                Ja
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showInvitationSentModal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/30 px-4">
          <div className="w-full max-w-sm rounded-[20px] border border-stone-200 bg-white px-5 py-5 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.35)]">
            <p className="text-lg font-medium text-slate-950">Einladung wurde verschickt.</p>
            <div className="mt-5 flex justify-end">
              <button
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400"
                onClick={() => setShowInvitationSentModal(false)}
                type="button"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        <DetailCard title="Stammdaten">
          <DetailRow label="Name" value={tenantDisplayName} />
          {isMessagesLayout ? <DetailRow label="Objekt" value={propertyInfoName} /> : null}
          {isMessagesLayout ? <DetailRow label="Einheit" value={unitInfoLabel} /> : null}
          <DetailRow label="Firma" value={tenant.companyName} />
          <DetailRow label="E-Mail" value={tenant.email} />
          <DetailRow label="Telefon" value={tenant.phone} />
          <DetailRow label="Steuernummer" value={tenant.taxNumber} />
          {isMessagesLayout ? <DetailRow label="Kautionsart" value={depositSummary} /> : null}
          <DetailRow label="Status" value={translateStatus(tenant.status)} />
        </DetailCard>

        <DetailCard title={isMessagesLayout ? 'Infos' : 'Zuordnung'}>
          {!isMessagesLayout ? <DetailRow label="Objekt" value={propertyInfoName} /> : null}
          {!isMessagesLayout ? <DetailRow label="Einheit" value={unitInfoLabel} /> : null}
          <DetailRow label="Mietbeginn" value={tenant.moveInDate} />
          {isMessagesLayout ? (
            <>
              <DetailRow label="Mietende" value={leaseEndDisplay} />
              <DetailRow label="Optionen" value={leaseOptionsDisplay} />
              <DetailRow label="Kaltmiete" value={tenant.coldRent} />
              <DetailRow label="Nebenkosten" value={tenant.netOperatingCosts} />
              <DetailRow label="Umsatzsteuer" value={vatAmountDisplay} />
              <DetailRow label="Gesamtmiete" value={totalRentDisplay} />
              <DetailRow label="Mieterhöhung" value={translateRentIncreaseType(tenant.rentIncreaseType)} />
              <DetailRow label="Nächste Prüfung" value={tenant.rentIncreaseNextReview} />
            </>
          ) : null}
        </DetailCard>

        {showSecondaryDetails && !isMessagesLayout ? (
          <DetailCard title="Status und Prüfung">
            <DetailRow label="Mieterhöhungsart" value={translateRentIncreaseType(tenant.rentIncreaseType)} />
            <DetailRow label="Nächste Erinnerung" value={tenant.rentIncreaseNextReview} />
            <DetailRow label="Bürge" value={tenant.guarantorLabel} />
            <DetailRow label="Kautionsart" value={translateDepositType(tenant.depositType)} />
          </DetailCard>
        ) : null}
      </div>

      {showSecondaryDetails && !isMessagesLayout ? (
        <DetailCard title="Miete und Kaution">
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            <Field label="Kaltmiete" value={tenant.coldRent} />
            <Field label="Nebenkosten" value={tenant.netOperatingCosts} />
            <Field label="Warmmiete (netto)" value={tenant.warmRent} />
            <Field label="Umsatzsteuer-Regelung" value={translateVatRule(tenant.vatRule)} />
            <Field label="Kautionsbetrag" value={tenant.depositAmount} />
          </div>
        </DetailCard>
      ) : null}

      {false && propertyServiceRows.length > 0 ? (
        <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
            Gewerke und Dienstleister
          </p>
          <div className="mt-3 divide-y divide-stone-100">
            {propertyServiceRows.map((service) => (
              <Link
                className="grid gap-2 py-2 text-sm transition hover:bg-stone-50/80 md:grid-cols-[110px_minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)] md:items-center md:gap-3"
                href={`/admin/personen/${service.id}`}
                key={service.id}
              >
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">
                  {service.label}
                </span>
                <span className="min-w-0 truncate text-slate-900">{service.company}</span>
                <span className="min-w-0 truncate text-slate-700">{service.name}</span>
                <span className="min-w-0 truncate text-slate-700">{service.phone}</span>
                <span className="min-w-0 truncate text-slate-700">{service.email}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <DocumentLibrarySection
        documents={tenantDocuments}
        isUploading={isUploadingTenantDocument}
        legacyDocuments={legacyTenantDocumentNames}
        onDelete={deleteTenantDocument}
        onDeleteLegacy={deleteLegacyTenantDocument}
        onUpdateCategory={updateTenantDocumentCategory}
        onUpload={(files, category) => uploadTenantDocuments(files, category)}
        title="Mieterdateien"
      />

      {false ? (
        <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Dokumente</p>
              <h3 className="mt-1 text-xl text-slate-950">Mieterdateien</h3>
            </div>
            <div className="min-w-[min(100%,560px)] flex-1">
              <DocumentUploadControl
                disabled={isUploadingTenantDocument}
                onUpload={(files) => uploadTenantDocuments(files)}
              />
            </div>
          </div>

          {tenantDocuments.length > 0 ? (
            <div className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-[18px] border border-stone-200">
              {tenantDocuments.map((tenantDocument) => {
                const isDeleting =
                  deletingTenantDocumentPath === (tenantDocument.path || tenantDocument.url);
                const meta = [formatFileSize(tenantDocument.size), formatUploadDate(tenantDocument.uploadedAt)]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <div
                    className="grid gap-3 bg-white px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                    key={`${tenantDocument.path}-${tenantDocument.url}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{tenantDocument.name}</p>
                      {meta ? <p className="mt-0.5 text-xs text-slate-500">{meta}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
                        href={tenantDocument.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Anschauen
                      </a>
                      <button
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isDeleting}
                        onClick={() => void deleteTenantDocument(tenantDocument)}
                        type="button"
                      >
                        {isDeleting ? 'Löscht...' : 'Löschen'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-[18px] border border-dashed border-stone-300 bg-stone-50 p-4 text-sm leading-6 text-slate-600">
              Noch keine Dokumente hochgeladen.
            </div>
          )}

          {legacyTenantDocumentNames.length > 0 ? (
            <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-amber-700/80">
                Alte Dateinamen ohne Upload
              </p>
              <div className="mt-2 grid gap-2 text-sm text-slate-700">
                {legacyTenantDocumentNames.map((legacyDocument) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-white/70 px-3 py-2"
                    key={`${legacyDocument.label}-${legacyDocument.name}`}
                  >
                    <p>
                      {legacyDocument.label}: {legacyDocument.name}
                    </p>
                    <button
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-300"
                      onClick={() => void deleteLegacyTenantDocument(legacyDocument.fieldName, legacyDocument.name)}
                      type="button"
                    >
                      Löschen
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {showSecondaryDetails && !isMessagesLayout ? (
        <RentHistoryChart
          emptyText="Fuer diesen Mieter liegen noch keine Mietdaten fuer eine Entwicklung vor."
          points={rentChartPoints}
          subtitle="Vergangene Miethoehen, aktueller Stand und - je nach Vertragsart - die naechsten bekannten Schritte."
          title="Mietentwicklung"
        />
      ) : null}

      {showSecondaryDetails && !isMessagesLayout && additionalPeople.length > 0 ? (
        <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Weitere Personen</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {additionalPeople.map((person) => (
              <article className="rounded-[18px] border border-stone-200 bg-stone-50 p-4" key={String(person.id)}>
                <p className="text-sm font-medium text-slate-900">
                  {[person.lastName, person.firstName].filter(Boolean).join(', ')}
                </p>
                <div className="mt-3 grid gap-2">
                  <Field label="Bezug" value={translateRelation(person.relation)} />
                  <Field label="Telefon" value={person.phone} />
                  <Field label="E-Mail" value={person.email} />
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

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

function DetailCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">{title}</p>
      <div className="mt-3 grid gap-1.5">{children}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value?: unknown }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 border-b border-stone-100 py-1 text-sm last:border-b-0 md:grid-cols-[132px_minmax(0,1fr)] md:gap-2">
      <dt className="break-words text-[11px] font-medium uppercase leading-4 tracking-[0.12em] text-stone-500">{label}</dt>
      <dd className="min-w-0 whitespace-normal break-words leading-[1.15rem] text-slate-900">{formatValue(value)}</dd>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: unknown }) {
  return (
    <div className="rounded-[14px] border border-stone-200 bg-stone-50 px-3 py-1.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="mt-0.5 min-w-0 whitespace-normal break-words text-sm leading-5 text-slate-900">{formatValue(value)}</p>
    </div>
  );
}

