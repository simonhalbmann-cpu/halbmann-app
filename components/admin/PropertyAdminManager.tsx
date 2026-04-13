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
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../lib/firebase';

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
  type: string;
};

type UnitForm = {
  areaSqm: string;
  floor: string;
  heatingDraftType: string;
  heatingEntries: HeatingEntry[];
  id: string;
  meterDraftType: string;
  meters: MeterEntry[];
  notes: string;
  rooms: string;
  section: string;
  tenantId: string;
  tenantName: string;
  unitLabel: string;
  unitPosition: string;
  unitType: string;
};

type PropertyFormState = {
  billingServiceId: string;
  city: string;
  cleaningServiceId: string;
  country: string;
  hasCentralHeating: string;
  electricianId: string;
  gutterCleaningId: string;
  gutterCleaningLastMaintenance: string;
  heatingDraftType: string;
  heatingServiceId: string;
  heatingEntries: HeatingEntry[];
  houseNumber: string;
  initialYieldPercent: string;
  janitorId: string;
  landRegisterReference: string;
  meterDraftType: string;
  meters: MeterEntry[];
  name: string;
  notes: string;
  ownerId: string;
  ownerName: string;
  ownershipSince: string;
  ownershipType: string;
  plumbingServiceId: string;
  postalCode: string;
  propertyNumber: string;
  purchaseDate: string;
  purchasePrice: string;
  roofMaintenanceId: string;
  roofMaintenanceLastMaintenance: string;
  street: string;
  usageType: string;
  wasteCollectionId: string;
  wegManagerId: string;
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
  { idField: 'wasteCollectionId', label: 'Müllabfuhr' },
  { idField: 'billingServiceId', label: 'Abrechnungsunternehmen' },
  { idField: 'cleaningServiceId', label: 'Hausreinigung' },
  { idField: 'electricianId', label: 'Elektriker' },
  { idField: 'heatingServiceId', label: 'Heizungsdienst' },
  { idField: 'plumbingServiceId', label: 'Sanitär / Rohrreinigung' },
  { idField: 'janitorId', label: 'Hausmeister' },
  { idField: 'winterServiceId', label: 'Winterdienst' },
  { idField: 'roofMaintenanceId', label: 'Dachwartung' },
  { idField: 'gutterCleaningId', label: 'Regenrinnenreinigung' },
] as const;

const defaultFormState = (): PropertyFormState => ({
  billingServiceId: '',
  city: '',
  cleaningServiceId: '',
  country: 'Deutschland',
  hasCentralHeating: 'yes',
  electricianId: '',
  gutterCleaningId: '',
  gutterCleaningLastMaintenance: '',
  heatingDraftType: '',
  heatingServiceId: '',
  heatingEntries: [],
  houseNumber: '',
  initialYieldPercent: '',
  janitorId: '',
  landRegisterReference: '',
  meterDraftType: '',
  meters: [],
  name: '',
  notes: '',
  ownerId: '',
  ownerName: '',
  ownershipSince: '',
  ownershipType: '',
  plumbingServiceId: '',
  postalCode: '',
  propertyNumber: '',
  purchaseDate: '',
  purchasePrice: '',
  roofMaintenanceId: '',
  roofMaintenanceLastMaintenance: '',
  street: '',
  usageType: '',
  wasteCollectionId: '',
  wegManagerId: '',
  winterServiceId: '',
  yearBuilt: '',
});

const createUnit = (): UnitForm => ({
  areaSqm: '',
  floor: '',
  heatingDraftType: '',
  heatingEntries: [],
  id: crypto.randomUUID(),
  meterDraftType: '',
  meters: [],
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
    type: String((entry as DocumentData).type ?? ''),
  };
};

const mapUnit = (unit: unknown): UnitForm | null => {
  if (!unit || typeof unit !== 'object') return null;
  return {
    areaSqm: String((unit as DocumentData).areaSqm ?? ''),
    floor: String((unit as DocumentData).floor ?? ''),
    heatingDraftType: '',
    heatingEntries: Array.isArray((unit as DocumentData).heatingEntries)
      ? ((unit as DocumentData).heatingEntries as unknown[])
          .map(mapHeatingEntry)
          .filter((entry): entry is HeatingEntry => Boolean(entry))
      : [],
    id: String((unit as DocumentData).id ?? crypto.randomUUID()),
    meterDraftType: '',
    meters: Array.isArray((unit as DocumentData).meters)
      ? ((unit as DocumentData).meters as unknown[])
          .map(mapMeterEntry)
          .filter((entry): entry is MeterEntry => Boolean(entry))
      : [],
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
  billingServiceId: String(data.billingServiceId ?? ''),
  city: String(data.city ?? ''),
  cleaningServiceId: String(data.cleaningServiceId ?? ''),
  country: String(data.country ?? 'Deutschland'),
  hasCentralHeating: String(data.hasCentralHeating ?? 'yes'),
  electricianId: String(data.electricianId ?? ''),
  gutterCleaningId: String(data.gutterCleaningId ?? ''),
  gutterCleaningLastMaintenance: String(data.gutterCleaningLastMaintenance ?? ''),
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
              type: String(entry),
            })
          )
          .filter((entry): entry is HeatingEntry => Boolean(entry))
      : [],
  houseNumber: String(data.houseNumber ?? ''),
  initialYieldPercent: String(data.initialYieldPercent ?? ''),
  janitorId: String(data.janitorId ?? ''),
  landRegisterReference: String(data.landRegisterReference ?? ''),
  meterDraftType: '',
  meters: Array.isArray(data.meters)
    ? data.meters
        .map(mapMeterEntry)
        .filter((entry): entry is MeterEntry => Boolean(entry))
    : [],
  name: String(data.name ?? ''),
  notes: String(data.notes ?? ''),
  ownerId: String(data.ownerId ?? ''),
  ownerName: String(data.ownerName ?? ''),
  ownershipSince: String(data.ownershipSince ?? ''),
  ownershipType: String(data.ownershipType ?? ''),
  plumbingServiceId: String(data.plumbingServiceId ?? ''),
  postalCode: String(data.postalCode ?? ''),
  propertyNumber: String(data.propertyNumber ?? ''),
  purchaseDate: String(data.purchaseDate ?? ''),
  purchasePrice: String(data.purchasePrice ?? ''),
  roofMaintenanceId: String(data.roofMaintenanceId ?? ''),
  roofMaintenanceLastMaintenance: String(data.roofMaintenanceLastMaintenance ?? ''),
  street: String(data.street ?? ''),
  usageType: String(data.usageType ?? ''),
  wasteCollectionId: String(data.wasteCollectionId ?? ''),
  wegManagerId: String(data.wegManagerId ?? ''),
  winterServiceId: String(data.winterServiceId ?? ''),
  yearBuilt: String(data.yearBuilt ?? ''),
});

const cleanSpaces = (value: string) => value.replace(/\s+/g, ' ').trim();
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

  function updateHeatingEntry(heatingId: string, field: keyof Pick<HeatingEntry, 'buildYear' | 'lastMaintenance'>, value: string) {
    setForm((current) => ({
      ...current,
      heatingEntries: current.heatingEntries.map((entry) =>
        entry.id === heatingId ? { ...entry, [field]: field === 'buildYear' ? cleanSpaces(value) : value } : entry
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
    field: keyof Pick<HeatingEntry, 'buildYear' | 'lastMaintenance'>,
    value: string
  ) {
    setUnits((current) =>
      current.map((unit) =>
        unit.id === unitId
          ? {
              ...unit,
              heatingEntries: unit.heatingEntries.map((entry) =>
                entry.id === heatingId
                  ? { ...entry, [field]: field === 'buildYear' ? cleanSpaces(value) : value }
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

  function resetForm() {
    setForm(defaultFormState());
    setUnits([]);
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
          await updateDoc(doc(db, 'properties', currentDocumentId), {
            ...payload,
            updatedByEmail: user.email ?? null,
            updatedByUid: user.uid,
          });
          setMessage('Immobilie wurde aktualisiert.');
          if (redirectPathAfterSave) {
            router.push(redirectPathAfterSave);
          }
        } else {
          await addDoc(collection(db, 'properties'), {
            ...payload,
            createdAt: serverTimestamp(),
            createdByEmail: user.email ?? null,
            createdByUid: user.uid,
          });
          setMessage('Immobilie wurde gespeichert.');
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
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Verwalter</span>
                <select className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateFormField('wegManagerId', event.target.value)} value={form.wegManagerId}>
                  <option value="">Bitte wählen</option>
                  {personOptions.map((record) => (
                    <option key={record.id} value={record.id}>{[record.data.lastName, record.data.firstName].filter(Boolean).join(', ')}</option>
                  ))}
                </select>
              </label>
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
                Heizung, Dach und Regenrinnenreinigung werden hier untereinander mit letztem Wartungsdatum gepflegt. Später folgt daraus automatisch eine Ticket-Erinnerung nach 11 Monaten.
              </p>
            </div>
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_220px]">
                <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-4">
                  <p className="text-sm font-medium text-slate-900">Heizung</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Baujahr und letzte jährliche Wartung. Die spätere Erinnerung erfolgt nach 11 Monaten.
                  </p>
                  <div className="mt-4 grid gap-4">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">Zentrale Heizungsversorgung</span>
                      <select className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateFormField('hasCentralHeating', event.target.value)} value={form.hasCentralHeating}>
                        <option value="yes">Ja, zentral für das Objekt</option>
                        <option value="no">Nein, auf Einheiten verteilt</option>
                      </select>
                    </label>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                      <select className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateFormField('heatingDraftType', event.target.value)} value={form.heatingDraftType}>
                        <option value="">Heizungsart wählen</option>
                        {heatingSystemOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button className="rounded-full border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950" onClick={addHeatingSystem} type="button">
                        Heizung hinzufügen
                      </button>
                    </div>
                    {form.heatingEntries.length > 0 ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {form.heatingEntries.map((entry) => (
                          <div className="rounded-[20px] border border-stone-200 bg-white p-4" key={entry.id}>
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-slate-900">
                                {heatingSystemOptions.find((option) => option.value === entry.type)?.label ?? entry.type}
                              </p>
                              <button className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-700 transition hover:bg-rose-100" onClick={() => removeHeatingSystem(entry.id)} type="button">
                                Entfernen
                              </button>
                            </div>
                            <div className="mt-3 grid gap-3">
                              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateHeatingEntry(entry.id, 'buildYear', event.target.value)} placeholder="Baujahr" value={entry.buildYear} />
                              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateHeatingEntry(entry.id, 'lastMaintenance', event.target.value)} type="date" value={entry.lastMaintenance} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs leading-5 text-slate-500">Noch keine Heizungsart hinzugefügt.</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
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
              </div>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
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
                              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateUnitHeating(unit.id, entry.id, 'buildYear', event.target.value)} placeholder="Baujahr" value={entry.buildYear} />
                              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateUnitHeating(unit.id, entry.id, 'lastMaintenance', event.target.value)} type="date" value={entry.lastMaintenance} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <textarea className="mt-4 min-h-24 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateUnit(unit.id, 'notes', event.target.value)} placeholder="Notizen zur Einheit" value={unit.notes} />
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {servicePartnerFields.map((field) => (
              <label className="block space-y-2" key={field.idField}>
                <span className="text-sm font-medium text-slate-700">{field.label}</span>
                <select className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateFormField(field.idField, event.target.value)} value={form[field.idField]}>
                  <option value="">Bitte wählen</option>
                  {personOptions.map((record) => (
                    <option key={record.id} value={record.id}>
                      {[record.data.lastName, record.data.firstName, record.data.category].filter(Boolean).join(' · ')}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Notizen</span>
            <textarea className="min-h-28 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateFormField('notes', event.target.value)} placeholder="Besondere Hinweise zum Objekt ..." value={form.notes} />
          </label>

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

