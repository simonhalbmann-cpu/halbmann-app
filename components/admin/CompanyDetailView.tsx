'use client';

import { doc, onSnapshot } from 'firebase/firestore';
import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { db } from '../../lib/firebase';
import {
  formatCommercialRegisterDisplay,
  formatManagingDirectorDisplay,
  formatRegisterCourtDisplay,
  formatTaxNumberDisplay,
  formatVatIdDisplay,
  normalizeLegalFormDisplay,
} from '../../lib/signatures';
import { companyDocumentFields } from './companyConfig';

type CompanyDetailViewProps = {
  companyId: string;
};

type CompanyData = Record<string, unknown>;

function formatValue(value?: unknown) {
  if (Array.isArray(value)) {
    const entries = value.map((entry) => String(entry ?? '').trim()).filter(Boolean);
    return entries.length > 0 ? entries.join(', ') : '–';
  }

  const text = String(value ?? '').trim();
  if (!text) {
    return '–';
  }

  return text;
}

export default function CompanyDetailView({ companyId }: CompanyDetailViewProps) {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'companies', companyId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setCompany(null);
          setError('Die Firma wurde nicht gefunden.');
          setIsLoading(false);
          return;
        }

        setCompany(snapshot.data() as CompanyData);
        setError('');
        setIsLoading(false);
      },
      (caughtError) => {
        console.error(`Fehler beim Laden der Firma ${companyId}:`, caughtError);
        setError('Die Firmendaten konnten nicht geladen werden.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  const availableDocuments = useMemo(() => {
    if (!company) {
      return [];
    }

    return companyDocumentFields.filter((field) => formatValue(company[field.name]) !== '–');
  }, [company]);

  if (isLoading) {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm leading-6 text-slate-600">
          Firma wird geladen...
        </div>
      </section>
    );
  }

  if (!company) {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-700">
          {error || 'Die Firma wurde nicht gefunden.'}
        </div>
      </section>
    );
  }

  return (
    <div className="admin-page space-y-4">
      <section className="admin-hero rounded-[28px] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,250,240,0.96)_0%,rgba(247,241,231,0.94)_100%)] p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.35)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
          Firma ansehen
        </p>
        <h2 className="mt-2 text-3xl text-slate-950">{formatValue(company.name)}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Hier siehst du die aktuell hinterlegten Stammdaten, Kontaktangaben,
          Steuerinformationen und Dokumentenplätze dieser Firma.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
            href={`/admin/firma/${companyId}/bearbeiten`}
          >
            Bearbeiten
          </Link>
          <Link
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
            href="/admin/firma"
          >
            Zur Firmenübersicht
          </Link>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-3">
        <DetailCard title="Stammdaten">
          <DetailRow label="Firmenname" value={company.name} />
          <DetailRow label="Rechtsform" value={normalizeLegalFormDisplay(company.legalForm)} />
          <DetailRow label="Ansprechpartner" value={company.contactPersonName} />
          <DetailRow
            label="Geschäftsführer"
            value={formatManagingDirectorDisplay(company.managingDirector).replace(/^Geschäftsführer:\s*/, '')}
          />
          <DetailRow label="Steuerberater" value={company.taxAdvisorName} />
          <DetailRow label="Telefon" value={company.phone} />
          <DetailRow label="Kontakt E-Mail" value={company.email} />
          <DetailRow label="Homepage" value={company.website} />
        </DetailCard>

        <DetailCard title="Adresse und Register">
          <DetailRow
            label="Straße"
            value={[formatValue(company.street), formatValue(company.houseNumber)]
              .filter((value) => value !== '–')
              .join(' ')}
          />
          <DetailRow label="PLZ" value={company.postalCode} />
          <DetailRow label="Ort" value={company.city} />
          <DetailRow label="Land" value={company.country} />
          <DetailRow label="Registergericht" value={formatRegisterCourtDisplay(company.registerCourt)} />
          <DetailRow label="HRB" value={formatCommercialRegisterDisplay(company.commercialRegisterNumber)} />
        </DetailCard>

        <DetailCard title="Steuer und Bank">
          <DetailRow label="Steuernummer" value={formatTaxNumberDisplay(company.taxNumber)} />
          <DetailRow label="USt-IdNr." value={formatVatIdDisplay(company.vatId)} />
          <DetailRow
            label="Wirtschafts-Identifikationsnummer"
            value={company.businessId}
          />
          <DetailRow label="Weitere Steuerkennzeichen" value={company.additionalTaxIds} />
          <DetailRow label="Bank" value={company.bankName ?? company.bank} />
          <DetailRow label="IBAN" value={company.iban} />
          <DetailRow label="BIC" value={company.bic} />
        </DetailCard>

        <DetailCard title="Zugänge und Hinweise">
          <DetailRow label="E-Mail-Benutzername" value={company.mailboxUsername} />
          <DetailRow label="E-Mail-Passwort" value={company.mailboxPassword} />
          <DetailRow label="Notizen" value={company.notes} />
        </DetailCard>
      </div>

      <section className="admin-card rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
          Dokumente
        </p>
        <h3 className="mt-2 text-2xl text-slate-950">Downloadbereich</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Bereits hinterlegte Dokumentnamen werden hier gesammelt angezeigt. Die echte
          Dateiablage mit direktem Download wird im nächsten Schritt über Storage
          angebunden.
        </p>

        {availableDocuments.length === 0 ? (
          <div className="mt-4 rounded-[20px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm leading-6 text-slate-600">
            Noch keine Dokumente für diese Firma hinterlegt.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {availableDocuments.map((field) => (
              <article
                className="rounded-[20px] border border-stone-200 bg-stone-50 p-4"
                key={field.name}
              >
                <p className="text-sm font-medium text-slate-900">{field.label}</p>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">
                  {formatValue(company[field.name])}
                </p>
                <div className="mt-3 inline-flex rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs text-slate-600">
                  Download folgt mit Storage-Anbindung
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DetailCard({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="admin-card rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
        {title}
      </p>
      <div className="admin-card-body mt-4 grid gap-2.5">{children}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value?: unknown }) {
  return (
    <div className="admin-detail-row grid grid-cols-1 gap-1 border-b border-stone-100 py-3 text-sm last:border-b-0 md:grid-cols-[120px_minmax(0,1fr)] md:gap-3">
      <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</dt>
      <dd className="admin-detail-value min-w-0 whitespace-normal break-words leading-6 text-slate-900">{formatValue(value)}</dd>
    </div>
  );
}
