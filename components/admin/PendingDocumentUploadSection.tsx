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

function DotsIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M12 6h.01" />
      <path d="M12 12h.01" />
      <path d="M12 18h.01" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" viewBox="0 0 24 24">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}

function FileUploadIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M12 18v-6" />
      <path d="M9 15l3-3 3 3" />
    </svg>
  );
}

export default function PendingDocumentUploadSection({
  files,
  onAddFiles,
  onRemoveFile,
  title,
}: PendingDocumentUploadSectionProps) {
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [localCategories, setLocalCategories] = useState<string[]>([]);
  const [selectTrigger, setSelectTrigger] = useState(0);
  const [uploadCategory, setUploadCategory] = useState('');

  const categories = useMemo(
    () => mergeDocumentCategories([uploadCategory, ...localCategories, ...files.map((entry) => entry.category)]),
    [files, localCategories, uploadCategory]
  );

  const selectedUploadCategory = cleanText(uploadCategory);
  const showCustomCategoryField = selectedUploadCategory === DEFAULT_DOCUMENT_CATEGORY;

  function addCustomCategory() {
    const nextCategory = cleanText(customCategory);
    if (!nextCategory) return;
    setLocalCategories((current) => (current.includes(nextCategory) ? current : [...current, nextCategory]));
    setUploadCategory(nextCategory);
    setCustomCategory('');
    setActionMenuOpen(false);
  }

  function removeSelectedCategory() {
    const category = cleanText(uploadCategory);
    if (!category || category === DEFAULT_DOCUMENT_CATEGORY) return;
    setLocalCategories((current) => current.filter((entry) => entry !== category));
    setUploadCategory('');
    setActionMenuOpen(false);
  }

  return (
    <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Dokumente</p>
          <h3 className="mt-1 text-xl text-slate-950">{title}</h3>
        </div>
        <div className="min-w-[min(100%,620px)] flex-1 space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2">
            <select
              className="rounded-full border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => {
                const nextCategory = event.target.value;
                setUploadCategory(nextCategory);
                if (nextCategory !== DEFAULT_DOCUMENT_CATEGORY) setCustomCategory('');
              }}
              value={uploadCategory}
            >
              <option disabled value="">
                Kategorie waehlen
              </option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <div className="relative">
              <button
                aria-expanded={actionMenuOpen}
                aria-label="Dokumentaktionen"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 bg-white text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
                onClick={() => setActionMenuOpen((current) => !current)}
                type="button"
              >
                <DotsIcon />
              </button>
              {actionMenuOpen ? (
                <div className="absolute right-0 z-30 mt-2 flex gap-1 rounded-full border border-stone-200 bg-white p-1 shadow-[0_18px_48px_-30px_rgba(0,0,0,0.35)]">
                  <button
                    aria-label="Kategorie hinzufuegen"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-35"
                    disabled={!showCustomCategoryField || !cleanText(customCategory)}
                    onClick={addCustomCategory}
                    title="Kategorie hinzufuegen"
                    type="button"
                  >
                    <PlusIcon />
                  </button>
                  <button
                    aria-label="Kategorie loeschen"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-35"
                    disabled={!selectedUploadCategory || selectedUploadCategory === DEFAULT_DOCUMENT_CATEGORY}
                    onClick={removeSelectedCategory}
                    title="Kategorie loeschen"
                    type="button"
                  >
                    <TrashIcon />
                  </button>
                  <button
                    aria-label="Datei auswaehlen"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-35"
                    disabled={!selectedUploadCategory}
                    onClick={() => {
                      setSelectTrigger((current) => current + 1);
                      setActionMenuOpen(false);
                    }}
                    title="Datei auswaehlen"
                    type="button"
                  >
                    <FileUploadIcon />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          {showCustomCategoryField ? (
            <input
              className="w-full rounded-full border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => setCustomCategory(event.target.value)}
              placeholder="Neue Kategorie"
              value={customCategory}
            />
          ) : null}
          <DocumentUploadControl
            disabled={!selectedUploadCategory}
            hideSelectButton
            onUpload={(selectedFiles) => onAddFiles(selectedFiles, uploadCategory)}
            selectTrigger={selectTrigger}
          />
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
