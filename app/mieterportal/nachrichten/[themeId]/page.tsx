'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { buildPortalDisplayName, cleanPortalText } from '../../../../lib/portalAccess';
import {
  formatFileSize,
  formatDateTime,
  getMessageStatusClass,
  getMessageStatusLabel,
  readAttachments,
  type AttachmentRecord,
  type ThemeRecord,
} from '../_lib';

export default function NachrichtenDetailPage() {
  const params = useParams<{ themeId: string }>();
  const { profile } = useAuth();
  const [targetData, setTargetData] = useState<Record<string, unknown> | null>(null);
  const [themes, setThemes] = useState<ThemeRecord[]>([]);
  const [replyBodyText, setReplyBodyText] = useState('');
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [isPending, startTransition] = useTransition();

  const themeId = cleanPortalText(params?.themeId);
  const targetType =
    profile?.targetType === 'contact'
      ? 'contact'
      : profile?.targetType === 'tenant'
        ? 'tenant'
        : null;
  const targetId = cleanPortalText(profile?.targetId);

  useEffect(() => {
    if (!targetType || !targetId) {
      setTargetData(null);
      setThemes([]);
      return;
    }

    let isMounted = true;

    async function loadPortalContext() {
      const response = await fetch('/api/portal/context', { cache: 'no-store' });
      const result = (await response.json()) as {
        ok?: boolean;
        targetData?: Record<string, unknown> | null;
        themes?: ThemeRecord[];
      };

      if (!isMounted || !response.ok || !result.ok) return;

      setTargetData(result.targetData ?? null);
      setThemes(Array.isArray(result.themes) ? result.themes : []);
    }

    void loadPortalContext();
    return () => {
      isMounted = false;
    };
  }, [targetId, targetType]);

  const displayName = useMemo(() => {
    if (!targetType || !targetData) return 'Portal';
    return buildPortalDisplayName(targetType, targetData);
  }, [targetData, targetType]);

  const selectedTheme = useMemo(
    () => themes.find((theme) => theme.id === themeId) ?? null,
    [themeId, themes]
  );

  const selectedMessages = useMemo(() => {
    if (!selectedTheme) return [];
    return [...selectedTheme.records].sort((left, right) =>
      String(right.data.createdAt ?? right.data.receivedAt).localeCompare(
        String(left.data.createdAt ?? left.data.receivedAt)
      )
    );
  }, [selectedTheme]);

  async function reloadPortalContext() {
    const contextResponse = await fetch('/api/portal/context', { cache: 'no-store' });
    const contextResult = (await contextResponse.json()) as {
      ok?: boolean;
      targetData?: Record<string, unknown> | null;
      themes?: ThemeRecord[];
    };

    if (!contextResponse.ok || !contextResult.ok) return;

    setTargetData(contextResult.targetData ?? null);
    setThemes(Array.isArray(contextResult.themes) ? contextResult.themes : []);
  }

  function removeAttachment(indexToRemove: number) {
    setAttachments((current) => current.filter((_, index) => index !== indexToRemove));
  }

  async function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;

    setError('');
    setMessage('');
    setIsUploadingFiles(true);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch('/api/portal/attachments', {
        body: formData,
        method: 'POST',
      });
      const result = (await response.json()) as {
        attachments?: AttachmentRecord[];
        error?: string;
        ok?: boolean;
      };

      if (!response.ok || !result.ok || !Array.isArray(result.attachments)) {
        throw new Error(result.error || 'portal_attachment_upload_failed');
      }

      const uploadedAttachments = result.attachments ?? [];
      setAttachments((current) => [...current, ...uploadedAttachments]);
    } catch (caughtError) {
      console.error('Fehler beim Hochladen der Portal-Anhaenge:', caughtError);
      setError('Die Anhaenge konnten nicht hochgeladen werden.');
    } finally {
      setIsUploadingFiles(false);
    }
  }

  function handleReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTheme) {
      setError('Diese Nachricht wurde nicht gefunden.');
      return;
    }
    if (!replyBodyText.trim()) {
      setError('Bitte schreiben Sie eine Antwort.');
      return;
    }

    setError('');
    setMessage('');

    startTransition(async () => {
      try {
        const response = await fetch('/api/portal/messages', {
          body: JSON.stringify({
            attachments,
            bodyText: replyBodyText.trim(),
            subject: cleanPortalText(selectedTheme.subject) || 'Antwort aus dem Portal',
            themeId,
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        });
        const result = (await response.json()) as { error?: string; ok?: boolean };
        if (!response.ok || !result.ok) {
          throw new Error(result.error || 'portal_message_reply_failed');
        }

        setReplyBodyText('');
        setAttachments([]);
        await reloadPortalContext();
        setMessage('Ihre Antwort wurde an die Verwaltung uebermittelt.');
      } catch (caughtError) {
        console.error('Fehler beim Antworten im Portal:', caughtError);
        setError('Die Antwort konnte nicht gesendet werden.');
      }
    });
  }

  if (!selectedTheme) {
    return (
      <div className="space-y-5">
        <section className="rounded-[24px] border border-stone-200 bg-white px-5 py-5 shadow-sm">
          <p className="text-sm text-slate-600">Diese Nachricht wurde nicht gefunden.</p>
          <Link
            className="mt-4 inline-flex items-center rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-stone-400"
            href="/mieterportal/nachrichten"
          >
            Zur Uebersicht
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-stone-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
              Geoeffnete Nachricht
            </p>
            <h2 className="mt-2 font-serif text-3xl text-slate-950">
              {selectedTheme.subject || 'Ohne Betreff'}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Verlauf zwischen {displayName} und der Verwaltung.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-medium ${getMessageStatusClass(selectedTheme)}`}
            >
              {getMessageStatusLabel(selectedTheme)}
            </span>
            <Link
              className="inline-flex items-center rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-stone-400"
              href="/mieterportal/nachrichten"
            >
              Zur Uebersicht
            </Link>
          </div>
        </div>
      </section>

      {!selectedTheme.archived ? (
        <section className="rounded-[24px] border border-stone-200 bg-white px-5 py-5 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
            Antworten
          </p>
          <form className="mt-4 space-y-4" onSubmit={handleReply}>
            <textarea
              className="min-h-[220px] w-full rounded-[24px] border border-stone-300 bg-stone-50 px-4 py-4 text-sm leading-7 text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => setReplyBodyText(event.target.value)}
              placeholder="Ihre Antwort an die Verwaltung"
              value={replyBodyText}
            />
            <div className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">Anhaenge</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Bei Bedarf koennen Sie Ihrer Antwort Unterlagen oder Fotos beifuegen.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400">
                  Dateien auswaehlen
                  <input
                    className="hidden"
                    multiple
                    onChange={handleFileSelection}
                    type="file"
                  />
                </label>
              </div>
              {isUploadingFiles ? (
                <p className="mt-3 text-sm text-slate-600">Anhaenge werden hochgeladen...</p>
              ) : null}
              {attachments.length ? (
                <div className="mt-3 space-y-2">
                  {attachments.map((attachment, index) => (
                    <div
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-3 py-2"
                      key={`${attachment.url}-${index}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {attachment.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatFileSize(attachment.size) || 'Datei hochgeladen'}
                        </p>
                      </div>
                      <button
                        className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-stone-400"
                        onClick={() => removeAttachment(index)}
                        type="button"
                      >
                        Entfernen
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
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
            <button
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending || isUploadingFiles}
              type="submit"
            >
              {isPending ? 'Wird gesendet...' : 'Antwort senden'}
            </button>
          </form>
          <div className="mt-6 border-t border-stone-200 pt-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
              Verlauf
            </p>
            <div className="mt-4 space-y-3">
              {selectedMessages.map((entry) => {
                const outbound = cleanPortalText(entry.data.direction) === 'outbound';
                const entryAttachments = readAttachments(entry.data.attachments);
                return (
                  <article
                    className={`rounded-[20px] border px-4 py-4 ${
                      outbound ? 'border-amber-200 bg-amber-50/70' : 'border-stone-200 bg-stone-50'
                    }`}
                    key={entry.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-950">
                          {outbound ? 'Verwaltung' : displayName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {cleanPortalText(entry.data.subject) || 'Ohne Betreff'}
                        </p>
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDateTime(entry.data.createdAt ?? entry.data.receivedAt)}
                      </div>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {cleanPortalText(entry.data.bodyText) || 'Ohne Inhalt'}
                    </p>
                    {entryAttachments.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {entryAttachments.map((attachment) => (
                          <a
                            className="inline-flex items-center rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-stone-400"
                            href={attachment.url}
                            key={`${attachment.url}-${attachment.name}`}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {attachment.name}
                            {formatFileSize(attachment.size)
                              ? ` (${formatFileSize(attachment.size)})`
                              : ''}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-[24px] border border-stone-200 bg-white px-5 py-5 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
            Verlauf
          </p>
          <div className="mt-4 space-y-3">
            {selectedMessages.map((entry) => {
              const outbound = cleanPortalText(entry.data.direction) === 'outbound';
              const entryAttachments = readAttachments(entry.data.attachments);
              return (
                <article
                  className={`rounded-[20px] border px-4 py-4 ${
                    outbound ? 'border-amber-200 bg-amber-50/70' : 'border-stone-200 bg-stone-50'
                  }`}
                  key={entry.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-950">
                        {outbound ? 'Verwaltung' : displayName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {cleanPortalText(entry.data.subject) || 'Ohne Betreff'}
                      </p>
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDateTime(entry.data.createdAt ?? entry.data.receivedAt)}
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {cleanPortalText(entry.data.bodyText) || 'Ohne Inhalt'}
                  </p>
                  {entryAttachments.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {entryAttachments.map((attachment) => (
                        <a
                          className="inline-flex items-center rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-stone-400"
                          href={attachment.url}
                          key={`${attachment.url}-${attachment.name}`}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {attachment.name}
                          {formatFileSize(attachment.size)
                            ? ` (${formatFileSize(attachment.size)})`
                            : ''}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
          <div className="rounded-[18px] border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-slate-600">
            Diese Nachricht liegt im Archiv. Fuer neue Anliegen koennen Sie eine neue Nachricht
            starten.
          </div>
        </section>
      )}
    </div>
  );
}
