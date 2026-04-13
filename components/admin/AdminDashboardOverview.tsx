'use client';

import Link from 'next/link';
import { collection, onSnapshot, query, type DocumentData } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  formatDateTime,
  formatTimestampSort,
  getStatusLabel,
  getTicketTypeLabel,
  type WorkflowRecord,
} from '../../lib/adminWorkflow';
import { db } from '../../lib/firebase';

type ReminderItem = {
  dateValue: string;
  href: string;
  label: string;
  meta: string;
  type: 'message' | 'tenant' | 'ticket';
};

type StatCard = {
  accentClassName: string;
  href: string;
  label: string;
  sublabel: string;
  value: number;
};

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
  const [tickets, setTickets] = useState<WorkflowRecord[]>([]);
  const [messages, setMessages] = useState<WorkflowRecord[]>([]);
  const [tenants, setTenants] = useState<WorkflowRecord[]>([]);
  const [properties, setProperties] = useState<WorkflowRecord[]>([]);
  const [companies, setCompanies] = useState<WorkflowRecord[]>([]);
  const [people, setPeople] = useState<WorkflowRecord[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const unsubscribers = [
      readCollection('tickets', setLoadError, setTickets),
      readCollection('messages', setLoadError, setMessages),
      readCollection('tenants', setLoadError, setTenants),
      readCollection('properties', setLoadError, setProperties),
      readCollection('companies', setLoadError, setCompanies),
      readCollection('people', setLoadError, setPeople),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

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

  const openTickets = useMemo(
    () =>
      tickets
        .filter((ticket) => !['done', 'closed', 'deleted'].includes(cleanText(ticket.data.status)))
        .sort(
          (left, right) =>
            formatTimestampSort(right.data.updatedAt ?? right.data.createdAt) -
            formatTimestampSort(left.data.updatedAt ?? left.data.createdAt)
        ),
    [tickets]
  );

  const newMessages = useMemo(
    () =>
      messages
        .filter((message) => ['new', 'needs_review'].includes(cleanText(message.data.status)))
        .sort(
          (left, right) =>
            formatTimestampSort(right.data.receivedAt ?? right.data.createdAt) -
            formatTimestampSort(left.data.receivedAt ?? left.data.createdAt)
        ),
    [messages]
  );

  const needsReviewMessages = useMemo(
    () => newMessages.filter((message) => cleanText(message.data.status) === 'needs_review'),
    [newMessages]
  );

  const ticketsInProgress = useMemo(
    () => tickets.filter((ticket) => cleanText(ticket.data.status) === 'in_progress'),
    [tickets]
  );

  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const reminders = useMemo(() => {
    const reminderItems: ReminderItem[] = [];

    tickets.forEach((ticket) => {
      const followUpDate = cleanText(ticket.data.followUpDate);
      const parsed = parseDateInput(followUpDate);
      if (!parsed) return;
      reminderItems.push({
        dateValue: followUpDate,
        href: `/admin/tickets/${ticket.id}`,
        label: cleanText(ticket.data.title) || cleanText(ticket.data.ticketNumber) || 'Ticket',
        meta: `Ticket · ${cleanText(ticket.data.ticketNumber) || getStatusLabel(cleanText(ticket.data.status))}`,
        type: 'ticket',
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
  }, [messages, tenants, tickets]);

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

  const latestOpenTickets = useMemo(() => openTickets.slice(0, 6), [openTickets]);
  const latestNewMessages = useMemo(() => newMessages.slice(0, 6), [newMessages]);
  const topReminders = useMemo(() => dueSoonReminders.slice(0, 6), [dueSoonReminders]);

  const stats: StatCard[] = [
    {
      accentClassName: 'bg-amber-700/90',
      href: '/admin/tickets',
      label: 'Offene Tickets',
      sublabel: 'Alle laufenden Vorgänge auf einen Blick',
      value: openTickets.length,
    },
    {
      accentClassName: 'bg-sky-600/90',
      href: '/admin/nachrichten',
      label: 'Neue Nachrichten',
      sublabel: 'Portal und E-Mail, die noch bearbeitet werden müssen',
      value: newMessages.length,
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
      href: '/admin/tickets',
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
    { href: '/admin/tickets', label: 'In Bearbeitung', value: ticketsInProgress.length },
  ];

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
                  {openTickets.filter((ticket) => ['hoch', 'notfall'].includes(cleanText(ticket.data.priority))).length}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">offene Tickets mit hoher Priorität oder Notfall</p>
              </div>
              <div className="rounded-[24px] bg-[linear-gradient(180deg,#eef6fb_0%,#e8f2f9_100%)] p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sky-700/80">Neue Eingänge</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">{newMessages.length}</p>
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
                dann die <span className="font-medium">{openTickets.filter((ticket) => ['hoch', 'notfall'].includes(cleanText(ticket.data.priority))).length} dringenden Tickets</span>,
                danach die nächste Wiedervorlage.
              </p>
            </div>
          </div>

          <div className="rounded-[30px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Offene Tickets</p>
                <h3 className="mt-2 font-serif text-3xl text-slate-950">Was jetzt läuft</h3>
              </div>
              <Link
                className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-stone-400 hover:text-slate-950"
                href="/admin/tickets"
              >
                Alle Tickets
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {latestOpenTickets.length === 0 ? (
                <EmptyList text="Keine offenen Tickets vorhanden." />
              ) : (
                latestOpenTickets.map((ticket) => (
                  <Link
                    className="grid gap-3 rounded-[22px] border border-stone-200 bg-stone-50/60 px-4 py-4 transition hover:border-stone-300 hover:bg-white md:grid-cols-[minmax(0,170px)_minmax(0,1fr)_140px]"
                    href={`/admin/tickets/${ticket.id}`}
                    key={ticket.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">
                        {cleanText(ticket.data.ticketNumber) || ticket.id}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDateTime(ticket.data.updatedAt ?? ticket.data.createdAt)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-900">{cleanText(ticket.data.title) || 'Ohne Titel'}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {getTicketTypeLabel(cleanText(ticket.data.type))} · {cleanText(ticket.data.priority) || 'normal'}
                      </p>
                    </div>
                    <div className="flex items-center justify-start md:justify-end">
                      <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                        {getStatusLabel(cleanText(ticket.data.status))}
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
              {latestNewMessages.length === 0 ? (
                <EmptyList text="Keine neuen Nachrichten vorhanden." />
              ) : (
                latestNewMessages.map((message) => (
                  <Link
                    className="block rounded-[22px] border border-stone-200 bg-stone-50/60 px-4 py-4 transition hover:border-stone-300 hover:bg-white"
                    href={`/admin/nachrichten/${message.id}`}
                    key={message.id}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {cleanText(message.data.subject) || cleanText(message.data.fromName) || 'Ohne Betreff'}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {cleanText(message.data.fromEmail) || cleanText(message.data.channel) || 'Unbekannter Eingang'}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          cleanText(message.data.status) === 'needs_review'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-sky-100 text-sky-700'
                        }`}
                      >
                        {getStatusLabel(cleanText(message.data.status))}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                      {cleanText(message.data.bodyText) || cleanText(message.data.previewText) || 'Keine Vorschau vorhanden.'}
                    </p>
                    <p className="mt-3 text-xs text-slate-500">
                      {formatDateTime(message.data.receivedAt ?? message.data.createdAt)}
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
                        {entry.type === 'ticket' ? 'Ticket' : entry.type === 'message' ? 'Nachricht' : 'Mieter'}
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
              Für dieses Dashboard sind neben Tickets, Nachrichten und Erinnerungen besonders nützlich:
              Leerstand, zu prüfende Nachrichten, Tickets in Bearbeitung und die nächste Mietvertrags- oder
              Mieterhöhungsprüfung. Das sind die Punkte, die im Verwaltungsalltag schnell untergehen.
            </p>
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
                {newMessages.length} neue Nachrichten, davon {needsReviewMessages.length} mit Klärungsbedarf.
              </p>
            </Link>

            <Link
              className="rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,#eef6fb_0%,#e7f1f8_100%)] p-5 transition hover:-translate-y-0.5 hover:border-stone-300"
              href="/admin/tickets"
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sky-700/80">Vorgänge steuern</p>
              <p className="mt-3 text-2xl text-slate-950">Offene Tickets priorisieren</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {openTickets.length} offene Tickets, davon {ticketsInProgress.length} bereits in Bearbeitung.
              </p>
            </Link>

            <Link
              className="rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,#eef8f0_0%,#e7f3e8_100%)] p-5 transition hover:-translate-y-0.5 hover:border-stone-300"
              href="/admin/mieter"
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-700/80">Fristen im Blick</p>
              <p className="mt-3 text-2xl text-slate-950">Mieter und Wiedervorlagen</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {reminders.length} hinterlegte Erinnerungen aus Tickets, Nachrichten und Mietverläufen.
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
      </section>
    </div>
  );
}
