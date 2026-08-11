'use client';

import Link from 'next/link';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from 'firebase/firestore';
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
  category: 'lease' | 'maintenance' | 'rentIncrease' | 'other';
  dateValue: string;
  href: string;
  id: string;
  label: string;
  meta: string;
  type: 'message' | 'property' | 'tenant' | 'theme';
};

type ArchivedReminderItem = ReminderItem & {
  archivedAt?: unknown;
};

type RentFilterScope = 'all' | 'properties' | 'tenants';
type RentStatisticView = 'breakEven' | 'rentDevelopment';
type RentTimeRange = 'all' | 'last5' | 'last10';
type RentValueMode = 'both' | 'cold' | 'costs';
type DashboardReminderFilter = 'dueSoon' | 'maintenance' | 'rentIncrease';
type DashboardThemeFilter = 'new' | 'open';
type DashboardInventoryFilter = 'activeTenants' | 'properties' | 'vacancy';

type InventoryItem = {
  href: string;
  id: string;
  label: string;
  meta: string;
};

type BreakEvenChartPoint = {
  date: string;
  projectedTotal: number;
  safeTotal: number;
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


function reminderArchiveId(entry: Pick<ReminderItem, 'dateValue' | 'id'>) {
  return `${entry.id}-${entry.dateValue}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function mapArchivedReminder(record: WorkflowRecord): ArchivedReminderItem | null {
  const id = cleanText(record.data.reminderId);
  const dateValue = cleanText(record.data.dateValue);
  if (!id || !dateValue) return null;
  const type = cleanText(record.data.type);
  return {
    archivedAt: record.data.archivedAt,
    category:
      cleanText(record.data.category) === 'lease' ||
      cleanText(record.data.category) === 'maintenance' ||
      cleanText(record.data.category) === 'rentIncrease' ||
      cleanText(record.data.category) === 'other'
        ? (cleanText(record.data.category) as ReminderItem['category'])
        : 'other',
    dateValue,
    href: cleanText(record.data.href),
    id,
    label: cleanText(record.data.label) || 'Termin',
    meta: cleanText(record.data.meta),
    type:
      type === 'message' || type === 'property' || type === 'tenant' || type === 'theme'
        ? type
        : 'property',
  };
}

function parseLeaseEndReminderMonths(value: unknown) {
  const numeric = Number.parseInt(cleanText(value), 10);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 3;
}

function shiftDateByMonths(value: unknown, months: unknown) {
  const date = parseDateInput(value);
  if (!date) return '';
  date.setMonth(date.getMonth() + parseReminderMonths(months));
  return date.toISOString().slice(0, 10);
}

function shiftDateByRawMonths(value: unknown, months: number) {
  const date = parseDateInput(value);
  if (!date) return '';
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function parseNonNegativeInteger(value: unknown) {
  const numeric = Number.parseInt(cleanText(value), 10);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function buildLeaseOptionEndDates(tenantData: DocumentData) {
  if (cleanText(tenantData.leaseOptionEnabled) !== 'yes') return [];
  const baseDate = parseDateInput(tenantData.moveOutDate || tenantData.leaseEndDate || tenantData.endDate);
  if (!baseDate) return [];
  const optionCount = parseNonNegativeInteger(tenantData.leaseOptionCount);
  const optionYears = parseNonNegativeInteger(tenantData.leaseOptionYears);
  if (!optionCount || !optionYears) return [];

  return Array.from({ length: optionCount }, (_, index) => {
    const date = new Date(baseDate);
    date.setFullYear(date.getFullYear() + optionYears * (index + 1));
    return date.toISOString().slice(0, 10);
  });
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

function parseYear(value: unknown) {
  const date = parseDateInput(value);
  return date ? date.getFullYear() : null;
}

function getTenantLeaseContracts(tenant: WorkflowRecord) {
  const contracts = Array.isArray(tenant.data.leaseContracts)
    ? tenant.data.leaseContracts.filter(
        (contract): contract is DocumentData => Boolean(contract) && typeof contract === 'object'
      )
    : [];

  if (contracts.length > 0) return contracts;

  const propertyId = cleanText(tenant.data.propertyId);
  const unitId = cleanText(tenant.data.unitId);
  return propertyId && unitId ? [tenant.data] : [];
}

function isActiveTenantContract(tenant: WorkflowRecord, contract: DocumentData) {
  return cleanText(contract.status || tenant.data.status) === 'active';
}

function getActiveTenantRentTotal(tenant: WorkflowRecord) {
  const contracts = getTenantLeaseContracts(tenant).filter((contract) =>
    isActiveTenantContract(tenant, contract)
  );
  if (contracts.length === 0) return 0;
  return contracts.reduce((total, contract) => total + parseMoney(contract.coldRent), 0);
}

function tenantHasContractInProperties(tenant: WorkflowRecord, propertyIds: string[]) {
  if (propertyIds.length === 0) return true;
  return getTenantLeaseContracts(tenant).some((contract) =>
    propertyIds.includes(cleanText(contract.propertyId))
  );
}

function getContractBaseDate(tenant: WorkflowRecord, contract: DocumentData) {
  return (
    cleanText(contract.moveInDate) ||
    cleanText(tenant.data.rentIncreaseReferenceDate) ||
    cleanText(tenant.data.moveInDate) ||
    ''
  );
}

function getSecureColdRentAtYear(tenant: WorkflowRecord, contract: DocumentData, contractIndex: number, year: number) {
  const baseYear = parseYear(getContractBaseDate(tenant, contract));
  if (baseYear !== null && year < baseYear) return 0;
  let coldRent = parseMoney(contract.coldRent ?? tenant.data.coldRent);
  if (contractIndex !== 0 || cleanText(tenant.data.rentIncreaseType) !== 'graduated') return coldRent;

  const rentIncreaseRows = Array.isArray(tenant.data.rentIncreaseRows) ? tenant.data.rentIncreaseRows : [];
  rentIncreaseRows
    .filter((entry) => entry && typeof entry === 'object')
    .forEach((entry) => {
      const row = entry as DocumentData;
      const rowYear = parseYear(row.fromDate);
      const rowColdRent = parseMoney(row.coldRent);
      if (rowYear !== null && rowYear <= year && rowColdRent > 0) {
        coldRent = rowColdRent;
      }
    });

  return coldRent;
}

function getProjectedColdRentAtYear(tenant: WorkflowRecord, contract: DocumentData, contractIndex: number, year: number) {
  const secureColdRent = getSecureColdRentAtYear(tenant, contract, contractIndex, year);
  if (contractIndex !== 0 || cleanText(tenant.data.rentIncreaseType) !== 'legal') return secureColdRent;

  const referenceDate =
    cleanText(tenant.data.rentIncreaseReferenceDate) ||
    getContractBaseDate(tenant, contract);
  const referenceYear = parseYear(referenceDate);
  if (referenceYear === null || year <= referenceYear) return secureColdRent;
  const increaseSteps = Math.floor((year - referenceYear) / 3);
  return secureColdRent * 1.1 ** Math.max(increaseSteps, 0);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('de-DE', {
    currency: 'EUR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function niceDashboardStep(rawStep: number) {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 10000;
  const exponent = Math.floor(Math.log10(rawStep));
  const base = 10 ** exponent;
  const fraction = rawStep / base;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return Math.max(niceFraction * base, 1000);
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
  if (entry.category !== 'rentIncrease') return false;
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

function isLeaseReminder(entry: ReminderItem) {
  return entry.category === 'lease';
}

function isMaintenanceReminder(entry: ReminderItem) {
  return entry.category === 'maintenance';
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

function BreakEvenChart({
  currentAnnualProjectedRent,
  currentAnnualSafeRent,
  projectedBreakEvenYear,
  purchasePrice,
  safeBreakEvenYear,
  points,
}: {
  currentAnnualProjectedRent: number;
  currentAnnualSafeRent: number;
  projectedBreakEvenYear: number | null;
  purchasePrice: number;
  safeBreakEvenYear: number | null;
  points: BreakEvenChartPoint[];
}) {
  if (purchasePrice <= 0) {
    return (
      <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 px-4 py-4 text-sm text-slate-600">
        Fuer die Break-Even-Ansicht fehlt noch ein Kaufpreis beim ausgewaehlten Objekt.
      </div>
    );
  }
  if (points.length === 0) {
    return (
      <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 px-4 py-4 text-sm text-slate-600">
        Fuer die gewaehlte Auswahl liegen noch keine Mietdaten vor.
      </div>
    );
  }

  const width = Math.max(760, points.length * 70);
  const height = 280;
  const padding = { bottom: 42, left: 86, right: 24, top: 20 };
  const maxValue = Math.max(
    purchasePrice,
    ...points.flatMap((point) => [point.safeTotal, point.projectedTotal]),
    1
  );
  const yStep = niceDashboardStep(maxValue / 4);
  const yMax = Math.max(yStep, Math.ceil(maxValue / yStep) * yStep);
  const minYear = Number.parseInt(points[0].date.slice(0, 4), 10);
  const maxYear = Number.parseInt(points[points.length - 1].date.slice(0, 4), 10);
  const yearRange = Math.max(maxYear - minYear, 1);
  const toX = (date: string) => {
    const year = Number.parseInt(date.slice(0, 4), 10);
    return padding.left + ((year - minYear) / yearRange) * (width - padding.left - padding.right);
  };
  const toY = (value: number) =>
    height - padding.bottom - (value / yMax) * (height - padding.top - padding.bottom);
  const lineFor = (key: 'projectedTotal' | 'safeTotal') =>
    points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${toX(point.date).toFixed(2)} ${toY(point[key]).toFixed(2)}`)
      .join(' ');
  const purchaseY = toY(purchasePrice);
  const yTicks = Array.from({ length: Math.floor(yMax / yStep) + 1 }, (_, index) => {
    const value = index * yStep;
    return { label: formatMoney(value), value, y: toY(value) };
  });

  return (
    <div>
      <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-4">
        <div className="rounded-[16px] border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500">Kaufpreis</p>
          <p className="mt-1 font-semibold text-slate-950">{formatMoney(purchasePrice)}</p>
        </div>
        <div className="rounded-[16px] border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500">Jahresmiete aktuell</p>
          <p className="mt-1 font-semibold text-slate-950">
            {formatMoney(currentAnnualSafeRent)}
            {currentAnnualProjectedRent > currentAnnualSafeRent ? ` / ${formatMoney(currentAnnualProjectedRent)}` : ''}
          </p>
        </div>
        <div className="rounded-[16px] border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500">Sicherer Break Even</p>
          <p className="mt-1 font-semibold text-slate-950">{safeBreakEvenYear ?? 'nach 50+ Jahren'}</p>
        </div>
        <div className="rounded-[16px] border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500">Mit Prognose</p>
          <p className="mt-1 font-semibold text-slate-950">{projectedBreakEvenYear ?? 'nach 50+ Jahren'}</p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <svg className="h-auto min-w-[720px] w-full" viewBox={`0 0 ${width} ${height}`}>
          {yTicks.map((tick) => (
            <g key={tick.value}>
              <line
                stroke="#e7e5e4"
                strokeDasharray={tick.value === 0 ? '0' : '4 6'}
                strokeWidth="1"
                x1={padding.left}
                x2={width - padding.right}
                y1={tick.y}
                y2={tick.y}
              />
              <text fill="#78716c" fontSize="11" textAnchor="end" x={padding.left - 8} y={tick.y + 4}>
                {tick.label}
              </text>
            </g>
          ))}
          <line
            stroke="#7f1d1d"
            strokeDasharray="8 6"
            strokeWidth="2"
            x1={padding.left}
            x2={width - padding.right}
            y1={purchaseY}
            y2={purchaseY}
          />
          <path d={lineFor('safeTotal')} fill="none" stroke="#b45309" strokeWidth="3" />
          <path d={lineFor('projectedTotal')} fill="none" stroke="#0f766e" strokeWidth="3" />
          {points.map((point) => (
            <g key={point.date}>
              <circle cx={toX(point.date)} cy={toY(point.safeTotal)} fill="#b45309" r="3.8">
                <title>{`${point.date.slice(0, 4)} sicher: ${formatMoney(point.safeTotal)}`}</title>
              </circle>
              <circle cx={toX(point.date)} cy={toY(point.projectedTotal)} fill="#0f766e" r="3.8">
                <title>{`${point.date.slice(0, 4)} Prognose: ${formatMoney(point.projectedTotal)}`}</title>
              </circle>
              <text fill="#78716c" fontSize="11" textAnchor="middle" x={toX(point.date)} y={height - 12}>
                {point.date.slice(0, 4)}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-900" />
          Kaufpreis
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-700" />
          Sichere Mietsumme
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-teal-700" />
          Mit geplanten Erhoehungen
        </span>
      </div>
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
  const [archivedReminders, setArchivedReminders] = useState<WorkflowRecord[]>([]);
  const [tenants, setTenants] = useState<WorkflowRecord[]>([]);
  const [properties, setProperties] = useState<WorkflowRecord[]>([]);
  const [people, setPeople] = useState<WorkflowRecord[]>([]);
  const [loadError, setLoadError] = useState('');
  const [rentStatisticView, setRentStatisticView] = useState<RentStatisticView>('rentDevelopment');
  const [rentTimeRange, setRentTimeRange] = useState<RentTimeRange>('last10');
  const [rentFilterScope, setRentFilterScope] = useState<RentFilterScope>('all');
  const [rentValueMode, setRentValueMode] = useState<RentValueMode>('both');
  const [dashboardReminderFilter, setDashboardReminderFilter] =
    useState<DashboardReminderFilter>('dueSoon');
  const [dashboardThemeFilter, setDashboardThemeFilter] = useState<DashboardThemeFilter>('open');
  const [dashboardInventoryFilter, setDashboardInventoryFilter] =
    useState<DashboardInventoryFilter>('properties');
  const [showAllInventory, setShowAllInventory] = useState(false);
  const [showAllReminders, setShowAllReminders] = useState(false);
  const [showReminderArchive, setShowReminderArchive] = useState(false);
  const [showAllThemes, setShowAllThemes] = useState(false);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribers = [
      readCollection('messages', setLoadError, setFirestoreMessages),
      readCollection('tenants', setLoadError, setTenants),
      readCollection('properties', setLoadError, setProperties),
      readCollection('people', setLoadError, setPeople),
      readCollection('dashboardReminderArchive', setLoadError, setArchivedReminders),
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

  async function markReminderDone(entry: ReminderItem) {
    if (!user) return;
    await setDoc(doc(db, 'dashboardReminderArchive', reminderArchiveId(entry)), {
      archivedAt: serverTimestamp(),
      archivedByEmail: user.email ?? '',
      archivedByUid: user.uid,
      dateValue: entry.dateValue,
      href: entry.href,
      label: entry.label,
      meta: entry.meta,
      reminderId: entry.id,
      category: entry.category,
      type: entry.type,
    });
  }

  async function reactivateReminder(entry: ReminderItem) {
    await deleteDoc(doc(db, 'dashboardReminderArchive', reminderArchiveId(entry)));
  }

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
    setSelectedTenantIds((current) =>
      current.length > 0 ? current.filter((id) => tenants.some((tenant) => tenant.id === id)) : []
    );
  }, [tenants]);

  const activeTenantsByUnit = useMemo(() => {
    const map = new Map<string, WorkflowRecord>();
    tenants.forEach((tenant) => {
      getTenantLeaseContracts(tenant).forEach((contract) => {
        if (!isActiveTenantContract(tenant, contract)) return;
        const propertyId = cleanText(contract.propertyId);
        const unitId = cleanText(contract.unitId);
        if (!propertyId || !unitId) return;
        map.set(`${propertyId}::${unitId}`, tenant);
      });
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
        category: 'other',
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
        category: 'other',
        dateValue: dueDate,
        href: '/admin/nachrichten',
        id: `message-${message.id}`,
        label: cleanText(message.data.subject) || cleanText(message.data.fromName) || 'Nachricht',
        meta: `Nachricht · ${cleanText(message.data.fromEmail) || 'ohne Absender'}`,
        type: 'message',
      });
    });

    tenants.forEach((tenant) => {
      getTenantLeaseContracts(tenant).forEach((contract, contractIndex) => {
        const contractId = cleanText(contract.id) || String(contractIndex);
        const unitLabel = cleanText(contract.unitLabel);
        const leaseEndDate = cleanText(contract.moveOutDate || contract.leaseEndDate || contract.endDate);
        const leaseEndReminderMonths = parseLeaseEndReminderMonths(
          contract.leaseEndReminderMonths ?? tenant.data.leaseEndReminderMonths
        );
        const leaseEndReminderDate = shiftDateByRawMonths(
          leaseEndDate,
          -leaseEndReminderMonths
        );
        if (contractIndex === 0 && leaseEndReminderDate) {
          reminderItems.push({
            category: 'lease',
            dateValue: leaseEndReminderDate,
            href: `/admin/mieter/${tenant.id}`,
            id: `tenant-lease-end-${tenant.id}-${contractId}`,
            label: buildTenantLabel(tenant),
            meta: `${unitLabel ? `${unitLabel} - ` : ''}Mietvertrag endet am ${formatDateOnly(leaseEndDate)} - Warnung ${leaseEndReminderMonths} Monate vorher`,
            type: 'tenant',
          });
        }

        if (contractIndex === 0) buildLeaseOptionEndDates(contract).forEach((optionEndDate, optionIndex) => {
          const optionReminderDate = shiftDateByRawMonths(
            optionEndDate,
            -leaseEndReminderMonths
          );
          if (!optionReminderDate) return;
          reminderItems.push({
            category: 'lease',
            dateValue: optionReminderDate,
            href: `/admin/mieter/${tenant.id}`,
            id: `tenant-option-end-${tenant.id}-${contractId}-${optionIndex}`,
            label: buildTenantLabel(tenant),
            meta: `${unitLabel ? `${unitLabel} - ` : ''}Option ${optionIndex + 1} endet am ${formatDateOnly(optionEndDate)} - Warnung ${leaseEndReminderMonths} Monate vorher`,
            type: 'tenant',
          });
        });

        const contractRentIncreaseNextReview = cleanText(contract.rentIncreaseNextReview);
        if (contractIndex > 0 && parseDateInput(contractRentIncreaseNextReview)) {
          reminderItems.push({
            category: 'rentIncrease',
            dateValue: contractRentIncreaseNextReview,
            href: `/admin/mieter/${tenant.id}`,
            id: `tenant-contract-rent-${tenant.id}-${contractId}`,
            label: buildTenantLabel(tenant),
            meta: `${unitLabel ? `${unitLabel} - ` : ''}Mieterhoehung pruefen`,
            type: 'tenant',
          });
        }
      });
      const rentIncreaseType = cleanText(tenant.data.rentIncreaseType);
      const rentIncreaseNextReview = cleanText(tenant.data.rentIncreaseNextReview);
      if (rentIncreaseType && parseDateInput(rentIncreaseNextReview)) {
        reminderItems.push({
          category: 'rentIncrease',
          dateValue: rentIncreaseNextReview,
          href: `/admin/mieter/${tenant.id}`,
          id: `tenant-rent-next-${tenant.id}`,
          label: buildTenantLabel(tenant),
          meta: `Mieterhöhung prüfen · ${getRentIncreaseTypeLabel(rentIncreaseType)}`,
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
          category: 'rentIncrease',
          dateValue: fromDate,
          href: `/admin/mieter/${tenant.id}`,
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
          category: 'rentIncrease',
          dateValue: reminderDate,
          href: `/admin/mieter/${tenant.id}`,
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
          category: 'maintenance',
          dateValue: roofReminderDate,
          href: `/admin/immobilie/${property.id}/details#maintenance`,
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
          category: 'maintenance',
          dateValue: gutterReminderDate,
          href: `/admin/immobilie/${property.id}/details#maintenance`,
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
          category: 'maintenance',
          dateValue: heatingReminderDate,
          href: `/admin/immobilie/${property.id}/details#maintenance`,
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
            category: 'maintenance',
            dateValue: heatingReminderDate,
            href: `/admin/immobilie/${property.id}/details#maintenance`,
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

  const archivedReminderItems = useMemo(
    () =>
      archivedReminders
        .map(mapArchivedReminder)
        .filter((entry): entry is ArchivedReminderItem => Boolean(entry))
        .sort((left, right) => {
          const leftDate = parseDateInput(left.dateValue)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const rightDate = parseDateInput(right.dateValue)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return rightDate - leftDate;
        }),
    [archivedReminders]
  );

  const archivedReminderKeys = useMemo(
    () => new Set(archivedReminderItems.map(reminderArchiveId)),
    [archivedReminderItems]
  );

  const activeReminders = useMemo(
    () => reminders.filter((entry) => !archivedReminderKeys.has(reminderArchiveId(entry))),
    [archivedReminderKeys, reminders]
  );

  const dueSoonReminders = useMemo(
    () =>
      activeReminders.filter((entry) => {
        const date = parseDateInput(entry.dateValue);
        if (!date) return false;
        const diffDays = Math.ceil((date.getTime() - today.getTime()) / 86400000);
        return diffDays <= 14;
      }),
    [activeReminders, today]
  );

  const leaseReminders = useMemo(
    () => activeReminders.filter(isLeaseReminder),
    [activeReminders]
  );

  const dueSoonLeaseReminders = useMemo(
    () => dueSoonReminders.filter(isLeaseReminder),
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
        const activeContracts = getTenantLeaseContracts(tenant).filter((contract) =>
          isActiveTenantContract(tenant, contract)
        );
        const propertyNames = Array.from(
          new Set(
            activeContracts
              .map((contract) => propertyById.get(cleanText(contract.propertyId)))
              .filter((property): property is WorkflowRecord => Boolean(property))
              .map(buildPropertyLabel)
          )
        );
        const unitLabels = activeContracts.map((contract) => cleanText(contract.unitLabel)).filter(Boolean);
        return {
          href: `/admin/mieter/${tenant.id}`,
          id: tenant.id,
          label: buildTenantLabel(tenant),
          meta: [...propertyNames, ...unitLabels].join(' - ') || 'Aktiver Mieter',
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
      properties: propertyItems,
      vacancy: vacancyItems,
    } satisfies Record<DashboardInventoryFilter, InventoryItem[]>;
  }, [activeRentTenants, activeTenantsByUnit, properties]);

  const visibleInventoryItems = inventoryLists[dashboardInventoryFilter];
  const displayedInventoryItems = showAllInventory
    ? visibleInventoryItems
    : visibleInventoryItems.slice(0, 3);

  const currentColdRentTotal = useMemo(
    () => activeRentTenants.reduce((total, tenant) => total + getActiveTenantRentTotal(tenant), 0),
    [activeRentTenants]
  );

  const rentIncreaseReminders = useMemo(
    () => activeReminders.filter(isRentIncreaseReminder),
    [activeReminders]
  );

  const activeRentIncreaseReminders = useMemo(
    () => dueSoonReminders.filter(isRentIncreaseReminder),
    [dueSoonReminders]
  );

  const maintenanceReminders = useMemo(
    () => activeReminders.filter(isMaintenanceReminder),
    [activeReminders]
  );

  const activeMaintenanceReminders = useMemo(
    () => dueSoonReminders.filter(isMaintenanceReminder),
    [dueSoonReminders]
  );

  const visibleDashboardReminders = useMemo(
    () =>
      showReminderArchive
        ? archivedReminderItems
        :
      dashboardReminderFilter === 'rentIncrease'
        ? showAllReminders
          ? rentIncreaseReminders
          : activeRentIncreaseReminders
        : dashboardReminderFilter === 'maintenance'
          ? showAllReminders
            ? maintenanceReminders
            : activeMaintenanceReminders
          : showAllReminders
            ? leaseReminders
            : dueSoonLeaseReminders,
    [
      activeRentIncreaseReminders,
      activeMaintenanceReminders,
      archivedReminderItems,
      dashboardReminderFilter,
      dueSoonLeaseReminders,
      leaseReminders,
      maintenanceReminders,
      rentIncreaseReminders,
      showAllReminders,
      showReminderArchive,
    ]
  );

  const displayedDashboardReminders = useMemo(
    () =>
      showReminderArchive || dashboardReminderFilter === 'rentIncrease' || showAllReminders
        ? visibleDashboardReminders
        : visibleDashboardReminders.slice(0, 3),
    [dashboardReminderFilter, showAllReminders, showReminderArchive, visibleDashboardReminders]
  );

  const selectedReminderTotal = useMemo(() => {
    if (dashboardReminderFilter === 'rentIncrease') return rentIncreaseReminders.length;
    if (dashboardReminderFilter === 'maintenance') return maintenanceReminders.length;
    return leaseReminders.length;
  }, [dashboardReminderFilter, leaseReminders.length, maintenanceReminders.length, rentIncreaseReminders.length]);

  const selectedActiveReminderTotal = useMemo(() => {
    if (dashboardReminderFilter === 'rentIncrease') return activeRentIncreaseReminders.length;
    if (dashboardReminderFilter === 'maintenance') return activeMaintenanceReminders.length;
    return dueSoonLeaseReminders.length;
  }, [
    activeMaintenanceReminders.length,
    activeRentIncreaseReminders.length,
    dashboardReminderFilter,
    dueSoonLeaseReminders.length,
  ]);

  const filteredTenantsForChart = useMemo(() => {
    if (rentFilterScope === 'all') return activeRentTenants;

    if (rentFilterScope === 'properties') {
      const filteredPropertyIds =
        selectedPropertyIds.length > 0 ? selectedPropertyIds : properties.map((property) => property.id);
      return activeRentTenants.filter((tenant) => tenantHasContractInProperties(tenant, filteredPropertyIds));
    }

    const filteredTenantIds =
      selectedTenantIds.length > 0 ? selectedTenantIds : activeRentTenants.map((tenant) => tenant.id);
    return activeRentTenants.filter((tenant) => filteredTenantIds.includes(tenant.id));
  }, [
    activeRentTenants,
    properties,
    rentFilterScope,
    selectedPropertyIds,
    selectedTenantIds,
  ]);

  const dashboardRentPoints = useMemo(() => {
    const selectedPropertySet =
      rentFilterScope === 'properties' && selectedPropertyIds.length > 0
        ? new Set(selectedPropertyIds)
        : null;
    const contractSeries = filteredTenantsForChart.flatMap((tenant) =>
      getTenantLeaseContracts(tenant)
        .filter((contract) => isActiveTenantContract(tenant, contract))
        .filter((contract) => !selectedPropertySet || selectedPropertySet.has(cleanText(contract.propertyId)))
        .map((contract, contractIndex) => {
          const points: Array<{ coldRent: number; date: string; netOperatingCosts: number }> = [];
          const addPoint = (date: unknown, coldRent: unknown, netOperatingCosts: unknown) => {
            const dateText = cleanText(date);
            if (!dateText) return;
            points.push({
              coldRent: parseMoney(coldRent),
              date: dateText,
              netOperatingCosts: parseMoney(netOperatingCosts),
            });
          };

          if (contractIndex === 0) {
            const history = Array.isArray(tenant.data.rentHistory) ? tenant.data.rentHistory : [];
            history
              .filter((entry) => entry && typeof entry === 'object')
              .forEach((entry) => {
                const data = entry as DocumentData;
                addPoint(data.effectiveDate, data.coldRent, data.netOperatingCosts);
              });

            addPoint(
              cleanText(tenant.data.rentIncreaseReferenceDate) || cleanText(contract.moveInDate) || cleanText(tenant.data.moveInDate),
              contract.coldRent ?? tenant.data.coldRent,
              contract.netOperatingCosts ?? tenant.data.netOperatingCosts
            );

            const rentIncreaseRows = Array.isArray(tenant.data.rentIncreaseRows)
              ? tenant.data.rentIncreaseRows
              : [];
            rentIncreaseRows
              .filter((entry) => entry && typeof entry === 'object')
              .forEach((entry) => {
                const data = entry as DocumentData;
                addPoint(data.fromDate, data.coldRent, data.netOperatingCosts ?? contract.netOperatingCosts);
              });
          } else {
            addPoint(
              contract.moveInDate || tenant.data.moveInDate,
              contract.coldRent,
              contract.netOperatingCosts
            );
          }

          return points.sort((left, right) => left.date.localeCompare(right.date));
        })
        .filter((points) => points.length > 0)
    );

    if (contractSeries.length === 0) return [];

    const currentYear = new Date().getFullYear();
    const dataYears = contractSeries.flatMap((series) =>
      series.map((point) => new Date(`${point.date}T12:00:00`).getFullYear()).filter(Number.isFinite)
    );
    const minDataYear = dataYears.length > 0 ? Math.min(...dataYears) : currentYear;
    const startYear =
      rentTimeRange === 'last5'
        ? currentYear - 4
        : rentTimeRange === 'last10'
          ? currentYear - 9
          : minDataYear;
    const years = Array.from(
      { length: Math.max(currentYear - startYear + 1, 1) },
      (_, index) => startYear + index
    );

    return years.map((year) => {
      const cutoffDate = `${year}-12-31`;
      const totals = contractSeries.reduce(
        (result, series) => {
          const latest = series
            .filter((entry) => entry.date <= cutoffDate)
            .sort((left, right) => left.date.localeCompare(right.date))
            .at(-1);
          return {
            coldRent: result.coldRent + (latest?.coldRent ?? 0),
            netOperatingCosts: result.netOperatingCosts + (latest?.netOperatingCosts ?? 0),
          };
        },
        { coldRent: 0, netOperatingCosts: 0 }
      );

      return {
        coldRent: totals.coldRent,
        date: `${year}-01-01`,
        label: 'Jahressumme',
        netOperatingCosts: totals.netOperatingCosts,
        pointType: 'history' as const,
      } satisfies RentHistoryChartPoint;
    });
  }, [filteredTenantsForChart, rentFilterScope, rentTimeRange, selectedPropertyIds]);

  const breakEvenData = useMemo(() => {
    const selectedPropertySet =
      rentFilterScope === 'properties' && selectedPropertyIds.length > 0
        ? new Set(selectedPropertyIds)
        : null;
    const contractSeries = filteredTenantsForChart.flatMap((tenant) =>
      getTenantLeaseContracts(tenant)
        .map((contract, contractIndex) => ({ contract, contractIndex, tenant }))
        .filter(({ contract, tenant }) => isActiveTenantContract(tenant, contract))
        .filter(({ contract }) => !selectedPropertySet || selectedPropertySet.has(cleanText(contract.propertyId)))
    );
    const contractPropertyIds = Array.from(
      new Set(contractSeries.map(({ contract }) => cleanText(contract.propertyId)).filter(Boolean))
    );
    const propertyIds =
      rentFilterScope === 'properties'
        ? selectedPropertyIds.length > 0
          ? selectedPropertyIds
          : properties.map((property) => property.id)
        : rentFilterScope === 'all'
          ? properties.map((property) => property.id)
          : contractPropertyIds;
    const selectedProperties = properties.filter((property) => propertyIds.includes(property.id));
    const purchasePrice = selectedProperties.reduce(
      (total, property) => total + parseMoney(property.data.purchasePrice),
      0
    );
    const propertyStartYears = selectedProperties
      .map((property) => parseYear(property.data.ownershipSince || property.data.purchaseDate))
      .filter((year): year is number => year !== null);
    const contractStartYears = contractSeries
      .map(({ contract, tenant }) => parseYear(getContractBaseDate(tenant, contract)))
      .filter((year): year is number => year !== null);
    const currentYear = new Date().getFullYear();
    const currentAnnualSafeRent = contractSeries.reduce(
      (total, { contract, contractIndex, tenant }) =>
        total + getSecureColdRentAtYear(tenant, contract, contractIndex, currentYear) * 12,
      0
    );
    const currentAnnualProjectedRent = contractSeries.reduce(
      (total, { contract, contractIndex, tenant }) =>
        total + getProjectedColdRentAtYear(tenant, contract, contractIndex, currentYear) * 12,
      0
    );
    const startYear = Math.min(...(propertyStartYears.length > 0 ? propertyStartYears : contractStartYears), currentYear);
    const maxProjectionYear = startYear + 50;
    let safeTotal = 0;
    let projectedTotal = 0;
    const points: BreakEvenChartPoint[] = [];
    let safeBreakEvenYear: number | null = null;
    let projectedBreakEvenYear: number | null = null;

    for (let year = startYear; year <= maxProjectionYear; year += 1) {
      const annualSafeRent = contractSeries.reduce(
        (total, { contract, contractIndex, tenant }) =>
          total + getSecureColdRentAtYear(tenant, contract, contractIndex, year) * 12,
        0
      );
      const annualProjectedRent = contractSeries.reduce(
        (total, { contract, contractIndex, tenant }) =>
          total + getProjectedColdRentAtYear(tenant, contract, contractIndex, year) * 12,
        0
      );
      safeTotal += annualSafeRent;
      projectedTotal += annualProjectedRent;
      if (!safeBreakEvenYear && purchasePrice > 0 && safeTotal >= purchasePrice) safeBreakEvenYear = year;
      if (!projectedBreakEvenYear && purchasePrice > 0 && projectedTotal >= purchasePrice) projectedBreakEvenYear = year;
      points.push({ date: `${year}-01-01`, projectedTotal, safeTotal });

      if (
        year >= currentYear + 10 &&
        (purchasePrice <= 0 || (safeBreakEvenYear && projectedBreakEvenYear))
      ) {
        break;
      }
    }

    return {
      currentAnnualProjectedRent,
      currentAnnualSafeRent,
      points,
      projectedBreakEvenYear,
      purchasePrice,
      safeBreakEvenYear,
    };
  }, [filteredTenantsForChart, properties, rentFilterScope, selectedPropertyIds]);

  function togglePropertySelection(propertyId: string) {
    setSelectedPropertyIds((current) =>
      current.includes(propertyId) ? current.filter((id) => id !== propertyId) : [...current, propertyId]
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
    if (rentFilterScope === 'tenants') {
      setSelectedTenantIds([]);
    }
  }

  function focusDashboardSection(
    sectionId: 'dashboard-inventory' | 'dashboard-reminders',
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
      setShowReminderArchive(false);
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

        <div className="mt-4 grid min-w-0 grid-cols-1 gap-px overflow-hidden rounded-[20px] border border-stone-200 bg-stone-200 sm:grid-cols-3">
          {[
            {
              active: dashboardReminderFilter === 'dueSoon' && !showReminderArchive,
              label: 'Fristen',
              onClick: () =>
                focusDashboardSection('dashboard-reminders', { reminderFilter: 'dueSoon' }),
              value: dueSoonLeaseReminders.length,
            },
            {
              active: dashboardReminderFilter === 'rentIncrease' && !showReminderArchive,
              label: 'Mieterhoehung',
              onClick: () =>
                focusDashboardSection('dashboard-reminders', { reminderFilter: 'rentIncrease' }),
              value: activeRentIncreaseReminders.length,
            },
            {
              active: dashboardReminderFilter === 'maintenance' && !showReminderArchive,
              label: 'Termine',
              onClick: () =>
                focusDashboardSection('dashboard-reminders', { reminderFilter: 'maintenance' }),
              value: activeMaintenanceReminders.length,
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

        <div className="mt-4 grid min-w-0 grid-cols-2 gap-px overflow-hidden rounded-[20px] border border-stone-200 bg-stone-200 lg:grid-cols-3">
          {[
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

      <section className="min-w-0">
        <div
          className="hidden"
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
                {showReminderArchive
                  ? 'Archiv'
                  : dashboardReminderFilter === 'rentIncrease'
                    ? 'Mieterhoehungen'
                    : dashboardReminderFilter === 'maintenance'
                      ? 'Termine'
                      : 'Fristen'}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  showReminderArchive
                    ? 'border-amber-700 bg-amber-700 text-white'
                    : 'border-stone-300 text-slate-700 hover:border-stone-400 hover:text-slate-950'
                }`}
                onClick={() => setShowReminderArchive((current) => !current)}
                type="button"
              >
                Archiv
              </button>
              {!showReminderArchive &&
              (selectedReminderTotal > selectedActiveReminderTotal || visibleDashboardReminders.length > 3) ? (
                <button
                  className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-stone-400 hover:text-slate-950"
                  onClick={() => setShowAllReminders((current) => !current)}
                  type="button"
                >
                  {showAllReminders ? 'Weniger ^' : 'Alle >'}
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-5 divide-y divide-stone-200 border-y border-stone-200">
            {visibleDashboardReminders.length === 0 ? (
              <div className="py-5">
                <EmptyList
                  text={
                    showReminderArchive
                      ? 'Noch keine erledigten Termine im Archiv.'
                      : dashboardReminderFilter === 'rentIncrease'
                      ? 'Aktuell keine Mieterhöhungen vorgemerkt.'
                      : dashboardReminderFilter === 'maintenance'
                        ? 'Aktuell keine Wartungstermine in den nächsten 14 Tagen.'
                        : 'Aktuell keine Miet- oder Optionsfristen in den nächsten 14 Tagen.'
                  }
                />
              </div>
            ) : (
              displayedDashboardReminders.map((entry) => (
                <div
                  className="grid min-w-0 gap-3 px-1 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                  key={`${entry.id}-${entry.href}-${entry.dateValue}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{entry.label}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{entry.meta}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-self-end">
                    <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                      {formatDateOnly(entry.dateValue)}
                    </span>
                    <button
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        showReminderArchive
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-stone-300 bg-white text-slate-700 hover:border-emerald-300 hover:text-emerald-700'
                      }`}
                      onClick={() => {
                        if (showReminderArchive) {
                          void reactivateReminder(entry);
                          return;
                        }
                        void markReminderDone(entry);
                      }}
                      type="button"
                    >
                      {showReminderArchive ? 'Reaktivieren' : 'Erledigt'}
                    </button>
                  </div>
                </div>
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
                Statistik
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {[
                  { label: 'Mietentwicklung', value: 'rentDevelopment' },
                  { label: 'Break Even', value: 'breakEven' },
                ].map((option) => (
                  <button
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      rentStatisticView === option.value
                        ? 'border-amber-700 bg-amber-700 text-white'
                        : 'border-stone-300 bg-white text-slate-700 hover:border-amber-700/40 hover:text-slate-950'
                    }`}
                    key={option.value}
                    onClick={() => setRentStatisticView(option.value as RentStatisticView)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {rentStatisticView === 'breakEven'
                  ? 'Kumulierte Mieten gegen Kaufpreis: sicher mit Staffeln und als Prognose mit gesetzlichen Erhoehungen.'
                  : 'Jahresvergleich fuer Kaltmiete und Nebenkosten nach Mieter, Objekt oder Gesamtbestand.'}
              </p>
            </div>
            <div className={`grid w-full gap-2 ${rentStatisticView === 'breakEven' ? 'max-w-xs' : 'max-w-3xl sm:grid-cols-3'}`}>
              {rentStatisticView === 'rentDevelopment' ? (
                <>
                  <label className="flex min-w-0 items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-2 text-xs text-slate-700">
                    <span>Zeitraum</span>
                    <select
                      className="min-w-0 flex-1 bg-transparent text-xs text-slate-900 outline-none"
                      onChange={(event) => setRentTimeRange(event.target.value as RentTimeRange)}
                      value={rentTimeRange}
                    >
                      <option value="all">Gesamtzeit</option>
                      <option value="last5">Letzte 5 Jahre</option>
                      <option value="last10">Letzte 10 Jahre</option>
                    </select>
                  </label>
                  <label className="flex min-w-0 items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-2 text-xs text-slate-700">
                    <span>Anzeige</span>
                    <select
                      className="min-w-0 flex-1 bg-transparent text-xs text-slate-900 outline-none"
                      onChange={(event) => setRentValueMode(event.target.value as RentValueMode)}
                      value={rentValueMode}
                    >
                      <option value="cold">Kaltmiete</option>
                      <option value="costs">Nebenkosten</option>
                      <option value="both">Beides</option>
                    </select>
                  </label>
                </>
              ) : null}
              <label className="flex min-w-0 items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-2 text-xs text-slate-700">
                <span>Quelle</span>
                <select
                  className="min-w-0 flex-1 bg-transparent text-xs text-slate-900 outline-none"
                  onChange={(event) => setRentFilterScope(event.target.value as RentFilterScope)}
                  value={rentFilterScope}
                >
                  <option value="all">Alle zusammen</option>
                  <option value="properties">Ganzes Objekt</option>
                  <option value="tenants">Einzelne Mieter</option>
                </select>
              </label>
            </div>
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
            {rentStatisticView === 'breakEven' ? (
              <BreakEvenChart
                currentAnnualProjectedRent={breakEvenData.currentAnnualProjectedRent}
                currentAnnualSafeRent={breakEvenData.currentAnnualSafeRent}
                points={breakEvenData.points}
                projectedBreakEvenYear={breakEvenData.projectedBreakEvenYear}
                purchasePrice={breakEvenData.purchasePrice}
                safeBreakEvenYear={breakEvenData.safeBreakEvenYear}
              />
            ) : (
              <RentHistoryChart
                defaultMode={rentValueMode}
                emptyText="Für die gewählte Auswahl liegen noch keine Mietdaten vor."
                framed={false}
                mode={rentValueMode}
                points={dashboardRentPoints}
                showCosts
                showModeControl={false}
                subtitle=""
                title=""
              />
            )}
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
