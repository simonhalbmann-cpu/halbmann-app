import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function readServiceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const parsed = JSON.parse(json) as {
      clientEmail?: string;
      client_email?: string;
      privateKey?: string;
      private_key?: string;
      projectId?: string;
      project_id?: string;
    };
    return {
      clientEmail: parsed.clientEmail ?? parsed.client_email,
      privateKey: parsed.privateKey ?? parsed.private_key,
      projectId: parsed.projectId ?? parsed.project_id,
    };
  }

  return {
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    projectId: process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  };
}

export function hasFirebaseAdminConfig() {
  const serviceAccount = readServiceAccount();
  return Boolean(
    serviceAccount.clientEmail &&
      serviceAccount.privateKey &&
      serviceAccount.projectId
  );
}

function getAdminApp() {
  if (getApps().length) {
    return getApps()[0]!;
  }

  const serviceAccount = readServiceAccount();
  if (!serviceAccount.clientEmail || !serviceAccount.privateKey || !serviceAccount.projectId) {
    throw new Error(
      'Firebase Admin ist nicht konfiguriert. Setze FIREBASE_SERVICE_ACCOUNT_JSON oder FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY und FIREBASE_PROJECT_ID.'
    );
  }

  return initializeApp({
    credential: cert({
      clientEmail: serviceAccount.clientEmail,
      privateKey: serviceAccount.privateKey,
      projectId: serviceAccount.projectId,
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminStorageBucket() {
  return getStorage(getAdminApp()).bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
}
