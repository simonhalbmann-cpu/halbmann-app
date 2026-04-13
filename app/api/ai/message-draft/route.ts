import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { getAiSettingsServer } from '../../../../lib/aiConfigServer';
import { getAdminAuth, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';

type MessageDraftPayload = {
  companyName?: string;
  currentBody?: string;
  instruction?: string;
  meters?: string[];
  propertyName?: string;
  recipientCount?: number;
  recipientEmail?: string;
  recipientName?: string;
  scope?: 'all_tenants' | 'company_tenants' | 'manual' | 'property_tenants';
  senderEmail?: string;
  subject?: string;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function requireAuthenticatedUser(request: Request) {
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
    await getAdminAuth().verifyIdToken(token);
    return { error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_auth_token';
    return {
      error: NextResponse.json({ ok: false, error: message }, { status: 401 }),
    };
  }
}

function buildScopeLabel(scope: MessageDraftPayload['scope']) {
  if (scope === 'all_tenants') return 'Nachricht an alle Mieter';
  if (scope === 'company_tenants') return 'Nachricht an alle Mieter einer Firma';
  if (scope === 'property_tenants') return 'Nachricht an alle Mieter eines Objekts';
  return 'Nachricht an einen einzelnen Empfänger';
}

function buildSystemPrompt() {
  return [
    'Du schreibst individuelle, professionelle deutschsprachige E-Mails für eine Immobilienverwaltung.',
    'Erzeuge nur den Nachrichtentext ohne Betreff und ohne Signatur.',
    'Keine Schlussformel mit Namen oder Firmennamen ergänzen.',
    'Wenn bereits ein Entwurf vorhanden ist, überarbeite genau diesen Entwurf statt neu zu beginnen.',
    'Die neueste Nutzeranweisung hat Vorrang.',
    'Verwende nur vorhandene Informationen und erfinde keine Fakten.',
    'Wenn es um Zählerablesung oder Zählertausch geht und Zählerdaten vorhanden sind, nenne sie konkret.',
    'Nenne eine Absenderadresse nur, wenn die Nutzeranweisung ausdrücklich eine Antwort per E-Mail verlangt.',
  ].join(' ');
}

function buildUserPrompt(payload: MessageDraftPayload) {
  return [
    `Kontext: ${buildScopeLabel(payload.scope)}`,
    `Firma: ${cleanText(payload.companyName) || '–'}`,
    `Objekt: ${cleanText(payload.propertyName) || '–'}`,
    `Empfängername: ${cleanText(payload.recipientName) || '–'}`,
    `Empfänger E-Mail: ${cleanText(payload.recipientEmail) || '–'}`,
    `Absenderadresse: ${cleanText(payload.senderEmail) || 'portal@halbmann-holding.de'}`,
    `Anzahl Empfänger: ${typeof payload.recipientCount === 'number' ? String(payload.recipientCount) : '–'}`,
    `Betreff: ${cleanText(payload.subject) || '–'}`,
    '',
    'Zugeordnete Zähler:',
    Array.isArray(payload.meters) && payload.meters.length > 0 ? payload.meters.join('; ') : 'keine',
    '',
    'Bisheriger Entwurf:',
    cleanText(payload.currentBody) || '–',
    '',
    'Zusätzliche Anweisung:',
    cleanText(payload.instruction) || 'Keine',
    '',
    'Schreibe jetzt den passenden Nachrichtentext.',
  ].join('\n');
}

export async function POST(request: Request) {
  const authState = await requireAuthenticatedUser(request);
  if (authState.error) {
    return authState.error;
  }

  const apiKey = cleanText(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY ist nicht gesetzt.' }, { status: 500 });
  }

  try {
    const payload = (await request.json()) as MessageDraftPayload;
    const client = new OpenAI({ apiKey });
    const aiSettings = await getAiSettingsServer();
    const settingsBlock = [cleanText(aiSettings.globalInstruction), cleanText(aiSettings.toneInstruction)]
      .filter(Boolean)
      .join('\n');

    const response = await client.responses.create({
      model: cleanText(process.env.OPENAI_MODEL) || 'gpt-5-mini',
      reasoning: { effort: 'minimal' },
      input: [
        {
          role: 'system',
          content: [buildSystemPrompt(), settingsBlock ? `Zusätzliche Vorgabe:\n${settingsBlock}` : '']
            .filter(Boolean)
            .join('\n\n'),
        },
        { role: 'user', content: buildUserPrompt(payload) },
      ],
    });

    const draftText = cleanText(response.output_text);
    if (!draftText) {
      return NextResponse.json({ ok: false, error: 'Kein Entwurf erzeugt.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, draftText });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'openai_message_draft_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
