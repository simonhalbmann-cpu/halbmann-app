'use client';

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  formatDateTime,
  formatTimestampSort,
  inferMessageAnalysis,
  type WorkflowAnalysis,
  type WorkflowRecord,
} from '../../lib/adminWorkflow';
import { db, storage } from '../../lib/firebase';
import { composePortalDraft, stripAiEnvelope } from '../../lib/draftComposer';
import {
  buildLetterHtml,
  buildLetterText,
  buildPortalSignatureText,
  createSignatureRecord,
  mergeBodyWithSignature,
} from '../../lib/signatures';
import { applyAdminSenderToSignature, resolveAdminSenderContact } from './adminSenderSignature';
import { buildLetterTemplateReplacements, downloadFilledLetterTemplate } from './letterOfficeExport';
import { appendDeliveryLabel } from './messageDeliveryLabel';
import MessageAttachmentPreview, { type MessageAttachmentEntry } from './MessageAttachmentPreview';

type DeliveryMode = 'both' | 'email' | 'letter';

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readCollection(
  name: string,
  onError: (message: string) => void,
  setState: (value: WorkflowRecord[]) => void
) {
  return onSnapshot(
    query(collection(db, name)),
    (snapshot) => setState(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id }))),
    (caughtError) => {
      console.error(`Fehler beim Laden von ${name}:`, caughtError);
      onError(`Daten aus ${name} konnten nicht geladen werden.`);
    }
  );
}

function buildAddressLine(parts: Array<unknown>) {
  return parts.map((entry) => cleanText(entry)).filter(Boolean).join(' ');
}

function buildAddressBlock(lines: Array<unknown>) {
  return lines.map((entry) => cleanText(entry)).filter(Boolean).join('\n');
}

function buildLetterSubjectLine2(property: WorkflowRecord | null | undefined, unitLabel?: string) {
  const address = buildAddressBlock([
    buildAddressLine([property?.data.street, property?.data.houseNumber]),
    buildAddressLine([property?.data.postalCode, property?.data.city]),
  ]).replace(/\n/g, ', ');
  return [address, cleanText(unitLabel)].filter(Boolean).join(' · ');
}

function stripTrailingSignature(body: string, signatureText: string) {
  if (!signatureText) return body.trim();
  const trimmedBody = body.trimEnd();
  return trimmedBody.endsWith(signatureText)
    ? trimmedBody.slice(0, trimmedBody.length - signatureText.length).trimEnd()
    : trimmedBody;
}

function SectionLabel({ children }: { children: string }) {
  return <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">{children}</p>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-sm leading-7 text-slate-600">
      {text}
    </div>
  );
}

function ActionButton({
  active,
  children,
  disabled,
  onClick,
  tone = 'default',
}: {
  active?: boolean;
  children: string;
  disabled?: boolean;
  onClick: () => void;
  tone?: 'default' | 'solid';
}) {
  return (
    <button
      className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === 'solid' || active
          ? 'bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] text-stone-100 hover:brightness-105'
          : 'border border-stone-300 bg-white text-slate-700 hover:border-stone-400'
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export default function MessageDetailWorkspace({ messageId }: { messageId: string }) {
  const router = useRouter();
  const { profile, user } = useAuth();
  const [firestoreMessages, setFirestoreMessages] = useState<WorkflowRecord[]>([]);
  const [localPortalMessages, setLocalPortalMessages] = useState<WorkflowRecord[]>([]);
  const [tickets, setTickets] = useState<WorkflowRecord[]>([]);
  const [tenants, setTenants] = useState<WorkflowRecord[]>([]);
  const [properties, setProperties] = useState<WorkflowRecord[]>([]);
  const [companies, setCompanies] = useState<WorkflowRecord[]>([]);
  const [messageEvents, setMessageEvents] = useState<WorkflowRecord[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replyAiInstruction, setReplyAiInstruction] = useState('');
  const [replyContextMode, setReplyContextMode] = useState<'new' | 'reply'>('reply');
  const [replyDeliveryMode, setReplyDeliveryMode] = useState<DeliveryMode>('email');
  const [letterRecipientKey, setLetterRecipientKey] = useState('property');
  const [followUpDate, setFollowUpDate] = useState('');
  const [noteText, setNoteText] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isGeneratingAiReply, setIsGeneratingAiReply] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const unsubscribers = [
      readCollection('messages', setError, setFirestoreMessages),
      readCollection('tickets', setError, setTickets),
      readCollection('tenants', setError, setTenants),
      readCollection('properties', setError, setProperties),
      readCollection('companies', setError, setCompanies),
      readCollection('messageEvents', setError, setMessageEvents),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function loadLocalPortalMessages() {
      try {
        const response = await authorizedFetch('/api/admin/local-portal-messages');
        const result = (await response.json()) as {
          messages?: WorkflowRecord[];
          ok?: boolean;
        };

        if (!cancelled && response.ok && result.ok) {
          setLocalPortalMessages(Array.isArray(result.messages) ? result.messages : []);
        }
      } catch (caughtError) {
        console.error('Fehler beim Laden der lokalen Portalnachrichten:', caughtError);
      }
    }

    void loadLocalPortalMessages();
    const intervalId = window.setInterval(() => {
      void loadLocalPortalMessages();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [user]);

  const messages = useMemo(() => {
    const combined = [...firestoreMessages, ...localPortalMessages];
    const unique = new Map<string, WorkflowRecord>();
    combined.forEach((record) => {
      unique.set(record.id, record);
    });
    return Array.from(unique.values());
  }, [firestoreMessages, localPortalMessages]);

  const selectedMessage = messages.find((record) => record.id === messageId) ?? null;
  const analysis =
    selectedMessage &&
    (((selectedMessage.data.analysis as WorkflowAnalysis | null) ??
      inferMessageAnalysis(selectedMessage.data, tenants, properties, [])) as WorkflowAnalysis);
  const selectedTenant = tenants.find((record) => record.id === cleanText(analysis?.tenantId)) ?? null;
  const selectedProperty =
    properties.find((record) => record.id === cleanText(analysis?.propertyId)) ?? null;
  const selectedCompany =
    companies.find((record) => record.id === cleanText(selectedProperty?.data.ownerId)) ??
    companies.find((record) => record.id === cleanText(selectedTenant?.data.companyId)) ??
    null;
  const linkedTicketIds = useMemo(() => {
    const ids = [
      cleanText(selectedMessage?.data.ticketId),
      ...(Array.isArray(selectedMessage?.data.linkedTicketIds)
        ? selectedMessage!.data.linkedTicketIds.map((entry: unknown) => cleanText(entry))
        : []),
    ].filter(Boolean);
    return [...new Set(ids)];
  }, [selectedMessage?.data.linkedTicketIds, selectedMessage?.data.ticketId]);
  const selectedTicket = tickets.find((record) => linkedTicketIds.includes(record.id)) ?? null;
  const portalSignature = buildPortalSignatureText(
    applyAdminSenderToSignature(
      createSignatureRecord((selectedCompany?.data as Record<string, unknown>) ?? null),
      resolveAdminSenderContact(profile, user)
    )
  );
  const letterRecipientOptions = useMemo(() => {
    const propertyRecipient = {
      address: buildAddressBlock([
        buildAddressLine([selectedProperty?.data.street, selectedProperty?.data.houseNumber]),
        buildAddressLine([selectedProperty?.data.postalCode, selectedProperty?.data.city]),
      ]),
      company: cleanText(selectedTenant?.data.companyName),
      name: cleanText(analysis?.tenantLabel),
      salutation:
        cleanText(selectedTenant?.data.salutation) ||
        cleanText(selectedTenant?.data.anrede) ||
        (cleanText(selectedTenant?.data.gender).toLocaleLowerCase('de-DE').startsWith('w')
          ? 'Frau'
          : cleanText(selectedTenant?.data.gender).toLocaleLowerCase('de-DE').startsWith('m')
            ? 'Herr'
            : ''),
    };

    const companyRecipient = {
      address: buildAddressBlock([
        buildAddressLine([selectedTenant?.data.companyStreet, selectedTenant?.data.companyHouseNumber]),
        buildAddressLine([selectedTenant?.data.companyPostalCode, selectedTenant?.data.companyCity]),
      ]),
      company: cleanText(selectedTenant?.data.companyName),
      name: cleanText(selectedTenant?.data.companyContactName) || cleanText(analysis?.tenantLabel),
      salutation:
        cleanText(selectedTenant?.data.companyContactSalutation) ||
        cleanText(selectedTenant?.data.salutation) ||
        cleanText(selectedTenant?.data.anrede) ||
        (cleanText(selectedTenant?.data.gender).toLocaleLowerCase('de-DE').startsWith('w')
          ? 'Frau'
          : cleanText(selectedTenant?.data.gender).toLocaleLowerCase('de-DE').startsWith('m')
            ? 'Herr'
            : ''),
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
  }, [analysis?.tenantLabel, selectedProperty, selectedTenant]);

  const letterRecipient =
    letterRecipientOptions.find((option) => option.key === letterRecipientKey)?.recipient ??
    letterRecipientOptions[0]?.recipient ??
    { address: '', company: '', name: '', salutation: '' };

  useEffect(() => {
    const defaultKey = letterRecipientOptions.some((option) => option.key === 'company')
      ? 'company'
      : 'property';
    setLetterRecipientKey((current) =>
      letterRecipientOptions.some((option) => option.key === current) ? current : defaultKey
    );
  }, [messageId, letterRecipientOptions]);
  const thread = useMemo(
    () =>
      messages
        .filter(
          (record) => record.id === messageId || cleanText(record.data.relatedMessageId) === messageId
        )
        .sort(
          (left, right) =>
            formatTimestampSort(left.data.receivedAt ?? left.data.createdAt) -
            formatTimestampSort(right.data.receivedAt ?? right.data.createdAt)
        ),
    [messageId, messages]
  );

  const linkedNotes = useMemo(
    () =>
      messageEvents
        .filter((record) => cleanText(record.data.messageId) === messageId)
        .sort(
          (left, right) =>
            formatTimestampSort(right.data.createdAt) - formatTimestampSort(left.data.createdAt)
        ),
    [messageEvents, messageId]
  );

  function runAction(action: () => Promise<void>) {
    setMessage('');
    setError('');
    startTransition(async () => {
      try {
        await action();
      } catch (caughtError) {
        console.error('Fehler in der Nachrichtenansicht:', caughtError);
        setError(caughtError instanceof Error ? caughtError.message : 'Die Aktion konnte nicht ausgeführt werden.');
      }
    });
  }

  async function authorizedFetch(url: string, init?: RequestInit) {
    if (!user) {
      throw new Error('Du bist nicht angemeldet.');
    }
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

  async function addMessageEvent(kind: string, text: string) {
    await addDoc(collection(db, 'messageEvents'), {
      actorId: user?.uid || 'admin',
      actorType: 'admin',
      createdAt: serverTimestamp(),
      kind,
      messageId,
      text,
    });
  }


  async function generateAiReply() {
    if (!selectedMessage || !analysis) return;

    setMessage('');
    setError('');
    setIsGeneratingAiReply(true);

    try {
      const response = await authorizedFetch('/api/ai/message-reply-draft', {
        method: 'POST',
        body: JSON.stringify({
          companyName: cleanText(selectedCompany?.data.name),
          contextMode: replyContextMode,
          currentBody: cleanText(replyText).endsWith(portalSignature)
            ? cleanText(replyText).slice(0, cleanText(replyText).length - portalSignature.length).trimEnd()
            : cleanText(replyText),
          deliveryMode: replyDeliveryMode,
          historyText: thread
            .slice(0, 6)
            .reverse()
            .map((entry) => cleanText(entry.data.bodyText))
            .filter(Boolean)
            .join('\n\n'),
          instruction: replyAiInstruction,
          issueText: cleanText(selectedMessage.data.bodyText),
          propertyName: cleanText(selectedProperty?.data.name),
          recipientEmail:
            cleanText(selectedMessage.data.replyTo) ||
            cleanText(selectedMessage.data.fromEmail) ||
            cleanText(selectedTenant?.data.email),
          recipientName: cleanText(analysis.tenantLabel),
          recipientSalutation:
            cleanText(selectedTenant?.data.salutation) ||
            cleanText(selectedTenant?.data.anrede) ||
            (cleanText(selectedTenant?.data.gender).toLocaleLowerCase('de-DE').startsWith('w')
              ? 'Frau'
              : cleanText(selectedTenant?.data.gender).toLocaleLowerCase('de-DE').startsWith('m')
                ? 'Herr'
                : ''),
          subject: cleanText(selectedMessage.data.subject),
          unitLabel: cleanText(analysis.unitLabel),
        }),
      });
      const result = (await response.json()) as { draftText?: string; error?: string; ok?: boolean };
      if (!response.ok || !result.ok || !result.draftText) {
        throw new Error(result.error || 'Der KI-Entwurf konnte nicht erzeugt werden.');
      }

      let nextReplyText =
        replyDeliveryMode === 'letter'
          ? stripAiEnvelope(result.draftText)
          : composePortalDraft({
          aiText: result.draftText,
          contextText: cleanText(selectedMessage.data.bodyText),
          portalSignature,
          recipientName: cleanText(analysis.tenantLabel),
          recipientSalutation:
            cleanText(selectedTenant?.data.salutation) ||
            cleanText(selectedTenant?.data.anrede) ||
            (cleanText(selectedTenant?.data.gender).toLocaleLowerCase('de-DE').startsWith('w')
              ? 'Frau'
              : cleanText(selectedTenant?.data.gender).toLocaleLowerCase('de-DE').startsWith('m')
                ? 'Herr'
                : ''),
        });
      setReplyText(nextReplyText);
      setMessage('KI-Entwurf wurde erzeugt.');
    } catch (caughtError) {
      console.error('Fehler bei KI-Antwort:', caughtError);
      setError(caughtError instanceof Error ? caughtError.message : 'Der KI-Entwurf konnte nicht erzeugt werden.');
    } finally {
      setIsGeneratingAiReply(false);
    }
  }

  function toggleDoneState() {
    if (!selectedMessage) return;
    const nextStatus = cleanText(selectedMessage.data.status) === 'done' ? 'new' : 'done';

    runAction(async () => {
      await updateDoc(doc(db, 'messages', selectedMessage.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      await addMessageEvent(
        nextStatus === 'done' ? 'done' : 'reopened',
        nextStatus === 'done'
          ? 'Nachricht wurde als erledigt markiert.'
          : 'Nachricht wurde wieder in den Posteingang verschoben.'
      );
      setMessage(
        nextStatus === 'done'
          ? 'Nachricht wurde als erledigt markiert.'
          : 'Nachricht ist wieder im Posteingang sichtbar.'
      );
    });
  }

  function sendReply() {
    if (!selectedMessage || !cleanText(replyText)) return;

    runAction(async () => {
      const recipientEmail =
        cleanText(selectedMessage.data.replyTo) ||
        cleanText(selectedMessage.data.fromEmail) ||
        cleanText(selectedTenant?.data.email);
      if (!recipientEmail) {
        throw new Error('Für diese Nachricht ist keine Empfängeradresse hinterlegt.');
      }

      const signature = applyAdminSenderToSignature(
        createSignatureRecord((selectedCompany?.data as Record<string, unknown>) ?? null),
        resolveAdminSenderContact(profile, user)
      );
      const baseBody = cleanText(replyText).endsWith(portalSignature)
        ? cleanText(replyText).slice(0, cleanText(replyText).length - portalSignature.length).trimEnd()
        : cleanText(replyText);
      const subject = cleanText(selectedMessage.data.subject) || 'Antwort von Halbmann Holding';

      if (replyDeliveryMode === 'email' || replyDeliveryMode === 'both') {
        const draftRef = await addDoc(collection(db, 'messageDrafts'), {
          attachments: [],
          body: baseBody,
          deliveryMode: replyDeliveryMode,
          createdAt: serverTimestamp(),
          kind: 'reply_to_sender',
          messageId,
          portalBodyText: cleanText(replyText),
          propertyId: cleanText(selectedProperty?.id),
          recipientEmail,
          recipientId: cleanText(selectedTenant?.id) || null,
          recipientType: 'tenant',
          signature,
          status: 'draft',
          subject,
          ticketId: cleanText(selectedTicket?.id) || null,
          unitId: cleanText(analysis?.unitId),
          updatedAt: serverTimestamp(),
        });

        const response = await authorizedFetch('/api/message-drafts/send', {
          body: JSON.stringify({ draftId: draftRef.id }),
          method: 'POST',
        });
        const result = (await response.json()) as { error?: string; ok?: boolean };
        if (!response.ok || !result.ok) {
          throw new Error(result.error || 'Die Antwort konnte nicht versendet werden.');
        }
      }

      if (replyDeliveryMode === 'letter' || replyDeliveryMode === 'both') {
        const subjectLine2 = buildLetterSubjectLine2(selectedProperty, cleanText(analysis?.unitLabel));
        const letterHtml = buildLetterHtml({
          body: baseBody,
          context: {
            propertyName: cleanText(selectedProperty?.data.name),
            subjectLine2,
            unitLabel: cleanText(analysis?.unitLabel),
          },
          recipient: letterRecipient,
          signature,
          subject,
        });

        await addDoc(collection(db, 'messages'), {
          attachments: [],
          bodyHtml: letterHtml,
          bodyText: [baseBody, buildPortalSignatureText(signature)].filter(Boolean).join('\n\n'),
          channel: 'letter',
          createdAt: serverTimestamp(),
          deliveryMode: replyDeliveryMode,
          direction: 'outbound',
          fromEmail: 'portal@halbmann-holding.de',
          fromName: 'Halbmann Holding',
          letterText: buildLetterText(baseBody, signature),
          propertyId: cleanText(selectedProperty?.id),
          receivedAt: serverTimestamp(),
          relatedMessageId: messageId,
          recipientId: cleanText(selectedTenant?.id) || null,
          recipientType: 'tenant',
          status: 'sent',
          subject,
          tenantId: cleanText(selectedTenant?.id),
          toEmail: recipientEmail,
          unitId: cleanText(analysis?.unitId),
          updatedAt: serverTimestamp(),
        });

        await downloadFilledLetterTemplate({
          fallbackHtml: letterHtml,
          fileName: subject || 'Brief',
          getAuthToken: user ? () => user.getIdToken() : undefined,
          replacements: buildLetterTemplateReplacements({
            body: baseBody,
            closing: signature.letterClosing || signature.closing,
            companyName: signature.companyName,
            recipientAddress: letterRecipient.address,
            recipientCompany: letterRecipient.company,
            recipientName: letterRecipient.name,
            recipientSalutation: letterRecipient.salutation,
            senderName: signature.name,
            subject,
            subjectLine2,
          }),
          templateUrl: cleanText(selectedCompany?.data.letterTemplateUrl),
        });
      }
      if (cleanText(followUpDate) && cleanText(selectedTenant?.id)) {
        await addDoc(collection(db, 'followUps'), {
          createdAt: serverTimestamp(),
          dueDate: followUpDate,
          message: 'Rückmeldung zur Nachricht prüfen',
          propertyId: cleanText(selectedProperty?.id),
          status: 'open',
          targetId: cleanText(selectedTenant?.id),
          targetType: 'tenant',
          ticketId: cleanText(selectedTicket?.id),
          unitId: cleanText(analysis?.unitId),
        });
      }

      await addMessageEvent('reply_sent', 'Antwort wurde direkt aus dem Nachrichtenverlauf versendet.');
      setReplyText('');
      setReplyAiInstruction('');
      setReplyContextMode('reply');
      setReplyDeliveryMode('email');
      setFollowUpDate('');
      setMessage(
        replyDeliveryMode === 'both'
          ? 'Brief und Mail wurden verarbeitet.'
          : replyDeliveryMode === 'letter'
              ? 'Brief wurde im Verlauf dokumentiert.'
              : 'Antwort wurde versendet.'
      );
    });
  }

  function addManualNote() {
    if (!cleanText(noteText)) return;
    runAction(async () => {
      await addMessageEvent('manual_note', noteText);
      setNoteText('');
      setMessage('Notiz wurde gespeichert.');
    });
  }

  async function deleteMessageAttachment(messageId: string, attachments: unknown, targetAttachment: MessageAttachmentEntry) {
    const confirmed = window.confirm(`Anhang "${targetAttachment.name}" wirklich löschen?`);
    if (!confirmed) return;

    const currentAttachments = Array.isArray(attachments) ? attachments : [];

    try {
      setError('');
      if (targetAttachment.path) {
        await deleteObject(ref(storage, targetAttachment.path));
      }

      await updateDoc(doc(db, 'messages', messageId), {
        attachments: currentAttachments.filter((entry) => {
          if (!entry || typeof entry !== 'object') return true;
          const record = entry as Record<string, unknown>;
          const path = cleanText(record.path);
          const url = cleanText(record.url ?? record.downloadUrl ?? record.href);
          return targetAttachment.path ? path !== targetAttachment.path : url !== targetAttachment.url;
        }),
        updatedAt: serverTimestamp(),
      });
      const tenantId = cleanText(selectedMessage?.data.tenantId);
      if (tenantId) {
        const tenantDocuments = Array.isArray(selectedTenant?.data.tenantDocuments)
          ? selectedTenant.data.tenantDocuments
          : [];
        await updateDoc(doc(db, 'tenants', tenantId), {
          tenantDocuments: tenantDocuments.filter((entry) => {
            if (!entry || typeof entry !== 'object') return true;
            const record = entry as Record<string, unknown>;
            const path = cleanText(record.path);
            const url = cleanText(record.url ?? record.downloadUrl ?? record.href);
            return targetAttachment.path ? path !== targetAttachment.path : url !== targetAttachment.url;
          }),
          updatedAt: serverTimestamp(),
        });
      }
      setMessage('Anhang wurde gelöscht.');
    } catch (caughtError) {
      console.error(`Fehler beim Löschen des Anhangs ${targetAttachment.name}:`, caughtError);
      setError('Anhang konnte nicht gelöscht werden.');
    }
  }

  if (!selectedMessage || !analysis) {
    return (
      <div className="space-y-6">
        <Link
          className="inline-flex rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400"
          href="/admin/nachrichten"
        >
          Zurück zum Posteingang
        </Link>
        <EmptyState text="Diese Nachricht wurde nicht gefunden oder ist nicht mehr verfügbar." />
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </div>
    );
  }

  const currentStatus = cleanText(selectedMessage.data.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Link
            className="inline-flex rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400"
            href="/admin/nachrichten"
          >
            Zurück zum Posteingang
          </Link>
          <div>
            <SectionLabel>Nachricht</SectionLabel>
            <h1 className="mt-2 text-3xl text-slate-950">
              {cleanText(selectedMessage.data.subject) || 'Ohne Betreff'}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {cleanText(selectedMessage.data.fromName || selectedMessage.data.fromEmail) || 'Unbekannter Absender'} ·{' '}
              {formatDateTime(selectedMessage.data.receivedAt ?? selectedMessage.data.createdAt)}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
              <span>
                <span className="font-medium text-slate-900">Mieter:</span>{' '}
                {cleanText(analysis.tenantLabel) || '–'}
              </span>
              <span>
                <span className="font-medium text-slate-900">Immobilie:</span>{' '}
                {cleanText(analysis.propertyLabel) || '–'}
              </span>
              <span>
                <span className="font-medium text-slate-900">Einheit:</span>{' '}
                {cleanText(analysis.unitLabel) || '–'}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
              <span>
                <span className="font-medium text-slate-900">Kategorie:</span>{' '}
                {cleanText(analysis.tradeLabel) || '–'}
              </span>
              <span>
                <span className="font-medium text-slate-900">Priorität:</span>{' '}
                {cleanText(analysis.priority) || '–'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex max-w-full flex-wrap items-center gap-2">
          {!selectedTicket ? (
            <ActionButton disabled={isPending} onClick={toggleDoneState} tone="solid">
              {currentStatus === 'done' ? 'Erledigt rueckgaengig' : 'Als erledigt markieren'}
            </ActionButton>
          ) : null}
        </div>
      </div>


      <section className="space-y-5 rounded-[32px] border border-stone-200 bg-white p-6 shadow-[0_28px_70px_-42px_rgba(148,119,77,0.28)]">
        <div className="rounded-[26px] border border-stone-200 bg-stone-50 px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionLabel>Direkt antworten</SectionLabel>
            <ActionButton disabled={isGeneratingAiReply || isPending} onClick={generateAiReply}>
              {isGeneratingAiReply ? 'KI schreibt?' : 'KI-Entwurf'}
            </ActionButton>
          </div>
          <label className="mt-4 block max-w-[460px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">KI-Hinweis</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <ActionButton active={replyContextMode === 'reply'} onClick={() => setReplyContextMode('reply')}>
                Antwort auf Verlauf
              </ActionButton>
              <ActionButton active={replyContextMode === 'new'} onClick={() => setReplyContextMode('new')}>
                Neue Nachricht
              </ActionButton>
            </div>
            <input
              className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => setReplyAiInstruction(event.target.value)}
              placeholder="z. B. kürzer, verbindlicher, freundlicher"
              value={replyAiInstruction}
            />
          </label>
          <label className="mt-4 block max-w-[220px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Versand</p>
            <select
              className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => setReplyDeliveryMode(event.target.value as DeliveryMode)}
              value={replyDeliveryMode}
            >
              <option value="email">Mail</option>
              <option value="letter">Brief</option>
              <option value="both">Beides</option>
            </select>
          </label>
          <textarea
            className="mt-4 min-h-[320px] w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
            lang="de"
            onChange={(event) => setReplyText(event.target.value)}
            placeholder="Antwort an den Mieter"
            spellCheck={false}
            value={replyText}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-2 text-xs text-slate-700">
              <span>Wiedervorlage</span>
              <input
                className="bg-transparent text-xs text-slate-900 outline-none"
                onChange={(event) => setFollowUpDate(event.target.value)}
                type="date"
                value={followUpDate}
              />
            </label>
            <ActionButton disabled={isPending || !cleanText(replyText)} onClick={sendReply} tone="solid">
              Antwort senden
            </ActionButton>
          </div>
        </div>

        <SectionLabel>Chatverlauf</SectionLabel>
        <div className="max-h-[76vh] space-y-4 overflow-y-auto pr-1">
          {thread.map((entry) => {
            const isOutbound = cleanText(entry.data.direction) === 'outbound';
            const isLetter = cleanText(entry.data.channel) === 'letter';
            const isPortalChat = cleanText(entry.data.channel) === 'portal';
            const letterHtml = cleanText(entry.data.bodyHtml);
            return (
              <article
                className={`rounded-[26px] border px-5 py-5 ${
                  isOutbound
                    ? 'ml-10 border-amber-200 bg-amber-50/80'
                    : 'mr-10 border-stone-200 bg-stone-50/90'
                }`}
                key={entry.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {appendDeliveryLabel(isOutbound
                        ? isLetter
                          ? 'Ausgehender Brief'
                          : isPortalChat
                            ? 'Ausgehende Chatnachricht'
                          : 'Ausgehende Nachricht'
                        : cleanText(entry.data.fromName || entry.data.fromEmail) || 'Eingang', entry.data as Record<string, unknown>)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDateTime(entry.data.receivedAt ?? entry.data.createdAt)}
                    </p>
                  </div>
                  {entry.id === selectedMessage.id ? (
                    <span className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                      Aktuelle Nachricht
                    </span>
                  ) : null}
                </div>
                {isLetter && letterHtml ? (
                  <div className="mt-4 overflow-hidden rounded-[20px] border border-stone-200 bg-white shadow-[0_18px_40px_-32px_rgba(15,23,42,0.25)]">
                    <div dangerouslySetInnerHTML={{ __html: letterHtml }} />
                  </div>
                ) : (
                  <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-800">
                    {cleanText(entry.data.bodyText) || 'Kein Nachrichtentext vorhanden.'}
                  </div>
                )}
                <MessageAttachmentPreview
                  attachments={entry.data.attachments}
                  onDelete={(attachment) => deleteMessageAttachment(entry.id, entry.data.attachments, attachment)}
                />
              </article>
            );
          })}
        </div>

        <div className="rounded-[26px] border border-stone-200 bg-white px-5 py-5">
          <SectionLabel>Verlauf manuell ergänzen</SectionLabel>
          <textarea
            className="mt-4 min-h-[220px] w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Telefonnotiz, Rückmeldung oder internen Hinweis ergänzen"
            value={noteText}
          />
          <div className="mt-4">
            <ActionButton disabled={isPending || !cleanText(noteText)} onClick={addManualNote}>
              Notiz speichern
            </ActionButton>
          </div>
          {linkedNotes.length ? (
            <div className="mt-5 space-y-3">
              {linkedNotes.map((entry) => (
                <article className="rounded-[18px] border border-stone-200 bg-stone-50 px-4 py-4" key={entry.id}>
                  <p className="text-xs text-slate-500">{formatDateTime(entry.data.createdAt)}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{cleanText(entry.data.text)}</p>
                </article>
              ))}
            </div>
          ) : null}
        </div>
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

