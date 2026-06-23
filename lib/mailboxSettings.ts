export const ADMIN_SETTINGS_COLLECTION = 'adminSettings';
export const MAILBOX_SETTINGS_DOC_ID = 'mailbox';
export const DEFAULT_MAIL_FOOTER_TEXT =
  'Diese E-Mail und etwaige Anhänge sind vertraulich und ausschließlich für die bezeichneten Empfänger bestimmt. Sollten Sie diese Nachricht irrtümlich erhalten haben, informieren Sie bitte den Absender und löschen Sie die Nachricht. Jede unbefugte Weitergabe, Vervielfältigung oder Nutzung ist untersagt. Trotz sorgfältiger Prüfung kann eine vollständige Sicherheit elektronischer Kommunikation nicht gewährleistet werden.';

export type MailboxSettings = {
  active?: boolean;
  imapHost?: string;
  imapPassword?: string;
  imapPort?: string;
  imapUser?: string;
  inboxEmail?: string;
  mailFooterDivider?: boolean;
  mailFooterText?: string;
  mailFooterBold?: boolean;
  mailFooterFontFamily?: string;
  mailFooterFontSize?: string;
  mailFooterItalic?: boolean;
  mailFooterTextAlign?: 'center' | 'left';
  mailFooterUnderline?: boolean;
  mailHeaderDivider?: boolean;
  mailHeaderText?: string;
  mailHeaderBold?: boolean;
  mailHeaderFontFamily?: string;
  mailHeaderFontSize?: string;
  mailHeaderItalic?: boolean;
  mailHeaderTextAlign?: 'center' | 'left';
  mailHeaderUnderline?: boolean;
  smtpHost?: string;
  smtpPassword?: string;
  smtpPort?: string;
  smtpUser?: string;
  updatedAt?: unknown;
};
