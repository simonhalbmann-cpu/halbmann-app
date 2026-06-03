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

type GuarantorOption = {
  id: string;
  label: string;
  phone: string;
};

type AdditionalPerson = {
  email: string;
  firstName: string;
  id: string;
  lastName: string;
  phone: string;
  relation: string;
};

type RentIncreaseRow = {
  coldRent: string;
  euroIncrease: string;
  fromDate: string;
  id: string;
  percentIncrease: string;
  reminderDate: string;
  toDate: string;
};

type RentHistoryEntry = {
  coldRent: string;
  effectiveDate: string;
  id: string;
  label: string;
  netOperatingCosts: string;
};

type RentChartPoint = {
  coldRent: number;
  date: string;
  label: string;
  netOperatingCosts: number;
  pointType: 'current' | 'history' | 'planned';
};

type UnitOption = {
  label: string;
  ownerName: string;
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitIndex: number;
  unitLabel: string;
};

type TenantFormState = {
  additionalPersons: AdditionalPerson[];
  additionalPersonsDraftRelation: string;
  annualStatementFile: string;
  bankStatementsFile: string;
  companyCity: string;
  companyContactEmail: string;
  companyContactName: string;
  companyContactPhone: string;
  companyContactSalutation: string;
  companyHouseNumber: string;
  companyName: string;
  companyPostalCode: string;
  companyStreet: string;
  coldRent: string;
  depositCertificateFile: string;
  depositAmount: string;
  depositType: string;
  documentsNotes: string;
  email: string;
  firstName: string;
  salutation: string;
  guarantorExists: string;
  guarantorId: string;
  guarantorLabel: string;
  identityCopiesFile: string;
  moveInDate: string;
  netOperatingCosts: string;
  notes: string;
  phone: string;
  portalPassword: string;
  portalUsername: string;
  rentIncreaseNextReview: string;
  rentIncreaseReferenceDate: string;
  rentHistory: RentHistoryEntry[];
  rentIncreaseRows: RentIncreaseRow[];
  rentIncreaseType: string;
  salaryProofsFile: string;
  schufaFile: string;
  selectedUnitKey: string;
  storedPortalPassword: string;
  status: string;
  taxNumber: string;
  tenantInfoFile: string;
  tenancyAddendumsFile: string;
  tenancyAgreementFile: string;
  pendingColdRent: string;
  vatRule: string;
};

const statusOptions = [
  { label: 'Aktiv', value: 'active' },
  { label: 'In Vorbereitung', value: 'pending' },
  { label: 'Beendet', value: 'inactive' },
];

const rentIncreaseOptions = [
  { label: 'Staffelmiete', value: 'graduated' },
  { label: 'Indexmiete', value: 'index' },
  { label: 'Nach Gesetz', value: 'legal' },
];

const depositTypeOptions = [
  { label: 'Barkaution', value: 'cash_deposit' },
  { label: 'Bankbürgschaft', value: 'bank_guarantee' },
];

const vatRuleOptions = [
  { label: 'Keine Umsatzsteuer', value: 'no_vat' },
  { label: 'Umsatzsteuer auf Nettomiete', value: 'rent_only' },
  {
    label: 'Umsatzsteuer auf Nettomiete und umlegbare Betriebskosten',
    value: 'rent_and_operating_costs',
  },
];

const additionalPersonRelations = [
  { label: 'Ehepartner', value: 'spouse' },
  { label: 'Lebenspartner', value: 'partner' },
  { label: 'Mitmieter', value: 'co_tenant' },
  { label: 'Kind', value: 'child' },
  { label: 'Sonstige Person', value: 'other' },
];

const statusLabelMap = Object.fromEntries(statusOptions.map((option) => [option.value, option.label]));
const rentIncreaseLabelMap = Object.fromEntries(
  rentIncreaseOptions.map((option) => [option.value, option.label])
);
const depositTypeLabelMap = Object.fromEntries(
  depositTypeOptions.map((option) => [option.value, option.label])
);
const vatRuleLabelMap = Object.fromEntries(vatRuleOptions.map((option) => [option.value, option.label]));
const relationLabelMap = Object.fromEntries(
  additionalPersonRelations.map((option) => [option.value, option.label])
);

const defaultFormState = (): TenantFormState => ({
  additionalPersons: [],
  additionalPersonsDraftRelation: '',
  annualStatementFile: '',
  bankStatementsFile: '',
  companyCity: '',
  companyContactEmail: '',
  companyContactName: '',
  companyContactPhone: '',
  companyContactSalutation: '',
  companyHouseNumber: '',
  companyName: '',
  companyPostalCode: '',
  companyStreet: '',
  coldRent: '',
  depositCertificateFile: '',
  depositAmount: '',
  depositType: '',
  documentsNotes: '',
  email: '',
  firstName: '',
  salutation: '',
  guarantorExists: 'no',
  guarantorId: '',
  guarantorLabel: '',
  identityCopiesFile: '',
  moveInDate: '',
  netOperatingCosts: '',
  notes: '',
  phone: '',
  portalPassword: '',
  portalUsername: '',
  pendingColdRent: '',
  rentIncreaseNextReview: '',
  rentIncreaseReferenceDate: '',
  rentHistory: [],
  rentIncreaseRows: [],
  rentIncreaseType: '',
  salaryProofsFile: '',
  schufaFile: '',
  selectedUnitKey: '',
  storedPortalPassword: '',
  status: 'active',
  taxNumber: '',
  tenantInfoFile: '',
  tenancyAddendumsFile: '',
  tenancyAgreementFile: '',
  vatRule: 'no_vat',
});

const cleanSpaces = (value: string) => value.replace(/\s+/g, ' ').trim();

const titleCase = (value: string) =>
  cleanSpaces(value)
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatMoneyInput = (value: string) => cleanSpaces(value);

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

const formatPercent = (value: number) =>
  `${new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} %`;

const createRentIncreaseRow = (baseColdRent: string): RentIncreaseRow => ({
  coldRent: baseColdRent || '0,00 EUR',
  euroIncrease: '0,00 EUR',
  fromDate: '',
  id: crypto.randomUUID(),
  percentIncrease: '0,00 %',
  reminderDate: '',
  toDate: '',
});

const shiftMonths = (dateValue: string, months: number) => {
  if (!dateValue) return '';
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
};

const shiftDays = (dateValue: string, days: number) => {
  if (!dateValue) return '';
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const createOneYearRange = (startDate: string) => ({
  fromDate: startDate || '',
  toDate: startDate ? shiftDays(shiftMonths(startDate, 12), -1) : '',
});

const calculateReminderForRule = (referenceDate: string, monthsUntilReminder: number) =>
  shiftMonths(referenceDate, monthsUntilReminder);

const formatMoneyForBlur = (value: string) => {
  const amount = parseMoney(value);
  return amount > 0 ? formatMoneyNumber(amount) : '';
};

const formatDateLabel = (dateValue: string) => {
  if (!dateValue) return '';
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('de-DE').format(date);
};

const formatMonthLabel = (dateValue: string) => {
  if (!dateValue) return '';
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('de-DE', {
    month: 'short',
    year: '2-digit',
  }).format(date);
};

const todayDate = () => new Date().toISOString().slice(0, 10);

const getEffectiveReferenceDate = (referenceDate: string, moveInDate: string) =>
  referenceDate || moveInDate || todayDate();

const getRentIncreaseTypeLabel = (type: string) =>
  rentIncreaseLabelMap[type] ?? 'Mieterhoehung';

const getStatusLabel = (status: string) => statusLabelMap[status] ?? status;
const getDepositTypeLabel = (value: string) => depositTypeLabelMap[value] ?? value;
const getVatRuleLabel = (value: string) => vatRuleLabelMap[value] ?? value;
const getRelationLabel = (value: string) => relationLabelMap[value] ?? value;

const getRentIncreaseStatusLabel = (type: string, nextReviewDate: string) => {
  if (!type || !nextReviewDate) return '';
  const reviewDate = new Date(`${nextReviewDate}T12:00:00`);
  if (Number.isNaN(reviewDate.getTime())) return '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const prefix = getRentIncreaseTypeLabel(type);
  if (reviewDate <= today) {
    return `${prefix}: jetzt pruefen`;
  }

  return `${prefix}: pruefbar ab ${formatDateLabel(nextReviewDate)}`;
};

const parseSelectedUnitKey = (selectedUnitKey: string) => {
  const [propertyId = '', unitId = ''] = selectedUnitKey.split('::');
  return { propertyId, unitId };
};

const getSelectedUnitOption = (unitOptions: UnitOption[], selectedUnitKey: string) =>
  unitOptions.find((unit) => `${unit.propertyId}::${unit.unitId}` === selectedUnitKey) ?? null;

const getSelectedPropertyName = (properties: AdminRecord[], selectedUnitKey: string) => {
  const { propertyId } = parseSelectedUnitKey(selectedUnitKey);
  return String(properties.find((property) => property.id === propertyId)?.data.name ?? '');
};

const recalculateGraduatedRows = (baseColdRent: string, rows: RentIncreaseRow[]) => {
  let previousColdRent = parseMoney(baseColdRent);

  return rows.map((row) => {
    const percentValue =
      Number.parseFloat(row.percentIncrease.replace('%', '').replace(',', '.')) || 0;
    const euroIncrease = previousColdRent * (percentValue / 100);
    const nextColdRent = previousColdRent + euroIncrease;

    previousColdRent = nextColdRent;

    return {
      ...row,
      coldRent: formatMoneyNumber(nextColdRent),
      euroIncrease: formatMoneyNumber(euroIncrease),
      percentIncrease: formatPercent(percentValue),
    };
  });
};

const calculateRentReminder = (
  type: string,
  referenceDate: string,
  rows: RentIncreaseRow[]
) => {
  if (type === 'graduated') {
    const nextGraduatedRow = rows.find((row) => row.fromDate);
    return nextGraduatedRow?.reminderDate ?? '';
  }
  if (type === 'index') {
    return calculateReminderForRule(referenceDate, 11);
  }
  if (type === 'legal') {
    return calculateReminderForRule(referenceDate, 30);
  }
  return '';
};

const mapRentHistoryEntry = (entry: unknown): RentHistoryEntry | null => {
  if (!entry || typeof entry !== 'object') return null;
  return {
    coldRent: String((entry as DocumentData).coldRent ?? ''),
    effectiveDate: String((entry as DocumentData).effectiveDate ?? ''),
    id: String((entry as DocumentData).id ?? crypto.randomUUID()),
    label: String((entry as DocumentData).label ?? 'Miete'),
    netOperatingCosts: String((entry as DocumentData).netOperatingCosts ?? ''),
  };
};

const sortRentChartPoints = (left: RentChartPoint, right: RentChartPoint) =>
  new Date(`${left.date}T12:00:00`).getTime() - new Date(`${right.date}T12:00:00`).getTime();

const buildRentHistoryFromData = (
  rentHistory: RentHistoryEntry[],
  coldRent: string,
  netOperatingCosts: string,
  referenceDate: string
) => {
  const validHistory = rentHistory.filter((entry) => entry.effectiveDate);
  const fallbackEntry: RentHistoryEntry = {
    coldRent,
    effectiveDate: referenceDate,
    id: `seed-${referenceDate || 'today'}`,
    label: 'Aktuelle Miete',
    netOperatingCosts,
  };

  if (validHistory.length === 0) {
    return referenceDate ? [fallbackEntry] : [];
  }

  const hasCurrentEntry = validHistory.some(
    (entry) =>
      entry.effectiveDate === referenceDate &&
      parseMoney(entry.coldRent) === parseMoney(coldRent) &&
      parseMoney(entry.netOperatingCosts) === parseMoney(netOperatingCosts)
  );

  return hasCurrentEntry || !referenceDate ? validHistory : [...validHistory, fallbackEntry];
};

const upsertRentHistoryEntry = (history: RentHistoryEntry[], nextEntry: RentHistoryEntry) => {
  const sameDateIndex = history.findIndex((entry) => entry.effectiveDate === nextEntry.effectiveDate);
  if (sameDateIndex === -1) {
    return [...history, nextEntry];
  }

  return history.map((entry, index) => (index === sameDateIndex ? nextEntry : entry));
};

const mapAdditionalPerson = (person: unknown): AdditionalPerson | null => {
  if (!person || typeof person !== 'object') return null;
  return {
    email: String((person as DocumentData).email ?? ''),
    firstName: String((person as DocumentData).firstName ?? ''),
    id: String((person as DocumentData).id ?? crypto.randomUUID()),
    lastName: String((person as DocumentData).lastName ?? ''),
    phone: String((person as DocumentData).phone ?? ''),
    relation: String((person as DocumentData).relation ?? 'other'),
  };
};

const mapRentIncreaseRow = (row: unknown): RentIncreaseRow | null => {
  if (!row || typeof row !== 'object') return null;
  return {
    coldRent: String((row as DocumentData).coldRent ?? ''),
    euroIncrease: String((row as DocumentData).euroIncrease ?? ''),
    fromDate: String((row as DocumentData).fromDate ?? ''),
    id: String((row as DocumentData).id ?? crypto.randomUUID()),
    percentIncrease: String((row as DocumentData).percentIncrease ?? ''),
    reminderDate: String((row as DocumentData).reminderDate ?? ''),
    toDate: String((row as DocumentData).toDate ?? ''),
  };
};

const mapTenantDataToFormState = (data: DocumentData): TenantFormState => {
  const rentIncreaseRows = Array.isArray(data.rentIncreaseRows)
    ? data.rentIncreaseRows
        .map(mapRentIncreaseRow)
        .filter((entry): entry is RentIncreaseRow => Boolean(entry))
    : [];
  const rentHistory = Array.isArray(data.rentHistory)
    ? data.rentHistory
        .map(mapRentHistoryEntry)
        .filter((entry): entry is RentHistoryEntry => Boolean(entry))
    : [];
  const rentIncreaseType = String(data.rentIncreaseType ?? '');
  const moveInDate = String(data.moveInDate ?? '');
  const rentIncreaseReferenceDate = String(data.rentIncreaseReferenceDate ?? '');
  const effectiveReferenceDate = getEffectiveReferenceDate(rentIncreaseReferenceDate, moveInDate);
  const coldRent = String(data.coldRent ?? '');
  const netOperatingCosts = String(data.netOperatingCosts ?? '');

  return {
    additionalPersons: Array.isArray(data.additionalPersons)
      ? data.additionalPersons
          .map(mapAdditionalPerson)
          .filter((entry): entry is AdditionalPerson => Boolean(entry))
      : [],
    additionalPersonsDraftRelation: '',
    annualStatementFile: String(data.annualStatementFile ?? ''),
    bankStatementsFile: String(data.bankStatementsFile ?? ''),
    companyCity: String(data.companyCity ?? ''),
    companyContactEmail: String(data.companyContactEmail ?? ''),
    companyContactName: String(data.companyContactName ?? ''),
    companyContactPhone: String(data.companyContactPhone ?? ''),
    companyContactSalutation: String(data.companyContactSalutation ?? ''),
    companyHouseNumber: String(data.companyHouseNumber ?? ''),
    companyName: String(data.companyName ?? ''),
    companyPostalCode: String(data.companyPostalCode ?? ''),
    companyStreet: String(data.companyStreet ?? ''),
    coldRent,
    depositCertificateFile: String(data.depositCertificateFile ?? ''),
    depositAmount: String(data.depositAmount ?? ''),
    depositType: String(data.depositType ?? ''),
    documentsNotes: String(data.documentsNotes ?? ''),
    email: String(data.email ?? ''),
    firstName: String(data.firstName ?? ''),
    salutation: String(data.salutation ?? data.anrede ?? ''),
    guarantorExists: String(data.guarantorExists ?? 'no'),
    guarantorId: String(data.guarantorId ?? ''),
    guarantorLabel: String(data.guarantorLabel ?? ''),
    identityCopiesFile: String(data.identityCopiesFile ?? ''),
    moveInDate,
    netOperatingCosts,
    notes: String(data.notes ?? ''),
    pendingColdRent: '',
    phone: String(data.phone ?? ''),
    portalPassword: '',
    portalUsername: String(data.portalUsername ?? ''),
    rentIncreaseNextReview: calculateRentReminder(
      rentIncreaseType,
      effectiveReferenceDate,
      rentIncreaseRows
    ),
    rentIncreaseReferenceDate,
    rentHistory: buildRentHistoryFromData(
      rentHistory,
      coldRent,
      netOperatingCosts,
      effectiveReferenceDate
    ),
    rentIncreaseRows,
    rentIncreaseType,
    salaryProofsFile: String(data.salaryProofsFile ?? ''),
    schufaFile: String(data.schufaFile ?? ''),
    selectedUnitKey:
      data.propertyId && data.unitId ? `${String(data.propertyId)}::${String(data.unitId)}` : '',
    storedPortalPassword: String(data.portalPasswordCipher ?? data.portalPassword ?? ''),
    status: String(data.status ?? 'active'),
    taxNumber: String(data.taxNumber ?? ''),
    tenantInfoFile: String(data.tenantInfoFile ?? ''),
    tenancyAddendumsFile: String(data.tenancyAddendumsFile ?? ''),
    tenancyAgreementFile: String(data.tenancyAgreementFile ?? ''),
    vatRule: String(data.vatRule ?? 'no_vat'),
  };
};

type TenantAdminManagerProps = {
  documentId?: string;
  editMode?: boolean;
  hideOverview?: boolean;
  redirectPathAfterSave?: string;
  submitLabel?: string;
  title?: string;
};

export default function TenantAdminManager({
  documentId,
  editMode = false,
  hideOverview = false,
  redirectPathAfterSave,
  submitLabel = 'Mieter anlegen',
  title = 'Mieter anlegen',
}: TenantAdminManagerProps) {
  const { role, user } = useAuth();
  const router = useRouter();
  const [tenants, setTenants] = useState<AdminRecord[]>([]);
  const [properties, setProperties] = useState<AdminRecord[]>([]);
  const [people, setPeople] = useState<AdminRecord[]>([]);
  const [form, setForm] = useState<TenantFormState>(() => defaultFormState());
  const [lastName, setLastName] = useState('');
  const [showPortalPassword, setShowPortalPassword] = useState(false);
  const [originalAssignment, setOriginalAssignment] = useState<{
    propertyId: string;
    unitId: string;
  } | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [overviewPropertyFilter, setOverviewPropertyFilter] = useState('all');
  const [isLoadingInitialValues, setIsLoadingInitialValues] = useState(
    () => editMode && Boolean(documentId)
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const unsubscribers = [
      onSnapshot(query(collection(db, 'tenants')), (snapshot) => {
        setTenants(
          snapshot.docs
            .map((documentSnapshot) => ({
              data: documentSnapshot.data(),
              id: documentSnapshot.id,
            }))
            .sort(
              (left, right) =>
                (right.data.createdAt?.seconds  - 0) - (left.data.createdAt?.seconds  - 0)
            )
        );
      }),
      onSnapshot(query(collection(db, 'properties')), (snapshot) => {
        setProperties(
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
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  useEffect(() => {
    if (!editMode || !documentId) return;
    const currentDocumentId = documentId;
    let isMounted = true;

    async function loadTenant() {
      setIsLoadingInitialValues(true);
      const snapshot = await getDoc(doc(db, 'tenants', currentDocumentId));
      if (!isMounted) return;

      if (!snapshot.exists()) {
        setError('Der Mieter wurde nicht gefunden.');
        setIsLoadingInitialValues(false);
        return;
      }

      const data = snapshot.data();
      const nextForm = mapTenantDataToFormState(data);
      setForm(nextForm);
      setLastName(String(data.lastName ?? ''));
      setOriginalAssignment({
        propertyId: String(data.propertyId ?? ''),
        unitId: String(data.unitId ?? ''),
      });
      if (nextForm.portalUsername) {
        try {
          const secret = await loadStoredPortalPassword(currentDocumentId, nextForm.portalUsername);
          if (!isMounted) return;
          setForm((current) => ({
            ...current,
            portalPassword: secret.password ?? current.portalPassword,
            portalUsername: secret.portalUsername ?? current.portalUsername,
          }));
        } catch (caughtError) {
          console.error(`Portal-Passwort fuer Mieter ${currentDocumentId} konnte nicht geladen werden:`, caughtError);
        }
      }
      setError('');
      setIsLoadingInitialValues(false);
    }

    loadTenant().catch((caughtError) => {
      console.error(`Fehler beim Laden des Mieters ${currentDocumentId}:`, caughtError);
      if (isMounted) {
        setError('Die Mieterdaten konnten nicht geladen werden.');
        setIsLoadingInitialValues(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [documentId, editMode]);

  const unitOptions = useMemo(() => {
    const options: UnitOption[] = [];

    properties.forEach((property) => {
      const units = Array.isArray(property.data.units) ? property.data.units : [];
      units.forEach((unit, index) => {
        if (!unit || typeof unit !== 'object') return;
        const assignedTenantId = String(unit.tenantId ?? '').trim();
        if (assignedTenantId && (!editMode || assignedTenantId !== documentId)) return;

        const unitLabel = String(unit.unitLabel ?? '').trim();
        const floor = String(unit.floor ?? '').trim();
        const position = String(unit.unitPosition ?? '').trim();
        const section = String(unit.section ?? '').trim();
        const fullUnitLabel = [unitLabel, floor, position, section].filter(Boolean).join(' · ');
        const unitId = String(unit.id ?? '').trim();
        if (!unitId) return;

        options.push({
          label: [String(property.data.name ?? ''), fullUnitLabel].filter(Boolean).join(' · '),
          ownerName: String(property.data.ownerName ?? '').trim(),
          propertyId: property.id,
          propertyName: String(property.data.name ?? '').trim(),
          unitId,
          unitIndex: index,
          unitLabel: fullUnitLabel,
        });
      });
    });

    return options.sort((left, right) => left.label.localeCompare(right.label, 'de'));
  }, [documentId, editMode, properties]);

  const overviewPropertyOptions = useMemo(
    () =>
      properties
        .map((property) => ({
          label: String(property.data.name ?? '').trim() || property.id,
          value: property.id,
        }))
        .sort((left, right) => left.label.localeCompare(right.label, 'de')),
    [properties]
  );

  const tenantOverview = useMemo(
    () =>
      tenants
        .filter(
          (tenant) =>
            overviewPropertyFilter === 'all' ||
            String(tenant.data.propertyId ?? '').trim() === overviewPropertyFilter
        )
        .map((tenant) => ({
          id: tenant.id,
          name: [tenant.data.lastName, tenant.data.firstName].filter(Boolean).join(', '),
          rentIncreaseHint: getRentIncreaseStatusLabel(
            String(tenant.data.rentIncreaseType ?? ''),
            String(tenant.data.rentIncreaseNextReview ?? '')
          ),
          subtitle: [
            tenant.data.propertyName,
            tenant.data.unitLabel,
            getStatusLabel(String(tenant.data.status ?? '')),
          ]
            .filter(Boolean)
            .join(' - '),
        }))
        .sort((left, right) => left.name.localeCompare(right.name, 'de')),
    [overviewPropertyFilter, tenants]
  );

  const guarantorOptions = useMemo<GuarantorOption[]>(
    () =>
      people
        .filter((record) => String(record.data.category ?? '').trim() === 'guarantor')
        .map((record) => ({
          id: record.id,
          label:
            [record.data.lastName, record.data.firstName].filter(Boolean).join(', ') || record.id,
          phone: String(record.data.phone ?? record.data.mobile ?? '').trim(),
        }))
        .sort((left, right) => left.label.localeCompare(right.label, 'de')),
    [people]
  );

  const calculatedWarmRent = useMemo(
    () => formatMoneyNumber(parseMoney(form.coldRent) + parseMoney(form.netOperatingCosts)),
    [form.coldRent, form.netOperatingCosts]
  );


  function updateField<K extends keyof TenantFormState>(key: K, value: TenantFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateMoveInDate(value: string) {
    setForm((current) => {
      const nextReferenceDate = current.rentIncreaseReferenceDate || value;
      return {
        ...current,
        moveInDate: value,
        rentIncreaseNextReview: calculateRentReminder(
          current.rentIncreaseType,
          nextReferenceDate,
          current.rentIncreaseRows
        ),
        rentIncreaseReferenceDate: nextReferenceDate,
      };
    });
  }

  function addRentHistoryEntry() {
    setForm((current) => ({
      ...current,
      rentHistory: [
        ...current.rentHistory,
        {
          coldRent: '',
          effectiveDate: current.rentIncreaseReferenceDate || current.moveInDate || '',
          id: crypto.randomUUID(),
          label: 'Historie',
          netOperatingCosts: current.netOperatingCosts,
        },
      ],
    }));
  }

  function updateRentHistoryEntry(
    entryId: string,
    field: keyof RentHistoryEntry,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      rentHistory: current.rentHistory.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              [field]:
                field === 'coldRent' || field === 'netOperatingCosts'
                  ? formatMoneyInput(value)
                  : cleanSpaces(value),
            }
          : entry
      ),
    }));
  }

  function blurRentHistoryEntry(entryId: string, field: 'coldRent' | 'netOperatingCosts', value: string) {
    setForm((current) => ({
      ...current,
      rentHistory: current.rentHistory.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              [field]: formatMoneyForBlur(value),
            }
          : entry
      ),
    }));
  }

  function removeRentHistoryEntry(entryId: string) {
    setForm((current) => ({
      ...current,
      rentHistory: current.rentHistory.filter((entry) => entry.id !== entryId),
    }));
  }

  function handlePendingColdRentChange(value: string) {
    setForm((current) => {
      const nextPendingColdRent = formatMoneyInput(value);
      const baseColdRent = nextPendingColdRent || current.coldRent;
      const nextRows =
        current.rentIncreaseType === 'graduated'
          ? recalculateGraduatedRows(baseColdRent, current.rentIncreaseRows)
          : current.rentIncreaseRows;

      return {
        ...current,
        pendingColdRent: nextPendingColdRent,
        rentIncreaseRows: nextRows,
      };
    });
  }

  function handlePendingColdRentBlur(value: string) {
    setForm((current) => {
      const nextPendingColdRent = formatMoneyForBlur(value);
      const baseColdRent = nextPendingColdRent || current.coldRent;
      const nextRows =
        current.rentIncreaseType === 'graduated'
          ? recalculateGraduatedRows(baseColdRent, current.rentIncreaseRows)
          : current.rentIncreaseRows;

      return {
        ...current,
        pendingColdRent: nextPendingColdRent,
        rentIncreaseRows: nextRows,
      };
    });
  }

  function handleGuarantorChange(guarantorId: string) {
    const selectedGuarantor = guarantorOptions.find((option) => option.id === guarantorId);
    setForm((current) => ({
      ...current,
      guarantorId,
      guarantorLabel: selectedGuarantor ? selectedGuarantor.label : '',
    }));
  }

  function handleRentIncreaseTypeChange(value: string) {
    setForm((current) => {
      const referenceDate = current.rentIncreaseReferenceDate || current.moveInDate;
      const nextRows =
        value === 'graduated'
          ? current.rentIncreaseRows.length > 0
            ? current.rentIncreaseRows
            : [
                {
                  ...createRentIncreaseRow(current.pendingColdRent || current.coldRent),
                  ...createOneYearRange(referenceDate),
                  reminderDate: referenceDate ? shiftMonths(referenceDate, -1) : '',
                },
              ]
          : [];

      return {
        ...current,
        rentIncreaseNextReview: calculateRentReminder(
          value,
          referenceDate,
          nextRows
        ),
        rentIncreaseRows: nextRows,
        rentIncreaseType: value,
      };
    });
  }

  function handleRentIncreaseReferenceDateChange(value: string) {
    setForm((current) => ({
      ...current,
      rentIncreaseNextReview: calculateRentReminder(
        current.rentIncreaseType,
        value,
        current.rentIncreaseRows
      ),
      rentIncreaseReferenceDate: value,
    }));
  }

  function addRentIncreaseRow() {
    setForm((current) => {
      const previousRow = current.rentIncreaseRows.at(-1);
      const baseColdRent =
        previousRow?.coldRent || current.pendingColdRent || current.coldRent || '0,00 EUR';
      const nextStartDate =
        previousRow?.toDate
          ? shiftDays(previousRow.toDate, 1)
          : current.rentIncreaseReferenceDate || current.moveInDate;
      const nextPercent = previousRow?.percentIncrease || '0,00 %';
      const previousBaseColdRent = parseMoney(baseColdRent);
      const percentValue =
        Number.parseFloat(nextPercent.replace('%', '').replace(',', '.')) || 0;
      const euroIncrease = previousBaseColdRent * (percentValue / 100);
      const nextRows = [
        ...current.rentIncreaseRows,
        {
          ...createRentIncreaseRow(baseColdRent),
          ...createOneYearRange(nextStartDate),
          coldRent: formatMoneyNumber(previousBaseColdRent + euroIncrease),
          euroIncrease: formatMoneyNumber(euroIncrease),
          percentIncrease: formatPercent(percentValue),
          reminderDate: nextStartDate ? shiftMonths(nextStartDate, -1) : '',
        },
      ];

      return {
        ...current,
        rentIncreaseNextReview: calculateRentReminder(
          current.rentIncreaseType,
          current.rentIncreaseReferenceDate || current.moveInDate,
          nextRows
        ),
        rentIncreaseRows: nextRows,
      };
    });
  }

  function removeRentIncreaseRow(rowId: string) {
    setForm((current) => {
      const nextRows = current.rentIncreaseRows.filter((row) => row.id !== rowId);
      return {
        ...current,
        rentIncreaseNextReview: calculateRentReminder(
          current.rentIncreaseType,
          current.rentIncreaseReferenceDate || current.moveInDate,
          nextRows
        ),
        rentIncreaseRows: nextRows,
      };
    });
  }

  function updateRentIncreaseRow(
    rowId: string,
    field: keyof RentIncreaseRow,
    value: string
  ) {
    setForm((current) => {
      const nextRows = current.rentIncreaseRows.map((row, index) => {
        if (row.id !== rowId) return row;

        const previousColdRent =
          index === 0
            ? parseMoney(current.pendingColdRent || current.coldRent)
            : parseMoney(
                current.rentIncreaseRows[index - 1]?.coldRent ||
                  current.pendingColdRent ||
                  current.coldRent
              );

        const nextRow = { ...row, [field]: value };

        if (field === 'fromDate') {
          nextRow.fromDate = value;
          nextRow.toDate = createOneYearRange(value).toDate;
          nextRow.reminderDate = shiftMonths(value, -1);
        }

        if (field === 'euroIncrease') {
          const euroIncrease = parseMoney(value);
          const newColdRent = previousColdRent + euroIncrease;
          const percentIncrease = previousColdRent > 0 ? (euroIncrease / previousColdRent) * 100 : 0;
          nextRow.euroIncrease = formatMoneyNumber(euroIncrease);
          nextRow.coldRent = formatMoneyNumber(newColdRent);
          nextRow.percentIncrease = formatPercent(percentIncrease);
        }

        if (field === 'percentIncrease') {
          const percentValue = Number.parseFloat(value.replace('%', '').replace(',', '.')) || 0;
          const euroIncrease = previousColdRent * (percentValue / 100);
          const newColdRent = previousColdRent + euroIncrease;
          nextRow.percentIncrease = formatPercent(percentValue);
          nextRow.euroIncrease = formatMoneyNumber(euroIncrease);
          nextRow.coldRent = formatMoneyNumber(newColdRent);
        }

        return nextRow;
      });

      return {
        ...current,
        rentIncreaseNextReview: calculateRentReminder(
          current.rentIncreaseType,
          current.rentIncreaseReferenceDate || current.moveInDate,
          nextRows
        ),
        rentIncreaseRows: nextRows,
      };
    });
  }

  function resetForm() {
    setForm(defaultFormState());
    setLastName('');
    setOriginalAssignment(null);
    setShowPortalPassword(false);
  }

  async function provisionTenantPortalAccess(
    targetId: string,
    username: string,
    password: string
    ) {
      const isLocalDevelopment =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const token = !isLocalDevelopment && user ? await user.getIdToken() : '';
      const selectedUnitInfo = getSelectedUnitOption(unitOptions, form.selectedUnitKey);
      const selectedUnitIds = parseSelectedUnitKey(form.selectedUnitKey);
      const selectedProperty =
        properties.find((property) => property.id === selectedUnitIds.propertyId) ?? null;
      const selectedPropertyUnits = Array.isArray(selectedProperty?.data.units)
        ? selectedProperty.data.units
        : [];
      const selectedUnitData =
        selectedPropertyUnits.find(
          (unit: DocumentData) => String(unit?.id ?? '').trim() === selectedUnitIds.unitId
        ) ?? null;
      const response = await fetch('/api/admin/portal-access', {
        body: JSON.stringify({
          contactEmail: form.email,
          existingPasswordCipher: form.storedPortalPassword,
          password,
          propertySnapshot: selectedProperty
            ? {
                city: String(selectedProperty.data.city ?? ''),
                houseNumber: String(selectedProperty.data.houseNumber ?? ''),
                id: selectedProperty.id,
                meters: Array.isArray(selectedProperty.data.meters)
                  ? selectedProperty.data.meters
                  : [],
                name: String(selectedProperty.data.name ?? ''),
                postalCode: String(selectedProperty.data.postalCode ?? ''),
                street: String(selectedProperty.data.street ?? ''),
                units: selectedUnitData
                  ? [
                      {
                        ...selectedUnitData,
                        meters: Array.isArray(selectedUnitData.meters)
                          ? selectedUnitData.meters
                          : [],
                      },
                    ]
                  : [],
              }
            : null,
          targetId,
          targetSnapshot: {
            coldRent: form.coldRent,
            email: form.email,
            firstName: form.firstName,
            houseNumber: String(selectedProperty?.data.houseNumber ?? ''),
            lastName,
            phone: form.phone,
            city: String(selectedProperty?.data.city ?? ''),
            postalCode: String(selectedProperty?.data.postalCode ?? ''),
            propertyId: selectedUnitIds.propertyId,
            propertyName: getSelectedPropertyName(properties, form.selectedUnitKey),
            street: String(selectedProperty?.data.street ?? ''),
            unitId: selectedUnitIds.unitId,
            unitLabel: selectedUnitInfo?.unitLabel ?? '',
            unitMeters:
              selectedUnitData && Array.isArray(selectedUnitData.meters)
                ? selectedUnitData.meters
                : [],
          },
          targetType: 'tenant',
          username,
      }),
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    const result = (await response.json()) as {
      authEmail?: string;
      error?: string;
      ok?: boolean;
      portalAuthUid?: string;
      portalPasswordCipher?: string;
    };

    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'portal_access_save_failed');
    }

    await updateDoc(doc(db, 'tenants', targetId), {
      authEmail: result.authEmail ?? '',
      portalAccessEnabled: true,
      portalAuthUid: result.portalAuthUid ?? '',
      portalPasswordCipher: result.portalPasswordCipher ?? '',
      portalUsername: username,
      updatedAt: serverTimestamp(),
    });

    setForm((current) => ({
      ...current,
      portalPassword: password || current.portalPassword,
      portalUsername: username,
      storedPortalPassword: result.portalPasswordCipher ?? current.storedPortalPassword,
    }));
  }

  async function loadStoredPortalPassword(targetId: string, username: string) {
    const isLocalDevelopment =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const token = !isLocalDevelopment && user ? await user.getIdToken() : '';
    const response = await fetch('/api/admin/portal-access-secret', {
      body: JSON.stringify({
        targetId,
        targetType: 'tenant',
        username,
      }),
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    const result = (await response.json()) as {
      error?: string;
      ok?: boolean;
      password?: string;
      portalUsername?: string;
    };

    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'portal_secret_load_failed');
    }

    return result;
  }

  function addAdditionalPerson() {
    setForm((current) => ({
      ...current,
      additionalPersons: [
        ...current.additionalPersons,
        {
          email: '',
          firstName: '',
          id: crypto.randomUUID(),
          lastName: '',
          phone: '',
          relation: current.additionalPersonsDraftRelation || 'other',
        },
      ],
      additionalPersonsDraftRelation: '',
    }));
  }

  function updateAdditionalPerson(
    personId: string,
    field: keyof AdditionalPerson,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      additionalPersons: current.additionalPersons.map((person) =>
        person.id === personId
          ? {
              ...person,
              [field]:
                field === 'firstName' || field === 'lastName'
                  ? titleCase(value)
                  : cleanSpaces(value),
            }
          : person
      ),
    }));
  }

  function removeAdditionalPerson(personId: string) {
    setForm((current) => ({
      ...current,
      additionalPersons: current.additionalPersons.filter((person) => person.id !== personId),
    }));
  }

  function handleFileSelection(
    field:
      | 'annualStatementFile'
      | 'bankStatementsFile'
      | 'depositCertificateFile'
      | 'identityCopiesFile'
      | 'salaryProofsFile'
      | 'schufaFile'
      | 'tenantInfoFile'
      | 'tenancyAddendumsFile'
      | 'tenancyAgreementFile',
    files: FileList | null
  ) {
    const fileName = files && files.length > 0 ? files[0].name : '';
    updateField(field, fileName);
  }

  async function syncTenantAssignment(
    tenantId: string,
    nextAssignment: { propertyId: string; unitId: string; unitIndex: number; tenantName: string },
    previousAssignment?: { propertyId: string; unitId: string } | null
  ) {
    const assignmentsToClear =
      previousAssignment &&
      (previousAssignment.propertyId !== nextAssignment.propertyId ||
        previousAssignment.unitId !== nextAssignment.unitId)
        ? [previousAssignment]
        : [];

    for (const assignment of assignmentsToClear) {
      const property = properties.find((entry) => entry.id === assignment.propertyId);
      if (!property || !Array.isArray(property.data.units)) continue;

      const clearedUnits = property.data.units.map((unit: unknown) => {
        if (!unit || typeof unit !== 'object') return unit;
        return String((unit as DocumentData).id ?? '') === assignment.unitId
          ? { ...(unit as DocumentData), tenantId: '', tenantName: '' }
          : unit;
      });

      await updateDoc(doc(db, 'properties', assignment.propertyId), {
        units: clearedUnits,
        updatedAt: serverTimestamp(),
      });
    }

    const nextProperty = properties.find((entry) => entry.id === nextAssignment.propertyId);
    if (!nextProperty || !Array.isArray(nextProperty.data.units)) return;

    const nextUnits = nextProperty.data.units.map((unit: unknown, index: number) =>
      index === nextAssignment.unitIndex
        ? {
            ...(unit as DocumentData),
            tenantId,
            tenantName: nextAssignment.tenantName,
          }
        : unit
    );

    await updateDoc(doc(db, 'properties', nextAssignment.propertyId), {
      units: nextUnits,
      updatedAt: serverTimestamp(),
    });
  }

  async function clearTenantAssignment(tenantRecord: AdminRecord) {
    const propertyId = String(tenantRecord.data.propertyId ?? '');
    const unitId = String(tenantRecord.data.unitId ?? '');
    if (!propertyId || !unitId) return;

    const property = properties.find((entry) => entry.id === propertyId);
    if (!property || !Array.isArray(property.data.units)) return;

    const nextUnits = property.data.units.map((unit: unknown) => {
      if (!unit || typeof unit !== 'object') return unit;
      return String((unit as DocumentData).id ?? '') === unitId
        ? { ...(unit as DocumentData), tenantId: '', tenantName: '' }
        : unit;
    });

    await updateDoc(doc(db, 'properties', propertyId), {
      units: nextUnits,
      updatedAt: serverTimestamp(),
    });
  }

  function handleDelete(tenantId: string) {
    const confirmed = window.confirm('Mieter wirklich löschen?');
    if (!confirmed) return;

    const tenantRecord = tenants.find((entry) => entry.id === tenantId);
    setMessage('');
    setError('');

    startTransition(async () => {
      try {
        if (tenantRecord) {
          await clearTenantAssignment(tenantRecord);
        }
        await deleteDoc(doc(db, 'tenants', tenantId));
        setMessage('Mieter wurde gelöscht.');
      } catch (caughtError) {
        console.error(`Fehler beim Löschen des Mieters ${tenantId}:`, caughtError);
        setError('Mieter konnte nicht gelöscht werden.');
      }
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role !== 'admin' || !user) {
      setError('Nur Verwalter dürfen in diesem Bereich Daten anlegen.');
      return;
    }

    const selectedUnit = unitOptions.find(
      (unit) => `${unit.propertyId}::${unit.unitId}` === form.selectedUnitKey
    );
    if (!selectedUnit) {
      setError('Bitte eine vorhandene Einheit auswählen.');
      return;
    }

    if (form.pendingColdRent && !form.rentIncreaseReferenceDate) {
      setError(
        'Bitte ein Datum bei Letzte Mieterhöhung hinterlegen, wenn du eine neue Kaltmiete speicherst.'
      );
      return;
    }

    if (form.portalUsername && !form.email) {
      setError('Bitte eine E-Mail-Adresse hinterlegen, bevor du einen Portalzugang anlegst.');
      return;
    }

    if (!editMode && form.portalUsername && !form.portalPassword) {
      setError('Bitte ein Passwort hinterlegen, wenn du für den Mieter einen Portalzugang anlegst.');
      return;
    }

    if (editMode && form.portalUsername && !form.portalPassword && !form.storedPortalPassword) {
      setError('Bitte ein Passwort hinterlegen, damit der Portalzugang erstmals eingerichtet werden kann.');
      return;
    }

    const selectedProperty = properties.find((property) => property.id === selectedUnit.propertyId);
    const propertyUnits = Array.isArray(selectedProperty?.data.units)
      ? selectedProperty.data.units
      : [];

    setError('');
    setMessage('');

    startTransition(async () => {
      try {
        const effectiveReferenceDate = getEffectiveReferenceDate(
          form.rentIncreaseReferenceDate,
          form.moveInDate
        );
        const nextColdRent = form.pendingColdRent
          ? formatMoneyForBlur(form.pendingColdRent)
          : form.coldRent;
        const nextHistory = form.pendingColdRent
          ? upsertRentHistoryEntry(
              buildRentHistoryFromData(
                form.rentHistory,
                form.coldRent,
                form.netOperatingCosts,
                effectiveReferenceDate
              ),
              {
                coldRent: nextColdRent,
                effectiveDate: form.rentIncreaseReferenceDate,
                id: crypto.randomUUID(),
                label: 'Mieterhoehung',
                netOperatingCosts: formatMoneyInput(form.netOperatingCosts),
              }
            )
          : buildRentHistoryFromData(
              form.rentHistory,
              form.coldRent,
              form.netOperatingCosts,
              effectiveReferenceDate
            );

        const payload = {
          additionalPersons: form.additionalPersons,
          annualStatementFile: form.annualStatementFile,
          bankStatementsFile: form.bankStatementsFile,
          companyCity: titleCase(form.companyCity),
          companyContactEmail: cleanSpaces(form.companyContactEmail).toLowerCase(),
          companyContactName: titleCase(form.companyContactName),
          companyContactPhone: cleanSpaces(form.companyContactPhone),
          companyContactSalutation: cleanSpaces(form.companyContactSalutation),
          companyHouseNumber: cleanSpaces(form.companyHouseNumber),
          companyName: titleCase(form.companyName),
          companyPostalCode: cleanSpaces(form.companyPostalCode),
          companyStreet: titleCase(form.companyStreet),
          coldRent: formatMoneyInput(nextColdRent),
          createdAt: serverTimestamp(),
          createdByEmail: user.email ?? null,
          createdByUid: user.uid,
          depositCertificateFile: form.depositCertificateFile,
          depositAmount: formatMoneyInput(form.depositAmount),
          depositType: form.depositType,
          documentsNotes: cleanSpaces(form.documentsNotes),
          email: cleanSpaces(form.email).toLowerCase(),
          firstName: titleCase(form.firstName),
          salutation: cleanSpaces(form.salutation),
          guarantorExists: form.guarantorExists,
          guarantorId: form.guarantorId,
          guarantorLabel: form.guarantorLabel,
          identityCopiesFile: form.identityCopiesFile,
          lastName: titleCase(lastName),
          moveInDate: form.moveInDate,
          netOperatingCosts: formatMoneyInput(form.netOperatingCosts),
          notes: cleanSpaces(form.notes),
          ownerName: selectedUnit.ownerName,
          phone: cleanSpaces(form.phone),
          portalUsername: cleanSpaces(form.portalUsername).toLowerCase(),
          propertyId: selectedUnit.propertyId,
          propertyName: selectedUnit.propertyName,
          propertyUnit: selectedUnit.label,
          rentHistory: nextHistory,
          rentIncreaseNextReview: form.rentIncreaseNextReview,
          rentIncreaseReferenceDate: form.rentIncreaseReferenceDate,
          rentIncreaseRows: form.rentIncreaseRows,
          rentIncreaseType: form.rentIncreaseType,
          salaryProofsFile: form.salaryProofsFile,
          schufaFile: form.schufaFile,
          status: form.status,
          taxNumber: cleanSpaces(form.taxNumber),
          tenantInfoFile: form.tenantInfoFile,
          tenancyAddendumsFile: form.tenancyAddendumsFile,
          tenancyAgreementFile: form.tenancyAgreementFile,
          unitId: selectedUnit.unitId,
          unitLabel: selectedUnit.unitLabel,
          updatedAt: serverTimestamp(),
          vatRule: form.vatRule,
          warmRent: calculatedWarmRent,
        };

        const tenantName = [titleCase(lastName), titleCase(form.firstName)]
          .filter(Boolean)
          .join(', ');

        const currentDocumentId = documentId;

        if (editMode && currentDocumentId) {
          await updateDoc(doc(db, 'tenants', currentDocumentId), {
            ...payload,
            updatedByEmail: user.email ?? null,
            updatedByUid: user.uid,
          });

          await syncTenantAssignment(
            currentDocumentId,
            {
              propertyId: selectedUnit.propertyId,
              tenantName,
              unitId: selectedUnit.unitId,
              unitIndex: selectedUnit.unitIndex,
            },
            originalAssignment
          );

          setMessage('Mieter wurde aktualisiert.');
          if (redirectPathAfterSave) {
            router.push(redirectPathAfterSave);
          }

          if (payload.portalUsername && payload.email) {
            await provisionTenantPortalAccess(currentDocumentId, payload.portalUsername, form.portalPassword);
          }
        } else {
          const tenantRef = await addDoc(collection(db, 'tenants'), {
            ...payload,
            createdAt: serverTimestamp(),
            createdByEmail: user.email ?? null,
            createdByUid: user.uid,
          });

          if (selectedProperty) {
            const nextUnits = propertyUnits.map((unit, index) =>
              index === selectedUnit.unitIndex
                ? {
                    ...unit,
                    tenantId: tenantRef.id,
                    tenantName,
                  }
                : unit
            );

            await updateDoc(doc(db, 'properties', selectedProperty.id), {
              units: nextUnits,
              updatedAt: serverTimestamp(),
            });
          }

          if (payload.portalUsername && payload.email) {
            await provisionTenantPortalAccess(tenantRef.id, payload.portalUsername, form.portalPassword);
          }

          setMessage('Mieter wurde gespeichert.');
          resetForm();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } catch (caughtError) {
        console.error('Fehler beim Speichern des Mieters:', caughtError);
        setError('Speichern fehlgeschlagen. Bitte prüfe Firestore-Regeln und Berechtigungen.');
      }
    });
  }

  return (
    <div className="mt-6 space-y-6">
      {!hideOverview ? (
      <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Uebersicht</p>
            <h3 className="mt-2 text-3xl text-slate-950">Mieter</h3>
          </div>
          <label className="block min-w-[240px]">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Objekt</span>
            <select
              className="mt-2 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => setOverviewPropertyFilter(event.target.value)}
              value={overviewPropertyFilter}
            >
              <option value="all">Alle</option>
              {overviewPropertyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {tenantOverview.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-stone-300 bg-stone-50 px-4 py-4 text-sm text-slate-600">
            Noch keine Mieter angelegt.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {tenantOverview.map((tenant) => (
              <article
                className="rounded-[20px] border border-stone-200 bg-stone-50 px-3.5 py-2.5"
                key={tenant.id}
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-5 text-slate-950">{tenant.name}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{tenant.subtitle}</p>
                    {tenant.rentIncreaseHint ? (
                      <p className="mt-1 text-[11px] font-medium leading-4 text-amber-700">
                        {tenant.rentIncreaseHint}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950" href={`/admin/mieter/${tenant.id}`}>Ansehen</Link>
                    <Link className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950" href={`/admin/mieter/${tenant.id}/bearbeiten`}>Bearbeiten</Link>
                    <button className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100" onClick={() => handleDelete(tenant.id)} type="button">Löschen</button>
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
          {editMode ? 'Mieter bearbeiten' : 'Neuer Datensatz'}
        </p>
        <h3 className="mt-2 text-3xl text-slate-950">{title}</h3>

        {isLoadingInitialValues ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-stone-300 bg-stone-50 px-4 py-4 text-sm text-slate-600">
            Mieter wird geladen...
          </div>
        ) : (
        <form autoComplete="off" className="mt-8 space-y-8" onSubmit={handleSubmit}>
          <input autoComplete="username" className="hidden" name="tenant-fake-username" tabIndex={-1} type="text" />
          <input autoComplete="current-password" className="hidden" name="tenant-fake-password" tabIndex={-1} type="password" />
          <section className="rounded-[28px] border border-stone-200 bg-stone-50/70 p-5">
            <div className="rounded-[24px] border border-stone-200 bg-white p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">Vergangene Miethoehen</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Hier kannst du alte Kaltmieten und Nebenkosten rueckwirkend nachtragen.
                  </p>
                </div>
                <button
                  className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
                  onClick={addRentHistoryEntry}
                  type="button"
                >
                  Historie hinzufuegen
                </button>
              </div>

              {form.rentHistory.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {form.rentHistory
                    .slice()
                    .sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate))
                    .map((entry) => (
                      <div className="rounded-[20px] border border-stone-200 bg-stone-50 p-3" key={entry.id}>
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                          <label className="block space-y-2">
                            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Datum</span>
                            <input
                              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                              onChange={(event) => updateRentHistoryEntry(entry.id, 'effectiveDate', event.target.value)}
                              type="date"
                              value={entry.effectiveDate}
                            />
                          </label>
                          <label className="block space-y-2">
                            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Kaltmiete</span>
                            <input
                              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                              onBlur={(event) => blurRentHistoryEntry(entry.id, 'coldRent', event.target.value)}
                              onChange={(event) => updateRentHistoryEntry(entry.id, 'coldRent', event.target.value)}
                              placeholder="z. B. 850,00 EUR"
                              value={entry.coldRent}
                            />
                          </label>
                          <label className="block space-y-2">
                            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Nebenkosten</span>
                            <input
                              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                              onBlur={(event) => blurRentHistoryEntry(entry.id, 'netOperatingCosts', event.target.value)}
                              onChange={(event) => updateRentHistoryEntry(entry.id, 'netOperatingCosts', event.target.value)}
                              placeholder="z. B. 220,00 EUR"
                              value={entry.netOperatingCosts}
                            />
                          </label>
                          <div className="flex items-end">
                            <button
                              className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                              onClick={() => removeRentHistoryEntry(entry.id)}
                              type="button"
                            >
                              Entfernen
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="mt-4 rounded-[20px] border border-dashed border-stone-300 bg-stone-50 px-4 py-4 text-sm text-slate-600">
                  Noch keine rueckwirkenden Miethoehen hinterlegt.
                </div>
              )}
            </div>
          </section>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Anrede</span>
              <select
                className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                onChange={(event) => updateField('salutation', event.target.value)}
                value={form.salutation}
              >
                <option value="">Bitte wählen</option>
                <option value="Herr">Herr</option>
                <option value="Frau">Frau</option>
                <option value="Divers">Divers</option>
                <option value="Ohne Angabe">Ohne Angabe</option>
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Vorname</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateField('firstName', titleCase(event.target.value))} placeholder="Max" required value={form.firstName} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Nachname</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => setLastName(titleCase(event.target.value))} placeholder="Mustermann" required value={lastName} />
            </label>
            <label className="block space-y-2 xl:col-span-3">
              <span className="text-sm font-medium text-slate-700">Einheit</span>
              <select className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateField('selectedUnitKey', event.target.value)} required value={form.selectedUnitKey}>
                <option value="">Bitte freie Einheit auswählen</option>
                {unitOptions.map((unit) => (
                  <option key={`${unit.propertyId}::${unit.unitId}`} value={`${unit.propertyId}::${unit.unitId}`}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">E-Mail</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateField('email', event.target.value)} placeholder="mieter@example.de" type="email" value={form.email} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Telefon</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateField('phone', cleanSpaces(event.target.value))} placeholder="+49 ..." type="tel" value={form.phone} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Steuernummer</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateField('taxNumber', cleanSpaces(event.target.value))} placeholder="optional" value={form.taxNumber} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Einzugsdatum</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateMoveInDate(event.target.value)} type="date" value={form.moveInDate} />
            </label>
          </div>

          <div className="rounded-[28px] border border-stone-200 bg-stone-50/70 p-5">
            <div>
              <p className="text-sm font-medium text-slate-900">Portalzugang</p>
              <p className="mt-1 text-xs leading-6 text-slate-500">
                Optional. Hier legst du Benutzername und Passwort für den späteren Login im Portal fest.
              </p>
            </div>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Benutzername</span>
                <input
                  className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                  onChange={(event) => updateField('portalUsername', cleanSpaces(event.target.value).toLowerCase())}
                  placeholder="z. B. gross.hentschel"
                  value={form.portalUsername}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Passwort</span>
                <div className="relative">
                  <input
                    autoComplete="new-password"
                    className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 pr-20 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                    name="tenant-portal-password"
                    onChange={(event) => updateField('portalPassword', event.target.value)}
                    placeholder={form.storedPortalPassword ? 'Neues Passwort setzen oder leer lassen' : 'Passwort festlegen'}
                    type={showPortalPassword ? 'text' : 'password'}
                    value={form.portalPassword}
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs font-medium text-slate-500 transition hover:text-slate-900"
                    onClick={() => setShowPortalPassword((current) => !current)}
                    type="button"
                  >
                    {showPortalPassword ? 'Verbergen' : 'Anzeigen'}
                  </button>
                </div>
              </label>
            </div>
          </div>

          <div className="rounded-[28px] border border-stone-200 bg-stone-50/70 p-5">
            <div>
              <p className="text-sm font-medium text-slate-900">Firma / Zentrale</p>
              <p className="mt-1 text-xs leading-6 text-slate-500">
                Für gewerbliche Mieter oder zentrale Ansprechpartner des Mieters.
              </p>
            </div>
            <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Firma</span>
                <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateField('companyName', titleCase(event.target.value))} placeholder="z. B. Mustermann Handels GmbH" value={form.companyName} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Kontaktperson</span>
                <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateField('companyContactName', titleCase(event.target.value))} placeholder="Vor- und Nachname" value={form.companyContactName} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Anrede Kontaktperson</span>
                <select className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateField('companyContactSalutation', event.target.value)} value={form.companyContactSalutation}>
                  <option value="">Bitte wählen</option>
                  <option value="Herr">Herr</option>
                  <option value="Frau">Frau</option>
                  <option value="Divers">Divers</option>
                  <option value="Ohne Angabe">Ohne Angabe</option>
                </select>
              </label>
              <label className="block space-y-2 xl:col-span-3">
                <span className="text-sm font-medium text-slate-700">Straße</span>
                <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateField('companyStreet', titleCase(event.target.value))} placeholder="Musterstraße" value={form.companyStreet} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Hausnummer</span>
                <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateField('companyHouseNumber', cleanSpaces(event.target.value))} placeholder="12a" value={form.companyHouseNumber} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">PLZ</span>
                <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateField('companyPostalCode', cleanSpaces(event.target.value))} placeholder="12345" value={form.companyPostalCode} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Ort</span>
                <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateField('companyCity', titleCase(event.target.value))} placeholder="Musterstadt" value={form.companyCity} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Kontakt E-Mail</span>
                <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateField('companyContactEmail', cleanSpaces(event.target.value).toLowerCase())} placeholder="kontakt@firma.de" type="email" value={form.companyContactEmail} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Kontakt Telefon</span>
                <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateField('companyContactPhone', cleanSpaces(event.target.value))} placeholder="+49 ..." value={form.companyContactPhone} />
              </label>
            </div>
          </div>

          <div className="rounded-[28px] border border-stone-200 bg-stone-50/70 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">Weitere Personen</p>
                <p className="mt-1 text-xs leading-6 text-slate-500">
                  Für Ehepartner, Mitmieter oder weitere Haushaltsangehörige.
                </p>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <select className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60 md:min-w-[220px]" onChange={(event) => updateField('additionalPersonsDraftRelation', event.target.value)} value={form.additionalPersonsDraftRelation}>
                  <option value="">Rolle wählen</option>
                  {additionalPersonRelations.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950" onClick={addAdditionalPerson} type="button">
                  Person hinzufügen
                </button>
              </div>
            </div>

            {form.additionalPersons.length > 0 ? (
              <div className="mt-4 space-y-4">
                {form.additionalPersons.map((person, index) => (
                  <div className="rounded-[24px] border border-stone-200 bg-white p-4" key={person.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900">Weitere Person {index + 1}</p>
                      <button className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-700 transition hover:bg-rose-100" onClick={() => removeAdditionalPerson(person.id)} type="button">
                        Entfernen
                      </button>
                    </div>
                    <div className="mt-3 grid gap-4 md:grid-cols-3">
                      <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateAdditionalPerson(person.id, 'firstName', event.target.value)} placeholder="Vorname" value={person.firstName} />
                      <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateAdditionalPerson(person.id, 'lastName', event.target.value)} placeholder="Nachname" value={person.lastName} />
                      <select className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateAdditionalPerson(person.id, 'relation', event.target.value)} value={person.relation}>
                        {additionalPersonRelations.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateAdditionalPerson(person.id, 'phone', cleanSpaces(event.target.value))} placeholder="Telefon" value={person.phone} />
                      <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60 md:col-span-2" onChange={(event) => updateAdditionalPerson(person.id, 'email', cleanSpaces(event.target.value).toLowerCase())} placeholder="E-Mail" type="email" value={person.email} />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Aktuelle Kaltmiete</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-100 px-4 py-3 text-sm text-slate-700 outline-none" readOnly value={form.coldRent} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Betriebskosten</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onBlur={(event) => updateField('netOperatingCosts', formatMoneyForBlur(event.target.value))} onChange={(event) => updateField('netOperatingCosts', formatMoneyInput(event.target.value))} placeholder="z. B. 220,00 EUR" value={form.netOperatingCosts} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Umsatzsteuer-Regelung</span>
              <select className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateField('vatRule', event.target.value)} value={form.vatRule}>
                {vatRuleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Warmmiete (netto)</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-100 px-4 py-3 text-sm text-slate-700 outline-none" readOnly value={calculatedWarmRent} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Status</span>
              <select className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateField('status', event.target.value)} required value={form.status}>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Kautionsart</span>
              <select className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateField('depositType', event.target.value)} value={form.depositType}>
                <option value="">Bitte wählen</option>
                {depositTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Kautionsbetrag</span>
              <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onBlur={(event) => updateField('depositAmount', formatMoneyForBlur(event.target.value))} onChange={(event) => updateField('depositAmount', formatMoneyInput(event.target.value))} placeholder="z. B. 2.550,00 EUR" value={form.depositAmount} />
            </label>
          </div>

          <div className="rounded-[28px] border border-stone-200 bg-stone-50/70 p-5">
            <div className="mb-4">
              <p className="text-sm font-medium text-slate-900">Mieterhoehung</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Die neue Miete traegst du hier ein. Oben wird nur der aktuell gespeicherte Stand angezeigt.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Neue Kaltmiete</span>
                <input className="w-full rounded-2xl border border-amber-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onBlur={(event) => handlePendingColdRentBlur(event.target.value)} onChange={(event) => handlePendingColdRentChange(event.target.value)} placeholder="Neue Miethoehe eintragen" value={form.pendingColdRent} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Mieterhöhungsart</span>
                <select className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => handleRentIncreaseTypeChange(event.target.value)} value={form.rentIncreaseType}>
                  <option value="">Bitte wählen</option>
                  {rentIncreaseOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Letzte Mieterhöhung</span>
                <input className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => handleRentIncreaseReferenceDateChange(event.target.value)} type="date" value={form.rentIncreaseReferenceDate} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Nächste Erinnerung</span>
                <input className="w-full rounded-2xl border border-stone-300 bg-stone-100 px-4 py-3 text-sm text-slate-700 outline-none" readOnly value={form.rentIncreaseNextReview} />
              </label>
            </div>

            {form.rentIncreaseType === 'graduated' ? (
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Staffelplan</p>
                    <p className="mt-1 text-xs leading-6 text-slate-500">
                      Jede Zeile bildet einen Zeitraum von einem Jahr. Die nächste Zeile übernimmt
                      automatisch denselben Prozentsatz und verlängert den Zeitraum um ein weiteres Jahr.
                    </p>
                  </div>
                  <button className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950" onClick={addRentIncreaseRow} type="button">
                    Zeile hinzufügen
                  </button>
                </div>
                {form.rentIncreaseRows.map((row) => (
                  <div className="rounded-[24px] border border-stone-200 bg-white p-4" key={row.id}>
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                      <div className="space-y-2">
                        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Zeitraum</span>
                        <div className="grid gap-3 md:grid-cols-2">
                          <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateRentIncreaseRow(row.id, 'fromDate', event.target.value)} type="date" value={row.fromDate} />
                          <input className="w-full rounded-2xl border border-stone-300 bg-stone-100 px-4 py-3 text-sm text-slate-700 outline-none" readOnly value={row.toDate} />
                        </div>
                      </div>
                      <label className="block space-y-2">
                        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Erhöhung %</span>
                        <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateRentIncreaseRow(row.id, 'percentIncrease', event.target.value)} value={row.percentIncrease} />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Erhöhung EUR</span>
                        <input className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateRentIncreaseRow(row.id, 'euroIncrease', event.target.value)} value={row.euroIncrease} />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Aktuelle Kaltmiete</span>
                        <input className="w-full rounded-2xl border border-stone-300 bg-stone-100 px-4 py-3 text-sm text-slate-700 outline-none" readOnly value={row.coldRent} />
                      </label>
                      <div className="flex items-end gap-3">
                        <button className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700 transition hover:bg-rose-100" onClick={() => removeRentIncreaseRow(row.id)} type="button">
                          Entfernen
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {form.rentIncreaseType === 'index' ? (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Bei Indexmiete prüft das System jährlich und erinnert mit einem Monat Puffer.
              </p>
            ) : null}

            {form.rentIncreaseType === 'legal' ? (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Bei Erhöhung nach Gesetz ist die nächste Prüfung nach drei Jahren fällig. Die
                Erinnerung kommt sechs Monate vorher, also nach zweieinhalb Jahren seit der letzten
                Erhöhung bzw. seit dem hier hinterlegten Datum.
              </p>
            ) : null}
          </div>

          <div className="rounded-[28px] border border-stone-200 bg-stone-50/70 p-5">
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Gibt es einen Bürgen?</span>
                <select className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateField('guarantorExists', event.target.value)} value={form.guarantorExists}>
                  <option value="no">Nein</option>
                  <option value="yes">Ja</option>
                </select>
              </label>
              {form.guarantorExists === 'yes' ? (
                <>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700">Bürge</span>
                    <select className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => handleGuarantorChange(event.target.value)} value={form.guarantorId}>
                      <option value="">Bitte aus Personenliste wählen</option>
                      {guarantorOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700">Kontakt Bürge</span>
                    <input className="w-full rounded-2xl border border-stone-300 bg-stone-100 px-4 py-3 text-sm text-slate-700 outline-none" readOnly value={guarantorOptions.find((option) => option.id === form.guarantorId)?.phone ?? ''} />
                  </label>
                </>
              ) : null}
            </div>
          </div>

          <div className="rounded-[28px] border border-stone-200 bg-stone-50/70 p-5">
            <p className="text-sm font-medium text-slate-900">Dokumente zum Mietverhältnis</p>
            <p className="mt-1 text-xs leading-6 text-slate-500">
              Die Uploadlogik zu Storage folgt später. Für jetzt werden die Dokumentplätze mit
              Dateinamen vorbereitet.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                ['tenancyAgreementFile', 'Mietvertrag'],
                ['tenancyAddendumsFile', 'Nachträge'],
                ['depositCertificateFile', 'Bankbürgschaft / Kautionsurkunde'],
                ['identityCopiesFile', 'Ausweiskopien'],
                ['tenantInfoFile', 'Mieterinformationen'],
                ['schufaFile', 'SCHUFA-Auskunft'],
                ['salaryProofsFile', 'Gehaltsnachweise'],
                ['annualStatementFile', 'Jahresabrechnungen'],
                ['bankStatementsFile', 'Weitere Bonitätsunterlagen'],
              ].map(([fieldName, label]) => (
                <label className="block space-y-2" key={fieldName}>
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                  <input
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                    className="w-full rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 focus:border-amber-700/60"
                    onChange={(event) =>
                      handleFileSelection(
                        fieldName as
                          | 'annualStatementFile'
                          | 'bankStatementsFile'
                          | 'depositCertificateFile'
                          | 'identityCopiesFile'
                          | 'salaryProofsFile'
                          | 'schufaFile'
                          | 'tenantInfoFile'
                          | 'tenancyAddendumsFile'
                          | 'tenancyAgreementFile',
                        event.target.files
                      )
                    }
                    type="file"
                  />
                  {String(form[fieldName as keyof TenantFormState] ?? '') ? (
                    <p className="text-xs leading-5 text-slate-500">
                      Hinterlegt: {String(form[fieldName as keyof TenantFormState])}
                    </p>
                  ) : null}
                </label>
              ))}
              <label className="block space-y-2 xl:col-span-3">
                <span className="text-sm font-medium text-slate-700">Hinweise zu Dokumenten</span>
                <textarea className="min-h-24 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateField('documentsNotes', event.target.value)} placeholder="z. B. fehlende Nachweise, Fristen, Besonderheiten ..." value={form.documentsNotes} />
              </label>
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Notizen</span>
            <textarea className="min-h-28 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => updateField('notes', event.target.value)} placeholder="Besondere Hinweise zum Mietverhältnis ..." value={form.notes} />
          </label>

          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

          <div className="flex flex-wrap gap-3">
            <button className="rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-5 py-3 text-sm font-semibold text-stone-100 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60" disabled={isPending} type="submit">
              {isPending ? 'Speichert...' : submitLabel}
            </button>
            {editMode && documentId ? (
              <Link className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950" href={`/admin/mieter/${documentId}`}>
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

