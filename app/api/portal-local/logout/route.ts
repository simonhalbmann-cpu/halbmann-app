import { NextResponse } from 'next/server';
import { clearLocalPortalSessionCookie } from '../../../../lib/localPortalSession';

export const runtime = 'nodejs';

export async function POST() {
  await clearLocalPortalSessionCookie();
  return NextResponse.json({ ok: true });
}
