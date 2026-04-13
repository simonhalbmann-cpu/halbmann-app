import { promises as fs } from 'fs';
import path from 'path';
import type { MailboxSettings } from './mailboxSettings';

const LOCAL_MAILBOX_CONFIG_PATH = path.join(process.cwd(), '.mailbox-settings.local.json');

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSettings(data?: Partial<MailboxSettings> | null): MailboxSettings {
  return {
    active: data?.active !== false,
    imapHost: cleanText(data?.imapHost),
    imapPassword: cleanText(data?.imapPassword),
    imapPort: cleanText(data?.imapPort),
    imapUser: cleanText(data?.imapUser),
    inboxEmail: cleanText(data?.inboxEmail),
    mailFooterDivider: data?.mailFooterDivider !== false,
    mailFooterBold: data?.mailFooterBold === true,
    mailFooterFontFamily: cleanText(data?.mailFooterFontFamily) || 'Segoe UI, Arial, sans-serif',
    mailFooterFontSize: cleanText(data?.mailFooterFontSize) || '12',
    mailFooterItalic: data?.mailFooterItalic === true,
    mailFooterText: cleanText(data?.mailFooterText),
    mailFooterTextAlign: data?.mailFooterTextAlign === 'left' ? 'left' : 'center',
    mailFooterUnderline: data?.mailFooterUnderline === true,
    mailHeaderDivider: data?.mailHeaderDivider !== false,
    mailHeaderBold: data?.mailHeaderBold === true,
    mailHeaderFontFamily: cleanText(data?.mailHeaderFontFamily) || 'Segoe UI, Arial, sans-serif',
    mailHeaderFontSize: cleanText(data?.mailHeaderFontSize) || '14',
    mailHeaderItalic: data?.mailHeaderItalic === true,
    mailHeaderText: cleanText(data?.mailHeaderText),
    mailHeaderTextAlign: data?.mailHeaderTextAlign === 'left' ? 'left' : 'center',
    mailHeaderUnderline: data?.mailHeaderUnderline === true,
    smtpHost: cleanText(data?.smtpHost),
    smtpPassword: cleanText(data?.smtpPassword),
    smtpPort: cleanText(data?.smtpPort),
    smtpUser: cleanText(data?.smtpUser),
  };
}

export async function readLocalMailboxSettings(): Promise<MailboxSettings | null> {
  try {
    const raw = await fs.readFile(LOCAL_MAILBOX_CONFIG_PATH, 'utf8');
    return normalizeSettings(JSON.parse(raw) as Partial<MailboxSettings>);
  } catch {
    return null;
  }
}

export async function writeLocalMailboxSettings(settings: Partial<MailboxSettings>) {
  await fs.writeFile(
    LOCAL_MAILBOX_CONFIG_PATH,
    JSON.stringify(normalizeSettings(settings), null, 2),
    'utf8'
  );
}

export async function deleteLocalMailboxSettings() {
  try {
    await fs.unlink(LOCAL_MAILBOX_CONFIG_PATH);
  } catch {
    // ignore missing file
  }
}
