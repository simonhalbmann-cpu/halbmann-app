'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { cleanPortalText } from '../../../../lib/portalAccess';
import { formatFileSize, type AttachmentRecord } from '../_lib';

export default function NeueNachrichtPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [targetData, setTargetData] = useState<Record<string, unknown> | null>(null);
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [isPending, startTransition] = useTransition();

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
      return;
    }

    let isMounted = true;

    async function loadPortalContext() {
      const response = await fetch('/api/portal/context', { cache: 'no-store' });
      const result = (await response.json()) as {
        ok?: boolean;
        targetData?: Record<string, unknown> | null;
      };

      if (!isMounted || !response.ok || !result.ok) return;
      setTargetData(result.targetData ?? null);
    }

    void loadPortalContext();
    return () => {
      isMounted = false;
    };
  }, [targetId, targetType]);

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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targetType || !targetId) {
      setError('Ihre Portalzuordnung ist noch nicht vollstaendig.');
      return;
    }
    if (!bodyText.trim()) {
      setError('Bitte schreiben Sie eine Nachricht.');
      return;
    }

    setError('');
    setMessage('');

    startTransition(async () => {
      try {
        const response = await fetch('/api/portal/messages', {
          body: JSON.stringify({
            attachments,
            bodyText: bodyText.trim(),
            subject: subject.trim() || 'Neue Nachricht aus dem Portal',
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        });
        const result = (await response.json()) as { error?: string; ok?: boolean; themeId?: string };
        if (!response.ok || !result.ok || !result.themeId) {
          throw new Error(result.error || 'portal_message_create_failed');
        }

        setSubject('');
        setBodyText('');
        setAttachments([]);
        router.push('/mieterportal/nachrichten?sent=1');
      } catch (caughtError) {
        console.error('Fehler beim Senden der Portal-Nachricht:', caughtError);
        setError('Die Nachricht konnte nicht gesendet werden.');
      }
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-stone-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
              Neue Nachricht
            </p>
            <h2 className="mt-2 font-serif text-3xl text-slate-950">Neues Anliegen an die Verwaltung</h2>
          </div>
          <Link
            className="inline-flex items-center rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-stone-400"
            href="/mieterportal/nachrichten"
          >
            Zur Uebersicht
          </Link>
        </div>
      </section>

      <section className="rounded-[24px] border border-stone-200 bg-white px-5 py-5 shadow-sm">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <input
            className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Betreff"
            value={subject}
          />
          <textarea
            className="min-h-[220px] w-full rounded-[24px] border border-stone-300 bg-stone-50 px-4 py-4 text-sm leading-7 text-slate-900 outline-none transition focus:border-amber-700/60"
            onChange={(event) => setBodyText(event.target.value)}
            placeholder="Beschreiben Sie bitte Ihr Anliegen."
            value={bodyText}
          />
          <div className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">Anhaenge</p>
                <p className="mt-1 text-xs text-slate-500">
                  Fotos, PDFs oder andere Unterlagen koennen direkt mitgeschickt werden.
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
            disabled={isPending || isUploadingFiles || !targetData}
            type="submit"
          >
            {isPending ? 'Wird gesendet...' : 'Nachricht senden'}
          </button>
        </form>
      </section>
    </div>
  );
}
