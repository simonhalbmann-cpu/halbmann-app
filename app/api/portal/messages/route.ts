import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';
import { readLocalPortalAccess } from '../../../../lib/localPortalAccess';
import { listLocalMessageThemes, upsertLocalMessageTheme } from '../../../../lib/localMessageThemes';
import { readLocalPortalSessionCookie } from '../../../../lib/localPortalSession';
import { appendLocalPortalMessage, listLocalPortalMessages } from '../../../../lib/localPortalMessages';
import { ensureWorkflowForMessage } from '../../../../lib/workflowAutomation';
import { buildPortalDisplayName, cleanPortalText, type PortalTargetType } from '../../../../lib/portalAccess';

export const runtime = 'nodejs';

type PortalMessagePayload = {
  attachments?: Array<Record<string, unknown>>;
  bodyText?: string;
  subject?: string;
  themeId?: string;
};

type PortalAttachmentRecord = {
  contentType?: string;
  name: string;
  size?: number;
  url: string;
};

type PortalAuthState = {
  error: NextResponse | null;
  profile: Record<string, unknown> | null;
  uid: string;
};

async function requireAuthenticatedPortalUser(request: Request): Promise<PortalAuthState> {
  if (!hasFirebaseAdminConfig()) {
    const localSession = await readLocalPortalSessionCookie();
    if (!localSession) {
      return {
        error: NextResponse.json({ ok: false, error: 'missing_auth_token' }, { status: 401 }),
        profile: null,
        uid: '',
      };
    }

    return {
      error: null,
      profile: {
        role: 'portal',
        targetId: localSession.targetId,
        targetType: localSession.targetType,
        username: localSession.username,
      },
      uid: localSession.uid,
    };
  }

  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    return {
      error: NextResponse.json({ ok: false, error: 'missing_auth_token' }, { status: 401 }),
      profile: null,
      uid: '',
    };
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const profileSnapshot = await getAdminDb().collection('userProfiles').doc(decoded.uid).get();
    const profile = profileSnapshot.data() ?? null;

    if (!profileSnapshot.exists || profile?.role !== 'portal') {
      return {
        error: NextResponse.json({ ok: false, error: 'portal_required' }, { status: 403 }),
        profile: null,
        uid: '',
      };
    }

    return {
      error: null,
      profile,
      uid: decoded.uid,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_auth_token';
    return {
      error: NextResponse.json({ ok: false, error: message }, { status: 401 }),
      profile: null,
      uid: '',
    };
  }
}

export async function POST(request: Request) {
  try {
    const authState = await requireAuthenticatedPortalUser(request);
    if (authState.error) {
      return authState.error;
    }
    if (!authState.profile) {
      return NextResponse.json({ ok: false, error: 'portal_profile_missing' }, { status: 403 });
    }

    const payload = (await request.json()) as PortalMessagePayload;
    const bodyText = cleanPortalText(payload.bodyText);
    const subject = cleanPortalText(payload.subject) || 'Nachricht aus dem Portal';
    const requestedThemeId = cleanPortalText(payload.themeId);
    const attachments: PortalAttachmentRecord[] = Array.isArray(payload.attachments)
      ? payload.attachments.reduce<PortalAttachmentRecord[]>((result, entry) => {
          if (!entry || typeof entry !== 'object') return result;
          const record = entry as Record<string, unknown>;
          const name = cleanPortalText(record.name);
          const url = cleanPortalText(record.url);
          if (!name || !url) return result;
          result.push({
            contentType: cleanPortalText(record.contentType) || 'application/octet-stream',
            name,
            size:
              typeof record.size === 'number' && Number.isFinite(record.size)
                ? record.size
                : undefined,
            url,
          });
          return result;
        }, [])
      : [];
    const targetId = cleanPortalText(authState.profile.targetId);
    const targetType = cleanPortalText(authState.profile.targetType) as PortalTargetType;

    if (!bodyText) {
      return NextResponse.json({ ok: false, error: 'body_missing' }, { status: 400 });
    }
    if (!targetId || (targetType !== 'tenant' && targetType !== 'contact')) {
      return NextResponse.json({ ok: false, error: 'portal_target_missing' }, { status: 400 });
    }

    if (!hasFirebaseAdminConfig()) {
      const localRecord = await readLocalPortalAccess(cleanPortalText(authState.profile.username));
      const targetData =
        localRecord?.targetData && typeof localRecord.targetData === 'object'
          ? localRecord.targetData
          : null;

      if (!targetData) {
        return NextResponse.json({ ok: false, error: 'portal_target_not_found' }, { status: 404 });
      }

      const messageId = crypto.randomUUID();
      const themeId = requestedThemeId || messageId;
      const existingThemes = await listLocalMessageThemes();
      const currentTheme = existingThemes.find((entry) => entry.id === themeId) ?? null;
      const now = new Date().toISOString();
      const nextMessageIds = Array.from(
        new Set([...(currentTheme?.messageIds ?? []), messageId])
      );
      await appendLocalPortalMessage({
        attachments,
        bodyText,
        createdAt: now,
        direction: 'inbound',
        entryType: 'tenant_message',
        id: messageId,
        propertyId: cleanPortalText(targetData.propertyId),
        recipientId: targetId,
        recipientType: targetType,
        relatedMessageId: themeId,
        status: 'new',
        subject,
        tenantId: targetType === 'tenant' ? targetId : '',
        unitId: cleanPortalText(targetData.unitId),
        visibleToTenant: true,
      });
      await upsertLocalMessageTheme({
        archived: false,
        id: themeId,
        lastActivityAt: now,
        messageIds: nextMessageIds,
        sourceType: currentTheme?.sourceType ?? 'tenant_message',
        status: 'new',
        tenantId: targetType === 'tenant' ? targetId : '',
        title: cleanPortalText(currentTheme?.title) || subject,
      });

      return NextResponse.json({
        ok: true,
        messageId,
        themeId,
        ticketId: '',
      });
    }

    const db = getAdminDb();
    const targetCollection = targetType === 'tenant' ? 'tenants' : 'people';
    const targetSnapshot = await db.collection(targetCollection).doc(targetId).get();

    if (!targetSnapshot.exists) {
      return NextResponse.json({ ok: false, error: 'portal_target_not_found' }, { status: 404 });
    }

    const targetData = targetSnapshot.data() ?? {};
    const propertyId = cleanPortalText(targetData.propertyId);
    const unitId = cleanPortalText(targetData.unitId);
    const fromEmail =
      cleanPortalText(authState.profile.contactEmail) ||
      cleanPortalText(authState.profile.authEmail) ||
      cleanPortalText(authState.profile.email);
    const fromName = buildPortalDisplayName(targetType, targetData);

    const messagePayload = {
      attachments,
      bodyHtml: '',
      bodyText,
      channel: 'portal',
      createdAt: FieldValue.serverTimestamp(),
      direction: 'inbound',
      fromEmail,
      fromName,
      priority: 'normal',
      propertyId,
      receivedAt: FieldValue.serverTimestamp(),
      recipientId: targetId,
      recipientType: targetType,
      status: 'new',
      subject,
      tenantId: targetType === 'tenant' ? targetId : '',
      ticketId: '',
      unitId,
      updatedAt: FieldValue.serverTimestamp(),
    };

    const messageRef = await db.collection('messages').add(messagePayload);
    const workflowResult = await ensureWorkflowForMessage(messageRef.id);

    return NextResponse.json({
      ok: true,
      messageId: messageRef.id,
      themeId: requestedThemeId || messageRef.id,
      ticketId: workflowResult.ticketId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'portal_message_create_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const authState = await requireAuthenticatedPortalUser(request);
    if (authState.error) {
      return authState.error;
    }
    if (!authState.profile) {
      return NextResponse.json({ ok: false, error: 'portal_profile_missing' }, { status: 403 });
    }

    const targetId = cleanPortalText(authState.profile.targetId);
    const targetType = cleanPortalText(authState.profile.targetType) as PortalTargetType;

    if (!targetId || (targetType !== 'tenant' && targetType !== 'contact')) {
      return NextResponse.json({ ok: false, error: 'portal_target_missing' }, { status: 400 });
    }

    if (!hasFirebaseAdminConfig()) {
      const messages = (await listLocalPortalMessages(targetType, targetId))
        .filter((message) => message.visibleToTenant !== false)
        .map((message) => ({
        data: message,
        id: message.id,
      }));
      return NextResponse.json({ messages, ok: true });
    }

    const db = getAdminDb();
    const fieldName = targetType === 'tenant' ? 'tenantId' : 'recipientId';
    const snapshot = await db
      .collection('messages')
      .where(fieldName, '==', targetId)
      .orderBy('createdAt', 'desc')
      .get();
    const messages = snapshot.docs.map((documentSnapshot) => ({
      data: documentSnapshot.data(),
      id: documentSnapshot.id,
    }));

    return NextResponse.json({ messages, ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'portal_messages_load_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
