import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';

export type OutgoingAttachment = {
  contentType: string;
  name: string;
  path: string;
  size: number;
  uploadedAt: string;
  url: string;
};

type PendingOutgoingAttachmentLike =
  | File
  | {
      existing?: OutgoingAttachment;
      file?: File;
    };

function cleanFileName(value: string) {
  return value.replace(/[^\w.\-äöüÄÖÜß ]+/g, '_').replace(/\s+/g, '_');
}

export async function uploadOutgoingMessageAttachments(files: PendingOutgoingAttachmentLike[], scope: string) {
  const cleanScope = scope.replace(/[^\w.\-]+/g, '_') || 'message';
  const uploaded: OutgoingAttachment[] = [];

  for (const entry of files) {
    if (!(entry instanceof File) && entry.existing) {
      uploaded.push(entry.existing);
      continue;
    }

    const file = entry instanceof File ? entry : entry.file;
    if (!file) continue;

    const safeName = cleanFileName(file.name || 'anhang');
    const storagePath = `message-attachments/outgoing/${cleanScope}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file, {
      contentType: file.type || 'application/octet-stream',
    });
    uploaded.push({
      contentType: file.type || 'application/octet-stream',
      name: file.name || safeName,
      path: storagePath,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      url: await getDownloadURL(storageRef),
    });
  }

  return uploaded;
}
