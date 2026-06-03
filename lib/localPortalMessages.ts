import fs from 'fs/promises';
import path from 'path';

export type LocalPortalMessage = {
  attachments?: Array<{
    contentType?: string;
    name: string;
    size?: number;
    url: string;
  }>;
  bodyText: string;
  createdAt: string;
  direction: 'inbound' | 'outbound';
  deliveryMode?: 'both' | 'email' | 'letter' | string;
  entryType?: 'admin_message' | 'note' | 'tenant_message' | 'vendor_message';
  id: string;
  propertyId: string;
  recipientEmail?: string;
  recipientId: string;
  recipientName?: string;
  recipientType: 'contact' | 'tenant';
  relatedMessageId?: string;
  status?: string;
  subject: string;
  tenantId: string;
  unitId: string;
  visibleToTenant?: boolean;
};

const LOCAL_PORTAL_MESSAGES_PATH = path.join(process.cwd(), '.portal-messages.local.json');

async function readAll() {
  try {
    const raw = await fs.readFile(LOCAL_PORTAL_MESSAGES_PATH, 'utf8');
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as LocalPortalMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(messages: LocalPortalMessage[]) {
  await fs.writeFile(LOCAL_PORTAL_MESSAGES_PATH, JSON.stringify(messages, null, 2), 'utf8');
}

export async function listAllLocalPortalMessages() {
  const messages = await readAll();
  return [...messages].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function listLocalPortalMessages(targetType: 'contact' | 'tenant', targetId: string) {
  const messages = await readAll();
  return messages
    .filter((message) => {
      if (targetType === 'tenant') {
        return message.tenantId === targetId;
      }
      return message.recipientId === targetId;
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function appendLocalPortalMessage(message: LocalPortalMessage) {
  const messages = await readAll();
  messages.push(message);
  await writeAll(messages);
}

export async function updateLocalPortalMessageStatus(messageId: string, status: string) {
  const messages = await readAll();
  const nextMessages = messages.map((message) =>
    message.id === messageId ? { ...message, status } : message
  );
  await writeAll(nextMessages);
}
