'use client';

import { collection, doc, onSnapshot, type DocumentData } from 'firebase/firestore';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../../lib/firebase';

type UnitDetailViewProps = {
  propertyId: string;
  unitId: string;
};

type AdminRecord = {
  data: DocumentData;
  id: string;
};

const cleanText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const unitDisplayLabel = (unit: DocumentData) =>
  [cleanText(unit.unitLabel), cleanText(unit.floor), cleanText(unit.unitPosition), cleanText(unit.section)]
    .filter(Boolean)
    .join(' · ');

function formatValue(value?: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > 0 ? text : '–';
}

export default function UnitDetailView({ propertyId, unitId }: UnitDetailViewProps) {
  const [property, setProperty] = useState<DocumentData | null>(null);
  const [tenants, setTenants] = useState<AdminRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'properties', propertyId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setProperty(null);
          setError('Die Einheit wurde nicht gefunden.');
          setIsLoading(false);
          return;
        }

        setProperty(snapshot.data());
        setError('');
        setIsLoading(false);
      },
      (caughtError) => {
        console.error(`Fehler beim Laden der Einheit ${propertyId}/${unitId}:`, caughtError);
        setError('Die Einheitsdaten konnten nicht geladen werden.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [propertyId, unitId]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'tenants'), (snapshot) => {
      setTenants(
        snapshot.docs.map((documentSnapshot) => ({
          data: documentSnapshot.data(),
          id: documentSnapshot.id,
        }))
      );
    });

    return () => unsubscribe();
  }, []);

  const unit = useMemo(() => {
    if (!property || !Array.isArray(property.units)) return null;
    return (
      property.units.find(
        (entry: DocumentData) => entry && typeof entry === 'object' && cleanText(entry.id) === unitId
      ) ?? null
    );
  }, [property, unitId]);

  const currentTenant = useMemo(() => {
    if (!unit) return null;
    return (
      tenants.find(
        (tenant) =>
          cleanText(tenant.data.unitId) === unitId && cleanText(tenant.data.status) === 'active'
      ) ??
      tenants.find((tenant) => cleanText(tenant.data.unitId) === unitId) ??
      null
    );
  }, [tenants, unit, unitId]);

  const pastTenants = useMemo(
    () =>
      tenants
        .filter((tenant) => cleanText(tenant.data.unitId) === unitId && tenant.id !== currentTenant?.id)
        .sort((left, right) =>
          cleanText(right.data.moveInDate).localeCompare(cleanText(left.data.moveInDate), 'de')
        ),
    [currentTenant?.id, tenants, unitId]
  );

  const objectMeters = useMemo(
    () => (property && Array.isArray(property.meters) ? property.meters : []),
    [property]
  );

  const unitMeters = useMemo(() => (unit && Array.isArray(unit.meters) ? unit.meters : []), [unit]);

  const unitHeatingEntries = useMemo(
    () => (unit && Array.isArray(unit.heatingEntries) ? unit.heatingEntries : []),
    [unit]
  );

  if (isLoading) {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm leading-6 text-slate-600">
          Einheit wird geladen...
        </div>
      </section>
    );
  }

  if (!property || !unit) {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-700">
          {error || 'Die Einheit wurde nicht gefunden.'}
        </div>
      </section>
    );
  }

  return (
    <div className="admin-page space-y-4">
      <section className="admin-hero rounded-[28px] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,250,240,0.96)_0%,rgba(247,241,231,0.94)_100%)] p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.35)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Einheit ansehen</p>
        <div className="mt-2 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
              <MiniStat label="Objekt" value={property.name} />
              <MiniStat label="Geschoss" value={unit.floor} />
              <MiniStat label="Position" value={unit.unitPosition} />
              <MiniStat label="Status" value={currentTenant ? 'Belegt' : 'Leerstand'} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
              href={`/admin/immobilie/${propertyId}`}
            >
              Zur Immobilie
            </Link>
            {currentTenant ? (
              <Link
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
                href={`/admin/mieter/${currentTenant.id}`}
              >
                Zum Mieter
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-4">
        <DetailCard title="Einheit">
          <DetailRow label="Einheit" value={unit.unitLabel} />
          <DetailRow label="Gebäudeteil" value={unit.section} />
          <DetailRow label="Art" value={unit.unitType} />
          <DetailRow label="Zimmer" value={unit.rooms} />
          <DetailRow label="Fläche" value={unit.areaSqm ? `${unit.areaSqm} m²` : ''} />
        </DetailCard>

        <DetailCard title="Aktueller Mieter">
          <DetailRow
            label="Name"
            value={
              currentTenant
                ? [currentTenant.data.lastName, currentTenant.data.firstName].filter(Boolean).join(', ')
                : 'Kein Mieter zugeordnet'
            }
          />
          <DetailRow label="Einzug" value={currentTenant?.data.moveInDate} />
          <DetailRow label="E-Mail" value={currentTenant?.data.email} />
          <DetailRow label="Telefon" value={currentTenant?.data.phone} />
        </DetailCard>

        <DetailCard title="Letzte Mieter">
          {pastTenants.length === 0 ? (
            <p className="text-sm text-slate-600">Keine früheren Mieter hinterlegt.</p>
          ) : (
            <div className="grid gap-2">
              {pastTenants.map((tenant) => (
                <Field
                  key={tenant.id}
                  label={formatValue(tenant.data.moveInDate)}
                  value={[tenant.data.lastName, tenant.data.firstName].filter(Boolean).join(', ')}
                />
              ))}
            </div>
          )}
        </DetailCard>

        <DetailCard title="Notizen">
          <div className="grid gap-3">
            {unitHeatingEntries.length > 0 ? (
              <div className="grid gap-2">
                {unitHeatingEntries.map((entry: DocumentData) => (
                  <Field
                    key={entry.id}
                    label={formatValue(entry.type)}
                    value={[formatValue(entry.buildYear), formatValue(entry.lastMaintenance)].join(' · ')}
                  />
                ))}
              </div>
            ) : null}
            <p className="text-sm leading-6 text-slate-700">{formatValue(unit.notes)}</p>
          </div>
        </DetailCard>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <MeterSection meters={objectMeters} propertyId={propertyId} title="Objekt-Zähler" />
        <MeterSection
          meters={unitMeters}
          propertyId={propertyId}
          title="Einheiten-Zähler"
          unitId={unitId}
        />
      </div>
    </div>
  );
}

function MeterSection({
  meters,
  propertyId,
  title,
  unitId,
}: {
  meters: DocumentData[];
  propertyId: string;
  title: string;
  unitId?: string;
}) {
  return (
    <section className="admin-card rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">{title}</p>
      {meters.length === 0 ? (
        <div className="mt-4 rounded-[20px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-slate-600">
          Keine Zähler hinterlegt.
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {meters.map((meter, index) => {
            const meterId = cleanText(meter.id) || `meter-${index}`;
            return (
              <article className="rounded-[18px] border border-stone-200 bg-stone-50 p-4" key={meterId}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {[formatValue(meter.label || meter.meterType || meter.type), cleanText(meter.meterNumber) ? `(${cleanText(meter.meterNumber)})` : '']
                        .filter(Boolean)
                        .join(' ')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{formatValue(meter.position)}</p>
                  </div>
                  <Link
                    className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
                    href={unitId ? `/admin/zaehler/${propertyId}/${meterId}?unit=${unitId}` : `/admin/zaehler/${propertyId}/${meterId}`}
                  >
                    Details
                  </Link>
                </div>
                <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.2fr)_repeat(2,minmax(0,0.8fr))]">
                  <Field label="Letzter Stand" value={meter.latestReading} />
                  <Field label="Datum Zählerstand" value={meter.latestReadingDate} />
                  <Field label="Eichdatum" value={meter.calibrationDate} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
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
    <div className="admin-field rounded-[14px] border border-stone-200 bg-white px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="admin-field-value mt-1 min-w-0 whitespace-normal break-words text-sm leading-6 text-slate-900">{formatValue(value)}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value?: unknown }) {
  return (
    <div className="admin-field rounded-[14px] border border-stone-200 bg-white/72 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="admin-field-value mt-1 min-w-0 whitespace-normal break-words text-sm leading-6 text-slate-900">{formatValue(value)}</p>
    </div>
  );
}
