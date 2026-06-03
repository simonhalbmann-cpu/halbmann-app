import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';
import { listLocalPortalAccessRecords } from '../../../../lib/localPortalAccess';
import {
  appendLocalPortalMessage,
  listAllLocalPortalMessages,
  updateLocalPortalMessageStatus,
} from '../../../../lib/localPortalMessages';
import { buildPortalDisplayName, cleanPortalText } from '../../../../lib/portalAccess';

export const runtime = 'nodejs';

async function requireAdmin(request: Request) {
  if (!hasFirebaseAdminConfig() && process.env.NODE_ENV !== 'production') {
    return { error: null };
  }

  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    return {
      error: NextResponse.json({ ok: false, error: 'missing_auth_token' }, { status: 401 }),
    };
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const profile = await getAdminDb().collection('userProfiles').doc(decoded.uid).get();
    if (!profile.exists || profile.data()?.role !== 'admin') {
      return {
        error: NextResponse.json({ ok: false, error: 'admin_required' }, { status: 403 }),
      };
    }

    return { error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_auth_token';
    return {
      error: NextResponse.json({ ok: false, error: message }, { status: 401 }),
    };
  }
}

export async function GET(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) {
    return adminCheck.error;
  }

  try {
    const [messages, accessRecords] = await Promise.all([
      listAllLocalPortalMessages(),
      listLocalPortalAccessRecords(),
    ]);

    const mappedMessages = messages.map((message) => {
      const accessRecord =
        accessRecords.find(
          (record) =>
            record.targetId === (message.recipientType === 'tenant' ? message.tenantId : message.recipientId)
        ) ?? null;
      const targetData =
        accessRecord?.targetData && typeof accessRecord.targetData === 'object'
          ? accessRecord.targetData
          : {};
      const fromName = buildPortalDisplayName(
        message.recipientType,
        targetData as Record<string, unknown>
      );

      return {
        data: {
          bodyText: message.bodyText,
          channel: 'portal',
          createdAt: message.createdAt,
          deliveryMode: cleanPortalText(message.deliveryMode),
          direction: message.direction,
          entryType: cleanPortalText(message.entryType) || 'tenant_message',
          fromEmail: cleanPortalText(accessRecord?.contactEmail),
          fromName,
          priority: 'normal',
          propertyId: message.propertyId,
          receivedAt: message.createdAt,
          recipientEmail: cleanPortalText(message.recipientEmail),
          recipientId: message.recipientId,
          recipientName: cleanPortalText(message.recipientName),
          recipientType: message.recipientType,
          relatedMessageId: cleanPortalText(message.relatedMessageId),
          status: cleanPortalText(message.status) || 'new',
          subject: message.subject,
          tenantId: message.tenantId,
          unitId: message.unitId,
          visibleToTenant: message.visibleToTenant !== false,
        },
        id: message.id,
      };
    });

    return NextResponse.json({ messages: mappedMessages, ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'local_portal_messages_load_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) {
    return adminCheck.error;
  }

  try {
    const payload = (await request.json()) as {
      action?: string;
      bodyText?: string;
      deliveryMode?: string;
      entryType?: 'admin_message' | 'note' | 'tenant_message' | 'vendor_message';
      messageId?: string;
      propertyId?: string;
      recipientEmail?: string;
      recipientId?: string;
      recipientName?: string;
      recipientType?: 'contact' | 'tenant';
      relatedMessageId?: string;
      status?: string;
      subject?: string;
      tenantId?: string;
      unitId?: string;
      visibleToTenant?: boolean;
    };

    if (payload.action === 'append') {
      if (hasFirebaseAdminConfig()) {
        return NextResponse.json({ ok: true });
      }
      const messageId = cleanPortalText(payload.messageId);
      const tenantId = cleanPortalText(payload.tenantId);
      if (!messageId || !tenantId) {
        return NextResponse.json({ ok: false, error: 'append_message_id_or_tenant_missing' }, { status: 400 });
      }

      await appendLocalPortalMessage({
        bodyText: cleanPortalText(payload.bodyText),
        createdAt: new Date().toISOString(),
        deliveryMode: cleanPortalText(payload.deliveryMode),
        direction: 'outbound',
        entryType: payload.entryType || 'admin_message',
        id: messageId,
        propertyId: cleanPortalText(payload.propertyId),
        recipientEmail: cleanPortalText(payload.recipientEmail),
        recipientId: cleanPortalText(payload.recipientId),
        recipientName: cleanPortalText(payload.recipientName),
        recipientType: payload.recipientType === 'contact' ? 'contact' : 'tenant',
        relatedMessageId: cleanPortalText(payload.relatedMessageId),
        status: cleanPortalText(payload.status) || 'sent',
        subject: cleanPortalText(payload.subject) || 'Nachricht',
        tenantId,
        unitId: cleanPortalText(payload.unitId),
        visibleToTenant: payload.visibleToTenant !== false,
      });

      return NextResponse.json({ ok: true });
    }

    const messageId = cleanPortalText(payload.messageId);
    const status = cleanPortalText(payload.status);

    if (!messageId || !status) {
      return NextResponse.json({ ok: false, error: 'message_id_or_status_missing' }, { status: 400 });
    }
    await updateLocalPortalMessageStatus(messageId, status);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'local_portal_message_update_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
