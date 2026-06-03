'use client';

import { doc, onSnapshot, serverTimestamp, updateDoc, type DocumentData } from 'firebase/firestore';
import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { db } from '../../lib/firebase';

type MeterDetailViewProps = {
  meterId: string;
  propertyId: string;
  unitId?: string;
};

type ReadingForm = {
  date: string;
  note: string;
  value: string;
};

type ExchangeForm = {
  date: string;
  newMeterNumber: string;
  note: string;
  oldMeterNumber: string;
};

const cleanText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

function buildReadingHistoryEntries(meter: DocumentData | null) {
  if (!meter || typeof meter !== 'object') return [];

  const entries: Array<{ date: string; note: string; value: string }> = [];
  const seen = new Set<string>();

  const pushEntry = (dateValue: unknown, valueValue: unknown, noteValue?: unknown) => {
    const date = cleanText(dateValue);
    const value = cleanText(valueValue);
    const note = cleanText(noteValue);
    if (!date || !value) return;
    const key = `${date}__${value}__${note}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ date, note, value });
  };

  if (Array.isArray(meter.readingHistory)) {
    meter.readingHistory.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      pushEntry((entry as DocumentData).date, (entry as DocumentData).value, (entry as DocumentData).note);
    });
  }

  pushEntry(meter.initialReadingDate, meter.initialReading, 'Erster Stand');
  pushEntry(meter.latestReadingDate, meter.latestReading);

  return entries.sort((left, right) => right.date.localeCompare(left.date, 'de'));
}

function appendReadingHistoryEntry(
  meter: DocumentData,
  nextEntry: { date: string; note: string; value: string }
) {
  const history = buildReadingHistoryEntries(meter);
  const duplicate = history.some(
    (entry) =>
      entry.date === nextEntry.date &&
      entry.value === nextEntry.value &&
      entry.note === nextEntry.note
  );

  if (duplicate) return history;
  return [...history, nextEntry];
}

function formatValue(value?: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > 0 ? text : '–';
}

export default function MeterDetailView({ meterId, propertyId, unitId }: MeterDetailViewProps) {
  const [property, setProperty] = useState<DocumentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [readingForm, setReadingForm] = useState<ReadingForm>({ date: '', note: '', value: '' });
  const [exchangeForm, setExchangeForm] = useState<ExchangeForm>({
    date: '',
    newMeterNumber: '',
    note: '',
    oldMeterNumber: '',
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'properties', propertyId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setProperty(null);
          setError('Der Zähler wurde nicht gefunden.');
          setIsLoading(false);
          return;
        }

        setProperty(snapshot.data());
        setError('');
        setIsLoading(false);
      },
      (caughtError) => {
        console.error(`Fehler beim Laden des Zählers ${propertyId}/${meterId}:`, caughtError);
        setError('Die Zählerdaten konnten nicht geladen werden.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [meterId, propertyId]);

  const unit = useMemo(() => {
    if (!property || !unitId || !Array.isArray(property.units)) return null;
    return (
      property.units.find(
        (entry: DocumentData) => entry && typeof entry === 'object' && cleanText(entry.id) === unitId
      ) ?? null
    );
  }, [property, unitId]);

  const meter = useMemo(() => {
    if (!property) return null;
    const source = unitId ? (Array.isArray(unit?.meters) ? unit.meters : []) : Array.isArray(property.meters) ? property.meters : [];
    return (
      source.find(
        (entry: DocumentData) => entry && typeof entry === 'object' && cleanText(entry.id) === meterId
      ) ?? null
    );
  }, [meterId, property, unit, unitId]);

  const readingHistory = useMemo(() => buildReadingHistoryEntries(meter), [meter]);

  const exchanges = useMemo(
    () =>
      Array.isArray(meter?.exchanges)
        ? [...meter.exchanges].sort((left, right) =>
            cleanText((right as DocumentData).date).localeCompare(cleanText((left as DocumentData).date), 'de')
          )
        : [],
    [meter]
  );

  useEffect(() => {
    if (!meter) return;
    const currentMeterNumber = cleanText(meter.meterNumber);
    if (!currentMeterNumber) return;

    setExchangeForm((current) =>
      cleanText(current.oldMeterNumber)
        ? current
        : {
            ...current,
            oldMeterNumber: currentMeterNumber,
          }
    );
  }, [meter]);

  function updateMeterInProperty(nextMeter: Record<string, unknown>) {
    if (!property) return null;

    if (unitId && Array.isArray(property.units)) {
      return {
        ...property,
        units: property.units.map((entry: DocumentData) => {
          if (!entry || typeof entry !== 'object' || cleanText(entry.id) !== unitId) return entry;
          const meters = Array.isArray(entry.meters) ? entry.meters : [];
          return {
            ...entry,
            meters: meters.map((currentMeter: DocumentData) =>
              cleanText(currentMeter?.id) === meterId ? nextMeter : currentMeter
            ),
          };
        }),
      };
    }

    return {
      ...property,
      meters: (Array.isArray(property.meters) ? property.meters : []).map((currentMeter: DocumentData) =>
        cleanText(currentMeter?.id) === meterId ? nextMeter : currentMeter
      ),
    };
  }

  function handleSaveReading() {
    if (!property || !meter || !readingForm.value || !readingForm.date) return;
    setMessage('');
    setError('');

    startTransition(async () => {
      try {
        const nextMeter = {
          ...meter,
          latestReading: cleanText(readingForm.value),
          latestReadingDate: readingForm.date,
          readingHistory: appendReadingHistoryEntry(meter, {
            date: readingForm.date,
            note: cleanText(readingForm.note),
            value: cleanText(readingForm.value),
          }),
        };
        const nextProperty = updateMeterInProperty(nextMeter);
        if (!nextProperty) return;
        const updatedMeters =
          'meters' in nextProperty ? nextProperty.meters : Array.isArray(property.meters) ? property.meters : [];
        const updatedUnits =
          'units' in nextProperty ? nextProperty.units : Array.isArray(property.units) ? property.units : [];

        await updateDoc(doc(db, 'properties', propertyId), {
          meters: updatedMeters,
          units: updatedUnits,
          updatedAt: serverTimestamp(),
        });

        setReadingForm({ date: '', note: '', value: '' });
        setMessage('Neuer Zählerstand wurde gespeichert.');
      } catch (caughtError) {
        console.error(`Fehler beim Speichern des Zählerstands ${meterId}:`, caughtError);
        setError('Der Zählerstand konnte nicht gespeichert werden.');
      }
    });
  }

  function handleSaveExchange() {
    if (!property || !meter || !exchangeForm.date || !exchangeForm.newMeterNumber) return;
    setMessage('');
    setError('');

    startTransition(async () => {
      try {
        const nextMeter = {
          ...meter,
          calibrationDate: '',
          meterNumber: cleanText(exchangeForm.newMeterNumber),
          exchanges: [
            ...(Array.isArray(meter.exchanges) ? meter.exchanges : []),
            {
              date: exchangeForm.date,
              newMeterNumber: cleanText(exchangeForm.newMeterNumber),
              note: cleanText(exchangeForm.note),
              oldMeterNumber: cleanText(exchangeForm.oldMeterNumber || meter.meterNumber),
            },
          ],
        };
        const nextProperty = updateMeterInProperty(nextMeter);
        if (!nextProperty) return;
        const updatedMeters =
          'meters' in nextProperty ? nextProperty.meters : Array.isArray(property.meters) ? property.meters : [];
        const updatedUnits =
          'units' in nextProperty ? nextProperty.units : Array.isArray(property.units) ? property.units : [];

        await updateDoc(doc(db, 'properties', propertyId), {
          meters: updatedMeters,
          units: updatedUnits,
          updatedAt: serverTimestamp(),
        });

        setExchangeForm({
          date: '',
          newMeterNumber: '',
          note: '',
          oldMeterNumber: cleanText(exchangeForm.newMeterNumber),
        });
        setMessage('Zählerwechsel wurde dokumentiert.');
      } catch (caughtError) {
        console.error(`Fehler beim Dokumentieren des Zählerwechsels ${meterId}:`, caughtError);
        setError('Der Zählerwechsel konnte nicht gespeichert werden.');
      }
    });
  }

  if (isLoading) {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm leading-6 text-slate-600">
          Zähler wird geladen...
        </div>
      </section>
    );
  }

  if (!property || !meter) {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-700">
          {error || 'Der Zähler wurde nicht gefunden.'}
        </div>
      </section>
    );
  }

  const backHref = unitId ? `/admin/einheit/${propertyId}/${unitId}` : `/admin/immobilie/${propertyId}`;

  return (
    <div className="admin-page space-y-4">
      <section className="admin-hero rounded-[28px] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,250,240,0.96)_0%,rgba(247,241,231,0.94)_100%)] p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.35)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Zähler ansehen</p>
        <h2 className="mt-2 text-3xl text-slate-950">{formatValue(meter.label || meter.type)}</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
            href={backHref}
          >
            Zurück
          </Link>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-4">
        <DetailCard title="Grunddaten">
          <DetailRow label="Objekt" value={property.name} />
          <DetailRow label="Einheit" value={unit ? unit.unitLabel || unit.floor : 'Objekt-Zähler'} />
          <DetailRow label="Zählerart" value={meter.label || meter.type} />
          <DetailRow label="Position" value={meter.position} />
        </DetailCard>

        <DetailCard title="Technische Daten">
          <DetailRow label="Zählernummer" value={meter.meterNumber} />
          <DetailRow label="Eichdatum" value={meter.calibrationDate} />
          <DetailRow label="Erster Stand" value={meter.initialReading} />
          <DetailRow label="Datum erster Stand" value={meter.initialReadingDate} />
        </DetailCard>

        <DetailCard title="Aktueller Stand">
          <DetailRow label="Letzter Stand" value={meter.latestReading} />
          <DetailRow label="Datum letzter Stand" value={meter.latestReadingDate} />
        </DetailCard>

        <DetailCard title="Zählerwechsel">
          <DetailRow label="Anzahl Wechsel" value={String(exchanges.length)} />
          <DetailRow label="Historieneinträge" value={String(readingHistory.length)} />
        </DetailCard>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Neuer Zählerstand</p>
          <div className="mt-4 grid gap-3">
            <input
              className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => setReadingForm((current) => ({ ...current, value: event.target.value }))}
              placeholder="Zählerstand"
              value={readingForm.value}
            />
            <input
              className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => setReadingForm((current) => ({ ...current, date: event.target.value }))}
              type="date"
              value={readingForm.date}
            />
            <textarea
              className="min-h-24 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => setReadingForm((current) => ({ ...current, note: event.target.value }))}
              placeholder="Notiz zum Zählerstand"
              value={readingForm.note}
            />
            <button
              className="rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-5 py-3 text-sm font-semibold text-stone-100 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending}
              onClick={handleSaveReading}
              type="button"
            >
              Zählerstand speichern
            </button>
          </div>
        </section>

        <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Zählerwechsel</p>
          <div className="mt-4 grid gap-3">
            <input
              className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => setExchangeForm((current) => ({ ...current, oldMeterNumber: event.target.value }))}
              placeholder="Alte Zählernummer"
              value={exchangeForm.oldMeterNumber}
            />
            <input
              className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => setExchangeForm((current) => ({ ...current, newMeterNumber: event.target.value }))}
              placeholder="Neue Zählernummer"
              value={exchangeForm.newMeterNumber}
            />
            <input
              className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => setExchangeForm((current) => ({ ...current, date: event.target.value }))}
              type="date"
              value={exchangeForm.date}
            />
            <textarea
              className="min-h-24 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => setExchangeForm((current) => ({ ...current, note: event.target.value }))}
              placeholder="Notiz zum Zählerwechsel"
              value={exchangeForm.note}
            />
            <button
              className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending}
              onClick={handleSaveExchange}
              type="button"
            >
              Zählerwechsel dokumentieren
            </button>
          </div>
        </section>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <DetailCard title="Historie Zählerstände">
          {readingHistory.length === 0 ? (
            <p className="text-sm text-slate-600">Noch keine Historie vorhanden.</p>
          ) : (
            <div className="grid gap-2">
              {readingHistory.map((entry, index) => (
                <Field key={`${entry.date}-${entry.value}-${index}`} label={entry.date} value={`${formatValue(entry.value)}${entry.note ? ` · ${entry.note}` : ''}`} />
              ))}
            </div>
          )}
        </DetailCard>

        <DetailCard title="Historie Zählerwechsel">
          {exchanges.length === 0 ? (
            <p className="text-sm text-slate-600">Noch kein Zählerwechsel dokumentiert.</p>
          ) : (
            <div className="grid gap-2">
              {exchanges.map((entry, index) => (
                <Field
                  key={`${entry.date}-${entry.newMeterNumber}-${index}`}
                  label={entry.date}
                  value={`${formatValue(entry.oldMeterNumber)} → ${formatValue(entry.newMeterNumber)}${entry.note ? ` · ${entry.note}` : ''}`}
                />
              ))}
            </div>
          )}
        </DetailCard>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
    </div>
  );
}

function DetailCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="admin-card rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">{title}</p>
      <div className="admin-card-body mt-4 grid gap-2.5">{children}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value?: unknown }) {
  return (
    <div className="admin-detail-row grid grid-cols-1 gap-1 border-b border-stone-100 py-3 text-sm last:border-b-0 md:grid-cols-[112px_minmax(0,1fr)] md:gap-3">
      <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</dt>
      <dd className="admin-detail-value min-w-0 whitespace-normal break-words leading-6 text-slate-900">{formatValue(value)}</dd>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: unknown }) {
  return (
    <div className="admin-field rounded-[14px] border border-stone-200 bg-stone-50 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="admin-field-value mt-1 min-w-0 whitespace-normal break-words text-sm leading-6 text-slate-900">{formatValue(value)}</p>
    </div>
  );
}


