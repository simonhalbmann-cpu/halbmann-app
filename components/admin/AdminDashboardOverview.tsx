'use client';

import Link from 'next/link';
import { collection, onSnapshot, query, type DocumentData } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  formatDateTime,
  formatTimestampSort,
  getStatusLabel,
  type WorkflowRecord,
} from '../../lib/adminWorkflow';
import { db } from '../../lib/firebase';
import type { LocalMessageTheme } from '../../lib/localMessageThemes';
import { buildMessageThemes } from '../../lib/messageThemes';
import RentHistoryChart, { type RentHistoryChartPoint } from './RentHistoryChart';

type ReminderItem = {
  dateValue: string;
  href: string;
  id: string;
  label: string;
  meta: string;
  type: 'message' | 'property' | 'tenant' | 'theme';
};

type RentFilterScope = 'all' | 'companies' | 'properties' | 'tenants';
type DashboardReminderFilter = 'dueSoon' | 'rentIncrease';
type DashboardThemeFilter = 'new' | 'open';
type DashboardInventoryFilter = 'activeTenants' | 'companies' | 'properties' | 'vacancy';

type InventoryItem = {
  href: string;
  id: string;
  label: string;
  meta: string;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isPermissionDenied(caughtError: unknown) {
  return (
    typeof caughtError === 'object' &&
    caughtError !== null &&
    'code' in caughtError &&
    (caughtError as { code?: unknown }).code === 'permission-denied'
  );
}

function buildDashboardMessageHref(record: WorkflowRecord) {
  const tenantId = cleanText(record.data.tenantId);
  if (tenantId) {
    return `/admin/mieter/${tenantId}?messageId=${record.id}`;
  }
  return `/admin/nachrichten/${record.id}`;
}

function buildComposeHref(params: Record<string, string>) {
  const searchParams = new URLSearchParams({ tab: 'compose' });
  Object.entries(params).forEach(([key, value]) => {
    const text = cleanText(value);
    if (text) searchParams.set(key, text);
  });
  return `/admin/nachrichten?${searchParams.toString()}`;
}

function buildMaintenanceComposeHref({
  instruction,
  propertyId,
  serviceField,
  subject,
  unitId,
}: {
  instruction: string;
  propertyId: string;
  serviceField: string;
  subject: string;
  unitId?: string;
}) {
  return buildComposeHref({
    autoDraft: '1',
    composePreset: 'maintenance',
    instruction,
    propertyId,
    serviceField,
    subject,
    unitId: unitId || '',
  });
}

function buildTenantComposeHref({
  instruction,
  propertyId,
  subject,
  tenantId,
}: {
  instruction: string;
  propertyId: string;
  subject: string;
  tenantId: string;
}) {
  return buildComposeHref({
    autoDraft: '1',
    composePreset: 'tenant',
    instruction,
    propertyId,
    subject,
    tenantId,
  });
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
      if (isPermissionDenied(caughtError)) {
        return;
      }
      console.error(`Fehler beim Laden von ${name}:`, caughtError);
      onError('Ein Teil der Dashboard-Daten konnte nicht geladen werden.');
    }
  );
}

function parseDateInput(value: unknown) {
  const text = cleanText(value);
  if (!text) return null;
  const parsed = new Date(`${text}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateOnly(value: unknown) {
  const date = parseDateInput(value);
  if (!date) return 'Ohne Datum';
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function parseReminderMonths(value: unknown) {
  const numeric = Number.parseInt(cleanText(value), 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 11;
}

function shiftDateByMonths(value: unknown, months: unknown) {
  const date = parseDateInput(value);
  if (!date) return '';
  date.setMonth(date.getMonth() + parseReminderMonths(months));
  return date.toISOString().slice(0, 10);
}

function buildTenantLabel(record?: WorkflowRecord | null) {
  if (!record) return 'Ohne Mieter';
  return (
    [cleanText(record.data.lastName), cleanText(record.data.firstName)].filter(Boolean).join(', ') ||
    cleanText(record.data.companyName) ||
    record.id
  );
}

function parseMoney(value: unknown) {
  const text = cleanText(value);
  if (!text) return 0;
  const normalized = text.replace(/\./g, '').replace(/EUR/gi, '').replace(/\s/g, '').replace(',', '.');
  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('de-DE', {
    currency: 'EUR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function getRentIncreaseTypeLabel(value: unknown) {
  switch (cleanText(value)) {
    case 'graduated':
      return 'Staffelmiete';
    case 'index':
      return 'Indexmiete';
    case 'legal':
      return 'gesetzliche Erhöhung';
    default:
      return 'Mietprüfung';
  }
}

function isRentIncreaseReminder(entry: ReminderItem) {
  const meta = entry.meta.toLowerCase();
  return (
    entry.type === 'tenant' &&
    (meta.includes('mieterhöhung') ||
      meta.includes('mieterhÃ¶hung') ||
      meta.includes('mieterhoehung') ||
      meta.includes('staffelmiete') ||
      meta.includes('mietprüfung') ||
      meta.includes('mietprÃ¼fung') ||
      meta.includes('mietpruefung'))
  );
}

function EmptyList({ text }: { text: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-slate-500">
      {text}
    </div>
  );
}

function DashboardFilterButtons({
  items,
  onReset,
  onToggle,
  selectedIds,
}: {
  items: { id: string; label: string }[];
  onReset: () => void;
  onToggle: (id: string) => void;
  selectedIds: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
          selectedIds.length === 0
            ? 'border-amber-700 bg-amber-700 text-white'
            : 'border-stone-300 bg-white text-slate-700 hover:border-stone-400'
        }`}
        onClick={onReset}
        type="button"
      >
        Alle
      </button>
      {items.map((item) => {
        const active = selectedIds.includes(item.id);
        return (
          <button
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              active
                ? 'border-amber-700 bg-amber-700 text-white'
                : 'border-stone-300 bg-white text-slate-700 hover:border-stone-400'
            }`}
            key={item.id}
            onClick={() => onToggle(item.id)}
            type="button"
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function buildUnitLabel(unit: DocumentData) {
  return (
    cleanText(unit.unitLabel) ||
    [cleanText(unit.floor), cleanText(unit.unitPosition), cleanText(unit.section)]
      .filter(Boolean)
      .join(' · ') ||
    cleanText(unit.id) ||
    'Einheit'
  );
}

export default function AdminDashboardOverview() {
  const { user } = useAuth();
  const [firestoreMessages, setFirestoreMessages] = useState<WorkflowRecord[]>([]);
  const [messageThemes, setMessageThemes] = useState<LocalMessageTheme[]>([]);
  const [tenants, setTenants] = useState<WorkflowRecord[]>([]);
  const [properties, setProperties] = useState<WorkflowRecord[]>([]);
  const [companies, setCompanies] = useState<WorkflowRecord[]>([]);
  const [people, setPeople] = useState<WorkflowRecord[]>([]);
  const [loadError, setLoadError] = useState('');
  const [rentFilterScope, setRentFilterScope] = useState<RentFilterScope>('all');
  const [dashboardReminderFilter, setDashboardReminderFilter] =
    useState<DashboardReminderFilter>('dueSoon');
  const [dashboardThemeFilter, setDashboardThemeFilter] = useState<DashboardThemeFilter>('open');
  const [dashboardInventoryFilter, setDashboardInventoryFilter] =
    useState<DashboardInventoryFilter>('companies');
  const [showAllInventory, setShowAllInventory] = useState(false);
  const [showAllReminders, setShowAllReminders] = useState(false);
  const [showAllThemes, setShowAllThemes] = useState(false);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribers = [
      readCollection('messages', setLoadError, setFirestoreMessages),
      readCollection('tenants', setLoadError, setTenants),
      readCollection('properties', setLoadError, setProperties),
      readCollection('companies', setLoadError, setCompanies),
      readCollection('people', setLoadError, setPeople),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  useEffect(() => {
    if (!user) return;
    const currentUser = user;
    let cancelled = false;

    async function loadMessageThemes() {
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/admin/message-themes', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = (await response.json().catch(() => null)) as {
          ok?: boolean;
          themes?: LocalMessageTheme[];
        } | null;

        if (!cancelled && response.ok && result?.ok) {
          setMessageThemes(Array.isArray(result.themes) ? result.themes : []);
        }
      } catch {
        console.warn('Fehler beim Laden der Themen im Dashboard.');
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
    const unique = new Map<string, WorkflowRecord>();
    firestoreMessages.forEach((record) => {
      unique.set(record.id, record);
    });
    return Array.from(unique.values());
  }, [firestoreMessages]);

  useEffect(() => {
    setSelectedPropertyIds((current) =>
      current.length > 0 ? current.filter((id) => properties.some((property) => property.id === id)) : []
    );
  }, [properties]);

  useEffect(() => {
    setSelectedCompanyIds((current) =>
      current.length > 0 ? current.filter((id) => companies.some((company) => company.id === id)) : []
    );
  }, [companies]);

  useEffect(() => {
    setSelectedTenantIds((current) =>
      current.length > 0 ? current.filter((id) => tenants.some((tenant) => tenant.id === id)) : []
    );
  }, [tenants]);

  const activeTenantsByUnit = useMemo(() => {
    const map = new Map<string, WorkflowRecord>();
    tenants.forEach((tenant) => {
      if (cleanText(tenant.data.status) !== 'active') return;
      const propertyId = cleanText(tenant.data.propertyId);
      const unitId = cleanText(tenant.data.unitId);
      if (!propertyId || !unitId) return;
      map.set(`${propertyId}::${unitId}`, tenant);
    });
    return map;
  }, [tenants]);

  const themes = useMemo(() => buildMessageThemes(messages, messageThemes), [messageThemes, messages]);

  const openThemes = useMemo(
    () => themes.filter((theme) => !theme.archived && !['closed', 'deleted'].includes(cleanText(theme.status))),
    [themes]
  );

  const newThemes = useMemo(
    () => openThemes.filter((theme) => ['new', 'needs_review'].includes(cleanText(theme.status))),
    [openThemes]
  );

  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const reminders = useMemo(() => {
    const reminderItems: ReminderItem[] = [];

    themes.forEach((theme) => {
      const dueDate = cleanText(theme.reminderDate);
      const parsed = parseDateInput(dueDate);
      if (!parsed) return;
      reminderItems.push({
        dateValue: dueDate,
        href: `/admin/nachrichten?themeId=${theme.id}`,
        id: `theme-${theme.id}`,
        label: cleanText(theme.subject) || 'Thema ohne Betreff',
        meta: `Thema · ${buildTenantLabel(tenants.find((tenant) => tenant.id === theme.tenantId) ?? null)}`,
        type: 'theme',
      });
    });

    messages.forEach((message) => {
      const dueDate = cleanText(message.data.dueDate);
      const parsed = parseDateInput(dueDate);
      if (!parsed) return;
      reminderItems.push({
        dateValue: dueDate,
        href: '/admin/nachrichten',
        id: `message-${message.id}`,
        label: cleanText(message.data.subject) || cleanText(message.data.fromName) || 'Nachricht',
        meta: `Nachricht · ${cleanText(message.data.fromEmail) || 'ohne Absender'}`,
        type: 'message',
      });
    });

    tenants.forEach((tenant) => {
      const rentIncreaseNextReview = cleanText(tenant.data.rentIncreaseNextReview);
      if (parseDateInput(rentIncreaseNextReview)) {
        reminderItems.push({
          dateValue: rentIncreaseNextReview,
          href: buildTenantComposeHref({
            instruction: `Bitte bereite eine sachliche, kurze Nachricht an ${buildTenantLabel(tenant)} vor. Es geht um die Prüfung der nächsten Mieterhöhung. Bitte keine verbindliche Zusage und keine konkrete neue Miete behaupten, sondern freundlich ankündigen, dass die Vertrags- und Rechtslage geprüft wird und wir uns mit den Details separat melden.`,
            propertyId: cleanText(tenant.data.propertyId),
            subject: 'Prüfung Mieterhöhung',
            tenantId: tenant.id,
          }),
          id: `tenant-rent-next-${tenant.id}`,
          label: buildTenantLabel(tenant),
          meta: `Mieterhöhung prüfen · ${getRentIncreaseTypeLabel(tenant.data.rentIncreaseType)}`,
          type: 'tenant',
        });
      }

      const rentIncreaseRows = Array.isArray(tenant.data.rentIncreaseRows)
        ? tenant.data.rentIncreaseRows
        : [];
      rentIncreaseRows.forEach((row, rowIndex) => {
        if (!row || typeof row !== 'object') return;
        const fromDate = cleanText((row as DocumentData).fromDate);
        if (!parseDateInput(fromDate)) return;
        reminderItems.push({
          dateValue: fromDate,
          href: buildTenantComposeHref({
            instruction: `Bitte bereite eine sachliche Nachricht an ${buildTenantLabel(tenant)} zur hinterlegten Staffelmiete ab ${formatDateOnly(fromDate)} vor. Der Ton soll ruhig und klar sein. Bitte keine unnötigen juristischen Details, nur freundliche Information und Hinweis auf die Vertragsgrundlage.`,
            propertyId: cleanText(tenant.data.propertyId),
            subject: 'Staffelmiete',
            tenantId: tenant.id,
          }),
          id: `tenant-rent-row-${tenant.id}-${fromDate}-${rowIndex}`,
          label: buildTenantLabel(tenant),
          meta: `Staffelmiete · ${cleanText((row as DocumentData).coldRent) || 'neue Kaltmiete'}`,
          type: 'tenant',
        });
      });

      const rows = Array.isArray(tenant.data.rentDevelopment) ? tenant.data.rentDevelopment : [];
      rows.forEach((row, rowIndex) => {
        if (!row || typeof row !== 'object') return;
        const reminderDate = cleanText((row as DocumentData).reminderDate);
        const parsed = parseDateInput(reminderDate);
        if (!parsed) return;
        reminderItems.push({
          dateValue: reminderDate,
          href: buildTenantComposeHref({
            instruction: `Bitte bereite eine kurze, professionelle Nachricht an ${buildTenantLabel(tenant)} vor. Anlass ist die Prüfung einer möglichen Mieterhöhung. Bitte zurückhaltend formulieren und keine konkrete Erhöhung zusagen, solange die Prüfung nicht abgeschlossen ist.`,
            propertyId: cleanText(tenant.data.propertyId),
            subject: 'Prüfung Mieterhöhung',
            tenantId: tenant.id,
          }),
          id: `tenant-rent-${tenant.id}-${reminderDate}-${rowIndex}`,
          label: buildTenantLabel(tenant),
          meta: `Mieterhöhung prüfen · ${cleanText((row as DocumentData).kind) || 'Mietvertrag'}`,
          type: 'tenant',
        });
      });
    });

    properties.forEach((property) => {
      const propertyLabel = buildPropertyLabel(property);
      const roofReminderDate = shiftDateByMonths(
        property.data.roofMaintenanceLastMaintenance,
        property.data.roofMaintenanceReminderMonths
      );
      if (roofReminderDate) {
        reminderItems.push({
          dateValue: roofReminderDate,
          href: buildMaintenanceComposeHref({
            instruction: `Bitte bereite eine kurze, verbindliche E-Mail an den zuständigen Dienstleister vor. Wir möchten einen Termin für die Dachwartung am Objekt ${propertyLabel} abstimmen. Bitte um Terminvorschläge und kurze Rückmeldung bitten.`,
            propertyId: property.id,
            serviceField: 'roofMaintenanceId',
            subject: `Termin Dachwartung ${propertyLabel}`,
          }),
          id: `property-roof-${property.id}`,
          label: propertyLabel,
          meta: `Dachwartung · nach ${parseReminderMonths(property.data.roofMaintenanceReminderMonths)} Monaten`,
          type: 'property',
        });
      }

      const gutterReminderDate = shiftDateByMonths(
        property.data.gutterCleaningLastMaintenance,
        property.data.gutterCleaningReminderMonths
      );
      if (gutterReminderDate) {
        reminderItems.push({
          dateValue: gutterReminderDate,
          href: buildMaintenanceComposeHref({
            instruction: `Bitte bereite eine kurze, verbindliche E-Mail an den zuständigen Dienstleister vor. Wir möchten einen Termin für die Regenrinnenreinigung am Objekt ${propertyLabel} abstimmen. Bitte um Terminvorschläge und kurze Rückmeldung bitten.`,
            propertyId: property.id,
            serviceField: 'gutterCleaningId',
            subject: `Termin Regenrinnenreinigung ${propertyLabel}`,
          }),
          id: `property-gutter-${property.id}`,
          label: propertyLabel,
          meta: `Regenrinnenreinigung · nach ${parseReminderMonths(property.data.gutterCleaningReminderMonths)} Monaten`,
          type: 'property',
        });
      }

      const heatingEntries = Array.isArray(property.data.heatingEntries)
        ? property.data.heatingEntries
        : [];
      heatingEntries.forEach((entry, heatingIndex) => {
        if (!entry || typeof entry !== 'object') return;
        const heating = entry as DocumentData;
        const heatingReminderDate = shiftDateByMonths(
          heating.lastMaintenance,
          heating.maintenanceReminderMonths
        );
        if (!heatingReminderDate) return;
        reminderItems.push({
          dateValue: heatingReminderDate,
          href: buildMaintenanceComposeHref({
            instruction: `Bitte bereite eine kurze, verbindliche E-Mail an den zuständigen Dienstleister vor. Wir möchten einen Termin für die Heizungswartung (${cleanText(heating.type) || 'Heizung'}) am Objekt ${propertyLabel} abstimmen. Bitte um Terminvorschläge und kurze Rückmeldung bitten.`,
            propertyId: property.id,
            serviceField: 'heatingServiceId',
            subject: `Termin Heizungswartung ${propertyLabel}`,
          }),
          id: `property-heating-${property.id}-${cleanText(heating.id) || cleanText(heating.type) || heatingIndex}`,
          label: propertyLabel,
          meta: `Heizungswartung · ${cleanText(heating.type) || 'Heizung'} · nach ${parseReminderMonths(heating.maintenanceReminderMonths)} Monaten`,
          type: 'property',
        });
      });

      const units = Array.isArray(property.data.units) ? property.data.units : [];
      units.forEach((unit) => {
        if (!unit || typeof unit !== 'object') return;
        const unitRecord = unit as DocumentData;
        const unitId = cleanText(unitRecord.id);
        const unitLabel = [cleanText(unitRecord.unitLabel), cleanText(unitRecord.floor), cleanText(unitRecord.unitPosition)]
          .filter(Boolean)
          .join(' · ');
        const unitHeatingEntries = Array.isArray(unitRecord.heatingEntries) ? unitRecord.heatingEntries : [];
        unitHeatingEntries.forEach((entry, heatingIndex) => {
          if (!entry || typeof entry !== 'object') return;
          const heating = entry as DocumentData;
          const heatingReminderDate = shiftDateByMonths(
            heating.lastMaintenance,
            heating.maintenanceReminderMonths
          );
          if (!heatingReminderDate) return;
          reminderItems.push({
            dateValue: heatingReminderDate,
            href: buildMaintenanceComposeHref({
              instruction: `Bitte bereite eine kurze, verbindliche E-Mail an den zuständigen Dienstleister vor. Wir möchten einen Termin für die Heizungswartung (${cleanText(heating.type) || 'Heizung'}) am Objekt ${propertyLabel}${unitLabel ? `, Einheit ${unitLabel}` : ''} abstimmen. Bitte um Terminvorschläge und kurze Rückmeldung bitten.`,
              propertyId: property.id,
              serviceField: 'heatingServiceId',
              subject: `Termin Heizungswartung ${propertyLabel}${unitLabel ? ` · ${unitLabel}` : ''}`,
              unitId,
            }),
            id: `unit-heating-${property.id}-${unitId || 'property'}-${cleanText(heating.id) || cleanText(heating.type) || heatingIndex}`,
            label: propertyLabel,
            meta: `Heizungswartung ${unitLabel ? `· ${unitLabel}` : ''} · nach ${parseReminderMonths(heating.maintenanceReminderMonths)} Monaten`,
            type: 'property',
          });
        });
      });
    });

    return reminderItems.sort((left, right) => {
      const leftDate = parseDateInput(left.dateValue)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightDate = parseDateInput(right.dateValue)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return leftDate - rightDate;
    });
  }, [messages, properties, tenants, themes]);

  const dueSoonReminders = useMemo(
    () =>
      reminders.filter((entry) => {
        const date = parseDateInput(entry.dateValue);
        if (!date) return false;
        const diffDays = Math.ceil((date.getTime() - today.getTime()) / 86400000);
        return diffDays <= 14;
      }),
    [reminders, today]
  );

  const dueSoonGeneralReminders = useMemo(
    () => dueSoonReminders.filter((entry) => !isRentIncreaseReminder(entry)),
    [dueSoonReminders]
  );

  const vacancyCount = useMemo(
    () =>
      properties.reduce((total, property) => {
        const units = Array.isArray(property.data.units) ? property.data.units : [];
        return (
          total +
          units.filter((entry: unknown) => {
            if (!entry || typeof entry !== 'object') return false;
            const unitId = cleanText((entry as DocumentData).id);
            if (!unitId) return false;
            return !activeTenantsByUnit.has(`${property.id}::${unitId}`);
          }).length
        );
      }, 0),
    [activeTenantsByUnit, properties]
  );

  const visibleDashboardThemes = useMemo(
    () => (dashboardThemeFilter === 'new' ? newThemes : openThemes),
    [dashboardThemeFilter, newThemes, openThemes]
  );

  const displayedDashboardThemes = useMemo(
    () => (showAllThemes ? visibleDashboardThemes : visibleDashboardThemes.slice(0, 3)),
    [showAllThemes, visibleDashboardThemes]
  );

  const activeRentTenants = useMemo(
    () => tenants.filter((tenant) => cleanText(tenant.data.status) === 'active'),
    [tenants]
  );

  const inventoryLists = useMemo(() => {
    const propertyById = new Map(properties.map((property) => [property.id, property]));
    const companyItems = companies
      .map((company) => ({
        href: `/admin/firma/${company.id}`,
        id: company.id,
        label: cleanText(company.data.name) || company.id,
        meta: cleanText(company.data.email) || 'Firma',
      }))
      .sort((left, right) => left.label.localeCompare(right.label, 'de'));
    const propertyItems = properties
      .map((property) => {
        const units = Array.isArray(property.data.units) ? property.data.units.length : 0;
        return {
          href: `/admin/immobilie/${property.id}`,
          id: property.id,
          label: buildPropertyLabel(property),
          meta: units === 1 ? '1 Einheit' : `${units} Einheiten`,
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label, 'de'));
    const activeTenantItems = activeRentTenants
      .map((tenant) => {
        const property = propertyById.get(cleanText(tenant.data.propertyId));
        return {
          href: `/admin/mieter/${tenant.id}`,
          id: tenant.id,
          label: buildTenantLabel(tenant),
          meta: [
            property ? buildPropertyLabel(property) : '',
            cleanText(tenant.data.unitLabel),
          ]
            .filter(Boolean)
            .join(' · ') || 'Aktiver Mieter',
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label, 'de'));
    const vacancyItems = properties.flatMap((property) => {
      const units = Array.isArray(property.data.units) ? property.data.units : [];
      return units.reduce<InventoryItem[]>((result, entry) => {
        if (!entry || typeof entry !== 'object') return result;
        const unit = entry as DocumentData;
        const unitId = cleanText(unit.id);
        if (!unitId || activeTenantsByUnit.has(`${property.id}::${unitId}`)) return result;
        result.push({
          href: `/admin/einheit/${property.id}/${unitId}`,
          id: `${property.id}-${unitId}`,
          label: buildUnitLabel(unit),
          meta: buildPropertyLabel(property),
        });
        return result;
      }, []);
    });

    return {
      activeTenants: activeTenantItems,
      companies: companyItems,
      properties: propertyItems,
      vacancy: vacancyItems,
    } satisfies Record<DashboardInventoryFilter, InventoryItem[]>;
  }, [activeRentTenants, activeTenantsByUnit, companies, properties]);

  const visibleInventoryItems = inventoryLists[dashboardInventoryFilter];
  const displayedInventoryItems = showAllInventory
    ? visibleInventoryItems
    : visibleInventoryItems.slice(0, 3);

  const currentColdRentTotal = useMemo(
    () => activeRentTenants.reduce((total, tenant) => total + parseMoney(tenant.data.coldRent), 0),
    [activeRentTenants]
  );

  const rentIncreaseReminders = useMemo(
    () => reminders.filter(isRentIncreaseReminder),
    [reminders]
  );

  const activeRentIncreaseReminders = useMemo(
    () => dueSoonReminders.filter(isRentIncreaseReminder),
    [dueSoonReminders]
  );

  const visibleDashboardReminders = useMemo(
    () =>
      dashboardReminderFilter === 'rentIncrease'
        ? showAllReminders
          ? rentIncreaseReminders
          : activeRentIncreaseReminders
        : dueSoonGeneralReminders,
    [
      activeRentIncreaseReminders,
      dashboardReminderFilter,
      dueSoonGeneralReminders,
      rentIncreaseReminders,
      showAllReminders,
    ]
  );

  const displayedDashboardReminders = useMemo(
    () =>
      dashboardReminderFilter === 'rentIncrease' || showAllReminders
        ? visibleDashboardReminders
        : visibleDashboardReminders.slice(0, 3),
    [dashboardReminderFilter, showAllReminders, visibleDashboardReminders]
  );

  const filteredTenantsForChart = useMemo(() => {
    if (rentFilterScope === 'all') return activeRentTenants;

    if (rentFilterScope === 'properties') {
      const filteredPropertyIds =
        selectedPropertyIds.length > 0 ? selectedPropertyIds : properties.map((property) => property.id);
      return activeRentTenants.filter((tenant) =>
        filteredPropertyIds.includes(cleanText(tenant.data.propertyId))
      );
    }

    if (rentFilterScope === 'companies') {
      const filteredCompanyIds =
        selectedCompanyIds.length > 0 ? selectedCompanyIds : companies.map((company) => company.id);
      return activeRentTenants.filter((tenant) =>
        filteredCompanyIds.includes(cleanText(tenant.data.companyId))
      );
    }

    const filteredTenantIds =
      selectedTenantIds.length > 0 ? selectedTenantIds : activeRentTenants.map((tenant) => tenant.id);
    return activeRentTenants.filter((tenant) => filteredTenantIds.includes(tenant.id));
  }, [
    activeRentTenants,
    companies,
    properties,
    rentFilterScope,
    selectedCompanyIds,
    selectedPropertyIds,
    selectedTenantIds,
  ]);

  const dashboardRentPoints = useMemo(() => {
    const tenantSeries = filteredTenantsForChart
      .map((tenant) => {
        const history = Array.isArray(tenant.data.rentHistory) ? tenant.data.rentHistory : [];
        const referenceDate =
          cleanText(tenant.data.rentIncreaseReferenceDate) || cleanText(tenant.data.moveInDate) || '';
        const points = history
          .filter((entry) => entry && typeof entry === 'object')
          .map((entry) => ({
            coldRent: parseMoney((entry as DocumentData).coldRent),
            date: cleanText((entry as DocumentData).effectiveDate),
          }))
          .filter((entry) => entry.date);

        if (referenceDate) {
          points.push({
            coldRent: parseMoney(tenant.data.coldRent),
            date: referenceDate,
          });
        }

        const rentIncreaseRows = Array.isArray(tenant.data.rentIncreaseRows)
          ? tenant.data.rentIncreaseRows
          : [];
        rentIncreaseRows
          .filter((entry) => entry && typeof entry === 'object')
          .forEach((entry) => {
            const date = cleanText((entry as DocumentData).fromDate);
            const coldRent = parseMoney((entry as DocumentData).coldRent);
            if (!date || coldRent <= 0) return;
            points.push({ coldRent, date });
          });

        return points.sort((left, right) => left.date.localeCompare(right.date));
      })
      .filter((points) => points.length > 0);

    const uniqueDates = Array.from(
      new Set(tenantSeries.flatMap((series) => series.map((entry) => entry.date)))
    ).sort((left, right) => left.localeCompare(right));

    return uniqueDates.map((date) => {
      const coldRent = tenantSeries.reduce((total, series) => {
        const latest = series
          .filter((entry) => entry.date <= date)
          .sort((left, right) => left.date.localeCompare(right.date))
          .at(-1);
        return total + (latest?.coldRent ?? 0);
      }, 0);

      return {
        coldRent,
        date,
        label: 'Gesamte Kaltmiete',
        pointType: 'history' as const,
      } satisfies RentHistoryChartPoint;
    });
  }, [filteredTenantsForChart]);

  function togglePropertySelection(propertyId: string) {
    setSelectedPropertyIds((current) =>
      current.includes(propertyId) ? current.filter((id) => id !== propertyId) : [...current, propertyId]
    );
  }

  function toggleCompanySelection(companyId: string) {
    setSelectedCompanyIds((current) =>
      current.includes(companyId) ? current.filter((id) => id !== companyId) : [...current, companyId]
    );
  }

  function toggleTenantSelection(tenantId: string) {
    setSelectedTenantIds((current) =>
      current.includes(tenantId) ? current.filter((id) => id !== tenantId) : [...current, tenantId]
    );
  }

  function resetActiveFilterSelection() {
    if (rentFilterScope === 'properties') {
      setSelectedPropertyIds([]);
      return;
    }
    if (rentFilterScope === 'companies') {
      setSelectedCompanyIds([]);
      return;
    }
    if (rentFilterScope === 'tenants') {
      setSelectedTenantIds([]);
    }
  }

  function focusDashboardSection(
    sectionId: 'dashboard-inventory' | 'dashboard-reminders' | 'dashboard-themes',
    options: {
      inventoryFilter?: DashboardInventoryFilter;
      reminderFilter?: DashboardReminderFilter;
      themeFilter?: DashboardThemeFilter;
    }
  ) {
    if (options.themeFilter) {
      setDashboardThemeFilter(options.themeFilter);
      setShowAllThemes(true);
    }
    if (options.reminderFilter) {
      setDashboardReminderFilter(options.reminderFilter);
      setShowAllReminders(false);
    }
    if (options.inventoryFilter) {
      setDashboardInventoryFilter(options.inventoryFilter);
      setShowAllInventory(true);
    }

    window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  return (
    <div className="min-w-0 space-y-6">
      {loadError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      ) : null}

      <section className="min-w-0 rounded-[24px] border border-stone-200 bg-white p-4 shadow-[0_24px_70px_-56px_rgba(15,23,42,0.38)] sm:p-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-amber-700/80">
          Heute relevant
        </p>

        <div className="mt-4 grid min-w-0 grid-cols-2 gap-px overflow-hidden rounded-[20px] border border-stone-200 bg-stone-200 lg:grid-cols-4">
          {[
            {
              active: dashboardThemeFilter === 'open',
              label: 'Offen',
              onClick: () => focusDashboardSection('dashboard-themes', { themeFilter: 'open' }),
              value: openThemes.length,
            },
            {
              active: dashboardThemeFilter === 'new',
              label: 'Neu',
              onClick: () => focusDashboardSection('dashboard-themes', { themeFilter: 'new' }),
              value: newThemes.length,
            },
            {
              active: dashboardReminderFilter === 'dueSoon',
              label: 'Fristen',
              onClick: () =>
                focusDashboardSection('dashboard-reminders', { reminderFilter: 'dueSoon' }),
              value: dueSoonGeneralReminders.length,
            },
            {
              active: dashboardReminderFilter === 'rentIncrease',
              label: 'Mieterhoehung',
              onClick: () =>
                focusDashboardSection('dashboard-reminders', { reminderFilter: 'rentIncrease' }),
              value: activeRentIncreaseReminders.length,
            },
          ].map((item) => (
            <button
              className={`min-w-0 bg-white px-3 py-4 text-left transition hover:bg-stone-50 sm:px-5 ${
                item.active ? 'shadow-[inset_0_0_0_2px_rgba(15,23,42,0.18)]' : ''
              }`}
              key={item.label}
              onClick={item.onClick}
              type="button"
            >
              <p className="break-words text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500 sm:text-[11px] sm:tracking-[0.18em]">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">{item.value}</p>
            </button>
          ))}
        </div>
      </section>

      <section
        className="min-w-0 scroll-mt-24 rounded-[24px] border border-stone-200 bg-white p-4 sm:p-6"
        id="dashboard-inventory"
      >
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-amber-700/80">
            Bestand
          </p>
          {visibleInventoryItems.length > 3 ? (
            <button
              className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-stone-400 hover:text-slate-950"
              onClick={() => setShowAllInventory((current) => !current)}
              type="button"
            >
              {showAllInventory ? 'Weniger ^' : 'Alle >'}
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid min-w-0 grid-cols-2 gap-px overflow-hidden rounded-[20px] border border-stone-200 bg-stone-200 lg:grid-cols-4">
          {[
            {
              active: dashboardInventoryFilter === 'companies',
              filter: 'companies' as const,
              label: 'Firmen',
              value: companies.length,
            },
            {
              active: dashboardInventoryFilter === 'properties',
              filter: 'properties' as const,
              label: 'Immobilien',
              value: properties.length,
            },
            {
              active: dashboardInventoryFilter === 'activeTenants',
              filter: 'activeTenants' as const,
              label: 'Aktive Mieter',
              value: activeRentTenants.length,
            },
            {
              active: dashboardInventoryFilter === 'vacancy',
              filter: 'vacancy' as const,
              label: 'Leerstand',
              value: vacancyCount,
            },
          ].map((item) => (
            <button
              className={`min-w-0 bg-white px-3 py-4 text-left transition hover:bg-stone-50 sm:px-5 ${
                item.active ? 'shadow-[inset_0_0_0_2px_rgba(15,23,42,0.18)]' : ''
              }`}
              key={item.label}
              onClick={() =>
                focusDashboardSection('dashboard-inventory', { inventoryFilter: item.filter })
              }
              type="button"
            >
              <p className="break-words text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500 sm:text-[11px] sm:tracking-[0.18em]">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">{item.value}</p>
            </button>
          ))}
        </div>

        <div className="mt-5 divide-y divide-stone-200 border-y border-stone-200">
          {displayedInventoryItems.length === 0 ? (
            <div className="py-5">
              <EmptyList text="Keine Einträge vorhanden." />
            </div>
          ) : (
            displayedInventoryItems.map((item) => (
              <Link
                className="grid min-w-0 gap-1 px-1 py-4 transition hover:bg-stone-50/80 sm:grid-cols-[minmax(0,1fr)_minmax(120px,0.45fr)]"
                href={item.href}
                key={item.id}
              >
                <p className="truncate text-sm font-semibold text-slate-950">{item.label}</p>
                <p className="truncate text-xs text-slate-500 sm:text-right">{item.meta}</p>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.85fr)]">
        <div
          className="min-w-0 scroll-mt-24 rounded-[24px] border border-stone-200 bg-white p-4 sm:p-6"
          id="dashboard-themes"
        >
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-amber-700/80">
                Vorgänge
              </p>
              <h3 className="mt-2 font-serif text-2xl leading-tight text-slate-950 sm:text-3xl">
                {dashboardThemeFilter === 'new' ? 'Neue Vorgänge' : 'Offene Vorgänge'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {visibleDashboardThemes.length > 3 ? (
                <button
                  className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-stone-400 hover:text-slate-950"
                  onClick={() => setShowAllThemes((current) => !current)}
                  type="button"
                >
                  {showAllThemes ? 'Weniger ^' : 'Alle >'}
                </button>
              ) : null}
              <Link
                className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-stone-400 hover:text-slate-950"
                href="/admin/nachrichten"
              >
                Nachrichten
              </Link>
            </div>
          </div>

          <div className="mt-5 divide-y divide-stone-200 border-y border-stone-200">
            {visibleDashboardThemes.length === 0 ? (
              <div className="py-5">
                <EmptyList
                  text={
                    dashboardThemeFilter === 'new'
                      ? 'Keine neuen Vorgänge vorhanden.'
                      : 'Keine offenen Vorgänge vorhanden.'
                  }
                />
              </div>
            ) : (
              displayedDashboardThemes.map((theme) => (
                <Link
                  className="grid min-w-0 gap-3 px-1 py-4 transition hover:bg-stone-50/80 md:grid-cols-[minmax(0,1fr)_190px_130px]"
                  href={buildDashboardMessageHref(theme.latestInbound ?? theme.latestEntry)}
                  key={`${theme.tenantId || 'unknown'}-${theme.id}-${theme.latestEntry.id}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {cleanText(theme.subject) || theme.id}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                      {cleanText(theme.latestEntry.data.bodyText) ||
                        cleanText(theme.latestEntry.data.previewText) ||
                        'Keine Vorschau vorhanden.'}
                    </p>
                  </div>
                  <div className="min-w-0 text-sm text-slate-700">
                    <p className="truncate">
                      {cleanText(theme.latestInbound?.data.fromName) ||
                        cleanText(theme.latestEntry.data.fromName) ||
                        buildTenantLabel(tenants.find((tenant) => tenant.id === theme.tenantId)) ||
                        'Ohne Zuordnung'}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {formatDateTime(theme.latestActivityAt)}
                    </p>
                  </div>
                  <div className="flex items-start justify-start md:justify-end">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        cleanText(theme.status) === 'needs_review'
                          ? 'bg-rose-50 text-rose-700'
                          : cleanText(theme.status) === 'in_progress'
                            ? 'bg-sky-50 text-sky-700'
                            : 'bg-stone-100 text-slate-600'
                      }`}
                    >
                      {getStatusLabel(cleanText(theme.status))}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div
          className="min-w-0 scroll-mt-24 rounded-[24px] border border-stone-200 bg-white p-4 sm:p-6"
          id="dashboard-reminders"
        >
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-emerald-700/80">
                Termine
              </p>
              <h3 className="mt-2 font-serif text-2xl leading-tight text-slate-950 sm:text-3xl">
                {dashboardReminderFilter === 'rentIncrease' ? 'Mieterhoehungen' : 'Naechste Fristen'}
              </h3>
            </div>
            {(dashboardReminderFilter === 'rentIncrease'
              ? rentIncreaseReminders.length > activeRentIncreaseReminders.length
              : visibleDashboardReminders.length > 3) ? (
              <button
                className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-stone-400 hover:text-slate-950"
                onClick={() => setShowAllReminders((current) => !current)}
                type="button"
              >
                {showAllReminders ? 'Weniger ^' : 'Alle >'}
              </button>
            ) : null}
          </div>

          <div className="mt-5 divide-y divide-stone-200 border-y border-stone-200">
            {visibleDashboardReminders.length === 0 ? (
              <div className="py-5">
                <EmptyList
                  text={
                    dashboardReminderFilter === 'rentIncrease'
                      ? 'Aktuell keine Mieterhöhungen vorgemerkt.'
                      : 'Aktuell keine Wiedervorlagen in den nächsten 14 Tagen.'
                  }
                />
              </div>
            ) : (
              displayedDashboardReminders.map((entry) => (
                <Link
                  className="grid min-w-0 gap-2 px-1 py-4 transition hover:bg-stone-50/80 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                  href={entry.href}
                  key={`${entry.id}-${entry.href}-${entry.dateValue}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{entry.label}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{entry.meta}</p>
                  </div>
                  <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 sm:justify-self-end">
                    {formatDateOnly(entry.dateValue)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="min-w-0">
        <div className="min-w-0 rounded-[24px] border border-stone-200 bg-white p-4 sm:p-6">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-amber-700/80">
                Kaltmiete
              </p>
              <h3 className="mt-2 font-serif text-2xl leading-tight text-slate-950 sm:text-3xl">Verlauf und Erhöhungen</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Die Kurve enthält gespeicherte Mietstände und geplante Staffeln, sofern sie beim
                Mieter hinterlegt sind.
              </p>
            </div>
            <label className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-2 text-xs text-slate-700 lg:max-w-[220px]">
              <span>Filter</span>
              <select
                className="bg-transparent text-xs text-slate-900 outline-none"
                onChange={(event) => setRentFilterScope(event.target.value as RentFilterScope)}
                value={rentFilterScope}
              >
                <option value="all">Alle</option>
                <option value="properties">Objekte</option>
                <option value="companies">Firmen</option>
                <option value="tenants">Mieter</option>
              </select>
            </label>
          </div>

          <div className="mt-4 space-y-3">
            {rentFilterScope === 'properties' ? (
              <DashboardFilterButtons
                items={properties.map((property) => ({
                  id: property.id,
                  label: cleanText(property.data.name) || property.id,
                }))}
                onReset={resetActiveFilterSelection}
                onToggle={togglePropertySelection}
                selectedIds={selectedPropertyIds}
              />
            ) : null}

            {rentFilterScope === 'companies' ? (
              <DashboardFilterButtons
                items={companies.map((company) => ({
                  id: company.id,
                  label: cleanText(company.data.name) || company.id,
                }))}
                onReset={resetActiveFilterSelection}
                onToggle={toggleCompanySelection}
                selectedIds={selectedCompanyIds}
              />
            ) : null}

            {rentFilterScope === 'tenants' ? (
              <DashboardFilterButtons
                items={activeRentTenants.map((tenant) => ({
                  id: tenant.id,
                  label: buildTenantLabel(tenant),
                }))}
                onReset={resetActiveFilterSelection}
                onToggle={toggleTenantSelection}
                selectedIds={selectedTenantIds}
              />
            ) : null}
          </div>

          <div className="mt-5 min-w-0">
            <RentHistoryChart
              defaultMode="cold"
              emptyText="Für die gewählte Auswahl liegen noch keine Mietdaten vor."
              framed={false}
              points={dashboardRentPoints}
              showCosts={false}
              subtitle=""
              title=""
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function buildPropertyLabel(record?: WorkflowRecord | null) {
  if (!record) return 'Ohne Immobilie';
  return cleanText(record.data.name) || cleanText(record.data.propertyNumber) || record.id;
}
