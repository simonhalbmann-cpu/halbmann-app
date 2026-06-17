'use client';

import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_DOCUMENT_CATEGORY, mergeDocumentCategories } from '../../lib/documentCategories';
import type { StoredDocumentEntry } from '../../lib/tenantDocuments';
import DocumentUploadControl from './DocumentUploadControl';

type LegacyDocumentEntry = {
  category?: string;
  fieldName: string;
  label: string;
  name: string;
};

type DocumentLibrarySectionProps = {
  documents: StoredDocumentEntry[];
  emptyText?: string;
  isUploading?: boolean;
  legacyDocuments?: LegacyDocumentEntry[];
  onDelete: (document: StoredDocumentEntry) => Promise<void> | void;
  onDeleteLegacy?: (fieldName: string, name: string) => Promise<void> | void;
  onUpdateCategory: (document: StoredDocumentEntry, category: string) => Promise<void> | void;
  onUpload: (files: File[], category: string) => Promise<void> | void;
  title?: string;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function formatFileSize(value: unknown) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatUploadDate(value: unknown) {
  const raw = cleanText(value);
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function documentKey(document: StoredDocumentEntry) {
  return cleanText(document.path) || cleanText(document.url) || cleanText(document.name);
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

export default function DocumentLibrarySection({
  documents,
  emptyText = 'Noch keine Dokumente hochgeladen.',
  isUploading = false,
  legacyDocuments = [],
  onDelete,
  onDeleteLegacy,
  onUpdateCategory,
  onUpload,
  title = 'Dokumente',
}: DocumentLibrarySectionProps) {
  const [activeCategory, setActiveCategory] = useState('Alle');
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [search, setSearch] = useState('');
  const [selectTrigger, setSelectTrigger] = useState(0);
  const [uploadCategory, setUploadCategory] = useState('');
  const [localCategories, setLocalCategories] = useState<string[]>([]);

  const categories = useMemo(
    () =>
      mergeDocumentCategories([
        uploadCategory,
        ...localCategories,
        ...documents.map((document) => document.category),
        ...legacyDocuments.map((document) => document.category),
      ]),
    [documents, legacyDocuments, localCategories, uploadCategory]
  );

  const usedCategories = useMemo(
    () =>
      mergeDocumentCategories([
        ...documents.map((document) => document.category),
        ...legacyDocuments.map((document) => document.category),
      ]).filter((category) =>
        [...documents, ...legacyDocuments].some((document) => (cleanText(document.category) || DEFAULT_DOCUMENT_CATEGORY) === category)
      ),
    [documents, legacyDocuments]
  );

  const filteredDocuments = useMemo(() => {
    const needle = search.toLowerCase();
    return documents.filter((document) => {
      const category = cleanText(document.category) || DEFAULT_DOCUMENT_CATEGORY;
      const matchesCategory = activeCategory === 'Alle' || category === activeCategory;
      const matchesSearch =
        !needle ||
        [document.name, document.category, document.source, document.contentType]
          .map((value) => cleanText(value).toLowerCase())
          .join(' ')
          .includes(needle);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, documents, search]);

  const selectedUploadCategory = cleanText(uploadCategory);
  const showCustomCategoryField = selectedUploadCategory === DEFAULT_DOCUMENT_CATEGORY;

  function addCustomCategory() {
    const nextCategory = cleanText(customCategory);
    if (!nextCategory) return;
    setLocalCategories((current) => (current.includes(nextCategory) ? current : [...current, nextCategory]));
    setUploadCategory(nextCategory);
    setActiveCategory(nextCategory);
    setCustomCategory('');
    setActionMenuOpen(false);
  }

  useEffect(() => {
    if (activeCategory !== 'Alle' && !usedCategories.includes(activeCategory)) {
      setActiveCategory('Alle');
    }
  }, [activeCategory, usedCategories]);

  async function removeSelectedCategory() {
    const category = cleanText(uploadCategory);
    if (!category || category === DEFAULT_DOCUMENT_CATEGORY) return;

    const affectedDocuments = documents.filter(
      (document) => (cleanText(document.category) || DEFAULT_DOCUMENT_CATEGORY) === category
    );
    await Promise.all(affectedDocuments.map((document) => onUpdateCategory(document, DEFAULT_DOCUMENT_CATEGORY)));
    setLocalCategories((current) => current.filter((entry) => entry !== category));
    if (activeCategory === category) setActiveCategory('Alle');
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
                    onClick={() => void removeSelectedCategory()}
                    title="Kategorie loeschen"
                    type="button"
                  >
                    <TrashIcon />
                  </button>
                  <button
                    aria-label="Datei auswaehlen"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-35"
                    disabled={!selectedUploadCategory || isUploading}
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
            disabled={isUploading || !selectedUploadCategory}
            hideSelectButton
            onUpload={(files) => onUpload(files, uploadCategory)}
            selectTrigger={selectTrigger}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <input
          className="rounded-full border border-stone-300 bg-stone-50 px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Dokumente suchen"
          value={search}
        />
        <select
          className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
          onChange={(event) => setActiveCategory(event.target.value)}
          value={activeCategory}
        >
          <option value="Alle">Alle Kategorien</option>
          {usedCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {filteredDocuments.length > 0 ? (
        <div className="mt-4 divide-y divide-stone-200 border-y border-stone-200">
          {filteredDocuments.map((document) => {
            const meta = [cleanText(document.source) === 'mail' ? 'Mailanhang' : 'Upload', formatFileSize(document.size), formatUploadDate(document.uploadedAt)]
              .filter(Boolean)
              .join(' - ');

            return (
              <div
                className="grid min-h-10 gap-2 bg-white px-1 py-1.5 text-sm md:grid-cols-[minmax(160px,1fr)_minmax(120px,0.75fr)_150px_34px] md:items-center"
                key={documentKey(document)}
              >
                <a
                  className="min-w-0 truncate font-medium text-slate-900 underline-offset-2 transition hover:text-amber-800 hover:underline"
                  href={document.url}
                  rel="noreferrer"
                  target="_blank"
                  title={document.name}
                >
                  {document.name}
                </a>
                <p className="min-w-0 truncate text-xs text-slate-500">{meta}</p>
                <select
                  className="h-8 w-full rounded-none border border-stone-300 bg-stone-50 px-2 text-xs text-slate-900 outline-none transition focus:border-amber-700/60"
                  onChange={(event) => void onUpdateCategory(document, event.target.value)}
                  value={cleanText(document.category) || DEFAULT_DOCUMENT_CATEGORY}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <button
                  aria-label={`${document.name} loeschen`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-none border border-rose-200 bg-rose-50 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                  onClick={() => void onDelete(document)}
                  title="Loeschen"
                  type="button"
                >
                  <TrashIcon />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-[18px] border border-dashed border-stone-300 bg-stone-50 p-4 text-sm leading-6 text-slate-600">
          {emptyText}
        </div>
      )}

      {legacyDocuments.length > 0 ? (
        <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-amber-700/80">
            Alte Dateinamen ohne Upload
          </p>
          <div className="mt-2 grid gap-2 text-sm text-slate-700">
            {legacyDocuments.map((legacyDocument) => (
              <div
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-white/70 px-3 py-2"
                key={`${legacyDocument.fieldName}-${legacyDocument.name}`}
              >
                <p>
                  {legacyDocument.label}: {legacyDocument.name}
                </p>
                {onDeleteLegacy ? (
                  <button
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-300"
                    onClick={() => void onDeleteLegacy(legacyDocument.fieldName, legacyDocument.name)}
                    type="button"
                  >
                    Loeschen
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
