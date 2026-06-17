import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, hasFirebaseAdminConfig } from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';

type HandoverRow = {
  count?: unknown;
  label?: unknown;
  meterNumber?: unknown;
  value?: unknown;
};

type HandoverPdfPayload = {
  confirmationText?: unknown;
  defects?: unknown;
  fileName?: unknown;
  kind?: unknown;
  keys?: HandoverRow[];
  landlordName?: unknown;
  landlordSignatureImage?: unknown;
  meters?: HandoverRow[];
  notes?: unknown;
  objectName?: unknown;
  place?: unknown;
  protocolId?: unknown;
  tenantName?: unknown;
  tenantSignatureImage?: unknown;
  unitLabel?: unknown;
};

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 48;
const contentWidth = pageWidth - margin * 2;

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeOutputName(value: unknown) {
  return (
    cleanText(value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 90) || 'Uebergabeprotokoll'
  );
}

function normalizePdfText(value: unknown) {
  return cleanText(value)
    .replace(/[–—]/g, '-')
    .replace(/[„“]/g, '"')
    .replace(/[‚‘’]/g, "'")
    .replace(/\u00a0/g, ' ');
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const normalized = normalizePdfText(text);
  if (!normalized) return [''];
  const lines: string[] = [];
  for (const paragraph of normalized.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  font: PDFFont,
  fontSize: number,
  x: number,
  y: number,
  maxWidth: number,
  color = rgb(0.12, 0.16, 0.22)
) {
  let nextY = y;
  for (const line of wrapText(text, font, fontSize, maxWidth)) {
    page.drawText(line, { color, font, size: fontSize, x, y: nextY });
    nextY -= fontSize + 5;
  }
  return nextY;
}

function addPage(pdfDoc: PDFDocument) {
  return pdfDoc.addPage([pageWidth, pageHeight]);
}

function ensureSpace(state: { page: PDFPage; y: number }, pdfDoc: PDFDocument, needed: number) {
  if (state.y - needed >= margin) return;
  state.page = addPage(pdfDoc);
  state.y = pageHeight - margin;
}

function drawSectionTitle(state: { page: PDFPage; y: number }, pdfDoc: PDFDocument, font: PDFFont, title: string) {
  ensureSpace(state, pdfDoc, 36);
  state.page.drawText(title, {
    color: rgb(0.43, 0.29, 0.16),
    font,
    size: 13,
    x: margin,
    y: state.y,
  });
  state.y -= 22;
}

function drawKeyValue(
  state: { page: PDFPage; y: number },
  pdfDoc: PDFDocument,
  fonts: { bold: PDFFont; regular: PDFFont },
  label: string,
  value: string
) {
  ensureSpace(state, pdfDoc, 26);
  state.page.drawText(label, { color: rgb(0.34, 0.33, 0.31), font: fonts.bold, size: 10, x: margin, y: state.y });
  state.y = drawWrappedText(state.page, value || '-', fonts.regular, 10, margin + 130, state.y, contentWidth - 130);
  state.y -= 4;
}

function drawSimpleTable(
  state: { page: PDFPage; y: number },
  pdfDoc: PDFDocument,
  fonts: { bold: PDFFont; regular: PDFFont },
  headers: string[],
  rows: string[][]
) {
  ensureSpace(state, pdfDoc, 34);
  const columnWidth = contentWidth / headers.length;
  headers.forEach((header, index) => {
    state.page.drawText(header, {
      color: rgb(0.12, 0.16, 0.22),
      font: fonts.bold,
      size: 9,
      x: margin + index * columnWidth,
      y: state.y,
    });
  });
  state.y -= 16;

  const nextRows = rows.length > 0 ? rows : [headers.map(() => '-')];
  for (const row of nextRows) {
    ensureSpace(state, pdfDoc, 30);
    const startY = state.y;
    let minY = state.y;
    row.forEach((cell, index) => {
      const cellY = drawWrappedText(
        state.page,
        cell || '-',
        fonts.regular,
        9,
        margin + index * columnWidth,
        startY,
        columnWidth - 10
      );
      minY = Math.min(minY, cellY);
    });
    state.y = minY - 6;
  }
}

function parsePngDataUrl(value: unknown) {
  const text = cleanText(value);
  const match = /^data:image\/png;base64,(.+)$/i.exec(text);
  return match ? match[1] : '';
}

async function drawSignature(
  state: { page: PDFPage; y: number },
  pdfDoc: PDFDocument,
  fonts: { bold: PDFFont; regular: PDFFont },
  label: string,
  signerName: string,
  dataUrl: unknown,
  x: number
) {
  state.page.drawText(label, { color: rgb(0.12, 0.16, 0.22), font: fonts.bold, size: 10, x, y: state.y });
  const imageBase64 = parsePngDataUrl(dataUrl);
  if (imageBase64) {
    const image = await pdfDoc.embedPng(Buffer.from(imageBase64, 'base64'));
    const scaled = image.scaleToFit(190, 66);
    state.page.drawImage(image, { height: scaled.height, width: scaled.width, x, y: state.y - 76 });
  } else {
    state.page.drawText('Nicht erfasst', { color: rgb(0.45, 0.45, 0.45), font: fonts.regular, size: 10, x, y: state.y - 34 });
  }
  state.page.drawLine({
    color: rgb(0.65, 0.63, 0.6),
    end: { x: x + 200, y: state.y - 82 },
    start: { x, y: state.y - 82 },
    thickness: 0.8,
  });
  state.page.drawText(signerName || '-', { color: rgb(0.34, 0.33, 0.31), font: fonts.regular, size: 9, x, y: state.y - 98 });
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
  if (adminCheck.error) return adminCheck.error;

  try {
    const payload = (await request.json()) as HandoverPdfPayload;
    const pdfDoc = await PDFDocument.create();
    const fonts = {
      bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
      regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    };
    const state = { page: addPage(pdfDoc), y: pageHeight - margin };
    const title = cleanText(payload.kind) === 'moveOut' ? 'Uebergabeprotokoll Auszug' : 'Uebergabeprotokoll Einzug';

    state.page.drawText(title, { color: rgb(0.07, 0.09, 0.14), font: fonts.bold, size: 22, x: margin, y: state.y });
    state.y -= 22;
    state.y = drawWrappedText(
      state.page,
      `Protokoll-ID: ${normalizePdfText(payload.protocolId)} - erstellt am ${new Date().toLocaleString('de-DE')}`,
      fonts.regular,
      10,
      margin,
      state.y,
      contentWidth,
      rgb(0.38, 0.42, 0.48)
    );
    state.y -= 14;

    drawSectionTitle(state, pdfDoc, fonts.bold, 'Grunddaten');
    drawKeyValue(state, pdfDoc, fonts, 'Ort / Treffpunkt', normalizePdfText(payload.place));
    drawKeyValue(state, pdfDoc, fonts, 'Mieter', normalizePdfText(payload.tenantName));
    drawKeyValue(state, pdfDoc, fonts, 'Vermieter', normalizePdfText(payload.landlordName));
    drawKeyValue(state, pdfDoc, fonts, 'Objekt', normalizePdfText(payload.objectName));
    drawKeyValue(state, pdfDoc, fonts, 'Einheit', normalizePdfText(payload.unitLabel));

    drawSectionTitle(state, pdfDoc, fonts.bold, 'Maengel / offene Punkte');
    state.y = drawWrappedText(state.page, normalizePdfText(payload.defects) || 'Keine Angaben', fonts.regular, 10, margin, state.y, contentWidth);
    state.y -= 10;

    drawSectionTitle(state, pdfDoc, fonts.bold, 'Zaehlerstaende');
    drawSimpleTable(
      state,
      pdfDoc,
      fonts,
      ['Bezeichnung', 'Zaehlernummer', 'Stand'],
      (Array.isArray(payload.meters) ? payload.meters : []).map((row) => [
        normalizePdfText(row.label),
        normalizePdfText(row.meterNumber),
        normalizePdfText(row.value),
      ])
    );

    drawSectionTitle(state, pdfDoc, fonts.bold, 'Schluessel');
    drawSimpleTable(
      state,
      pdfDoc,
      fonts,
      ['Bezeichnung', 'Soll', 'Uebergabe'],
      (Array.isArray(payload.keys) ? payload.keys : []).map((row) => [
        normalizePdfText(row.label),
        normalizePdfText(row.count),
        normalizePdfText(row.value),
      ])
    );

    drawSectionTitle(state, pdfDoc, fonts.bold, 'Bestaetigung und Unterschriften');
    state.y = drawWrappedText(state.page, normalizePdfText(payload.confirmationText), fonts.regular, 10, margin, state.y, contentWidth);
    state.y -= 16;
    ensureSpace(state, pdfDoc, 130);
    await drawSignature(state, pdfDoc, fonts, 'Unterschrift Mieter', normalizePdfText(payload.tenantName), payload.tenantSignatureImage, margin);
    await drawSignature(
      state,
      pdfDoc,
      fonts,
      'Unterschrift Vermieter',
      normalizePdfText(payload.landlordName),
      payload.landlordSignatureImage,
      margin + contentWidth / 2
    );
    state.y -= 118;

    drawSectionTitle(state, pdfDoc, fonts.bold, 'Notizen');
    drawWrappedText(state.page, normalizePdfText(payload.notes) || 'Keine Angaben', fonts.regular, 10, margin, state.y, contentWidth);

    const pdfBytes = await pdfDoc.save();
    const outputName = `${sanitizeOutputName(payload.fileName || title)}.pdf`;
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Disposition': `attachment; filename="${outputName}"`,
        'Content-Type': 'application/pdf',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'handover_pdf_create_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
