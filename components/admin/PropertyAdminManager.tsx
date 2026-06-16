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
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db, storage } from '../../lib/firebase';
import {
  cleanStoredDocuments,
  sanitizeStorageFileName,
  type StoredDocumentEntry,
} from '../../lib/tenantDocuments';
import PendingDocumentUploadSection, { type PendingCategorizedFile } from './PendingDocumentUploadSection';

type AdminRecord = {
  data: DocumentData;
  id: string;
};

type MeterEntry = {
  calibrationDate: string;
  exchanges: Array<Record<string, string>>;
  id: string;
  initialReading: string;
  initialReadingDate: string;
  label: string;
  latestReading: string;
  latestReadingDate: string;
  meterNumber: string;
  position: string;
  readingHistory: Array<Record<string, string>>;
  type: string;
};

type HeatingEntry = {
  buildYear: string;
  id: string;
  lastMaintenance: string;
  maintenanceReminderMonths: string;
  type: string;
};

type KeyEntry = {
  count: string;
  id: string;
  label: string;
};

type UnitForm = {
  areaSqm: string;
  basementPosition: string;
  documents: StoredDocumentEntry[];
  floor: string;
  heatingDraftType: string;
  heatingEntries: HeatingEntry[];
  id: string;
  keys: KeyEntry[];
  meterDraftType: string;
  meters: MeterEntry[];
  notes: string;
  mailboxPosition: string;
  rooms: string;
  section: string;
  tenantId: string;
  tenantName: string;
  unitLabel: string;
  unitPosition: string;
  unitType: string;
};

type PropertyFormState = {
  basementPosition: string;
  billingServiceId: string;
  carpenterServiceId: string;
  chimneySweepServiceId: string;
  city: string;
  cleaningServiceId: string;
  country: string;
  hasCentralHeating: string;
  electricianId: string;
  gardeningServiceId: string;
  gutterCleaningId: string;
  gutterCleaningLastMaintenance: string;
  gutterCleaningReminderMonths: string;
  heatingDraftType: string;
  heatingServiceId: string;
  heatingEntries: HeatingEntry[];
  houseNumber: string;
  initialYieldPercent: string;
  janitorId: string;
  landRegisterReference: string;
  locksmithServiceId: string;
  meterDraftType: string;
  meters: MeterEntry[];
  name: string;
  notes: string;
  mailboxPosition: string;
  otherServiceId: string;
  ownerId: string;
  ownerName: string;
  painterServiceId: string;
  propertyDocuments: StoredDocumentEntry[];
  ownershipSince: string;
  ownershipType: string;
  plumbingServiceId: string;
  postalCode: string;
  propertyNumber: string;
  purchaseDate: string;
  purchasePrice: string;
  roofMaintenanceId: string;
  roofMaintenanceLastMaintenance: string;
  roofMaintenanceReminderMonths: string;
  street: string;
  usageType: string;
  wasteCollectionId: string;
  wegManagerId: string;
  windowDoorServiceId: string;
  winterServiceId: string;
  yearBuilt: string;
};

const usageOptions = [
  { label: 'Wohnen', value: 'residential' },
  { label: 'Gewerbe', value: 'commercial' },
  { label: 'Lager / Logistik', value: 'logistics' },
  { label: 'Mischnutzung', value: 'mixed_use' },
  { label: 'Stellplatz', value: 'parking' },
];

const ownershipOptions = [
  { label: 'Volleigentum', value: 'full_ownership' },
  { label: 'Teileigentum', value: 'partial_ownership' },
];

const objectMeterOptions = [
  { label: 'Stromzähler Allgemein', value: 'electricity_general' },
  { label: 'Wasserzähler Kalt', value: 'cold_water' },
  { label: 'Hauptwasserzähler', value: 'main_water' },
  { label: 'Wasserzähler Warm', value: 'hot_water' },
  { label: 'Gaszähler', value: 'gas' },
  { label: 'Heizzähler', value: 'heating' },
  { label: 'Wärmemengenzähler', value: 'heat_quantity' },
  { label: 'Fernwärmezähler', value: 'district_heating' },
  { label: 'Gartenwasserzähler', value: 'garden_water' },
  { label: 'Sonstiger Zähler', value: 'other' },
];

const unitMeterOptions = [
  { label: 'Stromzähler', value: 'electricity' },
  { label: 'Wasserzähler Kalt', value: 'cold_water' },
  { label: 'Hauptwasserzähler', value: 'main_water' },
  { label: 'Wasserzähler Warm', value: 'hot_water' },
  { label: 'Gaszähler', value: 'gas' },
  { label: 'Heizzähler', value: 'heating' },
  { label: 'Wärmemengenzähler', value: 'heat_quantity' },
  { label: 'Gartenwasserzähler', value: 'garden_water' },
  { label: 'Sonstiger Zähler', value: 'other' },
];

const heatingSystemOptions = [
  { label: 'Gas', value: 'gas' },
  { label: 'Elektro', value: 'electric' },
  { label: 'Fernwärme', value: 'district_heating' },
  { label: 'Öl', value: 'oil' },
  { label: 'Wärmepumpe Luft', value: 'heat_pump_air' },
  { label: 'Wärmepumpe Erde', value: 'heat_pump_ground' },
];

const floorOptions = [
  'Souterrain',
  'Keller',
  'EG',
  '1. OG',
  '2. OG',
  '3. OG',
  '4. OG',
  'Dachgeschoss',
  'Dachetage',
  'Maisonette',
  'Penthouse',
];

const sectionOptions = [
  'Vorderhaus',
  'Hinterhaus',
  'Seitenflügel links',
  'Seitenflügel rechts',
  'Remise',
  'Hofgebäude',
  'Gartenhaus',
  'Anbau',
  'Sonstige Lage',
];

const unitPositionOptions = [
  { label: 'links', value: 'li' },
  { label: 'mittig', value: 'mi' },
  { label: 'rechts', value: 're' },
];

const unitTypeOptions = ['Wohnung', 'Gewerbe', 'Stellplatz', 'Lager', 'Keller', 'Sonstige Einheit'];

const servicePartnerFields = [
  { idField: 'billingServiceId', label: 'Abrechnungsunternehmen' },
  { idField: 'roofMaintenanceId', label: 'Dachdecker / Dachwartung' },
  { idField: 'electricianId', label: 'Elektriker' },
  { idField: 'windowDoorServiceId', label: 'Fenster / Türen' },
  { idField: 'gardeningServiceId', label: 'Gartenpflege' },
  { idField: 'janitorId', label: 'Hausmeister' },
  { idField: 'cleaningServiceId', label: 'Hausreinigung' },
  { idField: 'heatingServiceId', label: 'Heizung' },
  { idField: 'painterServiceId', label: 'Maler' },
  { idField: 'wasteCollectionId', label: 'Müllabfuhr' },
  { idField: 'gutterCleaningId', label: 'Regenrinnenreinigung' },
  { idField: 'plumbingServiceId', label: 'Rohrreinigung / Sanitär' },
  { idField: 'locksmithServiceId', label: 'Schlüsseldienst' },
  { idField: 'chimneySweepServiceId', label: 'Schornsteinfeger' },
  { idField: 'otherServiceId', label: 'Sonstiges' },
  { idField: 'carpenterServiceId', label: 'Tischler' },
  { idField: 'winterServiceId', label: 'Winterdienst' },
] as const;

type ServiceFieldId = (typeof servicePartnerFields)[number]['idField'];

const defaultFormState = (): PropertyFormState => ({
  basementPosition: '',
  billingServiceId: '',
  carpenterServiceId: '',
  chimneySweepServiceId: '',
  city: '',
  cleaningServiceId: '',
  country: 'Deutschland',
  hasCentralHeating: 'yes',
  electricianId: '',
  gardeningServiceId: '',
  gutterCleaningId: '',
  gutterCleaningLastMaintenance: '',
  gutterCleaningReminderMonths: '11',
  heatingDraftType: '',
  heatingServiceId: '',
  heatingEntries: [],
  houseNumber: '',
  initialYieldPercent: '',
  janitorId: '',
  landRegisterReference: '',
  locksmithServiceId: '',
  meterDraftType: '',
  meters: [],
  name: '',
  notes: '',
  mailboxPosition: '',
  ownerId: '',
  ownerName: '',
  otherServiceId: '',
  painterServiceId: '',
  propertyDocuments: [],
  ownershipSince: '',
  ownershipType: '',
  plumbingServiceId: '',
  postalCode: '',
  propertyNumber: '',
  purchaseDate: '',
  purchasePrice: '',
  roofMaintenanceId: '',
  roofMaintenanceLastMaintenance: '',
  roofMaintenanceReminderMonths: '11',
  street: '',
  usageType: '',
  wasteCollectionId: '',
  wegManagerId: '',
  windowDoorServiceId: '',
  winterServiceId: '',
  yearBuilt: '',
});

const createUnit = (): UnitForm => ({
  areaSqm: '',
  basementPosition: '',
  documents: [],
  floor: '',
  heatingDraftType: '',
  heatingEntries: [],
  id: crypto.randomUUID(),
  keys: [],
  meterDraftType: '',
  meters: [],
  mailboxPosition: '',
  notes: '',
  rooms: '',
  section: '',
  tenantId: '',
  tenantName: '',
  unitLabel: '',
  unitPosition: '',
  unitType: '',
});

const mapMeterEntry = (meter: unknown): MeterEntry | null => {
  if (!meter || typeof meter !== 'object') return null;
  return {
    calibrationDate: String((meter as DocumentData).calibrationDate ?? ''),
    exchanges: Array.isArray((meter as DocumentData).exchanges)
      ? ((meter as DocumentData).exchanges as Array<Record<string, string>>)
      : [],
    id: String((meter as DocumentData).id ?? crypto.randomUUID()),
    initialReading: String((meter as DocumentData).initialReading ?? ''),
    initialReadingDate: String((meter as DocumentData).initialReadingDate ?? ''),
    label: String((meter as DocumentData).label ?? ''),
    latestReading: String((meter as DocumentData).latestReading ?? ''),
    latestReadingDate: String((meter as DocumentData).latestReadingDate ?? ''),
    meterNumber: String((meter as DocumentData).meterNumber ?? ''),
    position: String((meter as DocumentData).position ?? ''),
    readingHistory: Array.isArray((meter as DocumentData).readingHistory)
      ? ((meter as DocumentData).readingHistory as Array<Record<string, string>>)
      : [],
    type: String((meter as DocumentData).type ?? ''),
  };
};

const mapHeatingEntry = (entry: unknown): HeatingEntry | null => {
  if (!entry || typeof entry !== 'object') return null;
  return {
    buildYear: String((entry as DocumentData).buildYear ?? ''),
    id: String((entry as DocumentData).id ?? crypto.randomUUID()),
    lastMaintenance: String((entry as DocumentData).lastMaintenance ?? ''),
    maintenanceReminderMonths: String((entry as DocumentData).maintenanceReminderMonths ?? '11'),
    type: String((entry as DocumentData).type ?? ''),
  };
};

const mapKeyEntry = (entry: unknown): KeyEntry | null => {
  if (!entry || typeof entry !== 'object') return null;
  return {
    count: String((entry as DocumentData).count ?? ''),
    id: String((entry as DocumentData).id ?? crypto.randomUUID()),
    label: String((entry as DocumentData).label ?? ''),
  };
};

const mapUnit = (unit: unknown): UnitForm | null => {
  if (!unit || typeof unit !== 'object') return null;
  return {
    areaSqm: String((unit as DocumentData).areaSqm ?? ''),
    basementPosition: String((unit as DocumentData).basementPosition ?? ''),
    documents: cleanStoredDocuments((unit as DocumentData).documents),
    floor: String((unit as DocumentData).floor ?? ''),
    heatingDraftType: '',
    heatingEntries: Array.isArray((unit as DocumentData).heatingEntries)
      ? ((unit as DocumentData).heatingEntries as unknown[])
          .map(mapHeatingEntry)
          .filter((entry): entry is HeatingEntry => Boolean(entry))
      : [],
    id: String((unit as DocumentData).id ?? crypto.randomUUID()),
    keys: Array.isArray((unit as DocumentData).keys)
      ? ((unit as DocumentData).keys as unknown[])
          .map(mapKeyEntry)
          .filter((entry): entry is KeyEntry => Boolean(entry))
      : [],
    meterDraftType: '',
    meters: Array.isArray((unit as DocumentData).meters)
      ? ((unit as DocumentData).meters as unknown[])
          .map(mapMeterEntry)
          .filter((entry): entry is MeterEntry => Boolean(entry))
      : [],
    mailboxPosition: String((unit as DocumentData).mailboxPosition ?? ''),
    notes: String((unit as DocumentData).notes ?? ''),
    rooms: String((unit as DocumentData).rooms ?? ''),
    section: String((unit as DocumentData).section ?? ''),
    tenantId: String((unit as DocumentData).tenantId ?? ''),
    tenantName: String((unit as DocumentData).tenantName ?? ''),
    unitLabel: String((unit as DocumentData).unitLabel ?? ''),
    unitPosition: String((unit as DocumentData).unitPosition ?? ''),
    unitType: String((unit as DocumentData).unitType ?? ''),
  };
};

const mapPropertyDataToFormState = (data: DocumentData): PropertyFormState => ({
  basementPosition: String(data.basementPosition ?? ''),
  billingServiceId: String(data.billingServiceId ?? ''),
  carpenterServiceId: String(data.carpenterServiceId ?? ''),
  chimneySweepServiceId: String(data.chimneySweepServiceId ?? ''),
  city: String(data.city ?? ''),
  cleaningServiceId: String(data.cleaningServiceId ?? ''),
  country: String(data.country ?? 'Deutschland'),
  hasCentralHeating: String(data.hasCentralHeating ?? 'yes'),
  electricianId: String(data.electricianId ?? ''),
  gardeningServiceId: String(data.gardeningServiceId ?? ''),
  gutterCleaningId: String(data.gutterCleaningId ?? ''),
  gutterCleaningLastMaintenance: String(data.gutterCleaningLastMaintenance ?? ''),
  gutterCleaningReminderMonths: String(data.gutterCleaningReminderMonths ?? '11'),
  heatingDraftType: '',
  heatingServiceId: String(data.heatingServiceId ?? ''),
  heatingEntries: Array.isArray(data.heatingEntries)
    ? data.heatingEntries
        .map(mapHeatingEntry)
        .filter((entry): entry is HeatingEntry => Boolean(entry))
    : Array.isArray(data.heatingSystems)
      ? data.heatingSystems
          .map((entry: unknown) =>
            mapHeatingEntry({
              buildYear: data.heatingBuildYear ?? '',
              lastMaintenance: data.lastHeatingMaintenance ?? '',
              maintenanceReminderMonths: data.heatingMaintenanceReminderMonths ?? '11',
              type: String(entry),
            })
          )
          .filter((entry): entry is HeatingEntry => Boolean(entry))
      : [],
  houseNumber: String(data.houseNumber ?? ''),
  initialYieldPercent: String(data.initialYieldPercent ?? ''),
  janitorId: String(data.janitorId ?? ''),
  landRegisterReference: String(data.landRegisterReference ?? ''),
  locksmithServiceId: String(data.locksmithServiceId ?? ''),
  meterDraftType: '',
  meters: Array.isArray(data.meters)
    ? data.meters
        .map(mapMeterEntry)
        .filter((entry): entry is MeterEntry => Boolean(entry))
    : [],
  name: String(data.name ?? ''),
  notes: String(data.notes ?? ''),
  mailboxPosition: String(data.mailboxPosition ?? ''),
  ownerId: String(data.ownerId ?? ''),
  ownerName: String(data.ownerName ?? ''),
  otherServiceId: String(data.otherServiceId ?? ''),
  painterServiceId: String(data.painterServiceId ?? ''),
  propertyDocuments: cleanStoredDocuments(data.propertyDocuments),
  ownershipSince: String(data.ownershipSince ?? ''),
  ownershipType: String(data.ownershipType ?? ''),
  plumbingServiceId: String(data.plumbingServiceId ?? ''),
  postalCode: String(data.postalCode ?? ''),
  propertyNumber: String(data.propertyNumber ?? ''),
  purchaseDate: String(data.purchaseDate ?? ''),
  purchasePrice: String(data.purchasePrice ?? ''),
  roofMaintenanceId: String(data.roofMaintenanceId ?? ''),
  roofMaintenanceLastMaintenance: String(data.roofMaintenanceLastMaintenance ?? ''),
  roofMaintenanceReminderMonths: String(data.roofMaintenanceReminderMonths ?? '11'),
  street: String(data.street ?? ''),
  usageType: String(data.usageType ?? ''),
  wasteCollectionId: String(data.wasteCollectionId ?? ''),
  wegManagerId: String(data.wegManagerId ?? ''),
  windowDoorServiceId: String(data.windowDoorServiceId ?? ''),
  winterServiceId: String(data.winterServiceId ?? ''),
  yearBuilt: String(data.yearBuilt ?? ''),
});

const cleanSpaces = (value: string) => value.replace(/\s+/g, ' ').trim();
const cleanReminderMonths = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 2);
  if (!digits) return '';
  const numeric = Number.parseInt(digits, 10);
  if (!Number.isFinite(numeric)) return '';
  return String(Math.min(Math.max(numeric, 1), 60));
};
const titleCase = (value: string) =>
  cleanSpaces(value)
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
const formatPostalCode = (value: string) => value.replace(/\D/g, '').slice(0, 5);
const parseMoney = (value: string) => {
  const normalized = value
    .replace(/\./g, '')
    .replace(/EUR/gi, '')
    .replace(/\s/g, '')
    .replace(',', '.');
  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
};
const formatMoneyNumber = (value: number) =>
  `${new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} EUR`;
const parsePropertyNumber = (value: string) => {
  const match = value.match(/(\d+)(?!.*\d)/);
  return match ? Number.parseInt(match[1], 10) : 0;
};
const formatPropertyNumber = (index: number) => `OBJ-${String(index).padStart(3, '0')}`;
const buildMeterEntry = (meterType: string, options: { label: string; value: string }[]) => {
  const selected = options.find((option) => option.value === meterType);
  return selected
    ? {
        calibrationDate: '',
        exchanges: [],
        id: crypto.randomUUID(),
        initialReading: '',
        initialReadingDate: '',
        label: selected.label,
        latestReading: '',
        latestReadingDate: '',
        meterNumber: '',
        position: '',
        readingHistory: [],
        type: selected.value,
      }
    : null;
};

const buildHeatingEntry = (heatingType: string) =>
  heatingType
    ? {
        buildYear: '',
        id: crypto.randomUUID(),
        lastMaintenance: '',
        maintenanceReminderMonths: '11',
        type: heatingType,
      }
    : null;

type PropertyAdminManagerProps = {
  documentId?: string;
  editMode?: boolean;
  hideOverview?: boolean;
  redirectPathAfterSave?: string;
  submitLabel?: string;
  title?: string;
};

export default function PropertyAdminManager({
  documentId,
  editMode = false,
  hideOverview = false,
  redirectPathAfterSave,
  submitLabel = 'Immobilie anlegen',
  title = 'Immobilie anlegen',
}: PropertyAdminManagerProps) {
  const { role, user } = useAuth();
  const router = useRouter();
  const [properties, setProperties] = useState<AdminRecord[]>([]);
  const [companies, setCompanies] = useState<AdminRecord[]>([]);
  const [people, setPeople] = useState<AdminRecord[]>([]);
  const [tenants, setTenants] = useState<AdminRecord[]>([]);
  const [form, setForm] = useState<PropertyFormState>(() => defaultFormState());
  const [units, setUnits] = useState<UnitForm[]>([]);
  const [pendingPropertyDocumentFiles, setPendingPropertyDocumentFiles] = useState<PendingCategorizedFile[]>([]);
  const [pendingUnitDocumentFiles, setPendingUnitDocumentFiles] = useState<Record<string, PendingCategorizedFile[]>>({});
  const [selectedServiceField, setSelectedServiceField] = useState<ServiceFieldId>('billingServiceId');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoadingInitialValues, setIsLoadingInitialValues] = useState(
    () => editMode && Boolean(documentId)
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const unsubscribers = [
      onSnapshot(query(collection(db, 'properties')), (snapshot) => {
        setProperties(
          snapshot.docs.map((documentSnapshot) => ({
            data: documentSnapshot.data(),
            id: documentSnapshot.id,
          }))
        );
      }),
      onSnapshot(query(collection(db, 'companies')), (snapshot) => {
        setCompanies(
          snapshot.docs.map((documentSnapshot) => ({
            data: documentSnapshot.data(),
            id: documentSnapshot.id,
          }))
        );
      }),
      onSnapshot(query(collection(db, 'people')), (snapshot) => {
        setPeople(
          snapshot.docs.map((documentSnapshot) => ({
            data: documentSnapshot.data(),
            id: documentSnapshot.id,
          }))
        );
      }),
      onSnapshot(query(collection(db, 'tenants')), (snapshot) => {
        setTenants(
          snapshot.docs.map((documentSnapshot) => ({
            data: documentSnapshot.data(),
            id: documentSnapshot.id,
          }))
        );
      }),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  useEffect(() => {
    if (!editMode || !documentId) return;
    const currentDocumentId = documentId;
    let isMounted = true;

    async function loadProperty() {
      setIsLoadingInitialValues(true);
      const snapshot = await getDoc(doc(db, 'properties', currentDocumentId));
      if (!isMounted) return;

      if (!snapshot.exists()) {
        setError('Die Immobilie wurde nicht gefunden.');
        setIsLoadingInitialValues(false);
        return;
      }

      const data = snapshot.data();
      setForm(mapPropertyDataToFormState(data));
      setUnits(
        Array.isArray(data.units)
          ? data.units.map(mapUnit).filter((entry): entry is UnitForm => Boolean(entry))
          : []
      );
      setError('');
      setIsLoadingInitialValues(false);
    }

    loadProperty().catch((caughtError) => {
      console.error(`Fehler beim Laden der Immobilie ${currentDocumentId}:`, caughtError);
      if (isMounted) {
        setError('Die Immobiliendaten konnten nicht geladen werden.');
        setIsLoadingInitialValues(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [documentId, editMode]);

  const nextPropertyNumber = useMemo(() => {
    const currentMax = properties.reduce(
      (highest, record) =>
        Math.max(highest, parsePropertyNumber(String(record.data.propertyNumber ?? ''))),
      0
    );
    return formatPropertyNumber(currentMax + 1);
  }, [properties]);

  const ownerOptions = useMemo(
    () =>
      companies
        .slice()
        .sort((left, right) =>
          String(left.data.name ?? '').localeCompare(String(right.data.name ?? ''), 'de')
        ),
    [companies]
  );

  const personOptions = useMemo(
    () =>
      people
        .slice()
        .sort((left, right) =>
          `${left.data.lastName ?? ''}${left.data.firstName ?? ''}`.localeCompare(
            `${right.data.lastName ?? ''}${right.data.firstName ?? ''}`,
            'de'
          )
        ),
    [people]
  );

  const serviceOptions = useMemo(
    () =>
      [
        ...companies.map((record) => ({
          label: String(record.data.name ?? record.data.companyName ?? record.id),
          type: 'Firma',
          value: `company:${record.id}`,
        })),
        ...people.map((record) => ({
          label:
            [record.data.lastName, record.data.firstName].filter(Boolean).join(', ') ||
            String(record.data.companyName ?? record.data.name ?? record.id),
          type: 'Person',
          value: record.id,
        })),
      ].sort((left, right) => left.label.localeCompare(right.label, 'de')),
    [companies, people]
  );

  const assignedServices = useMemo(
    () =>
      servicePartnerFields
        .map((field) => {
          const value = String(form[field.idField] ?? '').trim();
          const option =
            serviceOptions.find((entry) => entry.value === value) ||
            serviceOptions.find((entry) => entry.value === `company:${value}`);
          return {
            field,
            label: option?.label || value,
            value,
          };
        })
        .filter((entry) => entry.value),
    [form, serviceOptions]
  );

  const tenantOptions = useMemo(
    () =>
      tenants
        .slice()
        .sort((left, right) =>
          `${left.data.lastName ?? ''}${left.data.firstName ?? ''}`.localeCompare(
            `${right.data.lastName ?? ''}${right.data.firstName ?? ''}`,
            'de'
          )
        ),
    [tenants]
  );

  const compactOverview = useMemo(
    () =>
      properties
        .map((record) => {
          const recordUnits = Array.isArray(record.data.units) ? record.data.units : [];
          const vacantUnits = recordUnits.filter(
            (unit) => typeof unit === 'object' && unit && !String(unit.tenantId ?? '').trim()
          ).length;
          return {
            id: record.id,
            label: String(record.data.name ?? record.id),
            subtitle: [
              String(record.data.propertyNumber ?? ''),
              String(record.data.city ?? ''),
              `${vacantUnits} Leerstand`,
            ]
              .filter(Boolean)
              .join(' · '),
          };
        })
        .sort((left, right) => left.label.localeCompare(right.label, 'de')),
    [properties]
  );

  const derivedVacancyCount = units.filter((unit) => !unit.tenantId).length;

  function updateFormField<K extends keyof PropertyFormState>(key: K, value: PropertyFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addPendingPropertyDocuments(files: File[], category: string) {
    setPendingPropertyDocumentFiles((current) => [
      ...current,
      ...files.map((file) => ({
        category,
        file,
        id: `${Date.now()}-${crypto.randomUUID()}-${file.name}`,
      })),
    ]);
  }

  function addPendingUnitDocuments(unitId: string, files: File[], category: string) {
    setPendingUnitDocumentFiles((current) => ({
      ...current,
      [unitId]: [
        ...(current[unitId] ?? []),
        ...files.map((file) => ({
          category,
          file,
          id: `${unitId}-${Date.now()}-${crypto.randomUUID()}-${file.name}`,
        })),
      ],
    }));
  }

  function handlePropertyDocumentSelection(files: FileList | null) {
    if (!files) return;
    addPendingPropertyDocuments(Array.from(files), 'Sonstiges');
  }

  function handleUnitDocumentSelection(unitId: string, files: FileList | null) {
    if (!files) return;
    addPendingUnitDocuments(unitId, Array.from(files), 'Sonstiges');
  }

  async function uploadDocumentFiles(
    files: PendingCategorizedFile[],
    storageBasePath: string
  ): Promise<StoredDocumentEntry[]> {
    const uploadedDocuments: StoredDocumentEntry[] = [];

    for (const pendingFile of files) {
      const file = pendingFile.file;
      const safeName = sanitizeStorageFileName(file.name);
      const storagePath = `${storageBasePath}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file, {
        contentType: file.type || 'application/octet-stream',
      });

      uploadedDocuments.push({
        category: pendingFile.category,
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

  async function appendPendingDocumentsToProperty(propertyId: string, sourceUnits: UnitForm[]) {
    const uploadedPropertyDocuments = await uploadDocumentFiles(
      pendingPropertyDocumentFiles,
      `property-documents/${propertyId}/object`
    );

    const nextUnits: UnitForm[] = [];
    let uploadedUnitDocumentCount = 0;

    for (const unit of sourceUnits) {
      const files = pendingUnitDocumentFiles[unit.id] ?? [];
      const uploadedUnitDocuments = await uploadDocumentFiles(
        files,
        `property-documents/${propertyId}/units/${unit.id}`
      );
      uploadedUnitDocumentCount += uploadedUnitDocuments.length;
      nextUnits.push({
        ...unit,
        documents: [...unit.documents, ...uploadedUnitDocuments],
      });
    }

    return {
      documentCount: uploadedPropertyDocuments.length + uploadedUnitDocumentCount,
      propertyDocuments: [...form.propertyDocuments, ...uploadedPropertyDocuments],
      units: nextUnits,
    };
  }

  function updateTextField<K extends keyof Pick<PropertyFormState, 'name' | 'street' | 'city' | 'country' | 'houseNumber' | 'postalCode' | 'yearBuilt'>>(
    key: K,
    value: string
  ) {
    if (key === 'postalCode') {
      updateFormField(key, formatPostalCode(value) as PropertyFormState[K]);
      return;
    }
    if (key === 'street' || key === 'city' || key === 'country') {
      updateFormField(key, titleCase(value) as PropertyFormState[K]);
      return;
    }
    updateFormField(key, cleanSpaces(value) as PropertyFormState[K]);
  }

  function formatMoneyForBlur(value: string) {
    const amount = parseMoney(value);
    return amount > 0 ? formatMoneyNumber(amount) : '';
  }

  function addObjectMeter() {
    const nextMeter = buildMeterEntry(form.meterDraftType, objectMeterOptions);
    if (!nextMeter) return;
    setForm((current) => ({
      ...current,
      meterDraftType: '',
      meters: [...current.meters, nextMeter],
    }));
  }

  function updateObjectMeter(
    meterId: string,
    field: 'initialReading' | 'initialReadingDate' | 'meterNumber' | 'calibrationDate' | 'position',
    value: string
  ) {
    setForm((current) => ({
      ...current,
      meters: current.meters.map((meter) =>
        meter.id === meterId
          ? {
              ...meter,
              [field]:
                field === 'initialReading' || field === 'meterNumber' || field === 'position'
                  ? cleanSpaces(value)
                  : value,
            }
          : meter
      ),
    }));
  }

  function removeObjectMeter(meterId: string) {
    setForm((current) => ({
      ...current,
      meters: current.meters.filter((meter) => meter.id !== meterId),
    }));
  }

  function addHeatingSystem() {
    if (!form.heatingDraftType || form.heatingEntries.some((entry) => entry.type === form.heatingDraftType)) return;
    const nextHeating = buildHeatingEntry(form.heatingDraftType);
    if (!nextHeating) return;
    setForm((current) => ({
      ...current,
      heatingDraftType: '',
      heatingEntries: [...current.heatingEntries, nextHeating],
    }));
  }

  function removeHeatingSystem(heatingId: string) {
    setForm((current) => ({
      ...current,
      heatingEntries: current.heatingEntries.filter((entry) => entry.id !== heatingId),
    }));
  }

  function updateHeatingEntry(
    heatingId: string,
    field: keyof Pick<HeatingEntry, 'buildYear' | 'lastMaintenance' | 'maintenanceReminderMonths'>,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      heatingEntries: current.heatingEntries.map((entry) =>
        entry.id === heatingId
          ? {
              ...entry,
              [field]:
                field === 'buildYear'
                  ? cleanSpaces(value)
                  : field === 'maintenanceReminderMonths'
                    ? cleanReminderMonths(value)
                    : value,
            }
          : entry
      ),
    }));
  }

  function addUnitHeating(unitId: string) {
    setUnits((current) =>
      current.map((unit) => {
        if (unit.id !== unitId || !unit.heatingDraftType || unit.heatingEntries.some((entry) => entry.type === unit.heatingDraftType)) {
          return unit;
        }
        const nextHeating = buildHeatingEntry(unit.heatingDraftType);
        if (!nextHeating) return unit;
        return {
          ...unit,
          heatingDraftType: '',
          heatingEntries: [...unit.heatingEntries, nextHeating],
        };
      })
    );
  }

  function removeUnitHeating(unitId: string, heatingId: string) {
    setUnits((current) =>
      current.map((unit) =>
        unit.id === unitId
          ? { ...unit, heatingEntries: unit.heatingEntries.filter((entry) => entry.id !== heatingId) }
          : unit
      )
    );
  }

  function updateUnitHeating(
    unitId: string,
    heatingId: string,
    field: keyof Pick<HeatingEntry, 'buildYear' | 'lastMaintenance' | 'maintenanceReminderMonths'>,
    value: string
  ) {
    setUnits((current) =>
      current.map((unit) =>
        unit.id === unitId
          ? {
              ...unit,
              heatingEntries: unit.heatingEntries.map((entry) =>
                entry.id === heatingId
                  ? {
                      ...entry,
                      [field]:
                        field === 'buildYear'
                          ? cleanSpaces(value)
                          : field === 'maintenanceReminderMonths'
                            ? cleanReminderMonths(value)
                            : value,
                    }
                  : entry
              ),
            }
          : unit
      )
    );
  }

  function updateUnit(unitId: string, field: keyof UnitForm, value: string) {
    setUnits((current) =>
      current.map((unit) => {
        if (unit.id !== unitId) return unit;
        if (field === 'tenantId') {
          const selectedTenant = tenantOptions.find((record) => record.id === value);
          return {
            ...unit,
            tenantId: value,
            tenantName: selectedTenant
              ? [selectedTenant.data.lastName, selectedTenant.data.firstName]
                  .filter(Boolean)
                  .join(', ')
              : '',
          };
        }
        return { ...unit, [field]: cleanSpaces(value) };
      })
    );
  }

  function addUnit() {
    setUnits((current) => [createUnit(), ...current]);
  }

  function removeUnit(unitId: string) {
    setUnits((current) => current.filter((unit) => unit.id !== unitId));
    setPendingUnitDocumentFiles((current) => {
      const next = { ...current };
      delete next[unitId];
      return next;
    });
  }

  function addUnitMeter(unitId: string) {
    setUnits((current) =>
      current.map((unit) => {
        if (unit.id !== unitId) return unit;
        const nextMeter = buildMeterEntry(unit.meterDraftType, unitMeterOptions);
        if (!nextMeter) return unit;
        return {
          ...unit,
          meterDraftType: '',
          meters: [...unit.meters, nextMeter],
        };
      })
    );
  }

  function updateUnitMeter(
    unitId: string,
    meterId: string,
    field: 'initialReading' | 'initialReadingDate' | 'meterNumber' | 'calibrationDate' | 'position',
    value: string
  ) {
    setUnits((current) =>
      current.map((unit) =>
        unit.id === unitId
          ? {
              ...unit,
              meters: unit.meters.map((meter) =>
                meter.id === meterId
                  ? {
                      ...meter,
                      [field]:
                        field === 'initialReading' || field === 'meterNumber' || field === 'position'
                          ? cleanSpaces(value)
                          : value,
                    }
                  : meter
              ),
            }
          : unit
      )
    );
  }

  function removeUnitMeter(unitId: string, meterId: string) {
    setUnits((current) =>
      current.map((unit) =>
        unit.id === unitId
          ? { ...unit, meters: unit.meters.filter((meter) => meter.id !== meterId) }
          : unit
      )
    );
  }

  function addUnitKey(unitId: string) {
    setUnits((current) =>
      current.map((unit) =>
        unit.id === unitId
          ? { ...unit, keys: [...unit.keys, { count: '', id: crypto.randomUUID(), label: '' }] }
          : unit
      )
    );
  }

  function updateUnitKey(unitId: string, keyId: string, field: keyof KeyEntry, value: string) {
    setUnits((current) =>
      current.map((unit) =>
        unit.id === unitId
          ? {
              ...unit,
              keys: unit.keys.map((entry) =>
                entry.id === keyId ? { ...entry, [field]: field === 'count' ? cleanSpaces(value) : value } : entry
              ),
            }
          : unit
      )
    );
  }

  function removeUnitKey(unitId: string, keyId: string) {
    setUnits((current) =>
      current.map((unit) =>
        unit.id === unitId
          ? { ...unit, keys: unit.keys.filter((entry) => entry.id !== keyId) }
          : unit
      )
    );
  }

  function resetForm() {
    setForm(defaultFormState());
    setUnits([]);
    setPendingPropertyDocumentFiles([]);
    setPendingUnitDocumentFiles({});
  }

  function handleDelete(propertyId: string) {
    const confirmed = window.confirm('Immobilie wirklich löschen?');
    if (!confirmed) return;

    setMessage('');
    setError('');

    startTransition(async () => {
      try {
        await deleteDoc(doc(db, 'properties', propertyId));
        setMessage('Immobilie wurde gelöscht.');
      } catch (caughtError) {
        console.error(`Fehler beim Löschen der Immobilie ${propertyId}:`, caughtError);
        setError('Immobilie konnte nicht gelöscht werden.');
      }
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role !== 'admin' || !user) {
      setError('Nur Verwalter dürfen in diesem Bereich Daten anlegen.');
      return;
    }
    if (!form.name || !form.usageType || !form.ownershipType || !form.ownerId) {
      setError('Bitte Objektname, Nutzungsart, Eigentumsart und Eigentümer ausfüllen.');
      return;
    }
    if (form.ownershipType === 'full_ownership' && units.length === 0) {
      setError('Für Volleigentum bitte mindestens eine Einheit anlegen.');
      return;
    }

    setError('');
    setMessage('');

    startTransition(async () => {
      try {
        const currentDocumentId = documentId;
        const selectedOwner = ownerOptions.find((record) => record.id === form.ownerId);
        const payload = {
          ...form,
          city: titleCase(form.city),
          country: titleCase(form.country || 'Deutschland'),
          heatingSystems: form.heatingEntries.map((entry) => entry.type),
          meterDraftType: '',
          name: cleanSpaces(form.name),
          ownerName: selectedOwner ? String(selectedOwner.data.name ?? '') : form.ownerName,
          propertyNumber: form.propertyNumber || nextPropertyNumber,
          purchasePrice: form.purchasePrice ? formatMoneyNumber(parseMoney(form.purchasePrice)) : '',
          street: titleCase(form.street),
          unitCount: units.length,
          units,
          vacantUnitCount: derivedVacancyCount,
          updatedAt: serverTimestamp(),
        };

        if (editMode && currentDocumentId) {
          const documentResult = await appendPendingDocumentsToProperty(currentDocumentId, units);
          await updateDoc(doc(db, 'properties', currentDocumentId), {
            ...payload,
            propertyDocuments: documentResult.propertyDocuments,
            units: documentResult.units,
            updatedByEmail: user.email ?? null,
            updatedByUid: user.uid,
          });
          setPendingPropertyDocumentFiles([]);
          setPendingUnitDocumentFiles({});
          setForm((current) => ({
            ...current,
            propertyDocuments: documentResult.propertyDocuments,
          }));
          setUnits(documentResult.units);
          setMessage(
            documentResult.documentCount > 0
              ? 'Immobilie und Dokumente wurden aktualisiert.'
              : 'Immobilie wurde aktualisiert.'
          );
          if (redirectPathAfterSave) {
            router.push(redirectPathAfterSave);
          }
        } else {
          const propertyRef = await addDoc(collection(db, 'properties'), {
            ...payload,
            propertyDocuments: [],
            units: units.map((unit) => ({ ...unit, documents: [] })),
            createdAt: serverTimestamp(),
            createdByEmail: user.email ?? null,
            createdByUid: user.uid,
          });
          const documentResult = await appendPendingDocumentsToProperty(propertyRef.id, units);
          if (documentResult.documentCount > 0) {
            await updateDoc(doc(db, 'properties', propertyRef.id), {
              propertyDocuments: documentResult.propertyDocuments,
              units: documentResult.units,
              updatedAt: serverTimestamp(),
            });
          }
          setMessage(
            documentResult.documentCount > 0
              ? 'Immobilie und Dokumente wurden gespeichert.'
              : 'Immobilie wurde gespeichert.'
          );
          resetForm();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } catch (caughtError) {
        console.error('Fehler beim Speichern der Immobilie:', caughtError);
        setError('Speichern fehlgeschlagen. Bitte prüfe Firestore-Regeln und Berechtigungen.');
      }
    });
  }

  return (
    <div className="space-y-6">
      {!hideOverview ? (
      <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Übersicht</p>
        <h3 className="mt-2 text-3xl text-slate-950">Immobilien</h3>
        {compactOverview.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-stone-300 bg-stone-50 px-4 py-4 text-sm text-slate-600">
            Noch keine Immobilien angelegt.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {compactOverview.map((record) => (
              <article className="rounded-[20px] border border-stone-200 bg-stone-50 px-3.5 py-2.5" key={record.id}>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-5 text-slate-950">{record.label}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{record.subtitle}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950" href={`/admin/immobilie/${record.id}`}>Ansehen</Link>
                    <Link className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950" href={`/admin/immobilie/${record.id}/bearbeiten`}>Bearbeiten</Link>
                    <button className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100" onClick={() => handleDelete(record.id)} type="button">Löschen</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      ) : null}

      <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
          {editMode ? 'Immobilie bearbeiten' : 'Neuer Datensatz'}
        </p>
        <h3 className="mt-2 text-3xl text-slate-950">{title}</h3>
        {isLoadingInitialValues ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-stone-300 bg-stone-50 px-4 py-4 text-sm text-slate-600">
            Immobilie wird geladen...
          </div>
        ) : (
        <form autoComplete="off" className="mt-8 space-y-8" onSubmit={handleSubmit}>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Objektname</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateTextField('name', event.target.value)} placeholder="z. B. Wohnhaus Musterstraße" required value={form.name} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Interne Objektnummer</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-100 px-4 py-3 text-sm text-slate-700 outline-none" readOnly value={form.propertyNumber || nextPropertyNumber} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Nutzungsart</span>
              <select className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateFormField('usageType', event.target.value)} required value={form.usageType}>
                <option value="">Bitte wählen</option>
                {usageOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Eigentumsart</span>
              <select className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateFormField('ownershipType', event.target.value)} required value={form.ownershipType}>
                <option value="">Bitte wählen</option>
                {ownershipOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Eigentümer</span>
              <select className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateFormField('ownerId', event.target.value)} required value={form.ownerId}>
                <option value="">Bitte wählen</option>
                {ownerOptions.map((record) => (
                  <option key={record.id} value={record.id}>{String(record.data.name ?? record.id)}</option>
                ))}
              </select>
            </label>
            {form.ownershipType === 'partial_ownership' ? (
              <>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Verwalter</span>
                  <select className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateFormField('wegManagerId', event.target.value)} value={form.wegManagerId}>
                    <option value="">Bitte wählen</option>
                    {personOptions.map((record) => (
                      <option key={record.id} value={record.id}>{[record.data.lastName, record.data.firstName].filter(Boolean).join(', ')}</option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Position Keller</span>
                  <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateFormField('basementPosition', cleanSpaces(event.target.value))} placeholder="z. B. Kellerraum 3" value={form.basementPosition} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Position Briefkasten</span>
                  <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateFormField('mailboxPosition', cleanSpaces(event.target.value))} placeholder="z. B. EG links" value={form.mailboxPosition} />
                </label>
              </>
            ) : null}
          </div>

          <div className="grid gap-5 md:grid-cols-[minmax(0,1.4fr)_180px_160px_minmax(0,1fr)_minmax(0,1fr)]">
            <label className="block space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Straße</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateTextField('street', event.target.value)} placeholder="Musterstraße" value={form.street} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Hausnummer</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateTextField('houseNumber', event.target.value)} placeholder="12a" value={form.houseNumber} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">PLZ</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" inputMode="numeric" onChange={(event) => updateTextField('postalCode', event.target.value)} placeholder="12345" value={form.postalCode} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Ort</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateTextField('city', event.target.value)} placeholder="Musterstadt" value={form.city} />
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Baujahr</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateTextField('yearBuilt', event.target.value)} placeholder="z. B. 1998" value={form.yearBuilt} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Grundbuch / Flurstück</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateFormField('landRegisterReference', cleanSpaces(event.target.value))} placeholder="optional" value={form.landRegisterReference} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Einheiten</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-100 px-4 py-3 text-sm text-slate-700 outline-none" readOnly value={units.length} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Leerstand</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-100 px-4 py-3 text-sm text-slate-700 outline-none" readOnly value={derivedVacancyCount} />
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Kaufdatum</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateFormField('purchaseDate', event.target.value)} type="date" value={form.purchaseDate} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Eigentum seit</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateFormField('ownershipSince', event.target.value)} type="date" value={form.ownershipSince} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Kaufpreis</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onBlur={(event) => updateFormField('purchasePrice', formatMoneyForBlur(event.target.value))} onChange={(event) => updateFormField('purchasePrice', cleanSpaces(event.target.value))} placeholder="z. B. 1.250.000 EUR" value={form.purchasePrice} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Anfangsrendite</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateFormField('initialYieldPercent', cleanSpaces(event.target.value))} placeholder="z. B. 4,8 %" value={form.initialYieldPercent} />
            </label>
          </div>

          <div className="rounded-[28px] border border-stone-200 bg-stone-50/70 p-5">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-slate-900">Jährliche Wartungen</p>
              <p className="text-xs leading-6 text-slate-500">
                Heizung, Dach und Regenrinnenreinigung werden hier mit letztem Wartungsdatum und frei einstellbarem Erinnerungsintervall gepflegt.
              </p>
            </div>
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Zentrale Heizungsversorgung</span>
                  <select className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateFormField('hasCentralHeating', event.target.value)} value={form.hasCentralHeating}>
                    <option value="yes">Ja, zentral für das Objekt</option>
                    <option value="no">Nein, auf Einheiten verteilt</option>
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Heizungsart</span>
                  <select className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateFormField('heatingDraftType', event.target.value)} value={form.heatingDraftType}>
                    <option value="">Heizungsart wählen</option>
                    {heatingSystemOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="self-end rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950" onClick={addHeatingSystem} type="button">
                  Heizung hinzufügen
                </button>
              </div>

              {form.heatingEntries.length > 0 ? (
                <div className="space-y-4">
                  {form.heatingEntries.map((entry) => (
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_180px]" key={entry.id}>
                      <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900">Heizung</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {heatingSystemOptions.find((option) => option.value === entry.type)?.label ?? entry.type}
                            </p>
                          </div>
                          <button className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-700 transition hover:bg-rose-100" onClick={() => removeHeatingSystem(entry.id)} type="button">
                            Entfernen
                          </button>
                        </div>
                        <input className="mt-3 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateHeatingEntry(entry.id, 'buildYear', event.target.value)} placeholder="Baujahr" value={entry.buildYear} />
                      </div>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-700">Datum letzte Wartung</span>
                        <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateHeatingEntry(entry.id, 'lastMaintenance', event.target.value)} type="date" value={entry.lastMaintenance} />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-700">Erinnerung nach Monaten</span>
                        <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" inputMode="numeric" min="1" onChange={(event) => updateHeatingEntry(entry.id, 'maintenanceReminderMonths', event.target.value)} placeholder="11" type="number" value={entry.maintenanceReminderMonths} />
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-stone-300 bg-white px-4 py-4 text-sm text-slate-600">
                  Noch keine Heizungsart hinzugefügt.
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_180px]">
                <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-4">
                  <p className="text-sm font-medium text-slate-900">Dach</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Jährliche Sichtung oder Wartung mit automatischer späterer Erinnerung.
                  </p>
                </div>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Datum letzte Wartung</span>
                  <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateFormField('roofMaintenanceLastMaintenance', event.target.value)} type="date" value={form.roofMaintenanceLastMaintenance} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Erinnerung nach Monaten</span>
                  <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" inputMode="numeric" min="1" onChange={(event) => updateFormField('roofMaintenanceReminderMonths', cleanReminderMonths(event.target.value))} placeholder="11" type="number" value={form.roofMaintenanceReminderMonths} />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_180px]">
                <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-4">
                  <p className="text-sm font-medium text-slate-900">Regenrinnenreinigung</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Jährliche Reinigung mit eigenem letzten Wartungsdatum.
                  </p>
                </div>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Datum letzte Wartung</span>
                  <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateFormField('gutterCleaningLastMaintenance', event.target.value)} type="date" value={form.gutterCleaningLastMaintenance} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Erinnerung nach Monaten</span>
                  <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" inputMode="numeric" min="1" onChange={(event) => updateFormField('gutterCleaningReminderMonths', cleanReminderMonths(event.target.value))} placeholder="11" type="number" value={form.gutterCleaningReminderMonths} />
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-stone-200 bg-stone-50/70 p-5">
            <p className="text-sm font-medium text-slate-900">Objekt-Zähler</p>
            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
              <select className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60 md:max-w-sm" onChange={(event) => updateFormField('meterDraftType', event.target.value)} value={form.meterDraftType}>
                <option value="">Zählerart wählen</option>
                {objectMeterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <button className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950" onClick={addObjectMeter} type="button">
                Zähler hinzufügen
              </button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {form.meters.map((meter) => (
                <div className="rounded-[22px] border border-stone-200 bg-white p-4" key={meter.id}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-700">{meter.label}</span>
                    <button className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-700 transition hover:bg-rose-100" onClick={() => removeObjectMeter(meter.id)} type="button">
                      Entfernen
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3">
                    <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateObjectMeter(meter.id, 'meterNumber', event.target.value)} placeholder="Zählernummer" value={meter.meterNumber} />
                    <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateObjectMeter(meter.id, 'position', event.target.value)} placeholder="Position" value={meter.position} />
                    <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateObjectMeter(meter.id, 'initialReading', event.target.value)} placeholder="Erster Zählerstand" value={meter.initialReading} />
                    <label className="space-y-1">
                      <span className="block text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Datum Zählerstand</span>
                      <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateObjectMeter(meter.id, 'initialReadingDate', event.target.value)} type="date" value={meter.initialReadingDate} />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Eichdatum</span>
                      <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateObjectMeter(meter.id, 'calibrationDate', event.target.value)} type="date" value={meter.calibrationDate} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            {form.meters.length === 0 ? <div className="mt-4 rounded-[22px] border border-dashed border-stone-300 bg-white px-4 py-4 text-sm text-slate-600">Noch keine Objekt-Zähler hinzugefügt.</div> : null}
          </div>

          <div className="hidden">
            <p className="text-sm font-medium text-slate-900">Dokumente zur Immobilie</p>
            <p className="mt-1 text-xs leading-6 text-slate-500">
              Hier kannst du beliebige Dateien direkt am Objekt hinterlegen.
            </p>
            <label className="mt-4 block space-y-2">
              <span className="text-sm font-medium text-slate-700">Dateien hochladen</span>
              <input
                className="w-full rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 focus:border-amber-700/60"
                multiple
                onChange={(event) => handlePropertyDocumentSelection(event.target.files)}
                type="file"
              />
            </label>
            {pendingPropertyDocumentFiles.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-500">Zum Speichern vorgemerkt</p>
                <div className="mt-3 grid gap-2">
                  {pendingPropertyDocumentFiles.map((entry) => (
                    <p className="text-sm text-slate-700" key={entry.id}>{entry.file.name}</p>
                  ))}
                </div>
              </div>
            ) : null}
            {form.propertyDocuments.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-500">Bereits hinterlegt</p>
                <div className="mt-3 grid gap-2">
                  {form.propertyDocuments.map((document) => (
                    <a
                      className="text-sm font-medium text-slate-700 underline-offset-4 hover:text-slate-950 hover:underline"
                      href={document.url}
                      key={`${document.path}-${document.url}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {document.name}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[28px] border border-stone-200 bg-stone-50/70 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">Einheiten</p>
                <p className="mt-1 text-xs leading-6 text-slate-500">
                  Leerstand ergibt sich automatisch aus Einheiten ohne zugeordneten Mieter.
                </p>
              </div>
              <button className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950" onClick={addUnit} type="button">
                Einheit hinzufügen
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {units.map((unit, index) => (
                <article className="rounded-[24px] border border-stone-200 bg-white p-5" key={unit.id}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm font-medium text-slate-900">Einheit {index + 1}</p>
                    <button className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100" onClick={() => removeUnit(unit.id)} type="button">
                      Einheit entfernen
                    </button>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateUnit(unit.id, 'unitLabel', event.target.value)} placeholder="Einheit / Kennung" value={unit.unitLabel} />
                    <select className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateUnit(unit.id, 'unitType', event.target.value)} value={unit.unitType}>
                      <option value="">Einheitsart</option>
                      {unitTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <select className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateUnit(unit.id, 'section', event.target.value)} value={unit.section}>
                      <option value="">Lage / Gebäudeteil</option>
                      {sectionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <select className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateUnit(unit.id, 'floor', event.target.value)} value={unit.floor}>
                      <option value="">Geschoss</option>
                      {floorOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <select className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateUnit(unit.id, 'unitPosition', event.target.value)} value={unit.unitPosition}>
                      <option value="">Position</option>
                      {unitPositionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateUnit(unit.id, 'rooms', event.target.value)} placeholder="Zimmer" value={unit.rooms} />
                    <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateUnit(unit.id, 'areaSqm', event.target.value)} placeholder="Fläche in m²" value={unit.areaSqm} />
                    <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateUnit(unit.id, 'basementPosition', cleanSpaces(event.target.value))} placeholder="Position Keller" value={unit.basementPosition} />
                    <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateUnit(unit.id, 'mailboxPosition', cleanSpaces(event.target.value))} placeholder="Position Briefkasten" value={unit.mailboxPosition} />
                    <select className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60 xl:col-span-2" onChange={(event) => updateUnit(unit.id, 'tenantId', event.target.value)} value={unit.tenantId}>
                      <option value="">Kein Mieter zugeordnet</option>
                      {tenantOptions.map((record) => <option key={record.id} value={record.id}>{[record.data.lastName, record.data.firstName].filter(Boolean).join(', ')}</option>)}
                    </select>
                  </div>
                  <div className="mt-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                      <select className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60 md:max-w-sm" onChange={(event) => setUnits((current) => current.map((entry) => entry.id === unit.id ? { ...entry, meterDraftType: event.target.value } : entry))} value={unit.meterDraftType}>
                        <option value="">Zählerart wählen</option>
                        {unitMeterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                      <button className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950" onClick={() => addUnitMeter(unit.id)} type="button">
                        Zähler hinzufügen
                      </button>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {unit.meters.map((meter) => (
                        <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4" key={meter.id}>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-slate-700">{meter.label}</span>
                            <button className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-700 transition hover:bg-rose-100" onClick={() => removeUnitMeter(unit.id, meter.id)} type="button">
                              Entfernen
                            </button>
                          </div>
                          <div className="mt-3 grid gap-3">
                            <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateUnitMeter(unit.id, meter.id, 'meterNumber', event.target.value)} placeholder="Zählernummer" value={meter.meterNumber} />
                            <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateUnitMeter(unit.id, meter.id, 'position', event.target.value)} placeholder="Position" value={meter.position} />
                            <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateUnitMeter(unit.id, meter.id, 'initialReading', event.target.value)} placeholder="Erster Zählerstand" value={meter.initialReading} />
                            <label className="space-y-1">
                              <span className="block text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Datum Zählerstand</span>
                              <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateUnitMeter(unit.id, meter.id, 'initialReadingDate', event.target.value)} type="date" value={meter.initialReadingDate} />
                            </label>
                            <label className="space-y-1">
                              <span className="block text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Eichdatum</span>
                              <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateUnitMeter(unit.id, meter.id, 'calibrationDate', event.target.value)} type="date" value={meter.calibrationDate} />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 rounded-[22px] border border-stone-200 bg-stone-50 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Schlüssel</p>
                        <p className="mt-1 text-xs text-slate-500">Bezeichnung und Standardanzahl für das Übergabeprotokoll.</p>
                      </div>
                      <button className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950" onClick={() => addUnitKey(unit.id)} type="button">
                        + Schlüssel
                      </button>
                    </div>
                    {unit.keys.length > 0 ? (
                      <div className="mt-4 grid gap-3">
                        {unit.keys.map((entry) => (
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_auto]" key={entry.id}>
                            <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateUnitKey(unit.id, entry.id, 'label', event.target.value)} placeholder="Schlüsselbezeichnung" value={entry.label} />
                            <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" inputMode="numeric" onChange={(event) => updateUnitKey(unit.id, entry.id, 'count', event.target.value)} placeholder="Anzahl" value={entry.count} />
                            <button className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100" onClick={() => removeUnitKey(unit.id, entry.id)} type="button">
                              Entfernen
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-slate-600">Noch keine Schlüssel hinterlegt.</p>
                    )}
                  </div>
                  {form.hasCentralHeating === 'no' ? (
                    <div className="mt-4 rounded-[22px] border border-stone-200 bg-stone-50 p-4">
                      <p className="text-sm font-medium text-slate-900">Heizung der Einheit</p>
                      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                        <select className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60 md:max-w-sm" onChange={(event) => setUnits((current) => current.map((entry) => entry.id === unit.id ? { ...entry, heatingDraftType: event.target.value } : entry))} value={unit.heatingDraftType}>
                          <option value="">Heizungsart wählen</option>
                          {heatingSystemOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <button className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950" onClick={() => addUnitHeating(unit.id)} type="button">
                          Heizung hinzufügen
                        </button>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {unit.heatingEntries.map((entry) => (
                          <div className="rounded-[18px] border border-stone-200 bg-white p-4" key={entry.id}>
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-slate-900">{heatingSystemOptions.find((option) => option.value === entry.type)?.label ?? entry.type}</p>
                              <button className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-700 transition hover:bg-rose-100" onClick={() => removeUnitHeating(unit.id, entry.id)} type="button">
                                Entfernen
                              </button>
                            </div>
                            <div className="mt-3 grid gap-3">
                              <label className="space-y-1">
                                <span className="block text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Baujahr</span>
                                <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateUnitHeating(unit.id, entry.id, 'buildYear', event.target.value)} placeholder="Baujahr" value={entry.buildYear} />
                              </label>
                              <label className="space-y-1">
                                <span className="block text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Datum letzte Wartung</span>
                                <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateUnitHeating(unit.id, entry.id, 'lastMaintenance', event.target.value)} type="date" value={entry.lastMaintenance} />
                              </label>
                              <label className="space-y-1">
                                <span className="block text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Erinnerung nach Monaten</span>
                                <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" inputMode="numeric" min="1" onChange={(event) => updateUnitHeating(unit.id, entry.id, 'maintenanceReminderMonths', event.target.value)} placeholder="11" type="number" value={entry.maintenanceReminderMonths} />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="hidden">
                    <p className="text-sm font-medium text-slate-900">Dokumente der Einheit</p>
                    <label className="mt-3 block space-y-2">
                      <span className="text-sm font-medium text-slate-700">Dateien hochladen</span>
                      <input
                        className="w-full rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 focus:border-amber-700/60"
                        multiple
                        onChange={(event) => handleUnitDocumentSelection(unit.id, event.target.files)}
                        type="file"
                      />
                    </label>
                    {(pendingUnitDocumentFiles[unit.id] ?? []).length > 0 ? (
                      <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-500">
                          Zum Speichern vorgemerkt
                        </p>
                        <div className="mt-3 grid gap-2">
                          {(pendingUnitDocumentFiles[unit.id] ?? []).map((entry) => (
                            <p className="text-sm text-slate-700" key={entry.id}>
                              {entry.file.name}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {unit.documents.length > 0 ? (
                      <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-500">
                          Bereits hinterlegt
                        </p>
                        <div className="mt-3 grid gap-2">
                          {unit.documents.map((document) => (
                            <a
                              className="text-sm font-medium text-slate-700 underline-offset-4 hover:text-slate-950 hover:underline"
                              href={document.url}
                              key={`${unit.id}-${document.path}-${document.url}`}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {document.name}
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <textarea className="mt-4 min-h-24 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateUnit(unit.id, 'notes', event.target.value)} placeholder="Notizen zur Einheit" value={unit.notes} />
                  <div className="mt-4">
                    <PendingDocumentUploadSection
                      files={pendingUnitDocumentFiles[unit.id] ?? []}
                      onAddFiles={(files, category) => addPendingUnitDocuments(unit.id, files, category)}
                      onRemoveFile={(id) =>
                        setPendingUnitDocumentFiles((current) => ({
                          ...current,
                          [unit.id]: (current[unit.id] ?? []).filter((entry) => entry.id !== id),
                        }))
                      }
                      title="Dokumente der Einheit"
                    />
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-stone-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-900">Gewerke und Dienstleister</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] lg:items-end">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Dienstleisterart</span>
                <select
                  className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                  onChange={(event) => setSelectedServiceField(event.target.value as ServiceFieldId)}
                  value={String(selectedServiceField)}
                >
                  {servicePartnerFields.map((field) => (
                    <option key={field.idField} value={field.idField}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Firma / Person</span>
                <select
                  className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                  onChange={(event) => updateFormField(selectedServiceField, event.target.value)}
                  value={String(form[selectedServiceField] ?? '')}
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
                className="rounded-full border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 transition hover:border-rose-300"
                onClick={() => updateFormField(selectedServiceField, '')}
                type="button"
              >
                Entfernen
              </button>
            </div>
            <div className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-[18px] border border-stone-200">
              {assignedServices.length === 0 ? (
                <div className="bg-stone-50 px-4 py-3 text-sm text-slate-600">Noch keine Dienstleister zugeordnet.</div>
              ) : (
                assignedServices.map((entry) => (
                  <div className="grid gap-2 bg-white px-4 py-3 text-sm md:grid-cols-[220px_minmax(0,1fr)]" key={entry.field.idField}>
                    <span className="font-medium text-slate-700">{entry.field.label}</span>
                    <span className="text-slate-950">{entry.label}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Notizen</span>
            <textarea className="min-h-28 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateFormField('notes', event.target.value)} placeholder="Besondere Hinweise zum Objekt ..." value={form.notes} />
          </label>

          <PendingDocumentUploadSection
            files={pendingPropertyDocumentFiles}
            onAddFiles={addPendingPropertyDocuments}
            onRemoveFile={(id) =>
              setPendingPropertyDocumentFiles((current) => current.filter((entry) => entry.id !== id))
            }
            title="Dokumente zur Immobilie"
          />

          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

          <div className="flex flex-wrap gap-3">
            <button className="rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-5 py-3 text-sm font-semibold text-stone-100 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60" disabled={isPending} type="submit">
              {isPending ? 'Speichert...' : submitLabel}
            </button>
            {editMode && documentId ? (
              <Link className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950" href={`/admin/immobilie/${documentId}`}>
                Zur Ansicht
              </Link>
            ) : null}
          </div>
        </form>
        )}
      </section>
    </div>
  );
}


