'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Underline } from '@tiptap/extension-underline';
import { FontFamily } from '@tiptap/extension-font-family';
import {
  buildLetterBodyPageFragments,
  buildLetterComposeLayout,
  buildLetterEditorPageTemplates,
  buildCompanyLine,
  buildSignatureAddress,
  cleanSignatureText,
  formatCommercialRegisterDisplay,
  formatRegisterCourtDisplay,
  formatTaxNumberDisplay,
  formatVatIdDisplay,
  type LetterBodyPageFragment,
  type SignatureRecord,
} from '../../lib/signatures';

const LETTER_PAGE_WIDTH = 794;
const LETTER_PAGE_HEIGHT = 1123;
const FONT_FAMILIES = ['Arial', 'Georgia', 'Times New Roman', 'Verdana'];
const FONT_SIZES = ['10', '11', '12', '13', '14', '15', '16', '18'];

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size:${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize }).run(),
    };
  },
});

const LETTER_EDITOR_EXTENSIONS = [
  StarterKit.configure({ heading: false }),
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ['paragraph'] }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  Underline,
  FontFamily,
  FontSize,
];

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
    salutation?: string;
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
  const normalized = value.replace(/\r\n?/g, '\n').trimEnd();
  if (!normalized) return '<p></p>';
  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function htmlToText(value: string) {
  if (typeof document === 'undefined') {
    return value.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trimEnd();
  }

  const container = document.createElement('div');
  container.innerHTML = value;
  return (container.textContent || '').replace(/\u00a0/g, ' ').trimEnd();
}

function renderEditorSurfaceStyles() {
  return `
    .letter-compose-editor .ProseMirror {
      min-height: 320px;
      outline: none;
      color: #1f2937;
      font-family: Arial, sans-serif;
      font-size: 14px;
      line-height: 1.65;
      white-space: normal;
      overflow-wrap: break-word;
    }
    .letter-compose-editor .ProseMirror p {
      margin: 0 0 1em 0;
    }
    .letter-compose-editor .ProseMirror table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin: 8px 0 16px;
    }
    .letter-compose-editor .ProseMirror td,
    .letter-compose-editor .ProseMirror th {
      border: 1px solid #111827;
      padding: 6px 8px;
      vertical-align: top;
    }
  `;
}

function inlineStyleStringToObject(value: string) {
  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, entry) => {
      const [property, ...rest] = entry.split(':');
      if (!property || rest.length === 0) return acc;
      const camelKey = property
        .trim()
        .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
      acc[camelKey] = rest.join(':').trim();
      return acc;
    }, {});
}

function buildStaticLetterPageHtml({
  closingHtml,
  fragment,
  hideHeader,
  inlineClosing,
  templateHtml,
}: {
  closingHtml: string;
  fragment: LetterBodyPageFragment;
  hideHeader: boolean;
  inlineClosing?: boolean;
  templateHtml: string;
}) {
  if (typeof document === 'undefined') return '';

  const template = document.createElement('template');
  template.innerHTML = templateHtml;

  const page = template.content.firstElementChild as HTMLElement | null;
  if (!page) return '';

  const headerSection = page.querySelector('[data-letter-section="header"]') as HTMLElement | null;
  const flowHost = page.querySelector('[data-letter-flow-host="true"]') as HTMLElement | null;
  const closingHost = page.querySelector('[data-letter-closing-host="true"]') as HTMLElement | null;

  if (!flowHost || !closingHost) return '';

  if (hideHeader && headerSection) {
    headerSection.remove();
  }

  flowHost.innerHTML = fragment.bodyHtml || '';
  if (inlineClosing && fragment.includeClosing && closingHtml) {
    flowHost.innerHTML += closingHtml;
    closingHost.innerHTML = '';
  } else {
    closingHost.innerHTML = fragment.includeClosing ? closingHtml : '';
  }
  return page.outerHTML;
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
  const internalBodyRef = useRef(normalizedBody);
  const [draftHtml, setDraftHtml] = useState(textToHtml(normalizedBody));
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontSize, setFontSize] = useState('14');
  const sheetViewportRef = useRef<HTMLDivElement | null>(null);
  const [sheetViewportWidth, setSheetViewportWidth] = useState(0);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: LETTER_EDITOR_EXTENSIONS,
    content: cleanSignatureText(draftHtml) || '<p></p>',
    editorProps: {
      attributes: {
        class: 'outline-none',
        spellcheck: 'false',
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      const nextHtml = cleanSignatureText(nextEditor.getHTML()) || '<p></p>';
      const nextText = htmlToText(nextHtml);
      internalBodyRef.current = nextText;
      setDraftHtml(nextHtml);
      onChange(nextText);
    },
  });

  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      fontFamily: (currentEditor?.getAttributes('textStyle').fontFamily as string | undefined) || '',
      fontSize: (currentEditor?.getAttributes('textStyle').fontSize as string | undefined) || '',
      isBold: currentEditor?.isActive('bold') || false,
      isItalic: currentEditor?.isActive('italic') || false,
      isUnderline: currentEditor?.isActive('underline') || false,
      isLeft: currentEditor?.isActive({ textAlign: 'left' }) || false,
      isCenter: currentEditor?.isActive({ textAlign: 'center' }) || false,
      isRight: currentEditor?.isActive({ textAlign: 'right' }) || false,
      isJustify: currentEditor?.isActive({ textAlign: 'justify' }) || false,
    }),
  });

  useEffect(() => {
    if (!editor) return;
    const currentEditorText = htmlToText(editor.getHTML());
    if (normalizedBody === currentEditorText && normalizedBody === internalBodyRef.current) return;

    const nextHtml = textToHtml(normalizedBody);
    internalBodyRef.current = normalizedBody;
    setDraftHtml(nextHtml);
    editor.commands.setContent(nextHtml || '<p></p>', { emitUpdate: false });
  }, [editor, normalizedBody]);

  useEffect(() => {
    const nextFontFamily = editorState?.fontFamily || 'Arial';
    const nextFontSize = (editorState?.fontSize || '14px').replace('px', '');
    setFontFamily(nextFontFamily);
    setFontSize(nextFontSize);
  }, [editorState?.fontFamily, editorState?.fontSize]);

  useEffect(() => {
    const node = sheetViewportRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    const updateWidth = () => setSheetViewportWidth(node.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const recipientLines = useMemo(() => {
    return [recipient?.company, recipient?.name, recipient?.address]
      .map((entry) => cleanSignatureText(entry))
      .filter(Boolean);
  }, [recipient?.address, recipient?.company, recipient?.name]);

  const senderLine = useMemo(
    () => cleanSignatureText(signature.letterSenderLine),
    [signature.letterSenderLine]
  );

  const addressBlock = useMemo(() => buildSignatureAddress(signature), [signature]);
  const companyLine = useMemo(
    () => buildCompanyLine(signature.companyName, signature.legalForm),
    [signature.companyName, signature.legalForm]
  );
  const footerLines = useMemo(
    () =>
      [
        addressBlock,
        signature.registeredOffice ? `Sitz: ${signature.registeredOffice}` : '',
        formatRegisterCourtDisplay(signature.registerCourt),
        formatCommercialRegisterDisplay(signature.commercialRegisterNumber),
        signature.managingDirector ? `Geschäftsführung: ${signature.managingDirector}` : '',
        signature.mobilePhone ? `Mobilfunk: ${signature.mobilePhone}` : '',
        signature.phone ? `Telefon: ${signature.phone}` : '',
        signature.email,
        signature.website,
        formatTaxNumberDisplay(signature.taxNumber),
        formatVatIdDisplay(signature.vatId),
      ].filter(Boolean),
    [
      addressBlock,
      signature.commercialRegisterNumber,
      signature.email,
      signature.managingDirector,
      signature.mobilePhone,
      signature.phone,
      signature.registerCourt,
      signature.registeredOffice,
      signature.taxNumber,
      signature.vatId,
      signature.website,
    ]
  );

  const pagePaddingStyle = useMemo(
    () => ({
      paddingBottom: `${signature.letterMarginBottom || 64}px`,
      paddingLeft: `${signature.letterMarginLeft || 56}px`,
      paddingRight: `${signature.letterMarginRight || 56}px`,
      paddingTop: `${signature.letterMarginTop || 48}px`,
    }),
    [
      signature.letterMarginBottom,
      signature.letterMarginLeft,
      signature.letterMarginRight,
      signature.letterMarginTop,
    ]
  );
  const pagePadding = useMemo(
    () =>
      `${signature.letterMarginTop || 48}px ${signature.letterMarginRight || 56}px ${
        signature.letterMarginBottom || 64
      }px ${signature.letterMarginLeft || 56}px`,
    [
      signature.letterMarginBottom,
      signature.letterMarginLeft,
      signature.letterMarginRight,
      signature.letterMarginTop,
    ]
  );

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('de-DE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date()),
    []
  );

  const cityDate = [cleanSignatureText(signature.city), todayLabel].filter(Boolean).join(', ');
  const sheetScale = useMemo(() => {
    if (!sheetViewportWidth) return 1;
    return Math.min(1, sheetViewportWidth / LETTER_PAGE_WIDTH);
  }, [sheetViewportWidth]);
  const composeLayout = useMemo(
    () =>
      buildLetterComposeLayout({
        body: '',
        context,
        placeholder,
        recipient,
        signature,
        subject,
      } as never),
    [context, placeholder, recipient, signature, subject]
  );
  const editorPageTemplates = useMemo(
    () =>
      cleanSignatureText(signature.letterTemplateHtml)
        ? buildLetterEditorPageTemplates({
            context,
            customTemplate: cleanSignatureText(signature.letterTemplateHtml),
            emptyBodyPlaceholder: placeholder,
            pagePadding,
            recipient,
            signature,
            subject,
          })
        : null,
    [context, pagePadding, placeholder, recipient, signature, subject]
  );
  const hasBodyContent = normalizedBody.trim().length > 0;
  const bodyPageFragments = useMemo(
    () =>
      cleanSignatureText(signature.letterTemplateHtml)
        ? buildLetterBodyPageFragments({
            body: normalizedBody,
            bodyHtml: draftHtml,
            bodyIsHtml: true,
            context,
            customTemplate: cleanSignatureText(signature.letterTemplateHtml),
            emptyBodyPlaceholder: placeholder,
            pagePadding,
            recipient,
            signature,
            startOnFirstPage: true,
            subject,
          })
        : null,
    [
      context,
      draftHtml,
      normalizedBody,
      pagePadding,
      placeholder,
      recipient,
      signature,
      subject,
    ]
  );
  const continuationPages = useMemo(() => {
    if (!editorPageTemplates || !bodyPageFragments || bodyPageFragments.length <= 1 || !hasBodyContent) {
      return [];
    }

    return bodyPageFragments
      .slice(1)
      .map((fragment) =>
        buildStaticLetterPageHtml({
          closingHtml: editorPageTemplates.closingHtml,
          fragment,
          hideHeader: true,
          inlineClosing: true,
          templateHtml: editorPageTemplates.continuationPageHtml,
        })
      )
      .filter(Boolean);
  }, [bodyPageFragments, editorPageTemplates, hasBodyContent]);
  const showClosingOnFirstPage = continuationPages.length === 0;

  function insertTable() {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).createParagraphNear().run();
  }

  function editTable(action: 'add-row' | 'add-column' | 'delete-row' | 'delete-column' | 'delete-table') {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (action === 'add-row') chain.addRowAfter().run();
    if (action === 'add-column') chain.addColumnAfter().run();
    if (action === 'delete-row') chain.deleteRow().run();
    if (action === 'delete-column') chain.deleteColumn().run();
    if (action === 'delete-table') chain.deleteTable().run();
  }

  function wrapSelectionWithStyle(style: Partial<CSSStyleDeclaration>) {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (style.color) chain.setColor(style.color).run();
    if (style.backgroundColor) chain.setHighlight({ color: style.backgroundColor }).run();
    if (style.fontFamily) chain.setFontFamily(style.fontFamily).run();
    if (style.fontSize) chain.setFontSize(style.fontSize).run();
  }

  return (
    <div className={`${className ?? ''} rounded-[18px] border border-stone-200 bg-[#f5f1ea] p-5`}>
      <div className="mb-4">
        {recipientOptions && recipientOptions.length > 1 && onRecipientChange ? (
          <label className="mb-3 block max-w-[340px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">
              Empfängeradresse
            </p>
            <select
              className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-1.5 text-sm leading-5 text-slate-900 outline-none transition focus:border-amber-700/60"
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

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700"
            onChange={(event) => {
              const nextValue = event.target.value;
              setFontFamily(nextValue);
              wrapSelectionWithStyle({ fontFamily: nextValue });
            }}
            value={fontFamily}
          >
            {FONT_FAMILIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700"
            onChange={(event) => {
              const nextValue = event.target.value;
              setFontSize(nextValue);
              wrapSelectionWithStyle({ fontSize: `${nextValue}px` });
            }}
            value={fontSize}
          >
            {FONT_SIZES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button className={`rounded-full border px-3 py-1.5 text-xs font-bold ${editorState?.isBold ? 'border-amber-700 bg-amber-100 text-amber-900' : 'border-stone-300 bg-white text-stone-700'}`} onClick={() => editor?.chain().focus().toggleBold().run()} type="button">B</button>
          <button className={`rounded-full border px-3 py-1.5 text-xs italic ${editorState?.isItalic ? 'border-amber-700 bg-amber-100 text-amber-900' : 'border-stone-300 bg-white text-stone-700'}`} onClick={() => editor?.chain().focus().toggleItalic().run()} type="button">I</button>
          <button className={`rounded-full border px-3 py-1.5 text-xs underline ${editorState?.isUnderline ? 'border-amber-700 bg-amber-100 text-amber-900' : 'border-stone-300 bg-white text-stone-700'}`} onClick={() => editor?.chain().focus().toggleUnderline().run()} type="button">U</button>
          <button className={`rounded-full border px-3 py-1.5 text-xs ${editorState?.isLeft ? 'border-amber-700 bg-amber-100 text-amber-900' : 'border-stone-300 bg-white text-stone-700'}`} onClick={() => editor?.chain().focus().setTextAlign('left').run()} type="button">L</button>
          <button className={`rounded-full border px-3 py-1.5 text-xs ${editorState?.isCenter ? 'border-amber-700 bg-amber-100 text-amber-900' : 'border-stone-300 bg-white text-stone-700'}`} onClick={() => editor?.chain().focus().setTextAlign('center').run()} type="button">C</button>
          <button className={`rounded-full border px-3 py-1.5 text-xs ${editorState?.isRight ? 'border-amber-700 bg-amber-100 text-amber-900' : 'border-stone-300 bg-white text-stone-700'}`} onClick={() => editor?.chain().focus().setTextAlign('right').run()} type="button">R</button>
          <button className={`rounded-full border px-3 py-1.5 text-xs ${editorState?.isJustify ? 'border-amber-700 bg-amber-100 text-amber-900' : 'border-stone-300 bg-white text-stone-700'}`} onClick={() => editor?.chain().focus().setTextAlign('justify').run()} type="button">J</button>
          <label className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700">
            A
            <input className="h-5 w-6 border-0 bg-transparent p-0" onChange={(event) => wrapSelectionWithStyle({ color: event.target.value })} title="Textfarbe" type="color" />
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700">
            Marker
            <input className="h-5 w-6 border-0 bg-transparent p-0" defaultValue="#fff2a8" onChange={(event) => wrapSelectionWithStyle({ backgroundColor: event.target.value })} title="Text markieren" type="color" />
          </label>
          <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs" onClick={insertTable} type="button">Tabelle</button>
          <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs" onClick={() => editTable('add-row')} type="button">Z+</button>
          <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs" onClick={() => editTable('add-column')} type="button">S+</button>
          <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs" onClick={() => editTable('delete-row')} type="button">Z-</button>
          <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs" onClick={() => editTable('delete-column')} type="button">S-</button>
          <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs" onClick={() => editTable('delete-table')} type="button">Tab-</button>
        </div>

      </div>

      <div className="mx-auto max-w-full" ref={sheetViewportRef}>
        <div
          className="mx-auto flex max-w-full items-start justify-center overflow-hidden"
        >
          <div
            style={{
              transform: `scale(${sheetScale})`,
              transformOrigin: 'top center',
            }}
          >
            {composeLayout ? (
              <div className="space-y-8">
                <div
                  className="relative mx-auto box-border rounded-[2px] border border-stone-300 bg-white shadow-[0_18px_40px_-32px_rgba(15,23,42,0.25)]"
                  style={{
                    width: `${LETTER_PAGE_WIDTH}px`,
                    height: `${LETTER_PAGE_HEIGHT}px`,
                    ...pagePaddingStyle,
                    overflow: 'hidden',
                  }}
                >
                  <div dangerouslySetInnerHTML={{ __html: composeLayout.headerSectionHtml }} />
                  <div
                    className={composeLayout.bodySectionClassName || undefined}
                    data-letter-section="body"
                    style={{
                      height: `${composeLayout.bodyHeight}px`,
                      minHeight: `${composeLayout.bodyHeight}px`,
                      maxHeight: `${composeLayout.bodyHeight}px`,
                      overflow: 'hidden',
                      ...inlineStyleStringToObject(composeLayout.bodySectionStyle),
                    }}
                  >
                    {composeLayout.bodyInnerBeforeHtml ? (
                      <div dangerouslySetInnerHTML={{ __html: composeLayout.bodyInnerBeforeHtml }} />
                    ) : null}
                    <style>{renderEditorSurfaceStyles()}</style>
                    <div
                      className={`letter-compose-editor ${composeLayout.bodyContainerClassName || ''}`.trim()}
                      data-letter-body="true"
                      style={{
                        width: '100%',
                        minHeight: `${composeLayout.bodyHeight}px`,
                        maxHeight: `${composeLayout.bodyHeight}px`,
                        overflow: 'auto',
                        boxSizing: 'border-box',
                        ...inlineStyleStringToObject(composeLayout.bodyContainerStyle),
                      }}
                    >
                      <EditorContent editor={editor} />
                    </div>
                    {showClosingOnFirstPage && composeLayout.bodyInnerAfterHtml ? (
                      <div dangerouslySetInnerHTML={{ __html: composeLayout.bodyInnerAfterHtml }} />
                    ) : null}
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: composeLayout.footerSectionHtml }} />
                </div>
                {continuationPages.map((pageHtml, index) => (
                  <div
                    className="relative mx-auto box-border rounded-[2px] border border-stone-300 bg-white shadow-[0_18px_40px_-32px_rgba(15,23,42,0.25)]"
                    dangerouslySetInnerHTML={{ __html: pageHtml }}
                    key={`continuation-page-${index}`}
                    style={{
                      width: `${LETTER_PAGE_WIDTH}px`,
                    }}
                  />
                ))}
              </div>
            ) : (
              <div
                className="mx-auto box-border rounded-[2px] border border-stone-300 bg-white shadow-[0_18px_40px_-32px_rgba(15,23,42,0.25)]"
                style={{
                  width: `${LETTER_PAGE_WIDTH}px`,
                  minHeight: `${LETTER_PAGE_HEIGHT}px`,
                  ...pagePaddingStyle,
                }}
              >
                <div className="flex min-h-full flex-col text-[12pt] leading-[1.6] text-slate-900">
                  <div className="flex items-start justify-between gap-8">
                    <div className="min-w-0 flex-1">
                      {signature.logoUrl && signature.letterShowLogo ? (
                        <img
                          alt={signature.logoAlt || signature.companyName || 'Logo'}
                          className="mb-3 max-h-[78px] max-w-[220px] object-contain"
                          src={signature.logoUrl}
                        />
                      ) : null}
                      <div className="text-[8pt] font-bold underline">
                        {senderLine || companyLine}
                      </div>
                    </div>
                    <div
                      className="max-w-[280px] whitespace-pre-line text-right text-[10pt] leading-[1.45] text-slate-700"
                      style={{
                        fontFamily: signature.letterRightBlockFontFamily || signature.fontFamily || 'Segoe UI, Arial, sans-serif',
                        fontSize: signature.letterRightBlockFontSize
                          ? `${String(signature.letterRightBlockFontSize).replace(/px$/i, '')}px`
                          : undefined,
                        fontStyle: signature.letterRightBlockItalic ? 'italic' : 'normal',
                        fontWeight: signature.letterRightBlockBold ? 700 : 500,
                        textAlign: signature.letterRightBlockTextAlign === 'left' ? 'left' : 'right',
                        textDecoration: signature.letterRightBlockUnderline ? 'underline' : 'none',
                      }}
                    >
                      {cleanSignatureText(signature.letterRightBlock)}
                    </div>
                  </div>

                  <div className="mt-8 min-h-[70px] whitespace-pre-line font-[Arial] text-[11pt] leading-[1.45] text-slate-900">
                    {recipientLines.join('\n') || 'Empfänger'}
                  </div>

                  <div className="mt-3 text-right text-[11pt]">{cityDate}</div>

                  <div className="mt-8 font-[Arial] text-[11pt]">
                    <span className="font-bold italic">Betreff:</span>
                    <span className="font-bold italic"> {subject || 'Nachricht von Halbmann Holding'}</span>
                  </div>
                  {context?.propertyName || context?.unitLabel ? (
                    <div className="mt-1 font-[Arial] text-[11pt] italic">
                      Objekt: {[cleanSignatureText(context?.propertyName), cleanSignatureText(context?.unitLabel)]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  ) : null}

                  <style>{renderEditorSurfaceStyles()}</style>
                  <div className="letter-compose-editor mt-6 flex-1">
                    <EditorContent editor={editor} />
                  </div>

                  <div className="mt-8 whitespace-pre-line text-[12pt] leading-[1.6]">
                    {cleanSignatureText(signature.letterClosing || signature.closing || 'Mit freundlichen Grüßen')}
                    {signature.name ? `\n\n${signature.name}` : ''}
                    {companyLine ? `\n${companyLine}` : ''}
                  </div>

                  <div className="mt-10 border-t border-stone-400 pt-4 text-center font-[Arial] text-[8pt] leading-[1.5] text-stone-600">
                    {footerLines.map((line) => (
                      <div key={line} className="whitespace-pre-line">
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

