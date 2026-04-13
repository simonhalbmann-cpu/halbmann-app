import { getAdminDb } from './firebaseAdmin';
import { readLocalMailboxSettings } from './localMailboxConfig';
import { ADMIN_SETTINGS_COLLECTION, MAILBOX_SETTINGS_DOC_ID, type MailboxSettings } from './mailboxSettings';

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function envFallback(): MailboxSettings {
  return {
    active: Boolean(process.env.IONOS_IMAP_USER),
    imapHost: process.env.IONOS_IMAP_HOST,
    imapPassword: process.env.IONOS_IMAP_PASSWORD,
    imapPort: process.env.IONOS_IMAP_PORT,
    imapUser: process.env.IONOS_IMAP_USER,
    inboxEmail: process.env.IONOS_IMAP_USER,
    mailHeaderText:
      process.env.IONOS_MAIL_HEADER_TEXT ||
      'Holen Sie sich die App oder nutzen Sie das Online-Mieterportal für ein besseres Erlebnis.',
    smtpHost: process.env.IONOS_SMTP_HOST,
    smtpPassword: process.env.IONOS_SMTP_PASSWORD,
    smtpPort: process.env.IONOS_SMTP_PORT,
    smtpUser: process.env.IONOS_SMTP_USER,
  };
}

function blankMailboxSettings(): MailboxSettings {
  return {
    active: false,
    imapHost: '',
    imapPassword: '',
    imapPort: '',
    imapUser: '',
    inboxEmail: '',
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
    smtpHost: '',
    smtpPassword: '',
    smtpPort: '',
    smtpUser: '',
  };
}

export async function getMailboxSettingsStateServer(): Promise<{
  exists: boolean;
  settings: MailboxSettings;
}> {
  const localSettings = await readLocalMailboxSettings();
  if (localSettings) {
    return {
      exists: true,
      settings: localSettings,
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
      settings: {
        active: data.active !== false,
        imapHost: cleanText(data.imapHost),
        imapPassword: cleanText(data.imapPassword),
        imapPort: cleanText(data.imapPort),
        imapUser: cleanText(data.imapUser),
        inboxEmail: cleanText(data.inboxEmail),
        mailFooterBold: data.mailFooterBold === true,
        mailFooterDivider: data.mailFooterDivider !== false,
        mailFooterFontFamily: cleanText(data.mailFooterFontFamily) || 'Segoe UI, Arial, sans-serif',
        mailFooterFontSize: cleanText(data.mailFooterFontSize) || '12',
        mailFooterItalic: data.mailFooterItalic === true,
        mailFooterText: cleanText(data.mailFooterText),
        mailFooterTextAlign: data.mailFooterTextAlign === 'left' ? 'left' : 'center',
        mailFooterUnderline: data.mailFooterUnderline === true,
        mailHeaderBold: data.mailHeaderBold === true,
        mailHeaderDivider: data.mailHeaderDivider !== false,
        mailHeaderFontFamily: cleanText(data.mailHeaderFontFamily) || 'Segoe UI, Arial, sans-serif',
        mailHeaderFontSize: cleanText(data.mailHeaderFontSize) || '14',
        mailHeaderItalic: data.mailHeaderItalic === true,
        mailHeaderText: cleanText(data.mailHeaderText),
        mailHeaderTextAlign: data.mailHeaderTextAlign === 'left' ? 'left' : 'center',
        mailHeaderUnderline: data.mailHeaderUnderline === true,
        smtpHost: cleanText(data.smtpHost),
        smtpPassword: cleanText(data.smtpPassword),
        smtpPort: cleanText(data.smtpPort),
        smtpUser: cleanText(data.smtpUser),
        updatedAt: data.updatedAt,
      },
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
