'use client';

export type MessageAttachmentEntry = {
  contentType: string;
  name: string;
  path: string;
  url: string;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function inferContentType(name: string, contentType: string) {
  const normalizedType = contentType.toLowerCase();
  if (normalizedType) return normalizedType;

  const extension = name.toLowerCase().split('.').pop() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif'].includes(extension)) return `image/${extension === 'jpg' ? 'jpeg' : extension}`;
  if (['mp4', 'webm', 'ogg', 'mov'].includes(extension)) return `video/${extension}`;
  if (['mp3', 'wav', 'm4a', 'aac'].includes(extension)) return `audio/${extension}`;
  if (extension === 'pdf') return 'application/pdf';
  return '';
}

function readAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const name = cleanText(record.name);
      const url = cleanText(record.url ?? record.downloadUrl ?? record.href);
      if (!name || !url) return null;

      return {
        contentType: inferContentType(name, cleanText(record.contentType)),
        name,
        path: cleanText(record.path),
        url,
      };
    })
    .filter(Boolean) as MessageAttachmentEntry[];
}

function DownloadLink({ attachment }: { attachment: MessageAttachmentEntry }) {
  return (
    <a
      className="inline-flex max-w-56 items-center rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-stone-400 hover:text-slate-950"
      download={attachment.name}
      href={attachment.url}
      rel="noreferrer"
      target="_blank"
    >
      <span className="truncate">{attachment.name}</span>
    </a>
  );
}

export default function MessageAttachmentPreview({
  attachments,
  onDelete,
}: {
  attachments: unknown;
  onDelete?: (attachment: MessageAttachmentEntry) => Promise<void> | void;
}) {
  const resolvedAttachments = readAttachments(attachments);
  if (!resolvedAttachments.length) return null;

  return (
    <div className="mt-4 space-y-3">
      {resolvedAttachments.map((attachment) => {
        const type = attachment.contentType;
        const deleteButton = onDelete ? (
          <button
            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-300"
            onClick={() => void onDelete(attachment)}
            type="button"
          >
            Löschen
          </button>
        ) : null;

        if (type.startsWith('image/')) {
          return (
            <div
              className="inline-block overflow-hidden rounded-[14px] border border-stone-200 bg-white align-top"
              key={`${attachment.name}-${attachment.url}`}
            >
              <a href={attachment.url} rel="noreferrer" target="_blank">
                <img
                  alt={attachment.name}
                  className="h-20 w-28 object-cover"
                  src={attachment.url}
                />
              </a>
              <div className="w-28 border-t border-stone-100 px-2 py-1.5 text-xs font-medium text-slate-700">
                <div className="grid gap-1">
                  <span className="truncate">{attachment.name}</span>
                  {deleteButton}
                </div>
              </div>
            </div>
          );
        }

        if (type.startsWith('video/')) {
          return (
            <div
              className="inline-block overflow-hidden rounded-[14px] border border-stone-200 bg-white align-top"
              key={`${attachment.name}-${attachment.url}`}
            >
              <a className="block h-20 w-28 bg-black" href={attachment.url} rel="noreferrer" target="_blank">
                <video className="h-20 w-28 object-cover" muted src={attachment.url} />
              </a>
              <div className="w-28 border-t border-stone-100 px-2 py-1.5 text-xs font-medium text-slate-700">
                <div className="grid gap-1">
                  <span className="truncate">{attachment.name}</span>
                  {deleteButton}
                </div>
              </div>
            </div>
          );
        }

        if (type.startsWith('audio/')) {
          return (
            <div
              className="inline-flex min-h-20 w-48 flex-col justify-between rounded-[14px] border border-stone-200 bg-white px-3 py-2 align-top"
              key={`${attachment.name}-${attachment.url}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="truncate text-xs font-medium text-slate-700">{attachment.name}</p>
                {deleteButton}
              </div>
              <a
                className="mt-2 rounded-full border border-stone-300 bg-stone-50 px-3 py-1.5 text-center text-xs font-medium text-slate-700 transition hover:border-stone-400"
                href={attachment.url}
                rel="noreferrer"
                target="_blank"
              >
                Oeffnen
              </a>
            </div>
          );
        }

        if (type === 'application/pdf') {
          return (
            <div
              className="inline-block overflow-hidden rounded-[14px] border border-stone-200 bg-white align-top"
              key={`${attachment.name}-${attachment.url}`}
            >
              <a
                className="flex h-20 w-28 items-center justify-center bg-stone-50 px-3 text-center text-xs font-semibold text-slate-700"
                href={attachment.url}
                rel="noreferrer"
                target="_blank"
              >
                PDF
              </a>
              <div className="w-28 border-t border-stone-100 px-2 py-1.5">
                <span className="block truncate text-xs font-medium text-slate-700">{attachment.name}</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  <DownloadLink attachment={attachment} />
                  {deleteButton}
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="inline-flex flex-wrap items-center gap-2 align-top" key={`${attachment.name}-${attachment.url}`}>
            <DownloadLink attachment={attachment} />
            {deleteButton}
          </div>
        );
      })}
    </div>
  );
}
