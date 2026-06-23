import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';
import { deleteLocalMailboxSettings, writeLocalMailboxSettings } from '../../../../lib/localMailboxConfig';
import { getMailboxSettingsStateServer } from '../../../../lib/mailboxConfigServer';
import { ADMIN_SETTINGS_COLLECTION, DEFAULT_MAIL_FOOTER_TEXT, MAILBOX_SETTINGS_DOC_ID } from '../../../../lib/mailboxSettings';
import { getFirestoreDocument } from '../../../../lib/firestoreRest';

export const runtime = 'nodejs';

type MailboxSettingsPayload = {
  active?: boolean;
  imapHost?: string;
  imapPassword?: string;
  imapPort?: string;
  imapUser?: string;
  inboxEmail?: string;
  mailFooterBold?: boolean;
  mailFooterDivider?: boolean;
  mailFooterFontFamily?: string;
  mailFooterFontSize?: string;
  mailFooterItalic?: boolean;
  mailFooterText?: string;
  mailFooterTextAlign?: 'center' | 'left';
  mailFooterUnderline?: boolean;
  mailHeaderBold?: boolean;
  mailHeaderDivider?: boolean;
  mailHeaderFontFamily?: string;
  mailHeaderFontSize?: string;
  mailHeaderItalic?: boolean;
  mailHeaderText?: string;
  mailHeaderTextAlign?: 'center' | 'left';
  mailHeaderUnderline?: boolean;
  smtpHost?: string;
  smtpPassword?: string;
  smtpPort?: string;
  smtpUser?: string;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function requireAdmin(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  if (!hasFirebaseAdminConfig() && process.env.NODE_ENV !== 'production') {
    if (!token) {
      return {
        error: NextResponse.json({ ok: false, error: 'missing_auth_token' }, { status: 401 }),
        token: '',
        uid: '',
      };
    }

    return {
      error: null,
      token,
      uid: 'local-dev-admin',
    };
  }

  if (!token) {
    return {
      error: NextResponse.json({ ok: false, error: 'missing_auth_token' }, { status: 401 }),
      token: '',
      uid: '',
    };
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const profile = await getAdminDb().collection('userProfiles').doc(decoded.uid).get();
    if (!profile.exists || profile.data()?.role !== 'admin') {
      return {
        error: NextResponse.json({ ok: false, error: 'admin_required' }, { status: 403 }),
        uid: '',
      };
    }

    return {
      error: null,
      token,
      uid: decoded.uid,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_auth_token';
    return {
      error: NextResponse.json({ ok: false, error: message }, { status: 401 }),
      token: '',
      uid: '',
    };
  }
}

export async function GET(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) {
    return adminCheck.error;
  }

  if (!hasFirebaseAdminConfig() && process.env.NODE_ENV !== 'production') {
    try {
      const remoteSettings = await getFirestoreDocument(
        ADMIN_SETTINGS_COLLECTION,
        MAILBOX_SETTINGS_DOC_ID,
        adminCheck.token
      );
      return NextResponse.json({
        ok: true,
        exists: !remoteSettings.data.deletedAt,
        settings: remoteSettings.data,
      });
    } catch {
      // Fall back to local/env settings below.
    }
  }

  const state = await getMailboxSettingsStateServer();
  return NextResponse.json({
    ok: true,
    exists: state.exists,
    settings: state.settings,
  });
}

export async function POST(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) {
    return adminCheck.error;
  }

  try {
    const payload = (await request.json()) as MailboxSettingsPayload;
    if (!hasFirebaseAdminConfig() && process.env.NODE_ENV !== 'production') {
      await writeLocalMailboxSettings({
        active: payload.active !== false,
        imapHost: cleanText(payload.imapHost),
        imapPassword: cleanText(payload.imapPassword),
        imapPort: cleanText(payload.imapPort),
        imapUser: cleanText(payload.imapUser),
        inboxEmail: cleanText(payload.inboxEmail),
        mailFooterBold: payload.mailFooterBold === true,
        mailFooterDivider: payload.mailFooterDivider !== false,
        mailFooterFontFamily: cleanText(payload.mailFooterFontFamily),
        mailFooterFontSize: cleanText(payload.mailFooterFontSize),
        mailFooterItalic: payload.mailFooterItalic === true,
        mailFooterText: cleanText(payload.mailFooterText),
        mailFooterTextAlign: payload.mailFooterTextAlign === 'left' ? 'left' : 'center',
        mailFooterUnderline: payload.mailFooterUnderline === true,
        mailHeaderBold: payload.mailHeaderBold === true,
        mailHeaderDivider: payload.mailHeaderDivider !== false,
        mailHeaderFontFamily: cleanText(payload.mailHeaderFontFamily),
        mailHeaderFontSize: cleanText(payload.mailHeaderFontSize),
        mailHeaderItalic: payload.mailHeaderItalic === true,
        mailHeaderText: cleanText(payload.mailHeaderText),
        mailHeaderTextAlign: payload.mailHeaderTextAlign === 'left' ? 'left' : 'center',
        mailHeaderUnderline: payload.mailHeaderUnderline === true,
        smtpHost: cleanText(payload.smtpHost),
        smtpPassword: cleanText(payload.smtpPassword),
        smtpPort: cleanText(payload.smtpPort),
        smtpUser: cleanText(payload.smtpUser),
      });
    } else {
      await getAdminDb()
        .collection(ADMIN_SETTINGS_COLLECTION)
        .doc(MAILBOX_SETTINGS_DOC_ID)
        .set({
          active: payload.active !== false,
          deletedAt: null,
          imapHost: cleanText(payload.imapHost),
          imapPassword: cleanText(payload.imapPassword),
          imapPort: cleanText(payload.imapPort),
          imapUser: cleanText(payload.imapUser),
          inboxEmail: cleanText(payload.inboxEmail),
          mailFooterBold: payload.mailFooterBold === true,
          mailFooterDivider: payload.mailFooterDivider !== false,
          mailFooterFontFamily: cleanText(payload.mailFooterFontFamily),
          mailFooterFontSize: cleanText(payload.mailFooterFontSize),
          mailFooterItalic: payload.mailFooterItalic === true,
          mailFooterText: cleanText(payload.mailFooterText),
          mailFooterTextAlign: payload.mailFooterTextAlign === 'left' ? 'left' : 'center',
          mailFooterUnderline: payload.mailFooterUnderline === true,
          mailHeaderBold: payload.mailHeaderBold === true,
          mailHeaderDivider: payload.mailHeaderDivider !== false,
          mailHeaderFontFamily: cleanText(payload.mailHeaderFontFamily),
          mailHeaderFontSize: cleanText(payload.mailHeaderFontSize),
          mailHeaderItalic: payload.mailHeaderItalic === true,
          mailHeaderText: cleanText(payload.mailHeaderText),
          mailHeaderTextAlign: payload.mailHeaderTextAlign === 'left' ? 'left' : 'center',
          mailHeaderUnderline: payload.mailHeaderUnderline === true,
          smtpHost: cleanText(payload.smtpHost),
          smtpPassword: cleanText(payload.smtpPassword),
          smtpPort: cleanText(payload.smtpPort),
          smtpUser: cleanText(payload.smtpUser),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: adminCheck.uid,
        });
    }

    const state = await getMailboxSettingsStateServer();
    return NextResponse.json({
      ok: true,
      exists: state.exists,
      settings: state.settings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'mailbox_settings_save_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) {
    return adminCheck.error;
  }

  try {
    if (!hasFirebaseAdminConfig() && process.env.NODE_ENV !== 'production') {
      await deleteLocalMailboxSettings();
    } else {
      await getAdminDb()
        .collection(ADMIN_SETTINGS_COLLECTION)
        .doc(MAILBOX_SETTINGS_DOC_ID)
        .set({
          active: false,
          deletedAt: FieldValue.serverTimestamp(),
          imapHost: '',
          imapPassword: '',
          imapPort: '',
          imapUser: '',
          inboxEmail: '',
          mailFooterBold: false,
          mailFooterDivider: true,
          mailFooterFontFamily: '',
          mailFooterFontSize: '',
          mailFooterItalic: false,
          mailFooterText: DEFAULT_MAIL_FOOTER_TEXT,
          mailFooterTextAlign: 'left',
          mailFooterUnderline: false,
          mailHeaderBold: false,
          mailHeaderDivider: true,
          mailHeaderFontFamily: '',
          mailHeaderFontSize: '',
          mailHeaderItalic: false,
          mailHeaderText: '',
          mailHeaderTextAlign: 'center',
          mailHeaderUnderline: false,
          smtpHost: '',
          smtpPassword: '',
          smtpPort: '',
          smtpUser: '',
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: adminCheck.uid,
        });
    }

    return NextResponse.json({
      ok: true,
      exists: false,
      settings: {
        active: false,
        imapHost: '',
        imapPassword: '',
        imapPort: '',
        imapUser: '',
        inboxEmail: '',
        mailFooterBold: false,
        mailFooterDivider: true,
        mailFooterFontFamily: '',
        mailFooterFontSize: '',
        mailFooterItalic: false,
        mailFooterText: DEFAULT_MAIL_FOOTER_TEXT,
        mailFooterTextAlign: 'left',
        mailFooterUnderline: false,
        mailHeaderBold: false,
        mailHeaderDivider: true,
        mailHeaderFontFamily: '',
        mailHeaderFontSize: '',
        mailHeaderItalic: false,
        mailHeaderText: '',
        mailHeaderTextAlign: 'center',
        mailHeaderUnderline: false,
        smtpHost: '',
        smtpPassword: '',
        smtpPort: '',
        smtpUser: '',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'mailbox_settings_delete_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
