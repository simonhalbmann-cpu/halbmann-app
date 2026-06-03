import { promises as fs } from 'fs';
import path from 'path';
import {
  defaultPortalInvitationSettings,
  type PortalInvitationSettings,
} from './portalInvitationSettings';

const LOCAL_PORTAL_INVITATION_SETTINGS_PATH = path.join(
  process.cwd(),
  '.portal-invitation-settings.local.json'
);

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSettings(data?: Partial<PortalInvitationSettings> | null): PortalInvitationSettings {
  const defaults = defaultPortalInvitationSettings();
  return {
    bodyTemplate: cleanText(data?.bodyTemplate) || defaults.bodyTemplate,
    subject: cleanText(data?.subject) || defaults.subject,
  };
}

export async function readLocalPortalInvitationSettings(): Promise<PortalInvitationSettings | null> {
  try {
    const raw = await fs.readFile(LOCAL_PORTAL_INVITATION_SETTINGS_PATH, 'utf8');
    return normalizeSettings(JSON.parse(raw) as Partial<PortalInvitationSettings>);
  } catch {
    return null;
  }
}

export async function writeLocalPortalInvitationSettings(settings: Partial<PortalInvitationSettings>) {
  await fs.writeFile(
    LOCAL_PORTAL_INVITATION_SETTINGS_PATH,
    JSON.stringify(normalizeSettings(settings), null, 2),
    'utf8'
  );
}

export async function deleteLocalPortalInvitationSettings() {
  try {
    await fs.unlink(LOCAL_PORTAL_INVITATION_SETTINGS_PATH);
  } catch {
    // ignore
  }
}
