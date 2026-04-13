import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';
import { addFirestoreDocument, queryFirestoreEquals } from '../../../../lib/firestoreRest';
import { ensureWorkflowForMessage } from '../../../../lib/workflowAutomation';

export const runtime = 'nodejs';

type PortalMessagePayload = {
  bodyText?: string;
  category?: string;
  subject?: string;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function requireAuthenticatedUser(request: Request) {
  if (!hasFirebaseAdminConfig() && process.env.NODE_ENV !== 'production') {
    return {
      email: 'local-dev@example.com',
      error: null,
      uid: 'local-dev-user',
    };
  }

  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    return {
      email: '',
      error: NextResponse.json({ ok: false, error: 'missing_auth_token' }, { status: 401 }),
      uid: '',
    };
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return {
      email: cleanText(decoded.email).toLowerCase(),
      error: null,
      uid: decoded.uid,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_auth_token';
    return {
      email: '',
      error: NextResponse.json({ ok: false, error: message }, { status: 401 }),
      uid: '',
    };
  }
}

export async function POST(request: Request) {
  const authState = await requireAuthenticatedUser(request);
  if (authState.error) {
    return authState.error;
  }

  try {
    const payload = (await request.json()) as PortalMessagePayload;
    const bodyText = cleanText(payload.bodyText);
    if (!bodyText) {
      return NextResponse.json({ ok: false, error: 'body_missing' }, { status: 400 });
    }

    let tenantDoc: { id: string; data: () => any } | null = null;
    let tenantData: any = null;

    if (!hasFirebaseAdminConfig()) {
      const tenantMatches = await queryFirestoreEquals('tenants', 'email', authState.email, request.headers.get('authorization')?.replace(/^Bearer\s+/,'') || '');
      const tenantEntry = tenantMatches[0] ?? null;
      tenantDoc = tenantEntry
        ? {
            data: () => tenantEntry.data,
            id: tenantEntry.id,
          }
        : null;
      tenantData = tenantEntry?.data ?? null;
    } else {
      const db = getAdminDb();
      const tenantSnapshot = await db
        .collection('tenants')
        .where('email', '==', authState.email)
        .limit(1)
        .get();
      tenantDoc = tenantSnapshot.docs[0] ?? null;
      tenantData = tenantDoc?.data() ?? null;
    }

    if (!tenantDoc) {
      return NextResponse.json({ ok: false, error: 'tenant_not_found' }, { status: 404 });
    }

    const fromName =
      [cleanText(tenantData.firstName), cleanText(tenantData.lastName)].filter(Boolean).join(' ') ||
      cleanText(tenantData.companyName) ||
      authState.email;

    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/,'') || '';

    const messagePayload = {
      analysis: null,
      attachments: [],
      bodyHtml: '',
      bodyText,
      category: cleanText(payload.category),
      channel: 'portal',
      createdAt: hasFirebaseAdminConfig() ? FieldValue.serverTimestamp() : new Date().toISOString(),
      direction: 'inbound',
      fromEmail: authState.email,
      fromName,
      priority: 'normal',
      propertyId: cleanText(tenantData.propertyId),
      receivedAt: hasFirebaseAdminConfig() ? FieldValue.serverTimestamp() : new Date().toISOString(),
      status: 'new',
      subject: cleanText(payload.subject) || 'Nachricht aus dem Mieterportal',
      tenantId: tenantDoc.id,
      ticketId: '',
      unitId: cleanText(tenantData.unitId),
      updatedAt: hasFirebaseAdminConfig() ? FieldValue.serverTimestamp() : new Date().toISOString(),
    };

    const messageId = hasFirebaseAdminConfig()
      ? (await getAdminDb().collection('messages').add(messagePayload)).id
      : await addFirestoreDocument('messages', messagePayload, token);

    const workflowResult = await ensureWorkflowForMessage(messageId, token || undefined);

    return NextResponse.json({
      ok: true,
      messageId,
      ticketId: workflowResult.ticketId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'portal_message_create_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
