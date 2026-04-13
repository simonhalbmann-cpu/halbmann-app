'use client';

import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../../lib/firebase';

type PropertyDetailViewProps = {
  propertyId: string;
  selectedUnitId?: string;
};

type AdminRecord = {
  data: DocumentData;
  id: string;
};

const servicePartnerFields = [
  { idField: 'wasteCollectionId', label: 'Muellabfuhr' },
  { idField: 'billingServiceId', label: 'Abrechnungsunternehmen' },
  { idField: 'cleaningServiceId', label: 'Hausreinigung' },
  { idField: 'electricianId', label: 'Elektriker' },
  { idField: 'heatingServiceId', label: 'Heizungsdienst' },
  { idField: 'plumbingServiceId', label: 'Sanitaer / Rohrreinigung' },
  { idField: 'janitorId', label: 'Hausmeister' },
  { idField: 'winterServiceId', label: 'Winterdienst' },
  { idField: 'roofMaintenanceId', label: 'Dachwartung' },
  { idField: 'gutterCleaningId', label: 'Regenrinnenreinigung' },
] as const;

const cleanText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const unitDisplayLabel = (unit: DocumentData) =>
  [cleanText(unit.unitLabel), cleanText(unit.floor), cleanText(unit.unitPosition), cleanText(unit.section)]
    .filter(Boolean)
    .join(' · ');

function formatValue(value?: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > 0 ? text : '–';
}

export default function PropertyDetailView({ propertyId, selectedUnitId }: PropertyDetailViewProps) {
  const [property, setProperty] = useState<DocumentData | null>(null);
  const [companies, setCompanies] = useState<AdminRecord[]>([]);
  const [people, setPeople] = useState<AdminRecord[]>([]);
  const [tenants, setTenants] = useState<AdminRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [serviceAssignments, setServiceAssignments] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsubscribers = [
      onSnapshot(
        doc(db, 'properties', propertyId),
        (snapshot) => {
          if (!snapshot.exists()) {
            setProperty(null);
            setError('Die Immobilie wurde nicht gefunden.');
            setIsLoading(false);
            return;
          }

          setProperty(snapshot.data());
          setError('');
          setIsLoading(false);
        },
        (caughtError) => {
          console.error(`Fehler beim Laden der Immobilie ${propertyId}:`, caughtError);
          setError('Die Immobiliendaten konnten nicht geladen werden.');
          setIsLoading(false);
        }
      ),
      onSnapshot(query(collection(db, 'companies')), (snapshot) => {
        setCompanies(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id })));
      }),
      onSnapshot(query(collection(db, 'people')), (snapshot) => {
        setPeople(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id })));
      }),
      onSnapshot(
        query(collection(db, 'tenants')),
        (snapshot) => {
          setTenants(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id })));
        },
        (caughtError) => {
          console.error(`Fehler beim Laden der Mieter fuer Immobilie ${propertyId}:`, caughtError);
        }
      ),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [propertyId]);

  useEffect(() => {
    if (!property) return;
    const nextAssignments: Record<string, string> = {};
    for (const entry of servicePartnerFields) {
      nextAssignments[entry.idField] = cleanText(property[entry.idField]);
    }
    setServiceAssignments(nextAssignments);
  }, [property]);

  const ownerLabel = useMemo(() => {
    if (!property) return '';
    const direct = cleanText(property.ownerName);
    if (direct) return direct;
    const company = companies.find((entry) => entry.id === cleanText(property.ownerId));
    return company ? String(company.data.name ?? '') : '';
  }, [companies, property]);

  const objectMeters = useMemo(
    () =>
      property && Array.isArray(property.meters)
        ? property.meters.filter((meter) => meter && typeof meter === 'object')
        : [],
    [property]
  );

  const heatingEntries = useMemo(
    () =>
      property && Array.isArray(property.heatingEntries)
        ? property.heatingEntries.filter((entry) => entry && typeof entry === 'object')
        : [],
    [property]
  );

  const serviceOptions = useMemo(
    () =>
      people
        .map((entry) => ({
          label:
            [cleanText(entry.data.lastName), cleanText(entry.data.firstName)].filter(Boolean).join(', ') ||
            cleanText(entry.data.companyName) ||
            cleanText(entry.data.name) ||
            entry.id,
          value: entry.id,
        }))
        .sort((left, right) => left.label.localeCompare(right.label, 'de')),
    [people]
  );

  const unitCards = useMemo(() => {
    if (!property) return [];

    const units = Array.isArray(property.units) ? property.units : [];
    return units.map((unit) => {
      const unitId = cleanText(unit?.id);
      const linkedTenants = tenants
        .filter((tenant) => cleanText(tenant.data.unitId) === unitId)
        .sort((left, right) =>
          cleanText(right.data.moveInDate).localeCompare(cleanText(left.data.moveInDate), 'de')
        );

      const currentTenant =
        linkedTenants.find((tenant) => cleanText(tenant.data.status) === 'active') ??
        linkedTenants[0] ??
        null;

      return {
        currentTenant,
        id: unitId,
        isSelected: Boolean(selectedUnitId && selectedUnitId === unitId),
        label: unitDisplayLabel(unit) || unitId || 'Einheit',
        pastTenants: linkedTenants.filter((tenant) => tenant.id !== currentTenant?.id),
      };
    });
  }, [property, selectedUnitId, tenants]);

  async function saveServiceAssignments() {
    try {
      setError('');
      setSaveMessage('');
      await updateDoc(doc(db, 'properties', propertyId), {
        ...serviceAssignments,
        updatedAt: serverTimestamp(),
      });
      setSaveMessage('Dienstleister wurden gespeichert.');
    } catch (caughtError) {
      console.error(`Fehler beim Speichern der Dienstleister fuer Immobilie ${propertyId}:`, caughtError);
      setError('Die Dienstleister konnten nicht gespeichert werden.');
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm leading-6 text-slate-600">
          Immobilie wird geladen...
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
    <div className="space-y-4">
      <section className="rounded-[28px] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,250,240,0.96)_0%,rgba(247,241,231,0.94)_100%)] p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.35)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Immobilie ansehen</p>
        <div className="mt-2 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <h2 className="text-3xl text-slate-950">{formatValue(property.name)}</h2>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat label="Objektnummer" value={property.propertyNumber} />
              <MiniStat label="Nutzungsart" value={property.usageType} />
              <MiniStat label="Eigentumsart" value={property.ownershipType} />
              <MiniStat label="Eigentuemer" value={ownerLabel} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
              href={`/admin/immobilie/${propertyId}/bearbeiten`}
            >
              Bearbeiten
            </Link>
            <Link
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
              href="/admin/immobilie"
            >
              Zur Immobilienuebersicht
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Zaehleruebersicht</p>
          {objectMeters.length === 0 ? (
            <div className="mt-4 rounded-[20px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-slate-600">
              Noch keine Objekt-Zaehler hinterlegt.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-[18px] border border-stone-200">
              <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_160px_minmax(0,1fr)] bg-stone-100/70 px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-stone-500">
                <span>Zaehler</span>
                <span>Zaehlernummer</span>
                <span>Eichdatum</span>
                <span>Position</span>
              </div>
              <div className="divide-y divide-stone-200 bg-white">
                {objectMeters.map((meter, index) => {
                  const meterId = cleanText(meter.id) || `meter-${index}`;
                  return (
                    <Link
                      className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_160px_minmax(0,1fr)] gap-3 px-4 py-3 text-sm text-slate-800 transition hover:bg-amber-50/45"
                      href={`/admin/zaehler/${propertyId}/${meterId}`}
                      key={meterId}
                    >
                      <span className="truncate">{formatValue(meter.label || meter.type)}</span>
                      <span className="truncate">{formatValue(meter.meterNumber)}</span>
                      <span>{formatValue(meter.calibrationDate)}</span>
                      <span className="truncate">{formatValue(meter.position)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Dienstleister</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Feste Ansprechpartner pro Gewerk direkt diesem Objekt zuordnen.
              </p>
            </div>
            <button
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
              onClick={saveServiceAssignments}
              type="button"
            >
              Speichern
            </button>
          </div>
          <div className="mt-4 grid gap-3">
            {servicePartnerFields.map((field) => (
              <label className="block" key={field.idField}>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{field.label}</p>
                <select
                  className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                  onChange={(event) =>
                    setServiceAssignments((current) => ({
                      ...current,
                      [field.idField]: event.target.value,
                    }))
                  }
                  value={serviceAssignments[field.idField] || ''}
                >
                  <option value="">Nicht zugeordnet</option>
                  {serviceOptions.map((option) => (
                    <option key={`${field.idField}-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {saveMessage ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {saveMessage}
            </div>
          ) : null}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <DetailCard title="Adresse und Eckdaten">
          <DetailRow label="Strasse" value={[property.street, property.houseNumber].filter(Boolean).join(' ')} />
          <DetailRow label="PLZ / Ort" value={[property.postalCode, property.city].filter(Boolean).join(' ')} />
          <DetailRow label="Baujahr" value={property.yearBuilt} />
          <DetailRow label="Kaufpreis" value={property.purchasePrice} />
          <DetailRow label="Anfangsrendite" value={property.initialYieldPercent} />
        </DetailCard>

        <DetailCard title="Technik">
          <DetailRow label="Zentralheizung" value={property.hasCentralHeating === 'no' ? 'Nein' : 'Ja'} />
          <DetailRow
            label="Heizungsarten"
            value={
              heatingEntries.length > 0
                ? heatingEntries
                    .map((entry) =>
                      [cleanText(entry.type), cleanText(entry.buildYear), cleanText(entry.lastMaintenance)]
                        .filter(Boolean)
                        .join(' · ')
                    )
                    .join(', ')
                : Array.isArray(property.heatingSystems)
                  ? property.heatingSystems.filter(Boolean).join(', ')
                  : property.heatingSystems
            }
          />
          <DetailRow label="Einheiten" value={String(Array.isArray(property.units) ? property.units.length : 0)} />
          <DetailRow
            label="Leerstand"
            value={String(
              (Array.isArray(property.units) ? property.units : []).filter(
                (unit) => unit && typeof unit === 'object' && !cleanText(unit.tenantId)
              ).length
            )}
          />
        </DetailCard>

        <DetailCard title="Wartung">
          <DetailRow label="Letzte Heizungswartung" value={property.lastHeatingMaintenance} />
          <DetailRow label="Letzte Dachwartung" value={property.roofMaintenanceLastMaintenance} />
          <DetailRow label="Letzte Regenrinnenreinigung" value={property.gutterCleaningLastMaintenance} />
          <DetailRow label="Kaufdatum" value={property.purchaseDate} />
          <DetailRow label="Eigentum seit" value={property.ownershipSince} />
        </DetailCard>
      </div>

      <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Einheiten</p>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {unitCards.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-slate-600">
              Noch keine Einheiten hinterlegt.
            </div>
          ) : (
            unitCards.map((unit) => (
              <article
                className={`rounded-[20px] border px-4 py-4 ${
                  unit.isSelected ? 'border-amber-300 bg-amber-50/60' : 'border-stone-200 bg-stone-50'
                }`}
                key={unit.id || unit.label}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-slate-900">{unit.label}</p>
                  <Link
                    className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
                    href={`/admin/einheit/${propertyId}/${unit.id}`}
                  >
                    Ansehen
                  </Link>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Field
                    label="Aktueller Mieter"
                    value={
                      unit.currentTenant
                        ? [cleanText(unit.currentTenant.data.lastName), cleanText(unit.currentTenant.data.firstName)]
                            .filter(Boolean)
                            .join(', ')
                        : 'Kein Mieter zugeordnet'
                    }
                  />
                  <Field label="Einheits-ID" value={unit.id} />
                </div>
                {unit.pastTenants.length > 0 ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {unit.pastTenants.slice(0, 4).map((tenant) => (
                      <Field
                        key={tenant.id}
                        label={formatValue(tenant.data.moveInDate)}
                        value={[cleanText(tenant.data.lastName), cleanText(tenant.data.firstName)]
                          .filter(Boolean)
                          .join(', ')}
                      />
                    ))}
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function DetailCard({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">{title}</p>
      <div className="mt-4 grid gap-2.5">{children}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value?: unknown }) {
  return (
    <div className="grid grid-cols-1 gap-1.5 border-b border-stone-100 py-3 text-sm last:border-b-0 md:grid-cols-[112px_minmax(0,1fr)] md:gap-4">
      <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</dt>
      <dd className="min-w-0 whitespace-normal break-words leading-6 text-slate-900">{formatValue(value)}</dd>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: unknown }) {
  return (
    <div className="rounded-[14px] border border-stone-200 bg-white px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="mt-1 min-w-0 whitespace-normal break-words text-sm leading-6 text-slate-900">{formatValue(value)}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value?: unknown }) {
  return (
    <div className="rounded-[14px] border border-stone-200 bg-white/72 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="mt-1 min-w-0 whitespace-normal break-words text-sm leading-6 text-slate-900">{formatValue(value)}</p>
    </div>
  );
}
