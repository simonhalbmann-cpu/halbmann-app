import { getAdminDb } from './firebaseAdmin';
import { AI_SETTINGS_DOC_ID, ADMIN_SETTINGS_COLLECTION, type AiSettings } from './aiSettings';
import { readLocalAiSettings } from './localAiConfig';

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function blankAiSettings(): AiSettings {
  return {
    globalInstruction: '',
    toneInstruction: '',
  };
}

export async function getAiSettingsStateServer(): Promise<{ exists: boolean; settings: AiSettings }> {
  const localSettings = await readLocalAiSettings();
  if (localSettings) {
    return { exists: true, settings: localSettings };
  }

  try {
    const snapshot = await getAdminDb().collection(ADMIN_SETTINGS_COLLECTION).doc(AI_SETTINGS_DOC_ID).get();
    if (!snapshot.exists) {
      return { exists: false, settings: blankAiSettings() };
    }

    const data = snapshot.data() ?? {};
    if (data.deletedAt) {
      return { exists: false, settings: blankAiSettings() };
    }

    return {
      exists: true,
      settings: {
        globalInstruction: cleanText(data.globalInstruction),
        toneInstruction: cleanText(data.toneInstruction),
        updatedAt: data.updatedAt,
      },
    };
  } catch (error) {
    console.error('Fehler beim Laden der KI-Einstellungen:', error);
    return { exists: false, settings: blankAiSettings() };
  }
}

export async function getAiSettingsServer(): Promise<AiSettings> {
  const state = await getAiSettingsStateServer();
  return state.settings;
}
