import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';

const MAX_TEMPLATE_SIZE = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.doc', '.docx', '.dot', '.dotx']);

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeFileName(value: string) {
  return (
    cleanText(value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 90) || 'briefvorlage'
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

export async function POST(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) {
    return adminCheck.error;
  }

  try {
    const formData = await request.formData();
    const companyId = cleanText(formData.get('companyId'));
    const file = formData.get('file');

    if (!companyId) {
      return NextResponse.json({ ok: false, error: 'company_id_missing' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'template_file_missing' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_TEMPLATE_SIZE) {
      return NextResponse.json({ ok: false, error: 'template_file_size_invalid' }, { status: 400 });
    }

    const originalName = sanitizeFileName(file.name);
    const extension = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json({ ok: false, error: 'template_file_type_invalid' }, { status: 400 });
    }

    const uploadDirectory = path.join(process.cwd(), 'public', 'uploads', 'letter-templates');
    await mkdir(uploadDirectory, { recursive: true });

    const savedName = `${sanitizeFileName(companyId)}-${Date.now()}-${originalName}`;
    const targetPath = path.join(uploadDirectory, savedName);
    await writeFile(targetPath, Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({
      fileName: savedName,
      ok: true,
      originalName: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      url: `/uploads/letter-templates/${savedName}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'letter_template_upload_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
