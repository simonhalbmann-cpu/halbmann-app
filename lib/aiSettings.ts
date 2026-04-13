export const ADMIN_SETTINGS_COLLECTION = 'adminSettings';
export const AI_SETTINGS_DOC_ID = 'ai';

export type AiSettings = {
  globalInstruction?: string;
  toneInstruction?: string;
  updatedAt?: unknown;
};
