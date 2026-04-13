import { promises as fs } from 'fs';
import path from 'path';
import type { AiSettings } from './aiSettings';

const LOCAL_AI_CONFIG_PATH = path.join(process.cwd(), '.ai-settings.local.json');

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSettings(data?: Partial<AiSettings> | null): AiSettings {
  return {
    globalInstruction: cleanText(data?.globalInstruction),
    toneInstruction: cleanText(data?.toneInstruction),
  };
}

export async function readLocalAiSettings(): Promise<AiSettings | null> {
  try {
    const raw = await fs.readFile(LOCAL_AI_CONFIG_PATH, 'utf8');
    return normalizeSettings(JSON.parse(raw) as Partial<AiSettings>);
  } catch {
    return null;
  }
}

export async function writeLocalAiSettings(settings: Partial<AiSettings>) {
  await fs.writeFile(LOCAL_AI_CONFIG_PATH, JSON.stringify(normalizeSettings(settings), null, 2), 'utf8');
}

export async function deleteLocalAiSettings() {
  try {
    await fs.unlink(LOCAL_AI_CONFIG_PATH);
  } catch {
    // ignore
  }
}
