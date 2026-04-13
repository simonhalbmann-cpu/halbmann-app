'use client';

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  buildTenantContact,
  formatDateTime,
  formatTimestampSort,
  inferMessageAnalysis,
  resolveServiceContact,
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

type ComposerMode = 'note' | 'service' | 'tenant';
type DeliveryMode = 'both' | 'email' | 'letter';
const servicePartnerFields = [
  { idField: 'billingServiceId', label: 'Abrechnungsunternehmen' },
  { idField: 'cleaningServiceId', label: 'Hausreinigung' },
  { idField: 'electricianId', label: 'Elektriker' },
  { idField: 'heatingServiceId', label: 'Heizungsdienst' },
  { idField: 'plumbingServiceId', label: 'SanitÃ¤r / Rohrreinigung' },
  { idField: 'janitorId', label: 'Hausmeister' },
  { idField: 'winterServiceId', label: 'Winterdienst' },
  { idField: 'roofMaintenanceId', label: 'Dachwartung' },
  { idField: 'gutterCleaningId', label: 'Regenrinnenreinigung' },
  { idField: 'wasteCollectionId', label: 'MÃ¼llabfuhr' },
] as const;

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function shortenText(value: unknown, maxLength: number) {
  const text = cleanText(value);
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
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

function normalizePosition(value: string) {
  const normalized = cleanText(value).toLocaleLowerCase('de-DE');
  if (['li', 'links', 'l'].includes(normalized)) return 'Links';
  if (['re', 'rechts', 'r'].includes(normalized)) return 'Rechts';
  if (['mi', 'mitte', 'm'].includes(normalized)) return 'Mitte';
  return cleanText(value);
}

function simplifyUnitLabel(label: string) {
  return label
    .replace(/\bVorderhaus\b/gi, '')
    .replace(/\bHinterhaus\b/gi, '')
    .replace(/\bLadenrechts\b/gi, '')
    .replace(/\bLaden links\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveUnitDisplay(
  ticket: WorkflowRecord | null,
  tenant: WorkflowRecord | null,
  property: WorkflowRecord | null
) {
  const targetUnitId = cleanText(ticket?.data.unitId) || cleanText(tenant?.data.unitId);
  const candidates: Array<Record<string, unknown>> = [];

  if (property && Array.isArray(property.data.units) && targetUnitId) {
    const match =
      (property.data.units.find(
        (entry: unknown) =>
          entry &&
          typeof entry === 'object' &&
          cleanText((entry as DocumentData).id) === targetUnitId
      ) as Record<string, unknown> | undefined) ?? null;
    if (match) candidates.push(match);
  }

  if (tenant?.data && typeof tenant.data === 'object') {
    candidates.push(tenant.data as Record<string, unknown>);
  }
  if (ticket?.data && typeof ticket.data === 'object') {
    candidates.push(ticket.data as Record<string, unknown>);
  }

  for (const source of candidates) {
    const floor = cleanText(source.floor ?? source.floorLabel);
    const position = normalizePosition(cleanText(source.unitPosition ?? source.position));
    if (floor && position) return `${floor} ${position}`.trim();

    const compactLabel = simplifyUnitLabel(cleanText(source.unitLabel ?? source.label));
    if (compactLabel && !/^[0-9a-f]{8}-/i.test(compactLabel)) {
      return compactLabel;
    }
  }

  return targetUnitId || 'â€“';
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

function renderEmailHtml(bodyText: string) {
  const encode = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const rows = bodyText.split('\n').filter(Boolean);
  const greetingRows = rows.slice(0, 3);
  const footerRows = rows.slice(3);

  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;font-size:14px;line-height:1.55;">
      ${greetingRows.map((row) => `<div style="margin:0 0 8px 0;">${encode(row)}</div>`).join('')}
      ${
        footerRows.length
          ? `<div style="margin-top:18px;padding-top:14px;border-top:1px solid #d6d3d1;text-align:center;color:#57534e;font-size:12px;line-height:1.5;">
               ${[
                 footerRows.slice(0, 2).join(' Â· '),
                 footerRows.slice(2, 4).join(' Â· '),
                 footerRows.slice(4).join(' Â· '),
               ]
                 .filter(Boolean)
                 .map((row) => `<div style="margin:0 0 4px 0;">${encode(row)}</div>`)
                 .join('')}
             </div>`
          : ''
      }
    </div>
  `;
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
  tone?: 'danger' | 'default';
}) {
  const className =
    tone === 'danger'
      ? 'border border-rose-300 bg-white text-rose-700 hover:border-rose-400'
      : active
        ? 'bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] text-stone-100 hover:brightness-105'
        : 'border border-stone-300 bg-white text-slate-700 hover:border-stone-400';

  return (
    <button
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export default function TicketDetailWorkspace({ ticketId }: { ticketId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<WorkflowRecord[]>([]);
  const [messages, setMessages] = useState<WorkflowRecord[]>([]);
  const [events, setEvents] = useState<WorkflowRecord[]>([]);
  const [tenants, setTenants] = useState<WorkflowRecord[]>([]);
  const [properties, setProperties] = useState<WorkflowRecord[]>([]);
  const [people, setPeople] = useState<WorkflowRecord[]>([]);
  const [companies, setCompanies] = useState<WorkflowRecord[]>([]);
  const [composerMode, setComposerMode] = useState<ComposerMode>('tenant');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('email');
  const [letterRecipientKey, setLetterRecipientKey] = useState('property');
  const [composerText, setComposerText] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [serviceField, setServiceField] = useState('');
  const [manualServiceEmail, setManualServiceEmail] = useState('');
  const [ticketTitle, setTicketTitle] = useState('');
  const [aiInstruction, setAiInstruction] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const unsubscribers = [
      readCollection('tickets', setError, setTickets),
      readCollection('messages', setError, setMessages),
      readCollection('ticketEvents', setError, setEvents),
      readCollection('tenants', setError, setTenants),
      readCollection('properties', setError, setProperties),
      readCollection('people', setError, setPeople),
      readCollection('companies', setError, setCompanies),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const ticket = tickets.find((record) => record.id === ticketId) ?? null;
  const tenant = tenants.find((record) => record.id === cleanText(ticket?.data.tenantId)) ?? null;
  const property = properties.find((record) => record.id === cleanText(ticket?.data.propertyId)) ?? null;
  const company =
    companies.find((record) => record.id === cleanText(property?.data.ownerId)) ??
    companies.find((record) => record.id === cleanText(tenant?.data.companyId)) ??
    null;

  const linkedMessages = useMemo(
    () =>
      messages
        .filter(
          (record) =>
            cleanText(record.data.ticketId) === ticketId ||
            record.id === cleanText(ticket?.data.sourceMessageId)
        )
        .sort(
          (left, right) =>
            formatTimestampSort(right.data.receivedAt ?? right.data.createdAt) -
            formatTimestampSort(left.data.receivedAt ?? left.data.createdAt)
        ),
    [messages, ticket?.data.sourceMessageId, ticketId]
  );

  const linkedEvents = useMemo(
    () =>
      events
        .filter((record) => cleanText(record.data.ticketId) === ticketId)
        .filter((record) => cleanText(record.data.kind) === 'manual_note')
        .sort(
          (left, right) =>
            formatTimestampSort(right.data.createdAt) - formatTimestampSort(left.data.createdAt)
        ),
    [events, ticketId]
  );

  const sourceMessage = linkedMessages.find(
    (entry) => entry.id === cleanText(ticket?.data.sourceMessageId)
  ) ?? null;
  const analysis = sourceMessage ? inferMessageAnalysis(sourceMessage.data, tenants, properties, people) : null;
  const tenantContact = buildTenantContact(tenant);
  const companySignature = createSignatureRecord((company?.data as Record<string, unknown>) ?? null);
  const tenantLetterRecipientOptions = useMemo(() => {
    const propertyRecipient = {
      address: buildAddressBlock([
        buildAddressLine([property?.data.street, property?.data.houseNumber]),
        buildAddressLine([property?.data.postalCode, property?.data.city]),
      ]),
      company: cleanText(tenant?.data.companyName),
      name: cleanText(tenantContact?.name),
    };

    const companyRecipient = {
      address: buildAddressBlock([
        buildAddressLine([tenant?.data.companyStreet, tenant?.data.companyHouseNumber]),
        buildAddressLine([tenant?.data.companyPostalCode, tenant?.data.companyCity]),
      ]),
      company: cleanText(tenant?.data.companyName),
      name: cleanText(tenant?.data.companyContactName) || cleanText(tenantContact?.name),
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
  }, [property, tenant, tenantContact]);

  const selectedTenantLetterRecipient =
    tenantLetterRecipientOptions.find((option) => option.key === letterRecipientKey)?.recipient ??
    tenantLetterRecipientOptions[0]?.recipient ??
    { address: '', company: '', name: '' };

  useEffect(() => {
    const defaultKey = tenantLetterRecipientOptions.some((option) => option.key === 'company')
      ? 'company'
      : 'property';
    setLetterRecipientKey((current) =>
      tenantLetterRecipientOptions.some((option) => option.key === current) ? current : defaultKey
    );
  }, [tenantLetterRecipientOptions, ticketId]);
  const portalSignature = buildPortalSignatureText(companySignature);
  const unitLabel = resolveUnitDisplay(ticket, tenant, property);
  const tenantLabel = tenant
    ? [cleanText(tenant.data.lastName), cleanText(tenant.data.firstName)].filter(Boolean).join(', ')
    : '';
  const issueFocus = cleanText(ticket?.data.issueFocus) || cleanText(sourceMessage?.data.bodyText);
  const focusAnalysis = useMemo(
    () =>
      inferMessageAnalysis(
        {
          bodyText: issueFocus || cleanText(sourceMessage?.data.bodyText),
          propertyId: cleanText(ticket?.data.propertyId),
          subject: cleanText(ticket?.data.title),
          tenantId: cleanText(ticket?.data.tenantId),
          unitId: cleanText(ticket?.data.unitId),
        },
        tenants,
        properties,
        people
      ),
    [issueFocus, people, properties, sourceMessage?.data.bodyText, tenants, ticket?.data.propertyId, ticket?.data.tenantId, ticket?.data.title, ticket?.data.unitId]
  );
  const inferredTenantSalutation = useMemo(
    () => inferSalutationFromMessage(cleanText(sourceMessage?.data.bodyText), cleanText(tenant?.data.lastName)),
    [sourceMessage?.data.bodyText, tenant?.data.lastName]
  );

  const suggestedServiceField = useMemo(() => {
    if (!property) return '';
    const suggested = resolveServiceContact(focusAnalysis, property, people);
    return (
      servicePartnerFields.find((entry) => cleanText(property.data[entry.idField]) === suggested.contactId)?.idField ||
      ''
    );
  }, [focusAnalysis, people, property]);

  const selectedServiceField = serviceField || suggestedServiceField;
  const selectedServiceConfig =
    servicePartnerFields.find((entry) => entry.idField === selectedServiceField) ?? null;
  const selectedServiceRecipientId = selectedServiceConfig
    ? cleanText(property?.data[selectedServiceConfig.idField])
    : '';
  const selectedServiceRecipient =
    people.find((entry) => entry.id === selectedServiceRecipientId) ?? null;
  const serviceEmail = cleanText(manualServiceEmail) || cleanText(selectedServiceRecipient?.data.email);
  const selectedServiceName =
    [
      cleanText(selectedServiceRecipient?.data.firstName),
      cleanText(selectedServiceRecipient?.data.lastName),
    ]
      .filter(Boolean)
      .join(' ') ||
    cleanText(selectedServiceRecipient?.data.partnerCompanyName) ||
    cleanText(selectedServiceRecipient?.data.companyName) ||
    cleanText(selectedServiceRecipient?.data.name) ||
    serviceEmail;

  const timeline = useMemo(() => {
    const messageEntries = linkedMessages.map((entry) => {
      const isService = cleanText(entry.data.recipientType) === 'contact';
      const isOutbound = cleanText(entry.data.direction) === 'outbound';
      const isLetter = cleanText(entry.data.channel) === 'letter';
      return {
        createdAt: entry.data.receivedAt ?? entry.data.createdAt,
        html: isLetter ? cleanText(entry.data.bodyHtml) : '',
        id: `message-${entry.id}`,
        kind: isService ? 'service' : isOutbound ? 'tenant_outbound' : 'tenant_inbound',
        label: isService
          ? isLetter
            ? `Brief an Gewerk · ${cleanText(entry.data.toEmail) || 'ohne Kontakt'}`
            : `Gewerk · ${cleanText(entry.data.toEmail) || 'ohne E-Mail'}`
          : isOutbound
            ? isLetter
              ? 'Brief an Mieter'
              : 'An Mieter'
            : 'Vom Mieter',
        text: cleanText(entry.data.bodyText),
      };
    });

    const noteEntries = linkedEvents.map((entry) => ({
      createdAt: entry.data.createdAt,
      html: '',
      id: `event-${entry.id}`,
      kind: 'note',
      label: 'Interne Notiz',
      text: cleanText(entry.data.text),
    }));

    return [...messageEntries, ...noteEntries].sort(
      (left, right) => formatTimestampSort(right.createdAt) - formatTimestampSort(left.createdAt)
    );
  }, [linkedEvents, linkedMessages]);

  useEffect(() => {
    if (!ticket) return;
    setFollowUpDate(cleanText(ticket.data.followUpDate));
    setTicketTitle(cleanText(ticket.data.title));
  }, [ticket]);

  useEffect(() => {
    if (!ticket || serviceField || !suggestedServiceField) return;
    setServiceField(suggestedServiceField);
  }, [serviceField, suggestedServiceField, ticket]);

  useEffect(() => {
    setComposerMode('tenant');
    setDeliveryMode('email');
    setComposerText('');
    setAiInstruction('');
    setManualServiceEmail('');
  }, [ticketId]);

  function fillComposer(mode: ComposerMode) {
    setComposerMode(mode);
    setComposerText('');
    setAiInstruction('');
  }

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
    if (composerMode === 'note') {
      setError('FÃ¼r interne Notizen gibt es keinen KI-Entwurf.');
      return;
    }
    if (!sourceMessage) {
      setError('FÃ¼r dieses Ticket fehlt die Ausgangsnachricht oder Zuordnung.');
      return;
    }

    setMessage('');
    setError('');
    setIsGeneratingAiDraft(true);
    try {
      const response = await authorizedFetch('/api/ai/ticket-draft', {
        body: JSON.stringify({
          companyName: cleanText(company?.data.name),
          contextMode: 'reply',
          currentBody: cleanText(stripTrailingSignature(composerText, portalSignature)),
          issueText: issueFocus,
          instruction: cleanText(aiInstruction),
          mode: composerMode,
          propertyName: cleanText(property?.data.name),
          recipientEmail:
            composerMode === 'tenant'
              ? cleanText(tenant?.data.email)
              : serviceEmail,
          recipientName:
            composerMode === 'tenant'
              ? cleanText(tenantContact?.name)
              : selectedServiceName,
          recipientSalutation:
            composerMode === 'tenant'
              ? cleanText(tenantContact?.salutation || tenant?.data.salutation || inferredTenantSalutation)
              : '',
          senderCompanyName: cleanText(company?.data.name),
          tenantEmail: cleanText(tenantContact?.email),
          tenantName: cleanText(tenantContact?.name),
          tenantPhone: cleanText(tenantContact?.phone),
          ticketTitle: cleanText(ticketTitle),
          tradeLabel: cleanText(selectedServiceConfig?.label || focusAnalysis.tradeLabel),
          unitLabel,
        }),
        method: 'POST',
      });
      const result = (await response.json()) as { draftText?: string; error?: string; ok?: boolean };
      if (!response.ok || !result.ok || !result.draftText) {
        throw new Error(result.error || 'Der KI-Entwurf konnte nicht erzeugt werden.');
      }

      let nextComposerText = composePortalDraft({
          aiText: result.draftText,
          contextText: cleanText(sourceMessage?.data.bodyText),
          portalSignature,
          recipientName: composerMode === 'tenant' ? cleanText(tenantContact?.name) : selectedServiceName,
          recipientSalutation:
            composerMode === 'tenant'
              ? cleanText(tenantContact?.salutation || tenant?.data.salutation || inferredTenantSalutation)
              : '',
        });
      if (deliveryMode === 'letter') {
        nextComposerText = stripTrailingSignature(nextComposerText, portalSignature);
      }
      setComposerText(nextComposerText);
      setMessage('KI-Entwurf wurde erzeugt.');
    } catch (caughtError) {
      console.error('Fehler bei KI-Entwurf:', caughtError);
      setError(caughtError instanceof Error ? caughtError.message : 'Der KI-Entwurf konnte nicht erzeugt werden.');
    } finally {
      setIsGeneratingAiDraft(false);
    }
  }

  function runAction(action: () => Promise<void>) {
    setMessage('');
    setError('');
    startTransition(async () => {
      try {
        await action();
      } catch (caughtError) {
        console.error('Fehler in der Ticketansicht:', caughtError);
        setError(caughtError instanceof Error ? caughtError.message : 'Die Aktion konnte nicht ausgeführt werden.');
      }
    });
  }

  function addTicketEvent(text: string) {
    return addDoc(collection(db, 'ticketEvents'), {
      actorId: user?.uid || 'admin',
      actorType: 'admin',
      createdAt: serverTimestamp(),
      kind: 'manual_note',
      text,
      ticketId,
    });
  }

  async function createLetterRecord({
    recipientEmail,
    recipientId,
    recipientType,
    subject,
  }: {
    recipientEmail: string;
    recipientId: string;
    recipientType: 'contact' | 'tenant';
    subject: string;
  }) {
    const baseBody = stripTrailingSignature(cleanText(composerText), portalSignature);
    const portalBody = [baseBody, portalSignature].filter(Boolean).join('\n\n');
    const letterRecipient =
      recipientType === 'tenant'
        ? selectedTenantLetterRecipient
        : {
            address: buildAddressBlock([
              buildAddressLine([selectedServiceRecipient?.data.street, selectedServiceRecipient?.data.houseNumber]),
              buildAddressLine([selectedServiceRecipient?.data.postalCode, selectedServiceRecipient?.data.city]),
            ]),
            company:
              cleanText(selectedServiceRecipient?.data.partnerCompanyName) ||
              cleanText(selectedServiceRecipient?.data.companyName),
            name: selectedServiceName,
          };

    const letterHtml = buildLetterHtml({
      body: baseBody,
      context: {
        propertyName: cleanText(property?.data.name),
        unitLabel,
      },
      recipient: letterRecipient,
      signature: companySignature,
      subject,
    });

    await addDoc(collection(db, 'messages'), {
      attachments: [],
      bodyHtml: letterHtml,
      bodyText: portalBody,
      category: '',
      channel: 'letter',
      createdAt: serverTimestamp(),
      draftKind: recipientType === 'tenant' ? 'reply_to_tenant_letter' : 'service_request_letter',
      direction: 'outbound',
      fromEmail: cleanText(companySignature.email) || 'portal@halbmann-holding.de',
      fromName: cleanText(company?.data.name) || 'Halbmann Holding',
      priority: 'normal',
      propertyId: cleanText(property?.id),
      receivedAt: serverTimestamp(),
      recipientId,
      recipientType,
      relatedMessageId: cleanText(ticket?.data.sourceMessageId),
      status: 'sent',
      subject,
      tenantId: recipientType === 'tenant' ? recipientId : '',
      ticketId,
      toEmail: recipientEmail,
      unitId: cleanText(ticket?.data.unitId),
      updatedAt: serverTimestamp(),
      letterText: buildLetterText(baseBody, companySignature),
    });

    await addDoc(collection(db, 'ticketEvents'), {
      actorId: user?.uid || 'admin',
      actorType: 'admin',
      createdAt: serverTimestamp(),
      kind: 'letter_sent',
      text: `Brief wurde für ${recipientEmail || 'den Empfänger'} erstellt und im Verlauf dokumentiert.`,
      ticketId,
    });

    await updateDoc(doc(db, 'tickets', ticketId), {
      nextStep: 'Auf Rückmeldung warten',
      updatedAt: serverTimestamp(),
    });

    printLetterHtml(letterHtml, subject || 'Brief');
  }

  function changeStatus(status: string) {
    if (!ticket) return;
    runAction(async () => {
      await updateDoc(doc(db, 'tickets', ticket.id), { status, updatedAt: serverTimestamp() });
      setMessage('Ticketstatus wurde aktualisiert.');
    });
  }

  function saveTitle() {
    if (!ticket) return;
    runAction(async () => {
      await updateDoc(doc(db, 'tickets', ticket.id), {
        title: cleanText(ticketTitle),
        updatedAt: serverTimestamp(),
      });
      setMessage('Titel wurde gespeichert.');
    });
  }

  function deleteTicket() {
    if (!ticket) return;
    if (typeof window !== 'undefined' && !window.confirm('Sicher, dass du dieses Ticket löschen mÃ¶chtest?')) {
      return;
    }
    runAction(async () => {
      await updateDoc(doc(db, 'tickets', ticket.id), {
        status: 'deleted',
        updatedAt: serverTimestamp(),
      });
      router.push('/admin/tickets');
    });
  }

  function sendComposer() {
    if (!ticket || !cleanText(composerText)) return;

    if (composerMode === 'note') {
      runAction(async () => {
        await updateDoc(doc(db, 'tickets', ticket.id), {
          followUpDate: followUpDate || '',
          updatedAt: serverTimestamp(),
        });
        await addTicketEvent(cleanText(composerText));
        setComposerText('');
        setAiInstruction('');
        setMessage('Notiz wurde gespeichert.');
      });
      return;
    }

    if (composerMode === 'tenant') {
      if (!sourceMessage || !analysis) {
        setError('FÃ¼r dieses Ticket fehlt die Ausgangsnachricht oder Zuordnung.');
        return;
      }
      if (!tenant || ((deliveryMode === 'email' || deliveryMode === 'both') && !cleanText(tenant.data.email))) {
        setError('FÃ¼r den Mieter ist keine E-Mail-Adresse hinterlegt.');
        return;
      }

      runAction(async () => {
        await updateDoc(doc(db, 'tickets', ticket.id), {
          followUpDate: followUpDate || '',
          updatedAt: serverTimestamp(),
        });
        const baseBody = stripTrailingSignature(cleanText(composerText), portalSignature);
        const portalBody = [baseBody, portalSignature].filter(Boolean).join('\n\n');
        const emailBody = mergeBodyWithSignature(baseBody, companySignature);
        const subject =
          cleanText(ticketTitle) || cleanText(ticket.data.ticketNumber) || 'Nachricht zu Ihrem Anliegen';

        if (deliveryMode === 'email' || deliveryMode === 'both') {
          const draftRef = await addDoc(collection(db, 'messageDrafts'), {
            attachments: [],
            body: emailBody,
            createdAt: serverTimestamp(),
            kind: 'reply_to_tenant',
            messageId: cleanText(ticket.data.sourceMessageId) || null,
            portalBodyText: portalBody,
            propertyId: cleanText(property?.id),
            recipientEmail: cleanText(tenant.data.email),
            recipientId: tenant.id,
            recipientType: 'tenant',
            signature: companySignature,
            status: 'draft',
            subject,
            ticketId,
            unitId: cleanText(ticket.data.unitId),
            updatedAt: serverTimestamp(),
          });

          const response = await authorizedFetch('/api/message-drafts/send', {
            body: JSON.stringify({ draftId: draftRef.id }),
            method: 'POST',
          });
          const result = (await response.json()) as { error?: string; ok?: boolean };
          if (!response.ok || !result.ok) {
            throw new Error(result.error || 'Die Nachricht an den Mieter konnte nicht versendet werden.');
          }
        }

        if (deliveryMode === 'letter' || deliveryMode === 'both') {
          await createLetterRecord({
            recipientEmail: cleanText(tenant.data.email),
            recipientId: tenant.id,
            recipientType: 'tenant',
            subject,
          });
        }
        if (cleanText(followUpDate)) {
          await addDoc(collection(db, 'followUps'), {
            createdAt: serverTimestamp(),
            dueDate: followUpDate,
            message: 'RÃ¼ckmeldung des Mieters im Ticket prÃ¼fen',
            propertyId: cleanText(property?.id),
            status: 'open',
            targetId: tenant.id,
            targetType: 'tenant',
            ticketId,
            unitId: cleanText(ticket.data.unitId),
          });
        }

        setComposerText('');
        setAiInstruction('');
        setMessage(
          deliveryMode === 'both'
            ? 'Mail und Brief an den Mieter wurden verarbeitet.'
            : deliveryMode === 'letter'
              ? 'Brief an den Mieter wurde im Verlauf dokumentiert.'
              : 'Nachricht an den Mieter wurde versendet.'
        );
      });
      return;
    }

    if (!sourceMessage || !analysis || !property) {
      setError('Für dieses Ticket fehlt die Zuordnung zum Gewerk.');
      return;
    }
    if ((deliveryMode === 'email' || deliveryMode === 'both') && !serviceEmail) {
      setError('Für das gewählte Gewerk ist keine E-Mail-Adresse hinterlegt.');
      return;
    }

    runAction(async () => {
      await updateDoc(doc(db, 'tickets', ticket.id), {
        followUpDate: followUpDate || '',
        updatedAt: serverTimestamp(),
      });
      const baseBody = stripTrailingSignature(cleanText(composerText), portalSignature);
      const previewBody = [baseBody, portalSignature].filter(Boolean).join('\n\n');
      const emailBody = mergeBodyWithSignature(baseBody, companySignature);
      const subject = cleanText(ticketTitle) || cleanText(ticket.data.ticketNumber) || 'Beauftragung';

      if (deliveryMode === 'email' || deliveryMode === 'both') {
        const draftRef = await addDoc(collection(db, 'messageDrafts'), {
          attachments: [],
          body: emailBody,
          createdAt: serverTimestamp(),
          kind: 'service_request',
          messageId: cleanText(ticket.data.sourceMessageId) || null,
          portalBodyText: previewBody,
          propertyId: cleanText(property?.id),
          recipientEmail: serviceEmail,
          recipientId: selectedServiceRecipient?.id || '',
          recipientType: 'contact',
          signature: companySignature,
          status: 'draft',
          subject,
          ticketId,
          unitId: cleanText(ticket.data.unitId),
          updatedAt: serverTimestamp(),
        });

        const response = await authorizedFetch('/api/message-drafts/send', {
          body: JSON.stringify({ draftId: draftRef.id }),
          method: 'POST',
        });
        const result = (await response.json()) as { error?: string; ok?: boolean };
        if (!response.ok || !result.ok) {
          throw new Error(result.error || 'Die Nachricht an das Gewerk konnte nicht versendet werden.');
        }
      }

      if (deliveryMode === 'letter' || deliveryMode === 'both') {
        await createLetterRecord({
          recipientEmail: serviceEmail,
          recipientId: selectedServiceRecipient?.id || '',
          recipientType: 'contact',
          subject,
        });
      }
      if (cleanText(followUpDate)) {
        await addDoc(collection(db, 'followUps'), {
          createdAt: serverTimestamp(),
          dueDate: followUpDate,
          message: 'Rückmeldung des Gewerks im Ticket prüfen',
          propertyId: cleanText(property?.id),
          status: 'open',
          targetId: selectedServiceRecipient?.id || '',
          targetType: 'contact',
          ticketId,
          unitId: cleanText(ticket.data.unitId),
        });
      }

      setComposerText('');
      setAiInstruction('');
      setMessage(
        deliveryMode === 'both'
          ? 'Mail und Brief an das Gewerk wurden verarbeitet.'
          : deliveryMode === 'letter'
            ? 'Brief an das Gewerk wurde im Verlauf dokumentiert.'
            : 'Nachricht an das Gewerk wurde versendet.'
      );
    });
  }

  if (!ticket) {
    return (
      <div className="space-y-5">
        <Link
          className="inline-flex rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400"
          href="/admin/tickets"
        >
          Zurück zur Ticketliste
        </Link>
        <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-sm leading-6 text-slate-600">
          Dieses Ticket wurde nicht gefunden oder ist nicht mehr verfügbar.
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 space-y-3 pt-11">
      <Link
        className="absolute left-0 top-0 z-20 inline-flex rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-[0_16px_34px_-26px_rgba(148,119,77,0.38)] transition hover:border-stone-400"
        href="/admin/tickets"
      >
        Zurück
      </Link>

      <div className="absolute left-20 right-20 top-1 xl:right-24">
        <div className="flex min-w-0 items-center gap-x-3 overflow-hidden whitespace-nowrap pr-2 text-[11px] leading-5 text-slate-600">
          <span className="shrink-0">Firma: {shortenText(company?.data.name, 15) || 'Nicht zugeordnet'}</span>
          <span className="shrink-0 text-slate-400">•</span>
          <span className="truncate">Immobilie: {cleanText(property?.data.name) || 'Nicht zugeordnet'}</span>
          <span className="shrink-0 text-slate-400">•</span>
          <span className="shrink-0">Einheit: {unitLabel || 'Nicht zugeordnet'}</span>
          <span className="shrink-0 text-slate-400">•</span>
          <span className="shrink-0">Mieter: {tenantLabel || 'Nicht zugeordnet'}</span>
          <span className="shrink-0 text-slate-400">•</span>
          <span className="truncate">
            An:{' '}
            {composerMode === 'tenant'
              ? cleanText(tenantContact?.email) || 'keine E-Mail'
              : composerMode === 'service'
                ? serviceEmail || 'keine E-Mail'
                : 'Interne Notiz'}
          </span>
        </div>
      </div>

      <section className="rounded-[20px] border border-stone-200 bg-white p-3 shadow-[0_18px_42px_-32px_rgba(148,119,77,0.28)]">
        <div className="rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                className="min-w-[260px] rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-sm leading-5 text-slate-900 outline-none transition focus:border-amber-700/60"
                onChange={(event) => setTicketTitle(event.target.value)}
                value={ticketTitle}
              />
              <ActionButton disabled={isPending || !cleanText(ticketTitle)} onClick={saveTitle}>
                Titel speichern
              </ActionButton>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <label className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs text-slate-700">
                <span>Versand</span>
                <select
                  className="bg-transparent text-xs font-medium text-slate-900 outline-none"
                  disabled={isPending || composerMode === 'note'}
                  onChange={(event) => setDeliveryMode(cleanText(event.target.value) as DeliveryMode)}
                  value={deliveryMode}
                >
                  <option value="email">Mail</option>
                  <option value="letter">Brief</option>
                  <option value="both">Beides</option>
                </select>
              </label>
              <label className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs text-slate-700">
                <span>Status</span>
                <select
                  className="bg-transparent text-xs font-medium text-slate-900 outline-none"
                  disabled={isPending}
                  onChange={(event) => {
                    const nextStatus = cleanText(event.target.value);
                    if (nextStatus && nextStatus !== cleanText(ticket.data.status)) {
                      changeStatus(nextStatus);
                    }
                  }}
                  value={cleanText(ticket.data.status)}
                >
                  <option value="new">Neu</option>
                  <option value="in_progress">In Bearbeitung</option>
                  <option value="done">Erledigt</option>
                </select>
              </label>
              <ActionButton disabled={isPending} onClick={deleteTicket} tone="danger">
                Ticket löschen
              </ActionButton>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <ActionButton active={composerMode === 'tenant'} onClick={() => fillComposer('tenant')}>
                Mieter
              </ActionButton>
              <ActionButton active={composerMode === 'service'} onClick={() => fillComposer('service')}>
                Gewerk
              </ActionButton>
              <ActionButton active={composerMode === 'note'} onClick={() => fillComposer('note')}>
                Notiz
              </ActionButton>
            </div>
          </div>

          {composerMode === 'service' ? (
            <label className="mt-3 block">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Gewerk oder E-Mail</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  className="min-w-[220px] rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                  onChange={(event) => {
                    setServiceField(event.target.value);
                    setComposerMode('service');
                  }}
                  value={selectedServiceField}
                >
                  <option value="">Gewerk wählen</option>
                  {servicePartnerFields.map((entry) => (
                    <option key={entry.idField} value={entry.idField}>
                      {entry.label}
                      {entry.idField === suggestedServiceField ? ' – Vorschlag' : ''}
                    </option>
                  ))}
                </select>
                <input
                  className="min-w-[260px] flex-1 rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                  onChange={(event) => setManualServiceEmail(event.target.value)}
                  placeholder="oder E-Mail manuell eingeben"
                  type="email"
                  value={manualServiceEmail}
                />
              </div>
            </label>
          ) : null}

          <label className="mt-3 block">
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton disabled={isGeneratingAiDraft || composerMode === 'note'} onClick={generateAiDraft}>
                {isGeneratingAiDraft ? 'KI schreibt…' : 'KI-Entwurf'}
              </ActionButton>
              <input
                className="min-w-[280px] flex-1 rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                onChange={(event) => setAiInstruction(event.target.value)}
                placeholder="KI-Hinweis"
                value={aiInstruction}
              />
              <ActionButton disabled={isGeneratingAiDraft || composerMode === 'note'} onClick={generateAiDraft}>
                Anwenden
              </ActionButton>
            </div>
          </label>

          {deliveryMode === 'letter' && composerMode !== 'note' ? (
            <LetterComposeEditor
              body={composerText}
              className="mt-3 rounded-2xl border border-stone-300 bg-stone-50"
              onChange={setComposerText}
              onRecipientChange={composerMode === 'tenant' ? setLetterRecipientKey : undefined}
              placeholder={
                composerMode === 'tenant' ? 'Nachricht an den Mieter' : 'Nachricht an das Gewerk'
              }
              recipient={
                composerMode === 'tenant'
                  ? selectedTenantLetterRecipient
                  : {
                      address: buildAddressBlock([
                        buildAddressLine([
                          selectedServiceRecipient?.data.street,
                          selectedServiceRecipient?.data.houseNumber,
                        ]),
                        buildAddressLine([
                          selectedServiceRecipient?.data.postalCode,
                          selectedServiceRecipient?.data.city,
                        ]),
                      ]),
                      company:
                        cleanText(selectedServiceRecipient?.data.partnerCompanyName) ||
                        cleanText(selectedServiceRecipient?.data.companyName),
                      name: selectedServiceName,
                    }
              }
              recipientOptions={composerMode === 'tenant' ? tenantLetterRecipientOptions : undefined}
              selectedRecipientKey={composerMode === 'tenant' ? letterRecipientKey : undefined}
              context={{
                propertyName: cleanText(property?.data.name),
                unitLabel,
              }}
              signature={companySignature}
              subject={cleanText(ticketTitle) || cleanText(ticket.data.ticketNumber) || 'Nachricht'}
            />
          ) : (
            <textarea
              className="mt-3 min-h-[340px] w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-700/60"
              lang="de"
              onChange={(event) => setComposerText(event.target.value)}
              placeholder={
                composerMode === 'tenant'
                  ? 'Nachricht an den Mieter'
                  : composerMode === 'service'
                    ? 'Nachricht an das Gewerk'
                    : 'Interne Notiz'
              }
              spellCheck={false}
              value={composerText}
            />
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ActionButton disabled={isPending || !cleanText(composerText)} onClick={sendComposer}>
              {composerMode === 'note' ? 'Notiz speichern' : 'Senden'}
            </ActionButton>
            <label className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs text-slate-700">
              <span>Wiedervorlage</span>
              <input
                className="bg-transparent text-xs text-slate-900 outline-none"
                onChange={(event) => setFollowUpDate(event.target.value)}
                type="date"
                value={followUpDate}
              />
            </label>
          </div>
        </div>

        <div className="mt-3 max-h-[82vh] space-y-3 overflow-y-auto pr-1">
          {timeline.map((entry) => {
            const cardClass =
              entry.kind === 'tenant_outbound'
                ? 'ml-14 border-amber-200 bg-amber-50/80'
                : entry.kind === 'tenant_inbound'
                  ? 'mr-14 border-stone-200 bg-stone-50/90'
                  : entry.kind === 'service'
                    ? 'mr-8 border-sky-200 bg-sky-50/75'
                    : 'mr-10 border-violet-200 bg-violet-50/70';

            return (
              <article className={`rounded-[16px] border px-3 py-2.5 ${cardClass}`} key={entry.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-700">{entry.label}</p>
                  <span className="text-[11px] text-slate-500">{formatDateTime(entry.createdAt)}</span>
                </div>
                {entry.html ? (
                  <div className="mt-2 overflow-hidden rounded-[14px] border border-stone-200 bg-white">
                    <div dangerouslySetInnerHTML={{ __html: entry.html }} />
                  </div>
                ) : (
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-5 text-slate-800">
                    {entry.text || 'Kein Inhalt vorhanden.'}
                  </div>
                )}
              </article>
            );
          })}
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

