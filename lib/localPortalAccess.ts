import fs from 'fs/promises';
import path from 'path';
import type { PortalTargetType } from './portalAccess';

type LocalPortalRecord = {
  authEmail: string;
  contactEmail: string;
  passwordCipher: string;
  propertyData?: Record<string, unknown>;
  targetId: string;
  targetData?: Record<string, unknown>;
  targetType: PortalTargetType;
  uid: string;
  username: string;
};

const LOCAL_PORTAL_ACCESS_PATH = path.join(process.cwd(), '.portal-access.local.json');

async function readAll() {
  try {
    const raw = await fs.readFile(LOCAL_PORTAL_ACCESS_PATH, 'utf8');
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as Record<string, LocalPortalRecord>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeAll(data: Record<string, LocalPortalRecord>) {
  await fs.writeFile(LOCAL_PORTAL_ACCESS_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export async function readLocalPortalAccess(username: string) {
  const all = await readAll();
  return all[username] ?? null;
}

export async function findLocalPortalAccessByTarget(
  targetType: PortalTargetType,
  targetId: string
) {
  const all = await readAll();
  return (
    Object.values(all).find(
      (record) => record.targetType === targetType && record.targetId === targetId
    ) ?? null
  );
}

export async function listLocalPortalAccessRecords() {
  const all = await readAll();
  return Object.values(all);
}

export async function writeLocalPortalAccess(record: LocalPortalRecord) {
  const all = await readAll();
  all[record.username] = record;
  await writeAll(all);
}
