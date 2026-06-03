import type { DocumentData } from 'firebase/firestore';
import { formatTimestampSort, type WorkflowRecord } from './adminWorkflow';
import type { LocalMessageTheme } from './localMessageThemes';

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export type MessageTheme = {
  archived: boolean;
  id: string;
  latestActivityAt: unknown;
  latestEntry: WorkflowRecord;
  latestInbound: WorkflowRecord | null;
  records: WorkflowRecord[];
  reminderDate: string;
  sourceType: string;
  status: string;
  subject: string;
  tenantId: string;
};

function buildRootId(record: WorkflowRecord) {
  const relatedId = cleanText(record.data.relatedMessageId);
  return relatedId || record.id;
}

function compareByTimeDesc(left: WorkflowRecord, right: WorkflowRecord) {
  return (
    formatTimestampSort(right.data.receivedAt ?? right.data.sentAt ?? right.data.createdAt) -
    formatTimestampSort(left.data.receivedAt ?? left.data.sentAt ?? left.data.createdAt)
  );
}

export function buildMessageThemes(messages: WorkflowRecord[], storedThemes: LocalMessageTheme[] = []) {
  const grouped = new Map<string, WorkflowRecord[]>();
  const themeMetaById = new Map(storedThemes.map((theme) => [theme.id, theme]));
  const deletedThemeIds = new Set(
    storedThemes.filter((theme) => Boolean(theme.deleted)).map((theme) => theme.id)
  );
  const assignedMessageIds = new Map<string, string[]>();

  storedThemes.forEach((theme) => {
    theme.messageIds.forEach((messageId) => {
      const currentThemeIds = assignedMessageIds.get(messageId) ?? [];
      currentThemeIds.push(theme.id);
      assignedMessageIds.set(messageId, Array.from(new Set(currentThemeIds)));
    });
  });

  messages.forEach((record) => {
    const tenantId = cleanText(record.data.tenantId);
    if (!tenantId) return;
    const explicitThemeIds = assignedMessageIds.get(record.id) ?? [];
    const rootIds =
      explicitThemeIds.length > 0
        ? explicitThemeIds.filter((themeId) => !deletedThemeIds.has(themeId))
        : deletedThemeIds.has(buildRootId(record))
          ? []
          : [buildRootId(record)];

    rootIds.forEach((rootId) => {
      const key = `${tenantId}::${rootId}`;
      const current = grouped.get(key) ?? [];
      current.push(record);
      grouped.set(key, current);
    });
  });

  return Array.from(grouped.entries())
    .map(([key, records]) => {
      const sorted = [...records].sort(compareByTimeDesc);
      const latestEntry = sorted[0];
      const latestInbound =
        sorted.find((record) => cleanText(record.data.direction || 'inbound') === 'inbound') ?? null;
      const tenantId = cleanText(latestEntry.data.tenantId);
      const themeId = key.split('::')[1] || latestEntry.id;
      const meta = themeMetaById.get(themeId) ?? null;
      const status =
        cleanText(meta?.status) ||
        cleanText(latestInbound?.data.status) ||
        cleanText(latestEntry.data.status) ||
        'in_progress';
      const subject =
        cleanText(meta?.title) ||
        cleanText(latestInbound?.data.subject) ||
        cleanText(latestEntry.data.subject) ||
        'Thema ohne Betreff';

      return {
        archived: Boolean(meta?.archived) || ['done', 'closed', 'deleted'].includes(status),
        id: themeId,
        latestActivityAt:
          meta?.lastActivityAt ||
          latestEntry.data.receivedAt ||
          latestEntry.data.sentAt ||
          latestEntry.data.createdAt,
        latestEntry,
        latestInbound,
        records: sorted,
        reminderDate: cleanText(meta?.reminderDate),
        sourceType: cleanText(meta?.sourceType) || 'tenant_message',
        status,
        subject,
        tenantId,
      } satisfies MessageTheme;
    })
    .filter((theme) => !deletedThemeIds.has(theme.id))
    .sort(
      (left, right) =>
        formatTimestampSort(right.latestActivityAt as DocumentData) -
        formatTimestampSort(left.latestActivityAt as DocumentData)
    );
}
