import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { getAiSettingsServer } from '../../../../lib/aiConfigServer';
import { buildIssueSuggestionsFromText } from '../../../../lib/adminWorkflow';
import { getAdminAuth, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';

type SuggestionPayload = {
  instruction?: string;
  messageText?: string;
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

function buildSystemPrompt() {
  return [
    'Du analysierst eingehende Nachrichten einer Hausverwaltung.',
    'Wenn eine Nachricht mehrere Probleme enthält, zerlege sie in einzelne Ticketvorschläge.',
    'Für jeden Vorschlag gibst du nur ein Thema zurück.',
    'Formuliere kurze, präzise deutsche Tickettitel ohne Floskeln.',
    'Ein Tickettitel darf nie zwei Probleme zusammenfassen.',
    'Bevorzuge konkrete Titel wie "Verstopfung in Küche", "Tropfende Toilette" oder "Mangelhafte Treppenhausreinigung".',
    'Verwende möglichst kurze, klare Titel im Singular ohne Nebensätze.',
    'Wenn ein Problem in einem Raum genannt ist, übernimm den Raum in den Titel.',
    'Formuliere Reinigungsprobleme als "Mangelhafte Treppenhausreinigung" oder ähnlich präzise.',
    'Gib ausschließlich JSON zurück im Format {"suggestions":[{"title":"...","focus":"..."}]}.',
    'Erfinde keine Themen, die nicht im Text stehen.',
  ].join(' ');
}

function buildUserPrompt(payload: SuggestionPayload) {
  return [
    `Betreff: ${cleanText(payload.subject) || '–'}`,
    '',
    'Nachricht:',
    cleanText(payload.messageText) || '–',
    '',
    'Zusätzliche Anweisung:',
    cleanText(payload.instruction) || 'Keine',
    '',
    'Erzeuge passende Ticketvorschläge.',
  ].join('\n');
}

function parseSuggestions(raw: string) {
  try {
    const parsed = JSON.parse(raw) as { suggestions?: Array<{ focus?: string; title?: string }> };
    return Array.isArray(parsed.suggestions)
      ? parsed.suggestions
          .map((entry) => ({
            focus: cleanText(entry.focus),
            title: cleanText(entry.title),
          }))
          .filter((entry) => entry.focus && entry.title)
      : [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const authState = await requireAuthenticatedUser(request);
  if (authState.error) {
    return authState.error;
  }

  const payload = (await request.json()) as SuggestionPayload;
  const fallback = buildIssueSuggestionsFromText(cleanText(payload.messageText));

  const apiKey = cleanText(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    return NextResponse.json({ ok: true, suggestions: fallback });
  }

  try {
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

    const parsed = parseSuggestions(cleanText(response.output_text));
    return NextResponse.json({
      ok: true,
      suggestions: parsed.length > 0 ? parsed : fallback,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ticket_suggestion_failed';
    return NextResponse.json({
      ok: true,
      notice: message,
      suggestions: fallback,
    });
  }
}
