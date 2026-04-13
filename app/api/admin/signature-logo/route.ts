import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const companyId = sanitizeSegment(cleanText(formData.get('companyId')));

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'file_missing' }, { status: 400 });
    }
    if (!companyId) {
      return NextResponse.json({ ok: false, error: 'company_id_missing' }, { status: 400 });
    }

    const extension = cleanText(file.name.split('.').pop()).toLowerCase() || 'png';
    const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'svg', 'webp']);
    const safeExtension = allowedExtensions.has(extension) ? extension : 'png';
    const uploadDirectory = join(process.cwd(), 'public', 'uploads', 'signatures');
    await mkdir(uploadDirectory, { recursive: true });

    const fileName = `${companyId}-${Date.now()}.${safeExtension}`;
    const targetPath = join(uploadDirectory, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(targetPath, buffer);

    return NextResponse.json({
      ok: true,
      url: `/uploads/signatures/${fileName}`,
    });
  } catch (error) {
    console.error('Fehler beim Signatur-Upload:', error);
    return NextResponse.json({ ok: false, error: 'signature_upload_failed' }, { status: 500 });
  }
}
