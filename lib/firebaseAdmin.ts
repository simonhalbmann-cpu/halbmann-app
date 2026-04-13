import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function readServiceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const parsed = JSON.parse(json) as {
      clientEmail?: string;
      privateKey?: string;
      projectId?: string;
    };
    return {
      clientEmail: parsed.clientEmail,
      privateKey: parsed.privateKey,
      projectId: parsed.projectId,
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
  });
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}
