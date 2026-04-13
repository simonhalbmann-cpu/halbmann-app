'use client';

import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  doc,
  type DocumentData,
} from 'firebase/firestore';
import {
  inferMessageAnalysis,
  type WorkflowRecord,
} from './adminWorkflow';
import { db } from './firebase';
import { buildExternalMessageKey } from './mailIdentity';

export type SyncedInboundEmail = {
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

async function loadCollection(name: string): Promise<WorkflowRecord[]> {
  const snapshot = await getDocs(collection(db, name));
  return snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id }));
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

    const messageRef = await addDoc(collection(db, 'messages'), {
      analysis: null,
      attachments: [],
      bodyHtml: cleanText(email.html),
      bodyText: cleanText(email.text),
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

    const messageRecord: WorkflowRecord = {
      id: messageRef.id,
      data: {
        bodyText: cleanText(email.text),
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
