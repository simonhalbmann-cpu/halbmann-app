'use client';

import { collection, doc, onSnapshot, query, type DocumentData } from 'firebase/firestore';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../../lib/firebase';

type PropertyServiceProvidersViewProps = {
  propertyId: string;
};

type AdminRecord = {
  data: DocumentData;
  id: string;
};

const servicePartnerFields = [
  { idField: 'billingServiceId', label: 'Abrechnungsunternehmen' },
  { idField: 'roofMaintenanceId', label: 'Dachdecker / Dachwartung' },
  { idField: 'electricianId', label: 'Elektriker' },
  { idField: 'windowDoorServiceId', label: 'Fenster / Tueren' },
  { idField: 'gardeningServiceId', label: 'Gartenpflege' },
  { idField: 'janitorId', label: 'Hausmeister' },
  { idField: 'cleaningServiceId', label: 'Hausreinigung' },
  { idField: 'heatingServiceId', label: 'Heizung' },
  { idField: 'painterServiceId', label: 'Maler' },
  { idField: 'wasteCollectionId', label: 'Muellabfuhr' },
  { idField: 'gutterCleaningId', label: 'Regenrinnenreinigung' },
  { idField: 'plumbingServiceId', label: 'Rohrreinigung / Sanitaer' },
  { idField: 'locksmithServiceId', label: 'Schluesseldienst' },
  { idField: 'chimneySweepServiceId', label: 'Schornsteinfeger' },
  { idField: 'otherServiceId', label: 'Sonstiges' },
  { idField: 'carpenterServiceId', label: 'Tischler' },
  { idField: 'winterServiceId', label: 'Winterdienst' },
] as const;

const cleanText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

function normalizeServiceId(value: unknown) {
  return cleanText(value).replace(/^company:/, '').replace(/^person:/, '').replace(/^contact:/, '');
}

function unitDisplayLabel(unit: DocumentData) {
  return [cleanText(unit.unitLabel), cleanText(unit.floor), cleanText(unit.unitPosition), cleanText(unit.section)]
    .filter(Boolean)
    .join(' · ');
}

function personDisplayName(person: DocumentData, fallbackId: string) {
  return (
    [cleanText(person.lastName), cleanText(person.firstName)].filter(Boolean).join(', ') ||
    cleanText(person.partnerCompanyName || person.companyName) ||
    cleanText(person.email) ||
    fallbackId
  );
}

export default function PropertyServiceProvidersView({ propertyId }: PropertyServiceProvidersViewProps) {
  const [property, setProperty] = useState<DocumentData | null>(null);
  const [people, setPeople] = useState<AdminRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribeProperty = onSnapshot(
      doc(db, 'properties', propertyId),
      (snapshot) => {
        setProperty(snapshot.exists() ? snapshot.data() : null);
        setIsLoading(false);
      },
      (caughtError) => {
        console.error(`Fehler beim Laden der Immobilie ${propertyId}:`, caughtError);
        setError('Die Immobilie konnte nicht geladen werden.');
        setIsLoading(false);
      }
    );
    const unsubscribePeople = onSnapshot(query(collection(db, 'people')), (snapshot) => {
      setPeople(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id })));
    });

    return () => {
      unsubscribeProperty();
      unsubscribePeople();
    };
  }, [propertyId]);

  const rows = useMemo(() => {
    if (!property) return [];
    const assignments = new Map<
      string,
      {
        email: string;
        id: string;
        labels: Set<string>;
        locations: Set<string>;
        name: string;
        phone: string;
      }
    >();

    function addAssignment(rawId: unknown, label: string, location: string) {
      const id = normalizeServiceId(rawId);
      if (!id) return;
      const person = people.find((entry) => entry.id === id) ?? null;
      const current =
        assignments.get(id) ??
        {
          email: cleanText(person?.data.email) || '–',
          id,
          labels: new Set<string>(),
          locations: new Set<string>(),
          name: person ? personDisplayName(person.data, id) : id,
          phone: cleanText(person?.data.phone || person?.data.mobile) || '–',
        };
      current.labels.add(label);
      current.locations.add(location);
      assignments.set(id, current);
    }

    servicePartnerFields.forEach((field) => addAssignment(property[field.idField], field.label, 'Immobilie'));
    const units = Array.isArray(property.units) ? property.units : [];
    units.forEach((unit) => {
      if (!unit || typeof unit !== 'object') return;
      const unitLabel = unitDisplayLabel(unit as DocumentData) || 'Einheit';
      servicePartnerFields.forEach((field) => addAssignment((unit as DocumentData)[field.idField], field.label, unitLabel));
    });

    return Array.from(assignments.values()).sort((left, right) => left.name.localeCompare(right.name, 'de'));
  }, [people, property]);

  if (isLoading) {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm leading-6 text-slate-600">
          Dienstleister werden geladen...
        </div>
      </section>
    );
  }

  if (!property) {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-700">
          {error || 'Die Immobilie wurde nicht gefunden.'}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[28px] border border-stone-200 bg-white px-5 py-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Dienstleister</p>
          <h2 className="mt-1 font-serif text-3xl text-slate-950">{cleanText(property.name) || 'Immobilie'}</h2>
        </div>
        <Link
          className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
          href={`/admin/immobilie/${propertyId}`}
        >
          Zur Immobilie
        </Link>
      </div>

      <div className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
        {rows.length === 0 ? (
          <div className="px-1 py-5 text-sm leading-6 text-slate-600">
            Für diese Immobilie sind noch keine Dienstleister zugeordnet.
          </div>
        ) : (
          rows.map((row) => (
            <Link
              className="grid gap-2 px-1 py-3 text-sm transition hover:bg-stone-50 md:grid-cols-[minmax(180px,1fr)_minmax(160px,0.8fr)_minmax(160px,0.8fr)_minmax(160px,1fr)] md:items-center"
              href={`/admin/personen/${row.id}`}
              key={row.id}
            >
              <span className="min-w-0 truncate font-medium text-slate-950">{row.name}</span>
              <span className="min-w-0 truncate text-slate-600">{Array.from(row.labels).sort().join(', ')}</span>
              <span className="min-w-0 truncate text-slate-600">{Array.from(row.locations).sort().join(', ')}</span>
              <span className="min-w-0 truncate text-slate-600">{[row.email, row.phone].filter((value) => value && value !== '–').join(' · ') || '–'}</span>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
