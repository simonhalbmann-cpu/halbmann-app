import nodemailer from 'nodemailer';
import { DEFAULT_INBOX_EMAIL } from './mailbox';
import { getMailboxSettingsServer } from './mailboxConfigServer';

export async function getSmtpTransport() {
  const settings = await getMailboxSettingsServer();
  if (settings.active === false) {
    throw new Error('Das E-Mail-Postfach ist deaktiviert.');
  }
  if (!settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPassword) {
    throw new Error('Mailbox-Einstellungen fÃ¼r SMTP sind unvollstÃ¤ndig.');
  }
  return nodemailer.createTransport({
    auth: { pass: settings.smtpPassword, user: settings.smtpUser },
    host: settings.smtpHost,
    port: Number(settings.smtpPort),
    secure: Number(settings.smtpPort) === 465,
  });
}

export async function sendMailboxEmail(args: {
  attachments?: Array<{
    cid?: string;
    content?: Buffer | string;
    contentType?: string;
    filename?: string;
    path?: string;
  }>;
  html?: string;
  subject: string;
  text: string;
  to: string;
}) {
  const transporter = await getSmtpTransport();
  const settings = await getMailboxSettingsServer();
  return transporter.sendMail({
    attachments: args.attachments,
    from: `"Halbmann Holding" <${settings.inboxEmail || DEFAULT_INBOX_EMAIL}>`,
    html: args.html,
    subject: args.subject,
    text: args.text,
    to: args.to,
  });
}
