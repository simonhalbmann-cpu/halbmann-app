'use client';

import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, type DocumentData } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { formatDateTime, formatTimestampSort, type WorkflowRecord } from '../../lib/adminWorkflow';
import { db, storage } from '../../lib/firebase';
import { sanitizeAiContext } from '../../lib/aiContext';
import {
  cleanStoredDocuments,
  createClientId,
  sanitizeStorageFileName,
  type StoredDocumentEntry,
} from '../../lib/tenantDocuments';
import { composeMessageDraft } from '../../lib/draftComposer';
import { personDocumentFields } from './personConfig';
import { buildLetterHtml, buildMessageSignatureText, createSignatureRecord, mergeBodyWithSignature } from '../../lib/signatures';
import { applyAdminSenderToSignature, resolveAdminSenderContact } from './adminSenderSignature';
import DocumentUploadControl from './DocumentUploadControl';
import DocumentLibrarySection from './DocumentLibrarySection';
import MessageAttachmentPreview, { type MessageAttachmentEntry } from './MessageAttachmentPreview';
import OutgoingAttachmentPicker, { type PendingOutgoingAttachment } from './OutgoingAttachmentPicker';
import { uploadOutgoingMessageAttachments } from '../../lib/outgoingMessageAttachments';
import type { LocalMessageTheme } from '../../lib/localMessageThemes';
import { buildMessageThemes, type MessageTheme } from '../../lib/messageThemes';
import { buildLetterTemplateReplacements, downloadFilledLetterTemplate } from './letterOfficeExport';

type PersonDetailViewProps = {
  personId: string;
};

type PersonData = Record<string, unknown>;
type PersonDeliveryMode = 'both' | 'email' | 'letter' | 'note';

const personCategoryLabels: Record<string, string> = {
  electrician: 'Elektriker',
  plumbing: 'Sanitaer / Rohrreinigung',
  heating_service: 'Heizungsdienst',
  waste_collection: 'Muellabfuhrunternehmen',
  billing_service: 'Abrechnungsunternehmen',
  winter_service: 'Winterdienst',
  cleaning_service: 'Reinigungsdienst',
  roof_maintenance: 'Dachwartung',
  gutter_cleaning: 'Regenrinnenreinigung',
  craftsperson: 'Handwerker / Dienstleister allgemein',
  partner_company: 'Partnerfirma / externer Kontakt',
  caretaker: 'Hausmeister',
  tax_advisor: 'Steuerberater',
  guarantor: 'Buerge',
  manager: 'Verwalter',
  other: 'Sonstige Person',
};

const personSalutationLabels: Record<string, string> = {
  mr: 'Herr',
  ms: 'Frau',
  diverse: 'Divers',
  none: 'Ohne Angabe',
};

const preferredContactMethodLabels: Record<string, string> = {
  email: 'E-Mail',
  phone: 'Telefon',
  mobile: 'Mobil',
  portal: 'Online',
  mail: 'Post',
};

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

function formatValue(value?: unknown) {
  return cleanText(value) || 'â€“';
}

function translatePersonCategory(value?: unknown) {
  const text = cleanText(value);
  return personCategoryLabels[text] ?? text;
}

function translatePersonSalutation(value?: unknown) {
  const text = cleanText(value);
  return personSalutationLabels[text] ?? text;
}

function translatePreferredContactMethod(value?: unknown) {
  const text = cleanText(value);
  return preferredContactMethodLabels[text] ?? text;
}

function formatFileSize(value: unknown) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function buildAddressLine(parts: Array<unknown>) {
  return parts.map((entry) => cleanText(entry)).filter(Boolean).join(' ');
}

function buildAddressBlock(lines: Array<unknown>) {
  return lines.map((entry) => cleanText(entry)).filter(Boolean).join('\n');
}

export default function PersonDetailView({ personId }: PersonDetailViewProps) {
  const { profile, user } = useAuth();
  const router = useRouter();
  const [person, setPerson] = useState<PersonData | null>(null);
  const [messages, setMessages] = useState<WorkflowRecord[]>([]);
  const [messageThemes, setMessageThemes] = useState<LocalMessageTheme[]>([]);
  const [tenants, setTenants] = useState<WorkflowRecord[]>([]);
  const [people, setPeople] = useState<WorkflowRecord[]>([]);
  const [companies, setCompanies] = useState<WorkflowRecord[]>([]);
  const [properties, setProperties] = useState<WorkflowRecord[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<PendingOutgoingAttachment[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState('');
  const [messageAction, setMessageAction] = useState<'done' | 'merge' | 'reassign' | 'save' | 'split'>('save');
  const [messageActionTargetId, setMessageActionTargetId] = useState('');
  const [messageSubjectDraft, setMessageSubjectDraft] = useState('');
  const [personMessageSearch, setPersonMessageSearch] = useState('');
  const [aiInstruction, setAiInstruction] = useState('');
  const [contextMode, setContextMode] = useState<'new' | 'reply'>('reply');
  const [personComposerMode, setPersonComposerMode] = useState<'contact' | 'note'>('contact');
  const [personDeliveryMode, setPersonDeliveryMode] = useState<PersonDeliveryMode>('email');
  const [followUpDate, setFollowUpDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [deletingDocumentPath, setDeletingDocumentPath] = useState('');
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState(false);
  const [isPending, startTransition] = useTransition();
  const contactThemeTenantId = `contact:${personId}`;

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

        setPerson(snapshot.data() as PersonData);
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
    const unsubscribeTenants = onSnapshot(query(collection(db, 'tenants')), (snapshot) => {
      setTenants(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id })));
    });
    const unsubscribePeople = onSnapshot(query(collection(db, 'people')), (snapshot) => {
      setPeople(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id })));
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
        console.error(`Fehler beim Laden des Chatverlaufs fÃ¼r Kontakt ${personId}:`, caughtError);
      }
    );

    return () => {
      unsubscribe();
      unsubscribeTenants();
      unsubscribePeople();
      unsubscribeCompanies();
      unsubscribeProperties();
      unsubscribeMessages();
    };
  }, [personId]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function loadMessageThemes() {
      try {
        const response = await authorizedFetch('/api/admin/message-themes');
        const result = (await response.json().catch(() => null)) as {
          ok?: boolean;
          themes?: LocalMessageTheme[];
        } | null;

        if (!cancelled && response.ok && result?.ok) {
          setMessageThemes(Array.isArray(result.themes) ? result.themes : []);
        }
      } catch {
        console.warn('Fehler beim Laden der Themen im Dienstleisterbereich.');
      }
    }

    void loadMessageThemes();
    const intervalId = window.setInterval(() => {
      void loadMessageThemes();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [user]);

  const availableDocuments = useMemo(() => {
    if (!person) return [];
    return personDocumentFields.filter((field) => cleanText(person[field.name]).length > 0);
  }, [person]);

  const personDocuments = useMemo(() => cleanStoredDocuments(person?.personDocuments), [person]);

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
  const personThemeRecords = useMemo(
    () =>
      personMessages.map((entry) => ({
        ...entry,
        data: {
          ...entry.data,
          tenantId: contactThemeTenantId,
        },
      })),
    [contactThemeTenantId, personMessages]
  );
  const personThemes = useMemo(
    () =>
      buildMessageThemes(
        personThemeRecords,
        messageThemes.filter((theme) => theme.tenantId === contactThemeTenantId)
      ),
    [contactThemeTenantId, messageThemes, personThemeRecords]
  );
  const selectedPersonTheme = useMemo(() => {
    const selected =
      personThemes.find(
        (theme) =>
          theme.id === selectedMessageId || theme.records.some((entry) => entry.id === selectedMessageId)
      ) ??
      personThemes.find((theme) => !theme.archived) ??
      personThemes[0] ??
      null;
    return selected;
  }, [personThemes, selectedMessageId]);
  const selectedPersonMessage = useMemo(
    () => selectedPersonTheme?.latestInbound ?? selectedPersonTheme?.latestEntry ?? null,
    [selectedPersonTheme]
  );
  const selectedPersonThreadMessages = useMemo(
    () =>
      selectedPersonTheme
        ? [...selectedPersonTheme.records].sort(
            (left, right) =>
              formatTimestampSort(left.data.receivedAt ?? left.data.createdAt) -
              formatTimestampSort(right.data.receivedAt ?? right.data.createdAt)
          )
        : [],
    [selectedPersonTheme]
  );
  const filteredPersonThemes = useMemo(() => {
    const needle = cleanText(personMessageSearch).toLocaleLowerCase('de-DE');
    if (!needle) return personThemes;
    return personThemes.filter((theme) =>
      [
        theme.subject,
        theme.latestEntry.data.subject,
        theme.latestEntry.data.bodyText,
        theme.latestEntry.data.fromEmail,
        theme.latestEntry.data.recipientEmail,
        theme.latestEntry.data.fromName,
      ]
        .map((value) => cleanText(value).toLocaleLowerCase('de-DE'))
        .join(' ')
        .includes(needle)
    );
  }, [personMessageSearch, personThemes]);
  const chronologicalPersonMessages = useMemo(() => [...personMessages].reverse(), [personMessages]);
  const filteredPersonMessages = useMemo(() => {
    const needle = cleanText(personMessageSearch).toLocaleLowerCase('de-DE');
    if (!needle) return personMessages;
    return personMessages.filter((entry) =>
      [
        entry.data.subject,
        entry.data.bodyText,
        entry.data.fromEmail,
        entry.data.recipientEmail,
        entry.data.fromName,
      ]
        .map((value) => cleanText(value).toLocaleLowerCase('de-DE'))
        .join(' ')
        .includes(needle)
    );
  }, [personMessageSearch, personMessages]);
  const messageMergeOptions = useMemo(
    () =>
      personThemes
        .filter((entry) => entry.id !== selectedPersonTheme?.id)
        .sort((left, right) =>
          cleanText(left.subject || left.latestEntry.data.fromName).localeCompare(
            cleanText(right.subject || right.latestEntry.data.fromName),
            'de'
          )
        ),
    [personThemes, selectedPersonTheme?.id]
  );
  const reassignContactOptions = useMemo(() => {
    const tenantOptions = tenants.map((entry) => {
      const label =
        [cleanText(entry.data.lastName), cleanText(entry.data.firstName)].filter(Boolean).join(', ') ||
        cleanText(entry.data.email) ||
        entry.id;
      return {
        id: `tenant:${entry.id}`,
        label,
        rawId: entry.id,
        targetType: 'tenant' as const,
      };
    });
    const personOptions = people.map((entry) => {
      const label =
        [cleanText(entry.data.lastName), cleanText(entry.data.firstName)].filter(Boolean).join(', ') ||
        cleanText(entry.data.partnerCompanyName || entry.data.companyName) ||
        cleanText(entry.data.email) ||
        entry.id;
      return {
        id: `contact:${entry.id}`,
        label,
        rawId: entry.id,
        targetType: 'contact' as const,
      };
    });
    return [
      {
        id: `new:${encodeURIComponent(cleanText(selectedPersonTheme?.latestInbound?.data.fromEmail))}`,
        label: 'Neu',
        rawId: '__new__',
        targetType: 'contact' as const,
      },
      ...tenantOptions,
      ...personOptions,
    ]
      .filter((entry) => entry.rawId !== personId || entry.targetType !== 'contact')
      .sort((left, right) => left.label.localeCompare(right.label, 'de'));
  }, [people, personId, tenants]);

  useEffect(() => {
    if (personThemes.length === 0) {
      setSelectedMessageId('');
      return;
    }

    setSelectedMessageId((current) =>
      current && personThemes.some((entry) => entry.id === current || entry.records.some((record) => record.id === current))
        ? current
        : personThemes[0].id
    );
  }, [personThemes]);

  useEffect(() => {
    setMessageSubjectDraft(cleanText(selectedPersonMessage?.data.subject));
    setMessageActionTargetId('');
    setMessageAction('save');
  }, [selectedPersonMessage?.id]);

  useEffect(() => {
    setMessageActionTargetId('');
  }, [messageAction]);

  const selectedProperty =
    properties.find((entry) => cleanText(entry.data.name) === cleanText(person?.propertyName)) ?? null;
  const selectedCompany =
    companies.find((entry) => cleanText(entry.id) === cleanText(selectedProperty?.data.ownerId)) ??
    companies.find((entry) => cleanText(entry.data.name) === cleanText(person?.partnerCompanyName || person?.companyName)) ??
    null;
  const messageSignature = buildMessageSignatureText(
    applyAdminSenderToSignature(
      createSignatureRecord((selectedCompany?.data as Record<string, unknown>) ?? null),
      resolveAdminSenderContact(profile, user)
    )
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

  async function uploadPersonDocuments(files: File[] | FileList | null, category = 'Sonstiges') {
    if (!files || files.length === 0 || !person) return;

    setError('');
    setMessage('');
    setIsUploadingDocument(true);

    try {
      const uploadedDocuments: StoredDocumentEntry[] = [];

      for (const file of Array.from(files)) {
        const safeName = sanitizeStorageFileName(file.name);
        const storagePath = `person-documents/${personId}/${Date.now()}-${createClientId('file')}-${safeName}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file, {
          contentType: file.type || 'application/octet-stream',
        });

        uploadedDocuments.push({
          category,
          contentType: file.type || 'application/octet-stream',
          name: file.name,
          path: storagePath,
          size: file.size,
          source: 'upload',
          uploadedAt: new Date().toISOString(),
          uploadedByEmail: user?.email ?? '',
          url: await getDownloadURL(storageRef),
        });
      }

      await updateDoc(doc(db, 'people', personId), {
        personDocuments: [...personDocuments, ...uploadedDocuments],
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });

      setMessage(uploadedDocuments.length === 1 ? 'Dokument wurde hochgeladen.' : 'Dokumente wurden hochgeladen.');
    } catch (caughtError) {
      console.error(`Fehler beim Hochladen von Dokumenten fuer Kontakt ${personId}:`, caughtError);
      setError('Dokumente konnten nicht hochgeladen werden.');
    } finally {
      setIsUploadingDocument(false);
    }
  }

  async function updatePersonDocumentCategory(targetDocument: StoredDocumentEntry, category: string) {
    setError('');
    setMessage('');

    try {
      await updateDoc(doc(db, 'people', personId), {
        personDocuments: personDocuments.map((document) =>
          (targetDocument.path && document.path === targetDocument.path) ||
          (!targetDocument.path && document.url === targetDocument.url)
            ? { ...document, category }
            : document
        ),
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });
      setMessage('Kategorie wurde aktualisiert.');
    } catch (caughtError) {
      console.error(`Fehler beim Aktualisieren der Dokumentkategorie fuer Kontakt ${personId}:`, caughtError);
      setError('Kategorie konnte nicht gespeichert werden.');
    }
  }

  async function deleteMessageAttachment(messageId: string, attachments: unknown, targetAttachment: MessageAttachmentEntry) {
    const confirmed = window.confirm(`Anhang "${targetAttachment.name}" wirklich löschen?`);
    if (!confirmed) return;

    const currentAttachments = Array.isArray(attachments) ? attachments : [];
    try {
      if (targetAttachment.path) {
        await deleteObject(ref(storage, targetAttachment.path));
      }
      await updateDoc(doc(db, 'messages', messageId), {
        attachments: currentAttachments.filter((entry) => {
          if (!entry || typeof entry !== 'object') return true;
          const raw = entry as Record<string, unknown>;
          return cleanText(raw.path) !== targetAttachment.path && cleanText(raw.url) !== targetAttachment.url;
        }),
        updatedAt: serverTimestamp(),
      });
      setMessage('Anhang wurde gelöscht.');
    } catch (caughtError) {
      console.error(`Fehler beim Löschen des Anhangs ${targetAttachment.name}:`, caughtError);
      setError('Anhang konnte nicht gelöscht werden.');
    }
  }

  async function deletePersonDocument(targetDocument: StoredDocumentEntry) {
    const confirmed = window.confirm(`Dokument "${targetDocument.name}" wirklich loeschen?`);
    if (!confirmed) return;

    setError('');
    setMessage('');
    setDeletingDocumentPath(targetDocument.path || targetDocument.url);

    try {
      if (targetDocument.path) {
        await deleteObject(ref(storage, targetDocument.path));
      }

      await updateDoc(doc(db, 'people', personId), {
        personDocuments: personDocuments.filter(
          (document) =>
            (targetDocument.path && document.path !== targetDocument.path) ||
            (!targetDocument.path && document.url !== targetDocument.url)
        ),
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });

      setMessage('Dokument wurde geloescht.');
    } catch (caughtError) {
      console.error(`Fehler beim Loeschen eines Dokuments fuer Kontakt ${personId}:`, caughtError);
      setError('Dokument konnte nicht geloescht werden.');
    } finally {
      setDeletingDocumentPath('');
    }
  }

  function extractMessageAttachmentDocuments(messageRecord: WorkflowRecord) {
    const attachments = Array.isArray(messageRecord.data.attachments) ? messageRecord.data.attachments : [];
    const documents: StoredDocumentEntry[] = [];
    const seenKeys = new Set<string>();

    attachments.forEach((attachment) => {
      if (!attachment || typeof attachment !== 'object') return;
      const raw = attachment as Record<string, unknown>;
      const path = cleanText(raw.path);
      const url = cleanText(raw.url ?? raw.downloadUrl ?? raw.href);
      const key = path || url;
      if (!key || seenKeys.has(key)) return;
      seenKeys.add(key);
      documents.push({
        category: 'Anhänge',
        contentType: cleanText(raw.contentType) || 'application/octet-stream',
        name: cleanText(raw.name ?? raw.fileName) || 'Anhang',
        path,
        size: Number(raw.size) || 0,
        source: 'message-attachment',
        uploadedAt: cleanText(raw.uploadedAt ?? messageRecord.data.receivedAt ?? messageRecord.data.createdAt) || new Date().toISOString(),
        uploadedByEmail: user?.email ?? '',
        url,
      });
    });

    return documents;
  }

  async function savePersonThemeMeta(
    themeId: string,
    payload: {
      archived: boolean;
      messageIds?: string[];
      reminderDate?: string;
      sourceType?: 'admin_message' | 'manual' | 'tenant_message';
      status: 'done' | 'in_progress' | 'needs_review' | 'new';
      title?: string;
    }
  ) {
    const currentTheme = personThemes.find((theme) => theme.id === themeId) ?? selectedPersonTheme ?? null;
    const now = new Date().toISOString();
    const nextTitle =
      cleanText(payload.title) ||
      cleanText(currentTheme?.subject) ||
      cleanText(currentTheme?.latestEntry.data.subject) ||
      cleanText(currentTheme?.latestEntry.data.fromName) ||
      'Nachricht';
    const messageIds =
      payload.messageIds ??
      currentTheme?.records.map((entry) => entry.id) ??
      (selectedPersonMessage ? [selectedPersonMessage.id] : []);

    const response = await authorizedFetch('/api/admin/message-themes', {
      method: 'POST',
      body: JSON.stringify({
        archived: payload.archived,
        id: themeId,
        lastActivityAt: now,
        messageIds,
        reminderDate: cleanText(payload.reminderDate) || undefined,
        sourceType: payload.sourceType || currentTheme?.sourceType || 'manual',
        status: payload.status,
        tenantId: contactThemeTenantId,
        title: nextTitle,
      }),
    });
    const result = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Der Themenstatus konnte nicht gespeichert werden.');
    }

    setMessageThemes((current) => {
      const nextTheme = {
        archived: payload.archived,
        createdAt: current.find((theme) => theme.id === themeId)?.createdAt ?? now,
        id: themeId,
        lastActivityAt: now,
        messageIds,
        reminderDate: cleanText(payload.reminderDate) || undefined,
        sourceType: payload.sourceType || 'manual',
        status: payload.status,
        tenantId: contactThemeTenantId,
        title: nextTitle,
        updatedAt: now,
      } satisfies LocalMessageTheme;

      return current.some((theme) => theme.id === themeId)
        ? current.map((theme) => (theme.id === themeId ? { ...theme, ...nextTheme } : theme))
        : [nextTheme, ...current];
    });
  }

  async function saveSelectedMessageSubject() {
    if (!selectedPersonTheme) return;
    await savePersonThemeMeta(selectedPersonTheme.id, {
      archived: Boolean(selectedPersonTheme.archived),
      messageIds: selectedPersonTheme.records.map((entry) => entry.id),
      sourceType: (selectedPersonTheme.sourceType as 'admin_message' | 'manual' | 'tenant_message') || 'manual',
      status: (cleanText(selectedPersonTheme.status) as 'done' | 'in_progress' | 'needs_review' | 'new') || 'in_progress',
      title:
        cleanText(messageSubjectDraft) ||
        cleanText(selectedPersonTheme.subject) ||
        cleanText(selectedPersonMessage?.data.subject) ||
        'Nachricht',
    });
  }

  async function reassignSelectedPersonMessage(targetValue: string) {
    if (!selectedPersonTheme) return;
    const [targetType, targetId] = targetValue.split(':');
    if (targetType === 'new') {
      const email = decodeURIComponent(targetId || cleanText(selectedPersonTheme.latestInbound?.data.fromEmail));
      router.push(`/admin/personen?email=${encodeURIComponent(email)}&fromMessageId=${encodeURIComponent(selectedPersonTheme.latestEntry.id)}`);
      return;
    }
    if (!targetId || (targetType !== 'tenant' && targetType !== 'contact')) {
      throw new Error('Bitte einen Empfaenger fuer die Neu-Zuordnung auswaehlen.');
    }

    const targetTenant = targetType === 'tenant' ? tenants.find((entry) => entry.id === targetId) ?? null : null;
    const targetPerson = targetType === 'contact' ? people.find((entry) => entry.id === targetId) ?? null : null;
    const targetName =
      targetTenant
        ? [cleanText(targetTenant.data.lastName), cleanText(targetTenant.data.firstName)].filter(Boolean).join(', ')
        : targetPerson
          ? [cleanText(targetPerson.data.lastName), cleanText(targetPerson.data.firstName)].filter(Boolean).join(', ') ||
            cleanText(targetPerson.data.partnerCompanyName || targetPerson.data.companyName)
          : '';
    const targetEmail = targetTenant ? cleanText(targetTenant.data.email) : cleanText(targetPerson?.data.email);

    await Promise.all(
      selectedPersonTheme.records.map((entry) =>
        updateDoc(doc(db, 'messages', entry.id), {
          contactId: targetType === 'contact' ? targetId : '',
          propertyId: targetTenant ? cleanText(targetTenant.data.propertyId) : cleanText(entry.data.propertyId),
          recipientEmail: targetEmail,
          recipientId: targetId,
          recipientName: targetName,
          recipientType: targetType,
          tenantId: targetType === 'tenant' ? targetId : '',
          tenantLabel: targetType === 'tenant' ? targetName : '',
          unitId: targetTenant ? cleanText(targetTenant.data.unitId) : cleanText(entry.data.unitId),
          updatedAt: serverTimestamp(),
        })
      )
    );

    const attachmentDocuments = selectedPersonTheme.records.flatMap((entry) => extractMessageAttachmentDocuments(entry));
    if (attachmentDocuments.length > 0) {
      const movedKeys = new Set(attachmentDocuments.map((entry) => entry.path || entry.url).filter(Boolean));
      await updateDoc(doc(db, 'people', personId), {
        personDocuments: personDocuments.filter((entry) => !movedKeys.has(entry.path || entry.url)),
        updatedAt: serverTimestamp(),
        updatedByEmail: user?.email ?? null,
        updatedByUid: user?.uid ?? null,
      });

      if (targetType === 'tenant' && targetTenant) {
        const currentDocuments = cleanStoredDocuments(targetTenant.data.tenantDocuments);
        const existingKeys = new Set(currentDocuments.map((entry) => entry.path || entry.url).filter(Boolean));
        const nextDocuments = attachmentDocuments.filter((entry) => !existingKeys.has(entry.path || entry.url));
        if (nextDocuments.length > 0) {
          await updateDoc(doc(db, 'tenants', targetId), {
            tenantDocuments: [...currentDocuments, ...nextDocuments],
            updatedAt: serverTimestamp(),
            updatedByEmail: user?.email ?? null,
            updatedByUid: user?.uid ?? null,
          });
        }
      }

      if (targetType === 'contact' && targetPerson) {
        const currentDocuments = cleanStoredDocuments(targetPerson.data.personDocuments);
        const existingKeys = new Set(currentDocuments.map((entry) => entry.path || entry.url).filter(Boolean));
        const nextDocuments = attachmentDocuments.filter((entry) => !existingKeys.has(entry.path || entry.url));
        if (nextDocuments.length > 0) {
          await updateDoc(doc(db, 'people', targetId), {
            personDocuments: [...currentDocuments, ...nextDocuments],
            updatedAt: serverTimestamp(),
            updatedByEmail: user?.email ?? null,
            updatedByUid: user?.uid ?? null,
          });
        }
      }
    }

    router.push(targetType === 'tenant' ? `/admin/mieter/${targetId}` : `/admin/personen/${targetId}`);
  }

  async function runPersonMessageAction() {
    if (!selectedPersonTheme) return;
    setError('');
    setMessage('');

    try {
      if (messageAction === 'save') {
        await saveSelectedMessageSubject();
        setMessage('Betreff wurde gespeichert.');
        return;
      }
      if (messageAction === 'done') {
        await savePersonThemeMeta(selectedPersonTheme.id, {
          archived: true,
          messageIds: selectedPersonTheme.records.map((entry) => entry.id),
          sourceType: (selectedPersonTheme.sourceType as 'admin_message' | 'manual' | 'tenant_message') || 'manual',
          status: 'done',
          title: cleanText(selectedPersonTheme.subject) || cleanText(messageSubjectDraft) || 'Nachricht',
        });
        setMessage('Thema wurde als erledigt markiert.');
        return;
      }
      if (messageAction === 'split') {
        if (!selectedPersonMessage) return;
        const newThemeId = createClientId('theme');
        await savePersonThemeMeta(newThemeId, {
          archived: false,
          messageIds: [selectedPersonMessage.id],
          sourceType: 'manual',
          status: 'new',
          title: cleanText(selectedPersonMessage.data.subject) || cleanText(messageSubjectDraft) || 'Abgesplittetes Thema',
        });
        setMessage('Neues Thema wurde abgesplittet.');
        return;
      }
      if (messageAction === 'merge') {
        const sourceTheme = personThemes.find((theme) => theme.id === messageActionTargetId) ?? null;
        if (!sourceTheme) throw new Error('Bitte ein Thema zum Zusammenfuehren auswaehlen.');
        const mergedMessageIds = Array.from(
          new Set([
            ...selectedPersonTheme.records.map((entry) => entry.id),
            ...sourceTheme.records.map((entry) => entry.id),
          ])
        );
        await savePersonThemeMeta(selectedPersonTheme.id, {
          archived: false,
          messageIds: mergedMessageIds,
          sourceType: (selectedPersonTheme.sourceType as 'admin_message' | 'manual' | 'tenant_message') || 'manual',
          status: 'in_progress',
          title: cleanText(messageSubjectDraft) || cleanText(selectedPersonTheme.subject) || 'Nachricht',
        });
        await savePersonThemeMeta(sourceTheme.id, {
          archived: true,
          messageIds: [],
          sourceType: (sourceTheme.sourceType as 'admin_message' | 'manual' | 'tenant_message') || 'manual',
          status: 'done',
          title: cleanText(sourceTheme.subject) || 'Zusammengefuehrtes Thema',
        });
        setMessage('Themen wurden zusammengefuehrt.');
        return;
      }
      if (messageAction === 'reassign') {
        await reassignSelectedPersonMessage(messageActionTargetId);
        setMessage('Nachricht wurde neu zugeordnet.');
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Die Aktion konnte nicht ausgefuehrt werden.');
    }
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
          contextBundle: sanitizeAiContext({
            selected: {
              contact: { data: person, id: personId },
              company: companies.find((entry) => entry.id === cleanText(person.companyId)) ?? null,
              property: properties.find((entry) => entry.id === cleanText(person.propertyId)) ?? null,
            },
            collections: {
              companies,
              contacts: people,
              properties,
              tenants,
            },
            documents: personDocuments,
            messages: selectedPersonThreadMessages.map((entry) => ({
              createdAt: entry.data.createdAt,
              direction: entry.data.direction,
              fromEmail: entry.data.fromEmail,
              fromName: entry.data.fromName,
              subject: entry.data.subject,
              text: entry.data.bodyText,
              toEmail: entry.data.toEmail,
            })),
            themes: personThemes.map((entry) => ({
              id: entry.id,
              lastActivityAt: entry.latestActivityAt,
              status: entry.status,
              subject: entry.subject,
            })),
          }),
          currentBody: stripTrailingSignature(cleanText(replyText), messageSignature),
          instruction:
            contextMode === 'new'
              ? [aiInstruction, 'Es handelt sich um eine neue Nachricht. FrÃ¼here Themen nur erwÃ¤hnen, wenn ich das ausdrÃ¼cklich sage.']
                  .filter(Boolean)
                  .join('\n')
              : aiInstruction,
          propertyName: cleanText(person.propertyName),
          recipientCount: 1,
          recipientEmail: cleanText(person.email),
          recipientName: [cleanText(person.firstName), cleanText(person.lastName)].filter(Boolean).join(' '),
          recipientSalutation: cleanText(person.salutation),
          scope: 'manual',
          subject: `Nachricht an ${[cleanText(person.lastName), cleanText(person.firstName)].filter(Boolean).join(', ') || 'Kontakt'}`,
        }),
      });
      const result = (await response.json()) as { draftText?: string; error?: string; ok?: boolean };
      if (!response.ok || !result.ok || !result.draftText) {
        throw new Error(result.error || 'Der KI-Entwurf konnte nicht erzeugt werden.');
      }
      setReplyText(
        composeMessageDraft({
          aiText: result.draftText,
          contextText: cleanText(latestInbound?.data.bodyText),
          messageSignature,
          recipientName: [cleanText(person.firstName), cleanText(person.lastName)].filter(Boolean).join(' '),
          recipientSalutation: cleanText(person.salutation),
        })
      );
      setMessage('KI-Entwurf wurde erzeugt.');
    } catch (caughtError) {
      console.error('Fehler beim KI-Entwurf fÃ¼r Kontakt:', caughtError);
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
        if (personComposerMode === 'note') {
          const noteSubject =
            cleanText(selectedPersonTheme?.subject) ||
            cleanText(messageSubjectDraft) ||
            `Notiz zu ${[cleanText(person.lastName), cleanText(person.firstName)].filter(Boolean).join(', ') || 'Kontakt'}`;
          const noteId = createClientId('note');
          const relatedMessageId = selectedPersonTheme?.id || noteId;
          await addDoc(collection(db, 'messages'), {
            bodyText: cleanText(replyText),
            contactId: personId,
            createdAt: serverTimestamp(),
            direction: 'outbound',
            entryType: 'note',
            fromEmail: user?.email ?? '',
            fromName: cleanText(profile?.displayName) || 'Halbmann Holding',
            priority: 'normal',
            propertyId: cleanText(selectedProperty?.id),
            recipientEmail: cleanText(person.email),
            recipientId: personId,
            recipientName: [cleanText(person.lastName), cleanText(person.firstName)].filter(Boolean).join(', '),
            recipientType: 'contact',
            relatedMessageId,
            status: 'in_progress',
            subject: noteSubject,
            visibleToTenant: false,
          });
          await savePersonThemeMeta(relatedMessageId, {
            archived: false,
            messageIds: selectedPersonTheme ? selectedPersonTheme.records.map((entry) => entry.id) : [],
            sourceType: 'manual',
            status: 'in_progress',
            title: noteSubject,
          });
          setReplyText('');
          setAiInstruction('');
          setContextMode('reply');
          setPersonComposerMode('contact');
          setPersonDeliveryMode('email');
          setMessage('Interne Notiz wurde gespeichert.');
          return;
        }

        const signatureRecord = applyAdminSenderToSignature(
          createSignatureRecord((selectedCompany?.data as Record<string, unknown>) ?? null),
          resolveAdminSenderContact(profile, user)
        );
        const baseBody = cleanText(replyText).endsWith(messageSignature)
          ? cleanText(replyText).slice(0, cleanText(replyText).length - messageSignature.length).trimEnd()
          : cleanText(replyText);
        const uploadedAttachments =
          personDeliveryMode === 'email' || personDeliveryMode === 'both'
            ? await uploadOutgoingMessageAttachments(replyAttachments, `person-${personId}-${Date.now()}`)
            : [];
        const activeThemeId = contextMode === 'reply' ? selectedPersonTheme?.id || selectedPersonMessage?.id || null : null;
        const draftSubject =
          contextMode === 'reply'
            ? cleanText(selectedPersonTheme?.subject) || cleanText(selectedPersonMessage?.data.subject) || `Nachricht an ${[cleanText(person.lastName), cleanText(person.firstName)].filter(Boolean).join(', ') || 'Kontakt'}`
            : `Nachricht an ${[cleanText(person.lastName), cleanText(person.firstName)].filter(Boolean).join(', ') || 'Kontakt'}`;
        if (personDeliveryMode === 'email' || personDeliveryMode === 'both') {
          const draftRef = await addDoc(collection(db, 'messageDrafts'), {
            attachments: uploadedAttachments,
            body: baseBody,
            createdAt: serverTimestamp(),
            kind: 'service_request',
            messageId: activeThemeId,
            messageBodyText: [baseBody, messageSignature].filter(Boolean).join('\n\n'),
            propertyId: cleanText(selectedProperty?.id),
            recipientEmail: cleanText(person.email),
            recipientId: personId,
            recipientType: 'contact',
            signature: signatureRecord,
            status: 'draft',
            subject: draftSubject,
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
        }
        if (uploadedAttachments.length > 0) {
          const attachmentDocuments: StoredDocumentEntry[] = uploadedAttachments.map((attachment) => ({
            category: 'Anhänge',
            contentType: attachment.contentType,
            name: attachment.name,
            path: attachment.path,
            size: attachment.size,
            source: 'message-attachment',
            uploadedAt: attachment.uploadedAt,
            uploadedByEmail: user?.email ?? '',
            url: attachment.url,
          }));
          await updateDoc(doc(db, 'people', personId), {
            personDocuments: [...personDocuments, ...attachmentDocuments],
            updatedAt: serverTimestamp(),
            updatedByEmail: user?.email ?? null,
            updatedByUid: user?.uid ?? null,
          });
        }
        if (personDeliveryMode === 'letter' || personDeliveryMode === 'both') {
          const recipientName =
            [cleanText(person.firstName), cleanText(person.lastName)].filter(Boolean).join(' ') ||
            cleanText(person.partnerCompanyName) ||
            cleanText(person.companyName);
          const recipientCompany = cleanText(person.partnerCompanyName) || cleanText(person.companyName);
          const recipientAddress = buildAddressBlock([
            buildAddressLine([person.street, person.houseNumber]),
            buildAddressLine([person.postalCode, person.city]),
            cleanText(person.country) && cleanText(person.country) !== 'Deutschland' ? person.country : '',
          ]);
          const letterHtml = buildLetterHtml({
            body: baseBody,
            context: {
              propertyName: cleanText(selectedProperty?.data.name),
              subjectLine2: cleanText(selectedProperty?.data.name),
              unitLabel: '',
            },
            recipient: {
              address: recipientAddress,
              company: recipientCompany,
              name: recipientName,
              salutation: cleanText(person.salutation),
            },
            signature: signatureRecord,
            subject: draftSubject,
          });
          await downloadFilledLetterTemplate({
            fallbackHtml: letterHtml,
            fileName: draftSubject || 'Brief',
            getAuthToken: user ? () => user.getIdToken() : undefined,
            replacements: buildLetterTemplateReplacements({
              body: baseBody,
              closing: signatureRecord.letterClosing || signatureRecord.closing,
              companyName: signatureRecord.companyName,
              recipientAddress,
              recipientCompany,
              recipientName,
              recipientSalutation: cleanText(person.salutation),
              senderName: signatureRecord.name,
              subject: draftSubject,
              subjectLine2: cleanText(selectedProperty?.data.name),
            }),
            templateUrl: cleanText(selectedCompany?.data.letterTemplateUrl),
          });
        }
        if (cleanText(followUpDate)) {
          await addDoc(collection(db, 'followUps'), {
            createdAt: serverTimestamp(),
            dueDate: followUpDate,
            message: 'RÃ¼ckmeldung vom Dienstleister prÃ¼fen',
            propertyId: cleanText(selectedProperty?.id),
            status: 'open',
            targetId: personId,
            targetType: 'contact',
            ticketId: '',
            unitId: '',
          });
        }

        setReplyText('');
        setReplyAttachments([]);
        setAiInstruction('');
        setContextMode('reply');
        setPersonComposerMode('contact');
        setPersonDeliveryMode('email');
        setFollowUpDate('');
        setMessage(
          personDeliveryMode === 'both'
            ? 'Brief und Mail wurden verarbeitet.'
            : personDeliveryMode === 'letter'
              ? 'Brief wurde erstellt.'
              : 'Nachricht wurde versendet.'
        );
      } catch (caughtError) {
        console.error('Fehler beim Senden an Dienstleister/Kontakt:', caughtError);
        setError(caughtError instanceof Error ? caughtError.message : 'Die Nachricht konnte nicht versendet werden.');
      }
    });
  }

  const personMessageActionBar = (
    <div className="border-b border-stone-200 py-3">
      <div className="grid gap-2 lg:grid-cols-[150px_minmax(180px,280px)_minmax(180px,1fr)_34px] lg:items-center">
        <select
          className="h-9 rounded-full border border-stone-300 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-amber-700/60"
          onChange={(event) => setMessageAction(event.target.value as 'done' | 'merge' | 'reassign' | 'save' | 'split')}
          value={messageAction}
        >
          <option value="save">Betreff</option>
          <option value="done">Erledigt</option>
          <option value="split">Splitten</option>
          <option value="merge">Zusammenführen</option>
          <option value="reassign">Neu zuordnen</option>
        </select>
        <select
          className="h-9 rounded-full border border-stone-300 bg-white px-3 text-xs text-slate-700 outline-none transition focus:border-amber-700/60 disabled:bg-stone-100 disabled:text-slate-400"
          disabled={messageAction !== 'merge' && messageAction !== 'reassign'}
          onChange={(event) => setMessageActionTargetId(event.target.value)}
          value={messageActionTargetId}
        >
          {messageAction === 'merge' ? (
            <>
              <option value="">Nachricht auswählen</option>
              {messageMergeOptions.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {cleanText(entry.subject || entry.latestEntry.data.fromName) || 'Nachricht'}
                </option>
              ))}
            </>
          ) : messageAction === 'reassign' ? (
            <>
              <option value="">Kontakt auswählen</option>
              {reassignContactOptions.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}{entry.targetType === 'tenant' ? ' · Mieter' : ' · Dienstleister'}
                </option>
              ))}
            </>
          ) : (
            <option value="">Keine Auswahl nötig</option>
          )}
        </select>
        <input
          className="h-9 rounded-full border border-stone-300 bg-stone-50 px-3 text-xs text-slate-900 outline-none transition focus:border-amber-700/60"
          onChange={(event) => setMessageSubjectDraft(event.target.value)}
          placeholder="Betreff"
          value={messageSubjectDraft}
        />
        <button
          aria-label="Aktion ausführen"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 bg-white text-slate-700 transition hover:border-amber-700/50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={
            !selectedPersonTheme ||
            ((messageAction === 'merge' || messageAction === 'reassign') && !messageActionTargetId)
          }
          onClick={() =>
            startTransition(async () => {
              await runPersonMessageAction();
            })
          }
          type="button"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </button>
      </div>
    </div>
  );

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
    <div className="admin-page space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-2 text-sm text-slate-700">
          <span>Ansicht</span>
          <select className="bg-transparent text-sm text-slate-900 outline-none" value="inbox" onChange={() => undefined}>
            <option value="inbox">Posteingang</option>
          </select>
        </label>
        <button
          className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400"
          onClick={() => {
            setContextMode('new');
            setSelectedMessageId('');
          }}
          type="button"
        >
          Neue Nachricht
        </button>
      </div>

      <section className="rounded-[24px] border border-stone-200 bg-white px-5 pb-5 pt-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
            {formatValue([person.lastName, person.firstName].filter(Boolean).join(', '))}
          </p>
          {selectedPersonMessage ? (
            <div className="rounded-full border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-slate-600">
              Ausgewählt: {cleanText(selectedPersonMessage.data.subject) || 'Nachricht'}
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-0 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
          <aside className="px-0 py-0">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Nachrichten</p>
                <span className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {filteredPersonThemes.length}
                </span>
              </div>
            </div>
            <div className="mt-3">
              <input
                className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                onChange={(event) => setPersonMessageSearch(event.target.value)}
                placeholder="Nach Inhalt suchen"
                type="search"
                value={personMessageSearch}
              />
            </div>
            <div className="mt-3 max-h-[calc(72vh-80px)] divide-y divide-stone-200 overflow-y-auto border-y border-stone-200 pr-1">
              {filteredPersonThemes.length === 0 ? (
                <div className="rounded-[16px] border border-dashed border-stone-300 bg-white px-3 py-6 text-sm text-slate-600">
                  Für diesen Dienstleister liegen noch keine offenen Themen vor.
                </div>
              ) : (
                filteredPersonThemes.map((entry) => {
                  const isSelected = selectedPersonTheme?.id === entry.id;
                  const subject = cleanText(entry.subject) || cleanText(entry.latestEntry.data.fromName) || 'Nachricht';
                  return (
                    <div
                      className={`relative px-3 py-3 transition ${isSelected ? 'bg-amber-50/70' : 'hover:bg-stone-50'}`}
                      key={entry.id}
                    >
                      <button
                        className="block w-full pr-8 text-left"
                        onClick={() => setSelectedMessageId(entry.id)}
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className={`line-clamp-2 text-sm font-medium leading-5 ${isSelected ? 'text-amber-950' : 'text-slate-950'}`}>
                            {subject}
                          </p>
                          {cleanText(entry.status) ? (
                            <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                              {cleanText(entry.status)}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 truncate text-[11px] text-slate-500">
                          {cleanText(entry.latestEntry.data.fromEmail || entry.latestEntry.data.recipientEmail)}
                        </p>
                        <p className="mt-1 truncate text-[11px] text-slate-500">
                          {cleanText(entry.latestEntry.data.bodyText) || 'Kein Nachrichtentext vorhanden.'}
                        </p>
                        <p className="mt-2 text-[11px] text-slate-500">
                          {formatDateTime(entry.latestActivityAt)}
                        </p>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          <div className="min-w-0 border-l border-stone-200 pl-4">
            <div className="border-y border-stone-200 py-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Verlauf</p>
              <div className="mt-3 max-h-[62vh] divide-y divide-stone-200 overflow-y-auto pr-1">
                {selectedPersonThreadMessages.length === 0 ? (
                  <div className="px-1 py-8 text-sm leading-6 text-slate-600">
                    Sobald Nachrichten mit diesem Dienstleister entstehen, werden sie hier angezeigt.
                  </div>
                ) : (
                  selectedPersonThreadMessages.map((entry) => {
                    const isOutbound = cleanText(entry.data.direction) === 'outbound';
                    return (
                      <article
                        className={`px-1 py-4 ${isOutbound ? 'pl-8' : 'pr-8'}`}
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
                        <MessageAttachmentPreview
                          attachments={entry.data.attachments}
                          onDelete={(attachment) => deleteMessageAttachment(entry.id, entry.data.attachments, attachment)}
                        />
                      </article>
                    );
                  })
                )}
              </div>
            </div>

            {personMessageActionBar}

            <div className="border-b border-stone-200 py-4">
              <div className="grid gap-2 lg:grid-cols-[150px_54px_minmax(180px,1fr)] lg:items-center">
                <select
                  className="h-9 rounded-full border border-stone-300 bg-white px-3 text-xs text-slate-900 outline-none transition focus:border-amber-700/60"
                  onChange={(event) => {
                    const nextMode = event.target.value as PersonDeliveryMode;
                    setPersonDeliveryMode(nextMode);
                    setPersonComposerMode(nextMode === 'note' ? 'note' : 'contact');
                  }}
                  value={personComposerMode === 'note' ? 'note' : personDeliveryMode}
                >
                  <option value="email">Mail</option>
                  <option value="letter">Brief</option>
                  <option value="both">Mail/Brief</option>
                  <option value="note">Notiz</option>
                </select>
                <button
                  className="h-9 rounded-full border border-stone-300 bg-white px-3 text-xs font-medium text-slate-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={personComposerMode === 'note' || isGeneratingAiDraft || isPending}
                  onClick={generateAiDraft}
                  type="button"
                >
                  {isGeneratingAiDraft ? '...' : 'KI'}
                </button>
                <input
                  className="h-9 rounded-full border border-stone-300 bg-white px-3 text-xs text-slate-900 outline-none transition focus:border-amber-700/60"
                  onChange={(event) => setAiInstruction(event.target.value)}
                  placeholder="z. B. kürzer, verbindlicher, freundlicher"
                  value={aiInstruction}
                />
              </div>
              <textarea
                className="mt-3 min-h-[260px] w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-700/60"
                lang="de"
                onChange={(event) => setReplyText(event.target.value)}
                placeholder={personComposerMode === 'note' ? 'Interne Bearbeitungsnotiz' : 'Nachricht an den Dienstleister'}
                spellCheck={false}
                value={replyText}
              />
              {personComposerMode !== 'note' && (personDeliveryMode === 'email' || personDeliveryMode === 'both') ? (
                <OutgoingAttachmentPicker
                  attachments={replyAttachments}
                  disabled={isPending}
                  inputId={`person-reply-attachments-${personId}`}
                  onChange={setReplyAttachments}
                />
              ) : null}
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
                  {personComposerMode === 'note' ? 'Notiz speichern' : 'Senden'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
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

      {false ? (
      <section className="border-y border-stone-200 bg-white/80 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Nachrichten</p>
            <h3 className="mt-1 font-serif text-2xl text-slate-950">Kontaktverlauf</h3>
          </div>
          <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-slate-600">
            {personMessages.length} Einträge
          </span>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[285px_minmax(0,1fr)]">
          <aside className="border-y border-stone-200 py-4">
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Nachrichten</p>
              <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] text-slate-600">
                {personMessages.length}
              </span>
            </div>
            <div className="mt-3 max-h-[72vh] divide-y divide-stone-200 overflow-y-auto">
              {personMessages.length === 0 ? (
                <div className="px-1 py-8 text-sm leading-6 text-slate-600">
                  Für diesen Kontakt liegen noch keine Nachrichten vor.
                </div>
              ) : (
                personMessages.map((entry) => {
                  const isSelected = selectedPersonMessage?.id === entry.id;
                  const subject = cleanText(entry.data.subject) || cleanText(entry.data.fromName) || 'Nachricht';
                  return (
                    <button
                      className={`block w-full px-1 py-4 text-left transition ${
                        isSelected ? 'bg-amber-50/80' : 'hover:bg-stone-50'
                      }`}
                      key={entry.id}
                      onClick={() => setSelectedMessageId(entry.id)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-950">{subject}</p>
                        {cleanText(entry.data.status) ? (
                          <span className="shrink-0 rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[10px] text-slate-600">
                            {cleanText(entry.data.status)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-600">
                        {cleanText(entry.data.fromEmail || entry.data.recipientEmail)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                        {cleanText(entry.data.bodyText) || 'Kein Nachrichtentext vorhanden.'}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {formatDateTime(entry.data.receivedAt ?? entry.data.createdAt)}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <div className="min-w-0">
            <div className="border-y border-stone-200 py-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Verlauf</p>
              <div className="mt-3 max-h-[62vh] divide-y divide-stone-200 overflow-y-auto pr-1">
                {chronologicalPersonMessages.length === 0 ? (
                  <div className="px-1 py-8 text-sm leading-6 text-slate-600">
                    Sobald Nachrichten mit diesem Dienstleister entstehen, werden sie hier angezeigt.
                  </div>
                ) : (
                  chronologicalPersonMessages.map((entry) => {
                    const isOutbound = cleanText(entry.data.direction) === 'outbound';
                    return (
                      <article
                        className={`px-1 py-4 ${isOutbound ? 'pl-8' : 'pr-8'}`}
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
                        <MessageAttachmentPreview
                          attachments={entry.data.attachments}
                          onDelete={(attachment) => deleteMessageAttachment(entry.id, entry.data.attachments, attachment)}
                        />
                      </article>
                    );
                  })
                )}
              </div>
            </div>

            <div className="border-b border-stone-200 py-4">
              <div className="flex flex-wrap items-center gap-2">
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
                <button
                  className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isGeneratingAiDraft || isPending}
                  onClick={generateAiDraft}
                  type="button"
                >
                  {isGeneratingAiDraft ? 'KI denkt...' : 'KI-Entwurf'}
                </button>
                <input
                  className="min-w-[240px] flex-1 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                  onChange={(event) => setAiInstruction(event.target.value)}
                  placeholder="z. B. kürzer, verbindlicher, freundlicher"
                  value={aiInstruction}
                />
              </div>
              <textarea
                className="mt-3 min-h-[260px] w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-700/60"
                lang="de"
                onChange={(event) => setReplyText(event.target.value)}
                placeholder="Nachricht an den Dienstleister"
                spellCheck={false}
                value={replyText}
              />
              <OutgoingAttachmentPicker
                attachments={replyAttachments}
                disabled={isPending}
                inputId={`person-reply-attachments-${personId}`}
                onChange={setReplyAttachments}
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
          </div>
        </div>
      </section>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-3">
        <DetailCard title="Stammdaten">
          <DetailRow label="Bereich" value={translatePersonCategory(person.category)} />
          <DetailRow label="Anrede" value={translatePersonSalutation(person.salutation)} />
          <DetailRow label="Name" value={[person.lastName, person.firstName].filter(Boolean).join(', ')} />
          <DetailRow label="Geburtsdatum" value={person.birthDate} />
          <DetailRow label="Rolle / Funktion" value={person.jobTitle} />
          <DetailRow label="Partnerfirma" value={person.partnerCompanyName} />
        </DetailCard>

        <DetailCard title="Kontakt">
          <DetailRow label="E-Mail" value={person.email} />
          <DetailRow label="Telefon" value={person.phone} />
          <DetailRow label="Mobil" value={person.mobile} />
          <DetailRow label="Bevorzugter Kontaktweg" value={translatePreferredContactMethod(person.preferredContactMethod)} />
          <DetailRow label="Zugeordnete Immobilie" value={person.propertyName} />
        </DetailCard>

        <DetailCard title="Adresse und Kennzeichen">
          <DetailRow label="StraÃŸe" value={[person.street, person.houseNumber].filter(Boolean).join(' ')} />
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

      <section className="hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Dokumente</p>
            <h3 className="mt-1 text-xl text-slate-950">Kontaktdateien</h3>
          </div>
          <div className="min-w-[min(100%,560px)] flex-1">
            <DocumentUploadControl
              disabled={isUploadingDocument}
              onUpload={(files) => uploadPersonDocuments(files)}
            />
          </div>
        </div>

        {personDocuments.length > 0 ? (
          <div className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-[18px] border border-stone-200">
            {personDocuments.map((personDocument) => {
              const isDeleting = deletingDocumentPath === (personDocument.path || personDocument.url);
              const meta = [formatFileSize(personDocument.size), cleanText(personDocument.uploadedAt)]
                .filter(Boolean)
                .join(' / ');

              return (
                <div className="grid gap-3 bg-white px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center" key={`${personDocument.path}-${personDocument.url}`}>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{personDocument.name}</p>
                    {meta ? <p className="mt-0.5 text-xs text-slate-500">{meta}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950" href={personDocument.url} rel="noreferrer" target="_blank">
                      Anschauen
                    </a>
                    <button className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60" disabled={isDeleting} onClick={() => void deletePersonDocument(personDocument)} type="button">
                      {isDeleting ? 'Loescht...' : 'Loeschen'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-[18px] border border-dashed border-stone-300 bg-stone-50 p-4 text-sm leading-6 text-slate-600">
            Noch keine Dokumente hochgeladen.
          </div>
        )}

        {availableDocuments.length > 0 ? (
          <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-amber-700/80">
              Alte Dateinamen ohne Upload
            </p>
            <div className="mt-2 grid gap-1 text-sm text-slate-700">
              {availableDocuments.map((field) => (
                <p key={field.name}>
                  {field.label}: {formatValue(person[field.name])}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <DocumentLibrarySection
        documents={personDocuments}
        isUploading={isUploadingDocument}
        legacyDocuments={availableDocuments.map((field) => ({
          category: 'Sonstiges',
          fieldName: field.name,
          label: field.label,
          name: formatValue(person[field.name]),
        }))}
        onDelete={deletePersonDocument}
        onUpdateCategory={updatePersonDocumentCategory}
        onUpload={(files, category) => uploadPersonDocuments(files, category)}
        title="Kontaktdateien"
      />

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
    <section className="admin-card rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">{title}</p>
      <div className="admin-card-body mt-4 grid gap-2.5">{children}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value?: unknown }) {
  return (
    <div className="admin-detail-row grid grid-cols-1 gap-1 border-b border-stone-100 py-3 text-sm last:border-b-0 md:grid-cols-[112px_minmax(0,1fr)] md:gap-3">
      <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</dt>
      <dd className="admin-detail-value min-w-0 whitespace-normal break-words leading-6 text-slate-900">{formatValue(value)}</dd>
    </div>
  );
}

