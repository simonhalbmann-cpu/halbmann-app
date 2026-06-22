import type {
  AdminDocumentField,
  AdminField,
  PreviewField,
} from './adminFormTypes';

export const companyFields: AdminField[] = [
  {
    label: 'Firmenname',
    name: 'name',
    placeholder: 'z. B. Mustermann Immobilien GmbH',
    required: true,
  },
  {
    accept: '.jpg,.jpeg,.png,.svg,.webp',
    helpText: 'Dieses Logo wird spaeter fuer Signaturen und Briefvorlagen verwendet.',
    label: 'Firmenlogo',
    name: 'signatureLogoUrl',
    type: 'image',
  },
  {
    label: 'Rechtsform',
    name: 'legalForm',
    options: [
      { label: 'GmbH', value: 'gmbh' },
      { label: 'UG', value: 'ug' },
      { label: 'GbR', value: 'gbr' },
      { label: 'KG', value: 'kg' },
      { label: 'GmbH & Co. KG', value: 'gmbh_co_kg' },
      { label: 'Privat', value: 'private' },
      { label: 'Sonstige', value: 'other' },
    ],
    required: true,
    type: 'select',
  },
  {
    label: 'Ansprechpartner',
    name: 'contactPersonId',
    relation: {
      collectionName: 'userProfiles',
      emptyLabel: 'Keine Person auswählen',
      labelFields: ['displayName', 'email', 'contactEmail'],
      storeLabelAs: 'contactPersonName',
    },
    type: 'relation',
  },
  {
    label: 'Steuerberater',
    name: 'taxAdvisorPersonId',
    relation: {
      collectionName: 'people',
      emptyLabel: 'Keine Person auswählen',
      labelFields: ['lastName', 'firstName', 'category'],
      storeLabelAs: 'taxAdvisorName',
    },
    type: 'relation',
  },
  {
    label: 'Telefon',
    name: 'phone',
    placeholder: '+49 30 1234567',
    type: 'tel',
  },
  {
    label: 'Kontakt E-Mail',
    name: 'email',
    placeholder: 'kontakt@musterfirma.de',
    kind: 'credential_email',
    type: 'email',
  },
  {
    label: 'Homepage',
    name: 'website',
    placeholder: 'https://www.musterfirma.de',
    type: 'text',
  },
  {
    label: 'Straße',
    name: 'street',
    kind: 'address_street',
    placeholder: 'Musterstraße',
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
    label: 'Registergericht',
    name: 'registerCourt',
    placeholder: 'z. B. Amtsgericht Musterstadt',
  },
  {
    label: 'HRB',
    name: 'commercialRegisterNumber',
    placeholder: 'z. B. HRB 12345',
  },
  {
    label: 'Geschäftsführer',
    helpText: 'Aus Admin und Mitarbeitern auswählen. Mehrfachauswahl mit Strg oder Cmd.',
    name: 'managingDirectorIds',
    relation: {
      collectionName: 'userProfiles',
      labelFields: ['displayName', 'email', 'contactEmail'],
      storeLabelAs: 'managingDirector',
    },
    type: 'relation-multi',
  },
  {
    label: 'Steuernummer',
    name: 'taxNumber',
    placeholder: 'z. B. 12/345/67890',
  },
  {
    label: 'USt-IdNr.',
    name: 'vatId',
    placeholder: 'z. B. DE123456789',
  },
  {
    label: 'Wirtschafts-Identifikationsnummer',
    name: 'businessId',
    placeholder: 'optional',
  },
  {
    label: 'Bank',
    name: 'bankName',
    placeholder: 'z. B. Berliner Sparkasse',
  },
  {
    label: 'IBAN',
    name: 'iban',
    placeholder: 'DE00 0000 0000 0000 0000 00',
  },
  {
    label: 'BIC',
    name: 'bic',
    placeholder: 'ABCDEFGHXXX',
  },
  {
    label: 'E-Mail-Benutzername',
    autoComplete: 'off',
    kind: 'credential_email',
    name: 'mailboxUsername',
    placeholder: 'z. B. postfach@musterfirma.de',
  },
  {
    autoComplete: 'new-password',
    kind: 'credential_password',
    label: 'E-Mail-Passwort',
    name: 'mailboxPassword',
    placeholder: 'Passwort hinterlegen',
    type: 'password',
  },
  {
    label: 'Weitere Steuerkennzeichen',
    name: 'additionalTaxIds',
    placeholder: 'Weitere Steuer-IDs, interne Kennzeichen oder Hinweise ...',
    type: 'textarea',
  },
  {
    label: 'Uploadbereich Firma',
    name: 'companyUploadSection',
    sectionItems: [
      'Gesellschaftsvertrag / GmbH-Vertrag',
      'Aktueller Handelsregisterauszug',
      'Gesellschafterliste',
      'Steuerliche Erfassungsunterlagen',
      'Geschäftsführerbestellung / Vertretungsnachweis',
      'Bankunterlagen / Kontoeröffnung',
      'Sonstige wichtige Firmenunterlagen',
    ],
    sectionText:
      'Die Uploadlogik wird später mit Storage verbunden. Die Felder darunter sind bereits einzeln vorbereitet.',
    type: 'section',
  },
  {
    accept: '.pdf,.jpg,.jpeg,.png,.doc,.docx',
    label: 'Upload: Gesellschaftsvertrag / GmbH-Vertrag',
    name: 'uploadCompanyContract',
    type: 'file',
  },
  {
    accept: '.pdf,.jpg,.jpeg,.png',
    label: 'Upload: Handelsregisterauszug',
    name: 'uploadCommercialRegisterExtract',
    type: 'file',
  },
  {
    accept: '.pdf,.jpg,.jpeg,.png',
    label: 'Upload: Gesellschafterliste',
    name: 'uploadShareholderList',
    type: 'file',
  },
  {
    accept: '.pdf,.jpg,.jpeg,.png',
    label: 'Upload: Steuerunterlagen',
    name: 'uploadTaxDocuments',
    type: 'file',
  },
  {
    accept: '.pdf,.jpg,.jpeg,.png',
    label: 'Upload: Vertretungsnachweis / Geschäftsführerbestellung',
    name: 'uploadRepresentationProof',
    type: 'file',
  },
  {
    accept: '.pdf,.jpg,.jpeg,.png,.doc,.docx',
    label: 'Upload: Bankunterlagen',
    name: 'uploadBankDocuments',
    type: 'file',
  },
  {
    accept: '.pdf,.jpg,.jpeg,.png,.doc,.docx',
    label: 'Upload: Sonstige Firmenunterlagen',
    name: 'uploadOtherCompanyDocuments',
    type: 'file',
  },
  {
    label: 'Notizen',
    name: 'notes',
    placeholder: 'Beteiligungen, Zuständigkeiten, Fristen, interne Hinweise ...',
    type: 'textarea',
  },
];

export const companyPreviewFields: PreviewField[] = [
  { label: 'Name', name: 'name' },
  { label: 'Ort', name: 'city' },
];

export const companyDocumentFields: AdminDocumentField[] = [
  { label: 'Gesellschaftsvertrag / GmbH-Vertrag', name: 'uploadCompanyContract' },
  { label: 'Handelsregisterauszug', name: 'uploadCommercialRegisterExtract' },
  { label: 'Gesellschafterliste', name: 'uploadShareholderList' },
  { label: 'Steuerunterlagen', name: 'uploadTaxDocuments' },
  {
    label: 'Vertretungsnachweis / Geschäftsführerbestellung',
    name: 'uploadRepresentationProof',
  },
  { label: 'Bankunterlagen', name: 'uploadBankDocuments' },
  { label: 'Sonstige Firmenunterlagen', name: 'uploadOtherCompanyDocuments' },
];
