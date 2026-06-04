export const DEFAULT_DOCUMENT_CATEGORY = 'Sonstiges';

export const DOCUMENT_CATEGORIES = [
  'Mietvertrag',
  'Nachtrag',
  'Uebergabe',
  'Ausweis',
  'Bonitaet',
  'Kaution',
  'Betriebskosten',
  'Mieterhoehung',
  'Kuendigung',
  'Schriftverkehr',
  'Mailanhang',
  'Fotos',
  'Maengel',
  'Rechnung',
  'Angebot',
  'Wartung',
  'Handwerker',
  'Zaehlersand',
  'Heizung',
  'Dach',
  'Regenrinne',
  'Versicherung',
  'Grundbuch',
  'Teilungserklaerung',
  'Energieausweis',
  'Bauunterlagen',
  'Vertrag',
  'Steuern',
  'Bank',
  'Firma',
  DEFAULT_DOCUMENT_CATEGORY,
];

export function cleanDocumentCategory(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_DOCUMENT_CATEGORY;
}

export function mergeDocumentCategories(values: unknown[]) {
  const categories = new Set(DOCUMENT_CATEGORIES);
  values.forEach((value) => {
    const category = cleanDocumentCategory(value);
    if (category) categories.add(category);
  });

  return Array.from(categories).sort((left, right) => {
    if (left === DEFAULT_DOCUMENT_CATEGORY) return 1;
    if (right === DEFAULT_DOCUMENT_CATEGORY) return -1;
    return left.localeCompare(right, 'de');
  });
}
