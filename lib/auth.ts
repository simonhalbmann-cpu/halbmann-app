import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from 'firebase/firestore';
import {
  getDefaultAdminLevel,
  normalizeAdminPermissions,
  type AdminLevel,
  type AdminPermissions,
} from './adminPermissions';
import { db } from './firebase';

export type UserRole = 'admin';

export type UserProfile = {
  adminLevel?: AdminLevel | null;
  adminPermissions?: AdminPermissions | null;
  authEmail?: string | null;
  contactEmail?: string | null;
  displayName?: string | null;
  email: string | null;
  mobilePhone?: string | null;
  phone?: string | null;
  role: UserRole;
  username?: string | null;
};

const USER_PROFILES_COLLECTION = 'userProfiles';

function parseUserProfile(data: DocumentData | undefined): UserProfile | null {
  if (!data) {
    return null;
  }

  if (data.role !== 'admin') {
    return null;
  }

  const adminLevel = getDefaultAdminLevel(data.adminLevel, 'super_admin');

  return {
    adminLevel,
    adminPermissions: normalizeAdminPermissions(data.adminPermissions, adminLevel === 'super_admin'),
    authEmail: typeof data.authEmail === 'string' ? data.authEmail : null,
    contactEmail: typeof data.contactEmail === 'string' ? data.contactEmail : null,
    displayName: typeof data.displayName === 'string' ? data.displayName : null,
    email: typeof data.email === 'string' ? data.email : null,
    mobilePhone: typeof data.mobilePhone === 'string' ? data.mobilePhone : null,
    phone: typeof data.phone === 'string' ? data.phone : null,
    role: data.role,
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
  return '/admin';
}

export function getLoginRouteForRole(role: UserRole) {
  return '/login';
}

export function getRoleLabel(role: UserRole) {
  return 'Verwalter';
}
