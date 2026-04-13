import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { ingestInboundEmail } from './inboundEmailIngest';
import { PORTAL_INBOX_EMAIL } from './mailbox';
import { getMailboxSettingsServer } from './mailboxConfigServer';
import { hasFirebaseAdminConfig } from './firebaseAdmin';

export type SyncedEmailPayload = {
  from: string;
  fromEmail: string;
  fromName: string;
  html: string;
  messageId: string;
  receivedAt?: string;
  subject: string;
  text: string;
  to: string;
};

function addressText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'object' && value !== null && 'text' in value) {
    const text = (value as { text?: unknown }).text;
    return typeof text === 'string' ? text : '';
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => addressText(entry))
      .filter(Boolean)
      .join(', ');
  }
  return '';
}

export async function syncInboxFromImap(authToken?: string) {
  const settings = await getMailboxSettingsServer();
  const useClientImportFallback = !hasFirebaseAdminConfig();
  if (settings.active === false) {
    return { count: 0, imported: [], receiver: settings.inboxEmail || PORTAL_INBOX_EMAIL };
  }
  if (!settings.imapHost || !settings.imapPort || !settings.imapUser || !settings.imapPassword) {
    throw new Error('Mailbox-Einstellungen für IMAP sind unvollständig.');
  }

  const client = new ImapFlow({
    auth: {
      pass: settings.imapPassword,
      user: settings.imapUser,
    },
    host: settings.imapHost,
    logger: false,
    port: Number(settings.imapPort),
    secure: true,
  });

  const imported: Array<{
    duplicated: boolean;
    matchedTenantId: string | null;
    messageId: string;
    status: string;
    uid: number;
  }> = [];
  const emails: SyncedEmailPayload[] = [];

  try {
    await client.connect();
    await client.mailboxOpen('INBOX');

    const allUids = await client.search({ all: true });
    const unseenUids = await client.search({ seen: false });
    const targetUids = useClientImportFallback
      ? (Array.isArray(allUids) ? allUids.slice(-20) : [])
      : Array.isArray(unseenUids)
        ? unseenUids
        : [];

    for await (const message of client.fetch(targetUids, { envelope: true, flags: true, source: true, uid: true })) {
      if (!message.source) {
        continue;
      }

      const parsed = await simpleParser(message.source);
      const emailPayload: SyncedEmailPayload = {
        from: parsed.from?.text ?? '',
        fromEmail: parsed.from?.value?.[0]?.address ?? '',
        fromName: parsed.from?.value?.[0]?.name ?? '',
        html: typeof parsed.html === 'string' ? parsed.html : '',
        messageId: parsed.messageId ?? '',
        receivedAt: parsed.date ? parsed.date.toISOString() : undefined,
        subject: parsed.subject ?? '',
        text: parsed.text ?? '',
        to: addressText(parsed.to) || settings.inboxEmail || PORTAL_INBOX_EMAIL,
      };

      if (!hasFirebaseAdminConfig()) {
        emails.push(emailPayload);
        continue;
      }

      const result = await ingestInboundEmail(emailPayload, authToken);

      imported.push({
        duplicated: result.duplicated,
        matchedTenantId: result.matchedTenantId,
        messageId: result.messageId,
        status: result.status,
        uid: message.uid,
      });

      await client.messageFlagsAdd(message.uid, ['\\Seen']);
    }
  } finally {
    await client.logout().catch(() => undefined);
  }

  return {
    count: imported.length,
    emails,
    imported,
    receiver: settings.inboxEmail || PORTAL_INBOX_EMAIL,
  };
}
