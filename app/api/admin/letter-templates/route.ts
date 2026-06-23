import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminStorageBucket, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';

const MAX_TEMPLATE_SIZE = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.doc', '.docx', '.dot', '.dotx']);

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildFirebaseStorageDownloadUrl(bucketName: string, storagePath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
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
    const templateType = cleanText(formData.get('templateType')) || 'letter';
    const file = formData.get('file');

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

    const savedName = `${sanitizeFileName(templateType)}-${Date.now()}-${originalName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    let url = '';

    if (hasFirebaseAdminConfig()) {
      const bucket = getAdminStorageBucket();
      const storagePath = `letter-templates/${savedName}`;
      const downloadToken = randomUUID();
      await bucket.file(storagePath).save(buffer, {
        contentType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        metadata: {
          metadata: {
            firebaseStorageDownloadTokens: downloadToken,
          },
        },
      });
      url = buildFirebaseStorageDownloadUrl(bucket.name, storagePath, downloadToken);
    } else {
      const uploadDirectory = path.join(process.cwd(), 'public', 'uploads', 'letter-templates');
      await mkdir(uploadDirectory, { recursive: true });
      const targetPath = path.join(uploadDirectory, savedName);
      await writeFile(targetPath, buffer);
      url = `/uploads/letter-templates/${savedName}`;
    }

    return NextResponse.json({
      fileName: savedName,
      ok: true,
      originalName: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'letter_template_upload_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
