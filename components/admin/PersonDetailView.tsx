'use client';

import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, type DocumentData } from 'firebase/firestore';
import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { formatDateTime, formatTimestampSort, type WorkflowRecord } from '../../lib/adminWorkflow';
import { db } from '../../lib/firebase';
import { composePortalDraft } from '../../lib/draftComposer';
import { personDocumentFields } from './personConfig';
import { buildPortalSignatureText, createSignatureRecord, mergeBodyWithSignature } from '../../lib/signatures';

type PersonDetailViewProps = {
  personId: string;
};

type PersonData = Record<string, string>;

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function stripTrailingSignature(body: string, signatureText: string) {
  if (!signatureText) return body.trim();
  const trimmedBody = body.trimEnd();
  return trimmedBody.endsWith(signatureText)
    ? trimmedBody.slice(0, trimmedBody.length - signatureText.length).trimEnd()
    : trimmedBody;
}

function formatValue(value?: string) {
  return cleanText(value) || '–';
}

export default function PersonDetailView({ personId }: PersonDetailViewProps) {
  const { user } = useAuth();
  const [person, setPerson] = useState<PersonData | null>(null);
  const [messages, setMessages] = useState<WorkflowRecord[]>([]);
  const [companies, setCompanies] = useState<WorkflowRecord[]>([]);
  const [properties, setProperties] = useState<WorkflowRecord[]>([]);
  const [replyText, setReplyText] = useState('');
  const [aiInstruction, setAiInstruction] = useState('');
  const [contextMode, setContextMode] = useState<'new' | 'reply'>('reply');
  const [followUpDate, setFollowUpDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'people', personId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setPerson(null);
          setError('Der Kontakt wurde nicht gefunden.');
          setIsLoading(false);
          return;
        }

        const data = Object.fromEntries(
          Object.entries(snapshot.data()).map(([key, value]) => [key, String(value ?? '')])
        );

        setPerson(data);
        setError('');
        setIsLoading(false);
      },
      (caughtError) => {
        console.error(`Fehler beim Laden des Kontakts ${personId}:`, caughtError);
        setError('Die Kontaktdaten konnten nicht geladen werden.');
        setIsLoading(false);
      }
    );

    const unsubscribeCompanies = onSnapshot(query(collection(db, 'companies')), (snapshot) => {
      setCompanies(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id })));
    });
    const unsubscribeProperties = onSnapshot(query(collection(db, 'properties')), (snapshot) => {
      setProperties(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id })));
    });
    const unsubscribeMessages = onSnapshot(
      query(collection(db, 'messages')),
      (snapshot) => {
        setMessages(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id })));
      },
      (caughtError) => {
        console.error(`Fehler beim Laden des Chatverlaufs für Kontakt ${personId}:`, caughtError);
      }
    );

    return () => {
      unsubscribe();
      unsubscribeCompanies();
      unsubscribeProperties();
      unsubscribeMessages();
    };
  }, [personId]);

  const availableDocuments = useMemo(() => {
    if (!person) return [];
    return personDocumentFields.filter((field) => cleanText(person[field.name]).length > 0);
  }, [person]);

  const personMessages = useMemo(
    () =>
      messages
        .filter((entry) => {
          const recipientId = cleanText(entry.data.recipientId);
          const contactId =
            entry.data.analysis && typeof entry.data.analysis === 'object'
              ? cleanText((entry.data.analysis as Record<string, unknown>).contactId)
              : '';
          const fromEmail = cleanText(entry.data.fromEmail).toLowerCase();
          return recipientId === personId || contactId === personId || fromEmail === cleanText(person?.email).toLowerCase();
        })
        .sort(
          (left, right) =>
            formatTimestampSort(right.data.receivedAt ?? right.data.createdAt) -
            formatTimestampSort(left.data.receivedAt ?? left.data.createdAt)
        ),
    [messages, person?.email, personId]
  );
  const selectedProperty =
    properties.find((entry) => cleanText(entry.data.name) === cleanText(person?.propertyName)) ?? null;
  const selectedCompany =
    companies.find((entry) => cleanText(entry.id) === cleanText(selectedProperty?.data.ownerId)) ??
    companies.find((entry) => cleanText(entry.data.name) === cleanText(person?.partnerCompanyName || person?.companyName)) ??
    null;
  const portalSignature = buildPortalSignatureText(
    createSignatureRecord((selectedCompany?.data as Record<string, unknown>) ?? null)
  );

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

  async function generateAiDraft() {
    if (!person) return;
    setMessage('');
    setError('');
    setIsGeneratingAiDraft(true);
    try {
      const latestInbound = personMessages.find((entry) => cleanText(entry.data.direction) !== 'outbound');
      const response = await authorizedFetch('/api/ai/message-draft', {
        method: 'POST',
        body: JSON.stringify({
          companyName: cleanText(person.partnerCompanyName || person.companyName),
          currentBody: stripTrailingSignature(cleanText(replyText), portalSignature),
          instruction:
            contextMode === 'new'
              ? [aiInstruction, 'Es handelt sich um eine neue Nachricht. Frühere Themen nur erwähnen, wenn ich das ausdrücklich sage.']
                  .filter(Boolean)
                  .join('\n')
              : aiInstruction,
          propertyName: cleanText(person.propertyName),
          recipientCount: 1,
          recipientEmail: cleanText(person.email),
          recipientName: [cleanText(person.firstName), cleanText(person.lastName)].filter(Boolean).join(' '),
          scope: 'manual',
          subject: `Nachricht an ${[cleanText(person.lastName), cleanText(person.firstName)].filter(Boolean).join(', ') || 'Kontakt'}`,
        }),
      });
      const result = (await response.json()) as { draftText?: string; error?: string; ok?: boolean };
      if (!response.ok || !result.ok || !result.draftText) {
        throw new Error(result.error || 'Der KI-Entwurf konnte nicht erzeugt werden.');
      }
      setReplyText(
        composePortalDraft({
          aiText: result.draftText,
          contextText: cleanText(latestInbound?.data.bodyText),
          portalSignature,
          recipientName: [cleanText(person.firstName), cleanText(person.lastName)].filter(Boolean).join(' '),
        })
      );
      setMessage('KI-Entwurf wurde erzeugt.');
    } catch (caughtError) {
      console.error('Fehler beim KI-Entwurf für Kontakt:', caughtError);
      setError(caughtError instanceof Error ? caughtError.message : 'Der KI-Entwurf konnte nicht erzeugt werden.');
    } finally {
      setIsGeneratingAiDraft(false);
    }
  }

  function sendReply() {
    if (!person || !replyText.trim()) return;
    startTransition(async () => {
      setMessage('');
      setError('');
      try {
        const signatureRecord = createSignatureRecord((selectedCompany?.data as Record<string, unknown>) ?? null);
        const baseBody = cleanText(replyText).endsWith(portalSignature)
          ? cleanText(replyText).slice(0, cleanText(replyText).length - portalSignature.length).trimEnd()
          : cleanText(replyText);
        const finalBody = mergeBodyWithSignature(baseBody, signatureRecord);
        const draftRef = await addDoc(collection(db, 'messageDrafts'), {
          attachments: [],
          body: finalBody,
          createdAt: serverTimestamp(),
          kind: 'service_request',
          messageId: personMessages[0]?.id ?? null,
          portalBodyText: [baseBody, portalSignature].filter(Boolean).join('\n\n'),
          propertyId: cleanText(selectedProperty?.id),
          recipientEmail: cleanText(person.email),
          recipientId: personId,
          recipientType: 'contact',
          signature: signatureRecord,
          status: 'draft',
          subject: `Nachricht an ${[cleanText(person.lastName), cleanText(person.firstName)].filter(Boolean).join(', ') || 'Kontakt'}`,
          ticketId: null,
          unitId: '',
          updatedAt: serverTimestamp(),
        });

        const response = await authorizedFetch('/api/message-drafts/send', {
          method: 'POST',
          body: JSON.stringify({ draftId: draftRef.id }),
        });
        const result = (await response.json()) as { error?: string; ok?: boolean };
        if (!response.ok || !result.ok) {
          throw new Error(result.error || 'Die Nachricht konnte nicht versendet werden.');
        }
        if (cleanText(followUpDate)) {
          await addDoc(collection(db, 'followUps'), {
            createdAt: serverTimestamp(),
            dueDate: followUpDate,
            message: 'Rückmeldung vom Dienstleister prüfen',
            propertyId: cleanText(selectedProperty?.id),
            status: 'open',
            targetId: personId,
            targetType: 'contact',
            ticketId: '',
            unitId: '',
          });
        }

        setReplyText('');
        setAiInstruction('');
        setContextMode('reply');
        setFollowUpDate('');
        setMessage('Nachricht wurde versendet.');
      } catch (caughtError) {
        console.error('Fehler beim Senden an Dienstleister/Kontakt:', caughtError);
        setError(caughtError instanceof Error ? caughtError.message : 'Die Nachricht konnte nicht versendet werden.');
      }
    });
  }

  if (isLoading) {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm leading-6 text-slate-600">
          Kontakt wird geladen...
        </div>
      </section>
    );
  }

  if (!person) {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-700">
          {error || 'Der Kontakt wurde nicht gefunden.'}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,250,240,0.96)_0%,rgba(247,241,231,0.94)_100%)] p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.35)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Kontakt ansehen</p>
        <h2 className="mt-2 text-3xl text-slate-950">
          {formatValue([person.lastName, person.firstName].filter(Boolean).join(', '))}
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
            href={`/admin/personen/${personId}/bearbeiten`}
          >
            Bearbeiten
          </Link>
          <Link
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
            href="/admin/personen"
          >
            Zur Übersicht
          </Link>
        </div>
      </section>

      <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Chatverlauf</p>
        <div className="mt-4 rounded-[18px] border border-stone-200 bg-stone-50 px-4 py-4">
          <p className="text-sm font-medium text-slate-950">Direkt an den Kontakt schreiben</p>
          <label className="mt-3 block max-w-[620px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">KI-Hinweis</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  contextMode === 'reply'
                    ? 'bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] text-stone-100'
                    : 'border border-stone-300 bg-white text-slate-700 hover:border-stone-400'
                }`}
                onClick={() => setContextMode('reply')}
                type="button"
              >
                Antwort auf Verlauf
              </button>
              <button
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  contextMode === 'new'
                    ? 'bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] text-stone-100'
                    : 'border border-stone-300 bg-white text-slate-700 hover:border-stone-400'
                }`}
                onClick={() => setContextMode('new')}
                type="button"
              >
                Neue Nachricht
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                onChange={(event) => setAiInstruction(event.target.value)}
                placeholder="z. B. kürzer, verbindlicher, freundlicher"
                value={aiInstruction}
              />
              <button
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isGeneratingAiDraft || isPending}
                onClick={generateAiDraft}
                type="button"
              >
                Anwenden
              </button>
            </div>
          </label>
          <div className="mt-3">
            <button
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isGeneratingAiDraft || isPending}
              onClick={generateAiDraft}
              type="button"
            >
              {isGeneratingAiDraft ? 'KI denkt…' : 'KI-Entwurf'}
            </button>
          </div>
          <textarea
            className="mt-3 min-h-[420px] w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-700/60"
            lang="de"
            onChange={(event) => setReplyText(event.target.value)}
            placeholder="Nachricht an den Kontakt"
            spellCheck={false}
            value={replyText}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-2 text-xs text-slate-700">
              <span>Wiedervorlage</span>
              <input
                className="bg-transparent text-xs text-slate-900 outline-none"
                onChange={(event) => setFollowUpDate(event.target.value)}
                type="date"
                value={followUpDate}
              />
            </label>
            <button
              className="rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-4 py-2 text-sm font-medium text-stone-100 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending || !replyText.trim()}
              onClick={sendReply}
              type="button"
            >
              Senden
            </button>
          </div>
        </div>
        <div className="mt-4 max-h-[78vh] space-y-3 overflow-y-auto pr-1">
          {personMessages.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-sm text-slate-600">
              Für diesen Kontakt liegen noch keine Nachrichten vor.
            </div>
          ) : (
            personMessages.map((entry) => {
              const isOutbound = cleanText(entry.data.direction) === 'outbound';
              return (
                <Link
                  className={`block rounded-[18px] border px-4 py-4 transition hover:border-stone-300 ${
                    isOutbound ? 'ml-10 border-sky-200 bg-sky-50/80' : 'mr-10 border-stone-200 bg-stone-50/90'
                  }`}
                  href={entry.data.ticketId ? `/admin/tickets/${entry.data.ticketId}` : '/admin/nachrichten'}
                  key={entry.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-950">
                      {isOutbound
                        ? cleanText(entry.data.subject) || 'An Kontakt'
                        : cleanText(entry.data.fromName || entry.data.subject || entry.data.fromEmail) || 'Vom Kontakt'}
                    </p>
                    <span className="text-xs text-slate-500">
                      {formatDateTime(entry.data.receivedAt ?? entry.data.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {cleanText(entry.data.bodyText) || 'Kein Nachrichtentext vorhanden.'}
                  </p>
                </Link>
              );
            })
          )}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <DetailCard title="Stammdaten">
          <DetailRow label="Bereich" value={person.category} />
          <DetailRow label="Anrede" value={person.salutation} />
          <DetailRow label="Name" value={[person.lastName, person.firstName].filter(Boolean).join(', ')} />
          <DetailRow label="Geburtsdatum" value={person.birthDate} />
          <DetailRow label="Rolle / Funktion" value={person.jobTitle} />
          <DetailRow label="Partnerfirma" value={person.partnerCompanyName} />
        </DetailCard>

        <DetailCard title="Kontakt">
          <DetailRow label="E-Mail" value={person.email} />
          <DetailRow label="Telefon" value={person.phone} />
          <DetailRow label="Mobil" value={person.mobile} />
          <DetailRow label="Bevorzugter Kontaktweg" value={person.preferredContactMethod} />
          <DetailRow label="Zugeordnete Immobilie" value={person.propertyName} />
        </DetailCard>

        <DetailCard title="Adresse und Kennzeichen">
          <DetailRow label="Straße" value={[person.street, person.houseNumber].filter(Boolean).join(' ')} />
          <DetailRow label="PLZ / Ort" value={[person.postalCode, person.city].filter(Boolean).join(' ')} />
          <DetailRow label="Land" value={person.country} />
          <DetailRow label="Aktennummer" value={person.referenceNumber} />
          <DetailRow label="IBAN" value={person.iban} />
          <DetailRow label="Steuer-ID / Kennzeichen" value={person.taxId} />
        </DetailCard>

        <DetailCard title="Notizen">
          <DetailRow label="Hinweise" value={person.notes} />
        </DetailCard>
      </div>

      <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Dokumente</p>
        <h3 className="mt-2 text-2xl text-slate-950">Downloadbereich</h3>
        {availableDocuments.length === 0 ? (
          <div className="mt-4 rounded-[20px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm leading-6 text-slate-600">
            Noch keine Dokumente hinterlegt.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {availableDocuments.map((field) => (
              <article className="rounded-[20px] border border-stone-200 bg-stone-50 p-4" key={field.name}>
                <p className="text-sm font-medium text-slate-900">{field.label}</p>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">{formatValue(person[field.name])}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function DetailCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">{title}</p>
      <div className="mt-4 grid gap-2.5">{children}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-1 gap-1.5 border-b border-stone-100 py-3 text-sm last:border-b-0 md:grid-cols-[112px_minmax(0,1fr)] md:gap-4">
      <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</dt>
      <dd className="min-w-0 whitespace-normal break-words leading-6 text-slate-900">{formatValue(value)}</dd>
    </div>
  );
}
