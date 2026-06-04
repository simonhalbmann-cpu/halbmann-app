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
  const [customCategory, setCustomCategory] = useState('');
  const [search, setSearch] = useState('');
  const [uploadCategory, setUploadCategory] = useState(DEFAULT_DOCUMENT_CATEGORY);
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
  const removableCategories = useMemo(
    () =>
      localCategories.filter(
        (category) =>
          category !== uploadCategory &&
          !documents.some((document) => (cleanText(document.category) || DEFAULT_DOCUMENT_CATEGORY) === category) &&
          !legacyDocuments.some((document) => (cleanText(document.category) || DEFAULT_DOCUMENT_CATEGORY) === category)
      ),
    [documents, legacyDocuments, localCategories, uploadCategory]
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

  function addCustomCategory() {
    const nextCategory = cleanText(customCategory);
    if (!nextCategory) return;
    setLocalCategories((current) => (current.includes(nextCategory) ? current : [...current, nextCategory]));
    setUploadCategory(nextCategory);
    setActiveCategory(nextCategory);
    setCustomCategory('');
  }

  useEffect(() => {
    if (activeCategory !== 'Alle' && !usedCategories.includes(activeCategory)) {
      setActiveCategory('Alle');
    }
  }, [activeCategory, usedCategories]);

  function removeCustomCategory(category: string) {
    setLocalCategories((current) => current.filter((entry) => entry !== category));
    if (activeCategory === category) setActiveCategory('Alle');
    if (uploadCategory === category) setUploadCategory(DEFAULT_DOCUMENT_CATEGORY);
  }

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
          <DocumentUploadControl
            disabled={isUploading}
            onUpload={(files) => onUpload(files, uploadCategory)}
          />
          {removableCategories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {removableCategories.map((category) => (
                <button
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-300"
                  key={category}
                  onClick={() => removeCustomCategory(category)}
                  type="button"
                >
                  {category} loeschen
                </button>
              ))}
            </div>
          ) : null}
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
        <div className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-[18px] border border-stone-200">
          {filteredDocuments.map((document) => {
            const meta = [cleanText(document.source) === 'mail' ? 'Mailanhang' : 'Upload', formatFileSize(document.size), formatUploadDate(document.uploadedAt)]
              .filter(Boolean)
              .join(' · ');

            return (
              <div
                className="grid gap-3 bg-white px-4 py-3 text-sm xl:grid-cols-[minmax(0,1fr)_220px_auto] xl:items-center"
                key={documentKey(document)}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{document.name}</p>
                  {meta ? <p className="mt-0.5 text-xs text-slate-500">{meta}</p> : null}
                </div>
                <select
                  className="rounded-full border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-amber-700/60"
                  onChange={(event) => void onUpdateCategory(document, event.target.value)}
                  value={cleanText(document.category) || DEFAULT_DOCUMENT_CATEGORY}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <a
                    className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
                    href={document.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Oeffnen
                  </a>
                  <button
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-300"
                    onClick={() => void onDelete(document)}
                    type="button"
                  >
                    Loeschen
                  </button>
                </div>
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
