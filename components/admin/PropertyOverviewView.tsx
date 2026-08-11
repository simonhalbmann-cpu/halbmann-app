'use client';

import { collection, doc, onSnapshot, query, type DocumentData } from 'firebase/firestore';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../../lib/firebase';
import { cleanStoredDocuments } from '../../lib/tenantDocuments';

type PropertyOverviewViewProps = {
  propertyId: string;
};

type AdminRecord = {
  data: DocumentData;
  id: string;
};

const cleanText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const usageTypeLabels: Record<string, string> = {
  commercial: 'Gewerbe',
  logistics: 'Lager / Logistik',
  mixed_use: 'Mischnutzung',
  parking: 'Stellplatz',
  residential: 'Wohnen',
};

const servicePartnerFields = [
  'billingServiceId',
  'roofMaintenanceId',
  'electricianId',
  'windowDoorServiceId',
  'gardeningServiceId',
  'janitorId',
  'cleaningServiceId',
  'heatingServiceId',
  'painterServiceId',
  'wasteCollectionId',
  'gutterCleaningId',
  'plumbingServiceId',
  'locksmithServiceId',
  'chimneySweepServiceId',
  'otherServiceId',
  'carpenterServiceId',
  'winterServiceId',
];

const unitDisplayLabel = (unit: DocumentData) =>
  [cleanText(unit.unitLabel), cleanText(unit.floor), cleanText(unit.unitPosition), cleanText(unit.section)]
    .filter(Boolean)
    .join(' - ');

function formatValue(value?: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > 0 ? text : '-';
}

function formatDate(value: unknown) {
  const text = cleanText(value);
  if (!text) return '';
  const date = new Date(`${text}T12:00:00`);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function parseDate(value: unknown) {
  const text = cleanText(value);
  if (!text) return Number.POSITIVE_INFINITY;
  const date = new Date(`${text}T12:00:00`).getTime();
  return Number.isNaN(date) ? Number.POSITIVE_INFINITY : date;
}

function parseLeaseEndReminderMonths(value: unknown) {
  const numeric = Number.parseInt(cleanText(value), 10);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 3;
}

function shiftDateByMonths(value: unknown, months: number) {
  const text = cleanText(value);
  if (!text) return '';
  const date = new Date(`${text}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function parseNonNegativeInteger(value: unknown) {
  const numeric = Number.parseInt(cleanText(value), 10);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function buildLeaseWarningTargets(tenantData: DocumentData | undefined, warningMonths: number) {
  if (!tenantData) return [];
  const leaseEndDate = cleanText(tenantData.moveOutDate || tenantData.leaseEndDate || tenantData.endDate);
  const targets = leaseEndDate
    ? [
        {
          endDate: leaseEndDate,
          label: 'Mietende',
          warningDate: shiftDateByMonths(leaseEndDate, -warningMonths),
        },
      ]
    : [];

  if (cleanText(tenantData.leaseOptionEnabled) !== 'yes') return targets;
  const baseDate = leaseEndDate ? new Date(`${leaseEndDate}T12:00:00`) : null;
  const optionCount = parseNonNegativeInteger(tenantData.leaseOptionCount);
  const optionYears = parseNonNegativeInteger(tenantData.leaseOptionYears);
  if (!baseDate || Number.isNaN(baseDate.getTime()) || !optionCount || !optionYears) return targets;

  Array.from({ length: optionCount }).forEach((_, index) => {
    const date = new Date(baseDate);
    date.setFullYear(date.getFullYear() + optionYears * (index + 1));
    const endDate = date.toISOString().slice(0, 10);
    targets.push({
      endDate,
      label: `Option ${index + 1}`,
      warningDate: shiftDateByMonths(endDate, -warningMonths),
    });
  });

  return targets;
}

function findTenantContractForUnit(tenant: AdminRecord, propertyId: string, unitId: string) {
  const contracts = Array.isArray(tenant.data.leaseContracts) ? tenant.data.leaseContracts : [];
  const match = contracts.find(
    (contract) =>
      contract &&
      typeof contract === 'object' &&
      cleanText((contract as DocumentData).propertyId) === propertyId &&
      cleanText((contract as DocumentData).unitId) === unitId
  );
  if (match && typeof match === 'object') return match as DocumentData;
  if (cleanText(tenant.data.propertyId) === propertyId && cleanText(tenant.data.unitId) === unitId) {
    return tenant.data;
  }
  return null;
}

function tenantName(tenant: AdminRecord | null | undefined) {
  if (!tenant) return '';
  return (
    [cleanText(tenant.data.lastName), cleanText(tenant.data.firstName)].filter(Boolean).join(', ') ||
    cleanText(tenant.data.companyName) ||
    cleanText(tenant.data.name)
  );
}

function rentIncreaseLabel(tenant: AdminRecord | null | undefined) {
  if (!tenant) return '';
  const type = cleanText(tenant.data.rentIncreaseType);
  if (!type) return '';
  const date = formatDate(tenant.data.rentIncreaseNextReview);
  const label =
    type === 'graduated'
      ? 'Staffelmiete'
      : type === 'index'
        ? 'Indexmiete'
        : type === 'legal'
          ? 'gesetzliche Prüfung'
          : type;
  return [label, date ? `am ${date}` : ''].filter(Boolean).join(' - ');
}

export default function PropertyOverviewView({ propertyId }: PropertyOverviewViewProps) {
  const [property, setProperty] = useState<DocumentData | null>(null);
  const [tenants, setTenants] = useState<AdminRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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
          console.error(`Fehler beim Laden der Immobilienuebersicht ${propertyId}:`, caughtError);
          setError('Die Immobiliendaten konnten nicht geladen werden.');
          setIsLoading(false);
        }
      ),
      onSnapshot(query(collection(db, 'tenants')), (snapshot) => {
        setTenants(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id })));
      }),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [propertyId]);

  const units = useMemo(() => {
    if (!property || !Array.isArray(property.units)) return [];
    return property.units.filter((unit) => unit && typeof unit === 'object') as DocumentData[];
  }, [property]);

  const unitRows = useMemo(
    () =>
      units.map((unit) => {
        const unitId = cleanText(unit.id);
        const linkedTenants = tenants
          .map((tenant) => ({ contract: findTenantContractForUnit(tenant, propertyId, unitId), tenant }))
          .filter((entry): entry is { contract: DocumentData; tenant: AdminRecord } => Boolean(entry.contract))
          .sort((left, right) => parseDate(left.contract.moveInDate) - parseDate(right.contract.moveInDate));
        const currentEntry = linkedTenants.find((entry) => cleanText(entry.contract.status || entry.tenant.data.status) === 'active') ?? null;
        const upcomingEntry = linkedTenants.find((entry) => cleanText(entry.contract.status || entry.tenant.data.status) === 'pending') ?? null;
        const currentTenant = currentEntry?.tenant ?? null;
        const currentContract = currentEntry?.contract ?? null;
        const upcomingTenant = upcomingEntry?.tenant ?? null;
        const upcomingContract = upcomingEntry?.contract ?? null;
        const leaseEndDate = cleanText(currentContract?.moveOutDate || currentContract?.leaseEndDate || currentContract?.endDate);
        const leaseEndReminderMonths = parseLeaseEndReminderMonths(currentContract?.leaseEndReminderMonths ?? currentTenant?.data.leaseEndReminderMonths);
        const leaseWarningTargets = buildLeaseWarningTargets(currentContract ?? undefined, leaseEndReminderMonths)
          .filter((target) => target.warningDate)
          .sort((left, right) => parseDate(left.warningDate) - parseDate(right.warningDate));
        const nextLeaseWarningTarget = leaseWarningTargets[0] ?? null;
        return {
          coldRent: cleanText(currentContract?.coldRent),
          currentTenant,
          id: unitId,
          label: unitDisplayLabel(unit) || unitId || 'Einheit',
          leaseEnd: formatDate(leaseEndDate),
          leaseEndRaw: leaseEndDate,
          leaseWarningDate: nextLeaseWarningTarget?.warningDate ?? '',
          leaseWarningDateLabel: formatDate(nextLeaseWarningTarget?.warningDate),
          leaseWarningEndLabel: nextLeaseWarningTarget
            ? `${nextLeaseWarningTarget.label} am ${formatDate(nextLeaseWarningTarget.endDate)}`
            : '',
          leaseWarningMonths: leaseEndReminderMonths,
          nextIncrease: rentIncreaseLabel(currentTenant),
          upcomingTenant,
          upcomingTenantDate: formatDate(upcomingContract?.moveInDate),
        };
      }),
    [propertyId, tenants, units]
  );

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }, []);
  const occupiedCount = unitRows.filter((unit) => unit.currentTenant).length;
  const leaseWarnings = unitRows
    .filter((unit) => unit.currentTenant && unit.leaseWarningDate && parseDate(unit.leaseWarningDate) <= today)
    .sort((left, right) => parseDate(left.leaseWarningDate) - parseDate(right.leaseWarningDate));
  const nextIncrease = unitRows
    .map((unit) => ({ label: unit.label, tenant: unit.currentTenant, timestamp: parseDate(unit.currentTenant?.data.rentIncreaseNextReview) }))
    .filter((entry) => entry.tenant && Number.isFinite(entry.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp)[0];
  const assignedServiceCount = servicePartnerFields.filter((field) => cleanText(property?.[field])).length;
  const objectMeterCount = Array.isArray(property?.meters) ? property!.meters.length : 0;
  const unitMeterCount = units.reduce((sum, unit) => sum + (Array.isArray(unit.meters) ? unit.meters.length : 0), 0);
  const documentCount =
    cleanStoredDocuments(property?.propertyDocuments).length +
    units.reduce((sum, unit) => sum + cleanStoredDocuments(unit.documents).length, 0);

  if (isLoading) {
    return (
      <section className="admin-card rounded-[24px] border border-stone-200 bg-white p-6 text-sm text-slate-600">
        Objektuebersicht wird geladen.
      </section>
    );
  }

  if (error || !property) {
    return (
      <section className="admin-card rounded-[24px] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        {error || 'Die Immobilie wurde nicht gefunden.'}
      </section>
    );
  }

  return (
    <div className="admin-page space-y-4">
      <section className="admin-card rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Objektuebersicht</p>
            <h2 className="mt-1 text-2xl font-medium text-slate-950">{formatValue(property.name)}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {[property.street, property.houseNumber, property.postalCode, property.city].map(cleanText).filter(Boolean).join(', ')}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniTile label="Einheiten" value={String(unitRows.length)} />
            <MiniTile label="Vermietet" value={`${occupiedCount}/${unitRows.length}`} />
            <MiniTile label="Nutzung" value={usageTypeLabels[cleanText(property.usageType)] || formatValue(property.usageType)} />
          </div>
        </div>

        {leaseWarnings.length > 0 ? (
          <div className="mt-5 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <p className="font-medium">Miet-/Optionsende beachten</p>
            <div className="mt-2 space-y-1">
              {leaseWarnings.slice(0, 3).map((unit) => (
                <p key={`lease-warning-${unit.id || unit.label}`}>
                  {unit.label}: {tenantName(unit.currentTenant)} - {unit.leaseWarningEndLabel || `Mietende am ${unit.leaseEnd || '-'}`}.
                </p>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)]">
          <div className="overflow-hidden rounded-[18px] border border-stone-200">
            <div className="grid grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_110px_120px_140px] gap-3 bg-stone-50 px-4 py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">
              <span>Einheit</span>
              <span>Mieter</span>
              <span>Miete</span>
              <span>Mietende</span>
              <span>Naechste Pruefung</span>
            </div>
            {unitRows.length === 0 ? (
              <div className="px-4 py-5 text-sm text-slate-600">Noch keine Einheiten angelegt.</div>
            ) : (
              unitRows.map((unit) => (
                <div
                  className={`grid grid-cols-1 gap-2 border-t px-4 py-4 text-sm lg:grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_110px_120px_140px] lg:gap-3 ${
                    unit.leaseWarningDate && parseDate(unit.leaseWarningDate) <= today
                      ? 'border-rose-100 bg-rose-50/60 text-rose-900'
                      : 'border-stone-100 text-slate-700'
                  }`}
                  key={unit.id || unit.label}
                >
                  <span className="font-medium text-slate-950">{unit.label}</span>
                  <span>
                    {unit.currentTenant ? (
                      <>
                        {tenantName(unit.currentTenant)}
                        {unit.upcomingTenant ? (
                          <span className="mt-1 block text-xs text-emerald-700">
                            naechster: {tenantName(unit.upcomingTenant)}{unit.upcomingTenantDate ? ` ab ${unit.upcomingTenantDate}` : ''}
                          </span>
                        ) : null}
                      </>
                    ) : unit.upcomingTenant ? (
                      <span className="text-emerald-700">
                        frei, naechster: {tenantName(unit.upcomingTenant)}{unit.upcomingTenantDate ? ` ab ${unit.upcomingTenantDate}` : ''}
                      </span>
                    ) : (
                      <span className="text-amber-700">frei</span>
                    )}
                  </span>
                  <span>{formatValue(unit.coldRent)}</span>
                  <span>
                    {unit.leaseEnd || '-'}
                    {unit.leaseWarningDate && parseDate(unit.leaseWarningDate) <= today ? (
                      <span className="mt-1 block text-xs font-medium text-rose-700">
                        {unit.leaseWarningEndLabel || 'Miet-/Optionsende'} · Warnung seit {unit.leaseWarningDateLabel || '-'}
                      </span>
                    ) : null}
                  </span>
                  <span>{unit.nextIncrease || '-'}</span>
                </div>
              ))
            )}
          </div>

          <aside className="grid gap-3">
            <InsightCard label="Naechste Mieterhoehung" value={nextIncrease ? rentIncreaseLabel(nextIncrease.tenant) : 'keine Frist'} />
            <InsightCard label="Zaehlerspiegel" value={`${objectMeterCount + unitMeterCount} Zaehler`} />
            <InsightCard label="Dienstleister" value={`${assignedServiceCount} zugeordnet`} />
            <InsightCard label="Dokumente" value={`${documentCount} Dateien`} />
          </aside>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-4">
        <ActionCard href={`/admin/immobilie/${propertyId}/details#meters`} label="Zaehleruebersicht" text={`${objectMeterCount + unitMeterCount} Zaehler im Objekt`} />
        <ActionCard href={`/admin/immobilie/${propertyId}/details#maintenance`} label="Wartung dokumentieren" text="Heizung, Dach und Rinnen nachhalten" />
        <ActionCard href={`/admin/immobilie/${propertyId}/details#service-providers`} label="Dienstleister" text={`${assignedServiceCount} Zuordnungen`} />
        <ActionCard href={`/admin/immobilie/${propertyId}/details#documents`} label="Dokumente" text={`${documentCount} Dateien`} />
      </div>
    </div>
  );
}

function MiniTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-stone-200 bg-stone-50 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-950">{value}</p>
    </div>
  );
}

function InsightCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-stone-200 bg-stone-50 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-950">{value}</p>
    </div>
  );
}

function ActionCard({ href, label, text }: { href: string; label: string; text: string }) {
  return (
    <Link
      className="group rounded-[20px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-42px_rgba(148,119,77,0.35)] transition hover:border-amber-700/30 hover:-translate-y-0.5"
      href={href}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">{label}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
      <span className="mt-4 inline-flex text-sm font-medium text-slate-950 underline-offset-4 group-hover:underline">
        Oeffnen
      </span>
    </Link>
  );
}
