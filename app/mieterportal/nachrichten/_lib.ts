import { cleanPortalText } from '../../../lib/portalAccess';

export type MessageRecord = {
  data: Record<string, unknown>;
  id: string;
};

export type AttachmentRecord = {
  contentType?: string;
  name: string;
  size?: number;
  url: string;
};

export type ThemeRecord = {
  archived?: boolean;
  id: string;
  latestActivityAt?: unknown;
  latestEntry: MessageRecord;
  latestInbound?: MessageRecord | null;
  records: MessageRecord[];
  status: string;
  subject: string;
};

export function formatDateTime(value: unknown) {
  const text = cleanPortalText(value);
  if (!text) return 'Gerade eben';
  const date = new Date(text);
  return Number.isNaN(date.getTime())
    ? text
    : date.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

export function getMessageStatusLabel(theme: ThemeRecord) {
  if (theme.archived) return 'Archiv';
  if (theme.status === 'new') return 'Neu';
  if (theme.status === 'needs_review') return 'Neu prüfen';
  if (theme.status === 'in_progress') return 'In Bearbeitung';
  if (theme.status === 'done') return 'Erledigt';
  return 'Offen';
}

export function getMessageStatusClass(theme: ThemeRecord) {
  if (theme.archived) return 'border-stone-300 bg-stone-100 text-stone-700';
  if (theme.status === 'new') return 'border-sky-200 bg-sky-50 text-sky-700';
  if (theme.status === 'needs_review') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (theme.status === 'in_progress') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (theme.status === 'done') return 'border-stone-300 bg-stone-100 text-stone-700';
  return 'border-stone-200 bg-white text-slate-600';
}

export function readAttachments(value: unknown): AttachmentRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const name = cleanPortalText(record.name);
      const url = cleanPortalText(record.url ?? record.downloadUrl ?? record.href);
      if (!name || !url) return null;
      return {
        contentType: cleanPortalText(record.contentType) || undefined,
        name,
        size:
          typeof record.size === 'number' && Number.isFinite(record.size)
            ? record.size
            : undefined,
        url,
      };
    })
    .filter(Boolean) as AttachmentRecord[];
}

export function formatFileSize(value?: number) {
  if (!value || !Number.isFinite(value) || value <= 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
