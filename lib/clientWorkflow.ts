'use client';

import {
  addDoc,
  arrayUnion,
  collection,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  doc,
  type DocumentData,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  inferMessageAnalysis,
  type WorkflowRecord,
} from './adminWorkflow';
import { db, storage } from './firebase';
import { buildExternalMessageKey } from './mailIdentity';
import { sanitizeStorageFileName, type StoredDocumentEntry } from './tenantDocuments';

export type SyncedInboundEmail = {
  attachments?: Array<{
    contentBase64?: string;
    contentType?: string;
    name?: string;
    size?: number;
  }>;
  from?: string;
  fromEmail?: string;
  fromName?: string;
  html?: string;
  messageId?: string;
  receivedAt?: string;
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
  return new TextEncoder().encode(value).length;
}

function limitForFirestoreField(value: string, maxBytes = MAX_FIRESTORE_TEXT_FIELD_BYTES) {
  let nextValue = value;
  while (byteLength(nextValue) > maxBytes) {
    nextValue = nextValue.slice(0, Math.floor(nextValue.length * 0.8));
  }
  return nextValue;
}

async function loadCollection(name: string): Promise<WorkflowRecord[]> {
  const snapshot = await getDocs(collection(db, name));
  return snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id }));
}

function base64ToBlob(contentBase64: string, contentType: string) {
  const binary = atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: contentType || 'application/octet-stream' });
}

async function uploadSyncedEmailAttachments(messageId: string, email: SyncedInboundEmail) {
  const attachments = Array.isArray(email.attachments) ? email.attachments : [];
  if (attachments.length === 0) return [];

  const uploadedAttachments: StoredDocumentEntry[] = [];
  const fromEmail = cleanText(email.fromEmail).toLowerCase();

  for (const attachment of attachments) {
    const name = cleanText(attachment.name) || 'anhang';
    const contentBase64 = cleanText(attachment.contentBase64);
    if (!contentBase64) continue;

    const contentType = cleanText(attachment.contentType) || 'application/octet-stream';
    const blob = base64ToBlob(contentBase64, contentType);
    const safeName = sanitizeStorageFileName(name);
    const storagePath = `message-attachments/${messageId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, blob, { contentType });

    uploadedAttachments.push({
      category: 'Mailanhang',
      contentType,
      name,
      path: storagePath,
      size: Number(attachment.size) || blob.size,
      source: 'mail',
      uploadedAt: new Date().toISOString(),
      uploadedByEmail: fromEmail,
      url: await getDownloadURL(storageRef),
    });
  }

  return uploadedAttachments;
}

export async function persistInboundEmailsClient(emails: SyncedInboundEmail[]) {
  if (!emails.length) {
    return { count: 0 };
  }

  const [tenants, properties, people] = await Promise.all([
    loadCollection('tenants'),
    loadCollection('properties'),
    loadCollection('people'),
  ]);

  let createdCount = 0;

  for (const email of emails) {
    const normalizedMessageId = cleanText(email.messageId);
    const fromEmail = cleanText(email.fromEmail).toLowerCase();
    const externalMessageKey = buildExternalMessageKey({
      fromEmail,
      receivedAt: email.receivedAt,
      subject: email.subject,
      text: email.text,
    });

    if (normalizedMessageId) {
      const existingSnapshot = await getDocs(
        query(collection(db, 'messages'), where('messageId', '==', normalizedMessageId))
      );
      if (!existingSnapshot.empty) {
        const existingDocument = existingSnapshot.docs[0]!;
        const existingAttachments = existingDocument.data().attachments;
        if (!Array.isArray(existingAttachments) || existingAttachments.length === 0) {
          const uploadedAttachments = await uploadSyncedEmailAttachments(existingDocument.id, email);
          if (uploadedAttachments.length > 0) {
            await updateDoc(doc(db, 'messages', existingDocument.id), {
              attachments: uploadedAttachments,
              updatedAt: serverTimestamp(),
            });
            const existingTenantId = cleanText(existingDocument.data().tenantId);
            if (existingTenantId) {
              await updateDoc(doc(db, 'tenants', existingTenantId), {
                tenantDocuments: arrayUnion(...uploadedAttachments),
                updatedAt: serverTimestamp(),
              });
            }
          }
        }
        continue;
      }
    }

    if (externalMessageKey) {
      const deletedSnapshot = await getDocs(
        query(collection(db, 'deletedMessages'), where('externalMessageKey', '==', externalMessageKey))
      );
      if (!deletedSnapshot.empty) {
        continue;
      }

      const existingByExternalKey = await getDocs(
        query(collection(db, 'messages'), where('externalMessageKey', '==', externalMessageKey))
      );
      if (!existingByExternalKey.empty) {
        const existingDocument = existingByExternalKey.docs[0]!;
        const existingAttachments = existingDocument.data().attachments;
        if (!Array.isArray(existingAttachments) || existingAttachments.length === 0) {
          const uploadedAttachments = await uploadSyncedEmailAttachments(existingDocument.id, email);
          if (uploadedAttachments.length > 0) {
            await updateDoc(doc(db, 'messages', existingDocument.id), {
              attachments: uploadedAttachments,
              updatedAt: serverTimestamp(),
            });
            const existingTenantId = cleanText(existingDocument.data().tenantId);
            if (existingTenantId) {
              await updateDoc(doc(db, 'tenants', existingTenantId), {
                tenantDocuments: arrayUnion(...uploadedAttachments),
                updatedAt: serverTimestamp(),
              });
            }
          }
        }
        continue;
      }
    }

    if (normalizedMessageId) {
      const deletedByMessageId = await getDocs(
        query(collection(db, 'deletedMessages'), where('messageId', '==', normalizedMessageId))
      );
      if (!deletedByMessageId.empty) {
        continue;
      }
    }

    const tenant =
      tenants.find((record) => cleanText(record.data.email).toLowerCase() === fromEmail) ?? null;

    const bodyHtml = cleanText(email.html);
    const limitedBodyHtml = limitForFirestoreField(bodyHtml);
    const bodyText = cleanText(email.text).slice(0, MAX_BODY_TEXT_CHARS);

    const messageRef = await addDoc(collection(db, 'messages'), {
      analysis: null,
      attachments: [],
      bodyHtml: limitedBodyHtml,
      bodyHtmlTruncated: bodyHtml.length > limitedBodyHtml.length,
      bodyText,
      category: '',
      channel: 'email',
      createdAt: serverTimestamp(),
      direction: 'inbound',
      externalMessageKey,
      fromEmail,
      fromName: cleanText(email.fromName) || cleanText(email.from) || fromEmail,
      messageId: normalizedMessageId,
      priority: 'normal',
      propertyId: cleanText(tenant?.data.propertyId),
      rawRecipient: cleanText(email.to),
      receivedAt: email.receivedAt || serverTimestamp(),
      status: tenant ? 'new' : 'needs_review',
      subject: cleanText(email.subject) || 'Eingehende E-Mail',
      tenantId: tenant?.id ?? '',
      ticketId: '',
      toEmail: cleanText(email.to),
      unitId: cleanText(tenant?.data.unitId),
      updatedAt: serverTimestamp(),
    });
    const uploadedAttachments = await uploadSyncedEmailAttachments(messageRef.id, email);
    if (uploadedAttachments.length > 0) {
      await updateDoc(doc(db, 'messages', messageRef.id), {
        attachments: uploadedAttachments,
        updatedAt: serverTimestamp(),
      });
      if (tenant?.id) {
        await updateDoc(doc(db, 'tenants', tenant.id), {
          tenantDocuments: arrayUnion(...uploadedAttachments),
          updatedAt: serverTimestamp(),
        });
      }
    }

    const messageRecord: WorkflowRecord = {
      id: messageRef.id,
      data: {
        bodyText,
        category: '',
        fromEmail,
        fromName: cleanText(email.fromName) || cleanText(email.from) || fromEmail,
        priority: 'normal',
        propertyId: cleanText(tenant?.data.propertyId),
        subject: cleanText(email.subject) || 'Eingehende E-Mail',
        tenantId: tenant?.id ?? '',
        unitId: cleanText(tenant?.data.unitId),
      } as DocumentData,
    };

    const analysis = inferMessageAnalysis(messageRecord.data, tenants, properties, people);
    await updateDoc(doc(db, 'messages', messageRef.id), {
      analysis,
      status: analysis.needsReview ? 'needs_review' : 'new',
      updatedAt: serverTimestamp(),
      workflowPreparedAt: serverTimestamp(),
    });

    createdCount += 1;
  }

  return { count: createdCount };
}
