import fs from 'fs/promises';
import path from 'path';

export type LocalMessageTheme = {
  archived: boolean;
  createdAt: string;
  deleted?: boolean;
  id: string;
  lastActivityAt: string;
  messageIds: string[];
  mergedIntoThemeId?: string;
  reminderDate?: string;
  sourceType: 'admin_message' | 'manual' | 'tenant_message';
  status: 'done' | 'in_progress' | 'needs_review' | 'new';
  tenantId: string;
  title: string;
  updatedAt: string;
};

const LOCAL_MESSAGE_THEMES_PATH = path.join(process.cwd(), '.message-themes.local.json');

async function readAll() {
  try {
    const raw = await fs.readFile(LOCAL_MESSAGE_THEMES_PATH, 'utf8');
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as LocalMessageTheme[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(themes: LocalMessageTheme[]) {
  await fs.writeFile(LOCAL_MESSAGE_THEMES_PATH, JSON.stringify(themes, null, 2), 'utf8');
}

export async function listLocalMessageThemes() {
  const themes = await readAll();
  return [...themes].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function upsertLocalMessageTheme(
  payload: Partial<LocalMessageTheme> & Pick<LocalMessageTheme, 'id' | 'tenantId'>
) {
  const themes = await readAll();
  const now = new Date().toISOString();
  const existingIndex = themes.findIndex((theme) => theme.id === payload.id);
  const existing = existingIndex >= 0 ? themes[existingIndex] : null;

  const nextTheme: LocalMessageTheme = {
    archived: payload.archived ?? existing?.archived ?? false,
    createdAt: existing?.createdAt ?? payload.createdAt ?? now,
    deleted: typeof payload.deleted === 'boolean' ? payload.deleted : existing?.deleted ?? false,
    id: payload.id,
    lastActivityAt: payload.lastActivityAt ?? existing?.lastActivityAt ?? now,
    messageIds: Array.isArray(payload.messageIds) ? payload.messageIds : existing?.messageIds ?? [],
    mergedIntoThemeId: payload.mergedIntoThemeId ?? existing?.mergedIntoThemeId,
    reminderDate:
      typeof payload.reminderDate === 'string' ? payload.reminderDate : existing?.reminderDate,
    sourceType: payload.sourceType ?? existing?.sourceType ?? 'tenant_message',
    status: payload.status ?? existing?.status ?? 'new',
    tenantId: payload.tenantId,
    title: payload.title ?? existing?.title ?? 'Thema ohne Betreff',
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    themes[existingIndex] = nextTheme;
  } else {
    themes.push(nextTheme);
  }

  await writeAll(themes);
  return nextTheme;
}
