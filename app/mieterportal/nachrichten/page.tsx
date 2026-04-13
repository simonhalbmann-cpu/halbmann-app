'use client';

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { auth, db } from '../../../lib/firebase';
import { PORTAL_INBOX_EMAIL } from '../../../lib/mailbox';

type TenantRecord = {
  data: DocumentData;
  id: string;
};

type MessageRecord = {
  data: DocumentData;
  id: string;
};

type CategoryOption = {
  label: string;
  value: string;
};

const categoryOptions: CategoryOption[] = [
  { label: 'Automatisch erkennen', value: '' },
  { label: 'Schaden', value: 'damage' },
  { label: 'Heizung', value: 'heating' },
  { label: 'Elektrik', value: 'electrical' },
  { label: 'Wasser / Sanitär', value: 'plumbing' },
  { label: 'Abrechnung', value: 'billing' },
  { label: 'Kündigung', value: 'termination' },
  { label: 'Allgemeine Frage', value: 'general' },
];

const cleanText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

function formatDateTime(value: unknown) {
  const text = cleanText(value);
  if (text) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
    }
  }

  if (
    typeof value === 'object' &&
    value &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toLocaleString('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  return 'Gerade eben';
}

function formatSenderLabel(message: MessageRecord) {
  if (cleanText(message.data.direction) === 'outbound') {
    return 'Halbmann Verwaltung';
  }
  return cleanText(message.data.fromName) || cleanText(message.data.fromEmail) || 'Ihre Nachricht';
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft_ready: 'Entwürfe in Vorbereitung',
    new: 'Neu eingegangen',
    needs_review: 'In Prüfung',
    ticket_created: 'Ticket angelegt',
  };
  return labels[status] ?? 'In Bearbeitung';
}

export default function NachrichtenPage() {
  const { loading, user } = useAuth();
  const [tenant, setTenant] = useState<TenantRecord | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!user?.email) {
      setTenant(null);
      return;
    }

    return onSnapshot(
      query(collection(db, 'tenants'), where('email', '==', user.email)),
      (snapshot) => {
        const firstMatch = snapshot.docs[0];
        if (!firstMatch) {
          setTenant(null);
          return;
        }

        setTenant({ data: firstMatch.data(), id: firstMatch.id });
      },
      (caughtError) => {
        console.error('Fehler beim Laden des Mieters im Portal:', caughtError);
        setError('Ihre Mieterdaten konnten nicht geladen werden.');
      }
    );
  }, [user?.email]);

  useEffect(() => {
    if (!tenant?.id) {
      setMessages([]);
      return;
    }

    return onSnapshot(
      query(collection(db, 'messages'), where('tenantId', '==', tenant.id), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setMessages(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id })));
      },
      (caughtError) => {
        console.error('Fehler beim Laden der Portal-Nachrichten:', caughtError);
        setError('Die Nachrichten konnten nicht geladen werden.');
      }
    );
  }, [tenant?.id]);

  const tenantLabel = useMemo(() => {
    if (!tenant) return '';
    return (
      [cleanText(tenant.data.firstName), cleanText(tenant.data.lastName)].filter(Boolean).join(' ') ||
      cleanText(tenant.data.companyName)
    );
  }, [tenant]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.email || !tenant) {
      setError('Ihre Zuordnung zum Mietverhältnis fehlt noch.');
      return;
    }
    if (!bodyText.trim()) {
      setError('Bitte beschreiben Sie Ihr Anliegen.');
      return;
    }

    setError('');
    setMessage('');

    startTransition(async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const response = await fetch('/api/portal/messages', {
          body: JSON.stringify({
            bodyText: bodyText.trim(),
            category: category || '',
            subject: subject.trim() || 'Nachricht aus dem Mieterportal',
          }),
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
          method: 'POST',
        });
        const result = (await response.json()) as { error?: string; ok?: boolean };
        if (!response.ok || !result.ok) {
          throw new Error(result.error || 'portal_message_create_failed');
        }

        setSubject('');
        setBodyText('');
        setCategory('');
        setMessage('Ihre Nachricht wurde an die Verwaltung übermittelt. Ticket und Entwürfe werden intern vorbereitet.');
      } catch (caughtError) {
        console.error('Fehler beim Senden der Portal-Nachricht:', caughtError);
        setError('Die Nachricht konnte nicht gesendet werden.');
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Nachrichten</p>
        <h2 className="mt-3 text-4xl text-slate-950">Mit der Verwaltung schreiben</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          Schreiben Sie Ihr Anliegen einfach frei. Die Verwaltung erkennt das Thema automatisch und ordnet die
          Nachricht intern dem passenden Objekt, der Einheit und dem richtigen Vorgang zu.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Neue Nachricht</p>
              <h3 className="mt-2 text-2xl text-slate-950">Anliegen senden</h3>
            </div>
            {tenant ? (
              <div className="rounded-[18px] border border-stone-200 bg-stone-50 px-4 py-3 text-right text-xs leading-6 text-slate-600">
                <div className="font-medium text-slate-900">{tenantLabel || 'Mieter'}</div>
                <div>{cleanText(tenant.data.propertyLabel) || cleanText(tenant.data.propertyId) || 'Objekt wird erkannt'}</div>
                <div>{cleanText(tenant.data.unitLabel) || cleanText(tenant.data.unitId) || 'Einheit wird erkannt'}</div>
              </div>
            ) : null}
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Betreff</span>
                <input
                  className="w-full rounded-[18px] border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="z. B. Heizung im Bad wird nicht warm"
                  value={subject}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Kategorie optional</span>
                <select
                  className="w-full rounded-[18px] border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                  onChange={(event) => setCategory(event.target.value)}
                  value={category}
                >
                  {categoryOptions.map((option) => (
                    <option key={option.value || 'auto'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Nachricht</span>
              <textarea
                className="min-h-[220px] w-full rounded-[24px] border border-stone-300 bg-stone-50 px-4 py-4 text-sm leading-7 text-slate-900 outline-none transition focus:border-amber-700/60"
                onChange={(event) => setBodyText(event.target.value)}
                placeholder="Beschreiben Sie bitte möglichst konkret, worum es geht. Fotos und Anhänge ergänzen wir im nächsten Schritt."
                value={bodyText}
              />
            </label>

            {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
            {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-2xl text-xs leading-6 text-slate-500">
                Falls Sie keine Kategorie auswählen, wird Ihr Anliegen automatisch aus dem Text erkannt.
              </p>
              <button
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading || isPending || !tenant}
                type="submit"
              >
                {isPending ? 'Wird gesendet...' : 'Nachricht senden'}
              </button>
            </div>
          </form>
        </section>

        <section className="space-y-4">
          <div className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Hinweis</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Alternativ können Sie künftig auch per E-Mail an <span className="font-medium text-slate-900">{PORTAL_INBOX_EMAIL}</span> schreiben.
              Beide Wege laufen intern im selben Vorgang zusammen.
            </p>
          </div>

          <div className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Verlauf</p>
                <h3 className="mt-2 text-2xl text-slate-950">Bisherige Nachrichten</h3>
              </div>
              <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-xs text-slate-600">
                {messages.length} Einträge
              </div>
            </div>

            {messages.length === 0 ? (
              <div className="mt-5 rounded-[22px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm leading-7 text-slate-600">
                Bisher liegen noch keine Nachrichten im Portal vor.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {messages.map((entry) => {
                  const outbound = cleanText(entry.data.direction) === 'outbound';
                  return (
                    <article
                      className={`rounded-[22px] border p-4 ${
                        outbound
                          ? 'border-amber-200 bg-amber-50/60'
                          : 'border-stone-200 bg-stone-50'
                      }`}
                      key={entry.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-950">{cleanText(entry.data.subject) || 'Ohne Betreff'}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatSenderLabel(entry)}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500">{formatDateTime(entry.data.createdAt ?? entry.data.receivedAt)}</div>
                          <div className="mt-1 text-xs font-medium text-amber-800">
                            {getStatusLabel(cleanText(entry.data.status))}
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                        {cleanText(entry.data.bodyText) || 'Kein Inhalt vorhanden.'}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
