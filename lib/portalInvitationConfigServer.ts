import { getAdminDb } from './firebaseAdmin';
import {
  defaultPortalInvitationSettings,
  PORTAL_INVITATION_SETTINGS_COLLECTION,
  PORTAL_INVITATION_SETTINGS_DOC_ID,
  type PortalInvitationSettings,
} from './portalInvitationSettings';
import { readLocalPortalInvitationSettings } from './localPortalInvitationSettings';

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSettings(data?: Partial<PortalInvitationSettings> | null): PortalInvitationSettings {
  const defaults = defaultPortalInvitationSettings();
  return {
    bodyTemplate: cleanText(data?.bodyTemplate) || defaults.bodyTemplate,
    subject: cleanText(data?.subject) || defaults.subject,
    updatedAt: data?.updatedAt,
  };
}

export async function getPortalInvitationSettingsStateServer(): Promise<{
  exists: boolean;
  settings: PortalInvitationSettings;
}> {
  const localSettings = await readLocalPortalInvitationSettings();
  if (localSettings) {
    return { exists: true, settings: normalizeSettings(localSettings) };
  }

  try {
    const snapshot = await getAdminDb()
      .collection(PORTAL_INVITATION_SETTINGS_COLLECTION)
      .doc(PORTAL_INVITATION_SETTINGS_DOC_ID)
      .get();
    if (!snapshot.exists) {
      return { exists: false, settings: normalizeSettings() };
    }

    const data = snapshot.data() ?? {};
    if (data.deletedAt) {
      return { exists: false, settings: normalizeSettings() };
    }

    return {
      exists: true,
      settings: normalizeSettings({
        bodyTemplate: data.bodyTemplate,
        subject: data.subject,
        updatedAt: data.updatedAt,
      }),
    };
  } catch (error) {
    console.error('Fehler beim Laden der Portal-Begrüßungsmail:', error);
    return { exists: false, settings: normalizeSettings() };
  }
}

export async function getPortalInvitationSettingsServer(): Promise<PortalInvitationSettings> {
  const state = await getPortalInvitationSettingsStateServer();
  return state.settings;
}
