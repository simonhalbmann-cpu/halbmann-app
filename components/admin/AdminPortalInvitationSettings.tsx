'use client';

import { useEffect, useState, useTransition } from 'react';
import { useAuth } from '../../hooks/useAuth';

type FormState = {
  bodyTemplate: string;
  subject: string;
};

function emptyForm(): FormState {
  return {
    bodyTemplate: '',
    subject: '',
  };
}

export default function AdminPortalInvitationSettings() {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  async function authorizedFetch(url: string, init?: RequestInit) {
    if (!user) throw new Error('Du bist nicht angemeldet.');
    const token = await user.getIdToken();
    return fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
  }

  useEffect(() => {
    if (!user) return;
    startTransition(async () => {
      try {
        const response = await authorizedFetch('/api/admin/portal-invitation-settings');
        const result = (await response.json()) as {
          error?: string;
          ok?: boolean;
          settings?: Partial<FormState>;
        };
        if (!response.ok || !result.ok) {
          throw new Error(result.error || 'portal_invitation_settings_load_failed');
        }
        setForm({
          bodyTemplate: result.settings?.bodyTemplate?.trim() || '',
          subject: result.settings?.subject?.trim() || '',
        });
      } catch (caughtError) {
        console.error('Fehler beim Laden der Einladungsmail:', caughtError);
        setError(
          caughtError instanceof Error ? caughtError.message : 'Die Einladungsmail konnte nicht geladen werden.'
        );
      }
    });
  }, [user]);

  function saveSettings() {
    setMessage('');
    setError('');
    startTransition(async () => {
      try {
        const response = await authorizedFetch('/api/admin/portal-invitation-settings', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        const result = (await response.json()) as { error?: string; ok?: boolean };
        if (!response.ok || !result.ok) {
          throw new Error(result.error || 'portal_invitation_settings_save_failed');
        }
        setMessage('Die Einladungsmail wurde gespeichert.');
      } catch (caughtError) {
        console.error('Fehler beim Speichern der Einladungsmail:', caughtError);
        setError(
          caughtError instanceof Error ? caughtError.message : 'Die Einladungsmail konnte nicht gespeichert werden.'
        );
      }
    });
  }

  function resetSettings() {
    setMessage('');
    setError('');
    startTransition(async () => {
      try {
        const response = await authorizedFetch('/api/admin/portal-invitation-settings', { method: 'DELETE' });
        const result = (await response.json()) as {
          error?: string;
          ok?: boolean;
          settings?: Partial<FormState>;
        };
        if (!response.ok || !result.ok) {
          throw new Error(result.error || 'portal_invitation_settings_delete_failed');
        }
        setForm({
          bodyTemplate: result.settings?.bodyTemplate?.trim() || '',
          subject: result.settings?.subject?.trim() || '',
        });
        setMessage('Die Einladungsmail wurde auf den Standard zurückgesetzt.');
      } catch (caughtError) {
        console.error('Fehler beim Zurücksetzen der Einladungsmail:', caughtError);
        setError(
          caughtError instanceof Error ? caughtError.message : 'Die Einladungsmail konnte nicht zurückgesetzt werden.'
        );
      }
    });
  }

  return (
    <section className="rounded-[32px] border border-stone-200 bg-white p-6 shadow-[0_28px_70px_-42px_rgba(148,119,77,0.28)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Portal</p>
      <h2 className="mt-2 text-3xl text-slate-950">Einladungsmail</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
        Diese Mail wird beim Versand der Portaleinladung genutzt. Du kannst den Text frei anpassen.
        Platzhalter bleiben beim Versand erhalten und werden automatisch ersetzt.
      </p>

      <div className="mt-4 rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-7 text-slate-600">
        <p className="font-medium text-slate-900">Verfügbare Platzhalter</p>
        <p className="mt-2">
          <code>{'{{GREETING}}'}</code>, <code>{'{{DISPLAY_NAME}}'}</code>, <code>{'{{USERNAME}}'}</code>,{' '}
          <code>{'{{PASSWORD}}'}</code>, <code>{'{{LOGIN_URL}}'}</code>, <code>{'{{PORTAL_EXPLANATION}}'}</code>,{' '}
          <code>{'{{SIGNATURE}}'}</code>
        </p>
      </div>

      <label className="mt-6 block">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Betreff</p>
        <input
          className="mt-2 w-full rounded-[24px] border border-stone-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-700/60"
          onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
          placeholder="Ihr Zugang zum Halbmann Portal"
          value={form.subject}
        />
      </label>

      <label className="mt-5 block">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Mailtext</p>
        <textarea
          className="mt-2 min-h-[360px] w-full rounded-[24px] border border-stone-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-700/60"
          lang="de"
          onChange={(event) => setForm((current) => ({ ...current, bodyTemplate: event.target.value }))}
          spellCheck={false}
          value={form.bodyTemplate}
        />
      </label>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className="rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-5 py-2.5 text-sm font-medium text-stone-100 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          onClick={saveSettings}
          type="button"
        >
          Speichern
        </button>
        <button
          className="rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          onClick={resetSettings}
          type="button"
        >
          Standard wiederherstellen
        </button>
      </div>

      {message ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
    </section>
  );
}
