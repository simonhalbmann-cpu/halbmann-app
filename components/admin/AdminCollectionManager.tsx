'use client';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db, storage } from '../../lib/firebase';
import {
  cleanStoredDocuments,
  createClientId,
  sanitizeStorageFileName,
  type StoredDocumentEntry,
} from '../../lib/tenantDocuments';
import type { AdminField, OverviewVariant, PreviewField } from './adminFormTypes';
import PendingDocumentUploadSection, { type PendingCategorizedFile } from './PendingDocumentUploadSection';

type Props = {
  collectionName: string;
  description: string;
  documentId?: string;
  editMode?: boolean;
  emptyState: string;
  fields: AdminField[];
  hideOverview?: boolean;
  itemRouteBase?: string;
  overviewFirst?: boolean;
  overviewLabel?: string;
  overviewSubtitleFields?: string[];
  overviewTitleFields?: string[];
  overviewVariant?: OverviewVariant;
  previewFields: PreviewField[];
  recordLabel?: string;
  redirectPathAfterSave?: string;
  submitLabel: string;
  title: string;
};

type AdminRecord = { data: DocumentData; id: string };
type RelatedMap = Record<string, AdminRecord[]>;
type KnownAddress = {
  city: string;
  country: string;
  houseNumber: string;
  label: string;
  postalCode: string;
  street: string;
};

const formatPreviewValue = (value: unknown) => {
  if (typeof value !== 'string' && typeof value !== 'number') return '-';
  if (typeof value === 'string' && value.trim().length === 0) return '-';
  return String(value);
};

const cleanSpaces = (value: string) => value.replace(/\s+/g, ' ').trim();

const titleCase = (value: string) =>
  cleanSpaces(value)
    .split(' ')
    .map((part) =>
      part.length <= 2 && part === part.toUpperCase()
        ? part
        : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join(' ');

const buildRelationLabel = (record: AdminRecord, labelFields: string[]) =>
  labelFields
    .map((fieldName) => formatPreviewValue(record.data[fieldName]))
    .filter((value) => value !== '-')
    .join(' · ') || record.id;

const buildOverviewText = (record: AdminRecord, fieldNames: string[]) =>
  fieldNames
    .map((fieldName) => formatPreviewValue(record.data[fieldName]))
    .filter((value) => value !== '-')
    .join(' · ') || record.id;

const buildAddressLabel = (address: Omit<KnownAddress, 'label'>) =>
  cleanSpaces(
    `${address.street} ${address.houseNumber}, ${address.postalCode} ${address.city}`
  );

const parseTextListValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => cleanSpaces(String(entry ?? '')))
      .filter(Boolean);
  }

  const text = cleanSpaces(String(value ?? ''));
  if (!text) return [''];

  const parts = text
    .split(/\r?\n|,/)
    .map((entry) => cleanSpaces(entry))
    .filter(Boolean);

  return parts.length > 0 ? parts : [''];
};

function TextListField({
  field,
  onChange,
  value,
}: {
  field: AdminField;
  onChange: (value: string[]) => void;
  value: string[];
}) {
  const items = value.length > 0 ? value : [''];

  function updateItem(index: number, nextValue: string) {
    const nextItems = items.map((entry, itemIndex) =>
      itemIndex === index ? nextValue : entry
    );
    onChange(nextItems);
  }

  function addItem() {
    onChange([...items, '']);
  }

  function removeItem(index: number) {
    const nextItems = items.filter((_, itemIndex) => itemIndex !== index);
    onChange(nextItems.length > 0 ? nextItems : ['']);
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div className="flex items-start gap-3" key={`${field.name}-${index}`}>
          <input
            autoComplete={field.autoComplete ?? 'off'}
            className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
            onChange={(event) => updateItem(index, event.target.value)}
            placeholder={index === 0 ? field.placeholder : 'Weiterer Geschäftsführer'}
            type="text"
            value={item}
          />
          <button
            className="rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-stone-400"
            onClick={() => removeItem(index)}
            type="button"
          >
            Entfernen
          </button>
        </div>
      ))}
      <button
        className="rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:border-stone-400"
        onClick={addItem}
        type="button"
      >
        Geschäftsführer hinzufügen
      </button>
    </div>
  );
}

const splitStreetAndHouseNumber = (value: string) => {
  const match = cleanSpaces(value).match(/^(.*?)(\s+\d+[a-zA-Z\-\/]*)$/);
  if (!match) return null;
  return { houseNumber: cleanSpaces(match[2]), street: cleanSpaces(match[1]) };
};

function formatFieldValue(field: AdminField, rawValue: string) {
  if (!rawValue) return '';
  if (field.kind === 'address_postal_code') return rawValue.replace(/\D/g, '').slice(0, 5);
  if (field.kind === 'address_city' || field.kind === 'address_country') return titleCase(rawValue);
  if (field.kind === 'address_street') return titleCase(rawValue);
  if (field.kind === 'address_house_number') return cleanSpaces(rawValue).toUpperCase();
  if (field.kind === 'credential_email' || field.type === 'email') return cleanSpaces(rawValue).toLowerCase();
  if (field.name === 'iban') {
    return cleanSpaces(rawValue)
      .replace(/\s+/g, '')
      .toUpperCase()
      .replace(/(.{4})/g, '$1 ')
      .trim();
  }
  if (field.name === 'bic' || field.name === 'vatId' || field.name === 'businessId') {
    return cleanSpaces(rawValue).toUpperCase();
  }
  return cleanSpaces(rawValue);
}

export default function AdminCollectionManager({
  collectionName,
  description,
  documentId,
  editMode = false,
  emptyState,
  fields,
  hideOverview = false,
  itemRouteBase,
  overviewFirst = false,
  overviewLabel = 'Bestehende Datensätze',
  overviewSubtitleFields = [],
  overviewTitleFields = [],
  overviewVariant = 'detail',
  previewFields,
  recordLabel = 'Datensatz',
  redirectPathAfterSave,
  submitLabel,
  title,
}: Props) {
  const { role, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [relatedCollections, setRelatedCollections] = useState<RelatedMap>({});
  const [knownAddresses, setKnownAddresses] = useState<KnownAddress[]>([]);
  const [initialValues, setInitialValues] = useState<Record<string, unknown>>({});
  const [textListValues, setTextListValues] = useState<Record<string, string[]>>({});
  const [formKey, setFormKey] = useState(() => (editMode && documentId ? documentId : 'new'));
  const [isLoadingInitialValues, setIsLoadingInitialValues] = useState(
    () => editMode && Boolean(documentId)
  );
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingCompanyDocumentFiles, setPendingCompanyDocumentFiles] = useState<PendingCategorizedFile[]>([]);
  const [isPending, startTransition] = useTransition();
  const isCompanyCollection = collectionName === 'companies';
  const isPersonCollection = collectionName === 'people';
  const isDocumentUploadCollection = isCompanyCollection || isPersonCollection;
  const documentCollectionField = isPersonCollection ? 'personDocuments' : 'companyDocuments';
  const documentStoragePrefix = isPersonCollection ? 'person-documents' : 'company-documents';
  const hiddenCompanyUploadFieldNames = useMemo(
    () =>
      new Set([
        'companyUploadSection',
        'uploadCompanyContract',
        'uploadCommercialRegisterExtract',
        'uploadShareholderList',
        'uploadTaxDocuments',
        'uploadRepresentationProof',
        'uploadBankDocuments',
        'uploadOtherCompanyDocuments',
      ]),
    []
  );
  const visibleFields = useMemo(
    () =>
      isDocumentUploadCollection
        ? fields.filter((field) => !hiddenCompanyUploadFieldNames.has(field.name) && !(isPersonCollection && field.type === 'file'))
        : fields,
    [fields, hiddenCompanyUploadFieldNames, isDocumentUploadCollection, isPersonCollection]
  );

  const relationFields = useMemo(
    () =>
      fields.filter(
        (field) => (field.type === 'relation' || field.type === 'relation-multi') && field.relation
      ),
    [fields]
  );
  const addressNames = useMemo(
    () => ({
      city: fields.find((field) => field.kind === 'address_city')?.name ?? 'city',
      country: fields.find((field) => field.kind === 'address_country')?.name ?? 'country',
      houseNumber:
        fields.find((field) => field.kind === 'address_house_number')?.name ?? 'houseNumber',
      postalCode:
        fields.find((field) => field.kind === 'address_postal_code')?.name ?? 'postalCode',
      street: fields.find((field) => field.kind === 'address_street')?.name ?? 'street',
    }),
    [fields]
  );
  const allAddressSuggestions = useMemo(() => {
    const merged = new Map<string, KnownAddress>();

    knownAddresses.forEach((entry) => {
      merged.set(entry.label, entry);
    });

    return Array.from(merged.values()).sort((left, right) =>
      left.label.localeCompare(right.label, 'de')
    );
  }, [knownAddresses]);

  useEffect(() => {
    if (hideOverview) return;
    return onSnapshot(query(collection(db, collectionName)), (snapshot) => {
      setRecords(
        snapshot.docs
          .map((documentSnapshot) => ({
            id: documentSnapshot.id,
            data: documentSnapshot.data(),
          }))
          .sort((left, right) => {
            const leftText = buildOverviewText(
              left,
              overviewTitleFields.length > 0
                ? overviewTitleFields
                : previewFields.map((field) => field.name).slice(0, 1)
            );
            const rightText = buildOverviewText(
              right,
              overviewTitleFields.length > 0
                ? overviewTitleFields
                : previewFields.map((field) => field.name).slice(0, 1)
            );
            return leftText.localeCompare(rightText, 'de');
          })
      );
    });
  }, [collectionName, hideOverview, overviewTitleFields, previewFields]);

  useEffect(() => {
    if (editMode || collectionName !== 'people') return;
    const email = cleanSpaces(searchParams.get('email') ?? '').toLowerCase();
    if (!email) return;
    setInitialValues((current) => (cleanSpaces(String(current.email ?? '')) ? current : { ...current, email }));
    setFormKey(`new-${email}`);
  }, [collectionName, editMode, searchParams]);

  useEffect(() => {
    if (relationFields.length === 0) return;
    const names = Array.from(
      new Set(
        relationFields
          .map((field) => field.relation?.collectionName)
          .filter((name): name is string => Boolean(name))
      )
    );
    const unsubscribers = names.map((name) =>
      onSnapshot(query(collection(db, name)), (snapshot) => {
        setRelatedCollections((current) => ({
          ...current,
          [name]: snapshot.docs.map((documentSnapshot) => ({
            id: documentSnapshot.id,
            data: documentSnapshot.data(),
          })),
        }));
      })
    );
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [relationFields]);

  useEffect(() => {
    const collectionsToWatch = ['companies', 'people', 'properties'];
    const store = new Map<string, KnownAddress>();
    const unsubscribers = collectionsToWatch.map((name) =>
      onSnapshot(query(collection(db, name)), (snapshot) => {
        snapshot.docs.forEach((documentSnapshot) => {
          const data = documentSnapshot.data();
          const street = titleCase(String(data[addressNames.street] ?? ''));
          const houseNumber = cleanSpaces(String(data[addressNames.houseNumber] ?? ''));
          const postalCode = String(data[addressNames.postalCode] ?? '').replace(/\D/g, '').slice(0, 5);
          const city = titleCase(String(data[addressNames.city] ?? ''));
          const country = titleCase(String(data[addressNames.country] ?? 'Deutschland'));
          if (!street || !postalCode || !city) return;
          const nextAddress = { city, country, houseNumber, postalCode, street };
          const label = buildAddressLabel(nextAddress);
          store.set(label, { ...nextAddress, label });
        });
        setKnownAddresses(Array.from(store.values()).sort((a, b) => a.label.localeCompare(b.label, 'de')));
      })
    );
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [addressNames]);

  useEffect(() => {
    if (!editMode || !documentId) return;
    const currentDocumentId = documentId;
    let isMounted = true;
    async function loadRecord() {
      setIsLoadingInitialValues(true);
      const snapshot = await getDoc(doc(db, collectionName, currentDocumentId));
      if (!isMounted) return;
      if (!snapshot.exists()) {
        setError(`${recordLabel} wurde nicht gefunden.`);
        setIsLoadingInitialValues(false);
        return;
      }
      const nextValues = Object.fromEntries(
        Object.entries(snapshot.data()).map(([key, value]) => [key, value ?? ''])
      );
      setInitialValues(nextValues);
      setTextListValues(
        Object.fromEntries(
          fields
            .filter((field) => field.type === 'text-list')
            .map((field) => [field.name, parseTextListValue(nextValues[field.name])])
        )
      );
      setFormKey(`${currentDocumentId}-${Date.now()}`);
      setIsLoadingInitialValues(false);
    }
    loadRecord().catch((caughtError) => {
      console.error(`Fehler beim Laden von ${collectionName}/${currentDocumentId}:`, caughtError);
      if (isMounted) {
        setError(`${recordLabel} konnte nicht geladen werden.`);
        setIsLoadingInitialValues(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [collectionName, documentId, editMode, recordLabel]);

  useEffect(() => {
    if (editMode) return;
    setTextListValues(
      Object.fromEntries(
        fields
          .filter((field) => field.type === 'text-list')
          .map((field) => [field.name, ['']])
      )
    );
  }, [editMode, fields]);

  function setFormFieldValue(name: string, value: string) {
    const element = formRef.current?.elements.namedItem(name) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
      | null;
    if (element) element.value = value;
  }

  function handleFieldBlur(
    event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    field: AdminField
  ) {
    const target = event.currentTarget;
    const formatted = formatFieldValue(field, target.value);
    if (formatted !== target.value) target.value = formatted;
    if (field.kind === 'address_street') {
      const houseField = formRef.current?.elements.namedItem(addressNames.houseNumber) as HTMLInputElement | null;
      if (houseField && !houseField.value) {
        const splitResult = splitStreetAndHouseNumber(formatted);
        if (splitResult) {
          target.value = splitResult.street;
          houseField.value = splitResult.houseNumber;
        }
      }
      const exactStreet = allAddressSuggestions.find(
        (address) => address.street === target.value.trim()
      );
      if (exactStreet) {
        setFormFieldValue(addressNames.postalCode, exactStreet.postalCode);
        setFormFieldValue(addressNames.city, exactStreet.city);
        setFormFieldValue(addressNames.country, exactStreet.country);
      }
    }
    if (field.kind === 'address_postal_code') {
      const exactPostal = allAddressSuggestions.find(
        (address) => address.postalCode === target.value
      );
      if (exactPostal) {
        setFormFieldValue(addressNames.city, exactPostal.city);
        setFormFieldValue(addressNames.country, exactPostal.country);
      }
    }
  }

  async function uploadCategorizedDocuments(recordId: string, files: PendingCategorizedFile[]) {
    if (files.length === 0) return [];

    const uploadedDocuments: StoredDocumentEntry[] = [];

    for (const entry of files) {
      const file = entry.file;
      const safeName = sanitizeStorageFileName(file.name);
      const storagePath = `${documentStoragePrefix}/${recordId}/${Date.now()}-${createClientId('file')}-${safeName}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file, {
        contentType: file.type || 'application/octet-stream',
      });

      uploadedDocuments.push({
        category: entry.category,
        contentType: file.type || 'application/octet-stream',
        name: file.name,
        path: storagePath,
        size: file.size,
        source: 'upload',
        uploadedAt: new Date().toISOString(),
        uploadedByEmail: user?.email ?? '',
        url: await getDownloadURL(storageRef),
      });
    }

    return uploadedDocuments;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role !== 'admin' || !user) {
      setError('Nur Verwalter dürfen in diesem Bereich Daten anlegen.');
      return;
    }
    const form = event.currentTarget;
    const formData = new FormData(form);
    const values: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        values[key] = value.size > 0 ? value.name : editMode ? initialValues[key] ?? '' : '';
        continue;
      }
      const field = fields.find((currentField) => currentField.name === key);
      if (field?.kind === 'credential_password' && !String(value).trim()) {
        values[key] = editMode ? initialValues[key] ?? '' : '';
      } else {
        values[key] = field ? formatFieldValue(field, String(value)) : String(value);
      }
    }
    fields
      .filter((field) => field.type === 'text-list')
      .forEach((field) => {
        const items = (textListValues[field.name] ?? [])
          .map((entry) => formatFieldValue(field, entry))
          .filter(Boolean);
        values[field.name] = items.join(', ');
      });
    relationFields.forEach((field) => {
      const relation = field.relation;
      if (!relation) return;
      if (field.type === 'relation-multi') {
        const selectedIds = formData
          .getAll(field.name)
          .map((entry) => String(entry))
          .filter(Boolean);
        values[field.name] = selectedIds.join(', ');
        if (relation.storeLabelAs) {
          values[relation.storeLabelAs] = selectedIds
            .map((id) => relatedCollections[relation.collectionName]?.find((record) => record.id === id) ?? null)
            .filter((record): record is AdminRecord => Boolean(record))
            .map((record) => buildRelationLabel(record, relation.labelFields))
            .join(', ');
        }
        return;
      }
      const selected = relatedCollections[relation.collectionName]?.find(
        (record) => record.id === String(values[field.name] ?? '')
      );
      if (relation.storeLabelAs) {
        values[relation.storeLabelAs] = selected
          ? buildRelationLabel(selected, relation.labelFields)
          : '';
      }
    });
    if (collectionName === 'people') {
      delete values.portalUsername;
      delete values.portalPassword;
    }
    setMessage('');
    setError('');
    startTransition(async () => {
      try {
        let savedRecordId = documentId ?? '';
        let nextInitialValues = values;
        if (editMode && documentId) {
          await updateDoc(doc(db, collectionName, documentId), {
            ...values,
            updatedAt: serverTimestamp(),
            updatedByEmail: user.email ?? null,
            updatedByUid: user.uid,
          });
          if (isDocumentUploadCollection && pendingCompanyDocumentFiles.length > 0) {
            const uploadedDocuments = await uploadCategorizedDocuments(documentId, pendingCompanyDocumentFiles);
            const nextCompanyDocuments = [
              ...cleanStoredDocuments(initialValues[documentCollectionField]),
              ...uploadedDocuments,
            ];
            await updateDoc(doc(db, collectionName, documentId), {
              [documentCollectionField]: nextCompanyDocuments,
              updatedAt: serverTimestamp(),
              updatedByEmail: user.email ?? null,
              updatedByUid: user.uid,
            });
            nextInitialValues = { ...values, [documentCollectionField]: nextCompanyDocuments };
            setPendingCompanyDocumentFiles([]);
          }
          setInitialValues(nextInitialValues);
          setFormKey(`${documentId}-${Date.now()}`);
          setMessage(`${recordLabel} wurde aktualisiert.`);
          if (redirectPathAfterSave) router.push(redirectPathAfterSave);
        } else {
          const createdRecord = await addDoc(collection(db, collectionName), {
            ...values,
            createdAt: serverTimestamp(),
            createdByEmail: user.email ?? null,
            createdByUid: user.uid,
            updatedAt: serverTimestamp(),
          });
          savedRecordId = createdRecord.id;
          if (isDocumentUploadCollection && pendingCompanyDocumentFiles.length > 0) {
            const uploadedDocuments = await uploadCategorizedDocuments(savedRecordId, pendingCompanyDocumentFiles);
            await updateDoc(doc(db, collectionName, savedRecordId), {
              [documentCollectionField]: uploadedDocuments,
              updatedAt: serverTimestamp(),
              updatedByEmail: user.email ?? null,
              updatedByUid: user.uid,
            });
            setPendingCompanyDocumentFiles([]);
          }
          form.reset();
          setFormKey(`new-${Date.now()}`);
          setMessage(`${submitLabel} wurde gespeichert.`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } catch (caughtError) {
        console.error(`Fehler beim Speichern in ${collectionName}:`, caughtError);
        setError('Speichern fehlgeschlagen. Bitte prüfe Firestore-Regeln und Berechtigungen.');
      }
    });
  }

  function handleDelete(recordId: string) {
    const confirmed = window.confirm(`${recordLabel} wirklich löschen?`);
    if (!confirmed) return;
    setMessage('');
    setError('');
    startTransition(async () => {
      try {
        await deleteDoc(doc(db, collectionName, recordId));
        setMessage(`${recordLabel} wurde gelöscht.`);
      } catch (caughtError) {
        console.error(`Fehler beim Löschen in ${collectionName}:`, caughtError);
        setError(`${recordLabel} konnte nicht gelöscht werden.`);
      }
    });
  }

  function renderField(field: AdminField) {
    const fieldType = field.type ?? 'text';
    const value = initialValues[field.name] ?? '';
    const stringValue = typeof value === 'string' ? value : String(value ?? '');
    const defaultFieldValue = field.kind === 'credential_password' ? '' : stringValue;
    if (fieldType === 'section') {
      return (
        <div className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-5">
          <p className="text-sm font-medium text-slate-900">{field.label}</p>
          {field.sectionText ? <p className="mt-2 text-sm leading-7 text-slate-600">{field.sectionText}</p> : null}
          {field.sectionItems?.length ? (
            <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
              {field.sectionItems.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          ) : null}
        </div>
      );
    }
    const common = {
      autoComplete:
        field.autoComplete ??
        (field.kind === 'credential_password' ? 'new-password' : 'off'),
      defaultValue: defaultFieldValue,
      name: field.name,
      onBlur: (
        event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
      ) => handleFieldBlur(event, field),
      placeholder: field.placeholder,
      required: field.required,
    };
    return (
      <>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">{field.label}</span>
          {fieldType === 'textarea' ? (
            <textarea {...common} className="min-h-28 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" rows={field.rows ?? 4} />
          ) : fieldType === 'text-list' ? (
            <TextListField
              field={field}
              onChange={(nextValue) =>
                setTextListValues((current) => ({ ...current, [field.name]: nextValue }))
              }
              value={textListValues[field.name] ?? parseTextListValue(value)}
            />
          ) : fieldType === 'select' ? (
            <select className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" defaultValue={stringValue} name={field.name} onBlur={(event) => handleFieldBlur(event, field)} required={field.required}>
              <option disabled value="">Bitte wählen</option>
              {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          ) : fieldType === 'relation-multi' && field.relation ? (
            <>
              <select
                className="min-h-36 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                defaultValue={stringValue.split(',').map((entry) => entry.trim()).filter(Boolean)}
                multiple
                name={field.name}
                onBlur={(event) => handleFieldBlur(event, field)}
                required={field.required}
              >
                {(relatedCollections[field.relation.collectionName] ?? []).map((record) => (
                  <option key={record.id} value={record.id}>
                    {buildRelationLabel(record, field.relation?.labelFields ?? [])}
                  </option>
                ))}
              </select>
              <p className="text-xs leading-6 text-slate-500">Mehrfachauswahl mit `Strg` oder `Cmd`.</p>
            </>
          ) : fieldType === 'relation' && field.relation ? (
            <select className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" defaultValue={stringValue} name={field.name} onBlur={(event) => handleFieldBlur(event, field)} required={field.required}>
              <option value="">{field.relation.emptyLabel ?? 'Bitte aus bestehendem Datensatz wählen'}</option>
              {(relatedCollections[field.relation.collectionName] ?? []).map((record) => <option key={record.id} value={record.id}>{buildRelationLabel(record, field.relation?.labelFields ?? [])}</option>)}
            </select>
          ) : fieldType === 'file' ? (
            <>
              <input accept={field.accept} autoComplete="off" className="w-full rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-700 outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 focus:border-amber-700/60" name={field.name} required={field.required && !editMode} type="file" />
              {editMode && stringValue ? <p className="text-xs leading-6 text-slate-500">Hinterlegt: {stringValue}</p> : null}
            </>
          ) : (
            <input {...common} className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" type={fieldType} />
          )}
        </label>
        {field.helpText ? <p className="text-xs leading-6 text-slate-500">{field.helpText}</p> : null}
      </>
    );
  }

  function renderOverview() {
    return (
      <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">{overviewLabel}</p>
        <h3 className="mt-2 text-3xl text-slate-950">Übersicht</h3>
        {records.length === 0 ? (
          <div className="mt-6 rounded-[28px] border border-dashed border-stone-300 bg-stone-50 p-6 text-sm leading-7 text-slate-600">{emptyState}</div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {records.map((record) => {
              const titleText = overviewTitleFields.length > 0 ? buildOverviewText(record, overviewTitleFields) : buildOverviewText(record, previewFields.map((field) => field.name).slice(0, 1));
              const subtitleText = overviewSubtitleFields.length > 0 ? buildOverviewText(record, overviewSubtitleFields) : '';
              return (
                <article className="rounded-[20px] border border-stone-200 bg-stone-50 px-3.5 py-2.5" key={record.id}>
                  {overviewVariant === 'compact' ? (
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-5 text-slate-950">{titleText}</p>
                        {subtitleText && subtitleText !== record.id ? <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{subtitleText}</p> : null}
                      </div>
                      {itemRouteBase ? (
                        <div className="flex flex-wrap gap-2">
                          <Link className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950" href={`${itemRouteBase}/${record.id}`}>Ansehen</Link>
                          <Link className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950" href={`${itemRouteBase}/${record.id}/bearbeiten`}>Bearbeiten</Link>
                          <button className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100" onClick={() => handleDelete(record.id)} type="button">Löschen</button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <dl className="grid gap-3">
                      {previewFields.map((field) => (
                        <div className="grid grid-cols-1 gap-1.5 text-sm md:grid-cols-[110px_minmax(0,1fr)] md:gap-4" key={field.name}>
                          <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{field.label}</dt>
                          <dd className="min-w-0 whitespace-normal break-words leading-6 text-slate-900">{formatPreviewValue(record.data[field.name])}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  function renderForm() {
    if (isLoadingInitialValues) {
      return <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]"><div className="rounded-[28px] border border-dashed border-stone-300 bg-stone-50 p-6 text-sm leading-7 text-slate-600">{recordLabel} wird geladen...</div></section>;
    }
    return (
      <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">{editMode ? `${recordLabel} bearbeiten` : 'Neuer Datensatz'}</p>
        <h3 className="mt-2 text-3xl text-slate-950">{submitLabel}</h3>
        <form autoComplete="off" className="mt-8 grid gap-5 md:grid-cols-2" key={formKey} onSubmit={handleSubmit} ref={formRef}>
          <input autoComplete="username" className="hidden" name={`${collectionName}-fake-username`} tabIndex={-1} type="text" />
          <input autoComplete="current-password" className="hidden" name={`${collectionName}-fake-password`} tabIndex={-1} type="password" />
          {visibleFields.map((field) => {
            const fieldType = field.type ?? 'text';
            const isWide =
              fieldType === 'textarea' ||
              fieldType === 'file' ||
              fieldType === 'section' ||
              fieldType === 'text-list';
            return <div className={isWide ? 'space-y-2 md:col-span-2' : 'space-y-2'} key={field.name}>{renderField(field)}</div>;
          })}
          {isDocumentUploadCollection ? (
            <div className="md:col-span-2">
              <PendingDocumentUploadSection
                files={pendingCompanyDocumentFiles}
                onAddFiles={(files, category) => {
                  const nextEntries = Array.from(files).map((file) => ({
                    category,
                    file,
                    id: createClientId('file'),
                  }));
                  setPendingCompanyDocumentFiles((currentFiles) => [...currentFiles, ...nextEntries]);
                  setMessage(
                    files.length === 1
                      ? '1 Datei fuer den Upload vorgemerkt.'
                      : `${files.length} Dateien fuer den Upload vorgemerkt.`
                  );
                }}
                onRemoveFile={(id) =>
                  setPendingCompanyDocumentFiles((currentFiles) =>
                    currentFiles.filter((entry) => entry.id !== id)
                  )
                }
                title={isPersonCollection ? 'Dokumente zum Dienstleister' : 'Dokumente zur Firma'}
              />
            </div>
          ) : null}
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 md:col-span-2">{error}</div> : null}
          {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 md:col-span-2">{message}</div> : null}
          <div className="flex flex-wrap gap-3 md:col-span-2">
            <button className="rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-5 py-3 text-sm font-semibold text-stone-100 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60" disabled={isPending} type="submit">{isPending ? 'Speichert...' : submitLabel}</button>
            {editMode && itemRouteBase && documentId ? <Link className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950" href={`${itemRouteBase}/${documentId}`}>Zur Ansicht</Link> : null}
          </div>
        </form>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {!overviewFirst ? <section className="rounded-[34px] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,250,240,0.96)_0%,rgba(247,241,231,0.94)_100%)] p-8 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.35)]"><p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Hinzufügen</p><h2 className="mt-3 text-4xl text-slate-950">{title}</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{description}</p></section> : null}
      {overviewFirst && !hideOverview ? renderOverview() : null}
      {overviewFirst ? <section className="rounded-[34px] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,250,240,0.96)_0%,rgba(247,241,231,0.94)_100%)] p-8 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.35)]"><p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Hinzufügen</p><h2 className="mt-3 text-4xl text-slate-950">{title}</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{description}</p></section> : null}
      {hideOverview || overviewFirst ? renderForm() : <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">{renderForm()}{renderOverview()}</div>}
    </div>
  );
}

