import { NextResponse } from 'next/server';
import { syncInboxFromImap } from '../../../../lib/imapSync';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization') ?? '';
    const authToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const result = await syncInboxFromImap(authToken || undefined);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'imap_sync_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
