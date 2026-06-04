'use client';

import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db, storage } from '../../lib/firebase';
import {
  cleanStoredDocuments,
  sanitizeStorageFileName,
  type StoredDocumentEntry,
} from '../../lib/tenantDocuments';
import DocumentUploadControl from './DocumentUploadControl';
import DocumentLibrarySection from './DocumentLibrarySection';

type PropertyDetailViewProps = {
  propertyId: string;
  selectedUnitId?: string;
};

type AdminRecord = {
  data: DocumentData;
  id: string;
};

type ReadingDraft = {
  date: string;
  value: string;
};

const servicePartnerFields = [
  { idField: 'billingServiceId', label: 'Abrechnungsunternehmen' },
  { idField: 'roofMaintenanceId', label: 'Dachdecker / Dachwartung' },
  { idField: 'electricianId', label: 'Elektriker' },
  { idField: 'windowDoorServiceId', label: 'Fenster / Tueren' },
  { idField: 'gardeningServiceId', label: 'Gartenpflege' },
  { idField: 'janitorId', label: 'Hausmeister' },
  { idField: 'cleaningServiceId', label: 'Hausreinigung' },
  { idField: 'heatingServiceId', label: 'Heizung' },
  { idField: 'painterServiceId', label: 'Maler' },
  { idField: 'wasteCollectionId', label: 'Muellabfuhr' },
  { idField: 'gutterCleaningId', label: 'Regenrinnenreinigung' },
  { idField: 'plumbingServiceId', label: 'Rohrreinigung / Sanitaer' },
  { idField: 'locksmithServiceId', label: 'Schluesseldienst' },
  { idField: 'chimneySweepServiceId', label: 'Schornsteinfeger' },
  { idField: 'otherServiceId', label: 'Sonstiges' },
  { idField: 'carpenterServiceId', label: 'Tischler' },
  { idField: 'winterServiceId', label: 'Winterdienst' },
] as const;

const cleanText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const usageTypeLabels: Record<string, string> = {
  commercial: 'Gewerbe',
  logistics: 'Lager / Logistik',
  mixed_use: 'Mischnutzung',
  parking: 'Stellplatz',
  residential: 'Wohnen',
};

const ownershipTypeLabels: Record<string, string> = {
  full_ownership: 'Volleigentum',
  partial_ownership: 'Teileigentum',
};

const heatingTypeLabels: Record<string, string> = {
  district_heating: 'Fernwaerme',
  electric: 'Elektro',
  gas: 'Gas',
  heat_pump_air: 'Waermepumpe Luft',
  heat_pump_ground: 'Waermepumpe Erde',
  oil: 'Oel',
};

const unitDisplayLabel = (unit: DocumentData) =>
  [cleanText(unit.unitLabel), cleanText(unit.floor), cleanText(unit.unitPosition), cleanText(unit.section)]
    .filter(Boolean)
    .join(' · ');

function translateUsageType(value: unknown) {
  const normalized = cleanText(value);
  return usageTypeLabels[normalized] || normalized;
}

function translateOwnershipType(value: unknown) {
  const normalized = cleanText(value);
  return ownershipTypeLabels[normalized] || normalized;
}

function translateHeatingType(value: unknown) {
  const normalized = cleanText(value);
  return heatingTypeLabels[normalized] || normalized;
}

function formatValue(value?: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > 0 ? text : '–';
}

function formatFileSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatUploadDate(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function parseReminderMonths(value: unknown) {
  const numeric = Number.parseInt(cleanText(value), 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 11;
}

function shiftDateByMonths(value: unknown, months: unknown) {
  const text = cleanText(value);
  if (!text) return '';
  const date = new Date(`${text}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setMonth(date.getMonth() + parseReminderMonths(months));
  return date.toISOString().slice(0, 10);
}

function formatReminderSummary(lastDate: unknown, months: unknown) {
  const nextDate = shiftDateByMonths(lastDate, months);
  if (!nextDate) return '';
  return `${nextDate} nach ${parseReminderMonths(months)} Monaten`;
}

function buildReadingHistoryEntries(meter: DocumentData | null | undefined) {
  if (!meter || typeof meter !== 'object') return [];

  const entries: Array<{ date: string; note: string; value: string }> = [];
  const seen = new Set<string>();

  const pushEntry = (dateValue: unknown, valueValue: unknown, noteValue?: unknown) => {
    const date = cleanText(dateValue);
    const value = cleanText(valueValue);
    const note = cleanText(noteValue);
    if (!date || !value) return;
    const key = `${date}__${value}__${note}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ date, note, value });
  };

  if (Array.isArray(meter.readingHistory)) {
    meter.readingHistory.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      pushEntry((entry as DocumentData).date, (entry as DocumentData).value, (entry as DocumentData).note);
    });
  }

  pushEntry(meter.initialReadingDate, meter.initialReading, 'Erster Stand');
  pushEntry(meter.latestReadingDate, meter.latestReading);

  return entries.sort((left, right) => right.date.localeCompare(left.date, 'de'));
}

function appendReadingHistoryEntry(
  meter: DocumentData,
  nextEntry: { date: string; note: string; value: string }
) {
  const history = buildReadingHistoryEntries(meter);
  const duplicate = history.some(
    (entry) =>
      entry.date === nextEntry.date &&
      entry.value === nextEntry.value &&
      entry.note === nextEntry.note
  );

  if (duplicate) return history;
  return [...history, nextEntry];
}

export default function PropertyDetailView({ propertyId, selectedUnitId }: PropertyDetailViewProps) {
  const { user } = useAuth();
  const [property, setProperty] = useState<DocumentData | null>(null);
  const [companies, setCompanies] = useState<AdminRecord[]>([]);
  const [people, setPeople] = useState<AdminRecord[]>([]);
  const [tenants, setTenants] = useState<AdminRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [serviceAssignments, setServiceAssignments] = useState<Record<string, string>>({});
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [deletingDocumentPath, setDeletingDocumentPath] = useState('');
  const [maintenanceDrafts, setMaintenanceDrafts] = useState<Record<string, string>>({});
  const [maintenanceMonthDrafts, setMaintenanceMonthDrafts] = useState<Record<string, string>>({});
  const [meterReadingDrafts, setMeterReadingDrafts] = useState<Record<string, ReadingDraft>>({});
  const [selectedServiceField, setSelectedServiceField] = useState<string>(servicePartnerFields[0]?.idField || '');
  const [selectedServicePartnerId, setSelectedServicePartnerId] = useState('');

  useEffect(() => {
    const unsubscribers = [
      onSnapshot(
        doc(db, 'properties', propertyId),
        (snapshot) => {
          if (!snapshot.exists()) {
            setProperty(null);
            setError('Die Immobilie wurde nicht gefunden.');
            setIsLoading(false);
            return;
          }

          setProperty(snapshot.data());
          setError('');
          setIsLoading(false);
        },
        (caughtError) => {
          console.error(`Fehler beim Laden der Immobilie ${propertyId}:`, caughtError);
          setError('Die Immobiliendaten konnten nicht geladen werden.');
          setIsLoading(false);
        }
      ),
      onSnapshot(query(collection(db, 'companies')), (snapshot) => {
        setCompanies(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id })));
      }),
      onSnapshot(query(collection(db, 'people')), (snapshot) => {
        setPeople(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id })));
      }),
      onSnapshot(
        query(collection(db, 'tenants')),
        (snapshot) => {
          setTenants(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id })));
        },
        (caughtError) => {
          console.error(`Fehler beim Laden der Mieter fuer Immobilie ${propertyId}:`, caughtError);
        }
      ),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [propertyId]);

  useEffect(() => {
    if (!property) return;
    const nextAssignments: Record<string, string> = {};
    for (const entry of servicePartnerFields) {
      nextAssignments[entry.idField] = cleanText(property[entry.idField]);
    }
    setServiceAssignments(nextAssignments);
    setSelectedServicePartnerId(nextAssignments[selectedServiceField] || '');
  }, [property]);

  const ownerLabel = useMemo(() => {
    if (!property) return '';
    const direct = cleanText(property.ownerName);
    if (direct) return direct;
    const company = companies.find((entry) => entry.id === cleanText(property.ownerId));
    return company ? String(company.data.name ?? '') : '';
  }, [companies, property]);

  const objectMeters = useMemo(
    () =>
      property && Array.isArray(property.meters)
        ? property.meters.filter((meter) => meter && typeof meter === 'object')
        : [],
    [property]
  );

  const heatingEntries = useMemo(
    () =>
      property && Array.isArray(property.heatingEntries)
        ? property.heatingEntries.filter((entry) => entry && typeof entry === 'object')
        : [],
    [property]
  );

  const serviceOptions = useMemo(
    () =>
      [
        ...companies.map((entry) => ({
          href: `/admin/firma/${entry.id}`,
          label: cleanText(entry.data.name) || cleanText(entry.data.companyName) || entry.id,
          type: 'Firma',
          value: `company:${entry.id}`,
        })),
        ...people.map((entry) => ({
          href: `/admin/personen/${entry.id}`,
          label:
            [cleanText(entry.data.lastName), cleanText(entry.data.firstName)].filter(Boolean).join(', ') ||
            cleanText(entry.data.companyName) ||
            cleanText(entry.data.name) ||
            entry.id,
          type: 'Person',
          value: entry.id,
        })),
      ]
        .sort((left, right) => left.label.localeCompare(right.label, 'de')),
    [companies, people]
  );

  const assignedServices = useMemo(
    () =>
      servicePartnerFields
        .map((field) => {
          const value = cleanText(serviceAssignments[field.idField]);
          const option =
            serviceOptions.find((entry) => entry.value === value) ||
            serviceOptions.find((entry) => entry.value === `company:${value}`) ||
            null;
          return {
            field,
            href: option?.href || '',
            label: option?.label || value,
            type: option?.type || '',
            value,
          };
        })
        .filter((entry) => entry.value),
    [serviceAssignments, serviceOptions]
  );

  const unitCards = useMemo(() => {
    if (!property) return [];

    const units = Array.isArray(property.units) ? property.units : [];
    return units.map((unit) => {
      const unitId = cleanText(unit?.id);
      const linkedTenants = tenants
        .filter((tenant) => cleanText(tenant.data.unitId) === unitId)
        .sort((left, right) =>
          cleanText(right.data.moveInDate).localeCompare(cleanText(left.data.moveInDate), 'de')
        );

      const currentTenant =
        linkedTenants.find((tenant) => cleanText(tenant.data.status) === 'active') ??
        null;
      const upcomingTenants = linkedTenants.filter((tenant) => cleanText(tenant.data.status) === 'pending');

      return {
        currentTenant,
        id: unitId,
        isSelected: Boolean(selectedUnitId && selectedUnitId === unitId),
        label: unitDisplayLabel(unit) || unitId || 'Einheit',
        pastTenants: linkedTenants.filter((tenant) => cleanText(tenant.data.status) === 'inactive'),
        upcomingTenants,
      };
    });
  }, [property, selectedUnitId, tenants]);

  const propertyDocuments = useMemo(
    () => cleanStoredDocuments(property?.propertyDocuments),
    [property]
  );

  async function uploadPropertyDocuments(files: FileList | File[] | null, category = 'Sonstiges') {
    if (!files || files.length === 0 || !property) return;

    setError('');
    setSaveMessage('');
    setIsUploadingDocument(true);

    try {
      const uploadedDocuments: StoredDocumentEntry[] = [];

      for (const file of Array.from(files)) {
        const safeName = sanitizeStorageFileName(file.name);
        const storagePath = `property-documents/${propertyId}/object/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file, {
          contentType: file.type || 'application/octet-stream',
        });

        uploadedDocuments.push({
          category,
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

      await updateDoc(doc(db, 'properties', propertyId), {
        propertyDocuments: [...propertyDocuments, ...uploadedDocuments],
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });

      setSaveMessage(uploadedDocuments.length === 1 ? 'Dokument wurde hochgeladen.' : 'Dokumente wurden hochgeladen.');
    } catch (caughtError) {
      console.error(`Fehler beim Hochladen von Dokumenten fuer Immobilie ${propertyId}:`, caughtError);
      setError('Dokumente konnten nicht hochgeladen werden.');
    } finally {
      setIsUploadingDocument(false);
    }
  }

  async function updatePropertyDocumentCategory(targetDocument: StoredDocumentEntry, category: string) {
    setError('');
    setSaveMessage('');

    try {
      await updateDoc(doc(db, 'properties', propertyId), {
        propertyDocuments: propertyDocuments.map((document) =>
          (targetDocument.path && document.path === targetDocument.path) ||
          (!targetDocument.path && document.url === targetDocument.url)
            ? { ...document, category }
            : document
        ),
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });
      setSaveMessage('Kategorie wurde aktualisiert.');
    } catch (caughtError) {
      console.error(`Fehler beim Aktualisieren der Dokumentkategorie fuer Immobilie ${propertyId}:`, caughtError);
      setError('Kategorie konnte nicht gespeichert werden.');
    }
  }

  async function deletePropertyDocument(targetDocument: StoredDocumentEntry) {
    const confirmed = window.confirm(`Dokument "${targetDocument.name}" wirklich löschen?`);
    if (!confirmed) return;

    setError('');
    setSaveMessage('');
    setDeletingDocumentPath(targetDocument.path || targetDocument.url);

    try {
      if (targetDocument.path) {
        await deleteObject(ref(storage, targetDocument.path));
      }

      await updateDoc(doc(db, 'properties', propertyId), {
        propertyDocuments: propertyDocuments.filter(
          (document) =>
            (targetDocument.path && document.path !== targetDocument.path) ||
            (!targetDocument.path && document.url !== targetDocument.url)
        ),
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });

      setSaveMessage('Dokument wurde gelöscht.');
    } catch (caughtError) {
      console.error(`Fehler beim Loeschen eines Dokuments fuer Immobilie ${propertyId}:`, caughtError);
      setError('Dokument konnte nicht gelöscht werden.');
    } finally {
      setDeletingDocumentPath('');
    }
  }

  async function saveMaintenanceDate(
    kind: 'gutter' | 'heating' | 'roof',
    dateValue: string,
    reminderMonths: string,
    heatingId?: string
  ) {
    if (!property) return;

    setError('');
    setSaveMessage('');

    try {
      if (kind === 'heating' && heatingId) {
        const nextHeatingEntries = heatingEntries.map((entry) =>
          cleanText(entry.id) === heatingId
            ? {
                ...entry,
                lastMaintenance: dateValue || entry.lastMaintenance,
                maintenanceReminderMonths: reminderMonths || entry.maintenanceReminderMonths || '11',
              }
            : entry
        );
        await updateDoc(doc(db, 'properties', propertyId), {
          heatingEntries: nextHeatingEntries,
          updatedAt: serverTimestamp(),
          updatedByEmail: user?.email ?? null,
          updatedByUid: user?.uid ?? null,
        });
      } else {
        const dateField =
          kind === 'roof' ? 'roofMaintenanceLastMaintenance' : 'gutterCleaningLastMaintenance';
        const monthField =
          kind === 'roof' ? 'roofMaintenanceReminderMonths' : 'gutterCleaningReminderMonths';
        const existingDate =
          kind === 'roof' ? property.roofMaintenanceLastMaintenance : property.gutterCleaningLastMaintenance;
        const existingMonths =
          kind === 'roof' ? property.roofMaintenanceReminderMonths : property.gutterCleaningReminderMonths;
        await updateDoc(doc(db, 'properties', propertyId), {
          [dateField]: dateValue || existingDate || '',
          [monthField]: reminderMonths || existingMonths || '11',
          updatedAt: serverTimestamp(),
          updatedByEmail: user?.email ?? null,
          updatedByUid: user?.uid ?? null,
        });
      }

      setMaintenanceDrafts((current) => {
        const next = { ...current };
        delete next[heatingId ? `heating:${heatingId}` : kind];
        return next;
      });
      setMaintenanceMonthDrafts((current) => {
        const next = { ...current };
        delete next[heatingId ? `heating:${heatingId}` : kind];
        return next;
      });
      setSaveMessage('Wartung wurde dokumentiert.');
    } catch (caughtError) {
      console.error(`Fehler beim Speichern der Wartung fuer Immobilie ${propertyId}:`, caughtError);
      setError('Die Wartung konnte nicht gespeichert werden.');
    }
  }

  async function saveObjectMeterReading(meterId: string) {
    if (!property) return;
    const draft = meterReadingDrafts[meterId];
    if (!draft?.date || !draft?.value) return;

    const meters = Array.isArray(property.meters) ? property.meters : [];
    const targetMeter = meters.find(
      (entry: DocumentData) => entry && typeof entry === 'object' && cleanText(entry.id) === meterId
    );
    if (!targetMeter) return;

    setError('');
    setSaveMessage('');

    try {
      const nextMeters = meters.map((entry: DocumentData) =>
        entry && typeof entry === 'object' && cleanText(entry.id) === meterId
          ? {
              ...entry,
              latestReading: cleanText(draft.value),
              latestReadingDate: draft.date,
              readingHistory: appendReadingHistoryEntry(entry, {
                date: draft.date,
                note: '',
                value: cleanText(draft.value),
              }),
            }
          : entry
      );

      await updateDoc(doc(db, 'properties', propertyId), {
        meters: nextMeters,
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });

      setMeterReadingDrafts((current) => {
        const next = { ...current };
        delete next[meterId];
        return next;
      });
      setSaveMessage('Zählerstand wurde gespeichert.');
    } catch (caughtError) {
      console.error(`Fehler beim Speichern des Zaehlerstands ${propertyId}/${meterId}:`, caughtError);
      setError('Der Zählerstand konnte nicht gespeichert werden.');
    }
  }

  async function saveServiceAssignments() {
    if (!selectedServiceField) return;
    try {
      setError('');
      setSaveMessage('');
      await updateDoc(doc(db, 'properties', propertyId), {
        [selectedServiceField]: selectedServicePartnerId,
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });
      setServiceAssignments((current) => ({ ...current, [selectedServiceField]: selectedServicePartnerId }));
      setSaveMessage('Dienstleister wurde gespeichert.');
    } catch (caughtError) {
      console.error(`Fehler beim Speichern der Dienstleister fuer Immobilie ${propertyId}:`, caughtError);
      setError('Die Dienstleister konnten nicht gespeichert werden.');
    }
  }

  async function clearServiceAssignment(fieldId: string) {
    try {
      setError('');
      setSaveMessage('');
      await updateDoc(doc(db, 'properties', propertyId), {
        [fieldId]: '',
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });
      setServiceAssignments((current) => ({ ...current, [fieldId]: '' }));
      if (selectedServiceField === fieldId) setSelectedServicePartnerId('');
      setSaveMessage('Dienstleister-Zuordnung wurde entfernt.');
    } catch (caughtError) {
      console.error(`Fehler beim Entfernen der Dienstleister-Zuordnung fuer Immobilie ${propertyId}:`, caughtError);
      setError('Die Dienstleister-Zuordnung konnte nicht entfernt werden.');
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm leading-6 text-slate-600">
          Immobilie wird geladen...
        </div>
      </section>
    );
  }

  if (!property) {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-700">
          {error || 'Die Immobilie wurde nicht gefunden.'}
        </div>
      </section>
    );
  }

  return (
    <div className="admin-page space-y-4">
      <section className="admin-hero rounded-[28px] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,250,240,0.96)_0%,rgba(247,241,231,0.94)_100%)] p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.35)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Immobilie ansehen</p>
        <div className="mt-2 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat label="Objektnummer" value={property.propertyNumber} />
              <MiniStat label="Nutzungsart" value={translateUsageType(property.usageType)} />
              <MiniStat label="Eigentumsart" value={translateOwnershipType(property.ownershipType)} />
              <MiniStat label="Eigentuemer" value={ownerLabel} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
              href={`/admin/immobilie/${propertyId}/bearbeiten`}
            >
              Bearbeiten
            </Link>
            <Link
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
              href="/admin/immobilie"
            >
              Zur Immobilienuebersicht
            </Link>
          </div>
        </div>
      </section>

      <section className="admin-card rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Objektdaten</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Adresse" value={[property.street, property.houseNumber, property.postalCode, property.city].filter(Boolean).join(', ')} />
          <Field label="Bestand" value={`${translateUsageType(property.usageType)} / ${Array.isArray(property.units) ? property.units.length : 0} Einheiten`} />
          <Field label="Leerstand" value={String((Array.isArray(property.units) ? property.units : []).filter((unit) => unit && typeof unit === 'object' && !cleanText(unit.tenantId)).length)} />
          <Field label="Eigentum" value={[translateOwnershipType(property.ownershipType), ownerLabel].filter(Boolean).join(' / ')} />
          <Field label="Wirtschaftlichkeit" value={[cleanText(property.purchasePrice) ? `Kaufpreis ${cleanText(property.purchasePrice)}` : '', cleanText(property.initialYieldPercent) ? `Rendite ${cleanText(property.initialYieldPercent)}` : ''].filter(Boolean).join(' / ')} />
          <Field label="Technik" value={[cleanText(property.propertyNumber) ? `Objekt ${cleanText(property.propertyNumber)}` : '', property.hasCentralHeating === 'no' ? 'Keine Zentralheizung' : 'Zentralheizung'].filter(Boolean).join(' / ')} />
          {cleanText(property.ownershipType) === 'partial_ownership' ? (
            <>
              <Field label="Position Keller" value={property.basementPosition} />
              <Field label="Position Briefkasten" value={property.mailboxPosition} />
            </>
          ) : null}
        </div>
      </section>

      {false ? (
        <DocumentLibrarySection
          documents={propertyDocuments}
          isUploading={isUploadingDocument}
          onDelete={deletePropertyDocument}
          onUpdateCategory={updatePropertyDocumentCategory}
          onUpload={(files, category) => uploadPropertyDocuments(files, category)}
          title="Immobiliendateien"
        />
      ) : null}

      <section className="hidden">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Einheiten</p>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {unitCards.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-slate-600">
              Noch keine Einheiten hinterlegt.
            </div>
          ) : (
            unitCards.map((unit) => (
              <article
                className={`rounded-[20px] border px-4 py-4 ${
                  unit.isSelected ? 'border-amber-300 bg-amber-50/60' : 'border-stone-200 bg-stone-50'
                }`}
                key={unit.id || unit.label}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-slate-900">{unit.label}</p>
                  <Link
                    className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
                    href={`/admin/einheit/${propertyId}/${unit.id}`}
                  >
                    Ansehen
                  </Link>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Field
                    label="Aktueller Mieter"
                    value={
                      unit.currentTenant
                        ? [cleanText(unit.currentTenant.data.lastName), cleanText(unit.currentTenant.data.firstName)]
                            .filter(Boolean)
                            .join(', ')
                        : 'Kein Mieter zugeordnet'
                    }
                  />
                  <Field label="Einheits-ID" value={unit.id} />
                </div>
                {unit.upcomingTenants.length > 0 ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {unit.upcomingTenants.slice(0, 4).map((tenant) => (
                      <Field
                        key={tenant.id}
                        label="Vorgemerkt"
                        value={[cleanText(tenant.data.lastName), cleanText(tenant.data.firstName), cleanText(tenant.data.moveInDate) ? `ab ${cleanText(tenant.data.moveInDate)}` : '']
                          .filter(Boolean)
                          .join(', ')}
                      />
                    ))}
                  </div>
                ) : null}
                {unit.pastTenants.length > 0 ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {unit.pastTenants.slice(0, 4).map((tenant) => (
                      <Field
                        key={tenant.id}
                        label={formatValue(tenant.data.moveInDate)}
                        value={[cleanText(tenant.data.lastName), cleanText(tenant.data.firstName)]
                          .filter(Boolean)
                          .join(', ')}
                      />
                    ))}
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>

      <section className="admin-card rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Zaehleruebersicht</p>
          {objectMeters.length === 0 ? (
            <div className="mt-4 rounded-[20px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-slate-600">
              Noch keine Objekt-Zaehler hinterlegt.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-[18px] border border-stone-200">
              <div className="grid gap-3 bg-stone-100/70 px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-stone-500 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,2.4fr)]">
                <span>Zaehler</span>
                <span>Letzter Stand</span>
                <span>Datum</span>
                <span>Neuer Stand</span>
              </div>
              <div className="divide-y divide-stone-200 bg-white">
                {objectMeters.map((meter, index) => {
                  const meterId = cleanText(meter.id) || `meter-${index}`;
                  const draft = meterReadingDrafts[meterId] ?? { date: '', value: '' };
                  return (
                    <div
                      className="grid gap-3 px-4 py-3 text-sm text-slate-800 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,2.4fr)] md:items-center"
                      key={meterId}
                    >
                      <div className="min-w-0">
                        <Link
                          className="font-medium text-slate-900 underline-offset-4 hover:underline"
                          href={`/admin/zaehler/${propertyId}/${meterId}`}
                        >
                          {formatValue(meter.label || meter.type)}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {[cleanText(meter.meterNumber), cleanText(meter.position)].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <span>{formatValue(meter.latestReading)}</span>
                      <span>{formatValue(meter.latestReadingDate)}</span>
                      <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_170px_auto]">
                        <input
                          className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                          onChange={(event) =>
                            setMeterReadingDrafts((current) => ({
                              ...current,
                              [meterId]: { ...draft, value: event.target.value },
                            }))
                          }
                          placeholder="Stand"
                          value={draft.value}
                        />
                        <input
                          className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                          onChange={(event) =>
                            setMeterReadingDrafts((current) => ({
                              ...current,
                              [meterId]: { ...draft, date: event.target.value },
                            }))
                          }
                          type="date"
                          value={draft.date}
                        />
                        <button
                          className="rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={!draft.value || !draft.date}
                          onClick={() => void saveObjectMeterReading(meterId)}
                          type="button"
                        >
                          Speichern
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
      </section>

      <div className="hidden">
        <DetailCard title="Adresse und Bestand">
          <DetailRow label="Strasse" value={[property.street, property.houseNumber].filter(Boolean).join(' ')} />
          <DetailRow label="PLZ / Ort" value={[property.postalCode, property.city].filter(Boolean).join(' ')} />
          <DetailRow label="Baujahr" value={property.yearBuilt} />
          <DetailRow label="Nutzungsart" value={translateUsageType(property.usageType)} />
          {cleanText(property.ownershipType) === 'partial_ownership' ? (
            <>
              <DetailRow label="Position Keller" value={property.basementPosition} />
              <DetailRow label="Position Briefkasten" value={property.mailboxPosition} />
            </>
          ) : null}
          <DetailRow label="Einheiten" value={String(Array.isArray(property.units) ? property.units.length : 0)} />
          <DetailRow
            label="Leerstand"
            value={String(
              (Array.isArray(property.units) ? property.units : []).filter(
                (unit) => unit && typeof unit === 'object' && !cleanText(unit.tenantId)
              ).length
            )}
          />
        </DetailCard>

        <DetailCard title="Eigentum und Wirtschaftlichkeit">
          <DetailRow label="Kaufdatum" value={property.purchaseDate} />
          <DetailRow label="Eigentum seit" value={property.ownershipSince} />
          <DetailRow label="Kaufpreis" value={property.purchasePrice} />
          <DetailRow label="Anfangsrendite" value={property.initialYieldPercent} />
        </DetailCard>

        <DetailCard title="Technik">
          <DetailRow label="Objektnummer" value={property.propertyNumber} />
          <DetailRow label="Zentralheizung" value={property.hasCentralHeating === 'no' ? 'Nein' : 'Ja'} />
          <DetailRow
            label="Heizungsarten"
            value={
              heatingEntries.length > 0
                ? heatingEntries
                    .map((entry) =>
                      [translateHeatingType(entry.type), cleanText(entry.buildYear), cleanText(entry.lastMaintenance)]
                        .filter(Boolean)
                        .join(' · ')
                    )
                    .join(', ')
                : Array.isArray(property.heatingSystems)
                  ? property.heatingSystems
                      .map((entry) => translateHeatingType(entry))
                      .filter(Boolean)
                      .join(', ')
                  : translateHeatingType(property.heatingSystems)
            }
          />
        </DetailCard>

        <DetailCard title="Wartung">
          <DetailRow
            label="Heizungswartung"
            value={
              heatingEntries.length > 0
                ? heatingEntries
                    .map((entry) =>
                      [
                        translateHeatingType(entry.type),
                        cleanText(entry.lastMaintenance) ? `zuletzt ${cleanText(entry.lastMaintenance)}` : '',
                        formatReminderSummary(entry.lastMaintenance, entry.maintenanceReminderMonths),
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    )
                    .join(', ')
                : property.lastHeatingMaintenance
            }
          />
          <DetailRow label="Letzte Dachwartung" value={property.roofMaintenanceLastMaintenance} />
          <DetailRow
            label="Dach-Erinnerung"
            value={formatReminderSummary(property.roofMaintenanceLastMaintenance, property.roofMaintenanceReminderMonths)}
          />
          <DetailRow label="Letzte Regenrinnenreinigung" value={property.gutterCleaningLastMaintenance} />
          <DetailRow
            label="Rinnen-Erinnerung"
            value={formatReminderSummary(property.gutterCleaningLastMaintenance, property.gutterCleaningReminderMonths)}
          />
        </DetailCard>
      </div>

      <section className="admin-card rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Wartungen dokumentieren</p>
        <div className="mt-4 grid gap-3">
          {heatingEntries.length > 0 ? (
            heatingEntries.map((entry) => {
              const heatingId = cleanText(entry.id);
              const draftKey = `heating:${heatingId}`;
              const draftDate = maintenanceDrafts[draftKey] ?? '';
              const draftMonths = maintenanceMonthDrafts[draftKey] ?? (cleanText(entry.maintenanceReminderMonths) || '11');
              return (
                <MaintenanceRow
                  draftDate={draftDate}
                  draftMonths={draftMonths}
                  key={heatingId || cleanText(entry.type)}
                  label={`Heizung ${translateHeatingType(entry.type) ? `· ${translateHeatingType(entry.type)}` : ''}`}
                  lastDate={entry.lastMaintenance}
                  nextDate={formatReminderSummary(entry.lastMaintenance, entry.maintenanceReminderMonths)}
                  onChange={(value) => setMaintenanceDrafts((current) => ({ ...current, [draftKey]: value }))}
                  onMonthsChange={(value) => setMaintenanceMonthDrafts((current) => ({ ...current, [draftKey]: value }))}
                  onSave={() => void saveMaintenanceDate('heating', draftDate, draftMonths, heatingId)}
                />
              );
            })
          ) : (
            <div className="rounded-[18px] border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-slate-600">
              Keine zentrale Heizung hinterlegt.
            </div>
          )}
          <MaintenanceRow
            draftDate={maintenanceDrafts.roof ?? ''}
            draftMonths={maintenanceMonthDrafts.roof ?? (cleanText(property.roofMaintenanceReminderMonths) || '11')}
            label="Dach"
            lastDate={property.roofMaintenanceLastMaintenance}
            nextDate={formatReminderSummary(property.roofMaintenanceLastMaintenance, property.roofMaintenanceReminderMonths)}
            onChange={(value) => setMaintenanceDrafts((current) => ({ ...current, roof: value }))}
            onMonthsChange={(value) => setMaintenanceMonthDrafts((current) => ({ ...current, roof: value }))}
            onSave={() => void saveMaintenanceDate('roof', maintenanceDrafts.roof ?? '', maintenanceMonthDrafts.roof ?? (cleanText(property.roofMaintenanceReminderMonths) || '11'))}
          />
          <MaintenanceRow
            draftDate={maintenanceDrafts.gutter ?? ''}
            draftMonths={maintenanceMonthDrafts.gutter ?? (cleanText(property.gutterCleaningReminderMonths) || '11')}
            label="Regenrinnenreinigung"
            lastDate={property.gutterCleaningLastMaintenance}
            nextDate={formatReminderSummary(property.gutterCleaningLastMaintenance, property.gutterCleaningReminderMonths)}
            onChange={(value) => setMaintenanceDrafts((current) => ({ ...current, gutter: value }))}
            onMonthsChange={(value) => setMaintenanceMonthDrafts((current) => ({ ...current, gutter: value }))}
            onSave={() => void saveMaintenanceDate('gutter', maintenanceDrafts.gutter ?? '', maintenanceMonthDrafts.gutter ?? (cleanText(property.gutterCleaningReminderMonths) || '11'))}
          />
        </div>
      </section>

      {false ? (
        <DocumentLibrarySection
          documents={propertyDocuments}
          isUploading={isUploadingDocument}
          onDelete={deletePropertyDocument}
          onUpdateCategory={updatePropertyDocumentCategory}
          onUpload={(files, category) => uploadPropertyDocuments(files, category)}
          title="Immobiliendateien"
        />
      ) : null}

      <section className="hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Dokumente</p>
            <h3 className="mt-1 text-xl text-slate-950">Immobiliendateien</h3>
          </div>
          <div className="min-w-[min(100%,560px)] flex-1">
            <DocumentUploadControl
              disabled={isUploadingDocument}
              onUpload={(files) => uploadPropertyDocuments(files)}
            />
          </div>
          <label className="hidden">
            {isUploadingDocument ? 'Lädt hoch...' : 'Dokument hochladen'}
            <input
              className="hidden"
              disabled={isUploadingDocument}
              multiple
              onChange={(event) => {
                void uploadPropertyDocuments(event.target.files);
                event.target.value = '';
              }}
              type="file"
            />
          </label>
        </div>

        {propertyDocuments.length > 0 ? (
          <div className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-[18px] border border-stone-200">
            {propertyDocuments.map((propertyDocument) => {
              const isDeleting = deletingDocumentPath === (propertyDocument.path || propertyDocument.url);
              const meta = [formatFileSize(propertyDocument.size), formatUploadDate(propertyDocument.uploadedAt)]
                .filter(Boolean)
                .join(' · ');

              return (
                <div
                  className="grid gap-3 bg-white px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                  key={`${propertyDocument.path}-${propertyDocument.url}`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{propertyDocument.name}</p>
                    {meta ? <p className="mt-0.5 text-xs text-slate-500">{meta}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
                      href={propertyDocument.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Anschauen
                    </a>
                    <button
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isDeleting}
                      onClick={() => void deletePropertyDocument(propertyDocument)}
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
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Einheiten</p>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {unitCards.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-slate-600">
              Noch keine Einheiten hinterlegt.
            </div>
          ) : (
            unitCards.map((unit) => (
              <article
                className={`rounded-[20px] border px-4 py-4 ${
                  unit.isSelected ? 'border-amber-300 bg-amber-50/60' : 'border-stone-200 bg-stone-50'
                }`}
                key={unit.id || unit.label}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-slate-900">{unit.label}</p>
                  <Link
                    className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
                    href={`/admin/einheit/${propertyId}/${unit.id}`}
                  >
                    Ansehen
                  </Link>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Field
                    label="Aktueller Mieter"
                    value={
                      unit.currentTenant
                        ? [cleanText(unit.currentTenant.data.lastName), cleanText(unit.currentTenant.data.firstName)]
                            .filter(Boolean)
                            .join(', ')
                        : 'Kein Mieter zugeordnet'
                    }
                  />
                  <Field label="Einheits-ID" value={unit.id} />
                </div>
                {unit.pastTenants.length > 0 ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {unit.pastTenants.slice(0, 4).map((tenant) => (
                      <Field
                        key={tenant.id}
                        label={formatValue(tenant.data.moveInDate)}
                        value={[cleanText(tenant.data.lastName), cleanText(tenant.data.firstName)]
                          .filter(Boolean)
                          .join(', ')}
                      />
                    ))}
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>

      <section className="hidden">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Objektdaten</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Adresse" value={[property.street, property.houseNumber, property.postalCode, property.city].filter(Boolean).join(', ')} />
          <Field label="Bestand" value={`${translateUsageType(property.usageType)} / ${Array.isArray(property.units) ? property.units.length : 0} Einheiten`} />
          <Field label="Leerstand" value={String((Array.isArray(property.units) ? property.units : []).filter((unit) => unit && typeof unit === 'object' && !cleanText(unit.tenantId)).length)} />
          <Field label="Eigentum" value={[translateOwnershipType(property.ownershipType), ownerLabel].filter(Boolean).join(' / ')} />
          <Field label="Wirtschaftlichkeit" value={[cleanText(property.purchasePrice) ? `Kaufpreis ${cleanText(property.purchasePrice)}` : '', cleanText(property.initialYieldPercent) ? `Rendite ${cleanText(property.initialYieldPercent)}` : ''].filter(Boolean).join(' / ')} />
          <Field label="Technik" value={[cleanText(property.propertyNumber) ? `Objekt ${cleanText(property.propertyNumber)}` : '', property.hasCentralHeating === 'no' ? 'Keine Zentralheizung' : 'Zentralheizung'].filter(Boolean).join(' / ')} />
          {cleanText(property.ownershipType) === 'partial_ownership' ? (
            <>
              <Field label="Position Keller" value={property.basementPosition} />
              <Field label="Position Briefkasten" value={property.mailboxPosition} />
            </>
          ) : null}
        </div>
      </section>

      <section className="admin-card rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Dienstleister</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] lg:items-end">
          <label className="block">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Dienstleisterart</p>
            <select
              className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => {
                const nextField = event.target.value;
                setSelectedServiceField(nextField);
                setSelectedServicePartnerId(serviceAssignments[nextField] || '');
              }}
              value={selectedServiceField}
            >
              {servicePartnerFields.map((field) => (
                <option key={field.idField} value={field.idField}>
                  {field.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Firma / Person</p>
            <select
              className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => setSelectedServicePartnerId(event.target.value)}
              value={selectedServicePartnerId}
            >
              <option value="">Nicht zugeordnet</option>
              {serviceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.type})
                </option>
              ))}
            </select>
          </label>
          <button
            className="rounded-full border border-stone-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
            onClick={saveServiceAssignments}
            type="button"
          >
            Speichern
          </button>
        </div>
        <div className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-[18px] border border-stone-200">
          {assignedServices.length === 0 ? (
            <div className="bg-stone-50 px-4 py-3 text-sm text-slate-600">Noch keine Dienstleister zugeordnet.</div>
          ) : (
            assignedServices.map((entry) => (
              <div className="grid gap-2 bg-white px-4 py-3 text-sm md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-center" key={entry.field.idField}>
                <span className="font-medium text-slate-700">{entry.field.label}</span>
                {entry.href ? (
                  <Link className="text-slate-950 underline-offset-4 hover:underline" href={entry.href}>
                    {entry.label}
                  </Link>
                ) : (
                  <span className="text-slate-950">{entry.label}</span>
                )}
                <button
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-300"
                  onClick={() => void clearServiceAssignment(entry.field.idField)}
                  type="button"
                >
                  Entfernen
                </button>
              </div>
            ))
          )}
        </div>
        {saveMessage ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {saveMessage}
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <DocumentLibrarySection
        documents={propertyDocuments}
        isUploading={isUploadingDocument}
        onDelete={deletePropertyDocument}
        onUpdateCategory={updatePropertyDocumentCategory}
        onUpload={(files, category) => uploadPropertyDocuments(files, category)}
        title="Immobiliendateien"
      />
    </div>
  );
}

function DetailCard({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  if (title === 'Wartung') return null;

  return (
    <section className="admin-card rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">{title}</p>
      <div className="admin-card-body mt-4 grid gap-2.5">{children}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value?: unknown }) {
  return (
    <div className="admin-detail-row grid grid-cols-1 gap-1 border-b border-stone-100 py-3 text-sm last:border-b-0 md:grid-cols-[112px_minmax(0,1fr)] md:gap-3">
      <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</dt>
      <dd className="admin-detail-value min-w-0 whitespace-normal break-words leading-6 text-slate-900">{formatValue(value)}</dd>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: unknown }) {
  return (
    <div className="admin-field rounded-[14px] border border-stone-200 bg-white px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="admin-field-value mt-1 min-w-0 whitespace-normal break-words text-sm leading-6 text-slate-900">{formatValue(value)}</p>
    </div>
  );
}

function MaintenanceRow({
  draftDate,
  draftMonths,
  label,
  lastDate,
  nextDate,
  onChange,
  onMonthsChange,
  onSave,
}: {
  draftDate: string;
  draftMonths: string;
  label: string;
  lastDate?: unknown;
  nextDate?: unknown;
  onChange: (value: string) => void;
  onMonthsChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-[18px] border border-stone-200 bg-stone-50 p-4 md:grid-cols-[minmax(0,1fr)_180px_160px_auto] md:items-end">
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Letzte Wartung: {formatValue(lastDate)}{cleanText(nextDate) ? ` · Nächste Erinnerung: ${nextDate}` : ''}
        </p>
      </div>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Neues Datum</span>
        <input
          className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
          onChange={(event) => onChange(event.target.value)}
          type="date"
          value={draftDate}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Erinnerung</span>
        <select
          className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
          onChange={(event) => onMonthsChange(event.target.value)}
          value={draftMonths}
        >
          {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((month) => (
            <option key={month} value={month}>
              {month} Monate
            </option>
          ))}
        </select>
      </label>
      <button
        className="rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!draftDate && !draftMonths}
        onClick={onSave}
        type="button"
      >
        Wartung speichern
      </button>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value?: unknown }) {
  const formattedValue = formatValue(value);
  return (
    <div className="admin-field rounded-[14px] border border-stone-200 bg-white/72 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p
        className="admin-field-value mt-1 min-w-0 truncate whitespace-nowrap text-sm leading-6 text-slate-900"
        title={formattedValue}
      >
        {formattedValue}
      </p>
    </div>
  );
}
