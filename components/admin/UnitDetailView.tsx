'use client';

import { collection, doc, onSnapshot, serverTimestamp, updateDoc, type DocumentData } from 'firebase/firestore';
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

type UnitDetailViewProps = {
  propertyId: string;
  unitId: string;
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

const unitDisplayLabel = (unit: DocumentData) =>
  [cleanText(unit.unitLabel), cleanText(unit.floor), cleanText(unit.unitPosition), cleanText(unit.section)]
    .filter(Boolean)
    .join(' · ');

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

export default function UnitDetailView({ propertyId, unitId }: UnitDetailViewProps) {
  const { user } = useAuth();
  const [property, setProperty] = useState<DocumentData | null>(null);
  const [companies, setCompanies] = useState<AdminRecord[]>([]);
  const [people, setPeople] = useState<AdminRecord[]>([]);
  const [tenants, setTenants] = useState<AdminRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [deletingDocumentPath, setDeletingDocumentPath] = useState('');
  const [meterReadingDrafts, setMeterReadingDrafts] = useState<Record<string, ReadingDraft>>({});
  const [maintenanceDrafts, setMaintenanceDrafts] = useState<Record<string, string>>({});
  const [maintenanceMonthDrafts, setMaintenanceMonthDrafts] = useState<Record<string, string>>({});
  const [selectedServiceField, setSelectedServiceField] = useState<string>(servicePartnerFields[0]?.idField || '');
  const [selectedServicePartnerId, setSelectedServicePartnerId] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'properties', propertyId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setProperty(null);
          setError('Die Einheit wurde nicht gefunden.');
          setIsLoading(false);
          return;
        }

        setProperty(snapshot.data());
        setError('');
        setIsLoading(false);
      },
      (caughtError) => {
        console.error(`Fehler beim Laden der Einheit ${propertyId}/${unitId}:`, caughtError);
        setError('Die Einheitsdaten konnten nicht geladen werden.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [propertyId, unitId]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'tenants'), (snapshot) => {
      setTenants(
        snapshot.docs.map((documentSnapshot) => ({
          data: documentSnapshot.data(),
          id: documentSnapshot.id,
        }))
      );
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribers = [
      onSnapshot(collection(db, 'companies'), (snapshot) => {
        setCompanies(snapshot.docs.map((documentSnapshot) => ({ data: documentSnapshot.data(), id: documentSnapshot.id })));
      }),
      onSnapshot(collection(db, 'people'), (snapshot) => {
        setPeople(snapshot.docs.map((documentSnapshot) => ({ data: documentSnapshot.data(), id: documentSnapshot.id })));
      }),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const unit = useMemo(() => {
    if (!property || !Array.isArray(property.units)) return null;
    return (
      property.units.find(
        (entry: DocumentData) => entry && typeof entry === 'object' && cleanText(entry.id) === unitId
      ) ?? null
    );
  }, [property, unitId]);

  const currentTenant = useMemo(() => {
    if (!unit) return null;
    return (
      tenants.find(
        (tenant) =>
          cleanText(tenant.data.unitId) === unitId && cleanText(tenant.data.status) === 'active'
      ) ?? null
    );
  }, [tenants, unit, unitId]);

  const upcomingTenants = useMemo(
    () =>
      tenants
        .filter((tenant) => cleanText(tenant.data.unitId) === unitId && cleanText(tenant.data.status) === 'pending')
        .sort((left, right) =>
          cleanText(left.data.moveInDate).localeCompare(cleanText(right.data.moveInDate), 'de')
        ),
    [tenants, unitId]
  );

  const pastTenants = useMemo(
    () =>
      tenants
        .filter((tenant) => cleanText(tenant.data.unitId) === unitId && cleanText(tenant.data.status) === 'inactive')
        .sort((left, right) =>
          cleanText(right.data.moveInDate).localeCompare(cleanText(left.data.moveInDate), 'de')
        ),
    [tenants, unitId]
  );

  const unitMeters = useMemo(() => (unit && Array.isArray(unit.meters) ? unit.meters : []), [unit]);

  const unitHeatingEntries = useMemo(
    () => (unit && Array.isArray(unit.heatingEntries) ? unit.heatingEntries : []),
    [unit]
  );

  const unitDocuments = useMemo(() => cleanStoredDocuments(unit?.documents), [unit]);

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
      ].sort((left, right) => left.label.localeCompare(right.label, 'de')),
    [companies, people]
  );

  const serviceAssignments = useMemo(() => {
    const nextAssignments: Record<string, string> = {};
    for (const field of servicePartnerFields) {
      nextAssignments[field.idField] = cleanText(unit?.[field.idField]);
    }
    return nextAssignments;
  }, [unit]);

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
            value,
          };
        })
        .filter((entry) => entry.value),
    [serviceAssignments, serviceOptions]
  );

  useEffect(() => {
    setSelectedServicePartnerId(serviceAssignments[selectedServiceField] || '');
  }, [selectedServiceField, serviceAssignments]);

  async function uploadUnitDocuments(files: FileList | File[] | null, category = 'Sonstiges') {
    if (!files || files.length === 0 || !property || !unit) return;

    setError('');
    setMessage('');
    setIsUploadingDocument(true);

    try {
      const uploadedDocuments: StoredDocumentEntry[] = [];

      for (const file of Array.from(files)) {
        const safeName = sanitizeStorageFileName(file.name);
        const storagePath = `property-documents/${propertyId}/units/${unitId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
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

      const nextDocuments = [...unitDocuments, ...uploadedDocuments];
      const nextUnits = Array.isArray(property.units)
        ? property.units.map((entry: DocumentData) =>
            entry && typeof entry === 'object' && cleanText(entry.id) === unitId
              ? { ...entry, documents: nextDocuments }
              : entry
          )
        : [];

      await updateDoc(doc(db, 'properties', propertyId), {
        units: nextUnits,
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });

      setMessage(uploadedDocuments.length === 1 ? 'Dokument wurde hochgeladen.' : 'Dokumente wurden hochgeladen.');
    } catch (caughtError) {
      console.error(`Fehler beim Hochladen von Dokumenten fuer Einheit ${propertyId}/${unitId}:`, caughtError);
      setError('Dokumente konnten nicht hochgeladen werden.');
    } finally {
      setIsUploadingDocument(false);
    }
  }

  async function updateUnitDocumentCategory(targetDocument: StoredDocumentEntry, category: string) {
    if (!property || !unit) return;

    setError('');
    setMessage('');

    try {
      const nextDocuments = unitDocuments.map((document) =>
        (targetDocument.path && document.path === targetDocument.path) ||
        (!targetDocument.path && document.url === targetDocument.url)
          ? { ...document, category }
          : document
      );
      const nextUnits = Array.isArray(property.units)
        ? property.units.map((entry: DocumentData) =>
            entry && typeof entry === 'object' && cleanText(entry.id) === unitId
              ? { ...entry, documents: nextDocuments }
              : entry
          )
        : [];

      await updateDoc(doc(db, 'properties', propertyId), {
        units: nextUnits,
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });

      setMessage('Kategorie wurde aktualisiert.');
    } catch (caughtError) {
      console.error(`Fehler beim Aktualisieren der Dokumentkategorie fuer Einheit ${propertyId}/${unitId}:`, caughtError);
      setError('Kategorie konnte nicht gespeichert werden.');
    }
  }

  async function deleteUnitDocument(targetDocument: StoredDocumentEntry) {
    const confirmed = window.confirm(`Dokument "${targetDocument.name}" wirklich löschen?`);
    if (!confirmed || !property) return;

    setError('');
    setMessage('');
    setDeletingDocumentPath(targetDocument.path || targetDocument.url);

    try {
      if (targetDocument.path) {
        await deleteObject(ref(storage, targetDocument.path));
      }

      const nextDocuments = unitDocuments.filter(
        (document) =>
          (targetDocument.path && document.path !== targetDocument.path) ||
          (!targetDocument.path && document.url !== targetDocument.url)
      );
      const nextUnits = Array.isArray(property.units)
        ? property.units.map((entry: DocumentData) =>
            entry && typeof entry === 'object' && cleanText(entry.id) === unitId
              ? { ...entry, documents: nextDocuments }
              : entry
          )
        : [];

      await updateDoc(doc(db, 'properties', propertyId), {
        units: nextUnits,
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });

      setMessage('Dokument wurde gelöscht.');
    } catch (caughtError) {
      console.error(`Fehler beim Loeschen eines Dokuments fuer Einheit ${propertyId}/${unitId}:`, caughtError);
      setError('Dokument konnte nicht gelöscht werden.');
    } finally {
      setDeletingDocumentPath('');
    }
  }

  async function saveUnitMaintenanceDate(heatingId: string, dateValue: string, reminderMonths: string) {
    if (!property || !unit) return;
    const nextReminderMonths = cleanText(reminderMonths) || '11';
    const nextDate = cleanText(dateValue);

    setError('');
    setMessage('');

    try {
      const nextUnits = Array.isArray(property.units)
        ? property.units.map((entry: DocumentData) => {
            if (!entry || typeof entry !== 'object' || cleanText(entry.id) !== unitId) return entry;
            const heatingEntries = Array.isArray(entry.heatingEntries) ? entry.heatingEntries : [];
            return {
              ...entry,
              heatingEntries: heatingEntries.map((heatingEntry: DocumentData, index: number) => {
                const entryId = cleanText(heatingEntry.id) || `heating-${index}`;
                if (entryId !== heatingId) return heatingEntry;
                return {
                  ...heatingEntry,
                  lastMaintenance: nextDate || cleanText(heatingEntry.lastMaintenance),
                  maintenanceReminderMonths: nextReminderMonths,
                };
              }),
            };
          })
        : [];

      await updateDoc(doc(db, 'properties', propertyId), {
        units: nextUnits,
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });

      setMaintenanceDrafts((current) => {
        const next = { ...current };
        delete next[heatingId];
        return next;
      });
      setMaintenanceMonthDrafts((current) => {
        const next = { ...current };
        delete next[heatingId];
        return next;
      });
      setMessage('Wartung wurde gespeichert.');
    } catch (caughtError) {
      console.error(`Fehler beim Speichern der Einheitswartung ${propertyId}/${unitId}/${heatingId}:`, caughtError);
      setError('Die Wartung konnte nicht gespeichert werden.');
    }
  }

  async function saveUnitServiceAssignment() {
    if (!property || !unit || !selectedServiceField) return;
    setError('');
    setMessage('');

    try {
      const nextUnits = Array.isArray(property.units)
        ? property.units.map((entry: DocumentData) =>
            entry && typeof entry === 'object' && cleanText(entry.id) === unitId
              ? { ...entry, [selectedServiceField]: selectedServicePartnerId }
              : entry
          )
        : [];

      await updateDoc(doc(db, 'properties', propertyId), {
        units: nextUnits,
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });

      setMessage('Dienstleister wurde gespeichert.');
    } catch (caughtError) {
      console.error(`Fehler beim Speichern des Einheits-Dienstleisters ${propertyId}/${unitId}:`, caughtError);
      setError('Der Dienstleister konnte nicht gespeichert werden.');
    }
  }

  async function clearUnitServiceAssignment(fieldId: string) {
    if (!property || !unit) return;
    setError('');
    setMessage('');

    try {
      const nextUnits = Array.isArray(property.units)
        ? property.units.map((entry: DocumentData) =>
            entry && typeof entry === 'object' && cleanText(entry.id) === unitId
              ? { ...entry, [fieldId]: '' }
              : entry
          )
        : [];

      await updateDoc(doc(db, 'properties', propertyId), {
        units: nextUnits,
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });

      if (selectedServiceField === fieldId) setSelectedServicePartnerId('');
      setMessage('Dienstleister-Zuordnung wurde entfernt.');
    } catch (caughtError) {
      console.error(`Fehler beim Entfernen des Einheits-Dienstleisters ${propertyId}/${unitId}:`, caughtError);
      setError('Die Dienstleister-Zuordnung konnte nicht entfernt werden.');
    }
  }

  async function saveMeterReading(meterId: string, targetUnitId?: string) {
    if (!property) return;
    const draftKey = targetUnitId ? `${targetUnitId}:${meterId}` : meterId;
    const draft = meterReadingDrafts[draftKey];
    if (!draft?.date || !draft?.value) return;

    setError('');
    setMessage('');

    try {
      if (targetUnitId) {
        const nextUnits = Array.isArray(property.units)
          ? property.units.map((entry: DocumentData) => {
              if (!entry || typeof entry !== 'object' || cleanText(entry.id) !== targetUnitId) return entry;
              const meters = Array.isArray(entry.meters) ? entry.meters : [];
              return {
                ...entry,
                meters: meters.map((meter: DocumentData) =>
                  cleanText(meter.id) === meterId
                    ? {
                        ...meter,
                        latestReading: cleanText(draft.value),
                        latestReadingDate: draft.date,
                        readingHistory: appendReadingHistoryEntry(meter, {
                          date: draft.date,
                          note: '',
                          value: cleanText(draft.value),
                        }),
                      }
                    : meter
                ),
              };
            })
          : [];

        await updateDoc(doc(db, 'properties', propertyId), {
          units: nextUnits,
          updatedAt: serverTimestamp(),
          updatedByEmail: user?.email ?? null,
          updatedByUid: user?.uid ?? null,
        });
      } else {
        const meters = Array.isArray(property.meters) ? property.meters : [];
        const nextMeters = meters.map((meter: DocumentData) =>
          cleanText(meter.id) === meterId
            ? {
                ...meter,
                latestReading: cleanText(draft.value),
                latestReadingDate: draft.date,
                readingHistory: appendReadingHistoryEntry(meter, {
                  date: draft.date,
                  note: '',
                  value: cleanText(draft.value),
                }),
              }
            : meter
        );

        await updateDoc(doc(db, 'properties', propertyId), {
          meters: nextMeters,
          updatedAt: serverTimestamp(),
          updatedByEmail: user?.email ?? null,
          updatedByUid: user?.uid ?? null,
        });
      }

      setMeterReadingDrafts((current) => {
        const next = { ...current };
        delete next[draftKey];
        return next;
      });
      setMessage('Zählerstand wurde gespeichert.');
    } catch (caughtError) {
      console.error(`Fehler beim Speichern des Zaehlerstands ${propertyId}/${meterId}:`, caughtError);
      setError('Der Zählerstand konnte nicht gespeichert werden.');
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm leading-6 text-slate-600">
          Einheit wird geladen...
        </div>
      </section>
    );
  }

  if (!property || !unit) {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-700">
          {error || 'Die Einheit wurde nicht gefunden.'}
        </div>
      </section>
    );
  }

  return (
    <div className="admin-page space-y-4">
      <section className="admin-hero rounded-[24px] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,250,240,0.96)_0%,rgba(247,241,231,0.94)_100%)] p-4 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.35)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Einheit ansehen</p>
        <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat label="Objekt" value={property.name} />
              <MiniStat label="Geschoss" value={unit.floor} />
              <MiniStat label="Position" value={unit.unitPosition} />
              <MiniStat label="Status" value={currentTenant ? 'Belegt' : 'Leerstand'} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
              href={`/admin/immobilie/${propertyId}`}
            >
              Zur Immobilie
            </Link>
            {currentTenant ? (
              <Link
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
                href={`/admin/mieter/${currentTenant.id}`}
              >
                Zum Mieter
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="admin-card rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Einheitsdaten</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Einheit" value={[unit.unitLabel, unit.section, unit.floor, unit.unitPosition].filter(Boolean).join(' / ')} />
          <Field label="Nutzung" value={[unit.unitType, unit.rooms ? `${unit.rooms} Zimmer` : '', unit.areaSqm ? `${unit.areaSqm} m2` : ''].filter(Boolean).join(' / ')} />
          <Field label="Positionen" value={[cleanText(unit.basementPosition) ? `Keller ${cleanText(unit.basementPosition)}` : '', cleanText(unit.mailboxPosition) ? `Briefkasten ${cleanText(unit.mailboxPosition)}` : ''].filter(Boolean).join(' / ')} />
          <Field
            label="Aktueller Mieter"
            value={
              currentTenant
                ? [currentTenant.data.lastName, currentTenant.data.firstName, currentTenant.data.moveInDate ? `seit ${currentTenant.data.moveInDate}` : ''].filter(Boolean).join(', ')
                : 'Kein Mieter zugeordnet'
            }
          />
          <Field label="Kontakt" value={currentTenant ? [currentTenant.data.email, currentTenant.data.phone].filter(Boolean).join(' / ') : ''} />
          <Field
            label="Vorgemerkter Mieter"
            value={
              upcomingTenants.length === 0
                ? ''
                : upcomingTenants.map((tenant) => [tenant.data.lastName, tenant.data.firstName, tenant.data.moveInDate ? `ab ${tenant.data.moveInDate}` : ''].filter(Boolean).join(', ')).filter(Boolean).join(' / ')
            }
          />
          <Field
            label="Letzte Mieter"
            value={
              pastTenants.length === 0
                ? 'Keine frueheren Mieter hinterlegt'
                : pastTenants.map((tenant) => [tenant.data.lastName, tenant.data.firstName].filter(Boolean).join(', ')).filter(Boolean).join(' / ')
            }
          />
          <Field label="Notizen" value={unit.notes} />
        </div>
      </section>

      <MeterSection
        drafts={meterReadingDrafts}
        meters={unitMeters}
        onDraftChange={(key, draft) => setMeterReadingDrafts((current) => ({ ...current, [key]: draft }))}
        onSave={(meterId) => void saveMeterReading(meterId, unitId)}
        propertyId={propertyId}
        title="Einheiten-Zaehler"
        unitId={unitId}
      />

      {false ? (
        <DocumentLibrarySection
          documents={unitDocuments}
          isUploading={isUploadingDocument}
          onDelete={deleteUnitDocument}
          onUpdateCategory={updateUnitDocumentCategory}
          onUpload={(files, category) => uploadUnitDocuments(files, category)}
          title="Einheitsdateien"
        />
      ) : null}

      <section className="hidden">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Wartungen dokumentieren</p>
        <div className="mt-4 grid gap-3">
          {unitHeatingEntries.length > 0 ? (
            unitHeatingEntries.map((entry: DocumentData, index: number) => {
              const heatingId = cleanText(entry.id) || `heating-${index}`;
              const draftDate = maintenanceDrafts[heatingId] ?? '';
              const draftMonths = maintenanceMonthDrafts[heatingId] ?? (cleanText(entry.maintenanceReminderMonths) || '11');
              return (
                <MaintenanceRow
                  draftDate={draftDate}
                  draftMonths={draftMonths}
                  key={heatingId}
                  label={`Heizung ${formatValue(entry.type)}`}
                  lastDate={entry.lastMaintenance}
                  nextDate={formatReminderSummary(entry.lastMaintenance, entry.maintenanceReminderMonths)}
                  onChange={(value) => setMaintenanceDrafts((current) => ({ ...current, [heatingId]: value }))}
                  onMonthsChange={(value) => setMaintenanceMonthDrafts((current) => ({ ...current, [heatingId]: value }))}
                  onSave={() => void saveUnitMaintenanceDate(heatingId, draftDate, draftMonths)}
                />
              );
            })
          ) : (
            <div className="rounded-[18px] border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-slate-600">
              Keine eigene Heizung oder Therme in dieser Einheit hinterlegt.
            </div>
          )}
        </div>
      </section>

      <div className="hidden">
        <DetailCard title="Einheit">
          <DetailRow label="Einheit" value={unit.unitLabel} />
          <DetailRow label="Gebäudeteil" value={unit.section} />
          <DetailRow label="Art" value={unit.unitType} />
          <DetailRow label="Zimmer" value={unit.rooms} />
          <DetailRow label="Position Keller" value={unit.basementPosition} />
          <DetailRow label="Position Briefkasten" value={unit.mailboxPosition} />
          <DetailRow label="Fläche" value={unit.areaSqm ? `${unit.areaSqm} m²` : ''} />
        </DetailCard>

        <DetailCard title="Aktueller Mieter">
          <DetailRow
            label="Name"
            value={
              currentTenant
                ? [currentTenant.data.lastName, currentTenant.data.firstName].filter(Boolean).join(', ')
                : 'Kein Mieter zugeordnet'
            }
          />
          <DetailRow label="Einzug" value={currentTenant?.data.moveInDate} />
          <DetailRow label="E-Mail" value={currentTenant?.data.email} />
          <DetailRow label="Telefon" value={currentTenant?.data.phone} />
        </DetailCard>

        <DetailCard title="Letzte Mieter">
          {pastTenants.length === 0 ? (
            <p className="text-sm text-slate-600">Keine früheren Mieter hinterlegt.</p>
          ) : (
            <div className="grid gap-2">
              {pastTenants.map((tenant) => (
                <Field
                  key={tenant.id}
                  label={formatValue(tenant.data.moveInDate)}
                  value={[tenant.data.lastName, tenant.data.firstName].filter(Boolean).join(', ')}
                />
              ))}
            </div>
          )}
        </DetailCard>

        <DetailCard title="Notizen">
          <div className="grid gap-3">
            {unitHeatingEntries.length > 0 ? (
              <div className="grid gap-2">
                {unitHeatingEntries.map((entry: DocumentData) => (
                  <Field
                    key={entry.id}
                    label={formatValue(entry.type)}
                    value={[
                      formatValue(entry.buildYear),
                      formatValue(entry.lastMaintenance),
                      formatReminderSummary(entry.lastMaintenance, entry.maintenanceReminderMonths),
                    ].join(' · ')}
                  />
                ))}
              </div>
            ) : null}
            <p className="text-sm leading-6 text-slate-700">{formatValue(unit.notes)}</p>
          </div>
        </DetailCard>
      </div>

      <section className="hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Dokumente</p>
            <h3 className="mt-1 text-xl text-slate-950">Einheitsdateien</h3>
          </div>
          <div className="min-w-[min(100%,560px)] flex-1">
            <DocumentUploadControl
              disabled={isUploadingDocument}
              onUpload={(files) => uploadUnitDocuments(files)}
            />
          </div>
          <label className="hidden">
            {isUploadingDocument ? 'Lädt hoch...' : 'Dokument hochladen'}
            <input
              className="hidden"
              disabled={isUploadingDocument}
              multiple
              onChange={(event) => {
                void uploadUnitDocuments(event.target.files);
                event.target.value = '';
              }}
              type="file"
            />
          </label>
        </div>

        {unitDocuments.length > 0 ? (
          <div className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-[18px] border border-stone-200">
            {unitDocuments.map((unitDocument) => {
              const isDeleting = deletingDocumentPath === (unitDocument.path || unitDocument.url);
              const meta = [formatFileSize(unitDocument.size), formatUploadDate(unitDocument.uploadedAt)]
                .filter(Boolean)
                .join(' · ');

              return (
                <div
                  className="grid gap-3 bg-white px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                  key={`${unitDocument.path}-${unitDocument.url}`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{unitDocument.name}</p>
                    {meta ? <p className="mt-0.5 text-xs text-slate-500">{meta}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
                      href={unitDocument.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Anschauen
                    </a>
                    <button
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isDeleting}
                      onClick={() => void deleteUnitDocument(unitDocument)}
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

        {message ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </section>

      <section className="hidden">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Einheitsdaten</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Einheit" value={[unit.unitLabel, unit.section, unit.floor, unit.unitPosition].filter(Boolean).join(' / ')} />
          <Field label="Nutzung" value={[unit.unitType, unit.rooms ? `${unit.rooms} Zimmer` : '', unit.areaSqm ? `${unit.areaSqm} m2` : ''].filter(Boolean).join(' / ')} />
          <Field label="Positionen" value={[cleanText(unit.basementPosition) ? `Keller ${cleanText(unit.basementPosition)}` : '', cleanText(unit.mailboxPosition) ? `Briefkasten ${cleanText(unit.mailboxPosition)}` : ''].filter(Boolean).join(' / ')} />
          <Field
            label="Aktueller Mieter"
            value={
              currentTenant
                ? [currentTenant.data.lastName, currentTenant.data.firstName, currentTenant.data.moveInDate ? `seit ${currentTenant.data.moveInDate}` : ''].filter(Boolean).join(', ')
                : 'Kein Mieter zugeordnet'
            }
          />
          <Field label="Kontakt" value={currentTenant ? [currentTenant.data.email, currentTenant.data.phone].filter(Boolean).join(' / ') : ''} />
          <Field
            label="Letzte Mieter"
            value={
              pastTenants.length === 0
                ? 'Keine frueheren Mieter hinterlegt'
                : pastTenants.map((tenant) => [tenant.data.lastName, tenant.data.firstName].filter(Boolean).join(', ')).filter(Boolean).join(' / ')
            }
          />
          <Field label="Notizen" value={unit.notes} />
        </div>
      </section>

      <section className="admin-card rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Dienstleister</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] lg:items-end">
          <label className="block">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Dienstleisterart</p>
            <select
              className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => setSelectedServiceField(event.target.value)}
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
            onClick={() => void saveUnitServiceAssignment()}
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
                  onClick={() => void clearUnitServiceAssignment(entry.field.idField)}
                  type="button"
                >
                  Entfernen
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <DocumentLibrarySection
        documents={unitDocuments}
        isUploading={isUploadingDocument}
        onDelete={deleteUnitDocument}
        onUpdateCategory={updateUnitDocumentCategory}
        onUpload={(files, category) => uploadUnitDocuments(files, category)}
        title="Einheitsdateien"
      />
    </div>
  );
}

function MeterSection({
  drafts,
  meters,
  onDraftChange,
  onSave,
  propertyId,
  title,
  unitId,
}: {
  drafts: Record<string, ReadingDraft>;
  meters: DocumentData[];
  onDraftChange: (key: string, draft: ReadingDraft) => void;
  onSave: (meterId: string) => void;
  propertyId: string;
  title: string;
  unitId?: string;
}) {
  return (
    <section className="admin-card rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">{title}</p>
      {meters.length === 0 ? (
        <div className="mt-4 rounded-[20px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-slate-600">
          Keine Zähler hinterlegt.
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {meters.map((meter, index) => {
            const meterId = cleanText(meter.id) || `meter-${index}`;
            const draftKey = unitId ? `${unitId}:${meterId}` : meterId;
            const draft = drafts[draftKey] ?? { date: '', value: '' };
            return (
              <article className="rounded-[18px] border border-stone-200 bg-stone-50 p-4" key={meterId}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {[formatValue(meter.label || meter.meterType || meter.type), cleanText(meter.meterNumber) ? `(${cleanText(meter.meterNumber)})` : '']
                        .filter(Boolean)
                        .join(' ')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{formatValue(meter.position)}</p>
                  </div>
                  <Link
                    className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
                    href={unitId ? `/admin/zaehler/${propertyId}/${meterId}?unit=${unitId}` : `/admin/zaehler/${propertyId}/${meterId}`}
                  >
                    Details
                  </Link>
                </div>
                <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.2fr)_repeat(2,minmax(0,0.8fr))]">
                  <Field label="Letzter Stand" value={meter.latestReading} />
                  <Field label="Datum Zählerstand" value={meter.latestReadingDate} />
                  <Field label="Eichdatum" value={meter.calibrationDate} />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
                  <input
                    className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                    onChange={(event) => onDraftChange(draftKey, { ...draft, value: event.target.value })}
                    placeholder="Neuer Stand"
                    value={draft.value}
                  />
                  <input
                    className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                    onChange={(event) => onDraftChange(draftKey, { ...draft, date: event.target.value })}
                    type="date"
                    value={draft.date}
                  />
                  <button
                    className="rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!draft.value || !draft.date}
                    onClick={() => onSave(meterId)}
                    type="button"
                  >
                    Speichern
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
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
  nextDate?: string;
  onChange: (value: string) => void;
  onMonthsChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-[18px] border border-stone-200 bg-stone-50 p-4 md:grid-cols-[minmax(0,1fr)_160px_170px_auto] md:items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Letzte Wartung: {formatValue(lastDate)}
          {nextDate ? ` / Erinnerung: ${nextDate}` : ''}
        </p>
      </div>
      <input
        className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={draftDate}
      />
      <select
        className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
        onChange={(event) => onMonthsChange(event.target.value)}
        value={draftMonths}
      >
        {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((monthValue) => (
          <option key={monthValue} value={monthValue}>
            {monthValue} Monate
          </option>
        ))}
      </select>
      <button
        className="rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
        onClick={onSave}
        type="button"
      >
        Speichern
      </button>
    </div>
  );
}

function DetailCard({ children, title }: { children: React.ReactNode; title: string }) {
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

function MiniStat({ label, value }: { label: string; value?: unknown }) {
  return (
    <div className="admin-field rounded-[12px] border border-stone-200 bg-white/72 px-3 py-1.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="admin-field-value mt-0.5 min-w-0 whitespace-normal break-words text-sm leading-5 text-slate-900">{formatValue(value)}</p>
    </div>
  );
}
