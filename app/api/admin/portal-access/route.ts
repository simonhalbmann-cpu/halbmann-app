import { portalDisabledResponse } from '../../../../lib/portalDisabled';

export const runtime = 'nodejs';

export async function POST() {
  return portalDisabledResponse();
}
