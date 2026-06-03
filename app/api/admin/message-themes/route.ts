import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';
import {
  listLocalMessageThemes,
  upsertLocalMessageTheme,
  type LocalMessageTheme,
} from '../../../../lib/localMessageThemes';

export const runtime = 'nodejs';

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

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
  if (adminCheck.error) return adminCheck.error;

  try {
    const themes = await listLocalMessageThemes();
    return NextResponse.json({ ok: true, themes });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'message_themes_load_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  try {
    const payload = (await request.json()) as Partial<LocalMessageTheme> & {
      id?: string;
      tenantId?: string;
    };
    const id = cleanText(payload.id);
    const tenantId = cleanText(payload.tenantId);

    if (!id || !tenantId) {
      return NextResponse.json({ ok: false, error: 'theme_id_or_tenant_missing' }, { status: 400 });
    }

    const theme = await upsertLocalMessageTheme({
      archived: typeof payload.archived === 'boolean' ? payload.archived : undefined,
      deleted: typeof payload.deleted === 'boolean' ? payload.deleted : undefined,
      id,
      lastActivityAt: cleanText(payload.lastActivityAt) || undefined,
      messageIds: Array.isArray(payload.messageIds)
        ? payload.messageIds.map((entry) => cleanText(entry)).filter(Boolean)
        : undefined,
      mergedIntoThemeId: cleanText(payload.mergedIntoThemeId) || undefined,
      reminderDate: cleanText(payload.reminderDate) || undefined,
      sourceType:
        payload.sourceType === 'admin_message' ||
        payload.sourceType === 'manual' ||
        payload.sourceType === 'tenant_message'
          ? payload.sourceType
          : undefined,
      status:
        payload.status === 'done' ||
        payload.status === 'in_progress' ||
        payload.status === 'needs_review' ||
        payload.status === 'new'
          ? payload.status
          : undefined,
      tenantId,
      title: cleanText(payload.title) || undefined,
    });

    return NextResponse.json({ ok: true, theme });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'message_theme_update_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
