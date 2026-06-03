import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import type { PortalTargetType } from './portalAccess';

export type UserRole = 'admin' | 'portal';

export type UserProfile = {
  authEmail?: string | null;
  contactEmail?: string | null;
  displayName?: string | null;
  email: string | null;
  role: UserRole;
  targetId?: string | null;
  targetType?: PortalTargetType | null;
  username?: string | null;
};

const USER_PROFILES_COLLECTION = 'userProfiles';

function parseUserProfile(data: DocumentData | undefined): UserProfile | null {
  if (!data) {
    return null;
  }

  if (data.role !== 'admin' && data.role !== 'portal') {
    return null;
  }

  return {
    authEmail: typeof data.authEmail === 'string' ? data.authEmail : null,
    contactEmail: typeof data.contactEmail === 'string' ? data.contactEmail : null,
    displayName: typeof data.displayName === 'string' ? data.displayName : null,
    email: typeof data.email === 'string' ? data.email : null,
    role: data.role,
    targetId: typeof data.targetId === 'string' ? data.targetId : null,
    targetType:
      data.targetType === 'tenant' || data.targetType === 'contact'
        ? data.targetType
        : null,
    username: typeof data.username === 'string' ? data.username : null,
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
        authEmail: email,
        email,
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return existingProfile;
  }

  return null;
}

export function getDefaultRouteForRole(role: UserRole) {
  return role === 'admin' ? '/admin' : '/mieterportal/nachrichten';
}

export function getLoginRouteForRole(role: UserRole) {
  return role === 'admin' ? '/login' : '/';
}

export function getRoleLabel(role: UserRole) {
  return role === 'admin' ? 'Verwalter' : 'Portal';
}
