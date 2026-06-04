import { portalDisabledResponse } from '../../../../lib/portalDisabled';

export const runtime = 'nodejs';

export async function GET() {
  return portalDisabledResponse();
}
