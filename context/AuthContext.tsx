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
    async function loadLocalPortalSession() {
      try {
        const response = await fetch('/api/portal-local/session');
        const result = (await response.json()) as {
          ok?: boolean;
          profile?: UserProfile | null;
        };

        if (response.ok && result.ok && result.profile) {
          setUser(null);
          setProfile(result.profile);
          setRole(result.profile.role);
          setLoading(false);
          return true;
        }
      } catch (caughtError) {
        console.error('Lokale Portalsitzung konnte nicht geladen werden:', caughtError);
      }

      setUser(null);
      setProfile(null);
      setRole(null);
      setLoading(false);
      return false;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        setError(null);

        if (!currentUser) {
          await loadLocalPortalSession();
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

    function handlePortalSessionChanged() {
      setLoading(true);
      void loadLocalPortalSession();
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('portal-local-session-changed', handlePortalSessionChanged);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('portal-local-session-changed', handlePortalSessionChanged);
      }
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ error, loading, profile, refreshProfile, role, user }}>
      {children}
    </AuthContext.Provider>
  );
}
