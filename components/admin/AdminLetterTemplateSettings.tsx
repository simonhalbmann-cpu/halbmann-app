'use client';

import { collection, doc, onSnapshot, query, updateDoc, type DocumentData } from 'firebase/firestore';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../lib/firebase';

type CompanyRecord = {
  data: DocumentData;
  id: string;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function formatDate(value: unknown) {
  const raw = cleanText(value);
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
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function buildCompanyName(company: CompanyRecord) {
  return cleanText(company.data.name) || cleanText(company.data.companyName) || 'Firma ohne Namen';
}

export default function AdminLetterTemplateSettings() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [moveInProtocolFile, setMoveInProtocolFile] = useState<File | null>(null);
  const [moveOutProtocolFile, setMoveOutProtocolFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'companies')),
      (snapshot) => {
        const nextCompanies = snapshot.docs
          .map((entry) => ({ data: entry.data(), id: entry.id }))
          .sort((left, right) => buildCompanyName(left).localeCompare(buildCompanyName(right), 'de-DE'));
        setCompanies(nextCompanies);
        setSelectedCompanyId((current) => current || nextCompanies[0]?.id || '');
      },
      (caughtError) => {
        console.error('Fehler beim Laden der Firmen:', caughtError);
        setError('Die Firmen konnten nicht geladen werden.');
      }
    );
    return () => unsubscribe();
  }, []);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  async function authorizedUpload(formData: FormData) {
    if (!user) throw new Error('Du bist nicht angemeldet.');
    const token = await user.getIdToken();
    return fetch('/api/admin/letter-templates', {
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      method: 'POST',
    });
  }

  function uploadTemplate() {
    if (!selectedCompany) {
      setError('Bitte eine Firma auswählen.');
      return;
    }
    if (!selectedFile) {
      setError('Bitte eine Word-Vorlage auswählen.');
      return;
    }

    setMessage('');
    setError('');
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('companyId', selectedCompany.id);
        formData.append('file', selectedFile);

        const response = await authorizedUpload(formData);
        const result = (await response.json()) as {
          error?: string;
          fileName?: string;
          ok?: boolean;
          originalName?: string;
          size?: number;
          uploadedAt?: string;
          url?: string;
        };
        if (!response.ok || !result.ok || !result.url) {
          throw new Error(result.error || 'letter_template_upload_failed');
        }

        await updateDoc(doc(db, 'companies', selectedCompany.id), {
          letterTemplateFileName: cleanText(result.fileName),
          letterTemplateOriginalName: cleanText(result.originalName) || selectedFile.name,
          letterTemplateSize: Number(result.size) || selectedFile.size,
          letterTemplateUploadedAt: cleanText(result.uploadedAt) || new Date().toISOString(),
          letterTemplateUrl: result.url,
        });

        setSelectedFile(null);
        setMessage('Briefvorlage wurde gespeichert.');
      } catch (caughtError) {
        console.error('Fehler beim Speichern der Briefvorlage:', caughtError);
        setError(caughtError instanceof Error ? caughtError.message : 'Die Briefvorlage konnte nicht gespeichert werden.');
      }
    });
  }

  function clearTemplate() {
    if (!selectedCompany) return;
    setMessage('');
    setError('');
    startTransition(async () => {
      try {
        await updateDoc(doc(db, 'companies', selectedCompany.id), {
          letterTemplateFileName: '',
          letterTemplateOriginalName: '',
          letterTemplateSize: 0,
          letterTemplateUploadedAt: '',
          letterTemplateUrl: '',
        });
        setSelectedFile(null);
        setMessage('Briefvorlage wurde entfernt.');
      } catch (caughtError) {
        console.error('Fehler beim Entfernen der Briefvorlage:', caughtError);
        setError(caughtError instanceof Error ? caughtError.message : 'Die Briefvorlage konnte nicht entfernt werden.');
      }
    });
  }

  function uploadHandoverTemplate(kind: 'moveIn' | 'moveOut') {
    if (!selectedCompany) {
      setError('Bitte eine Firma auswaehlen.');
      return;
    }
    const file = kind === 'moveIn' ? moveInProtocolFile : moveOutProtocolFile;
    if (!file) {
      setError('Bitte eine Word-Vorlage auswaehlen.');
      return;
    }

    setMessage('');
    setError('');
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('companyId', selectedCompany.id);
        formData.append('file', file);

        const response = await authorizedUpload(formData);
        const result = (await response.json()) as {
          error?: string;
          fileName?: string;
          ok?: boolean;
          originalName?: string;
          size?: number;
          uploadedAt?: string;
          url?: string;
        };
        if (!response.ok || !result.ok || !result.url) {
          throw new Error(result.error || 'handover_template_upload_failed');
        }

        const prefix = kind === 'moveIn' ? 'handoverMoveInTemplate' : 'handoverMoveOutTemplate';
        await updateDoc(doc(db, 'companies', selectedCompany.id), {
          [`${prefix}FileName`]: cleanText(result.fileName),
          [`${prefix}OriginalName`]: cleanText(result.originalName) || file.name,
          [`${prefix}Size`]: Number(result.size) || file.size,
          [`${prefix}UploadedAt`]: cleanText(result.uploadedAt) || new Date().toISOString(),
          [`${prefix}Url`]: result.url,
        });

        if (kind === 'moveIn') setMoveInProtocolFile(null);
        if (kind === 'moveOut') setMoveOutProtocolFile(null);
        setMessage(kind === 'moveIn' ? 'Uebergabeprotokoll Einzug wurde gespeichert.' : 'Uebergabeprotokoll Auszug wurde gespeichert.');
      } catch (caughtError) {
        console.error('Fehler beim Speichern der Uebergabeprotokoll-Vorlage:', caughtError);
        setError(caughtError instanceof Error ? caughtError.message : 'Die Vorlage konnte nicht gespeichert werden.');
      }
    });
  }

  function clearHandoverTemplate(kind: 'moveIn' | 'moveOut') {
    if (!selectedCompany) return;
    setMessage('');
    setError('');
    startTransition(async () => {
      try {
        const prefix = kind === 'moveIn' ? 'handoverMoveInTemplate' : 'handoverMoveOutTemplate';
        await updateDoc(doc(db, 'companies', selectedCompany.id), {
          [`${prefix}FileName`]: '',
          [`${prefix}OriginalName`]: '',
          [`${prefix}Size`]: 0,
          [`${prefix}UploadedAt`]: '',
          [`${prefix}Url`]: '',
        });
        if (kind === 'moveIn') setMoveInProtocolFile(null);
        if (kind === 'moveOut') setMoveOutProtocolFile(null);
        setMessage('Vorlage wurde entfernt.');
      } catch (caughtError) {
        console.error('Fehler beim Entfernen der Uebergabeprotokoll-Vorlage:', caughtError);
        setError(caughtError instanceof Error ? caughtError.message : 'Die Vorlage konnte nicht entfernt werden.');
      }
    });
  }

  return (
    <section className="rounded-[32px] border border-stone-200 bg-white p-6 shadow-[0_28px_70px_-42px_rgba(148,119,77,0.28)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Vorlagen</p>
      <h2 className="mt-2 text-3xl text-slate-950">Vorlagen je Firma</h2>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
        <aside className="rounded-[24px] border border-stone-200 bg-stone-50 p-3">
          <div className="space-y-2">
            {companies.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-stone-300 bg-white px-4 py-6 text-sm text-slate-600">
                Keine Firmen vorhanden.
              </div>
            ) : (
              companies.map((company) => {
                const active = company.id === selectedCompanyId;
                const hasTemplate = Boolean(cleanText(company.data.letterTemplateUrl));
                return (
                  <button
                    className={`w-full rounded-[18px] border px-4 py-3 text-left transition ${
                      active
                        ? 'border-amber-300 bg-amber-50 text-slate-950 ring-2 ring-amber-100'
                        : 'border-stone-200 bg-white text-slate-700 hover:border-stone-300'
                    }`}
                    key={company.id}
                    onClick={() => {
                      setSelectedCompanyId(company.id);
                      setSelectedFile(null);
                    }}
                    type="button"
                  >
                    <span className="block truncate text-sm font-medium">{buildCompanyName(company)}</span>
                    <span className="mt-1 block text-[11px] text-slate-500">
                      {hasTemplate ? 'Vorlage hinterlegt' : 'Keine Vorlage'}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <div className="rounded-[24px] border border-stone-200 bg-white p-5">
          {selectedCompany ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Firma</p>
                  <h3 className="mt-1 text-xl text-slate-950">{buildCompanyName(selectedCompany)}</h3>
                </div>
                {cleanText(selectedCompany.data.letterTemplateUrl) ? (
                  <a
                    className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400"
                    href={cleanText(selectedCompany.data.letterTemplateUrl)}
                  >
                    Vorlage öffnen
                  </a>
                ) : null}
              </div>

              <div className="mt-5 rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Aktuelle Vorlage</p>
                {cleanText(selectedCompany.data.letterTemplateUrl) ? (
                  <div className="mt-2 text-sm leading-7 text-slate-700">
                    <p className="font-medium text-slate-950">
                      {cleanText(selectedCompany.data.letterTemplateOriginalName) ||
                        cleanText(selectedCompany.data.letterTemplateFileName)}
                    </p>
                    <p>
                      {[formatFileSize(selectedCompany.data.letterTemplateSize), formatDate(selectedCompany.data.letterTemplateUploadedAt)]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">Noch keine Vorlage hinterlegt.</p>
                )}
              </div>

              <label className="mt-5 block">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Word-Datei</p>
                <input
                  accept=".doc,.docx,.dot,.dotx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="mt-2 block w-full rounded-[20px] border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-stone-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 focus:border-amber-700/60"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  type="file"
                />
              </label>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className="rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-5 py-2.5 text-sm font-medium text-stone-100 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPending || !selectedFile}
                  onClick={uploadTemplate}
                  type="button"
                >
                  Vorlage speichern
                </button>
                <button
                  className="rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPending || !cleanText(selectedCompany.data.letterTemplateUrl)}
                  onClick={clearTemplate}
                  type="button"
                >
                  Vorlage entfernen
                </button>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                <div className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Uebergabeprotokoll Einzug</p>
                  {cleanText(selectedCompany.data.handoverMoveInTemplateUrl) ? (
                    <a className="mt-2 block truncate text-sm font-medium text-slate-950 underline-offset-4 hover:underline" href={cleanText(selectedCompany.data.handoverMoveInTemplateUrl)}>
                      {cleanText(selectedCompany.data.handoverMoveInTemplateOriginalName) || cleanText(selectedCompany.data.handoverMoveInTemplateFileName)}
                    </a>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600">Noch keine Vorlage hinterlegt.</p>
                  )}
                  <input
                    accept=".doc,.docx,.dot,.dotx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="mt-3 block w-full rounded-[18px] border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition file:mr-3 file:rounded-full file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 focus:border-amber-700/60"
                    onChange={(event) => setMoveInProtocolFile(event.target.files?.[0] ?? null)}
                    type="file"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-60" disabled={isPending || !moveInProtocolFile} onClick={() => uploadHandoverTemplate('moveIn')} type="button">
                      Speichern
                    </button>
                    <button className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-60" disabled={isPending || !cleanText(selectedCompany.data.handoverMoveInTemplateUrl)} onClick={() => clearHandoverTemplate('moveIn')} type="button">
                      Entfernen
                    </button>
                  </div>
                </div>

                <div className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Uebergabeprotokoll Auszug</p>
                  {cleanText(selectedCompany.data.handoverMoveOutTemplateUrl) ? (
                    <a className="mt-2 block truncate text-sm font-medium text-slate-950 underline-offset-4 hover:underline" href={cleanText(selectedCompany.data.handoverMoveOutTemplateUrl)}>
                      {cleanText(selectedCompany.data.handoverMoveOutTemplateOriginalName) || cleanText(selectedCompany.data.handoverMoveOutTemplateFileName)}
                    </a>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600">Noch keine Vorlage hinterlegt.</p>
                  )}
                  <input
                    accept=".doc,.docx,.dot,.dotx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="mt-3 block w-full rounded-[18px] border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition file:mr-3 file:rounded-full file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 focus:border-amber-700/60"
                    onChange={(event) => setMoveOutProtocolFile(event.target.files?.[0] ?? null)}
                    type="file"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-60" disabled={isPending || !moveOutProtocolFile} onClick={() => uploadHandoverTemplate('moveOut')} type="button">
                      Speichern
                    </button>
                    <button className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-60" disabled={isPending || !cleanText(selectedCompany.data.handoverMoveOutTemplateUrl)} onClick={() => clearHandoverTemplate('moveOut')} type="button">
                      Entfernen
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-sm text-slate-600">
              Bitte zuerst eine Firma anlegen.
            </div>
          )}
        </div>
      </div>

      {message ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
    </section>
  );
}
