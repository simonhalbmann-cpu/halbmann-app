import { FieldValue } from 'firebase-admin/firestore';
import {
  inferMessageAnalysis,
  type WorkflowRecord,
} from './adminWorkflow';
import { getAdminDb, hasFirebaseAdminConfig } from './firebaseAdmin';
import {
  getFirestoreDocument,
  listFirestoreCollection,
  setFirestoreDocument,
} from './firestoreRest';

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function readWorkflowCollection(name: string): Promise<WorkflowRecord[]> {
  const snapshot = await getAdminDb().collection(name).get();
  return snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id }));
}

async function readWorkflowCollectionFlexible(name: string, authToken?: string): Promise<WorkflowRecord[]> {
  if (!hasFirebaseAdminConfig()) {
    if (!authToken) {
      throw new Error('auth_token_missing_for_rest_fallback');
    }
    return listFirestoreCollection(name, authToken);
  }

  return readWorkflowCollection(name);
}

export async function ensureWorkflowForMessage(messageId: string, authToken?: string) {
  let message: WorkflowRecord | null = null;

  if (!hasFirebaseAdminConfig()) {
    if (!authToken) {
      throw new Error('auth_token_missing_for_rest_fallback');
    }
    message = await getFirestoreDocument('messages', messageId, authToken);
  } else {
    const messageRef = getAdminDb().collection('messages').doc(messageId);
    const messageSnapshot = await messageRef.get();

    if (!messageSnapshot.exists) {
      throw new Error('message_not_found');
    }

    message = {
      data: messageSnapshot.data() ?? {},
      id: messageSnapshot.id,
    };
  }

  if (!message) {
    throw new Error('message_not_found');
  }

  const [tenants, properties, people] = await Promise.all([
    readWorkflowCollectionFlexible('tenants', authToken),
    readWorkflowCollectionFlexible('properties', authToken),
    readWorkflowCollectionFlexible('people', authToken),
  ]);

  const analysis = inferMessageAnalysis(message.data, tenants, properties, people);
  const nextStatus = cleanText(message.data.status) || (analysis.needsReview ? 'needs_review' : 'new');
  const messageUpdate = {
    analysis,
    status: nextStatus,
    updatedAt: hasFirebaseAdminConfig() ? FieldValue.serverTimestamp() : new Date().toISOString(),
    workflowPreparedAt: hasFirebaseAdminConfig() ? FieldValue.serverTimestamp() : new Date().toISOString(),
  };

  if (hasFirebaseAdminConfig()) {
    await getAdminDb().collection('messages').doc(message.id).set(messageUpdate, { merge: true });
  } else {
    await setFirestoreDocument(
      'messages',
      message.id,
      { ...message.data, ...messageUpdate },
      authToken!
    );
  }

  return {
    messageId,
    skipped: false,
    ticketId: cleanText(message.data.ticketId),
  };
}
