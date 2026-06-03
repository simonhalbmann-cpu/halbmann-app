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
  label: string;
  meta: string;
  type: 'message' | 'tenant' | 'theme';
};

type StatCard = {
  accentClassName: string;
  href: string;
  label: string;
  sublabel: string;
  value: number;
};

type RentFilterScope = 'all' | 'companies' | 'properties' | 'tenants';

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
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

function EmptyList({ text }: { text: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-slate-500">
      {text}
    </div>
  );
}

function PriorityStat({ accentClassName, href, label, sublabel, value }: StatCard) {
  return (
    <Link
      className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(148,119,77,0.32)] transition hover:-translate-y-0.5 hover:border-stone-300"
      href={href}
    >
      <div className={`h-1.5 w-14 rounded-full ${accentClassName}`} />
      <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-4xl font-semibold text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{sublabel}</p>
    </Link>
  );
}

export default function AdminDashboardOverview() {
  const { user } = useAuth();
  const [firestoreMessages, setFirestoreMessages] = useState<WorkflowRecord[]>([]);
  const [localPortalMessages, setLocalPortalMessages] = useState<WorkflowRecord[]>([]);
  const [messageThemes, setMessageThemes] = useState<LocalMessageTheme[]>([]);
  const [tenants, setTenants] = useState<WorkflowRecord[]>([]);
  const [properties, setProperties] = useState<WorkflowRecord[]>([]);
  const [companies, setCompanies] = useState<WorkflowRecord[]>([]);
  const [people, setPeople] = useState<WorkflowRecord[]>([]);
  const [loadError, setLoadError] = useState('');
  const [rentFilterScope, setRentFilterScope] = useState<RentFilterScope>('all');
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

    async function loadLocalPortalMessages() {
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/admin/local-portal-messages', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = (await response.json()) as {
          messages?: WorkflowRecord[];
          ok?: boolean;
        };

        if (!cancelled && response.ok && result.ok) {
          setLocalPortalMessages(Array.isArray(result.messages) ? result.messages : []);
        }
      } catch (caughtError) {
        console.error('Fehler beim Laden lokaler Portalnachrichten im Dashboard:', caughtError);
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
    const currentUser = user;
    let cancelled = false;

    async function loadMessageThemes() {
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/admin/message-themes', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = (await response.json()) as {
          ok?: boolean;
          themes?: LocalMessageTheme[];
        };

        if (!cancelled && response.ok && result.ok) {
          setMessageThemes(Array.isArray(result.themes) ? result.themes : []);
        }
      } catch (caughtError) {
        console.error('Fehler beim Laden der Themen im Dashboard:', caughtError);
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

  const needsReviewMessages = useMemo(
    () => newThemes.filter((theme) => cleanText(theme.status) === 'needs_review'),
    [newThemes]
  );

  const themesInProgress = useMemo(
    () => openThemes.filter((theme) => cleanText(theme.status) === 'in_progress'),
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
        href: `/admin/mieter/${theme.tenantId}?messageId=${theme.id}`,
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
        label: cleanText(message.data.subject) || cleanText(message.data.fromName) || 'Nachricht',
        meta: `Nachricht · ${cleanText(message.data.fromEmail) || 'ohne Absender'}`,
        type: 'message',
      });
    });

    tenants.forEach((tenant) => {
      const rows = Array.isArray(tenant.data.rentDevelopment) ? tenant.data.rentDevelopment : [];
      rows.forEach((row) => {
        if (!row || typeof row !== 'object') return;
        const reminderDate = cleanText((row as DocumentData).reminderDate);
        const parsed = parseDateInput(reminderDate);
        if (!parsed) return;
        reminderItems.push({
          dateValue: reminderDate,
          href: `/admin/mieter/${tenant.id}`,
          label: buildTenantLabel(tenant),
          meta: `Mieterhöhung prüfen · ${cleanText((row as DocumentData).kind) || 'Mietvertrag'}`,
          type: 'tenant',
        });
      });
    });

    return reminderItems.sort((left, right) => {
      const leftDate = parseDateInput(left.dateValue)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightDate = parseDateInput(right.dateValue)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return leftDate - rightDate;
    });
  }, [messages, tenants, themes]);

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

  const themeReminders = useMemo(
    () => reminders.filter((entry) => entry.type === 'theme'),
    [reminders]
  );

  const dueSoonThemeReminders = useMemo(
    () => dueSoonReminders.filter((entry) => entry.type === 'theme'),
    [dueSoonReminders]
  );

  const visibleThemeReminders = dueSoonThemeReminders.length > 0 ? dueSoonThemeReminders : themeReminders;

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

  const latestOpenThemes = useMemo(() => openThemes.slice(0, 6), [openThemes]);
  const latestNewThemes = useMemo(() => newThemes.slice(0, 6), [newThemes]);
  const topReminders = useMemo(() => dueSoonReminders.slice(0, 6), [dueSoonReminders]);

  const stats: StatCard[] = [
    {
      accentClassName: 'bg-amber-700/90',
      href: '/admin/nachrichten',
      label: 'Offene Themen',
      sublabel: 'Alle laufenden Vorgänge auf einen Blick',
      value: openThemes.length,
    },
    {
      accentClassName: 'bg-sky-600/90',
      href: '/admin/nachrichten',
      label: 'Neue Themen',
      sublabel: 'Portal und E-Mail, die noch bearbeitet werden müssen',
      value: newThemes.length,
    },
    {
      accentClassName: 'bg-rose-600/90',
      href: '/admin/nachrichten',
      label: 'Zu prüfen',
      sublabel: 'Nachrichten ohne saubere Zuordnung oder mit Klärungsbedarf',
      value: needsReviewMessages.length,
    },
    {
      accentClassName: 'bg-emerald-600/90',
      href: '/admin/mieter',
      label: 'Nächste Erinnerungen',
      sublabel: 'Fällige Wiedervorlagen in den nächsten 14 Tagen',
      value: dueSoonReminders.length,
    },
  ];

  const propertyLoad = [
    { href: '/admin/firma', label: 'Firmen', value: companies.length },
    { href: '/admin/immobilie', label: 'Immobilien', value: properties.length },
    { href: '/admin/mieter', label: 'Mieter', value: tenants.length },
    { href: '/admin/personen', label: 'Kontakte', value: people.length },
    { href: '/admin/immobilie', label: 'Leerstand', value: vacancyCount },
    { href: '/admin/nachrichten', label: 'In Bearbeitung', value: themesInProgress.length },
  ];

  const activeRentTenants = useMemo(
    () => tenants.filter((tenant) => cleanText(tenant.data.status) === 'active'),
    [tenants]
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

  return (
    <div className="space-y-5">
      {loadError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((card) => (
          <PriorityStat key={card.label} {...card} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
        <div className="space-y-5">
          <div className="rounded-[30px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Heute zuerst</p>
                <h3 className="mt-2 font-serif text-3xl text-slate-950">Operative Prioritäten</h3>
              </div>
              <Link
                className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-stone-400 hover:text-slate-950"
                href="/admin/nachrichten"
              >
                Zur Inbox
              </Link>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-[24px] bg-[linear-gradient(180deg,#f7efe3_0%,#f3eadf_100%)] p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-800/80">Dringend</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">
                  {needsReviewMessages.length}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">offene Themen mit Klaerungsbedarf oder hoher Dringlichkeit</p>
              </div>
              <div className="rounded-[24px] bg-[linear-gradient(180deg,#eef6fb_0%,#e8f2f9_100%)] p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sky-700/80">Neue Eingänge</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">{newThemes.length}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">Nachrichten warten auf Einordnung oder Antwort</p>
              </div>
              <div className="rounded-[24px] bg-[linear-gradient(180deg,#eef8f0_0%,#e8f3ea_100%)] p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-700/80">Wiedervorlage</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">{dueSoonReminders.length}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">Erinnerungen in den nächsten 14 Tagen</p>
              </div>
            </div>

            <div className="mt-5 rounded-[24px] border border-stone-200 bg-stone-50/70 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Empfehlung</p>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                Starte mit <span className="font-medium">{needsReviewMessages.length} zu prüfenden Nachrichten</span>,
                dann die <span className="font-medium">{themesInProgress.length} Themen in Bearbeitung</span>,
                danach die nächste Wiedervorlage.
              </p>
            </div>
          </div>

          <div className="rounded-[30px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Offene Themen</p>
                <h3 className="mt-2 font-serif text-3xl text-slate-950">Was jetzt läuft</h3>
              </div>
              <Link
                className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-stone-400 hover:text-slate-950"
                href="/admin/nachrichten"
              >
                Alle Themen
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {latestOpenThemes.length === 0 ? (
                <EmptyList text="Keine offenen Themen vorhanden." />
              ) : (
                latestOpenThemes.map((theme) => (
                  <Link
                    className="grid gap-3 rounded-[22px] border border-stone-200 bg-stone-50/60 px-4 py-4 transition hover:border-stone-300 hover:bg-white md:grid-cols-[minmax(0,170px)_minmax(0,1fr)_140px]"
                    href={buildDashboardMessageHref(theme.latestInbound ?? theme.latestEntry)}
                    key={theme.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">
                        {cleanText(theme.subject) || theme.id}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDateTime(theme.latestActivityAt)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-900">
                        {cleanText(theme.latestInbound?.data.fromName) ||
                          cleanText(theme.latestEntry.data.fromName) ||
      buildTenantLabel(tenants.find((tenant) => tenant.id === theme.tenantId)) ||
                          'Ohne Zuordnung'}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {cleanText(theme.latestInbound?.data.fromEmail) ||
                          cleanText(theme.latestEntry.data.channel) ||
                          'Portal oder E-Mail'}
                      </p>
                    </div>
                    <div className="flex items-center justify-start md:justify-end">
                      <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                        {getStatusLabel(cleanText(theme.status))}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[30px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sky-700/80">Neue Nachrichten</p>
                <h3 className="mt-2 font-serif text-3xl text-slate-950">Inbox kompakt</h3>
              </div>
              <Link
                className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-stone-400 hover:text-slate-950"
                href="/admin/nachrichten"
              >
                Nachrichten
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {latestNewThemes.length === 0 ? (
                <EmptyList text="Keine neuen Themen vorhanden." />
              ) : (
                latestNewThemes.map((theme) => (
                  <Link
                    className="block rounded-[22px] border border-stone-200 bg-stone-50/60 px-4 py-4 transition hover:border-stone-300 hover:bg-white"
                    href={buildDashboardMessageHref(theme.latestInbound ?? theme.latestEntry)}
                    key={theme.id}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {cleanText(theme.subject) || cleanText(theme.latestInbound?.data.fromName) || 'Ohne Betreff'}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {cleanText(theme.latestInbound?.data.fromEmail) || cleanText(theme.latestEntry.data.channel) || 'Unbekannter Eingang'}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          cleanText(theme.status) === 'needs_review'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-sky-100 text-sky-700'
                        }`}
                      >
                        {getStatusLabel(cleanText(theme.status))}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                      {cleanText(theme.latestEntry.data.bodyText) || cleanText(theme.latestEntry.data.previewText) || 'Keine Vorschau vorhanden.'}
                    </p>
                    <p className="mt-3 text-xs text-slate-500">
                      {formatDateTime(theme.latestActivityAt)}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[30px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-700/80">Nächste Erinnerungen</p>
                <h3 className="mt-2 font-serif text-3xl text-slate-950">Was bald fällig wird</h3>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {topReminders.length === 0 ? (
                <EmptyList text="Aktuell keine Wiedervorlagen in den nächsten 14 Tagen." />
              ) : (
                topReminders.map((entry) => (
                  <Link
                    className="flex items-center justify-between gap-4 rounded-[22px] border border-stone-200 bg-stone-50/60 px-4 py-4 transition hover:border-stone-300 hover:bg-white"
                    href={entry.href}
                    key={`${entry.type}-${entry.href}-${entry.dateValue}-${entry.label}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{entry.label}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{entry.meta}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-950">{formatDateOnly(entry.dateValue)}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-400">
                        {entry.type === 'message' ? 'Nachricht' : 'Mieter'}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
        <div className="rounded-[30px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Bestand kompakt</p>
          <h3 className="mt-2 font-serif text-3xl text-slate-950">Struktur und Auslastung</h3>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {propertyLoad.map((item) => (
              <Link
                className="rounded-[22px] border border-stone-200 bg-stone-50/60 px-4 py-4 transition hover:border-stone-300 hover:bg-white"
                href={item.href}
                key={item.label}
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">{item.value}</p>
              </Link>
            ))}
          </div>

          <div className="mt-5 rounded-[24px] border border-stone-200 bg-stone-50/70 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Sinnvoll ergänzt</p>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              Für dieses Dashboard sind neben Themen, Nachrichten und Erinnerungen besonders nützlich:
              Leerstand, zu prüfende Nachrichten, Themen in Bearbeitung und die nächste Mietvertrags- oder
              Mieterhöhungsprüfung. Das sind die Punkte, die im Verwaltungsalltag schnell untergehen.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[30px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Kaltmiete im Bestand</p>
                <h3 className="mt-2 font-serif text-3xl text-slate-950">Objekte im Verlauf</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Gesamte Kaltmiete der gewaehlten Auswahl. Du kannst nach allen, Objekten, Firmen oder einzelnen Mietern filtern.
                </p>
              </div>
              <div className="space-y-3">
                <label className="inline-flex max-w-[220px] items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-2 text-xs text-slate-700">
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

                {rentFilterScope === 'properties' ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        selectedPropertyIds.length === 0
                          ? 'border-amber-700 bg-amber-700 text-white'
                          : 'border-stone-300 bg-white text-slate-700 hover:border-stone-400'
                      }`}
                      onClick={resetActiveFilterSelection}
                      type="button"
                    >
                      Alle
                    </button>
                    {properties.map((property) => {
                      const active = selectedPropertyIds.includes(property.id);
                      return (
                        <button
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            active
                              ? 'border-amber-700 bg-amber-700 text-white'
                              : 'border-stone-300 bg-white text-slate-700 hover:border-stone-400'
                          }`}
                          key={property.id}
                          onClick={() => togglePropertySelection(property.id)}
                          type="button"
                        >
                          {cleanText(property.data.name) || property.id}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {rentFilterScope === 'companies' ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        selectedCompanyIds.length === 0
                          ? 'border-amber-700 bg-amber-700 text-white'
                          : 'border-stone-300 bg-white text-slate-700 hover:border-stone-400'
                      }`}
                      onClick={resetActiveFilterSelection}
                      type="button"
                    >
                      Alle
                    </button>
                    {companies.map((company) => {
                      const active = selectedCompanyIds.includes(company.id);
                      return (
                        <button
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            active
                              ? 'border-amber-700 bg-amber-700 text-white'
                              : 'border-stone-300 bg-white text-slate-700 hover:border-stone-400'
                          }`}
                          key={company.id}
                          onClick={() => toggleCompanySelection(company.id)}
                          type="button"
                        >
                          {cleanText(company.data.name) || company.id}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {rentFilterScope === 'tenants' ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        selectedTenantIds.length === 0
                          ? 'border-amber-700 bg-amber-700 text-white'
                          : 'border-stone-300 bg-white text-slate-700 hover:border-stone-400'
                      }`}
                      onClick={resetActiveFilterSelection}
                      type="button"
                    >
                      Alle
                    </button>
                    {activeRentTenants.map((tenant) => {
                      const active = selectedTenantIds.includes(tenant.id);
                      return (
                        <button
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            active
                              ? 'border-amber-700 bg-amber-700 text-white'
                              : 'border-stone-300 bg-white text-slate-700 hover:border-stone-400'
                          }`}
                          key={tenant.id}
                          onClick={() => toggleTenantSelection(tenant.id)}
                          type="button"
                        >
                          {buildTenantLabel(tenant)}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mt-5">
              <RentHistoryChart
                defaultMode="cold"
                emptyText="Fuer die gewaehlten Objekte liegen noch keine Mietdaten vor."
                framed={false}
                points={dashboardRentPoints}
                showCosts={false}
                subtitle="Summierte Kaltmiete aller ausgewaehlten Objekte auf Basis der hinterlegten Mietdaten."
                title="Bestandsentwicklung"
              />
            </div>
          </div>

        <div className="rounded-[30px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Schnellzugriff</p>
              <h3 className="mt-2 font-serif text-3xl text-slate-950">Heute wahrscheinlich wichtig</h3>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <Link
              className="rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,#f7efe3_0%,#f2e7d9_100%)] p-5 transition hover:-translate-y-0.5 hover:border-stone-300"
              href="/admin/nachrichten"
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-800/80">Inbox zuerst</p>
              <p className="mt-3 text-2xl text-slate-950">Neue Eingänge prüfen</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {newThemes.length} neue Nachrichten, davon {needsReviewMessages.length} mit Klärungsbedarf.
              </p>
            </Link>

            <Link
              className="rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,#eef6fb_0%,#e7f1f8_100%)] p-5 transition hover:-translate-y-0.5 hover:border-stone-300"
              href="/admin/nachrichten"
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sky-700/80">Vorgänge steuern</p>
              <p className="mt-3 text-2xl text-slate-950">Offene Themen priorisieren</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {openThemes.length} offene Themen, davon {themesInProgress.length} bereits in Bearbeitung.
              </p>
            </Link>

            <Link
              className="rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,#eef8f0_0%,#e7f3e8_100%)] p-5 transition hover:-translate-y-0.5 hover:border-stone-300"
              href="/admin/mieter"
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-700/80">Fristen im Blick</p>
              <p className="mt-3 text-2xl text-slate-950">Mieter und Wiedervorlagen</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {reminders.length} hinterlegte Erinnerungen aus Themen, Nachrichten und Mietverlaeufen.
              </p>
            </Link>

            <Link
              className="rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,#f6f0f5_0%,#efe6ee_100%)] p-5 transition hover:-translate-y-0.5 hover:border-stone-300"
              href="/admin/immobilie"
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-fuchsia-700/80">Bestand pflegen</p>
              <p className="mt-3 text-2xl text-slate-950">Leerstand und Zuordnung</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {vacancyCount} Einheiten ohne aktiven Mieter. Gut geeignet für schnelle Bestandsprüfung.
              </p>
            </Link>
          </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-stone-200 bg-stone-50 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Wiedervorlage</p>
                <h4 className="mt-2 text-xl text-slate-950">Themen mit Termin</h4>
              </div>
              <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                {themeReminders.length}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {themeReminders.length === 0 ? (
                <EmptyList text="Aktuell sind keine Themen mit Wiedervorlage hinterlegt." />
              ) : (
                visibleThemeReminders.slice(0, 5).map((entry) => (
                  <Link
                    className="block rounded-[18px] border border-stone-200 bg-white px-4 py-3 transition hover:border-stone-300"
                    href={entry.href}
                    key={`${entry.type}-${entry.href}-${entry.dateValue}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-950">{entry.label}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{entry.meta}</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                        {formatDateOnly(entry.dateValue)}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
