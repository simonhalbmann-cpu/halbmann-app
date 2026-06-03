import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';
import { readLocalPortalSessionCookie } from '../../../../lib/localPortalSession';

export const runtime = 'nodejs';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 5;
const PUBLIC_UPLOAD_DIRECTORY = path.join(
  process.cwd(),
  'public',
  'uploads',
  'portal-attachments'
);

type PortalAttachmentAuthState = {
  error: NextResponse | null;
  uid: string;
};

function sanitizeFileName(fileName: string) {
  const trimmed = fileName.trim();
  const baseName = trimmed ? path.basename(trimmed) : 'anhang';
  return baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function requireAuthenticatedPortalUser(request: Request): Promise<PortalAttachmentAuthState> {
  if (!hasFirebaseAdminConfig()) {
    const localSession = await readLocalPortalSessionCookie();
    if (!localSession) {
      return {
        error: NextResponse.json({ ok: false, error: 'missing_auth_token' }, { status: 401 }),
        uid: '',
      };
    }

    return {
      error: null,
      uid: localSession.uid,
    };
  }

  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    return {
      error: NextResponse.json({ ok: false, error: 'missing_auth_token' }, { status: 401 }),
      uid: '',
    };
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const profileSnapshot = await getAdminDb().collection('userProfiles').doc(decoded.uid).get();
    const profile = profileSnapshot.data() ?? null;

    if (!profileSnapshot.exists || profile?.role !== 'portal') {
      return {
        error: NextResponse.json({ ok: false, error: 'portal_required' }, { status: 403 }),
        uid: '',
      };
    }

    return {
      error: null,
      uid: decoded.uid,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_auth_token';
    return {
      error: NextResponse.json({ ok: false, error: message }, { status: 401 }),
      uid: '',
    };
  }
}

export async function POST(request: Request) {
  try {
    const authState = await requireAuthenticatedPortalUser(request);
    if (authState.error) {
      return authState.error;
    }

    const formData = await request.formData();
    const files = formData
      .getAll('files')
      .filter((entry): entry is File => typeof File !== 'undefined' && entry instanceof File);

    if (!files.length) {
      return NextResponse.json({ ok: false, error: 'files_missing' }, { status: 400 });
    }

    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        {
          ok: false,
          error: `Es koennen maximal ${MAX_FILES_PER_REQUEST} Anhaenge gleichzeitig hochgeladen werden.`,
        },
        { status: 400 }
      );
    }

    await fs.mkdir(PUBLIC_UPLOAD_DIRECTORY, { recursive: true });

    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          throw new Error(
            `Die Datei "${file.name}" ist zu gross. Maximal erlaubt sind 10 MB pro Datei.`
          );
        }

        const safeName = sanitizeFileName(file.name);
        const extension = path.extname(safeName);
        const baseName = extension ? safeName.slice(0, -extension.length) : safeName;
        const storedName = `${baseName}-${crypto.randomUUID()}${extension}`;
        const destinationPath = path.join(PUBLIC_UPLOAD_DIRECTORY, storedName);
        const buffer = Buffer.from(await file.arrayBuffer());

        await fs.writeFile(destinationPath, buffer);

        return {
          contentType: file.type || 'application/octet-stream',
          name: safeName,
          size: file.size,
          url: `/uploads/portal-attachments/${storedName}`,
        };
      })
    );

    return NextResponse.json({ attachments: uploadedFiles, ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'portal_attachment_upload_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
