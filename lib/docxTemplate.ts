import { deflateRawSync, inflateRawSync } from 'node:zlib';

type ZipEntry = {
  compressedData: Buffer;
  compressedSize: number;
  compressionMethod: number;
  crc32: number;
  extra: Buffer;
  fileName: string;
  generalPurposeBitFlag: number;
  lastModDate: number;
  lastModTime: number;
  uncompressedSize: number;
};

const TEXT_XML_FILE_PATTERN = /^word\/document\.xml$/;
const NORMAL_FONT_SIZE = 20;
const SMALL_FONT_SIZE = 16;
const TEMPLATE_FONT_FAMILY = 'Tahoma';

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let current = index;
  for (let bit = 0; bit < 8; bit += 1) {
    current = current & 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
  }
  return current >>> 0;
});

function crc32(buffer: Buffer) {
  let current = 0xffffffff;
  for (const byte of buffer) {
    current = CRC_TABLE[(current ^ byte) & 0xff] ^ (current >>> 8);
  }
  return (current ^ 0xffffffff) >>> 0;
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function encodeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function encodeWordTextReplacement(value: string) {
  const lines = cleanText(value).split(/\r?\n/);
  return lines
    .map((line, index) =>
      index === 0
        ? encodeXml(line)
        : `</w:t></w:r><w:r>${wordTahomaRunProperties()}<w:br/><w:t>${encodeXml(line)}`
    )
    .join('');
}

function wordTahomaRunProperties(size = NORMAL_FONT_SIZE) {
  return `<w:rPr><w:rFonts w:ascii="${TEMPLATE_FONT_FAMILY}" w:hAnsi="${TEMPLATE_FONT_FAMILY}" w:cs="${TEMPLATE_FONT_FAMILY}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>`;
}

function encodeWordClosingReplacement(value: string) {
  const lines = cleanText(value).split(/\r?\n/).map(cleanText).filter(Boolean);
  const closing = lines[0] || 'Mit freundlichen Grüßen';
  const senderName = lines[1] || '';
  const companyName = lines[2] || '';

  return [
    encodeXml(closing),
    senderName
      ? `</w:t></w:r><w:r>${wordTahomaRunProperties()}<w:br/><w:br/><w:br/><w:t>${encodeXml(senderName)}`
      : '',
    companyName
      ? `</w:t></w:r><w:r>${wordTahomaRunProperties(SMALL_FONT_SIZE)}<w:br/><w:br/><w:t>${encodeXml(companyName)}`
      : '',
  ].join('');
}

function encodePlaceholderReplacement(key: string, value: string) {
  const normalizedKey = cleanText(key).replace(/^\{\{|\}\}$/g, '');
  if (normalizedKey === 'ABSCHLUSS' || normalizedKey === 'CLOSING_BLOCK') {
    return encodeWordClosingReplacement(value);
  }
  if (normalizedKey === 'BRIEFTEXT' || normalizedKey === 'BODY' || normalizedKey === 'BODY_TEXT') {
    return encodeXml(cleanText(value).replace(/\s*\r?\n\s*/g, ' '));
  }
  return encodeWordTextReplacement(value);
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error('docx_zip_eocd_missing');
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const endOffset = centralDirectoryOffset + centralDirectorySize;
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  while (offset < endOffset) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('docx_zip_central_directory_invalid');
    }

    const generalPurposeBitFlag = buffer.readUInt16LE(offset + 8);
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const lastModTime = buffer.readUInt16LE(offset + 12);
    const lastModDate = buffer.readUInt16LE(offset + 14);
    const crc = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString('utf8');
    const extra = buffer.subarray(offset + 46 + fileNameLength, offset + 46 + fileNameLength + extraLength);

    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error('docx_zip_local_header_invalid');
    }
    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize);

    entries.push({
      compressedData,
      compressedSize,
      compressionMethod,
      crc32: crc,
      extra: Buffer.from(extra),
      fileName,
      generalPurposeBitFlag,
      lastModDate,
      lastModTime,
      uncompressedSize,
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function readEntryContent(entry: ZipEntry) {
  if (entry.compressionMethod === 0) return Buffer.from(entry.compressedData);
  if (entry.compressionMethod === 8) return inflateRawSync(entry.compressedData);
  throw new Error(`unsupported_docx_zip_compression_${entry.compressionMethod}`);
}

function updateEntryContent(entry: ZipEntry, content: Buffer): ZipEntry {
  const compressedData = deflateRawSync(content);
  return {
    ...entry,
    compressedData,
    compressedSize: compressedData.length,
    compressionMethod: 8,
    crc32: crc32(content),
    generalPurposeBitFlag: entry.generalPurposeBitFlag & ~0x08,
    uncompressedSize: content.length,
  };
}

function writeZip(entries: ZipEntry[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const fileNameBuffer = Buffer.from(entry.fileName, 'utf8');
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(entry.generalPurposeBitFlag, 6);
    localHeader.writeUInt16LE(entry.compressionMethod, 8);
    localHeader.writeUInt16LE(entry.lastModTime, 10);
    localHeader.writeUInt16LE(entry.lastModDate, 12);
    localHeader.writeUInt32LE(entry.crc32, 14);
    localHeader.writeUInt32LE(entry.compressedSize, 18);
    localHeader.writeUInt32LE(entry.uncompressedSize, 22);
    localHeader.writeUInt16LE(fileNameBuffer.length, 26);
    localHeader.writeUInt16LE(entry.extra.length, 28);
    localParts.push(localHeader, fileNameBuffer, entry.extra, entry.compressedData);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(entry.generalPurposeBitFlag, 8);
    centralHeader.writeUInt16LE(entry.compressionMethod, 10);
    centralHeader.writeUInt16LE(entry.lastModTime, 12);
    centralHeader.writeUInt16LE(entry.lastModDate, 14);
    centralHeader.writeUInt32LE(entry.crc32, 16);
    centralHeader.writeUInt32LE(entry.compressedSize, 20);
    centralHeader.writeUInt32LE(entry.uncompressedSize, 24);
    centralHeader.writeUInt16LE(fileNameBuffer.length, 28);
    centralHeader.writeUInt16LE(entry.extra.length, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, fileNameBuffer, entry.extra);

    localOffset += localHeader.length + fileNameBuffer.length + entry.extra.length + entry.compressedData.length;
  }

  const centralDirectoryOffset = localOffset;
  const centralDirectory = Buffer.concat(centralParts);
  const localDirectory = Buffer.concat(localParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(centralDirectoryOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localDirectory, centralDirectory, eocd]);
}

function replacePlaceholders(xml: string, replacements: Record<string, string>) {
  const normalizedXml = normalizeWordRunFonts(xml);
  const directlyReplaced = Object.entries(replacements).reduce((current, [key, value]) => {
    const normalizedKey = cleanText(key).replace(/^\{\{|\}\}$/g, '');
    if (!normalizedKey) return current;
    const token = `{{${normalizedKey}}}`;
    return current.split(token).join(encodePlaceholderReplacement(normalizedKey, value));
  }, normalizedXml);

  return replaceSplitTextNodePlaceholders(directlyReplaced, replacements);
}

function normalizeRunProperties(runProperties: string) {
  let next = runProperties;
  if (/<w:rFonts\b[^>]*\/>/i.test(next)) {
    next = next.replace(
      /<w:rFonts\b[^>]*\/>/gi,
      `<w:rFonts w:ascii="${TEMPLATE_FONT_FAMILY}" w:hAnsi="${TEMPLATE_FONT_FAMILY}" w:cs="${TEMPLATE_FONT_FAMILY}"/>`
    );
  } else {
    next = next.replace(
      /<w:rPr\b[^>]*>/i,
      (match) =>
        `${match}<w:rFonts w:ascii="${TEMPLATE_FONT_FAMILY}" w:hAnsi="${TEMPLATE_FONT_FAMILY}" w:cs="${TEMPLATE_FONT_FAMILY}"/>`
    );
  }

  if (/<w:sz\b[^>]*\/>/i.test(next)) {
    next = next.replace(/<w:sz\b[^>]*\/>/gi, `<w:sz w:val="${NORMAL_FONT_SIZE}"/>`);
  } else {
    next = next.replace(/<\/w:rPr>/i, `<w:sz w:val="${NORMAL_FONT_SIZE}"/></w:rPr>`);
  }

  if (/<w:szCs\b[^>]*\/>/i.test(next)) {
    next = next.replace(/<w:szCs\b[^>]*\/>/gi, `<w:szCs w:val="${NORMAL_FONT_SIZE}"/>`);
  } else {
    next = next.replace(/<\/w:rPr>/i, `<w:szCs w:val="${NORMAL_FONT_SIZE}"/></w:rPr>`);
  }

  return next;
}

function normalizeWordRunFonts(xml: string) {
  return xml.replace(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g, (run) => {
    if (/<w:drawing\b|<w:pict\b/i.test(run)) return run;
    if (/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/i.test(run)) {
      return run.replace(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/i, (properties) =>
        normalizeRunProperties(properties)
      );
    }

    return run.replace(/<w:r\b[^>]*>/i, (match) => `${match}${wordTahomaRunProperties()}`);
  });
}

function replaceSplitTextNodePlaceholders(xml: string, replacements: Record<string, string>) {
  const textNodePattern = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  const matches = Array.from(xml.matchAll(textNodePattern));
  if (matches.length === 0) return xml;

  const nodes = matches.map((match) => ({
    content: match[1] ?? '',
    end: (match.index ?? 0) + match[0].length,
    fullText: match[0],
    start: match.index ?? 0,
  }));
  const contents = nodes.map((node) => node.content);

  for (const [key, value] of Object.entries(replacements)) {
    const normalizedKey = cleanText(key).replace(/^\{\{|\}\}$/g, '');
    if (!normalizedKey) continue;
    const token = `{{${normalizedKey}}}`;

    let combined = contents.join('');
    let tokenStart = combined.indexOf(token);
    while (tokenStart >= 0) {
      const tokenEnd = tokenStart + token.length;
      let cursor = 0;
      let firstNodeIndex = -1;
      let lastNodeIndex = -1;
      const ranges = contents.map((content, index) => {
        const start = cursor;
        const end = cursor + content.length;
        cursor = end;
        if (tokenStart < end && tokenEnd > start) {
          if (firstNodeIndex < 0) firstNodeIndex = index;
          lastNodeIndex = index;
        }
        return { end, start };
      });

      if (firstNodeIndex < 0 || lastNodeIndex < 0) break;

      for (let index = firstNodeIndex; index <= lastNodeIndex; index += 1) {
        const content = contents[index] ?? '';
        const range = ranges[index];
        const localStart = Math.max(tokenStart, range.start) - range.start;
        const localEnd = Math.min(tokenEnd, range.end) - range.start;
        const before = content.slice(0, localStart);
        const after = content.slice(localEnd);

        if (index === firstNodeIndex) {
          contents[index] = `${before}${encodePlaceholderReplacement(normalizedKey, value)}${index === lastNodeIndex ? after : ''}`;
        } else if (index === lastNodeIndex) {
          contents[index] = after;
        } else {
          contents[index] = '';
        }
      }

      combined = contents.join('');
      tokenStart = combined.indexOf(token);
    }
  }

  let output = '';
  let previousEnd = 0;
  nodes.forEach((node, index) => {
    output += xml.slice(previousEnd, node.start);
    output += node.fullText.replace(node.content, contents[index] ?? '');
    previousEnd = node.end;
  });
  output += xml.slice(previousEnd);
  return output;
}

export function fillDocxTemplate(buffer: Buffer, replacements: Record<string, string>) {
  const entries = readZipEntries(buffer);
  const nextEntries = entries.map((entry) => {
    if (!TEXT_XML_FILE_PATTERN.test(entry.fileName)) return entry;
    const content = readEntryContent(entry);
    const xml = content.toString('utf8');
    const replacedXml = replacePlaceholders(xml, replacements);
    if (replacedXml === xml) return entry;
    return updateEntryContent(entry, Buffer.from(replacedXml, 'utf8'));
  });

  return writeZip(nextEntries);
}
