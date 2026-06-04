import { NextResponse } from 'next/server';

export function portalDisabledResponse() {
  return NextResponse.json(
    { ok: false, error: 'tenant_portal_disabled' },
    { status: 410 }
  );
}
