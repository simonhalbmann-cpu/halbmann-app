'use client';

import { useMemo, useState } from 'react';
import { DEFAULT_DOCUMENT_CATEGORY, mergeDocumentCategories } from '../../lib/documentCategories';
import DocumentUploadControl from './DocumentUploadControl';

export type PendingCategorizedFile = {
  category: string;
  file: File;
  id: string;
};

type PendingDocumentUploadSectionProps = {
  files: PendingCategorizedFile[];
  onAddFiles: (files: File[], category: string) => void;
  onRemoveFile?: (id: string) => void;
  title: string;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export default function PendingDocumentUploadSection({
  files,
  onAddFiles,
  onRemoveFile,
  title,
}: PendingDocumentUploadSectionProps) {
  const [customCategory, setCustomCategory] = useState('');
  const [localCategories, setLocalCategories] = useState<string[]>([]);
  const [uploadCategory, setUploadCategory] = useState(DEFAULT_DOCUMENT_CATEGORY);

  const categories = useMemo(
    () => mergeDocumentCategories([uploadCategory, ...localCategories, ...files.map((entry) => entry.category)]),
    [files, localCategories, uploadCategory]
  );

  function addCustomCategory() {
    const nextCategory = cleanText(customCategory);
    if (!nextCategory) return;
    setLocalCategories((current) => (current.includes(nextCategory) ? current : [...current, nextCategory]));
    setUploadCategory(nextCategory);
    setCustomCategory('');
  }

  const removableCategories = localCategories.filter(
    (category) => category !== uploadCategory && !files.some((entry) => entry.category === category)
  );

  return (
    <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Dokumente</p>
          <h3 className="mt-1 text-xl text-slate-950">{title}</h3>
        </div>
        <div className="min-w-[min(100%,620px)] flex-1 space-y-3">
          <div className="grid gap-2 md:grid-cols-[minmax(160px,220px)_minmax(0,1fr)_auto]">
            <select
              className="rounded-full border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => setUploadCategory(event.target.value)}
              value={uploadCategory}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <input
              className="rounded-full border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => setCustomCategory(event.target.value)}
              placeholder="Neue Kategorie"
              value={customCategory}
            />
            <button
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
              onClick={addCustomCategory}
              type="button"
            >
              Hinzufuegen
            </button>
          </div>
          <DocumentUploadControl onUpload={(selectedFiles) => onAddFiles(selectedFiles, uploadCategory)} />
          {removableCategories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {removableCategories.map((category) => (
                <button
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-300"
                  key={category}
                  onClick={() => setLocalCategories((current) => current.filter((entry) => entry !== category))}
                  type="button"
                >
                  {category} loeschen
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {files.length > 0 ? (
        <div className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-[18px] border border-stone-200">
          {files.map((entry) => (
            <div
              className="grid gap-3 bg-white px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-center"
              key={entry.id}
            >
              <p className="truncate font-medium text-slate-900">{entry.file.name}</p>
              <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                {entry.category}
              </span>
              {onRemoveFile ? (
                <button
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-300"
                  onClick={() => onRemoveFile(entry.id)}
                  type="button"
                >
                  Entfernen
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-[18px] border border-dashed border-stone-300 bg-stone-50 p-4 text-sm leading-6 text-slate-600">
          Noch keine Dokumente vorgemerkt.
        </div>
      )}
    </section>
  );
}
