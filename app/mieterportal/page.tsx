'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { buildPortalDisplayName, cleanPortalText } from '../../lib/portalAccess';

type ThemeRecord = {
  archived?: boolean;
  id: string;
};

function formatValue(value: unknown) {
  const text = cleanPortalText(value);
  return text || '-';
}

function formatDate(value: unknown) {
  const text = cleanPortalText(value);
  if (!text) return '-';
  const date = new Date(`${text}T12:00:00`);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString('de-DE');
}

function buildAddressAndUnit(
  targetData: Record<string, unknown> | null,
  unitData: Record<string, unknown> | null
) {
  const propertyName = cleanPortalText(targetData?.propertyName);
  const street = cleanPortalText(targetData?.street);
  const houseNumber = cleanPortalText(targetData?.houseNumber);
  const postalCode = cleanPortalText(targetData?.postalCode);
  const city = cleanPortalText(targetData?.city);
  const unitLabel =
    cleanPortalText(targetData?.unitLabel) ||
    cleanPortalText(unitData?.unitLabel) ||
    [
      cleanPortalText(unitData?.floor),
      cleanPortalText(unitData?.unitPosition),
      cleanPortalText(unitData?.section),
    ]
      .filter(Boolean)
      .join(' · ');

  const addressLine =
    [
      [street, houseNumber].filter(Boolean).join(' '),
      [postalCode, city].filter(Boolean).join(' '),
    ]
      .filter(Boolean)
      .join(', ') || propertyName;

  return [propertyName || addressLine, unitLabel].filter(Boolean).join(' · ') || '-';
}

export default function MieterportalDashboard() {
  const { profile } = useAuth();
  const [targetData, setTargetData] = useState<Record<string, unknown> | null>(null);
  const [propertyData, setPropertyData] = useState<Record<string, unknown> | null>(null);
  const [themes, setThemes] = useState<ThemeRecord[]>([]);

  const targetType =
    profile?.targetType === 'contact'
      ? 'contact'
      : profile?.targetType === 'tenant'
        ? 'tenant'
        : null;
  const targetId = cleanPortalText(profile?.targetId);

  useEffect(() => {
    if (!targetType || !targetId) {
      setTargetData(null);
      setPropertyData(null);
      setThemes([]);
      return;
    }

    let isMounted = true;

    async function loadPortalContext() {
      const response = await fetch('/api/portal/context', { cache: 'no-store' });
      const result = (await response.json()) as {
        ok?: boolean;
        propertyData?: Record<string, unknown> | null;
        targetData?: Record<string, unknown> | null;
        themes?: ThemeRecord[];
      };

      if (!isMounted || !response.ok || !result.ok) return;

      setTargetData(result.targetData ?? null);
      setPropertyData(result.propertyData ?? null);
      setThemes(Array.isArray(result.themes) ? result.themes : []);
    }

    void loadPortalContext();
    return () => {
      isMounted = false;
    };
  }, [targetId, targetType]);

  const displayName = useMemo(() => {
    if (!targetType || !targetData) return 'Portal';
    return buildPortalDisplayName(targetType, targetData);
  }, [targetData, targetType]);

  const unitData = useMemo(() => {
    if (targetType !== 'tenant' || !propertyData) return null;
    const units = Array.isArray(propertyData.units)
      ? (propertyData.units as Array<Record<string, unknown>>)
      : [];
    return (
      units.find((unit) => cleanPortalText(unit.id) === cleanPortalText(targetData?.unitId)) ??
      null
    );
  }, [propertyData, targetData, targetType]);

  const communicationCount = useMemo(
    () => themes.filter((theme) => !theme.archived).length,
    [themes]
  );

  const addressAndUnit = useMemo(
    () => buildAddressAndUnit(targetData, unitData),
    [targetData, unitData]
  );

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-stone-200 bg-white px-5 py-5 shadow-sm">
        <p className="font-serif text-2xl text-slate-950">Willkommen im Mieterportal</p>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          Hier finden Sie Ihre wichtigsten Mietdaten und die direkte Kommunikation mit der
          Verwaltung.
        </p>
        <Link
          className="mt-3 inline-flex items-center rounded-full border border-stone-300 bg-stone-50 px-3 py-1.5 text-sm text-slate-700 transition hover:border-amber-700/40 hover:bg-amber-50 hover:text-amber-900"
          href="/mieterportal/nachrichten"
        >
          Neue Nachrichten: <span className="ml-1 font-medium text-slate-950">{communicationCount}</span>
        </Link>
      </section>

      <section className="rounded-[24px] border border-stone-200 bg-white px-5 py-5 shadow-sm">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
          Mieterinformationen
        </p>
        <h2 className="mt-2 font-serif text-3xl text-slate-950">{displayName}</h2>

        <div className="mt-5 overflow-hidden rounded-[20px] border border-stone-200">
          <InfoRow label="Name" value={displayName} />
          <InfoRow label="E-Mail" value={targetData?.email} />
          <InfoRow label="Telefon" value={targetData?.phone || targetData?.mobile} />
          <InfoRow label="Adresse und Einheit" value={addressAndUnit} />
          <InfoRow label="Mietbeginn" value={formatDate(targetData?.moveInDate)} />
          <InfoRow label="Kaltmiete" value={targetData?.coldRent} />
          <InfoRow label="Nebenkosten" value={targetData?.netOperatingCosts} />
        </div>
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="grid gap-2 border-b border-stone-200 bg-white px-4 py-3 last:border-b-0 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">
        {label}
      </div>
      <div className="text-sm text-slate-950">{formatValue(value)}</div>
    </div>
  );
}
