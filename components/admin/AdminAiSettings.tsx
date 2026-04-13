'use client';

import { useEffect, useState, useTransition } from 'react';
import { useAuth } from '../../hooks/useAuth';

type FormState = {
  globalInstruction: string;
  toneInstruction: string;
};

function emptyForm(): FormState {
  return {
    globalInstruction: '',
    toneInstruction: '',
  };
}

function InputBlock({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="block">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <textarea
        className="mt-2 min-h-[160px] w-full rounded-[24px] border border-stone-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-700/60"
        lang="de"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        value={value}
      />
    </label>
  );
}

export default function AdminAiSettings() {
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
        const response = await authorizedFetch('/api/admin/ai-settings');
        const result = (await response.json()) as {
          error?: string;
          ok?: boolean;
          settings?: Partial<FormState>;
        };
        if (!response.ok || !result.ok) {
          throw new Error(result.error || 'ai_settings_load_failed');
        }
        setForm({
          globalInstruction: result.settings?.globalInstruction?.trim() || '',
          toneInstruction: result.settings?.toneInstruction?.trim() || '',
        });
      } catch (caughtError) {
        console.error('Fehler beim Laden der KI-Einstellungen:', caughtError);
        setError(
          caughtError instanceof Error ? caughtError.message : 'Die KI-Einstellungen konnten nicht geladen werden.'
        );
      }
    });
  }, [user]);

  function saveSettings() {
    setMessage('');
    setError('');
    startTransition(async () => {
      try {
        const response = await authorizedFetch('/api/admin/ai-settings', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        const result = (await response.json()) as { error?: string; ok?: boolean };
        if (!response.ok || !result.ok) {
          throw new Error(result.error || 'ai_settings_save_failed');
        }
        setMessage('Die KI-Einstellungen wurden gespeichert.');
      } catch (caughtError) {
        console.error('Fehler beim Speichern der KI-Einstellungen:', caughtError);
        setError(
          caughtError instanceof Error ? caughtError.message : 'Die KI-Einstellungen konnten nicht gespeichert werden.'
        );
      }
    });
  }

  function resetSettings() {
    setMessage('');
    setError('');
    startTransition(async () => {
      try {
        const response = await authorizedFetch('/api/admin/ai-settings', { method: 'DELETE' });
        const result = (await response.json()) as { error?: string; ok?: boolean };
        if (!response.ok || !result.ok) {
          throw new Error(result.error || 'ai_settings_delete_failed');
        }
        setForm(emptyForm());
        setMessage('Die KI-Einstellungen wurden zurückgesetzt.');
      } catch (caughtError) {
        console.error('Fehler beim Zurücksetzen der KI-Einstellungen:', caughtError);
        setError(
          caughtError instanceof Error ? caughtError.message : 'Die KI-Einstellungen konnten nicht gelöscht werden.'
        );
      }
    });
  }

  return (
    <section className="rounded-[32px] border border-stone-200 bg-white p-6 shadow-[0_28px_70px_-42px_rgba(148,119,77,0.28)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">KI</p>
      <h2 className="mt-2 text-3xl text-slate-950">KI-Antwortstil</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
        Hier legst du fest, wie die KI grundsätzlich antworten soll. Diese Vorgaben gelten für
        Nachrichten und Tickets. Zusätzlich kannst du im jeweiligen Composer weiter einen
        situationsbezogenen KI-Hinweis mitgeben.
      </p>

      <div className="mt-6 grid gap-5">
        <InputBlock
          label="Globale Vorgabe"
          onChange={(value) => setForm((current) => ({ ...current, globalInstruction: value }))}
          placeholder="z. B. Antworte knapp, professionell, klar und ohne unnötige Floskeln. Sprich Mieter freundlich an, nenne den nächsten Schritt und erfinde keine Fakten."
          value={form.globalInstruction}
        />
        <InputBlock
          label="Ton und Stil"
          onChange={(value) => setForm((current) => ({ ...current, toneInstruction: value }))}
          placeholder="z. B. Gegenüber Mietern verbindlich und freundlich, gegenüber Gewerken präzise und handlungsorientiert."
          value={form.toneInstruction}
        />
      </div>

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
          Zurücksetzen
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
