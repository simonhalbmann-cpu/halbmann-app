'use client';

import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, type DocumentData } from 'firebase/firestore';
import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  buildTenantContact,
  formatDateTime,
  formatTimestampSort,
  type WorkflowRecord,
} from '../../lib/adminWorkflow';
import { db } from '../../lib/firebase';
import { composePortalDraft } from '../../lib/draftComposer';
import LetterComposeEditor from './LetterComposeEditor';
import {
  buildLetterHtml,
  buildLetterText,
  buildPortalSignatureText,
  createSignatureRecord,
  mergeBodyWithSignature,
} from '../../lib/signatures';
import { printLetterHtml } from './letterPrint';

type TenantDetailViewProps = {
  tenantId: string;
};

type DeliveryMode = 'both' | 'email' | 'letter';

function cleanText(value?: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function inferSalutationFromMessage(bodyText: string, lastName: string) {
  const normalizedLastName = cleanText(lastName);
  if (!normalizedLastName || !bodyText) return '';
  const frauPattern = new RegExp(`frau\\s+${normalizedLastName}`, 'i');
  const herrPattern = new RegExp(`herr\\s+${normalizedLastName}`, 'i');
  if (frauPattern.test(bodyText)) return 'Frau';
  if (herrPattern.test(bodyText)) return 'Herr';
  return '';
}

function stripTrailingSignature(body: string, signatureText: string) {
  if (!signatureText) return body.trim();
  const trimmedBody = body.trimEnd();
  return trimmedBody.endsWith(signatureText)
    ? trimmedBody.slice(0, trimmedBody.length - signatureText.length).trimEnd()
    : trimmedBody;
}

function buildAddressLine(parts: Array<unknown>) {
  return parts.map((entry) => cleanText(entry)).filter(Boolean).join(' ');
}

function buildAddressBlock(lines: Array<unknown>) {
  return lines.map((entry) => cleanText(entry)).filter(Boolean).join('\n');
}

function formatValue(value?: unknown) {
  const text = cleanText(value);
  return text.length > 0 ? text : '–';
}

export default function TenantDetailView({ tenantId }: TenantDetailViewProps) {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<DocumentData | null>(null);
  const [messages, setMessages] = useState<WorkflowRecord[]>([]);
  const [companies, setCompanies] = useState<WorkflowRecord[]>([]);
  const [properties, setProperties] = useState<WorkflowRecord[]>([]);
  const [replyText, setReplyText] = useState('');
  const [aiInstruction, setAiInstruction] = useState('');
  const [contextMode, setContextMode] = useState<'new' | 'reply'>('reply');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('email');
  const [letterRecipientKey, setLetterRecipientKey] = useState('property');
  const [followUpDate, setFollowUpDate] = useState('');
  const [senderEmail, setSenderEmail] = useState('portal@halbmann-holding.de');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const unsubscribeTenant = onSnapshot(
      doc(db, 'tenants', tenantId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setTenant(null);
          setError('Der Mieter wurde nicht gefunden.');
          setIsLoading(false);
          return;
        }

        setTenant(snapshot.data());
        setError('');
        setIsLoading(false);
      },
      (caughtError) => {
        console.error(`Fehler beim Laden des Mieters ${tenantId}:`, caughtError);
        setError('Die Mieterdaten konnten nicht geladen werden.');
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
        console.error(`Fehler beim Laden des Nachrichtenverlaufs für ${tenantId}:`, caughtError);
      }
    );

    return () => {
      unsubscribeTenant();
      unsubscribeCompanies();
      unsubscribeProperties();
      unsubscribeMessages();
    };
  }, [tenantId]);

  const additionalPeople = useMemo(
    () => (Array.isArray(tenant?.additionalPersons) ? tenant.additionalPersons : []),
    [tenant]
  );

  const tenantMessages = useMemo(
    () =>
      messages
        .filter((entry) => cleanText(entry.data.tenantId) === tenantId)
        .sort(
          (left, right) =>
            formatTimestampSort(right.data.receivedAt ?? right.data.createdAt) -
            formatTimestampSort(left.data.receivedAt ?? left.data.createdAt)
        ),
    [messages, tenantId]
  );

  const selectedProperty = useMemo(
    () => properties.find((entry) => entry.id === cleanText(tenant?.propertyId)) ?? null,
    [properties, tenant?.propertyId]
  );
  const selectedCompany = useMemo(
    () =>
      companies.find((entry) => entry.id === cleanText(tenant?.companyId)) ??
      companies.find((entry) => entry.id === cleanText(selectedProperty?.data.ownerId)) ??
      null,
    [companies, selectedProperty?.data.ownerId, tenant?.companyId]
  );
  const tenantContact = useMemo(() => buildTenantContact({ data: tenant ?? {}, id: tenantId }), [tenant, tenantId]);
  const portalSignature = useMemo(
    () => buildPortalSignatureText(createSignatureRecord((selectedCompany?.data as Record<string, unknown>) ?? null)),
    [selectedCompany]
  );
  const inferredTenantSalutation = useMemo(
    () =>
      inferSalutationFromMessage(
        tenantMessages.find((entry) => cleanText(entry.data.direction) !== 'outbound')?.data.bodyText as string,
        cleanText(tenant?.lastName)
      ),
    [tenant?.lastName, tenantMessages]
  );
  const selectedUnit = useMemo(() => {
    const units = Array.isArray(selectedProperty?.data.units) ? (selectedProperty.data.units as DocumentData[]) : [];
    return units.find((entry) => cleanText(entry.id) === cleanText(tenant?.unitId)) ?? null;
  }, [selectedProperty?.data.units, tenant?.unitId]);
  const letterRecipientOptions = useMemo(() => {
    const propertyRecipient = {
      address: buildAddressBlock([
        buildAddressLine([selectedProperty?.data.street, selectedProperty?.data.houseNumber]),
        buildAddressLine([selectedProperty?.data.postalCode, selectedProperty?.data.city]),
      ]),
      company: cleanText(tenant?.companyName),
      name: cleanText(tenantContact?.name),
    };

    const companyRecipient = {
      address: buildAddressBlock([
        buildAddressLine([tenant?.companyStreet, tenant?.companyHouseNumber]),
        buildAddressLine([tenant?.companyPostalCode, tenant?.companyCity]),
      ]),
      company: cleanText(tenant?.companyName),
      name: cleanText(tenant?.companyContactName) || cleanText(tenantContact?.name),
    };

    const options = [
      {
        description: propertyRecipient.address,
        key: 'property',
        label: 'Objektadresse',
        recipient: propertyRecipient,
      },
    ];

    if (companyRecipient.address) {
      options.push({
        description: companyRecipient.address,
        key: 'company',
        label: 'Firmenadresse / Zentrale',
        recipient: companyRecipient,
      });
    }

    return options;
  }, [selectedProperty, tenant, tenantContact]);

  const letterRecipient =
    letterRecipientOptions.find((option) => option.key === letterRecipientKey)?.recipient ??
    letterRecipientOptions[0]?.recipient ??
    { address: '', company: '', name: '' };

  useEffect(() => {
    const defaultKey = letterRecipientOptions.some((option) => option.key === 'company')
      ? 'company'
      : 'property';
    setLetterRecipientKey((current) =>
      letterRecipientOptions.some((option) => option.key === current) ? current : defaultKey
    );
  }, [tenantId, letterRecipientOptions]);
  const meterSummary = useMemo(() => {
    const propertyMeters = Array.isArray(selectedProperty?.data.meters)
      ? (selectedProperty.data.meters as DocumentData[])
      : [];
    const unitMeters = Array.isArray(selectedUnit?.meters) ? (selectedUnit.meters as DocumentData[]) : [];
    return [...propertyMeters, ...unitMeters]
      .map((meter) =>
        [cleanText(meter.label || meter.type), cleanText(meter.meterNumber)].filter(Boolean).join(' – ')
      )
      .filter(Boolean);
  }, [selectedProperty?.data.meters, selectedUnit?.meters]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    user
      .getIdToken()
      .then((token) =>
        fetch('/api/admin/mailbox-settings', {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then(async (response) => {
        const result = (await response.json()) as { ok?: boolean; settings?: { inboxEmail?: string } };
        if (!cancelled && response.ok && result.ok && cleanText(result.settings?.inboxEmail)) {
          setSenderEmail(cleanText(result.settings?.inboxEmail));
        }
      })
      .catch((caughtError) => {
        console.error('Fehler beim Laden der Postfach-Einstellungen im Mieterbereich:', caughtError);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

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
    if (!tenant) return;
    setMessage('');
    setError('');
    setIsGeneratingAiDraft(true);
    try {
      const latestInbound = tenantMessages.find((entry) => cleanText(entry.data.direction) !== 'outbound');
      const currentBody = cleanText(replyText).endsWith(portalSignature)
        ? cleanText(replyText).slice(0, cleanText(replyText).length - portalSignature.length).trimEnd()
        : cleanText(replyText);
      const response = await authorizedFetch('/api/ai/message-reply-draft', {
              method: 'POST',
              body: JSON.stringify({
                companyName: cleanText(selectedCompany?.data.name),
                contextMode,
                currentBody,
                historyText:
                  contextMode === 'reply'
                    ? tenantMessages
                        .slice(0, 6)
                        .reverse()
                        .map((entry) => cleanText(entry.data.bodyText))
                        .filter(Boolean)
                        .join('\n\n')
                    : '',
                instruction: aiInstruction,
                issueText: contextMode === 'reply' ? cleanText(latestInbound?.data.bodyText) : '',
                meters: meterSummary,
                propertyName: cleanText(selectedProperty?.data.name),
                recipientEmail: cleanText(tenant.email),
                recipientName: cleanText(tenantContact?.name),
                recipientSalutation: cleanText(tenantContact?.salutation || tenant.salutation || inferredTenantSalutation),
                senderEmail,
                subject: cleanText(latestInbound?.data.subject),
                unitLabel: cleanText(tenant.unitLabel),
              }),
            });
      const result = (await response.json()) as { draftText?: string; error?: string; ok?: boolean };
      if (!response.ok || !result.ok || !result.draftText) {
        throw new Error(result.error || 'Der KI-Entwurf konnte nicht erzeugt werden.');
      }
      let nextReplyText = composePortalDraft({
        aiText: result.draftText,
        contextText: contextMode === 'reply' ? cleanText(latestInbound?.data.bodyText) : '',
        portalSignature,
        recipientName: cleanText(tenantContact?.name),
        recipientSalutation: cleanText(tenantContact?.salutation || tenant.salutation || inferredTenantSalutation),
      });
      if (deliveryMode === 'letter') {
        nextReplyText = stripTrailingSignature(nextReplyText, portalSignature);
      }
      setReplyText(nextReplyText);
      setMessage('KI-Entwurf wurde erzeugt.');
    } catch (caughtError) {
      console.error('Fehler beim KI-Entwurf im Mieterbereich:', caughtError);
      setError(caughtError instanceof Error ? caughtError.message : 'Der KI-Entwurf konnte nicht erzeugt werden.');
    } finally {
      setIsGeneratingAiDraft(false);
    }
  }

  function sendReply() {
    if (!tenant || !cleanText(replyText)) return;
    startTransition(async () => {
      setMessage('');
      setError('');
      try {
        const baseBody = cleanText(replyText).endsWith(portalSignature)
          ? cleanText(replyText).slice(0, cleanText(replyText).length - portalSignature.length).trimEnd()
          : cleanText(replyText);
        const signatureRecord = createSignatureRecord((selectedCompany?.data as Record<string, unknown>) ?? null);
        const subject = 'Nachricht von Halbmann Holding';

        if (deliveryMode === 'email' || deliveryMode === 'both') {
          const draftRef = await addDoc(collection(db, 'messageDrafts'), {
            attachments: [],
            body: mergeBodyWithSignature(baseBody, signatureRecord),
            createdAt: serverTimestamp(),
            kind: 'reply_to_tenant',
            messageId: tenantMessages[0]?.id ?? null,
            portalBodyText: [baseBody, portalSignature].filter(Boolean).join('\n\n'),
            propertyId: cleanText(tenant.propertyId),
            recipientEmail: cleanText(tenant.email),
            recipientId: tenantId,
            recipientType: 'tenant',
            signature: signatureRecord,
            status: 'draft',
            subject,
            ticketId: null,
            unitId: cleanText(tenant.unitId),
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
        }

        if (deliveryMode === 'both') {
          await addDoc(collection(db, 'messages'), {
            attachments: [],
            bodyText: [baseBody, portalSignature].filter(Boolean).join('\n\n'),
            channel: 'portal',
            createdAt: serverTimestamp(),
            direction: 'outbound',
            fromEmail: 'portal@halbmann-holding.de',
            fromName: 'Halbmann Holding',
            propertyId: cleanText(tenant.propertyId),
            receivedAt: serverTimestamp(),
            recipientId: tenantId,
            recipientType: 'tenant',
            status: 'sent',
            subject,
            tenantId,
            toEmail: cleanText(tenant.email),
            unitId: cleanText(tenant.unitId),
            updatedAt: serverTimestamp(),
          });
        }

        if (deliveryMode === 'letter') {
          const letterHtml = buildLetterHtml({
            body: baseBody,
            context: {
              propertyName: cleanText(selectedProperty?.data.name),
              unitLabel: cleanText(tenant?.unitLabel),
            },
            recipient: letterRecipient,
            signature: signatureRecord,
            subject,
          });

          await addDoc(collection(db, 'messages'), {
            attachments: [],
            bodyHtml: letterHtml,
            bodyText: [baseBody, portalSignature].filter(Boolean).join('\n\n'),
            channel: 'letter',
            createdAt: serverTimestamp(),
            direction: 'outbound',
            fromEmail: 'portal@halbmann-holding.de',
            fromName: 'Halbmann Holding',
            letterText: buildLetterText(baseBody, signatureRecord),
            propertyId: cleanText(tenant.propertyId),
            receivedAt: serverTimestamp(),
            recipientId: tenantId,
            recipientType: 'tenant',
            status: 'sent',
            subject,
            tenantId,
            toEmail: cleanText(tenant.email),
            unitId: cleanText(tenant.unitId),
            updatedAt: serverTimestamp(),
          });

          printLetterHtml(letterHtml, subject || 'Brief');
        }
        if (cleanText(followUpDate)) {
          await addDoc(collection(db, 'followUps'), {
            createdAt: serverTimestamp(),
            dueDate: followUpDate,
            message: 'Rückmeldung vom Mieter prüfen',
            propertyId: cleanText(tenant.propertyId),
            status: 'open',
            targetId: tenantId,
            targetType: 'tenant',
            ticketId: '',
            unitId: cleanText(tenant.unitId),
          });
        }
        setReplyText('');
        setAiInstruction('');
        setContextMode('reply');
        setDeliveryMode('email');
        setFollowUpDate('');
        setMessage(
          deliveryMode === 'both'
            ? 'Mail und Chat wurden an den Mieter versendet.'
            : deliveryMode === 'letter'
              ? 'Brief wurde im Verlauf dokumentiert.'
              : 'Nachricht wurde an den Mieter versendet.'
        );
      } catch (caughtError) {
        console.error('Fehler beim Senden im Mieterbereich:', caughtError);
        setError(caughtError instanceof Error ? caughtError.message : 'Die Nachricht konnte nicht versendet werden.');
      }
    });
  }

  if (isLoading) {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm leading-6 text-slate-600">
          Mieter wird geladen...
        </div>
      </section>
    );
  }

  if (!tenant) {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-700">
          {error || 'Der Mieter wurde nicht gefunden.'}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,250,240,0.96)_0%,rgba(247,241,231,0.94)_100%)] p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.35)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Mieter ansehen</p>
        <h2 className="mt-2 text-3xl text-slate-950">
          {formatValue([tenant.lastName, tenant.firstName].filter(Boolean).join(', '))}
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
            href={`/admin/mieter/${tenantId}/bearbeiten`}
          >
            Bearbeiten
          </Link>
          <Link
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950"
            href="/admin/mieter"
          >
            Zur Mieterübersicht
          </Link>
        </div>
      </section>

      <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Chatverlauf</p>
        <div className="mt-4 rounded-[18px] border border-stone-200 bg-stone-50 px-4 py-4">
          <p className="text-sm font-medium text-slate-950">Direkt an den Mieter schreiben</p>
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
          <label className="mt-3 block max-w-[220px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Versand</p>
            <select
              className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => setDeliveryMode(event.target.value as DeliveryMode)}
              value={deliveryMode}
            >
              <option value="email">Mail</option>
              <option value="letter">Brief</option>
              <option value="both">Beides</option>
            </select>
          </label>
          {deliveryMode === 'letter' ? (
            <LetterComposeEditor
              body={replyText}
              className="mt-3 rounded-2xl border border-stone-300 bg-stone-50"
              onChange={setReplyText}
              onRecipientChange={setLetterRecipientKey}
              placeholder="Nachricht an den Mieter"
              context={{
                propertyName: cleanText(selectedProperty?.data.name),
                unitLabel: cleanText(tenant?.unitLabel),
              }}
              recipient={letterRecipient}
              recipientOptions={letterRecipientOptions}
              selectedRecipientKey={letterRecipientKey}
              signature={createSignatureRecord((selectedCompany?.data as Record<string, unknown>) ?? null)}
              subject="Nachricht von Halbmann Holding"
            />
          ) : (
            <textarea
              className="mt-3 min-h-[420px] w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-700/60"
              lang="de"
              onChange={(event) => setReplyText(event.target.value)}
              placeholder="Nachricht an den Mieter"
              spellCheck={false}
              value={replyText}
            />
          )}
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
              disabled={isPending || !cleanText(replyText)}
              onClick={sendReply}
              type="button"
            >
              Senden
            </button>
          </div>
        </div>
        <div className="mt-4 max-h-[78vh] space-y-3 overflow-y-auto pr-1">
          {tenantMessages.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-sm text-slate-600">
              Für diesen Mieter liegen noch keine Nachrichten vor.
            </div>
          ) : (
            tenantMessages.map((entry) => {
              const isOutbound = cleanText(entry.data.direction) === 'outbound';
              return (
                <Link
                  className={`block rounded-[18px] border px-4 py-4 transition hover:border-stone-300 ${
                    isOutbound ? 'ml-10 border-amber-200 bg-amber-50/80' : 'mr-10 border-stone-200 bg-stone-50/90'
                  }`}
                  href={`/admin/nachrichten/${entry.id}`}
                  key={entry.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-950">
                      {isOutbound
                        ? cleanText(entry.data.subject) || 'An Mieter'
                        : cleanText(entry.data.fromName || entry.data.subject || entry.data.fromEmail) || 'Vom Mieter'}
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

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        <DetailCard title="Stammdaten">
          <DetailRow label="Name" value={[tenant.lastName, tenant.firstName].filter(Boolean).join(', ')} />
          <DetailRow label="Firma" value={tenant.companyName} />
          <DetailRow label="E-Mail" value={tenant.email} />
          <DetailRow label="Telefon" value={tenant.phone} />
          <DetailRow label="Steuernummer" value={tenant.taxNumber} />
          <DetailRow label="Status" value={tenant.status} />
        </DetailCard>

        <DetailCard title="Zuordnung">
          <DetailRow label="Objekt" value={tenant.propertyName} />
          <DetailRow label="Einheit" value={tenant.unitLabel} />
          <DetailRow label="Einzug" value={tenant.moveInDate} />
        </DetailCard>

        <DetailCard title="Status und Prüfung">
          <DetailRow label="Mieterhöhungsart" value={tenant.rentIncreaseType} />
          <DetailRow label="Nächste Erinnerung" value={tenant.rentIncreaseNextReview} />
          <DetailRow label="Bürge" value={tenant.guarantorLabel} />
          <DetailRow label="Kautionsart" value={tenant.depositType} />
        </DetailCard>
      </div>

      <DetailCard title="Miete und Kaution">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          <Field label="Kaltmiete" value={tenant.coldRent} />
          <Field label="Betriebskosten" value={tenant.netOperatingCosts} />
          <Field label="Warmmiete (netto)" value={tenant.warmRent} />
          <Field label="Umsatzsteuer-Regelung" value={tenant.vatRule} />
          <Field label="Kautionsart" value={tenant.depositType} />
          <Field label="Kautionsbetrag" value={tenant.depositAmount} />
          <Field label="Bürge" value={tenant.guarantorLabel} />
        </div>
      </DetailCard>

      {additionalPeople.length > 0 ? (
        <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Weitere Personen</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {additionalPeople.map((person) => (
              <article className="rounded-[18px] border border-stone-200 bg-stone-50 p-4" key={String(person.id)}>
                <p className="text-sm font-medium text-slate-900">
                  {[person.lastName, person.firstName].filter(Boolean).join(', ')}
                </p>
                <div className="mt-3 grid gap-2">
                  <Field label="Bezug" value={person.relation} />
                  <Field label="Telefon" value={person.phone} />
                  <Field label="E-Mail" value={person.email} />
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

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

function DetailRow({ label, value }: { label: string; value?: unknown }) {
  return (
    <div className="grid grid-cols-1 gap-1.5 border-b border-stone-100 py-3 text-sm last:border-b-0 md:grid-cols-[112px_minmax(0,1fr)] md:gap-4">
      <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</dt>
      <dd className="min-w-0 whitespace-normal break-words leading-6 text-slate-900">{formatValue(value)}</dd>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: unknown }) {
  return (
    <div className="rounded-[14px] border border-stone-200 bg-stone-50 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="mt-1 min-w-0 whitespace-normal break-words text-sm leading-6 text-slate-900">{formatValue(value)}</p>
    </div>
  );
}
