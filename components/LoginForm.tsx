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
import { normalizePortalUsername } from '../lib/portalAccess';

type LoginFormProps = {
  intendedRole: UserRole;
};

const firebaseErrorMessages: Record<string, string> = {
  'auth/user-not-found': 'Benutzer nicht gefunden.',
  'auth/wrong-password': 'Passwort ist falsch.',
  'auth/invalid-email': 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
  'auth/invalid-credential': 'Benutzername oder Passwort sind nicht korrekt.',
  'auth/too-many-requests':
    'Zu viele Versuche. Bitte warten Sie einen Moment und versuchen Sie es erneut.',
};

const portalErrorMessages: Record<string, string> = {
  invalid_local_portal_password: 'Benutzername oder Passwort sind nicht korrekt.',
  local_portal_credentials_missing: 'Bitte geben Sie Benutzername und Passwort ein.',
  portal_auth_not_configured: 'Der Portalzugang ist lokal noch nicht eingerichtet.',
  portal_auth_resolve_failed: 'Der Benutzername konnte nicht aufgelöst werden.',
  portal_user_not_found: 'Zu diesem Benutzernamen wurde kein Portalzugang gefunden.',
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
  const isPortalLogin = intendedRole === 'portal';

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isPortalLogin) {
        const localLoginResponse = await fetch('/api/portal-local/login', {
          body: JSON.stringify({
            password,
            username: identifier,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        });
        const localLoginResult = (await localLoginResponse.json()) as { error?: string; ok?: boolean };

        if (localLoginResponse.ok && localLoginResult.ok) {
          if (typeof window !== 'undefined') {
            window.location.assign(getDefaultRouteForRole('portal'));
          } else {
            router.push(getDefaultRouteForRole('portal'));
          }
          return;
        }
      }

      const authEmail = isPortalLogin
        ? await resolvePortalAuthEmail(identifier)
        : identifier.trim();
      const credential = await signInWithEmailAndPassword(auth, authEmail, password);
      const profile = await ensureUserProfile({
        uid: credential.user.uid,
        email: credential.user.email,
        intendedRole,
      });

      if (!profile || profile.role !== intendedRole) {
        await signOut(auth);
        setError(
          intendedRole === 'admin'
            ? 'Dieser Zugang ist nicht als Verwalterkonto freigeschaltet.'
            : 'Dieses Konto ist nicht für das Portal freigeschaltet.'
        );
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
          ? portalErrorMessages[caughtError.message] || caughtError.message || 'Die Anmeldung ist fehlgeschlagen.'
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
          <span className="text-sm font-medium text-slate-700">
            {isPortalLogin ? 'Benutzername' : 'E-Mail'}
          </span>
          <input
            autoComplete={identifierAutocomplete}
            className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
            id={identifierInputId}
            inputMode={isPortalLogin ? 'text' : 'email'}
            name={identifierInputId}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder={isPortalLogin ? 'Benutzername eingeben' : 'E-Mail angeben'}
            required
            type={isPortalLogin ? 'text' : 'email'}
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
        {loading ? 'Prüft Zugang...' : 'Anmelden'}
      </button>
    </form>
  );
}

async function resolvePortalAuthEmail(username: string) {
  const normalizedUsername = normalizePortalUsername(username);
  if (!normalizedUsername) {
    throw new Error('Bitte geben Sie Ihren Benutzernamen ein.');
  }

  const response = await fetch('/api/portal-auth/resolve', {
    body: JSON.stringify({ username: normalizedUsername }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const result = (await response.json()) as { authEmail?: string; error?: string; ok?: boolean };

  if (!response.ok || !result.ok || !result.authEmail) {
    throw new Error(result.error || 'portal_auth_resolve_failed');
  }

  return result.authEmail;
}
