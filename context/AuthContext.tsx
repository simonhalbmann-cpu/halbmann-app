'use client';

import {
  createContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getUserProfile, type UserProfile, type UserRole } from '../lib/auth';
import { auth } from '../lib/firebase';

type AuthContextType = {
  error: string | null;
  loading: boolean;
  profile: UserProfile | null;
  refreshProfile: () => Promise<void>;
  role: UserRole | null;
  user: User | null;
};

export const AuthContext = createContext<AuthContextType>({
  error: null,
  loading: true,
  profile: null,
  refreshProfile: async () => undefined,
  role: null,
  user: null,
});

function isFirebasePermissionError(value: unknown) {
  const code =
    typeof value === 'object' && value !== null && 'code' in value
      ? (value as { code?: unknown }).code
      : '';
  const message =
    value instanceof Error
      ? value.message
      : typeof value === 'object' && value !== null && 'message' in value
        ? String((value as { message?: unknown }).message ?? '')
        : String(value ?? '');

  return code === 'permission-denied' || message.includes('Missing or insufficient permissions');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshProfile() {
    if (!user) return;
    const nextProfile = await getUserProfile(user.uid);
    setProfile(nextProfile);
    setRole(nextProfile?.role ?? null);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        setError(null);

        if (!currentUser) {
          setUser(null);
          setProfile(null);
          setRole(null);
          setLoading(false);
          return;
        }

        setLoading(true);
        setUser(currentUser);

        try {
          const nextProfile = await getUserProfile(currentUser.uid);
          setProfile(nextProfile);
          setRole(nextProfile?.role ?? null);
        } catch (caughtError) {
          setProfile(null);
          setRole(null);
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Profil konnte nicht geladen werden.'
          );
        } finally {
          setLoading(false);
        }
      },
      (caughtError) => {
        setError(caughtError.message);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      if (!isFirebasePermissionError(event.reason)) return;
      console.warn('Firebase-Berechtigungsfehler wurde abgefangen:', event.reason);
      event.preventDefault();
    }

    function handleError(event: ErrorEvent) {
      if (!isFirebasePermissionError(event.error ?? event.message)) return;
      console.warn('Firebase-Berechtigungsfehler wurde abgefangen:', event.error ?? event.message);
      event.preventDefault();
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ error, loading, profile, refreshProfile, role, user }}>
      {children}
    </AuthContext.Provider>
  );
}
