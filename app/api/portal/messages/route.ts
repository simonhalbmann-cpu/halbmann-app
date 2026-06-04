import { portalDisabledResponse } from '../../../../lib/portalDisabled';

export const runtime = 'nodejs';

export async function GET() {
  return portalDisabledResponse();
}

export async function POST() {
  return portalDisabledResponse();
}
