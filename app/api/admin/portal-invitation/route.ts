import { readFile } from 'node:fs/promises';
import path from 'node:path';
﻿import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';
import { getFirestoreDocument, setFirestoreDocument } from '../../../../lib/firestoreRest';
import { writeLocalPortalAccess } from '../../../../lib/localPortalAccess';
import {
  buildPortalAuthEmail,
  buildPortalDisplayName,
  cleanPortalText,
  getPortalCollectionName,
  getPortalTargetLabel,
  type PortalTargetType,
} from '../../../../lib/portalAccess';
import { getPortalInvitationSettingsServer } from '../../../../lib/portalInvitationConfigServer';
import { decryptPortalPassword, encryptPortalPassword } from '../../../../lib/portalSecrets';
import {
  buildFullEmailSignatureHtml,
  buildSignatureText,
  createSignatureRecord,
} from '../../../../lib/signatures';
import { sendPortalEmail } from '../../../../lib/smtp';

export const runtime = 'nodejs';

type InvitationPayload = {
  targetId?: string;
  targetType?: PortalTargetType;
};

async function requireAdmin(request: Request) {
  if (!hasFirebaseAdminConfig() && process.env.NODE_ENV !== 'production') {
    return { error: null, uid: 'local-dev-admin' };
  }

  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    return {
      error: NextResponse.json({ ok: false, error: 'missing_auth_token' }, { status: 401 }),
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

    return { error: null, uid: decoded.uid };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_auth_token';
    return {
      error: NextResponse.json({ ok: false, error: message }, { status: 401 }),
      uid: '',
    };
  }
}

function buildGreeting(targetType: PortalTargetType, data: Record<string, unknown>) {
  const salutation = cleanPortalText(data.salutation);
  const firstName = cleanPortalText(data.firstName);
  const lastName = cleanPortalText(data.lastName);

  if (salutation === 'mr' && lastName) {
    return `Sehr geehrter Herr ${lastName},`;
  }
  if (salutation === 'ms' && lastName) {
    return `Sehr geehrte Frau ${lastName},`;
  }
  if (firstName || lastName) {
    return `Guten Tag ${[firstName, lastName].filter(Boolean).join(' ')},`;
  }

  return `Guten Tag ${getPortalTargetLabel(targetType)},`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHtmlFromPlainText(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function wrapEmailHtmlDocument(innerHtml: string) {
  const content = cleanPortalText(innerHtml);
  if (!content) return '';
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0;padding:0;background:#ffffff;">
    ${content}
  </body>
</html>`;
}

function buildDefaultInvitationBody() {
  return [
    '{{GREETING}}',
    '',
    'fuer {{DISPLAY_NAME}} wurde ein persoenlicher Zugang zum Halbmann Portal eingerichtet.',
    '',
    'Ihre Zugangsdaten:',
    'Benutzername: {{USERNAME}}',
    'Passwort: {{PASSWORD}}',
    '',
    'Anmeldung ueber unsere Homepage:',
    '{{LOGIN_URL}}',
    '',
    '{{PORTAL_EXPLANATION}}',
    '',
    'Vorteile auf einen Blick:',
    '- direkter Nachrichtenverlauf mit der Verwaltung',
    '- wichtige Unterlagen an einem Ort',
    '- schnelle Rueckfragen ohne Umwege',
    '',
    '{{SIGNATURE}}',
  ].join('\n');
}


async function resolveInlineLogoForEmail(logoUrl: string) {
  const cleaned = cleanPortalText(logoUrl);
  if (!cleaned || cleaned.startsWith('data:') || cleaned.startsWith('cid:')) {
    return null;
  }
  let localPath = cleaned;
  if (/^https?:\/\//i.test(cleaned)) {
    try {
      const parsed = new URL(cleaned);
      const knownOrigins = [
        cleanPortalText(process.env.NEXT_PUBLIC_APP_URL),
        cleanPortalText(process.env.APP_URL),
        'http://localhost:3000',
      ].filter(Boolean);
      if (!knownOrigins.includes(`${parsed.protocol}//${parsed.host}`)) {
        return null;
      }
      localPath = parsed.pathname;
    } catch {
      return null;
    }
  }
  if (!localPath.startsWith('/')) {
    return null;
  }

  const relativePath = localPath.replace(/^\/+/, '').split('/').filter(Boolean);
  const absolutePath = path.join(process.cwd(), 'public', ...relativePath);
  const fileBuffer = await readFile(absolutePath);
  const extension = path.extname(absolutePath).toLowerCase();
  const contentType =
    extension === '.svg'
      ? 'image/svg+xml'
      : extension === '.webp'
        ? 'image/webp'
        : extension === '.jpg' || extension === '.jpeg'
          ? 'image/jpeg'
          : 'image/png';
  const cid = `signature-logo-${Date.now()}@halbmann.local`;

  return {
    attachment: {
      cid,
      content: fileBuffer,
      contentType,
      filename: path.basename(absolutePath),
    },
    cidUrl: `cid:${cid}`,
  };
}

async function getCompanyDataForInvitation(args: {
  clientToken: string;
  targetData: Record<string, unknown>;
  targetType: PortalTargetType;
  useAdmin: boolean;
}) {
  const directCompanyId = cleanPortalText(args.targetData.companyId);
  const propertyId = cleanPortalText(args.targetData.propertyId);

  if (directCompanyId) {
    return args.useAdmin
      ? ((await getAdminDb().collection('companies').doc(directCompanyId).get()).data() ?? null)
      : (await getFirestoreDocument('companies', directCompanyId, args.clientToken)).data;
  }

  if (args.targetType === 'tenant' && propertyId) {
    const propertyData = args.useAdmin
      ? ((await getAdminDb().collection('properties').doc(propertyId).get()).data() ?? null)
      : (await getFirestoreDocument('properties', propertyId, args.clientToken)).data;
    const ownerId = cleanPortalText(propertyData?.ownerId);
    if (!ownerId) return null;
    return args.useAdmin
      ? ((await getAdminDb().collection('companies').doc(ownerId).get()).data() ?? null)
      : (await getFirestoreDocument('companies', ownerId, args.clientToken)).data;
  }

  return null;
}

export async function POST(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) {
    return adminCheck.error;
  }

  try {
    const payload = (await request.json()) as InvitationPayload;
    const targetType = payload.targetType === 'contact' ? 'contact' : payload.targetType === 'tenant' ? 'tenant' : null;
    const targetId = cleanPortalText(payload.targetId);
    const clientToken = request.headers.get('authorization')?.replace(/^Bearer\s+/, '') || '';

    if (!targetType || !targetId) {
      return NextResponse.json({ ok: false, error: 'portal_target_missing' }, { status: 400 });
    }

    const useAdmin = hasFirebaseAdminConfig();
    const db = useAdmin ? getAdminDb() : null;
    const targetCollection = getPortalCollectionName(targetType);
    const targetData = useAdmin
      ? ((await db!.collection(targetCollection).doc(targetId).get()).data() ?? null)
      : (await getFirestoreDocument(targetCollection, targetId, clientToken)).data;

    if (!targetData) {
      return NextResponse.json({ ok: false, error: 'portal_target_not_found' }, { status: 404 });
    }

    const recipientEmail = cleanPortalText(targetData.email);
    const username = cleanPortalText(targetData.portalUsername);
    const password =
      decryptPortalPassword(targetData.portalPasswordCipher) || cleanPortalText(targetData.portalPassword);
    const displayName = buildPortalDisplayName(targetType, targetData);
    let portalAuthUid = cleanPortalText(targetData.portalAuthUid);

    if (!recipientEmail || !username || !password) {
      return NextResponse.json({ ok: false, error: 'portal_invitation_incomplete' }, { status: 400 });
    }

    const companyData = await getCompanyDataForInvitation({
      clientToken,
      targetData,
      targetType,
      useAdmin,
    });
    const signatureRecord = createSignatureRecord((companyData as Record<string, unknown>) ?? null);
    const inlineLogo = await resolveInlineLogoForEmail(signatureRecord.logoUrl).catch(() => null);
    const emailSignatureRecord = inlineLogo
      ? {
          ...signatureRecord,
          logoUrl: inlineLogo.cidUrl,
        }
      : signatureRecord;
    const mailSignature = buildSignatureText(signatureRecord);
    const mailSignatureHtml = buildFullEmailSignatureHtml(emailSignatureRecord);

    if (useAdmin && !portalAuthUid) {
      const authEmail = buildPortalAuthEmail(username);
      const createdUser = await getAdminAuth().createUser({
        email: authEmail,
        password,
      });
      portalAuthUid = createdUser.uid;

      await db!.collection('userProfiles').doc(portalAuthUid).set(
        {
          authEmail,
          contactEmail: recipientEmail,
          createdAt: FieldValue.serverTimestamp(),
          displayName,
          email: authEmail,
          role: 'portal',
          targetId,
          targetType,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: adminCheck.uid,
          username,
        },
        { merge: true }
      );

      await db!.collection(targetCollection).doc(targetId).set(
        {
          portalAccessEnabled: true,
          portalAuthUid,
          portalPassword: FieldValue.delete(),
          portalPasswordCipher: encryptPortalPassword(password),
          portalUsername: username,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else if (!useAdmin && !portalAuthUid) {
      const authEmail = buildPortalAuthEmail(username);
      portalAuthUid = `local-portal-${targetType}-${targetId}`;

      await setFirestoreDocument(
        'userProfiles',
        portalAuthUid,
        {
          authEmail,
          contactEmail: recipientEmail,
          createdAt: new Date().toISOString(),
          displayName,
          email: authEmail,
          role: 'portal',
          targetId,
          targetType,
          updatedAt: new Date().toISOString(),
          updatedBy: adminCheck.uid,
          username,
        },
        clientToken
      );

      await setFirestoreDocument(
        targetCollection,
        targetId,
        {
          ...targetData,
          authEmail,
          portalAccessEnabled: true,
          portalAuthUid,
          portalPassword: '',
          portalPasswordCipher: encryptPortalPassword(password),
          portalUsername: username,
          updatedAt: new Date().toISOString(),
        },
        clientToken
      );

      await writeLocalPortalAccess({
        authEmail,
        contactEmail: recipientEmail,
        passwordCipher: encryptPortalPassword(password),
        targetId,
        targetType,
        uid: portalAuthUid,
        username,
      });
    }

    const greeting = buildGreeting(targetType, targetData);
    const explanation =
      targetType === 'tenant'
        ? 'Im Portal sehen Sie Ihre Mietdaten, Ihre Einheit, bereitgestellte Unterlagen und den direkten Nachrichtenverlauf mit der Verwaltung. Über die App oder die Homepage erreichen Sie uns schnell und ohne Umwege.'
        : 'Im Portal sehen Sie Ihre Kontaktdaten, bereitgestellte Unterlagen und den direkten Nachrichtenverlauf mit der Verwaltung. Über die App oder die Homepage bleiben alle Informationen an einem Ort gebündelt.';
    const invitationSettings = await getPortalInvitationSettingsServer();
    const loginUrl = 'https://halbmann-holding.de';
    const subject = cleanPortalText(invitationSettings.subject) || 'Ihr Zugang zum Halbmann Portal';
    const template = cleanPortalText(invitationSettings.bodyTemplate);
    const templateSource = template || buildDefaultInvitationBody();
    const renderedText = templateSource
      .replaceAll('{{GREETING}}', greeting)
      .replaceAll('{{DISPLAY_NAME}}', displayName)
      .replaceAll('{{USERNAME}}', username)
      .replaceAll('{{PASSWORD}}', password)
      .replaceAll('{{LOGIN_URL}}', loginUrl)
      .replaceAll('{{PORTAL_EXPLANATION}}', explanation)
      .replaceAll('{{SIGNATURE}}', mailSignature)
      .trim();
    const text =
      renderedText.length > 40 && renderedText.includes(username)
        ? renderedText
        : buildDefaultInvitationBody()
            .replaceAll('{{GREETING}}', greeting)
            .replaceAll('{{DISPLAY_NAME}}', displayName)
            .replaceAll('{{USERNAME}}', username)
            .replaceAll('{{PASSWORD}}', password)
            .replaceAll('{{LOGIN_URL}}', loginUrl)
            .replaceAll('{{PORTAL_EXPLANATION}}', explanation)
            .replaceAll('{{SIGNATURE}}', mailSignature)
            .trim();
    const htmlText = templateSource
      .replaceAll('{{GREETING}}', greeting)
      .replaceAll('{{DISPLAY_NAME}}', displayName)
      .replaceAll('{{USERNAME}}', username)
      .replaceAll('{{PASSWORD}}', password)
      .replaceAll('{{LOGIN_URL}}', loginUrl)
      .replaceAll('{{PORTAL_EXPLANATION}}', explanation)
      .replaceAll('{{SIGNATURE}}', '')
      .trim();
    const html = wrapEmailHtmlDocument(`
      <div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;line-height:1.65">
        ${renderHtmlFromPlainText(htmlText)}
        ${mailSignatureHtml}
      </div>
    `);

    await sendPortalEmail({
      attachments: inlineLogo ? [inlineLogo.attachment] : undefined,
      html,
      subject,
      text,
      to: recipientEmail,
    });

    if (useAdmin) {
      await db!.collection(targetCollection).doc(targetId).set(
        {
          portalInvitationSentAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      try {
        await setFirestoreDocument(
          targetCollection,
          targetId,
          {
            ...targetData,
            portalInvitationSentAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          clientToken
        );
      } catch (error) {
        console.warn('Portal-Einladung lokal gesendet, Zeitstempel im Zieldokument konnte nicht gespeichert werden.', error);
      }
    }

    if (portalAuthUid) {
      if (useAdmin) {
        await db!.collection('userProfiles').doc(portalAuthUid).set(
          {
            invitationSentAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: adminCheck.uid,
          },
          { merge: true }
        );
      } else {
        let profileData: Record<string, unknown> = {};
        try {
          const profile = await getFirestoreDocument('userProfiles', portalAuthUid, clientToken);
          profileData = profile.data;
        } catch {
          profileData = {};
        }
        try {
          await setFirestoreDocument(
            'userProfiles',
            portalAuthUid,
            {
              ...profileData,
              invitationSentAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              updatedBy: adminCheck.uid,
            },
            clientToken
          );
        } catch (error) {
          console.warn('Portal-Einladung lokal gesendet, invitationSentAt im Profil konnte nicht gespeichert werden.', error);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'portal_invitation_send_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
