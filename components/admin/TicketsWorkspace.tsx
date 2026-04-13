'use client';

import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, type DocumentData } from 'firebase/firestore';
import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { formatDateTime, formatTimestampSort, getStatusLabel, getTicketTypeLabel, type WorkflowRecord } from '../../lib/adminWorkflow';
import { db } from '../../lib/firebase';

type TicketFilter = 'all' | 'deleted' | 'done' | 'open';

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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-sm leading-7 text-slate-600">
      {text}
    </div>
  );
}

export default function TicketsWorkspace() {
  const [tickets, setTickets] = useState<WorkflowRecord[]>([]);
  const [properties, setProperties] = useState<WorkflowRecord[]>([]);
  const [tenants, setTenants] = useState<WorkflowRecord[]>([]);
  const [filter, setFilter] = useState<TicketFilter>('open');
  const [createOpen, setCreateOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualSummary, setManualSummary] = useState('');
  const [manualType, setManualType] = useState('general_request');
  const [manualPriority, setManualPriority] = useState('normal');
  const [manualPropertyId, setManualPropertyId] = useState('');
  const [manualTenantId, setManualTenantId] = useState('');
  const [manualUnitId, setManualUnitId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const unsubscribers = [
      readCollection('tickets', setError, setTickets),
      readCollection('properties', setError, setProperties),
      readCollection('tenants', setError, setTenants),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const sortedTickets = useMemo(
    () =>
      [...tickets].sort(
        (left, right) =>
          formatTimestampSort(right.data.updatedAt ?? right.data.createdAt) -
          formatTimestampSort(left.data.updatedAt ?? left.data.createdAt)
      ),
    [tickets]
  );

  const filteredTickets = useMemo(
    () =>
      sortedTickets.filter((ticket) => {
        const status = cleanText(ticket.data.status);
        if (filter === 'open') return !['done', 'closed', 'deleted'].includes(status);
        if (filter === 'done') return ['done', 'closed'].includes(status);
        if (filter === 'deleted') return status === 'deleted';
        return status !== 'deleted';
      }),
    [filter, sortedTickets]
  );

  const availableUnitOptions = useMemo(() => {
    const selectedProperty = properties.find((record) => record.id === manualPropertyId) ?? null;
    return Array.isArray(selectedProperty?.data.units)
      ? selectedProperty.data.units.filter((entry: unknown) => entry && typeof entry === 'object')
      : [];
  }, [manualPropertyId, properties]);

  function createManualTicket() {
    setMessage('');
    setError('');
    startTransition(async () => {
      try {
        const ticketRef = await addDoc(collection(db, 'tickets'), {
          assignedCompanyIds: [],
          assignedContactIds: [],
          createdAt: serverTimestamp(),
          nextStep: 'Weiteren Schritt festlegen',
          priority: manualPriority,
          propertyId: manualPropertyId || null,
          sourceMessageId: '',
          status: 'new',
          summary: manualSummary,
          tenantId: manualTenantId || null,
          ticketNumber: `TK-${Date.now().toString().slice(-6)}`,
          title: manualTitle || 'Manuell angelegtes Ticket',
          type: manualType,
          unitId: manualUnitId || null,
          updatedAt: serverTimestamp(),
        });

        await addDoc(collection(db, 'ticketEvents'), {
          actorId: 'admin',
          actorType: 'admin',
          createdAt: serverTimestamp(),
          kind: 'ticket_created',
          text: 'Ticket wurde manuell angelegt.',
          ticketId: ticketRef.id,
        });

        setCreateOpen(false);
        setManualTitle('');
        setManualSummary('');
        setManualType('general_request');
        setManualPriority('normal');
        setManualPropertyId('');
        setManualTenantId('');
        setManualUnitId('');
        setMessage('Ticket wurde angelegt.');
      } catch (caughtError) {
        console.error('Fehler beim Anlegen des Tickets:', caughtError);
        setError('Das Ticket konnte nicht angelegt werden.');
      }
    });
  }

  function permanentlyDeleteTicket(ticketId: string) {
    startTransition(async () => {
      setMessage('');
      setError('');
      try {
        await deleteDoc(doc(db, 'tickets', ticketId));
        setMessage('Ticket wurde endgültig gelöscht.');
      } catch (caughtError) {
        console.error('Fehler beim endgültigen Löschen des Tickets:', caughtError);
        setError('Das Ticket konnte nicht endgültig gelöscht werden.');
      }
    });
  }

  return (
    <div className="space-y-3 pt-1">
      <div className="flex flex-wrap items-center justify-between gap-3 pr-20">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
          {[
            { key: 'open', label: 'Offen' },
            { key: 'done', label: 'Erledigt' },
            { key: 'deleted', label: 'Gelöscht' },
            { key: 'all', label: 'Alle' },
          ].map((entry) => (
            <button
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                filter === entry.key
                  ? 'bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] text-stone-100'
                  : 'border border-stone-300 bg-white text-slate-700 hover:border-stone-400'
              }`}
              key={entry.key}
              onClick={() => setFilter(entry.key as TicketFilter)}
              type="button"
            >
              {entry.label}
            </button>
          ))}
          </div>
        </div>
        <button
          className="shrink-0 rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-3.5 py-1.5 text-xs font-medium text-stone-100 transition hover:brightness-105 disabled:opacity-50"
          onClick={() => setCreateOpen((current) => !current)}
          type="button"
        >
          {createOpen ? 'Maske schließen' : 'Ticket manuell anlegen'}
        </button>
      </div>

      {createOpen ? (
        <section className="rounded-[32px] border border-stone-200 bg-white p-6 shadow-[0_28px_70px_-42px_rgba(148,119,77,0.28)]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="block">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Titel</p>
              <input
                className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                onChange={(event) => setManualTitle(event.target.value)}
                value={manualTitle}
              />
            </label>
            <label className="block">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Typ</p>
              <select
                className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                onChange={(event) => setManualType(event.target.value)}
                value={manualType}
              >
                <option value="damage">Schaden</option>
                <option value="maintenance">Wartung</option>
                <option value="termination">Kündigung</option>
                <option value="general_request">Allgemein</option>
                <option value="billing">Abrechnung</option>
              </select>
            </label>
            <label className="block">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Priorität</p>
              <select
                className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                onChange={(event) => setManualPriority(event.target.value)}
                value={manualPriority}
              >
                <option value="normal">normal</option>
                <option value="hoch">hoch</option>
                <option value="notfall">Notfall</option>
              </select>
            </label>
            <label className="block">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Objekt</p>
              <select
                className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                onChange={(event) => {
                  setManualPropertyId(event.target.value);
                  setManualUnitId('');
                }}
                value={manualPropertyId}
              >
                <option value="">Nicht zugeordnet</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {cleanText(property.data.name) || property.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Einheit</p>
              <select
                className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                onChange={(event) => setManualUnitId(event.target.value)}
                value={manualUnitId}
              >
                <option value="">Nicht zugeordnet</option>
                {availableUnitOptions.map((entry) => {
                  const record = entry as DocumentData;
                  const id = cleanText(record.id);
                  const label =
                    [cleanText(record.unitLabel), cleanText(record.floor), cleanText(record.unitPosition)]
                      .filter(Boolean)
                      .join(' · ') || id;
                  return (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="block">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Mieter</p>
              <select
                className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                onChange={(event) => setManualTenantId(event.target.value)}
                value={manualTenantId}
              >
                <option value="">Nicht zugeordnet</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {[cleanText(tenant.data.lastName), cleanText(tenant.data.firstName)]
                      .filter(Boolean)
                      .join(', ') || tenant.id}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-4 block">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Zusammenfassung</p>
            <textarea
              className="mt-2 min-h-[120px] w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => setManualSummary(event.target.value)}
              value={manualSummary}
            />
          </label>

          <div className="mt-4">
            <button
              className="rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-5 py-3 text-sm font-medium text-stone-100 transition hover:brightness-105 disabled:opacity-50"
              disabled={isPending}
              onClick={createManualTicket}
              type="button"
            >
              Ticket speichern
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-[28px] border border-stone-200 bg-white shadow-[0_28px_70px_-42px_rgba(148,119,77,0.28)]">
        <div className="divide-y divide-stone-200">
          {filteredTickets.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState text="Keine Tickets in dieser Ansicht." />
            </div>
          ) : (
            filteredTickets.map((ticket) => (
              <div
                className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)_140px_140px_auto_auto] items-center gap-4 px-6 py-4 transition hover:bg-stone-50"
                key={ticket.id}
              >
                <Link className="min-w-0" href={`/admin/tickets/${ticket.id}`}>
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {cleanText(ticket.data.ticketNumber) || ticket.id}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {formatDateTime(ticket.data.updatedAt ?? ticket.data.createdAt)}
                  </p>
                </Link>
                <Link className="min-w-0" href={`/admin/tickets/${ticket.id}`}>
                  <p className="truncate text-sm text-slate-900">
                    {cleanText(ticket.data.title) || 'Ohne Titel'}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {cleanText(ticket.data.summary) || 'Keine Zusammenfassung'}
                  </p>
                </Link>
                <p className="truncate text-sm text-slate-600">
                  {getTicketTypeLabel(cleanText(ticket.data.type))}
                </p>
                <p className="truncate text-sm text-slate-600">
                  {cleanText(ticket.data.priority) || 'normal'}
                </p>
                <span className="justify-self-end rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-slate-600">
                  {getStatusLabel(cleanText(ticket.data.status))}
                </span>
                {filter === 'deleted' ? (
                  <button
                    className="rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-400"
                    onClick={() => permanentlyDeleteTicket(ticket.id)}
                    type="button"
                  >
                    Endgültig löschen
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

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

