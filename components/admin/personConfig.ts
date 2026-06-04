import type {
  AdminDocumentField,
  AdminField,
  PreviewField,
} from './adminFormTypes';

export const personFields: AdminField[] = [
  {
    label: 'Bereich',
    name: 'category',
    options: [
      { label: 'Elektriker', value: 'electrician' },
      { label: 'Sanitaer / Rohrreinigung', value: 'plumbing' },
      { label: 'Heizungsdienst', value: 'heating_service' },
      { label: 'Muellabfuhrunternehmen', value: 'waste_collection' },
      { label: 'Abrechnungsunternehmen', value: 'billing_service' },
      { label: 'Winterdienst', value: 'winter_service' },
      { label: 'Reinigungsdienst', value: 'cleaning_service' },
      { label: 'Dachwartung', value: 'roof_maintenance' },
      { label: 'Regenrinnenreinigung', value: 'gutter_cleaning' },
      { label: 'Handwerker / Dienstleister allgemein', value: 'craftsperson' },
      { label: 'Partnerfirma / externer Kontakt', value: 'partner_company' },
      { label: 'Hausmeister', value: 'caretaker' },
      { label: 'Steuerberater', value: 'tax_advisor' },
      { label: 'Buerge', value: 'guarantor' },
      { label: 'Verwalter', value: 'manager' },
      { label: 'Sonstige Person', value: 'other' },
    ],
    required: true,
    type: 'select',
  },
  {
    label: 'Anrede',
    name: 'salutation',
    options: [
      { label: 'Herr', value: 'mr' },
      { label: 'Frau', value: 'ms' },
      { label: 'Divers', value: 'diverse' },
      { label: 'Ohne Angabe', value: 'none' },
    ],
    type: 'select',
  },
  { label: 'Vorname', name: 'firstName', placeholder: 'Max', required: true },
  { label: 'Nachname', name: 'lastName', placeholder: 'Mustermann', required: true },
  { label: 'Geburtsdatum', name: 'birthDate', type: 'date' },
  {
    label: 'Rolle / Funktion',
    name: 'jobTitle',
    placeholder: 'z. B. Elektriker, Ansprechpartner, Hausmeister',
  },
  {
    label: 'Partnerfirma / Unternehmen',
    name: 'partnerCompanyName',
    placeholder: 'z. B. Mustermann Sanitaer GmbH',
  },
  {
    label: 'Zugeordnete Immobilie',
    name: 'propertyId',
    relation: {
      collectionName: 'properties',
      emptyLabel: 'Keine Immobilie zugeordnet',
      labelFields: ['name', 'city'],
      storeLabelAs: 'propertyName',
    },
    type: 'relation',
  },
  {
    label: 'E-Mail',
    name: 'email',
    placeholder: 'mustermail@example.de',
    kind: 'credential_email',
    type: 'email',
  },
  { label: 'Telefon', name: 'phone', placeholder: '+49 30 1234567', type: 'tel' },
  { label: 'Mobil', name: 'mobile', placeholder: '+49 171 1234567', type: 'tel' },
  {
    label: 'Bevorzugter Kontaktweg',
    name: 'preferredContactMethod',
    options: [
      { label: 'E-Mail', value: 'email' },
      { label: 'Telefon', value: 'phone' },
      { label: 'Mobil', value: 'mobile' },
      { label: 'Post', value: 'mail' },
    ],
    type: 'select',
  },
  {
    label: 'Strasse',
    name: 'street',
    kind: 'address_street',
    placeholder: 'Musterstrasse',
  },
  {
    label: 'Hausnummer',
    name: 'houseNumber',
    kind: 'address_house_number',
    placeholder: '12a',
  },
  {
    label: 'PLZ',
    name: 'postalCode',
    kind: 'address_postal_code',
    placeholder: '12345',
  },
  {
    label: 'Ort',
    name: 'city',
    kind: 'address_city',
    placeholder: 'Musterstadt',
  },
  {
    label: 'Land',
    name: 'country',
    kind: 'address_country',
    placeholder: 'Deutschland',
  },
  {
    label: 'Mietvertrags- / Aktennummer',
    name: 'referenceNumber',
    placeholder: 'optional',
  },
  {
    label: 'IBAN',
    name: 'iban',
    placeholder: 'DE00 0000 0000 0000 0000 0000 00',
  },
  { label: 'Steuer-ID / Kennzeichen', name: 'taxId', placeholder: 'optional' },
  {
    accept: '.pdf,.jpg,.jpeg,.png,.doc,.docx',
    label: 'Dokumente',
    name: 'documentsFile',
    type: 'file',
  },
  {
    label: 'Notizen',
    name: 'notes',
    placeholder: 'Zustaendigkeiten, Erreichbarkeit, Besonderheiten, interne Hinweise ...',
    type: 'textarea',
  },
];

export const personPreviewFields: PreviewField[] = [
  { label: 'Name', name: 'lastName' },
  { label: 'Vorname', name: 'firstName' },
];

export const personDocumentFields: AdminDocumentField[] = [
  { label: 'Dokumente', name: 'documentsFile' },
];
