'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildLetterHtml,
  buildLetterTemplatePreviewHtml,
  type SignatureRecord,
} from '../../lib/signatures';

const LETTER_PAGE_WIDTH = 794;
const LETTER_PAGE_HEIGHT = 1123;
const FONT_FAMILIES = ['Arial', 'Georgia', 'Times New Roman', 'Verdana'];
const FONT_SIZES = ['10', '11', '12', '13', '14', '15', '16', '18'];

type LetterComposeEditorProps = {
  body: string;
  className?: string;
  context?: {
    propertyName?: string;
    unitLabel?: string;
  };
  onChange: (value: string) => void;
  placeholder?: string;
  recipient?: {
    address?: string;
    company?: string;
    name?: string;
  };
  recipientOptions?: Array<{
    description?: string;
    key: string;
    label: string;
  }>;
  selectedRecipientKey?: string;
  onRecipientChange?: (value: string) => void;
  signature: SignatureRecord;
  subject?: string;
};

function normalizeLetterBodyText(value: string) {
  return value.replace(/\u00a0/g, ' ').replace(/\r/g, '').trimEnd();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textToHtml(value: string) {
  return escapeHtml(value).replace(/\n/g, '<br />');
}

function htmlToText(value: string) {
  if (typeof document === 'undefined') {
    return value.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trimEnd();
  }
  const container = document.createElement('div');
  container.innerHTML = value;

  const blockTags = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'TABLE', 'TR']);
  const parts: string[] = [];

  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').replace(/\u00a0/g, ' ');
      if (text) parts.push(text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;
    const tag = element.tagName.toUpperCase();

    if (tag === 'BR') {
      parts.push('\n');
      return;
    }

    const isBlock = blockTags.has(tag);
    if (isBlock && parts.length > 0 && !parts[parts.length - 1]?.endsWith('\n')) {
      parts.push('\n');
    }

    Array.from(element.childNodes).forEach(visit);

    if (isBlock && parts.length > 0 && !parts[parts.length - 1]?.endsWith('\n')) {
      parts.push('\n');
    }
  };

  Array.from(container.childNodes).forEach(visit);

  return parts
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trimEnd();
}

function cleanEditorHtml(value: string) {
  if (typeof document === 'undefined') {
    return value.replace(/\u200b/g, '').trim();
  }

  const template = document.createElement('template');
  template.innerHTML = value;

  const unwrapElement = (element: HTMLElement) => {
    const parent = element.parentNode;
    if (!parent) return;
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    parent.removeChild(element);
  };

  const normalizeNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent = (node.textContent || '').replace(/\u200b/g, '');
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as HTMLElement;
    Array.from(element.childNodes).forEach(normalizeNode);

    if (element.tagName === 'SPAN') {
      const style = (element.getAttribute('style') || '').trim();
      if (!style && element.attributes.length === 0) {
        unwrapElement(element);
        return;
      }
    }

    if (element.tagName === 'DIV') {
      const inner = element.innerHTML
        .replace(/\u200b/g, '')
        .replace(/&nbsp;/gi, '')
        .replace(/<br\s*\/?>/gi, '')
        .trim();
      if (!inner) {
        element.innerHTML = '<br />';
      }
    }
  };

  Array.from(template.content.childNodes).forEach(normalizeNode);
  return template.innerHTML.replace(/\u200b/g, '').trim();
}

function takeFirstLines(value: string, count: number) {
  return value.split('\n').slice(0, count).join('\n');
}

function stripSecondPageLeadContent(
  html: string,
  options: {
    address?: string;
    company?: string;
    name?: string;
    subject?: string;
  }
) {
  let result = html;

  const removableTexts = [
    options.company,
    options.name,
    options.address,
    options.subject ? `Betreff:${options.subject}` : '',
    options.subject ? `Betreff: ${options.subject}` : '',
    'Objekt:',
  ]
    .map((value) => normalizeLetterBodyText(value || ''))
    .filter(Boolean)
    .map((value) => escapeHtml(value).replace(/\s+/g, '\\s*'));

  removableTexts.forEach((pattern) => {
    result = result.replace(new RegExp(`<div[^>]*>[\\s\\S]*?${pattern}[\\s\\S]*?<\\/div>`, 'gi'), '');
  });

  result = result.replace(
    /<div[^>]*>\s*(?:[A-Za-zÄÖÜäöüß.\-]+\s*,\s*)?\d{1,2}\.\s*[A-Za-zÄÖÜäöüß]+\s*\d{4}\s*<\/div>/gi,
    ''
  );

  return result;
}

function renderPreviewPage({
  bodyHtml,
  fontPx,
  lineHeightRatio,
  pagePadding,
  signature,
  layout,
}: {
  bodyHtml: string;
  fontPx: number;
  lineHeightRatio: number;
  pagePadding: string;
  signature: SignatureRecord;
  layout: {
    headerHtml: string;
    footerHtml: string;
  };
}) {
  return (
    <div
      className="box-border rounded-[2px] border border-stone-300 bg-white shadow-[0_18px_40px_-32px_rgba(15,23,42,0.25)]"
      style={{
        color: '#1f2937',
        fontFamily: signature.fontFamily || 'Georgia, Times New Roman, serif',
        fontSize: `${fontPx}px`,
        lineHeight: String(lineHeightRatio),
        minHeight: `${LETTER_PAGE_HEIGHT}px`,
        padding: pagePadding,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: `${LETTER_PAGE_HEIGHT - signature.letterMarginTop - signature.letterMarginBottom}px`,
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: layout.headerHtml }} />
        <div
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflow: 'hidden',
          }}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
        <div style={{ marginTop: 'auto' }} dangerouslySetInnerHTML={{ __html: layout.footerHtml }} />
      </div>
    </div>
  );
}

function renderPreviewHtmlPage(html: string) {
  return (
    <div
      className="box-border rounded-[2px] border border-stone-300 bg-white shadow-[0_18px_40px_-32px_rgba(15,23,42,0.25)]"
      style={{
        width: `${LETTER_PAGE_WIDTH}px`,
        minHeight: `${LETTER_PAGE_HEIGHT}px`,
        overflow: 'visible',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function splitPreviewPages(html: string) {
  if (typeof document === 'undefined') return [html];
  const template = document.createElement('template');
  template.innerHTML = html;
  const pages = Array.from(template.content.querySelectorAll('[data-letter-page="true"]'))
    .map((node) => (node as HTMLElement).outerHTML)
    .filter(Boolean);
  return pages.length ? pages : [html];
}

function hasMeaningfulRichText(value: string) {
  const normalized = value.trim();
  if (!normalized) return false;
  return /<(table|thead|tbody|tfoot|tr|td|th|ul|ol|li|blockquote|span|strong|b|em|i|u|font)\b/i.test(normalized)
    || /style\s*=|class\s*=|align\s*=|data-[a-z-]+\s*=|<img\b/i.test(normalized);
}

export default function LetterComposeEditor({
  body,
  className,
  context,
  onChange,
  onRecipientChange,
  placeholder,
  recipient,
  recipientOptions,
  selectedRecipientKey,
  signature,
  subject,
}: LetterComposeEditorProps) {
  const normalizedBody = normalizeLetterBodyText(body);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const editorInitializedRef = useRef(false);
  const editorFocusedRef = useRef(false);
  const internalBodyRef = useRef(normalizedBody);
  const [draftBody, setDraftBody] = useState(normalizedBody);
  const [draftHtml, setDraftHtml] = useState(textToHtml(normalizedBody));
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontSize, setFontSize] = useState('14');

  const previewBody = useMemo(() => normalizeLetterBodyText(draftBody), [draftBody]);
  const previewBodyHtml = useMemo(() => draftHtml || textToHtml(previewBody || placeholder || ''), [draftHtml, placeholder, previewBody]);
  const previewUsesRichHtmlPagination = useMemo(() => hasMeaningfulRichText(previewBodyHtml), [previewBodyHtml]);
  const renderedRichPreviewHtml = useMemo(
    () =>
      buildLetterTemplatePreviewHtml({
        body: previewBodyHtml,
        bodyIsHtml: true,
        context,
        emptyBodyPlaceholder: placeholder,
        includePageFrame: true,
        recipient,
        signature,
        subject,
      }),
    [context, placeholder, previewBodyHtml, recipient, signature, subject]
  );
  const renderedPagedPreviewHtml = useMemo(
    () =>
      buildLetterHtml({
        body: previewUsesRichHtmlPagination ? previewBodyHtml : previewBody,
        bodyIsHtml: previewUsesRichHtmlPagination,
        context,
        emptyBodyPlaceholder: placeholder,
        includePageFrame: true,
        recipient,
        signature,
        subject,
      }),
    [context, placeholder, previewBody, previewBodyHtml, previewUsesRichHtmlPagination, recipient, signature, subject]
  );
  const renderedPreviewHtml = useMemo(() => {
    const pagedPages = splitPreviewPages(renderedPagedPreviewHtml);
    return pagedPages.length > 1 ? renderedPagedPreviewHtml : renderedRichPreviewHtml;
  }, [renderedPagedPreviewHtml, renderedRichPreviewHtml]);
  const renderedPreviewPages = useMemo(() => splitPreviewPages(renderedPreviewHtml), [renderedPreviewHtml]);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorInitializedRef.current && normalizedBody === internalBodyRef.current) return;

    const nextHtml = textToHtml(normalizedBody);
    internalBodyRef.current = normalizedBody;
    editorInitializedRef.current = true;
    setDraftBody(normalizedBody);
    setDraftHtml(nextHtml);
    if (!editorFocusedRef.current) {
      editorRef.current.innerHTML = nextHtml;
    }
  }, [normalizedBody]);

  function syncFromEditor() {
    const nextHtml = cleanEditorHtml(editorRef.current?.innerHTML || '');
    const nextText = htmlToText(nextHtml);
    internalBodyRef.current = nextText;
    setDraftHtml(nextHtml);
    setDraftBody(nextText);
    onChange(nextText);
  }

  function runCommand(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncFromEditor();
  }

  function insertTable() {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    const rows = Array.from({ length: 3 })
      .map(
        () =>
          `<tr>${Array.from({ length: 3 })
            .map(
              () =>
                '<td style="border:1px solid #000000;padding:6px 8px;min-width:80px;">&nbsp;</td>'
            )
            .join('')}</tr>`
      )
      .join('');

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      document.execCommand(
        'insertHTML',
        false,
        `<table style="border-collapse:collapse;width:100%;table-layout:fixed;margin:8px 0;color:inherit;"><tbody>${rows}</tbody></table><div><br /></div>`
      );
      syncFromEditor();
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    range.deleteContents();

    const table = document.createElement('table');
    table.setAttribute(
      'style',
      'border-collapse:collapse;width:100%;table-layout:fixed;margin:8px 0;color:inherit;'
    );
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
      const tr = document.createElement('tr');
      for (let colIndex = 0; colIndex < 3; colIndex += 1) {
        const td = document.createElement('td');
        td.setAttribute('style', 'border:1px solid #000000;padding:6px 8px;min-width:80px;');
        td.innerHTML = '&nbsp;';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    const afterTableParagraph = document.createElement('div');
    afterTableParagraph.innerHTML = '<br />';

    const fragment = document.createDocumentFragment();
    fragment.appendChild(table);
    fragment.appendChild(afterTableParagraph);
    range.insertNode(fragment);

    const nextRange = document.createRange();
    nextRange.selectNodeContents(afterTableParagraph);
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);

    syncFromEditor();
  }

  function getActiveTableCell() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return null;
    const node = selection.anchorNode;
    const element = node?.nodeType === Node.ELEMENT_NODE ? (node as Element) : node?.parentElement;
    const cell = element?.closest('td,th') as HTMLTableCellElement | null;
    return cell && editorRef.current.contains(cell) ? cell : null;
  }

  function editTable(action: 'add-row' | 'add-column' | 'delete-row' | 'delete-column' | 'delete-table') {
    const cell = getActiveTableCell();
    const row = cell?.parentElement as HTMLTableRowElement | null;
    const table = cell?.closest('table') as HTMLTableElement | null;
    if (!cell || !row || !table) return;

    if (action === 'delete-table') {
      table.remove();
    } else if (action === 'add-row') {
      const newRow = row.cloneNode(true) as HTMLTableRowElement;
      newRow.querySelectorAll('td,th').forEach((entry) => {
        entry.innerHTML = '&nbsp;';
      });
      row.after(newRow);
    } else if (action === 'delete-row') {
      if (table.rows.length > 1) row.remove();
    } else {
      const cellIndex = cell.cellIndex;
      Array.from(table.rows).forEach((entry) => {
        if (action === 'add-column') {
          const newCell = entry.insertCell(cellIndex + 1);
          newCell.innerHTML = '&nbsp;';
          newCell.setAttribute('style', 'border:1px solid #000000;padding:6px 8px;min-width:80px;');
        } else if (entry.cells.length > 1) {
          entry.deleteCell(cellIndex);
        }
      });
    }
    syncFromEditor();
  }

  function wrapSelectionWithStyle(style: Partial<CSSStyleDeclaration>) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return;
    const span = document.createElement('span');
    Object.assign(span.style, style);
    if (range.collapsed) {
      span.appendChild(document.createTextNode('\u200b'));
      range.insertNode(span);
      range.setStart(span.firstChild || span, 1);
      range.collapse(true);
    } else {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      range.selectNodeContents(span);
    }
    selection.removeAllRanges();
    selection.addRange(range);
    syncFromEditor();
  }

  return (
    <div className={`${className ?? ''} rounded-[18px] border border-stone-200 bg-[#f5f1ea] p-5`}>
      <div className="mb-5">
        {recipientOptions && recipientOptions.length > 1 && onRecipientChange ? (
          <label className="mb-3 block max-w-[340px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">
              Empfängeradresse
            </p>
            <select
              className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => onRecipientChange(event.target.value)}
              value={selectedRecipientKey}
            >
              {recipientOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            {recipientOptions.find((option) => option.key === selectedRecipientKey)?.description ? (
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {recipientOptions.find((option) => option.key === selectedRecipientKey)?.description}
              </p>
            ) : null}
          </label>
        ) : null}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <select
            className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700"
            value={fontFamily}
            onChange={(event) => {
              const nextValue = event.target.value;
              setFontFamily(nextValue);
              wrapSelectionWithStyle({ fontFamily: nextValue });
            }}
          >
            {FONT_FAMILIES.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <select
            className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700"
            value={fontSize}
            onChange={(event) => {
              const nextValue = event.target.value;
              setFontSize(nextValue);
              wrapSelectionWithStyle({ fontSize: `${nextValue}px` });
            }}
          >
            {FONT_SIZES.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold" type="button" onClick={() => runCommand('bold')}>B</button>
          <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs italic" type="button" onClick={() => runCommand('italic')}>I</button>
          <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs underline" type="button" onClick={() => runCommand('underline')}>U</button>
          <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs" type="button" onClick={() => runCommand('justifyLeft')}>L</button>
          <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs" type="button" onClick={() => runCommand('justifyCenter')}>C</button>
          <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs" type="button" onClick={() => runCommand('justifyRight')}>R</button>
          <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs" type="button" onClick={() => runCommand('justifyFull')}>J</button>
          <label className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700">
            A
            <input className="h-5 w-6 border-0 bg-transparent p-0" onChange={(event) => wrapSelectionWithStyle({ color: event.target.value })} title="Textfarbe" type="color" />
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700">
            Marker
            <input className="h-5 w-6 border-0 bg-transparent p-0" defaultValue="#fff2a8" onChange={(event) => wrapSelectionWithStyle({ backgroundColor: event.target.value })} title="Text markieren" type="color" />
          </label>
          <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs" type="button" onClick={insertTable}>Tabelle</button>
          <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs" type="button" onClick={() => editTable('add-row')}>Z+</button>
          <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs" type="button" onClick={() => editTable('add-column')}>S+</button>
          <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs" type="button" onClick={() => editTable('delete-row')}>Z-</button>
          <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs" type="button" onClick={() => editTable('delete-column')}>S-</button>
          <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs" type="button" onClick={() => editTable('delete-table')}>Tab-</button>
        </div>
        <div
          ref={editorRef}
          className="min-h-[180px] max-h-[260px] w-full overflow-y-auto rounded-[18px] border border-stone-200 bg-white px-5 py-4 text-[15px] leading-7 text-stone-800 outline-none transition focus:border-stone-400"
          contentEditable
          data-placeholder={placeholder || 'Nachricht'}
          onBlur={() => {
            editorFocusedRef.current = false;
          }}
          onFocus={() => {
            editorFocusedRef.current = true;
          }}
          onInput={syncFromEditor}
          role="textbox"
          suppressContentEditableWarning
        />
      </div>

      <div className="mx-auto overflow-auto" style={{ width: `${LETTER_PAGE_WIDTH}px` }}>
        <div className="flex flex-col gap-8">
          {renderedPreviewPages.map((pageHtml, index) => (
            <div key={index}>{renderPreviewHtmlPage(pageHtml)}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
