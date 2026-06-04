'use client';

import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db, storage } from '../../lib/firebase';
import {
  cleanStoredDocuments,
  sanitizeStorageFileName,
  type StoredDocumentEntry,
} from '../../lib/tenantDocuments';
import DocumentUploadControl from './DocumentUploadControl';
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

function formatDate(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatFileSize(value: unknown) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export default function CompanyDetailView({ companyId }: CompanyDetailViewProps) {
  const { user } = useAuth();
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [deletingDocumentPath, setDeletingDocumentPath] = useState('');

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

  const companyDocuments = useMemo(() => cleanStoredDocuments(company?.companyDocuments), [company]);

  async function uploadCompanyDocuments(files: FileList | File[] | null) {
    if (!files || files.length === 0 || !company) return;

    setError('');
    setMessage('');
    setIsUploadingDocument(true);

    try {
      const uploadedDocuments: StoredDocumentEntry[] = [];

      for (const file of Array.from(files)) {
        const safeName = sanitizeStorageFileName(file.name);
        const storagePath = `company-documents/${companyId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file, {
          contentType: file.type || 'application/octet-stream',
        });

        uploadedDocuments.push({
          contentType: file.type || 'application/octet-stream',
          name: file.name,
          path: storagePath,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          uploadedByEmail: user?.email ?? '',
          url: await getDownloadURL(storageRef),
        });
      }

      await updateDoc(doc(db, 'companies', companyId), {
        companyDocuments: [...companyDocuments, ...uploadedDocuments],
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });

      setMessage(uploadedDocuments.length === 1 ? 'Dokument wurde hochgeladen.' : 'Dokumente wurden hochgeladen.');
    } catch (caughtError) {
      console.error(`Fehler beim Hochladen von Dokumenten fuer Firma ${companyId}:`, caughtError);
      setError('Dokumente konnten nicht hochgeladen werden.');
    } finally {
      setIsUploadingDocument(false);
    }
  }

  async function deleteCompanyDocument(targetDocument: StoredDocumentEntry) {
    const confirmed = window.confirm(`Dokument "${targetDocument.name}" wirklich löschen?`);
    if (!confirmed) return;

    setError('');
    setMessage('');
    setDeletingDocumentPath(targetDocument.path || targetDocument.url);

    try {
      if (targetDocument.path) {
        await deleteObject(ref(storage, targetDocument.path));
      }

      await updateDoc(doc(db, 'companies', companyId), {
        companyDocuments: companyDocuments.filter(
          (document) =>
            (targetDocument.path && document.path !== targetDocument.path) ||
            (!targetDocument.path && document.url !== targetDocument.url)
        ),
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });

      setMessage('Dokument wurde gelöscht.');
    } catch (caughtError) {
      console.error(`Fehler beim Loeschen eines Dokuments fuer Firma ${companyId}:`, caughtError);
      setError('Dokument konnte nicht gelöscht werden.');
    } finally {
      setDeletingDocumentPath('');
    }
  }

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
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
              Dokumente
            </p>
            <h3 className="mt-1 text-xl text-slate-950">Firmendateien</h3>
          </div>
          <div className="min-w-[min(100%,560px)] flex-1">
            <DocumentUploadControl
              disabled={isUploadingDocument}
              onUpload={(files) => uploadCompanyDocuments(files)}
            />
          </div>
          <label className="hidden">
            {isUploadingDocument ? 'Lädt hoch...' : 'Dokument hochladen'}
            <input
              className="hidden"
              disabled={isUploadingDocument}
              multiple
              onChange={(event) => {
                void uploadCompanyDocuments(event.target.files);
                event.target.value = '';
              }}
              type="file"
            />
          </label>
        </div>

        {companyDocuments.length > 0 ? (
          <div className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-[18px] border border-stone-200">
            {companyDocuments.map((companyDocument) => {
              const isDeleting = deletingDocumentPath === (companyDocument.path || companyDocument.url);
              const meta = [formatFileSize(companyDocument.size), formatDate(companyDocument.uploadedAt)]
                .filter(Boolean)
                .join(' · ');

              return (
                <div
                  className="grid gap-3 bg-white px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                  key={`${companyDocument.path}-${companyDocument.url}`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{companyDocument.name}</p>
                    {meta ? <p className="mt-0.5 text-xs text-slate-500">{meta}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
                      href={companyDocument.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Anschauen
                    </a>
                    <button
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isDeleting}
                      onClick={() => void deleteCompanyDocument(companyDocument)}
                      type="button"
                    >
                      {isDeleting ? 'Löscht...' : 'Löschen'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-[18px] border border-dashed border-stone-300 bg-stone-50 p-4 text-sm leading-6 text-slate-600">
            Noch keine Dokumente hochgeladen.
          </div>
        )}
      </section>

      <section className="hidden">
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
