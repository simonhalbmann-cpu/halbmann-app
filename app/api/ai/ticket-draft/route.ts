import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { getAiSettingsServer } from '../../../../lib/aiConfigServer';
import { getAdminAuth, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';

type DraftPayload = {
  companyName?: string;
  contextMode?: 'new' | 'reply';
  currentBody?: string;
  instruction?: string;
  issueText?: string;
  mode?: 'service' | 'tenant';
  propertyName?: string;
  recipientEmail?: string;
  recipientName?: string;
  recipientSalutation?: string;
  senderCompanyName?: string;
  tenantEmail?: string;
  tenantName?: string;
  tenantPhone?: string;
  ticketTitle?: string;
  tradeLabel?: string;
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

function buildSystemPrompt(mode: 'service' | 'tenant') {
  const shared = [
    'Du erzeugst nur den eigentlichen Nachrichtentext.',
    'Kein Betreff, keine Signatur, kein Absenderblock.',
    'Keine Schlussformel mit Namen oder Firmennamen ergänzen.',
    'Unterschreibe niemals mit dem Namen des Empfängers.',
    'Wenn bereits ein Entwurf vorhanden ist, überarbeite genau diesen Entwurf statt neu anzufangen.',
    'Die neueste Nutzeranweisung hat immer Vorrang.',
    'Verwende nur die Informationen aus dem Kontext und erfinde keine Fakten.',
    'Behandle nur das aktuelle Einzelticket und niemals andere Probleme aus derselben Ursprungsmail.',
    'Ignoriere andere Maengel oder Nebenprobleme vollstaendig, selbst wenn sie in der Ursprungsnachricht vorkommen.',
    'Wenn der Nutzer eine Aenderung vorgibt, musst du genau diese Aenderung umsetzen und darfst nicht zur alten Standardantwort zurueckspringen.',
    'Der Anredehinweis ist verbindlich. Wenn "Frau" angegeben ist, darf niemals "Herr" verwendet werden.',
  ];

  const modeSpecific =
    mode === 'service'
      ? [
          'Du schreibst kurze, professionelle deutschsprachige Nachrichten einer Immobilienverwaltung an ein Gewerk.',
          'Schreibe konkret, freundlich und handlungsorientiert.',
          'Nenne klar Problem, Objekt und Einheit.',
          'Verwende ausschliesslich das uebergebene Gewerk und erfinde kein anderes.',
          'Wenn Kontaktdaten des Mieters vorhanden sind, nenne sie ausdrücklich.',
        ]
      : [
          'Du schreibst kurze, professionelle deutschsprachige Nachrichten einer Immobilienverwaltung an Mieter.',
          'Sprich den Mieter korrekt mit seinem Namen an.',
          'Wenn ein Anredehinweis wie Frau oder Herr vorhanden ist, musst du ihn exakt übernehmen.',
          'Wenn die Nutzeranweisung sagt, dass sich eine Firma meldet, frage den Mieter nicht erneut nach seiner Verfügbarkeit.',
          'Schreibe freundlich, verbindlich und lösungsorientiert.',
        ];

  return [...modeSpecific, ...shared].join(' ');
}

function buildUserPrompt(payload: DraftPayload, mode: 'service' | 'tenant') {
  const contextMode = payload.contextMode === 'new' ? 'new' : 'reply';
  return [
    `Modus: ${mode === 'service' ? 'Nachricht an Gewerk' : 'Nachricht an Mieter'}`,
    `Kontextmodus: ${contextMode === 'reply' ? 'Antwort auf bestehenden Verlauf' : 'Neue Nachricht im Ticket'}`,
    `Tickettitel: ${cleanText(payload.ticketTitle) || '–'}`,
    `Firma: ${cleanText(payload.companyName || payload.senderCompanyName) || '–'}`,
    `Objekt: ${cleanText(payload.propertyName) || '–'}`,
    `Einheit: ${cleanText(payload.unitLabel) || '–'}`,
    `Mieter: ${cleanText(payload.tenantName) || '–'}`,
    `Telefon Mieter: ${cleanText(payload.tenantPhone) || '–'}`,
    `E-Mail Mieter: ${cleanText(payload.tenantEmail) || '–'}`,
    `Gewerk: ${cleanText(payload.tradeLabel) || '–'}`,
    `Empfängername: ${cleanText(payload.recipientName) || '–'}`,
    `Anredehinweis: ${cleanText(payload.recipientSalutation) || '–'}`,
    `Empfänger E-Mail: ${cleanText(payload.recipientEmail) || '–'}`,
    '',
    'Aktuelles Ticketthema:',
    cleanText(payload.issueText) || '–',
    '',
    'Bisheriger Entwurf:',
    cleanText(payload.currentBody) || '–',
    '',
    'Zusätzliche Anweisung:',
    cleanText(payload.instruction) || 'Keine',
    '',
    contextMode === 'reply'
      ? mode === 'service'
        ? 'Schreibe jetzt die passende Antwort oder Rückmeldung für das Gewerk zu diesem Ticket.'
        : 'Schreibe jetzt die passende Antwort an den Mieter zu diesem Ticket.'
      : mode === 'service'
        ? 'Schreibe jetzt eine neue Nachricht an das Gewerk zu genau diesem Ticket.'
        : 'Schreibe jetzt eine neue Nachricht an den Mieter zu genau diesem Ticket.',
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
    const payload = (await request.json()) as DraftPayload;
    const mode = payload.mode === 'service' ? 'service' : 'tenant';
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
          content: [buildSystemPrompt(mode), settingsBlock ? `Zusätzliche Vorgabe:\n${settingsBlock}` : '']
            .filter(Boolean)
            .join('\n\n'),
        },
        { role: 'user', content: buildUserPrompt(payload, mode) },
      ],
    });

    const draftText = cleanText(response.output_text);
    if (!draftText) {
      return NextResponse.json({ ok: false, error: 'Kein Entwurf erzeugt.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, draftText });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'openai_draft_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
