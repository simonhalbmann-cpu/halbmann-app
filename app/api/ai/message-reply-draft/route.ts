import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { getAiSettingsServer } from '../../../../lib/aiConfigServer';
import { getAdminAuth, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';

type MessageReplyDraftPayload = {
  companyName?: string;
  contextMode?: 'new' | 'reply';
  currentBody?: string;
  deliveryMode?: 'both' | 'email' | 'letter';
  historyText?: string;
  instruction?: string;
  issueText?: string;
  meters?: string[];
  propertyName?: string;
  recipientEmail?: string;
  recipientName?: string;
  recipientSalutation?: string;
  senderEmail?: string;
  subject?: string;
  unitLabel?: string;
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

function buildSystemPrompt(deliveryMode: MessageReplyDraftPayload['deliveryMode']) {
  return [
    'Du schreibst kurze, professionelle deutschsprachige Nachrichten einer Immobilienverwaltung an Mieter.',
    'Die zusätzliche Anweisung des Nutzers ist verbindlich und hat immer höchste Priorität vor Stilvorgaben und Standardformulierungen.',
    'Erzeuge nur den Nachrichtentext ohne Betreff und ohne Signatur.',
    deliveryMode === 'letter'
      ? 'Wenn die Nachricht in eine Briefvorlage eingefügt wird, darfst du keine Anrede und keine Abschlussformel schreiben.'
      : '',
    'Sprich den Mieter mit seinem echten Namen an, niemals mit dem Firmennamen der Verwaltung.',
    'Wenn ein Anredehinweis wie Frau oder Herr vorhanden ist, musst du ihn exakt übernehmen.',
    'Wenn kein sauberer Name vorliegt, verwende eine neutrale Anrede wie "Guten Tag".',
    'Keine Schlussformel mit Namen oder Firmennamen ergänzen.',
    'Wenn bereits ein Entwurf vorhanden ist, überarbeite genau diesen Entwurf statt neu zu beginnen.',
    'Die neueste Nutzeranweisung hat immer Vorrang.',
    'Verwende nur Informationen aus dem Kontext und erfinde keine Fakten.',
    'Nenne niemals interne Firmenadressen oder bitte den Mieter nicht, an die Verwaltungsadresse zu schreiben, außer die Nutzeranweisung verlangt das ausdrücklich.',
    'Wenn der Kontextmodus "Neue Nachricht" ist, ignoriere frühere Probleme vollständig und schreibe nur zur aktuellen Nutzeranweisung.',
    'Wenn der Kontextmodus "Neue Nachricht" ist, darfst du frühere Themen wie Wasserschaden, Zähler, Ablesung, Termine oder andere Altvorgänge nicht erwähnen, außer die aktuelle Nutzeranweisung verlangt das ausdrücklich.',
    'Wenn der Kontextmodus "Neue Nachricht" ist, dürfen Objekt-, Einheits- oder Zählerdaten nur genannt werden, wenn sie für die aktuelle Nutzeranweisung unmittelbar nötig sind.',
    'Wenn eine Antwortadresse genannt werden soll, darf nur die konfigurierte Absenderadresse verwendet werden.',
    'Wenn Zählerdaten vorhanden sind und die Anweisung zu Zählerständen, Ablesung oder Zählertausch passt, liste die vorhandenen Zähler konkret mit auf.',
    'Wenn der Anredehinweis "Frau" ist, darfst du unter keinen Umständen "Herr" schreiben.',
  ]
    .filter(Boolean)
    .join(' ');
}

function buildUserPrompt(payload: MessageReplyDraftPayload) {
  const contextMode = payload.contextMode === 'new' ? 'new' : 'reply';
  const instruction = cleanText(payload.instruction);
  const includeContextDetails = contextMode === 'reply';
  const meters =
    includeContextDetails && Array.isArray(payload.meters) && payload.meters.length > 0
      ? payload.meters.join('; ')
      : 'keine';
  return [
    `Firma: ${cleanText(payload.companyName) || '–'}`,
    `Mieter: ${cleanText(payload.recipientName) || '–'}`,
    `Anredehinweis: ${cleanText(payload.recipientSalutation) || '–'}`,
    `Zielkanal: ${payload.deliveryMode === 'letter' ? 'Briefvorlage' : 'E-Mail / Standard'}`,
    `E-Mail Mieter: ${cleanText(payload.recipientEmail) || '–'}`,
    `Absenderadresse: ${cleanText(payload.senderEmail) || 'portal@halbmann-holding.de'}`,
    `Objekt: ${includeContextDetails ? cleanText(payload.propertyName) || '–' : 'Ignorieren'}`,
    `Einheit: ${includeContextDetails ? cleanText(payload.unitLabel) || '–' : 'Ignorieren'}`,
    `Betreff: ${cleanText(payload.subject) || '–'}`,
    `Kontextmodus: ${contextMode === 'reply' ? 'Antwort auf bestehenden Verlauf' : 'Neue Nachricht'}`,
    '',
    'Zugeordnete Zähler:',
    meters,
    '',
    contextMode === 'reply' ? 'Ausgangsnachricht des Mieters:' : 'Frühere Themen:',
    cleanText(contextMode === 'reply' ? payload.issueText : '') || 'Ignorieren',
    '',
    'Bisheriger Entwurf:',
    cleanText(payload.currentBody) || '–',
    '',
    'Zusätzliche Anweisung:',
    instruction || 'Keine',
    instruction ? 'Diese zusätzliche Anweisung ist verbindlich. Setze sie exakt um.' : '',
    '',
    contextMode === 'reply'
      ? 'Schreibe jetzt eine passende Antwort an den Mieter.'
      : 'Schreibe jetzt eine neue, eigenständige Nachricht an den Mieter. Frühere Probleme dürfen nicht erwähnt werden, außer die Anweisung verlangt das ausdrücklich.',
  ]
    .filter(Boolean)
    .join('\n');
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
    const payload = (await request.json()) as MessageReplyDraftPayload;
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
          content: [buildSystemPrompt(payload.deliveryMode), settingsBlock ? `Zusätzliche Vorgabe:\n${settingsBlock}` : '']
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
    const message = error instanceof Error ? error.message : 'openai_message_reply_draft_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
