import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { fillDocxTemplate } from '../../../../lib/docxTemplate';
import { getAdminAuth, getAdminDb, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';

type LetterDocumentPayload = {
  fileName?: string;
  replacements?: Record<string, unknown>;
  templateUrl?: string;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeOutputName(value: string) {
  return (
    cleanText(value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 90) || 'Brief'
  );
}

async function requireAdmin(request: Request) {
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
    const decoded = await getAdminAuth().verifyIdToken(token);
    const profile = await getAdminDb().collection('userProfiles').doc(decoded.uid).get();
    if (!profile.exists || profile.data()?.role !== 'admin') {
      return {
        error: NextResponse.json({ ok: false, error: 'admin_required' }, { status: 403 }),
      };
    }
    return { error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_auth_token';
    return {
      error: NextResponse.json({ ok: false, error: message }, { status: 401 }),
    };
  }
}

function resolveTemplatePath(templateUrl: string) {
  const cleaned = cleanText(templateUrl);
  if (!cleaned.startsWith('/uploads/letter-templates/')) {
    throw new Error('letter_template_path_invalid');
  }
  const fileName = path.basename(cleaned);
  return path.join(process.cwd(), 'public', 'uploads', 'letter-templates', fileName);
}

export async function POST(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) {
    return adminCheck.error;
  }

  try {
    const payload = (await request.json()) as LetterDocumentPayload;
    const templateUrl = cleanText(payload.templateUrl);
    if (!templateUrl) {
      return NextResponse.json({ ok: false, error: 'letter_template_missing' }, { status: 400 });
    }

    const replacements = Object.fromEntries(
      Object.entries(payload.replacements ?? {}).map(([key, value]) => [key, cleanText(value)])
    );
    const templateBuffer = await readFile(resolveTemplatePath(templateUrl));
    const documentBuffer = fillDocxTemplate(templateBuffer, replacements);
    const outputName = `${sanitizeOutputName(cleanText(payload.fileName) || cleanText(replacements.SUBJECT) || 'Brief')}.docx`;

    return new NextResponse(documentBuffer, {
      headers: {
        'Content-Disposition': `attachment; filename="${outputName}"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'letter_document_create_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
