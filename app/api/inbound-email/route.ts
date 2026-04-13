import { NextResponse } from 'next/server';
import { ingestInboundEmail, type InboundEmailPayload } from '../../../lib/inboundEmailIngest';

export const runtime = 'nodejs';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
}

export async function POST(request: Request) {
  const configuredSecret = process.env.INBOUND_EMAIL_SECRET;
  if (configuredSecret) {
    const providedSecret = request.headers.get('x-inbound-email-secret');
    if (providedSecret !== configuredSecret) {
      return unauthorized();
    }
  }

  try {
    const payload = (await request.json()) as InboundEmailPayload;
    const result = await ingestInboundEmail(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'inbound_email_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
