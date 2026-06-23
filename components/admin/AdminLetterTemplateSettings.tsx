'use client';

import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useEffect, useState, useTransition } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../lib/firebase';
import { ADMIN_SETTINGS_COLLECTION } from '../../lib/mailboxSettings';
import {
  LETTER_TEMPLATE_SETTINGS_DOC_ID,
  type LetterTemplateSettings,
} from '../../lib/letterTemplateSettings';

type TemplateKind = 'handoverMoveIn' | 'handoverMoveOut' | 'letter';

type TemplateConfig = {
  description: string;
  fileNameKey: keyof LetterTemplateSettings;
  originalNameKey: keyof LetterTemplateSettings;
  sizeKey: keyof LetterTemplateSettings;
  title: string;
  uploadedAtKey: keyof LetterTemplateSettings;
  urlKey: keyof LetterTemplateSettings;
};

const templateConfigs: Record<TemplateKind, TemplateConfig> = {
  letter: {
    description: 'Globale Word-Vorlage für alle Briefe. Firmen-, Empfänger-, Objekt- und Footerdaten werden über Platzhalter gefüllt.',
    fileNameKey: 'letterTemplateFileName',
    originalNameKey: 'letterTemplateOriginalName',
    sizeKey: 'letterTemplateSize',
    title: 'Briefvorlage',
    uploadedAtKey: 'letterTemplateUploadedAt',
    urlKey: 'letterTemplateUrl',
  },
  handoverMoveIn: {
    description: 'Globale Word-Vorlage für Übergabeprotokolle beim Einzug.',
    fileNameKey: 'handoverMoveInTemplateFileName',
    originalNameKey: 'handoverMoveInTemplateOriginalName',
    sizeKey: 'handoverMoveInTemplateSize',
    title: 'Übergabeprotokoll Einzug',
    uploadedAtKey: 'handoverMoveInTemplateUploadedAt',
    urlKey: 'handoverMoveInTemplateUrl',
  },
  handoverMoveOut: {
    description: 'Globale Word-Vorlage für Übergabeprotokolle beim Auszug.',
    fileNameKey: 'handoverMoveOutTemplateFileName',
    originalNameKey: 'handoverMoveOutTemplateOriginalName',
    sizeKey: 'handoverMoveOutTemplateSize',
    title: 'Übergabeprotokoll Auszug',
    uploadedAtKey: 'handoverMoveOutTemplateUploadedAt',
    urlKey: 'handoverMoveOutTemplateUrl',
  },
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

export default function AdminLetterTemplateSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<LetterTemplateSettings>({});
  const [files, setFiles] = useState<Record<TemplateKind, File | null>>({
    handoverMoveIn: null,
    handoverMoveOut: null,
    letter: null,
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, ADMIN_SETTINGS_COLLECTION, LETTER_TEMPLATE_SETTINGS_DOC_ID),
      (snapshot) => {
        setSettings((snapshot.data() ?? {}) as LetterTemplateSettings);
      },
      (caughtError) => {
        console.error('Fehler beim Laden der globalen Briefvorlagen:', caughtError);
        setError('Die globalen Briefvorlagen konnten nicht geladen werden.');
      }
    );
    return () => unsubscribe();
  }, []);

  function updateFile(kind: TemplateKind, file: File | null) {
    setFiles((current) => ({ ...current, [kind]: file }));
  }

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

  function uploadTemplate(kind: TemplateKind) {
    const file = files[kind];
    if (!file) {
      setError('Bitte eine Word-Vorlage auswählen.');
      return;
    }

    setMessage('');
    setError('');
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('templateType', kind);
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
          throw new Error(result.error || 'letter_template_upload_failed');
        }

        const config = templateConfigs[kind];
        await setDoc(
          doc(db, ADMIN_SETTINGS_COLLECTION, LETTER_TEMPLATE_SETTINGS_DOC_ID),
          {
            [config.fileNameKey]: cleanText(result.fileName),
            [config.originalNameKey]: cleanText(result.originalName) || file.name,
            [config.sizeKey]: Number(result.size) || file.size,
            [config.uploadedAtKey]: cleanText(result.uploadedAt) || new Date().toISOString(),
            [config.urlKey]: result.url,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        updateFile(kind, null);
        setMessage(`${config.title} wurde gespeichert.`);
      } catch (caughtError) {
        console.error('Fehler beim Speichern der Vorlage:', caughtError);
        setError(caughtError instanceof Error ? caughtError.message : 'Die Vorlage konnte nicht gespeichert werden.');
      }
    });
  }

  function clearTemplate(kind: TemplateKind) {
    const config = templateConfigs[kind];
    setMessage('');
    setError('');
    startTransition(async () => {
      try {
        await setDoc(
          doc(db, ADMIN_SETTINGS_COLLECTION, LETTER_TEMPLATE_SETTINGS_DOC_ID),
          {
            [config.fileNameKey]: '',
            [config.originalNameKey]: '',
            [config.sizeKey]: 0,
            [config.uploadedAtKey]: '',
            [config.urlKey]: '',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        updateFile(kind, null);
        setMessage(`${config.title} wurde entfernt.`);
      } catch (caughtError) {
        console.error('Fehler beim Entfernen der Vorlage:', caughtError);
        setError(caughtError instanceof Error ? caughtError.message : 'Die Vorlage konnte nicht entfernt werden.');
      }
    });
  }

  function renderTemplateCard(kind: TemplateKind) {
    const config = templateConfigs[kind];
    const templateUrl = cleanText(settings[config.urlKey]);
    const originalName = cleanText(settings[config.originalNameKey]);
    const fileName = cleanText(settings[config.fileNameKey]);

    return (
      <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-5" key={kind}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-amber-700/80">Global</p>
            <h3 className="mt-1 text-xl text-slate-950">{config.title}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{config.description}</p>
          </div>
          {templateUrl ? (
            <a
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400"
              href={templateUrl}
            >
              Vorlage öffnen
            </a>
          ) : null}
        </div>

        <div className="mt-5 rounded-[20px] border border-stone-200 bg-white px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Aktuelle Vorlage</p>
          {templateUrl ? (
            <div className="mt-2 text-sm leading-7 text-slate-700">
              <p className="font-medium text-slate-950">{originalName || fileName}</p>
              <p>
                {[formatFileSize(settings[config.sizeKey]), formatDate(settings[config.uploadedAtKey])]
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
            onChange={(event) => updateFile(kind, event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-5 py-2.5 text-sm font-medium text-stone-100 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending || !files[kind]}
            onClick={() => uploadTemplate(kind)}
            type="button"
          >
            Vorlage speichern
          </button>
          <button
            className="rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending || !templateUrl}
            onClick={() => clearTemplate(kind)}
            type="button"
          >
            Vorlage entfernen
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-[32px] border border-stone-200 bg-white p-6 shadow-[0_28px_70px_-42px_rgba(148,119,77,0.28)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Vorlagen</p>
      <h2 className="mt-2 text-3xl text-slate-950">Globale Word-Vorlagen</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
        Eine Vorlage gilt für alle Firmen. Inhalte wie Firma, Logo, Adresse, Empfänger, Objekt und Footer werden über Platzhalter befüllt.
      </p>

      <div className="mt-6 space-y-5">
        {renderTemplateCard('letter')}
        <div className="grid gap-5 xl:grid-cols-2">
          {renderTemplateCard('handoverMoveIn')}
          {renderTemplateCard('handoverMoveOut')}
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
