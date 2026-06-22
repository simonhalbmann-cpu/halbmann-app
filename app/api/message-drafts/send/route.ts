import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminDb, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';
import {
  addFirestoreDocument,
  getFirestoreDocument,
  setFirestoreDocument,
} from '../../../../lib/firestoreRest';
import { getMailboxSettingsServer } from '../../../../lib/mailboxConfigServer';
import {
  buildFullEmailSignatureHtml,
  buildSignatureText,
  createSignatureRecord,
  type SignatureRecord,
} from '../../../../lib/signatures';
import { sendMailboxEmail } from '../../../../lib/smtp';

export const runtime = 'nodejs';

type SendDraftPayload = {
  draft?: Record<string, unknown>;
  draftId?: string;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readEmailList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => cleanText(entry).toLowerCase()).filter(Boolean);
  }
  return cleanText(value)
    .split(/[,;\n]/)
    .map((entry) => cleanText(entry).toLowerCase())
    .filter(Boolean);
}

function encodeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildMailHeaderHtml(text: string) {
  const content = cleanText(text);
  if (!content) return '';
  return `
    <div style="margin:0 0 18px 0;padding:18px 22px;border:1px solid #ead9bc;border-radius:18px;background:linear-gradient(180deg,#fff9ef 0%,#f6ecdc 100%);text-align:center;">
      <div style="font-size:14px;line-height:1.6;color:#6b4f2d;font-weight:600;">${encodeHtml(content)}</div>
    </div>
  `;
}

function wrapEmailHtmlDocument(innerHtml: string) {
  const content = cleanText(innerHtml);
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

function resolveFontSize(value: string, fallback: string) {
  const normalized = cleanText(value).replace(/px$/i, '');
  return /^\d{1,2}$/.test(normalized) ? `${normalized}px` : fallback;
}

function resolveFontFamily(value: string, fallback: string) {
  return cleanText(value) || fallback;
}

function buildStyledTextHtml({
  align,
  bold,
  divider,
  fontFamily,
  fontSize,
  italic,
  text,
  underline,
}: {
  align: 'center' | 'left';
  bold?: boolean;
  divider?: boolean;
  fontFamily?: string;
  fontSize?: string;
  italic?: boolean;
  text: string;
  underline?: boolean;
}) {
  const content = cleanText(text);
  if (!content) return '';
  const style = [
    `text-align:${align === 'left' ? 'left' : 'center'}`,
    `font-family:${resolveFontFamily(fontFamily || '', 'Segoe UI, Arial, sans-serif')}`,
    `font-size:${resolveFontSize(fontSize || '', '14px')}`,
    `font-weight:${bold ? '700' : '500'}`,
    `font-style:${italic ? 'italic' : 'normal'}`,
    `text-decoration:${underline ? 'underline' : 'none'}`,
    'line-height:1.55',
    'color:#6b4f2d',
  ].join(';');
  return `
    <div style="margin:0 0 18px 0;${divider === false ? '' : 'padding-top:14px;border-top:1px solid #ead9bc;'}">
      <div style="${style}">${encodeHtml(content)}</div>
    </div>
  `;
}

function stripTrailingSignature(body: string, signatureText: string) {
  const trimmedBody = cleanText(body);
  const trimmedSignature = cleanText(signatureText);
  if (!trimmedBody || !trimmedSignature) return trimmedBody;
  return trimmedBody.endsWith(trimmedSignature)
    ? trimmedBody.slice(0, trimmedBody.length - trimmedSignature.length).trimEnd()
    : trimmedBody;
}

function buildDraftSignatureRecord(value: unknown): SignatureRecord {
  const fallback = createSignatureRecord(null);
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const raw = value as Record<string, unknown>;
  const looksLikeFinalSignature =
    Boolean(cleanText(raw.logoUrl)) ||
    Boolean(cleanText(raw.companyName)) ||
    Boolean(cleanText(raw.closing)) ||
    Boolean(cleanText(raw.portalName));

  if (looksLikeFinalSignature) {
    return {
      ...fallback,
      ...(raw as Partial<SignatureRecord>),
    };
  }

  return createSignatureRecord(raw);
}

function readDraftAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const raw = entry as Record<string, unknown>;
      const url = cleanText(raw.url);
      const name = cleanText(raw.name) || 'anhang';
      if (!url) return null;
      return {
        contentType: cleanText(raw.contentType) || 'application/octet-stream',
        filename: name,
        path: url,
      };
    })
    .filter((entry): entry is { contentType: string; filename: string; path: string } => Boolean(entry));
}

async function resolveInlineLogoForEmail(logoUrl: string) {
  const cleaned = cleanText(logoUrl);
  if (!cleaned || cleaned.startsWith('data:') || cleaned.startsWith('cid:')) {
    return null;
  }
  let localPath = cleaned;
  if (/^https?:\/\//i.test(cleaned)) {
    try {
      const parsed = new URL(cleaned);
      const knownOrigins = [
        cleanText(process.env.NEXT_PUBLIC_APP_URL),
        cleanText(process.env.APP_URL),
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

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization') ?? '';
    const authToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const payload = (await request.json()) as SendDraftPayload;
    const draftId = cleanText(payload.draftId);
    const inlineDraft = payload.draft && typeof payload.draft === 'object' ? payload.draft : null;
    if (!draftId && !inlineDraft) {
      return NextResponse.json({ ok: false, error: 'draft_id_missing' }, { status: 400 });
    }

    if (!hasFirebaseAdminConfig() && !authToken) {
      return NextResponse.json({ ok: false, error: 'missing_auth_token' }, { status: 401 });
    }

    const db = hasFirebaseAdminConfig() ? getAdminDb() : null;
    let draft: Record<string, unknown> = {};
    if (inlineDraft) {
      draft = inlineDraft;
    } else {
      const draftSnapshot = hasFirebaseAdminConfig()
        ? await db!.collection('messageDrafts').doc(draftId).get()
        : null;
      if (hasFirebaseAdminConfig() && !draftSnapshot?.exists) {
        return NextResponse.json({ ok: false, error: 'draft_not_found' }, { status: 404 });
      }

      const draftRecord = hasFirebaseAdminConfig()
        ? { data: draftSnapshot?.data() ?? {}, id: draftSnapshot?.id ?? draftId }
        : await getFirestoreDocument('messageDrafts', draftId, authToken);
      draft = (draftRecord.data as Record<string, unknown>) ?? {};
    }
    const recipientEmail = cleanText(draft.recipientEmail);
    const ccEmails = readEmailList(draft.ccEmails);
    const bccEmails = readEmailList(draft.bccEmails);
    const subject = cleanText(draft.subject);
    const body = cleanText(draft.body);
    const htmlBody = cleanText(draft.htmlBody);

    if (!recipientEmail || !subject || !body) {
      return NextResponse.json({ ok: false, error: 'draft_incomplete' }, { status: 400 });
    }

    const mailboxSettings = await getMailboxSettingsServer();
    const senderEmail = cleanText(mailboxSettings.inboxEmail) || 'portal@halbmann-holding.de';
    const mailHeaderText = cleanText(mailboxSettings.mailHeaderText);
    const signature = buildDraftSignatureRecord(draft.signature);
    const inlineLogo = await resolveInlineLogoForEmail(signature.logoUrl).catch(() => null);
    const emailSignatureRecord = inlineLogo
      ? {
          ...signature,
          logoUrl: inlineLogo.cidUrl,
        }
      : signature;
    const fullSignatureText = buildSignatureText(signature);
    const visibleBody = stripTrailingSignature(body, fullSignatureText);
    const plainTextBody = [visibleBody, fullSignatureText].filter(Boolean).join('\n\n');
    const finalHtmlBody = [
      buildStyledTextHtml({
        align: mailboxSettings.mailHeaderTextAlign === 'left' ? 'left' : 'center',
        bold: mailboxSettings.mailHeaderBold === true,
        divider: mailboxSettings.mailHeaderDivider !== false,
        fontFamily: mailboxSettings.mailHeaderFontFamily,
        fontSize: mailboxSettings.mailHeaderFontSize,
        italic: mailboxSettings.mailHeaderItalic === true,
        text: mailHeaderText,
        underline: mailboxSettings.mailHeaderUnderline === true,
      }) || buildMailHeaderHtml(mailHeaderText),
      htmlBody ||
        `<div style="white-space:pre-wrap;font-family:Segoe UI,Arial,sans-serif;">${encodeHtml(visibleBody)}</div>${
          buildFullEmailSignatureHtml(emailSignatureRecord) || ''
        }${buildStyledTextHtml({
          align: mailboxSettings.mailFooterTextAlign === 'left' ? 'left' : 'center',
          bold: mailboxSettings.mailFooterBold === true,
          divider: mailboxSettings.mailFooterDivider !== false,
          fontFamily: mailboxSettings.mailFooterFontFamily,
          fontSize: mailboxSettings.mailFooterFontSize,
          italic: mailboxSettings.mailFooterItalic === true,
          text: cleanText(mailboxSettings.mailFooterText),
          underline: mailboxSettings.mailFooterUnderline === true,
        }) || ''}`,
    ]
      .filter(Boolean)
      .join('');
    const draftAttachments = readDraftAttachments(draft.attachments);
    const sendInfo = await sendMailboxEmail({
      attachments: [...(inlineLogo ? [inlineLogo.attachment] : []), ...draftAttachments],
      html: wrapEmailHtmlDocument(finalHtmlBody) || undefined,
      bcc: bccEmails,
      cc: ccEmails,
      subject,
      text: plainTextBody,
      to: recipientEmail,
    });

    const nowValue = hasFirebaseAdminConfig() ? FieldValue.serverTimestamp() : new Date().toISOString();
    if (draftId) {
      const draftUpdate = {
        ...draft,
        sentAt: nowValue,
        smtpMessageId: sendInfo.messageId,
        status: 'sent',
        updatedAt: nowValue,
      };

      if (hasFirebaseAdminConfig()) {
        await db!.collection('messageDrafts').doc(draftId).set(draftUpdate, { merge: true });
      } else {
        await setFirestoreDocument('messageDrafts', draftId, draftUpdate, authToken);
      }
    }

    const messageId = cleanText(draft.messageId);
    const ticketId = cleanText(draft.ticketId);
    const outboundMessagePayload = {
      attachments: Array.isArray(draft.attachments) ? draft.attachments : [],
      bodyHtml: '',
      bodyText: cleanText(draft.messageBodyText) || cleanText(draft.portalBodyText) || body,
      category: '',
      channel: 'email',
      bccEmails,
      createdAt: nowValue,
      ccEmails,
      draftKind: cleanText(draft.kind),
      deliveryMode: cleanText(draft.deliveryMode) || 'email',
      direction: 'outbound',
      externalMessageKey: cleanText(draft.externalMessageKey),
      fromEmail: senderEmail,
      fromName: 'Halbmann Holding',
      inReplyToDraftId: draftId || '',
      priority: 'normal',
      propertyId: cleanText(draft.propertyId),
      receivedAt: nowValue,
      recipientId: cleanText(draft.recipientId),
      recipientType: cleanText(draft.recipientType),
      relatedMessageId: messageId,
      status: 'sent',
      subject,
      tenantId: cleanText(draft.recipientType) === 'tenant' ? cleanText(draft.recipientId) : '',
      ticketId,
      toEmail: recipientEmail,
      unitId: cleanText(draft.unitId),
      updatedAt: nowValue,
    };

    if (hasFirebaseAdminConfig()) {
      await db!.collection('messages').add(outboundMessagePayload);
    } else {
      await addFirestoreDocument('messages', outboundMessagePayload, authToken);
    }

    if (ticketId) {
      const eventPayload = {
        actorId: 'admin',
        actorType: 'admin',
        createdAt: nowValue,
        kind: 'email_sent',
        text: `Entwurf wurde an ${recipientEmail} versendet.`,
        ticketId,
      };
      if (hasFirebaseAdminConfig()) {
        await db!.collection('ticketEvents').add(eventPayload);
        await db!.collection('tickets').doc(ticketId).set(
          {
            nextStep: 'Auf RÃ¼ckmeldung warten',
            updatedAt: nowValue,
          },
          { merge: true }
        );
      } else {
        await addFirestoreDocument('ticketEvents', eventPayload, authToken);
        const ticketRecord = await getFirestoreDocument('tickets', ticketId, authToken);
        await setFirestoreDocument(
          'tickets',
          ticketId,
          {
            ...ticketRecord.data,
            nextStep: 'Auf RÃ¼ckmeldung warten',
            updatedAt: nowValue,
          },
          authToken
        );
      }
    }

    if (messageId) {
      if (hasFirebaseAdminConfig()) {
        await db!.collection('messages').doc(messageId).set(
          {
            status: ticketId ? 'ticket_created' : 'done',
            updatedAt: nowValue,
          },
          { merge: true }
        );
      } else {
        try {
          const messageRecord = await getFirestoreDocument('messages', messageId, authToken);
          await setFirestoreDocument(
            'messages',
            messageId,
            {
              ...messageRecord.data,
              status: ticketId ? 'ticket_created' : 'done',
              updatedAt: nowValue,
            },
            authToken
          );
        } catch {
          // Lokale Themen koennen als relatedMessageId eine Themen-ID tragen, ohne bestehendes messages-Dokument.
        }
      }
    }

    return NextResponse.json({
      ok: true,
      draftId,
      messageId: sendInfo.messageId,
      recipientEmail,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'draft_send_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
