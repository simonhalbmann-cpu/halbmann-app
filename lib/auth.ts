import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';

export type UserRole = 'admin' | 'tenant';

export type UserProfile = {
  email: string | null;
  role: UserRole;
};

const USER_PROFILES_COLLECTION = 'userProfiles';

function parseUserProfile(data: DocumentData | undefined): UserProfile | null {
  if (!data) {
    return null;
  }

  if (data.role !== 'admin' && data.role !== 'tenant') {
    return null;
  }

  return {
    email: typeof data.email === 'string' ? data.email : null,
    role: data.role,
  };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(db, USER_PROFILES_COLLECTION, uid));
  return parseUserProfile(snapshot.data());
}

type EnsureUserProfileArgs = {
  email: string | null;
  intendedRole: UserRole;
  uid: string;
};

export async function ensureUserProfile({
  email,
  intendedRole,
  uid,
}: EnsureUserProfileArgs): Promise<UserProfile | null> {
  const reference = doc(db, USER_PROFILES_COLLECTION, uid);
  const existingSnapshot = await getDoc(reference);
  const existingProfile = parseUserProfile(existingSnapshot.data());

  if (existingProfile) {
    await setDoc(
      reference,
      {
        email,
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return existingProfile;
  }

  if (intendedRole !== 'tenant') {
    return null;
  }

  const createdProfile: UserProfile = {
    email,
    role: 'tenant',
  };

  await setDoc(
    reference,
    {
      ...createdProfile,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return createdProfile;
}

export function getDefaultRouteForRole(role: UserRole) {
  return role === 'admin' ? '/admin' : '/mieterportal';
}

export function getLoginRouteForRole(role: UserRole) {
  return role === 'admin' ? '/login' : '/';
}

export function getRoleLabel(role: UserRole) {
  return role === 'admin' ? 'Verwalter' : 'Mieter';
}
