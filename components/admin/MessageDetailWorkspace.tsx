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
import { composeMessageDraft, stripAiEnvelope } from '../../lib/draftComposer';
import {
  buildLetterHtml,
  buildLetterText,
  buildMessageSignatureText,
  createSignatureRecord,
  mergeBodyWithSignature,
} from '../../lib/signatures';
import { applyAdminSenderToSignature, resolveAdminSenderContact } from './adminSenderSignature';
import { buildLetterTemplateReplacements, downloadFilledLetterTemplate } from './letterOfficeExport';
import { appendDeliveryLabel } from './messageDeliveryLabel';
import MessageAttachmentPreview, { type MessageAttachmentEntry } from './MessageAttachmentPreview';
import OutgoingAttachmentPicker, { type PendingOutgoingAttachment } from './OutgoingAttachmentPicker';
import { uploadOutgoingMessageAttachments } from '../../lib/outgoingMessageAttachments';

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
  const [tickets, setTickets] = useState<WorkflowRecord[]>([]);
  const [tenants, setTenants] = useState<WorkflowRecord[]>([]);
  const [properties, setProperties] = useState<WorkflowRecord[]>([]);
  const [companies, setCompanies] = useState<WorkflowRecord[]>([]);
  const [messageEvents, setMessageEvents] = useState<WorkflowRecord[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replyAiInstruction, setReplyAiInstruction] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<PendingOutgoingAttachment[]>([]);
  const [replyContextMode, setReplyContextMode] = useState<'new' | 'reply'>('reply');
  const [replyDeliveryMode, setReplyDeliveryMode] = useState<DeliveryMode>('email');
  const [letterRecipientKey, setLetterRecipientKey] = useState('property');
  const [followUpDate, setFollowUpDate] = useState('');
  const [noteText, setNoteText] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [unknownAssignTenantId, setUnknownAssignTenantId] = useState('');
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

  const messages = useMemo(() => {
    const unique = new Map<string, WorkflowRecord>();
    firestoreMessages.forEach((record) => {
      unique.set(record.id, record);
    });
    return Array.from(unique.values());
  }, [firestoreMessages]);

  const selectedMessage = messages.find((record) => record.id === messageId) ?? null;
  const analysis =
    selectedMessage &&
    (((selectedMessage.data.analysis as WorkflowAnalysis | null) ??
      inferMessageAnalysis(selectedMessage.data, tenants, properties, [])) as WorkflowAnalysis);
  const selectedTenant = tenants.find((record) => record.id === cleanText(analysis?.tenantId)) ?? null;
  const selectedProperty =
    properties.find((record) => record.id === cleanText(analysis?.propertyId)) ?? null;
  const unknownAssignTenant = tenants.find((tenant) => tenant.id === unknownAssignTenantId) ?? null;
  const unknownAssignTenantOptions = useMemo(
    () =>
      [...tenants]
        .sort((left, right) =>
          (cleanText(left.data.lastName) || cleanText(left.data.companyName) || left.id).localeCompare(
            cleanText(right.data.lastName) || cleanText(right.data.companyName) || right.id,
            'de'
          )
        )
        .map((tenant) => {
          const property = properties.find((entry) => entry.id === cleanText(tenant.data.propertyId));
          const tenantLabel =
            [cleanText(tenant.data.lastName), cleanText(tenant.data.firstName)].filter(Boolean).join(', ') ||
            cleanText(tenant.data.companyName) ||
            cleanText(tenant.data.email) ||
            tenant.id;
          const detail = [cleanText(property?.data.name), cleanText(tenant.data.unitLabel), cleanText(tenant.data.email)]
            .filter(Boolean)
            .join(' · ');
          return {
            label: detail ? `${tenantLabel} · ${detail}` : tenantLabel,
            value: tenant.id,
          };
        }),
    [properties, tenants]
  );
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
  const messageSignature = buildMessageSignatureText(
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

  useEffect(() => {
    setUnknownAssignTenantId('');
  }, [messageId]);

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
          currentBody: cleanText(replyText).endsWith(messageSignature)
            ? cleanText(replyText).slice(0, cleanText(replyText).length - messageSignature.length).trimEnd()
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

      const nextReplyText =
        replyDeliveryMode === 'letter'
          ? stripAiEnvelope(result.draftText)
          : composeMessageDraft({
          aiText: result.draftText,
          contextText: cleanText(selectedMessage.data.bodyText),
          messageSignature,
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
      const baseBody = cleanText(replyText).endsWith(messageSignature)
        ? cleanText(replyText).slice(0, cleanText(replyText).length - messageSignature.length).trimEnd()
        : cleanText(replyText);
      const subject = cleanText(selectedMessage.data.subject) || 'Antwort von Halbmann Holding';
      const uploadedAttachments =
        replyDeliveryMode === 'email' || replyDeliveryMode === 'both'
          ? await uploadOutgoingMessageAttachments(replyAttachments, `message-${messageId}-${Date.now()}`)
          : [];

      if (replyDeliveryMode === 'email' || replyDeliveryMode === 'both') {
        const draftRef = await addDoc(collection(db, 'messageDrafts'), {
          attachments: uploadedAttachments,
          body: baseBody,
          deliveryMode: replyDeliveryMode,
          createdAt: serverTimestamp(),
          kind: 'reply_to_sender',
          messageId,
          messageBodyText: cleanText(replyText),
          propertyId: cleanText(selectedProperty?.id),
          recipientEmail,
          recipientId: cleanText(selectedTenant?.id) || null,
          recipientType: selectedTenant ? 'tenant' : 'email',
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
        const attachmentTenant = selectedTenant;
        if (uploadedAttachments.length > 0 && attachmentTenant) {
          const tenantDocuments = Array.isArray(attachmentTenant.data.tenantDocuments)
            ? attachmentTenant.data.tenantDocuments
            : [];
          await updateDoc(doc(db, 'tenants', attachmentTenant.id), {
            tenantDocuments: [
              ...tenantDocuments,
              ...uploadedAttachments.map((attachment) => ({
                category: 'Anhänge',
                contentType: attachment.contentType,
                name: attachment.name,
                path: attachment.path,
                size: attachment.size,
                source: 'message-attachment',
                uploadedAt: attachment.uploadedAt,
                uploadedByEmail: user?.email ?? '',
                url: attachment.url,
              })),
            ],
            updatedAt: serverTimestamp(),
            updatedByEmail: user?.email ?? null,
            updatedByUid: user?.uid ?? null,
          });
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
          bodyText: [baseBody, buildMessageSignatureText(signature)].filter(Boolean).join('\n\n'),
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
      setReplyAttachments([]);
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

  function assignUnknownSenderToTenant() {
    if (!selectedMessage || !unknownAssignTenant) return;

    runAction(async () => {
      const relatedMessageIds = thread
        .filter((entry) => firestoreMessages.some((record) => record.id === entry.id))
        .map((entry) => entry.id);
      const targetMessageIds = relatedMessageIds.length ? relatedMessageIds : [selectedMessage.id];

      await Promise.all(
        targetMessageIds.map((targetMessageId) =>
          updateDoc(doc(db, 'messages', targetMessageId), {
            propertyId: cleanText(unknownAssignTenant.data.propertyId),
            recipientId: unknownAssignTenant.id,
            recipientType: 'tenant',
            tenantId: unknownAssignTenant.id,
            unitId: cleanText(unknownAssignTenant.data.unitId),
            updatedAt: serverTimestamp(),
            updatedByEmail: user?.email ?? null,
            updatedByUid: user?.uid ?? null,
          })
        )
      );

      await addMessageEvent('assigned_tenant', 'Unbekannter Absender wurde einem Mieter zugeordnet.');
      setMessage('Nachricht wurde dem Mieter zugeordnet.');
      router.push(`/admin/mieter/${unknownAssignTenant.id}?messageId=${selectedMessage.id}`);
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
      <div className="min-w-0 space-y-6 overflow-x-hidden">
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
  const isUnknownSender =
    !cleanText(selectedMessage.data.tenantId) &&
    !cleanText(selectedMessage.data.contactId) &&
    Boolean(cleanText(selectedMessage.data.fromEmail));

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <Link
            className="inline-flex rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400"
            href="/admin/nachrichten"
          >
            Zurück zum Posteingang
          </Link>
          <div className="min-w-0">
            <SectionLabel>Nachricht</SectionLabel>
            <h1 className="mt-2 break-words text-2xl text-slate-950 sm:text-3xl">
              {cleanText(selectedMessage.data.subject) || 'Ohne Betreff'}
            </h1>
            <p className="mt-2 break-words text-sm text-slate-600">
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


      <section className="min-w-0 space-y-5 overflow-x-hidden rounded-[24px] border border-stone-200 bg-white p-4 shadow-[0_28px_70px_-42px_rgba(148,119,77,0.28)] sm:rounded-[32px] sm:p-6">
        <SectionLabel>Chatverlauf</SectionLabel>
        <div className="max-h-[76vh] min-w-0 space-y-4 overflow-y-auto overflow-x-hidden pr-1">
          {thread.map((entry) => {
            const isOutbound = cleanText(entry.data.direction) === 'outbound';
            const isLetter = cleanText(entry.data.channel) === 'letter';
            const isLegacyPortalChat = cleanText(entry.data.channel) === 'portal';
            const letterHtml = cleanText(entry.data.bodyHtml);
            return (
              <article
                className={`min-w-0 rounded-[22px] border px-4 py-4 sm:rounded-[26px] sm:px-5 sm:py-5 ${
                  isOutbound
                    ? 'border-amber-200 bg-amber-50/80 sm:ml-10'
                    : 'border-stone-200 bg-stone-50/90 sm:mr-10'
                }`}
                key={entry.id}
              >
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-slate-950">
                      {appendDeliveryLabel(isOutbound
                        ? isLetter
                          ? 'Ausgehender Brief'
                          : isLegacyPortalChat
                            ? 'Ausgehende Nachricht'
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
                  <div className="mt-4 max-w-full overflow-hidden rounded-[20px] border border-stone-200 bg-white shadow-[0_18px_40px_-32px_rgba(15,23,42,0.25)]">
                    <div className="max-w-full overflow-x-auto" dangerouslySetInnerHTML={{ __html: letterHtml }} />
                  </div>
                ) : (
                  <div className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
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

        <div className="min-w-0 overflow-x-hidden rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-5 sm:rounded-[26px] sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionLabel>Direkt antworten</SectionLabel>
            <ActionButton disabled={isGeneratingAiReply || isPending} onClick={generateAiReply}>
              {isGeneratingAiReply ? 'KI schreibt?' : 'KI-Entwurf'}
            </ActionButton>
          </div>
          <label className="mt-4 block min-w-0 max-w-[460px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">KI-Hinweis</p>
            <div className="mt-2 flex min-w-0 flex-wrap gap-2">
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
            placeholder={isUnknownSender ? 'Antwort an den Absender' : 'Antwort an den Mieter'}
            spellCheck={false}
            value={replyText}
          />
          {replyDeliveryMode === 'email' || replyDeliveryMode === 'both' ? (
            <OutgoingAttachmentPicker
              attachments={replyAttachments}
              disabled={isPending}
              inputId={`message-detail-attachments-${messageId}`}
              onChange={setReplyAttachments}
            />
          ) : null}
          <div className="mt-4 flex min-w-0 flex-wrap gap-2">
            <label className="flex min-w-0 items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-2 text-xs text-slate-700">
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

        {isUnknownSender ? (
          <div className="min-w-0 overflow-x-hidden rounded-[22px] border border-stone-200 bg-white px-4 py-5 sm:rounded-[26px] sm:px-5">
            <SectionLabel>Absender einordnen</SectionLabel>
            <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
              <div className="min-w-0 rounded-[22px] border border-stone-200 bg-stone-50 p-4">
                <p className="text-sm font-semibold text-slate-950">Mieter zuordnen</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Danach öffnet sich die normale Mieterseite mit diesem Nachrichtenverlauf.
                </p>
                <select
                  className="mt-3 w-full min-w-0 rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                  onChange={(event) => setUnknownAssignTenantId(event.target.value)}
                  value={unknownAssignTenantId}
                >
                  <option value="">Mieter auswählen</option>
                  {unknownAssignTenantOptions.map((tenant) => (
                    <option key={`message-detail-tenant-${tenant.value}`} value={tenant.value}>
                      {tenant.label}
                    </option>
                  ))}
                </select>
                <div className="mt-3">
                  <ActionButton disabled={!unknownAssignTenant || isPending} onClick={assignUnknownSenderToTenant} tone="solid">
                    Mieter zuordnen
                  </ActionButton>
                </div>
              </div>
              <div className="min-w-0 rounded-[22px] border border-stone-200 bg-stone-50 p-4">
                <p className="text-sm font-semibold text-slate-950">Dienstleister anlegen</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Legt einen neuen Kontakt mit dieser E-Mail als Ausgangspunkt an.
                </p>
                <div className="mt-3 break-all rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-slate-700">
                  {cleanText(selectedMessage.data.fromEmail)}
                </div>
                <div className="mt-3">
                  <ActionButton
                    onClick={() =>
                      router.push(
                        `/admin/personen?email=${encodeURIComponent(cleanText(selectedMessage.data.fromEmail))}&fromMessageId=${encodeURIComponent(selectedMessage.id)}`
                      )
                    }
                  >
                    Dienstleister neu anlegen
                  </ActionButton>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="min-w-0 overflow-x-hidden rounded-[22px] border border-stone-200 bg-white px-4 py-5 sm:rounded-[26px] sm:px-5">
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

