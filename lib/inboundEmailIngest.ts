import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb, hasFirebaseAdminConfig } from './firebaseAdmin';
import { extractFirstEmail, normalizeEmail, PORTAL_INBOX_EMAIL } from './mailbox';
import { ensureWorkflowForMessage } from './workflowAutomation';
import { addFirestoreDocument, queryFirestoreEquals } from './firestoreRest';
import { buildExternalMessageKey } from './mailIdentity';

export type InboundEmailPayload = {
  from?: string;
  fromEmail?: string;
  fromName?: string;
  html?: string;
  messageId?: string;
  receivedAt?: Date | string;
  subject?: string;
  text?: string;
  to?: string;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

const MAX_FIRESTORE_TEXT_FIELD_BYTES = 900_000;
const MAX_BODY_TEXT_CHARS = 200_000;

function byteLength(value: string) {
  return Buffer.byteLength(value, 'utf8');
}

function limitForFirestoreField(value: string, maxBytes = MAX_FIRESTORE_TEXT_FIELD_BYTES) {
  let nextValue = value;
  while (byteLength(nextValue) > maxBytes) {
    nextValue = nextValue.slice(0, Math.floor(nextValue.length * 0.8));
  }
  return nextValue;
}

function toReceivedAt(value: Date | string | undefined) {
  if (value instanceof Date) {
    return Timestamp.fromDate(value);
  }
  const text = cleanText(value);
  if (!text) return FieldValue.serverTimestamp();
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? FieldValue.serverTimestamp() : Timestamp.fromDate(parsed);
}

export async function ingestInboundEmail(payload: InboundEmailPayload, authToken?: string) {
  const toEmail = extractFirstEmail(payload.to);
  if (toEmail !== PORTAL_INBOX_EMAIL) {
    throw new Error(`Empfänger muss ${PORTAL_INBOX_EMAIL} sein.`);
  }

  const fromEmail = normalizeEmail(payload.fromEmail) || extractFirstEmail(payload.from);
  if (!fromEmail) {
    throw new Error('Absender-E-Mail fehlt.');
  }

  const normalizedMessageId = cleanText(payload.messageId);
  const externalMessageKey = buildExternalMessageKey({
    fromEmail,
    receivedAt: payload.receivedAt,
    subject: payload.subject,
    text: payload.text,
  });

  if (normalizedMessageId || externalMessageKey) {
    if (!hasFirebaseAdminConfig()) {
      if (!authToken) {
        throw new Error('auth_token_missing_for_rest_fallback');
      }
      const deletedByMessageId =
        normalizedMessageId
          ? await queryFirestoreEquals('deletedMessages', 'messageId', normalizedMessageId, authToken)
          : [];
      const deletedByExternalKey =
        externalMessageKey
          ? await queryFirestoreEquals('deletedMessages', 'externalMessageKey', externalMessageKey, authToken)
          : [];
      if (deletedByMessageId.length > 0 || deletedByExternalKey.length > 0) {
        return {
          duplicated: true,
          matchedTenantId: null,
          messageId: normalizedMessageId || externalMessageKey,
          receiver: PORTAL_INBOX_EMAIL,
          status: 'deleted',
        };
      }
      const existingByMessageId =
        normalizedMessageId ? await queryFirestoreEquals('messages', 'messageId', normalizedMessageId, authToken) : [];
      const existingByExternalKey =
        externalMessageKey
          ? await queryFirestoreEquals('messages', 'externalMessageKey', externalMessageKey, authToken)
          : [];
      const existing = [...existingByMessageId, ...existingByExternalKey];
      if (existing.length > 0) {
        return {
          duplicated: true,
          matchedTenantId: cleanText(existing[0]?.data.tenantId),
          messageId: existing[0]!.id,
          receiver: PORTAL_INBOX_EMAIL,
          status: cleanText(existing[0]?.data.status) || 'new',
        };
      }
    } else {
      const db = getAdminDb();
      const deletedSnapshotByMessageId = normalizedMessageId
        ? await db.collection('deletedMessages').where('messageId', '==', normalizedMessageId).limit(1).get()
        : null;
      const deletedSnapshotByExternalKey = externalMessageKey
        ? await db.collection('deletedMessages').where('externalMessageKey', '==', externalMessageKey).limit(1).get()
        : null;

      if (
        (deletedSnapshotByMessageId && !deletedSnapshotByMessageId.empty) ||
        (deletedSnapshotByExternalKey && !deletedSnapshotByExternalKey.empty)
      ) {
        return {
          duplicated: true,
          matchedTenantId: null,
          messageId: normalizedMessageId || externalMessageKey,
          receiver: PORTAL_INBOX_EMAIL,
          status: 'deleted',
        };
      }

      const existingSnapshotByMessageId = normalizedMessageId
        ? await db.collection('messages').where('messageId', '==', normalizedMessageId).limit(1).get()
        : null;
      const existingSnapshotByExternalKey = externalMessageKey
        ? await db.collection('messages').where('externalMessageKey', '==', externalMessageKey).limit(1).get()
        : null;
      const existingSnapshot =
        existingSnapshotByMessageId && !existingSnapshotByMessageId.empty
          ? existingSnapshotByMessageId
          : existingSnapshotByExternalKey;

      if (existingSnapshot && !existingSnapshot.empty) {
        return {
          duplicated: true,
          matchedTenantId: cleanText(existingSnapshot.docs[0]?.data().tenantId),
          messageId: existingSnapshot.docs[0]!.id,
          receiver: PORTAL_INBOX_EMAIL,
          status: cleanText(existingSnapshot.docs[0]?.data().status) || 'new',
        };
      }
    }
  }

  let tenantDoc: { id: string; data: () => any } | null = null;
  let tenantData: any = null;

  if (!hasFirebaseAdminConfig()) {
    if (!authToken) {
      throw new Error('auth_token_missing_for_rest_fallback');
    }
    const tenantMatches = await queryFirestoreEquals('tenants', 'email', fromEmail, authToken);
    const tenantEntry = tenantMatches[0] ?? null;
    tenantDoc = tenantEntry
      ? {
          data: () => tenantEntry.data,
          id: tenantEntry.id,
        }
      : null;
    tenantData = tenantEntry?.data ?? null;
  } else {
    const db = getAdminDb();
    const tenantSnapshot = await db
      .collection('tenants')
      .where('email', '==', fromEmail)
      .limit(1)
      .get();

    tenantDoc = tenantSnapshot.docs[0] ?? null;
    tenantData = tenantDoc?.data() ?? null;
  }

  const bodyHtml = cleanText(payload.html);
  const limitedBodyHtml = limitForFirestoreField(bodyHtml);
  const bodyText = cleanText(payload.text).slice(0, MAX_BODY_TEXT_CHARS);

  const messagePayload = {
    analysis: null,
    attachments: [],
    bodyHtml: limitedBodyHtml,
    bodyHtmlTruncated: bodyHtml.length > limitedBodyHtml.length,
    bodyText,
    category: '',
    channel: 'email',
    createdAt: hasFirebaseAdminConfig() ? FieldValue.serverTimestamp() : new Date().toISOString(),
    direction: 'inbound',
    fromEmail,
    fromName: cleanText(payload.fromName) || cleanText(payload.from) || fromEmail,
    externalMessageKey,
    messageId: normalizedMessageId,
    priority: 'normal',
    propertyId: cleanText(tenantData?.propertyId),
    rawRecipient: PORTAL_INBOX_EMAIL,
    receivedAt: hasFirebaseAdminConfig() ? toReceivedAt(payload.receivedAt) : new Date(payload.receivedAt ?? Date.now()).toISOString(),
    status: tenantDoc ? 'new' : 'needs_review',
    subject: cleanText(payload.subject) || 'Eingehende E-Mail',
    tenantId: tenantDoc?.id ?? '',
    ticketId: '',
    toEmail: PORTAL_INBOX_EMAIL,
    unitId: cleanText(tenantData?.unitId),
    updatedAt: hasFirebaseAdminConfig() ? FieldValue.serverTimestamp() : new Date().toISOString(),
  };

  const createdId = hasFirebaseAdminConfig()
    ? (await getAdminDb().collection('messages').add(messagePayload)).id
    : await addFirestoreDocument('messages', messagePayload, authToken!);

  await ensureWorkflowForMessage(createdId, authToken);

  return {
    duplicated: false,
    matchedTenantId: tenantDoc?.id ?? null,
    messageId: createdId,
    receiver: PORTAL_INBOX_EMAIL,
    status: messagePayload.status,
  };
}
