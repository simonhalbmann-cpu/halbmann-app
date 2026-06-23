import { getAdminDb } from './firebaseAdmin';
import { readLocalMailboxSettings } from './localMailboxConfig';
import { DEFAULT_INBOX_EMAIL } from './mailbox';
import { ADMIN_SETTINGS_COLLECTION, DEFAULT_MAIL_FOOTER_TEXT, MAILBOX_SETTINGS_DOC_ID, type MailboxSettings } from './mailboxSettings';

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanMailboxHeaderText(value: unknown) {
  return cleanText(value)
    .replace(/Holen Sie sich die App oder nutzen Sie das Online-Mieterportal f.{1,6}r ein besseres Erlebnis\.?/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeMailboxSettings(data: Partial<MailboxSettings>): MailboxSettings {
  const inboxEmail = cleanText(data.inboxEmail) || DEFAULT_INBOX_EMAIL;
  const imapUser = cleanText(data.imapUser) || inboxEmail;
  const smtpUser = cleanText(data.smtpUser) || imapUser || inboxEmail;
  const imapPassword = cleanText(data.imapPassword) || cleanText(data.smtpPassword);
  const smtpPassword = cleanText(data.smtpPassword) || imapPassword;
  const customFooterText = cleanText(data.mailFooterText);
  const usesDefaultFooterText = !customFooterText;

  return {
    ...data,
    active: data.active !== false,
    imapHost: cleanText(data.imapHost) || 'imap.ionos.de',
    imapPassword,
    imapPort: cleanText(data.imapPort) || '993',
    imapUser,
    inboxEmail,
    mailFooterBold: data.mailFooterBold === true,
    mailFooterDivider: data.mailFooterDivider !== false,
    mailFooterFontFamily: cleanText(data.mailFooterFontFamily) || 'Segoe UI, Arial, sans-serif',
    mailFooterFontSize: cleanText(data.mailFooterFontSize) || (usesDefaultFooterText ? '11' : '12'),
    mailFooterItalic: data.mailFooterItalic === true,
    mailFooterText: customFooterText || DEFAULT_MAIL_FOOTER_TEXT,
    mailFooterTextAlign: usesDefaultFooterText ? 'left' : data.mailFooterTextAlign === 'left' ? 'left' : 'center',
    mailFooterUnderline: data.mailFooterUnderline === true,
    mailHeaderBold: data.mailHeaderBold === true,
    mailHeaderDivider: data.mailHeaderDivider !== false,
    mailHeaderFontFamily: cleanText(data.mailHeaderFontFamily) || 'Segoe UI, Arial, sans-serif',
    mailHeaderFontSize: cleanText(data.mailHeaderFontSize) || '14',
    mailHeaderItalic: data.mailHeaderItalic === true,
    mailHeaderText: cleanMailboxHeaderText(data.mailHeaderText),
    mailHeaderTextAlign: data.mailHeaderTextAlign === 'left' ? 'left' : 'center',
    mailHeaderUnderline: data.mailHeaderUnderline === true,
    smtpHost: cleanText(data.smtpHost) || 'smtp.ionos.de',
    smtpPassword,
    smtpPort: cleanText(data.smtpPort) || '587',
    smtpUser,
  };
}

function envFallback(): MailboxSettings {
  return normalizeMailboxSettings({
    active: Boolean(process.env.IONOS_IMAP_USER),
    imapHost: process.env.IONOS_IMAP_HOST,
    imapPassword: process.env.IONOS_IMAP_PASSWORD,
    imapPort: process.env.IONOS_IMAP_PORT,
    imapUser: process.env.IONOS_IMAP_USER,
    inboxEmail: process.env.IONOS_IMAP_USER,
    mailHeaderText: process.env.IONOS_MAIL_HEADER_TEXT || '',
    smtpHost: process.env.IONOS_SMTP_HOST,
    smtpPassword: process.env.IONOS_SMTP_PASSWORD,
    smtpPort: process.env.IONOS_SMTP_PORT,
    smtpUser: process.env.IONOS_SMTP_USER,
  });
}

function blankMailboxSettings(): MailboxSettings {
  return normalizeMailboxSettings({
    active: false,
    imapHost: 'imap.ionos.de',
    imapPassword: '',
    imapPort: '993',
    imapUser: DEFAULT_INBOX_EMAIL,
    inboxEmail: DEFAULT_INBOX_EMAIL,
    mailFooterDivider: true,
    mailFooterFontFamily: 'Segoe UI, Arial, sans-serif',
    mailFooterFontSize: '12',
    mailFooterText: '',
    mailFooterTextAlign: 'center',
    mailHeaderDivider: true,
    mailHeaderFontFamily: 'Segoe UI, Arial, sans-serif',
    mailHeaderFontSize: '14',
    mailHeaderText: '',
    mailHeaderTextAlign: 'center',
    smtpHost: 'smtp.ionos.de',
    smtpPassword: '',
    smtpPort: '587',
    smtpUser: DEFAULT_INBOX_EMAIL,
  });
}

export async function getMailboxSettingsStateServer(): Promise<{
  exists: boolean;
  settings: MailboxSettings;
}> {
  const localSettings = await readLocalMailboxSettings();
  if (localSettings) {
    return {
      exists: true,
      settings: normalizeMailboxSettings(localSettings),
    };
  }

  try {
    const snapshot = await getAdminDb()
      .collection(ADMIN_SETTINGS_COLLECTION)
      .doc(MAILBOX_SETTINGS_DOC_ID)
      .get();

    if (!snapshot.exists) {
      return {
        exists: false,
        settings: envFallback(),
      };
    }

    const data = snapshot.data() ?? {};
    if (data.deletedAt) {
      return {
        exists: false,
        settings: blankMailboxSettings(),
      };
    }

    return {
      exists: true,
      settings: normalizeMailboxSettings({
        ...data,
        updatedAt: data.updatedAt,
      }),
    };
  } catch (error) {
    console.error('Fehler beim Laden des Mailbox-Status, Fallback auf ENV:', error);
    return {
      exists: false,
      settings: envFallback(),
    };
  }
}

export async function getMailboxSettingsServer(): Promise<MailboxSettings> {
  try {
    const state = await getMailboxSettingsStateServer();
    return state.settings;
  } catch (error) {
    console.error('Fehler beim Laden der Mailbox-Einstellungen, Fallback auf ENV:', error);
    return envFallback();
  }
}
