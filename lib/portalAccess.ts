export type PortalTargetType = 'contact' | 'tenant';

export type PortalDocumentField = {
  label: string;
  name: string;
};

export const tenantPortalDocumentFields: PortalDocumentField[] = [
  { label: 'Mietvertrag', name: 'tenancyAgreementFile' },
  { label: 'Nachträge', name: 'tenancyAddendumsFile' },
  { label: 'Bankbürgschaft / Kautionsurkunde', name: 'depositCertificateFile' },
  { label: 'Ausweiskopien', name: 'identityCopiesFile' },
  { label: 'Mieterinformationen', name: 'tenantInfoFile' },
  { label: 'SCHUFA-Auskunft', name: 'schufaFile' },
  { label: 'Gehaltsnachweise', name: 'salaryProofsFile' },
  { label: 'Jahresabrechnungen', name: 'annualStatementFile' },
  { label: 'Weitere Bonitätsunterlagen', name: 'bankStatementsFile' },
];

export const contactPortalDocumentFields: PortalDocumentField[] = [
  { label: 'Dokumente', name: 'documentsFile' },
];

export function cleanPortalText(value: unknown) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .replace(/Ã„/g, 'Ä')
    .replace(/Ã–/g, 'Ö')
    .replace(/Ãœ/g, 'Ü')
    .replace(/Ã¤/g, 'ä')
    .replace(/Ã¶/g, 'ö')
    .replace(/Ã¼/g, 'ü')
    .replace(/ÃŸ/g, 'ß')
    .replace(/Â·/g, '·')
    .replace(/Â–/g, '–')
    .replace(/Â—/g, '—')
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€ž/g, '„')
    .replace(/â€œ/g, '“')
    .replace(/â€"/g, '”')
    .replace(/â€²/g, "'")
    .replace(/â€¦/g, '...')
    .replace(/\s+/g, ' ');
}

export function normalizePortalUsername(value: unknown) {
  return cleanPortalText(value).toLowerCase().replace(/\s+/g, '');
}

export function buildPortalAuthEmail(username: string) {
  return `${normalizePortalUsername(username)}@portal.halbmann.local`;
}

export function getPortalTargetLabel(targetType: PortalTargetType) {
  return targetType === 'tenant' ? 'Mieter' : 'Dienstleister';
}

export function buildPortalDisplayName(targetType: PortalTargetType, data: Record<string, unknown>) {
  const firstName = cleanPortalText(data.firstName);
  const lastName = cleanPortalText(data.lastName);
  const companyName = cleanPortalText(data.companyName);
  const partnerCompanyName = cleanPortalText(data.partnerCompanyName);
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  if (targetType === 'tenant') {
    return fullName || companyName || 'Mieter';
  }

  return fullName || partnerCompanyName || companyName || 'Dienstleister';
}

export function getPortalCollectionName(targetType: PortalTargetType) {
  return targetType === 'tenant' ? 'tenants' : 'people';
}
