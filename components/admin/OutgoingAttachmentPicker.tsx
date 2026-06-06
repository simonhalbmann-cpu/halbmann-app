'use client';

import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_DOCUMENT_CATEGORY } from '../../lib/documentCategories';
import { db } from '../../lib/firebase';
import { cleanStoredDocuments, type StoredDocumentEntry } from '../../lib/tenantDocuments';

export type ExistingOutgoingAttachment = {
  contentType: string;
  name: string;
  path: string;
  size: number;
  uploadedAt: string;
  url: string;
};

export type PendingOutgoingAttachment = {
  existing?: ExistingOutgoingAttachment;
  file?: File;
  id: string;
};

type AppDocumentOption = {
  category: string;
  document: StoredDocumentEntry;
  id: string;
  ownerLabel: string;
  ownerType: 'company' | 'contact' | 'property' | 'tenant' | 'unit';
};

type SnapshotRecord = {
  data: Record<string, unknown>;
  id: string;
};

const ownerLabels: Record<AppDocumentOption['ownerType'], string> = {
  company: 'Firma',
  contact: 'Dienstleister',
  property: 'Immobilie',
  tenant: 'Mieter',
  unit: 'Einheit',
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

function getAttachmentName(attachment: PendingOutgoingAttachment) {
  return attachment.file?.name || attachment.existing?.name || 'Anhang';
}

function getAttachmentSize(attachment: PendingOutgoingAttachment) {
  return attachment.file?.size || attachment.existing?.size || 0;
}

function documentKey(document: StoredDocumentEntry) {
  return cleanText(document.path) || cleanText(document.url) || cleanText(document.name);
}

function PaperclipIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M8.5 12.7 14.9 6.3a3.1 3.1 0 0 1 4.4 4.4l-8.1 8.1a5.1 5.1 0 0 1-7.2-7.2l8.4-8.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="m8.7 12.6 6.9-6.9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function CloseIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function addDocumentOptions(
  options: AppDocumentOption[],
  documents: StoredDocumentEntry[],
  ownerType: AppDocumentOption['ownerType'],
  ownerId: string,
  ownerLabel: string
) {
  documents.forEach((document) => {
    const key = documentKey(document);
    if (!key) return;
    options.push({
      category: cleanText(document.category) || DEFAULT_DOCUMENT_CATEGORY,
      document,
      id: `${ownerType}-${ownerId}-${key}`,
      ownerLabel,
      ownerType,
    });
  });
}

export default function OutgoingAttachmentPicker({
  attachments,
  disabled,
  inputId,
  onChange,
}: {
  attachments: PendingOutgoingAttachment[];
  disabled?: boolean;
  inputId: string;
  onChange: (attachments: PendingOutgoingAttachment[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activePane, setActivePane] = useState<'app' | 'disk'>('disk');
  const [appSearch, setAppSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Alle');
  const [ownerTypeFilter, setOwnerTypeFilter] = useState<'all' | AppDocumentOption['ownerType']>('all');
  const [companies, setCompanies] = useState<SnapshotRecord[]>([]);
  const [people, setPeople] = useState<SnapshotRecord[]>([]);
  const [properties, setProperties] = useState<SnapshotRecord[]>([]);
  const [tenants, setTenants] = useState<SnapshotRecord[]>([]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const unsubscribers = [
      onSnapshot(collection(db, 'companies'), (snapshot) =>
        setCompanies(snapshot.docs.map((entry) => ({ data: entry.data() as Record<string, unknown>, id: entry.id })))
      ),
      onSnapshot(collection(db, 'people'), (snapshot) =>
        setPeople(snapshot.docs.map((entry) => ({ data: entry.data() as Record<string, unknown>, id: entry.id })))
      ),
      onSnapshot(collection(db, 'properties'), (snapshot) =>
        setProperties(snapshot.docs.map((entry) => ({ data: entry.data() as Record<string, unknown>, id: entry.id })))
      ),
      onSnapshot(collection(db, 'tenants'), (snapshot) =>
        setTenants(snapshot.docs.map((entry) => ({ data: entry.data() as Record<string, unknown>, id: entry.id })))
      ),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [isOpen]);

  const appDocuments = useMemo(() => {
    const options: AppDocumentOption[] = [];
    companies.forEach((entry) => {
      addDocumentOptions(options, cleanStoredDocuments(entry.data.companyDocuments), 'company', entry.id, cleanText(entry.data.name) || entry.id);
    });
    people.forEach((entry) => {
      const label = [cleanText(entry.data.lastName), cleanText(entry.data.firstName)].filter(Boolean).join(', ');
      addDocumentOptions(options, cleanStoredDocuments(entry.data.personDocuments), 'contact', entry.id, label || cleanText(entry.data.companyName) || entry.id);
    });
    properties.forEach((entry) => {
      const propertyLabel = cleanText(entry.data.name) || cleanText(entry.data.address) || entry.id;
      addDocumentOptions(options, cleanStoredDocuments(entry.data.propertyDocuments), 'property', entry.id, propertyLabel);
      const units = Array.isArray(entry.data.units) ? entry.data.units : [];
      units.forEach((unit, index) => {
        if (!unit || typeof unit !== 'object') return;
        const unitRecord = unit as Record<string, unknown>;
        const unitId = cleanText(unitRecord.id) || String(index);
        const unitLabel = [propertyLabel, cleanText(unitRecord.label) || cleanText(unitRecord.position) || `Einheit ${index + 1}`]
          .filter(Boolean)
          .join(' · ');
        addDocumentOptions(options, cleanStoredDocuments(unitRecord.documents), 'unit', `${entry.id}-${unitId}`, unitLabel);
      });
    });
    tenants.forEach((entry) => {
      const label = [cleanText(entry.data.lastName), cleanText(entry.data.firstName)].filter(Boolean).join(', ');
      addDocumentOptions(options, cleanStoredDocuments(entry.data.tenantDocuments), 'tenant', entry.id, label || entry.id);
    });
    return options.sort((a, b) => `${a.ownerLabel} ${a.document.name}`.localeCompare(`${b.ownerLabel} ${b.document.name}`, 'de'));
  }, [companies, people, properties, tenants]);

  const categories = useMemo(
    () => ['Alle', ...Array.from(new Set(appDocuments.map((entry) => entry.category))).sort((a, b) => a.localeCompare(b, 'de'))],
    [appDocuments]
  );
  const filteredAppDocuments = useMemo(() => {
    const needle = appSearch.toLowerCase();
    return appDocuments.filter((entry) => {
      const matchesOwner = ownerTypeFilter === 'all' || entry.ownerType === ownerTypeFilter;
      const matchesCategory = categoryFilter === 'Alle' || entry.category === categoryFilter;
      const haystack = [entry.document.name, entry.category, entry.ownerLabel, ownerLabels[entry.ownerType]]
        .join(' ')
        .toLowerCase();
      return matchesOwner && matchesCategory && (!needle || haystack.includes(needle));
    });
  }, [appDocuments, appSearch, categoryFilter, ownerTypeFilter]);

  function addFiles(files: File[]) {
    if (!files.length) return;
    onChange([
      ...attachments,
      ...files.map((file) => ({
        file,
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      })),
    ]);
  }

  function addExistingDocument(option: AppDocumentOption) {
    const key = documentKey(option.document);
    if (attachments.some((entry) => documentKey(entry.existing as StoredDocumentEntry) === key)) return;
    onChange([
      ...attachments,
      {
        existing: {
          contentType: option.document.contentType || 'application/octet-stream',
          name: option.document.name,
          path: option.document.path,
          size: option.document.size,
          uploadedAt: option.document.uploadedAt,
          url: option.document.url,
        },
        id: `existing-${option.id}-${crypto.randomUUID()}`,
      },
    ]);
  }

  function openAttachment(attachment: PendingOutgoingAttachment) {
    if (attachment.existing?.url) {
      window.open(attachment.existing.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!attachment.file) return;
    const url = URL.createObjectURL(attachment.file);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <div className="relative mt-3">
      <div className="flex items-center gap-2">
        <input
          className="sr-only"
          disabled={disabled}
          id={inputId}
          multiple
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.currentTarget.value = '';
            setIsOpen(false);
          }}
          ref={fileInputRef}
          type="file"
        />
        <button
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 bg-white text-slate-700 transition ${
            disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-stone-400 hover:text-slate-950'
          }`}
          disabled={disabled}
          onClick={() => setIsOpen((current) => !current)}
          title="Anhang hinzufügen"
          type="button"
        >
          <PaperclipIcon className="h-4 w-4" />
          <span className="sr-only">Anhang hinzufügen</span>
        </button>
        {attachments.length ? (
          <span className="text-xs text-slate-500">
            {attachments.length === 1 ? '1 Anhang ausgewählt' : `${attachments.length} Anhänge ausgewählt`}
          </span>
        ) : null}
      </div>

      {isOpen ? (
        <div className="absolute bottom-11 left-0 z-30 w-[min(92vw,560px)] rounded-[18px] border border-stone-200 bg-white p-3 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.42)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <button
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  activePane === 'disk' ? 'bg-stone-900 text-white' : 'border border-stone-300 bg-white text-slate-700'
                }`}
                onClick={() => {
                  setActivePane('disk');
                  fileInputRef.current?.click();
                }}
                type="button"
              >
                Festplatte
              </button>
              <button
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  activePane === 'app' ? 'bg-stone-900 text-white' : 'border border-stone-300 bg-white text-slate-700'
                }`}
                onClick={() => setActivePane('app')}
                type="button"
              >
                App-Dateien
              </button>
            </div>
            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 text-slate-500 hover:text-slate-950"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {activePane === 'disk' ? (
            <div className="mt-3 rounded-[14px] border border-dashed border-stone-300 px-3 py-4 text-sm text-slate-600">
              Datei von der Festplatte auswählen oder direkt auf <span className="font-medium text-slate-900">Festplatte</span> klicken.
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_150px]">
                <input
                  className="h-9 rounded-full border border-stone-300 bg-stone-50 px-3 text-xs text-slate-900 outline-none focus:border-amber-700/60"
                  onChange={(event) => setAppSearch(event.target.value)}
                  placeholder="Dateien suchen"
                  value={appSearch}
                />
                <select
                  className="h-9 rounded-full border border-stone-300 bg-white px-3 text-xs text-slate-900 outline-none focus:border-amber-700/60"
                  onChange={(event) => setOwnerTypeFilter(event.target.value as typeof ownerTypeFilter)}
                  value={ownerTypeFilter}
                >
                  <option value="all">Alle Orte</option>
                  <option value="company">Firma</option>
                  <option value="property">Immobilie</option>
                  <option value="unit">Einheit</option>
                  <option value="tenant">Mieter</option>
                  <option value="contact">Dienstleister</option>
                </select>
                <select
                  className="h-9 rounded-full border border-stone-300 bg-white px-3 text-xs text-slate-900 outline-none focus:border-amber-700/60"
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  value={categoryFilter}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="max-h-72 divide-y divide-stone-200 overflow-y-auto border-y border-stone-200">
                {filteredAppDocuments.length ? (
                  filteredAppDocuments.map((entry) => (
                    <button
                      className="grid w-full gap-1 px-1 py-2 text-left text-xs hover:bg-stone-50 sm:grid-cols-[minmax(0,1fr)_100px_auto] sm:items-center"
                      key={entry.id}
                      onClick={() => addExistingDocument(entry)}
                      type="button"
                    >
                      <span className="min-w-0 truncate font-medium text-slate-900">{entry.document.name}</span>
                      <span className="text-slate-500">{entry.category}</span>
                      <span className="text-slate-500">
                        {ownerLabels[entry.ownerType]} · {entry.ownerLabel}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-1 py-6 text-sm text-slate-500">Keine passenden App-Dateien gefunden.</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {attachments.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <span
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs text-slate-700"
              key={attachment.id}
            >
              <PaperclipIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <button
                className="min-w-0 truncate text-left underline-offset-2 hover:text-amber-800 hover:underline"
                onClick={() => openAttachment(attachment)}
                title="Anhang öffnen"
                type="button"
              >
                {getAttachmentName(attachment)}
              </button>
              {formatFileSize(getAttachmentSize(attachment)) ? (
                <span className="shrink-0 text-slate-400">{formatFileSize(getAttachmentSize(attachment))}</span>
              ) : null}
              <button
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white text-slate-500 transition hover:border-rose-200 hover:text-rose-600"
                disabled={disabled}
                onClick={() => onChange(attachments.filter((entry) => entry.id !== attachment.id))}
                title="Anhang entfernen"
                type="button"
              >
                <CloseIcon className="h-3 w-3" />
                <span className="sr-only">Anhang entfernen</span>
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
