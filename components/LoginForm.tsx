'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '../lib/firebase';
import {
  ensureUserProfile,
  getDefaultRouteForRole,
  type UserRole,
} from '../lib/auth';

type LoginFormProps = {
  intendedRole: UserRole;
};

const firebaseErrorMessages: Record<string, string> = {
  'auth/user-not-found': 'Benutzer nicht gefunden.',
  'auth/wrong-password': 'Passwort ist falsch.',
  'auth/invalid-email': 'Bitte geben Sie eine gueltige E-Mail-Adresse ein.',
  'auth/invalid-credential': 'Benutzername oder Passwort sind nicht korrekt.',
  'auth/too-many-requests':
    'Zu viele Versuche. Bitte warten Sie einen Moment und versuchen Sie es erneut.',
};

export default function LoginForm({ intendedRole }: LoginFormProps) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const identifierInputId = `${intendedRole}-login-identifier`;
  const passwordInputId = `${intendedRole}-login-password`;
  const identifierAutocomplete = `section-${intendedRole} username`;
  const passwordAutocomplete = `section-${intendedRole} current-password`;

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(auth, identifier.trim(), password);
      const profile = await ensureUserProfile({
        uid: credential.user.uid,
        email: credential.user.email,
        intendedRole,
      });

      if (!profile || profile.role !== intendedRole) {
        await signOut(auth);
        setError('Dieser Zugang ist nicht als Verwalterkonto freigeschaltet.');
        return;
      }

      router.push(getDefaultRouteForRole(profile.role));
    } catch (caughtError) {
      const authCode =
        typeof caughtError === 'object' &&
        caughtError !== null &&
        'code' in caughtError &&
        typeof caughtError.code === 'string'
          ? caughtError.code
          : '';
      const genericMessage =
        caughtError instanceof Error
          ? caughtError.message || 'Die Anmeldung ist fehlgeschlagen.'
          : 'Die Anmeldung ist fehlgeschlagen.';

      setError(firebaseErrorMessages[authCode] ?? genericMessage);
      console.error('Login fehlgeschlagen:', caughtError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleLogin}>
      <div className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">E-Mail</span>
          <input
            autoComplete={identifierAutocomplete}
            className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
            id={identifierInputId}
            inputMode="email"
            name={identifierInputId}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="E-Mail angeben"
            required
            type="email"
            value={identifier}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Passwort</span>
          <div className="relative">
            <input
              autoComplete={passwordAutocomplete}
              className="hide-password-reveal w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 pr-20 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              id={passwordInputId}
              name={passwordInputId}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Passwort eingeben"
              required
              type={showPassword ? 'text' : 'password'}
              value={password}
            />
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs font-medium text-slate-500 transition hover:text-slate-900"
              onClick={() => setShowPassword((current) => !current)}
              type="button"
            >
              {showPassword ? 'Verbergen' : 'Anzeigen'}
            </button>
          </div>
        </label>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <button
        className="w-full rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-5 py-3 text-sm font-semibold text-stone-100 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading}
        type="submit"
      >
        {loading ? 'Prueft Zugang...' : 'Anmelden'}
      </button>
    </form>
  );
}
