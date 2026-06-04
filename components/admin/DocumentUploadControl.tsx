'use client';

import { useRef, useState } from 'react';

type DocumentUploadControlProps = {
  accept?: string;
  disabled?: boolean;
  multiple?: boolean;
  onUpload: (files: File[]) => Promise<void> | void;
};

export default function DocumentUploadControl({
  accept,
  disabled = false,
  multiple = true,
  onUpload,
}: DocumentUploadControlProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  async function uploadSelectedFiles() {
    if (selectedFiles.length === 0 || disabled || isUploading) return;
    setIsUploading(true);
    try {
      await onUpload(selectedFiles);
      setSelectedFiles([]);
      if (inputRef.current) inputRef.current.value = '';
    } finally {
      setIsUploading(false);
    }
  }

  const selectedLabel =
    selectedFiles.length === 0
      ? 'Keine Datei ausgewaehlt'
      : selectedFiles.length === 1
        ? selectedFiles[0].name
        : `${selectedFiles.length} Dateien ausgewaehlt`;

  return (
    <div className="grid gap-2 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
      <button
        className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-700/40 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || isUploading}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        Auswaehlen
      </button>
      <input
        accept={accept}
        className="hidden"
        disabled={disabled || isUploading}
        multiple={multiple}
        onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
        ref={inputRef}
        type="file"
      />
      <div className="min-w-0 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-slate-700">
        <p className="truncate">{selectedLabel}</p>
      </div>
      <button
        className="rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-4 py-2 text-sm font-medium text-stone-100 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || isUploading || selectedFiles.length === 0}
        onClick={() => void uploadSelectedFiles()}
        type="button"
      >
        {isUploading ? 'Laedt hoch...' : 'Upload'}
      </button>
    </div>
  );
}
