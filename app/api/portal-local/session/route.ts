import { NextResponse } from 'next/server';
import { getAdminDb, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';
import { readLocalPortalAccess } from '../../../../lib/localPortalAccess';
import { readLocalPortalSessionCookie } from '../../../../lib/localPortalSession';
import { getPortalCollectionName } from '../../../../lib/portalAccess';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const session = await readLocalPortalSessionCookie();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'local_portal_session_missing' }, { status: 401 });
    }

    const targetCollection = getPortalCollectionName(session.targetType);
    const targetData = hasFirebaseAdminConfig()
      ? (await getAdminDb().collection(targetCollection).doc(session.targetId).get()).data() ?? null
      : (await readLocalPortalAccess(session.username))?.targetData ?? null;

    return NextResponse.json({
      ok: true,
      profile: {
        role: 'portal',
        targetId: session.targetId,
        targetType: session.targetType,
        username: session.username,
      },
      targetData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'local_portal_session_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
