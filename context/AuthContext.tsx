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
  role: UserRole | null;
  user: User | null;
};

export const AuthContext = createContext<AuthContextType>({
  error: null,
  loading: true,
  profile: null,
  role: null,
  user: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ error, loading, profile, role, user }}>
      {children}
    </AuthContext.Provider>
  );
}
