import type { DocumentData } from 'firebase/firestore';
import { cleanDocumentCategory, DEFAULT_DOCUMENT_CATEGORY } from './documentCategories';

export type TenantDocumentEntry = {
  category?: string;
  contentType: string;
  name: string;
  path: string;
  size: number;
  source?: 'mail' | 'upload' | string;
  uploadedAt: string;
  uploadedByEmail: string;
  url: string;
};

export type StoredDocumentEntry = TenantDocumentEntry;

const legacyTenantDocumentFields: Array<{ label: string; name: string }> = [
  { label: 'Mietvertrag', name: 'tenancyAgreementFile' },
  { label: 'Nachtraege', name: 'tenancyAddendumsFile' },
  { label: 'Kautionsurkunde', name: 'depositCertificateFile' },
  { label: 'Ausweiskopien', name: 'identityCopiesFile' },
  { label: 'Mieterinformationen', name: 'tenantInfoFile' },
  { label: 'SCHUFA-Auskunft', name: 'schufaFile' },
  { label: 'Gehaltsnachweise', name: 'salaryProofsFile' },
  { label: 'Jahresabrechnungen', name: 'annualStatementFile' },
  { label: 'Weitere Bonitaetsunterlagen', name: 'bankStatementsFile' },
];

export function cleanTenantDocuments(value: unknown): TenantDocumentEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      const url = typeof record.url === 'string' ? record.url.trim() : '';
      if (!name || !url) return null;

      return {
        category: cleanDocumentCategory(record.category),
        contentType: typeof record.contentType === 'string' ? record.contentType : '',
        name,
        path: typeof record.path === 'string' ? record.path : '',
        size: typeof record.size === 'number' ? record.size : 0,
        source: typeof record.source === 'string' ? record.source : 'upload',
        uploadedAt: typeof record.uploadedAt === 'string' ? record.uploadedAt : '',
        uploadedByEmail: typeof record.uploadedByEmail === 'string' ? record.uploadedByEmail : '',
        url,
      };
    })
    .filter(Boolean) as TenantDocumentEntry[];
}

export const cleanStoredDocuments = cleanTenantDocuments;

export function getLegacyTenantDocumentNames(data: DocumentData | null | undefined) {
  if (!data) return [];

  return legacyTenantDocumentFields
    .map((field) => {
      const value = typeof data[field.name] === 'string' ? data[field.name].trim() : '';
      return value
        ? { category: DEFAULT_DOCUMENT_CATEGORY, fieldName: field.name, label: field.label, name: value }
        : null;
    })
    .filter(Boolean) as Array<{ category: string; fieldName: string; label: string; name: string }>;
}

export function sanitizeStorageFileName(name: string) {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|#%{}^~[\]`]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 140);

  return cleaned || 'dokument';
}

export function createClientId(prefix = 'id') {
  const randomSource = globalThis.crypto as Crypto | undefined;
  if (typeof randomSource?.randomUUID === 'function') {
    return randomSource.randomUUID();
  }

  const randomBytes = new Uint8Array(16);
  if (typeof randomSource?.getRandomValues === 'function') {
    randomSource.getRandomValues(randomBytes);
  } else {
    randomBytes.forEach((_, index) => {
      randomBytes[index] = Math.floor(Math.random() * 256);
    });
  }

  const randomPart = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}
