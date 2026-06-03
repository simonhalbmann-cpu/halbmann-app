
'use client';

import { collection, doc, onSnapshot, query, updateDoc, type DocumentData } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../lib/firebase';
import {
  LETTER_TEMPLATE_TOKENS,
  cleanSignatureText,
  createSignatureRecord,
  type SignatureRecord,
} from '../../lib/signatures';

type AdminRecord = {
  data: DocumentData;
  id: string;
};

type FloatingElementType = 'line' | 'logo';
type DragMode = 'move' | 'resize-left' | 'resize-right' | 'resize-corner';

type EditorInteraction = {
  id: string;
  mode: DragMode;
  startLeft: number;
  startTop: number;
  startWidth: number;
  startX: number;
  startY: number;
} | null;

type MarginSide = 'top' | 'right' | 'bottom' | 'left';

type MarginInteraction = {
  elements: Array<{
    height: number;
    id: string;
    left: number;
    scope: 'header' | 'body' | 'footer';
    top: number;
    type: FloatingElementType;
    width: number;
  }>;
  margins: {
    bottom: number;
    left: number;
    right: number;
    top: number;
  };
  side: MarginSide;
  startValue: number;
  startX: number;
  startY: number;
} | null;

type SeparatorInteraction = {
  key: 'footer' | 'header';
  startBodyHeight: number;
  startFooterHeight: number;
  startHeaderHeight: number;
  startY: number;
} | null;

type AdminLetterSettingsView = 'abschluss' | 'anrede' | 'vorlage';

const FONT_FAMILY_OPTIONS = ['Arial', 'Georgia', 'Times New Roman', 'Verdana'];
const LETTER_PAGE_WIDTH = 794;
const LETTER_PAGE_HEIGHT = 1123;
const MIN_CONTENT_WIDTH = 240;
const MIN_CONTENT_HEIGHT = 320;
const FONT_SIZE_OPTIONS = ['10', '11', '12', '13', '14', '15', '16', '18'] as const;
const SPECIAL_CHARACTER_OPTIONS = [
  { label: 'Sonderzeichen', value: '' },
  { label: '• Punkt mittig', value: '•' },
  { label: '· Kleiner Punkt', value: '·' },
  { label: '– Halbgeviertstrich', value: '–' },
  { label: '§ Paragraph', value: '§' },
] as const;
const HEADER_SECTION_DIVIDER = '<div contenteditable="false" data-letter-fixed-separator="header" style="margin:20px 0 24px 0;border-top:2px solid #cbd5e1;"></div>';
const FOOTER_SECTION_DIVIDER = '<div contenteditable="false" data-letter-fixed-separator="footer" style="margin:24px 0 20px 0;border-top:2px solid #cbd5e1;"></div>';
const DEFAULT_HEADER_SECTION_HEIGHT = 150;
const DEFAULT_BODY_SECTION_HEIGHT = 520;
const DEFAULT_FOOTER_SECTION_HEIGHT = 120;

function createElementId() {
  return `letter-${Math.random().toString(36).slice(2, 10)}`;
}

function parseNumericStyle(value: string | null | undefined) {
  const numeric = Number.parseFloat(value || '');
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeFontFamilyValue(value: string) {
  const first = cleanSignatureText(value).split(',')[0] || 'Arial';
  return first.replace(/^['"]|['"]$/g, '');
}

function mapPxToFontSizeValue(value: string) {
  const numeric = parseNumericStyle(value);
  if (!numeric) return '12';
  return FONT_SIZE_OPTIONS.reduce((closest, option) =>
    Math.abs(Number(option) - numeric) < Math.abs(Number(closest) - numeric) ? option : closest
  );
}

function pxToCm(value: number) {
  return (value / 37.7952755906).toFixed(1);
}

function normalizeLogoFileName(value: string) {
  const fileName = cleanSignatureText(value);
  if (!fileName) return '';
  if (
    fileName.includes('Ã') ||
    fileName.includes('{') ||
    fileName.includes('}') ||
    fileName.includes('/') ||
    fileName.includes('\\') ||
    fileName.startsWith('http') ||
    !/\.(png|jpe?g|svg|webp|gif|bmp)$/i.test(fileName)
  ) {
    return '';
  }
  return fileName;
}

function buildFloatingElementHtml(type: FloatingElementType, id = createElementId(), top = 32, left = 32) {
  if (type === 'logo') {
    return `<div data-letter-element="logo" data-letter-element-id="${id}" style="position:absolute;left:${left}px;top:${top}px;width:200px;min-height:60px;">{{LOGO}} </div>`;
  }

  return `<div data-letter-element="line" data-letter-element-id="${id}" style="position:absolute;left:${left}px;top:${top}px;width:220px;height:14px;"><div data-letter-line="true" style="position:absolute;left:0;right:0;top:50%;border-top:2px solid #000000;transform:translateY(-50%);"></div></div>`;
}

function buildStructuredLetterTemplate(content: string) {
  const headerSeparatorIndex = content.indexOf(HEADER_SECTION_DIVIDER);
  const footerSeparatorIndex = content.indexOf(FOOTER_SECTION_DIVIDER);

  const headerContent =
    headerSeparatorIndex >= 0 ? content.slice(0, headerSeparatorIndex) : '';
  const bodyContent =
    headerSeparatorIndex >= 0 && footerSeparatorIndex >= 0
      ? content.slice(headerSeparatorIndex + HEADER_SECTION_DIVIDER.length, footerSeparatorIndex)
      : headerSeparatorIndex >= 0
        ? content.slice(headerSeparatorIndex + HEADER_SECTION_DIVIDER.length)
        : content;
  const footerContent =
    footerSeparatorIndex >= 0 ? content.slice(footerSeparatorIndex + FOOTER_SECTION_DIVIDER.length) : '';

  return [
    `<div data-letter-section="header" style="min-height:${DEFAULT_HEADER_SECTION_HEIGHT}px;">${headerContent}</div>`,
    `<div data-letter-section="body" style="min-height:${DEFAULT_BODY_SECTION_HEIGHT}px;">${bodyContent}</div>`,
    `<div data-letter-section="footer" style="min-height:${DEFAULT_FOOTER_SECTION_HEIGHT}px;">${footerContent}</div>`,
  ].join('');
}

function normalizeTemplateHtml(value: string) {
  const repairedTokens = LETTER_TEMPLATE_TOKENS.reduce((current, token) => {
    const core = token.slice(2, -2).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return current
      .replace(new RegExp(`(?<!\\{)\\{${core}\\}\\}`, 'g'), token)
      .replace(new RegExp(`\\{\\{${core}\\}(?!\\})`, 'g'), token)
      .replace(new RegExp(`(?<!\\{)\\{${core}\\}(?!\\})`, 'g'), token);
  }, cleanSignatureText(value));

  const normalized = repairedTokens
    .replace(/<img[^>]*>/gi, buildFloatingElementHtml('logo'))
    .replace(/<hr[^>]*>/gi, buildFloatingElementHtml('line'))
    .replace(/<div[^>]*data-letter-fixed-separator="header"[^>]*><\/div>/gi, '')
    .replace(/<div[^>]*data-letter-fixed-separator="footer"[^>]*><\/div>/gi, '')
    .replace(/\{\{LOGO_ALT\}\}/gi, '')
    .replace(/\{\{LOGO_URL\}\}/gi, '{{LOGO}}')
    .replace(/\{\{LOGO\}\}\s*\{\{LOGO\}\}/gi, '{{LOGO}} ')
    .replace(/\{\{LOGO\}\}(?!\s|<|$)/g, '{{LOGO}} ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[ \t]{2,}/g, ' ');

  if (
    !normalized.includes('data-letter-section="header"') ||
    !normalized.includes('data-letter-section="body"') ||
    !normalized.includes('data-letter-section="footer"')
  ) {
    const structured = buildStructuredLetterTemplate(normalized);
    if (!structured.includes('data-letter-element="logo"') && structured.includes('{{LOGO}}')) {
      return structured.replace('{{LOGO}}', buildFloatingElementHtml('logo'));
    }
    return structured;
  }

  if (!normalized.includes('data-letter-element="logo"') && normalized.includes('{{LOGO}}')) {
    const withLogo = normalized.replace('{{LOGO}}', buildFloatingElementHtml('logo'));
    return withLogo;
  }

  return normalized;
}

function buildEditableTemplateHtml(value: string) {
  const normalized = normalizeTemplateHtml(value);
  if (
    normalized.includes('data-letter-section="header"') &&
    normalized.includes('data-letter-section="body"') &&
    normalized.includes('data-letter-section="footer"')
  ) {
    return normalized;
  }

  return normalizeTemplateHtml('');
}

function ToolButton({
  active = false,
  label,
  onClick,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? 'border-amber-700 bg-[#ede4d3] text-stone-900'
          : 'border-stone-300 bg-white text-slate-700 hover:border-stone-400'
      }`}
      onMouseDown={(event) => {
        event.preventDefault();
        onClick();
      }}
      type="button"
    >
      {label}
    </button>
  );
}

function getSelectionAnchorElement(root: HTMLDivElement | null) {
  if (!root || typeof window === 'undefined') return null;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const anchorNode = selection.anchorNode;
  if (!anchorNode || !root.contains(anchorNode)) return null;
  return anchorNode.nodeType === Node.ELEMENT_NODE
    ? (anchorNode as HTMLElement)
    : anchorNode.parentElement;
}

function getSectionHeight(root: HTMLDivElement | null, key: 'header' | 'body' | 'footer') {
  const section = root?.querySelector(`[data-letter-section="${key}"]`) as HTMLElement | null;
  return parseNumericStyle(section?.style.minHeight) || 0;
}

function getActiveEditableSection(root: HTMLDivElement | null) {
  const anchor = getSelectionAnchorElement(root);
  const selectedSection = anchor?.closest('[data-letter-section]') as HTMLElement | null;
  if (selectedSection) return selectedSection;
  return (root?.querySelector('[data-letter-section="body"]') as HTMLElement | null) ||
    (root?.querySelector('[data-letter-section="header"]') as HTMLElement | null) ||
    (root?.querySelector('[data-letter-section="footer"]') as HTMLElement | null);
}

function getSectionKey(section: HTMLElement | null): 'header' | 'body' | 'footer' {
  const key = section?.dataset.letterSection;
  return key === 'header' || key === 'footer' || key === 'body' ? key : 'body';
}

function getSectionTop(root: HTMLDivElement | null, key: 'header' | 'body' | 'footer') {
  if (!root) return 0;
  const headerHeight = getSectionHeight(root, 'header') || DEFAULT_HEADER_SECTION_HEIGHT;
  const bodyHeight = getSectionHeight(root, 'body') || DEFAULT_BODY_SECTION_HEIGHT;
  if (key === 'header') return formIndependentMarginTop(root);
  if (key === 'body') return formIndependentMarginTop(root) + headerHeight;
  return formIndependentMarginTop(root) + headerHeight + bodyHeight;
}

function formIndependentMarginTop(root: HTMLDivElement | null) {
  const top = parseNumericStyle(root?.style.paddingTop);
  return top || 0;
}

export default function AdminLetterSettings({
  view = 'vorlage',
}: {
  view?: AdminLetterSettingsView;
}) {
  const { user } = useAuth();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const greetingRef = useRef<HTMLDivElement | null>(null);
  const closingBlockRef = useRef<HTMLDivElement | null>(null);
  const editorHtmlRef = useRef('');
  const isEditorFocusedRef = useRef(false);
  const activeRichTextRef = useRef<'closing' | 'greeting' | 'template'>('template');
  const savedFormattingRangeRef = useRef<Range | null>(null);
  const interactionRef = useRef<EditorInteraction>(null);
  const marginInteractionRef = useRef<MarginInteraction>(null);
  const separatorInteractionRef = useRef<SeparatorInteraction>(null);
  const [companies, setCompanies] = useState<AdminRecord[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [form, setForm] = useState<SignatureRecord>(createSignatureRecord());
  const [editorHtml, setEditorHtml] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [copyTemplateFromCompanyId, setCopyTemplateFromCompanyId] = useState('');
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontSize, setFontSize] = useState('12');
  const [logoFileName, setLogoFileName] = useState('');
  const [selectedElementId, setSelectedElementId] = useState('');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right' | 'justify'>('left');
  const [specialCharacter, setSpecialCharacter] = useState('');
  const [activeMargin, setActiveMargin] = useState<MarginSide | ''>('');
  const [sectionHeights, setSectionHeights] = useState({
    body: DEFAULT_BODY_SECTION_HEIGHT,
    footer: DEFAULT_FOOTER_SECTION_HEIGHT,
    header: DEFAULT_HEADER_SECTION_HEIGHT,
  });
  const isClosingView = view === 'abschluss';
  const isGreetingView = view === 'anrede';
  const isTemplateView = view === 'vorlage';

  const displayLogoFileName = normalizeLogoFileName(logoFileName);

  const selectedCompany = useMemo(
    () => companies.find((entry) => entry.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  function syncToolbarState() {
    const root = getActiveFormattingRoot();
    const anchor = getSelectionAnchorElement(root);
    if (!root || !anchor) return;
    if (root === editorRef.current && (anchor === root || anchor.closest('[data-letter-element]'))) return;

    const computedStyle = window.getComputedStyle(anchor);
    const nextFontFamily = normalizeFontFamilyValue(computedStyle.fontFamily);
    const nextFontSize = mapPxToFontSizeValue(computedStyle.fontSize);
    const nextBold = document.queryCommandState('bold') || Number.parseInt(computedStyle.fontWeight, 10) >= 600;
    const nextItalic = document.queryCommandState('italic') || computedStyle.fontStyle === 'italic';
    const nextUnderline =
      document.queryCommandState('underline') || computedStyle.textDecorationLine.includes('underline');

    let blockElement: HTMLElement = anchor;
    while (blockElement.parentElement && blockElement.parentElement !== root) {
      blockElement = blockElement.parentElement;
    }
    const nextAlign = document.queryCommandState('justifyFull')
      ? 'justify'
      : document.queryCommandState('justifyCenter')
        ? 'center'
        : document.queryCommandState('justifyRight')
          ? 'right'
          : document.queryCommandState('justifyLeft')
            ? 'left'
            : ((window.getComputedStyle(blockElement).textAlign || 'left') === 'justify'
                ? 'justify'
                : (window.getComputedStyle(blockElement).textAlign || 'left') === 'center'
                  ? 'center'
                  : (window.getComputedStyle(blockElement).textAlign || 'left') === 'right'
                    ? 'right'
                    : 'left');

    setFontFamily(FONT_FAMILY_OPTIONS.includes(nextFontFamily) ? nextFontFamily : 'Arial');
    setFontSize(nextFontSize);
    setIsBold(nextBold);
    setIsItalic(nextItalic);
    setIsUnderline(nextUnderline);
    setTextAlign(nextAlign);
  }

  function getFloatingElementSection(element: HTMLElement) {
    return element.parentElement?.closest('[data-letter-section]') as HTMLElement | null;
  }

  function getFloatingElementBounds(
    element: HTMLElement,
    scope: 'body' | 'footer' | 'header',
    elementWidth: number,
    elementHeight: number
  ) {
    const root = editorRef.current;
    const section = getFloatingElementSection(element);
    const contentWidth = LETTER_PAGE_WIDTH - form.letterMarginLeft - form.letterMarginRight;
    if (section && root?.contains(section)) {
      const sectionHeight = getSectionHeight(root, scope) || (
        scope === 'header' ? DEFAULT_HEADER_SECTION_HEIGHT : scope === 'footer' ? DEFAULT_FOOTER_SECTION_HEIGHT : DEFAULT_BODY_SECTION_HEIGHT
      );
      return {
        maxLeft: Math.max(0, contentWidth - elementWidth),
        maxTop: Math.max(0, sectionHeight - elementHeight),
        minLeft: 0,
        minTop: 0,
      };
    }

    const sectionTop = getSectionTop(root, scope);
    const sectionHeight = getSectionHeight(root, scope) || (
      scope === 'header' ? DEFAULT_HEADER_SECTION_HEIGHT : scope === 'footer' ? DEFAULT_FOOTER_SECTION_HEIGHT : DEFAULT_BODY_SECTION_HEIGHT
    );
    return {
      maxLeft: Math.max(form.letterMarginLeft, LETTER_PAGE_WIDTH - form.letterMarginRight - elementWidth),
      maxTop: Math.max(sectionTop, sectionTop + sectionHeight - elementHeight),
      minLeft: form.letterMarginLeft,
      minTop: sectionTop,
    };
  }

  function rememberFormattingSelection() {
    if (typeof window === 'undefined') return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const root = getActiveFormattingRoot();
    if (!root || !root.contains(range.commonAncestorContainer)) return;
    savedFormattingRangeRef.current = range.cloneRange();
  }

  function restoreFormattingSelection() {
    if (typeof window === 'undefined') return false;
    const range = savedFormattingRangeRef.current;
    const root = getActiveFormattingRoot();
    if (!range || !root || !root.contains(range.commonAncestorContainer)) return false;
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  function buildEditorElement(type: FloatingElementType, id?: string) {
    const wrapper = document.createElement('div');
    wrapper.dataset.letterElement = type;
    wrapper.dataset.letterElementId = id || createElementId();
    wrapper.dataset.letterSectionScope = 'header';
    wrapper.contentEditable = 'false';
    wrapper.style.position = 'absolute';
    wrapper.style.left = '32px';
    wrapper.style.top = `${type === 'logo' ? 32 : 116}px`;
    wrapper.style.userSelect = 'none';
    wrapper.style.cursor = 'move';
    wrapper.style.zIndex = '3';

    if (type === 'logo') {
      wrapper.style.width = '200px';
      wrapper.style.minHeight = '60px';
      const body = document.createElement('div');
      body.dataset.letterElementBody = 'logo';
      body.textContent = '{{LOGO}}';
      wrapper.appendChild(body);
    } else {
      wrapper.style.width = '220px';
      wrapper.style.height = '14px';
      const body = document.createElement('div');
      body.dataset.letterLine = 'true';
      wrapper.appendChild(body);
    }

    return wrapper;
  }

  function decorateFloatingElement(element: HTMLElement) {
    const type = (element.dataset.letterElement as FloatingElementType) || 'line';
    const scope = ((element.dataset.letterSectionScope as 'header' | 'body' | 'footer' | undefined) || 'header');
    const isSelected = element.dataset.letterElementId === selectedElementId;
    const bottomValue = parseNumericStyle(element.style.bottom);
    const elementHeight = type === 'logo' ? Math.max(element.offsetHeight || 60, 60) : 14;
    const sectionTop = getSectionTop(editorRef.current, scope);
    const sectionHeight = getSectionHeight(editorRef.current, scope) || (
      scope === 'header' ? DEFAULT_HEADER_SECTION_HEIGHT : scope === 'footer' ? DEFAULT_FOOTER_SECTION_HEIGHT : DEFAULT_BODY_SECTION_HEIGHT
    );
    if (bottomValue && !parseNumericStyle(element.style.top)) {
      element.style.top = `${Math.max(0, LETTER_PAGE_HEIGHT - bottomValue - elementHeight)}px`;
      element.style.bottom = '';
    }

    element.contentEditable = 'false';
    element.style.position = 'absolute';
    element.style.left = `${parseNumericStyle(element.style.left) || 32}px`;
    element.style.top = `${parseNumericStyle(element.style.top) || 32}px`;
    element.style.width = `${Math.max(parseNumericStyle(element.style.width) || (type === 'logo' ? 200 : 220), 80)}px`;
    const boundedWidth = parseNumericStyle(element.style.width);
    const { maxLeft, maxTop, minLeft, minTop } = getFloatingElementBounds(element, scope, boundedWidth, elementHeight);
    element.style.left = `${Math.min(maxLeft, Math.max(minLeft, parseNumericStyle(element.style.left)))}px`;
    element.style.top = `${Math.min(maxTop, Math.max(minTop, parseNumericStyle(element.style.top)))}px`;
    element.style.userSelect = 'none';
    element.style.cursor = 'move';
    element.style.zIndex = '3';
    element.style.outline = isSelected ? '1px dashed #a16207' : '1px dashed transparent';
    element.style.background = type === 'logo' ? 'rgba(255,255,255,0.9)' : 'transparent';
    element.style.borderRadius = type === 'logo' ? '12px' : '0';
    element.style.padding = type === 'logo' ? '10px 12px' : '0';

    if (type === 'logo') {
      element.style.minHeight = '40px';
      const body =
        (element.querySelector('[data-letter-element-body="logo"]') as HTMLElement | null) ||
        document.createElement('div');
      body.dataset.letterElementBody = 'logo';
      body.style.display = 'block';
      body.style.width = '100%';
      body.style.minHeight = '40px';
      body.style.border = isSelected ? '1px dashed rgba(148, 163, 184, 0.8)' : '1px dashed transparent';
      body.style.borderRadius = '10px';
      body.style.background = 'rgba(248, 250, 252, 0.35)';
      body.style.overflow = 'hidden';
      body.style.lineHeight = '0';

      const existingImage = body.querySelector('img');
      const logoUrl = cleanSignatureText(form.logoUrl);
      if (logoUrl) {
        const image = existingImage || document.createElement('img');
        image.setAttribute('src', logoUrl);
        image.setAttribute('alt', cleanSignatureText(form.logoAlt) || 'Logo');
        image.style.display = 'block';
        image.style.width = '100%';
        image.style.height = 'auto';
        image.style.objectFit = 'contain';
        image.style.pointerEvents = 'none';
        if (!existingImage) {
          body.replaceChildren(image);
        }
      } else {
        body.replaceChildren(document.createTextNode('{{LOGO}}'));
        body.style.color = '#475569';
        body.style.fontSize = '13px';
        body.style.fontWeight = '600';
        body.style.letterSpacing = '0.08em';
        body.style.textTransform = 'uppercase';
        body.style.lineHeight = '40px';
        body.style.textAlign = 'center';
      }

      if (!body.parentElement) {
        element.appendChild(body);
      }
    } else {
      element.style.height = '14px';
      const line =
        (element.querySelector('[data-letter-line="true"]') as HTMLElement | null) ||
        document.createElement('div');
      line.dataset.letterLine = 'true';
      line.style.position = 'absolute';
      line.style.left = '0';
      line.style.right = '0';
      line.style.top = '50%';
      line.style.borderTop = '2px solid #000000';
      line.style.transform = 'translateY(-50%)';
      if (!line.parentElement) {
        element.appendChild(line);
      }
    }

    if (type === 'logo') {
      let handle = element.querySelector('[data-editor-handle="corner"]') as HTMLSpanElement | null;
      if (!handle) {
        handle = document.createElement('span');
        handle.dataset.editorHandle = 'corner';
        element.appendChild(handle);
      }
      handle.style.position = 'absolute';
      handle.style.right = '-8px';
      handle.style.bottom = '-8px';
      handle.style.width = '14px';
      handle.style.height = '14px';
      handle.style.borderRadius = '999px';
      handle.style.background = isSelected ? '#a16207' : 'rgba(148, 163, 184, 0.85)';
      handle.style.border = '2px solid white';
      handle.style.boxShadow = '0 1px 6px rgba(15, 23, 42, 0.18)';
      handle.style.cursor = 'nwse-resize';
      handle.style.display = isSelected ? 'block' : 'none';
      element.querySelectorAll('[data-editor-handle="left"],[data-editor-handle="right"]').forEach((node) => {
        (node as HTMLElement).style.display = 'none';
      });
      return;
    }

    ['left', 'right'].forEach((side) => {
      let handle = element.querySelector(`[data-editor-handle="${side}"]`) as HTMLSpanElement | null;
      if (!handle) {
        handle = document.createElement('span');
        handle.dataset.editorHandle = side;
        element.appendChild(handle);
      }
      handle.style.position = 'absolute';
      handle.style.top = '50%';
      if (side === 'left') {
        handle.style.left = '-7px';
      } else {
        handle.style.right = '-7px';
      }
      handle.style.transform = 'translateY(-50%)';
      handle.style.width = '12px';
      handle.style.height = '12px';
      handle.style.borderRadius = '999px';
      handle.style.background = isSelected ? '#a16207' : 'rgba(148, 163, 184, 0.85)';
      handle.style.border = '2px solid white';
      handle.style.boxShadow = '0 1px 6px rgba(15, 23, 42, 0.18)';
      handle.style.cursor = 'ew-resize';
      handle.style.display = isSelected ? 'block' : 'none';
    });
    element.querySelectorAll('[data-editor-handle="corner"]').forEach((node) => {
      (node as HTMLElement).style.display = 'none';
    });
  }

  function applyFloatingDecorations() {
    const root = editorRef.current;
    if (!root) return;
    root.style.position = 'relative';
    root.style.overflow = 'hidden';
    root.querySelectorAll('[data-letter-element]').forEach((node) => {
      decorateFloatingElement(node as HTMLElement);
    });
    root.querySelectorAll('[data-letter-section]').forEach((node) => {
      const section = node as HTMLElement;
      const key = section.dataset.letterSection;
      section.contentEditable = 'true';
      section.style.display = 'block';
      section.style.minHeight = `${parseNumericStyle(section.style.minHeight) || (
        key === 'header'
          ? DEFAULT_HEADER_SECTION_HEIGHT
          : key === 'footer'
            ? DEFAULT_FOOTER_SECTION_HEIGHT
            : DEFAULT_BODY_SECTION_HEIGHT
      )}px`;
      section.style.outline = 'none';
      section.style.position = 'relative';
      section.style.padding = key === 'body' ? '10px 0' : '4px 0';
      section.style.cursor = 'text';
      section.style.zIndex = '1';
      if (!section.innerHTML.trim()) {
        section.innerHTML = '<br />';
      }
    });
  }

  function serializeEditorHtml() {
    const root = editorRef.current;
    if (!root) return editorHtmlRef.current;
    const clone = root.cloneNode(true) as HTMLDivElement;

    clone.querySelectorAll('[data-editor-handle]').forEach((node) => node.remove());
    clone.querySelectorAll('[data-letter-element]').forEach((node) => {
      const element = node as HTMLElement;
      const type = (element.dataset.letterElement as FloatingElementType) || 'line';
      const scope = ((element.dataset.letterSectionScope as 'header' | 'body' | 'footer' | undefined) || 'header');
      const elementSection = getFloatingElementSection(element);
      const leftValue = parseNumericStyle(element.style.left);
      const topValue = parseNumericStyle(element.style.top);
      const elementHeight = type === 'logo' ? Math.max(element.offsetHeight || 60, 60) : 14;

      element.removeAttribute('contenteditable');
      element.style.outline = 'none';
      element.style.background = 'transparent';
      element.style.cursor = 'default';
      element.style.zIndex = '1';
      element.style.borderRadius = '0';
      element.style.padding = '0';

      element.style.bottom = '';

      if (type === 'logo') {
        const body =
          (element.querySelector('[data-letter-element-body="logo"]') as HTMLElement | null) ||
          document.createElement('div');
        body.dataset.letterElementBody = 'logo';
        body.textContent = '{{LOGO}}';
        body.style.display = 'block';
        body.style.width = '100%';
        body.style.minHeight = '40px';
        body.style.border = 'none';
        body.style.background = 'transparent';
        body.style.textTransform = 'none';
        body.style.letterSpacing = '0';
        body.style.fontWeight = '400';
        body.style.fontSize = '14px';
        if (!body.parentElement) {
          element.appendChild(body);
        }
      } else {
        const line =
          (element.querySelector('[data-letter-line="true"]') as HTMLElement | null) ||
          document.createElement('div');
        line.dataset.letterLine = 'true';
        line.style.position = 'absolute';
        line.style.left = '0';
        line.style.right = '0';
        line.style.top = '50%';
        line.style.borderTop = '2px solid #000000';
        line.style.transform = 'translateY(-50%)';
        if (!line.parentElement) {
          element.appendChild(line);
        }
      }

      const section = clone.querySelector(`[data-letter-section="${scope}"]`) as HTMLElement | null;
      if (section && element.parentElement !== section) {
        const sectionTop = getSectionTop(root, scope);
        element.style.top = `${Math.max(0, topValue - sectionTop)}px`;
        element.style.left = `${Math.max(0, leftValue - form.letterMarginLeft)}px`;
        section.appendChild(element);
      } else if (elementSection) {
        element.style.left = `${Math.max(0, leftValue)}px`;
        element.style.top = `${Math.max(0, topValue)}px`;
      }
    });

    return normalizeTemplateHtml(clone.innerHTML);
  }

  function syncEditorHtml() {
    editorHtmlRef.current = serializeEditorHtml();
  }

  function getActiveFormattingRoot() {
    if (typeof window !== 'undefined') {
      const selection = window.getSelection();
      const anchorNode = selection?.anchorNode;
      if (anchorNode) {
        if (greetingRef.current?.contains(anchorNode)) return greetingRef.current;
        if (closingBlockRef.current?.contains(anchorNode)) return closingBlockRef.current;
        if (editorRef.current?.contains(anchorNode)) return editorRef.current;
      }
    }

    if (activeRichTextRef.current === 'greeting') return greetingRef.current;
    if (activeRichTextRef.current === 'closing') return closingBlockRef.current;
    return editorRef.current;
  }

  function getActiveFormattingElement() {
    const root = getActiveFormattingRoot();
    if (!root) return null;
    if (root === editorRef.current) return getActiveEditableSection(root);
    return root;
  }

  function syncRichTextField() {
    const activeRoot = getActiveFormattingRoot();
    if (activeRoot === greetingRef.current || activeRoot === closingBlockRef.current) return;
    syncEditorHtml();
  }

  function getFormWithRichTextFields(nextForm = form) {
    return {
      ...nextForm,
      letterClosingBlock: closingBlockRef.current?.innerHTML.trim() || nextForm.letterClosingBlock,
      letterGreeting: greetingRef.current?.innerHTML.trim() || nextForm.letterGreeting,
    };
  }

  function commitRichTextFields() {
    setForm((current) => getFormWithRichTextFields(current));
  }

  function runEditorCommand(command: string, value?: string) {
    if (typeof document === 'undefined') return;
    const activeRoot = getActiveFormattingRoot();
    const restoredSelection = restoreFormattingSelection();
    if (!restoredSelection) getActiveFormattingElement()?.focus();
    document.execCommand(command, false, value);
    if (command === 'justifyLeft') setTextAlign('left');
    if (command === 'justifyCenter') setTextAlign('center');
    if (command === 'justifyRight') setTextAlign('right');
    if (command === 'justifyFull') setTextAlign('justify');
    if (activeRoot === editorRef.current) applyFloatingDecorations();
    syncRichTextField();
    rememberFormattingSelection();
    syncToolbarState();
  }

  function wrapSelectionWithStyle(style: Partial<CSSStyleDeclaration>) {
    if (typeof window === 'undefined') return;
    restoreFormattingSelection();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const root = getActiveFormattingRoot();
    const range = selection.getRangeAt(0);
    if (!root || !root.contains(range.commonAncestorContainer)) return;

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
    if (root === editorRef.current) applyFloatingDecorations();
    syncRichTextField();
    rememberFormattingSelection();
    syncToolbarState();
  }

  function applyTextColor(value: string) {
    wrapSelectionWithStyle({ color: value });
  }

  function applyHighlightColor(value: string) {
    wrapSelectionWithStyle({ backgroundColor: value });
  }

  function insertTable() {
    if (typeof document === 'undefined') return;
    getActiveEditableSection(editorRef.current)?.focus();
    const cells = Array.from({ length: 3 })
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
    document.execCommand(
      'insertHTML',
      false,
      `<table style="border-collapse:collapse;width:100%;margin:8px 0;color:inherit;"><tbody>${cells}</tbody></table>`
    );
    syncEditorHtml();
    syncToolbarState();
  }

  function getActiveTableCell() {
    if (typeof window === 'undefined') return null;
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

    syncEditorHtml();
    syncToolbarState();
  }

  function insertSpecialCharacter(value: string) {
    if (!value || typeof document === 'undefined') return;
    const restoredSelection = restoreFormattingSelection();
    if (!restoredSelection) getActiveFormattingElement()?.focus();
    document.execCommand('insertText', false, value);
    setSpecialCharacter('');
    syncRichTextField();
    rememberFormattingSelection();
    syncToolbarState();
  }

  function insertTemplateToken(token: string) {
    if (typeof document === 'undefined') return;
    const restoredSelection = restoreFormattingSelection();
    if (!restoredSelection) getActiveFormattingElement()?.focus();
    document.execCommand('insertText', false, token);
    syncRichTextField();
    rememberFormattingSelection();
    syncToolbarState();
  }

  function insertFloatingElement(type: FloatingElementType) {
    const root = editorRef.current;
    if (!root) return;
    const activeSection = getActiveEditableSection(root);
    const sectionKey = getSectionKey(activeSection);
    const element = buildEditorElement(type);
    element.dataset.letterSectionScope = sectionKey;
    const sectionHeight = getSectionHeight(root, sectionKey) || (
      sectionKey === 'header' ? DEFAULT_HEADER_SECTION_HEIGHT : sectionKey === 'footer' ? DEFAULT_FOOTER_SECTION_HEIGHT : DEFAULT_BODY_SECTION_HEIGHT
    );
    const contentWidth = LETTER_PAGE_WIDTH - form.letterMarginLeft - form.letterMarginRight;
    let desiredTop = 18;
    if (typeof window !== 'undefined') {
      const selection = window.getSelection();
      const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      if (range && activeSection?.contains(range.commonAncestorContainer)) {
        const rect = range.getBoundingClientRect();
        const sectionRect = activeSection.getBoundingClientRect();
        if (rect.height || rect.top || rect.bottom) {
          desiredTop = rect.bottom - sectionRect.top;
        }
      }
    }
    if (type === 'logo') {
      const width = parseNumericStyle(element.style.width) || 200;
      element.style.top = `${Math.max(0, Math.min(sectionHeight - 60, desiredTop))}px`;
      element.style.left = `${Math.max(0, contentWidth - width)}px`;
    } else {
      element.style.top = `${Math.max(0, Math.min(sectionHeight - 14, desiredTop))}px`;
      element.style.left = '0px';
      element.style.width = `${Math.max(120, contentWidth)}px`;
    }
    (activeSection || root).appendChild(element);
    setSelectedElementId(element.dataset.letterElementId || '');
    applyFloatingDecorations();
    syncEditorHtml();
  }

  function removeSelectedElement() {
    const root = editorRef.current;
    if (!root || !selectedElementId) return;
    root.querySelector(`[data-letter-element-id="${selectedElementId}"]`)?.remove();
    setSelectedElementId('');
    syncEditorHtml();
  }

  function applyFontFamily(value: string) {
    setFontFamily(value);
    wrapSelectionWithStyle({ fontFamily: value });
  }

  function applyFontSize(value: string) {
    setFontSize(value);
    wrapSelectionWithStyle({ fontSize: `${value}px` });
  }

  function adoptTemplateFromCompany(sourceCompanyId: string) {
    setCopyTemplateFromCompanyId(sourceCompanyId);
    if (!sourceCompanyId) return;
    const sourceCompany = companies.find((entry) => entry.id === sourceCompanyId) ?? null;
    const sourceTemplate = normalizeTemplateHtml(sourceCompany?.data.signatureLetterTemplateHtml);
    if (!sourceTemplate) {
      setError('Für diese Firma ist noch keine Briefvorlage gespeichert.');
      return;
    }

    setMessage('');
    setError('');
    editorHtmlRef.current = sourceTemplate;
    setEditorHtml(sourceTemplate);
  }

  async function persistLetter(templateHtml: string, nextForm: SignatureRecord) {
    if (!selectedCompanyId) return;
    await updateDoc(doc(db, 'companies', selectedCompanyId), {
      signatureLogoFileName: displayLogoFileName,
      signatureLetterTemplateHtml: normalizeTemplateHtml(templateHtml),
      signatureLetterClosing: cleanSignatureText(nextForm.letterClosing),
      signatureLetterClosingBlock: cleanSignatureText(nextForm.letterClosingBlock),
      signatureLetterGreeting: cleanSignatureText(nextForm.letterGreeting),
      signatureLogoAlt: cleanSignatureText(nextForm.logoAlt),
      signatureLetterMarginBottom: nextForm.letterMarginBottom,
      signatureLetterMarginLeft: nextForm.letterMarginLeft,
      signatureLetterMarginRight: nextForm.letterMarginRight,
      signatureLetterMarginTop: nextForm.letterMarginTop,
      signatureLogoUrl: cleanSignatureText(nextForm.logoUrl),
      signatureLetterShowLogo: nextForm.letterShowLogo,
      updatedAt: new Date().toISOString(),
    });
  }

  function saveLetter() {
    if (!selectedCompanyId) return;
    setMessage('');
    setError('');

    startTransition(async () => {
      try {
        const nextForm = getFormWithRichTextFields();
        const normalizedHtml = serializeEditorHtml();
        editorHtmlRef.current = normalizedHtml;
        setEditorHtml(normalizedHtml);
        setForm(nextForm);
        await persistLetter(normalizedHtml, nextForm);
        setMessage('Briefvorlage wurde gespeichert.');
      } catch (caughtError) {
        console.error('Fehler beim Speichern der Briefvorlage:', caughtError);
        setError('Die Briefvorlage konnte nicht gespeichert werden.');
      }
    });
  }

  async function handleLogoUpload(file?: File | null) {
    if (!selectedCompanyId || !file) return;
    setMessage('');
    setError('');
    setIsUploading(true);
    setLogoFileName(file.name);

    try {
      const payload = new FormData();
      payload.append('file', file);
      payload.append('companyId', selectedCompanyId);

      const token = await user?.getIdToken();
      const response = await fetch('/api/admin/signature-logo', {
        body: payload,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        method: 'POST',
      });
      const result = (await response.json()) as { error?: string; ok?: boolean; url?: string };
      if (!response.ok || !result.ok || !result.url) {
        throw new Error(result.error || 'logo_upload_failed');
      }

      const nextForm = getFormWithRichTextFields({
        ...form,
        logoAlt: form.logoAlt || form.companyName,
        logoUrl: result.url,
      });
      setForm(nextForm);

      const hasLogoElement = Boolean(editorRef.current?.querySelector('[data-letter-element="logo"]'));
      if (!hasLogoElement) {
        insertFloatingElement('logo');
      } else {
        applyFloatingDecorations();
        syncEditorHtml();
      }

      await persistLetter(serializeEditorHtml(), nextForm);
      setMessage('Logo wurde hochgeladen und gespeichert.');
    } catch (caughtError) {
      console.error('Fehler beim Hochladen des Logos:', caughtError);
      setError('Das Logo konnte nicht hochgeladen oder gespeichert werden.');
      setLogoFileName('');
    } finally {
      setIsUploading(false);
    }
  }

  function handleEditorInput() {
    applyFloatingDecorations();
    syncEditorHtml();
    syncToolbarState();
  }

  function handleEditorKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if ((event.key === 'Backspace' || event.key === 'Delete') && selectedElementId) {
      event.preventDefault();
      removeSelectedElement();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      getActiveEditableSection(editorRef.current)?.focus();
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
      syncEditorHtml();
      syncToolbarState();
      return;
    }

    if (selectedElementId && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const element = editorRef.current?.querySelector(
        `[data-letter-element-id="${selectedElementId}"]`
      ) as HTMLElement | null;
      if (!element) return;
      const step = event.shiftKey ? 10 : 2;
      const left = parseNumericStyle(element.style.left);
      const top = parseNumericStyle(element.style.top);
      if (event.key === 'ArrowLeft') element.style.left = `${Math.max(0, left - step)}px`;
      if (event.key === 'ArrowRight') element.style.left = `${left + step}px`;
      if (event.key === 'ArrowUp') element.style.top = `${Math.max(0, top - step)}px`;
      if (event.key === 'ArrowDown') element.style.top = `${top + step}px`;
      syncEditorHtml();
    }
  }

  function handleEditorMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    const root = editorRef.current;
    if (!root) return;
    const target = event.target as HTMLElement;
    const handle = target.closest('[data-editor-handle]') as HTMLElement | null;
    const floating = target.closest('[data-letter-element]') as HTMLElement | null;

    if (handle && floating) {
      event.preventDefault();
      const id = floating.dataset.letterElementId || '';
      setSelectedElementId(id);
      interactionRef.current = {
        id,
        mode:
          handle.dataset.editorHandle === 'left'
            ? 'resize-left'
            : handle.dataset.editorHandle === 'corner'
              ? 'resize-corner'
              : 'resize-right',
        startLeft: parseNumericStyle(floating.style.left),
        startTop: parseNumericStyle(floating.style.top),
        startWidth: parseNumericStyle(floating.style.width),
        startX: event.clientX,
        startY: event.clientY,
      };
      return;
    }

    if (floating) {
      event.preventDefault();
      const id = floating.dataset.letterElementId || '';
      setSelectedElementId(id);
      interactionRef.current = {
        id,
        mode: 'move',
        startLeft: parseNumericStyle(floating.style.left),
        startTop: parseNumericStyle(floating.style.top),
        startWidth: parseNumericStyle(floating.style.width),
        startX: event.clientX,
        startY: event.clientY,
      };
      return;
    }

    const clickedSection = target.closest('[data-letter-section]') as HTMLElement | null;
    if (clickedSection) {
      setSelectedElementId('');
      return;
    }

    const bodySection = root.querySelector('[data-letter-section="body"]') as HTMLElement | null;
    if (bodySection) {
      setSelectedElementId('');
      bodySection.focus();
    }

    setSelectedElementId('');
  }

  function startSeparatorDrag(key: 'header' | 'footer', event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const root = editorRef.current;
    if (!root) return;
    separatorInteractionRef.current = {
      key,
      startBodyHeight: getSectionHeight(root, 'body') || DEFAULT_BODY_SECTION_HEIGHT,
      startFooterHeight: getSectionHeight(root, 'footer') || DEFAULT_FOOTER_SECTION_HEIGHT,
      startHeaderHeight: getSectionHeight(root, 'header') || DEFAULT_HEADER_SECTION_HEIGHT,
      startY: event.clientY,
    };
    setSelectedElementId('');
  }

  function startMarginDrag(side: MarginSide, event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const root = editorRef.current;
    marginInteractionRef.current = {
      elements: root
        ? Array.from(root.querySelectorAll('[data-letter-element]')).map((node) => {
            const element = node as HTMLElement;
            const type = (element.dataset.letterElement as FloatingElementType) || 'line';
            return {
              height: type === 'logo' ? Math.max(element.offsetHeight || 60, 60) : 14,
              id: element.dataset.letterElementId || '',
              left: parseNumericStyle(element.style.left),
              scope: ((element.dataset.letterSectionScope as 'header' | 'body' | 'footer' | undefined) || 'header'),
              top: parseNumericStyle(element.style.top),
              type,
              width: parseNumericStyle(element.style.width) || (type === 'logo' ? 200 : 220),
            };
          })
        : [],
      margins: {
        bottom: form.letterMarginBottom,
        left: form.letterMarginLeft,
        right: form.letterMarginRight,
        top: form.letterMarginTop,
      },
      side,
      startValue:
        side === 'top'
          ? form.letterMarginTop
          : side === 'right'
            ? form.letterMarginRight
            : side === 'bottom'
              ? form.letterMarginBottom
              : form.letterMarginLeft,
      startX: event.clientX,
      startY: event.clientY,
    };
    setActiveMargin(side);
  }
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'companies')),
      (snapshot) => {
        const nextCompanies = snapshot.docs
          .map((entry) => ({ data: entry.data(), id: entry.id }))
          .sort((left, right) =>
            cleanSignatureText(left.data.name).localeCompare(cleanSignatureText(right.data.name), 'de')
          );
        setCompanies(nextCompanies);
        setSelectedCompanyId((current) =>
          current && nextCompanies.some((entry) => entry.id === current)
            ? current
            : nextCompanies[0]?.id || ''
        );
      },
      (caughtError) => {
        console.error('Fehler beim Laden der Firmen für Briefe:', caughtError);
        setError('Die Firmen konnten nicht geladen werden.');
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedCompany) return;
    const nextForm = createSignatureRecord(selectedCompany.data);
    const nextEditorHtml = buildEditableTemplateHtml(nextForm.letterTemplateHtml);
    setForm(nextForm);
    setCopyTemplateFromCompanyId('');
    setSelectedElementId('');
    editorHtmlRef.current = nextEditorHtml;
    setEditorHtml(nextEditorHtml);
    setSectionHeights({
      body: DEFAULT_BODY_SECTION_HEIGHT,
      footer: DEFAULT_FOOTER_SECTION_HEIGHT,
      header: DEFAULT_HEADER_SECTION_HEIGHT,
    });
    setLogoFileName(normalizeLogoFileName(cleanSignatureText(selectedCompany.data.signatureLogoFileName)));
  }, [selectedCompany]);

  useEffect(() => {
    if (greetingRef.current && greetingRef.current.innerHTML !== form.letterGreeting) {
      greetingRef.current.innerHTML = form.letterGreeting;
    }
    if (closingBlockRef.current && closingBlockRef.current.innerHTML !== form.letterClosingBlock) {
      closingBlockRef.current.innerHTML = form.letterClosingBlock;
    }
  }, [form.letterClosingBlock, form.letterGreeting, selectedCompanyId, view]);

  useEffect(() => {
    const root = editorRef.current;
    if (!root || isEditorFocusedRef.current) return;
    const nextEditorHtml = buildEditableTemplateHtml(editorHtml);
    root.innerHTML = nextEditorHtml;
    applyFloatingDecorations();
    editorHtmlRef.current = serializeEditorHtml();
    if (editorHtml !== nextEditorHtml) {
      setEditorHtml(nextEditorHtml);
    }
    setSectionHeights({
      body: getSectionHeight(root, 'body') || DEFAULT_BODY_SECTION_HEIGHT,
      footer: getSectionHeight(root, 'footer') || DEFAULT_FOOTER_SECTION_HEIGHT,
      header: getSectionHeight(root, 'header') || DEFAULT_HEADER_SECTION_HEIGHT,
    });
  }, [editorHtml]);

  useEffect(() => {
    applyFloatingDecorations();
  }, [selectedElementId]);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (typeof window !== 'undefined') {
        const selection = window.getSelection();
        const anchorNode = selection?.anchorNode;
        if (anchorNode) {
          if (greetingRef.current?.contains(anchorNode)) {
            activeRichTextRef.current = 'greeting';
          } else if (closingBlockRef.current?.contains(anchorNode)) {
            activeRichTextRef.current = 'closing';
          } else if (editorRef.current?.contains(anchorNode)) {
            activeRichTextRef.current = 'template';
          }
        }
      }
      rememberFormattingSelection();
      syncToolbarState();
    };

    const handleMouseMove = (event: MouseEvent) => {
      const separatorInteraction = separatorInteractionRef.current;
      if (separatorInteraction) {
        const root = editorRef.current;
        if (!root) return;
        const headerSection = root.querySelector('[data-letter-section="header"]') as HTMLElement | null;
        const bodySection = root.querySelector('[data-letter-section="body"]') as HTMLElement | null;
        const footerSection = root.querySelector('[data-letter-section="footer"]') as HTMLElement | null;
        if (!headerSection || !bodySection || !footerSection) return;
        const deltaY = event.clientY - separatorInteraction.startY;
        const minHeaderHeight = 80;
        const minBodyHeight = 140;
        const minFooterHeight = 70;
        const maxHeaderHeight = 420;
        const maxFooterHeight = 260;
        const totalContentHeight = Math.max(
          minHeaderHeight + minBodyHeight + minFooterHeight,
          LETTER_PAGE_HEIGHT - form.letterMarginTop - form.letterMarginBottom
        );

        if (separatorInteraction.key === 'header') {
          const unclampedHeaderHeight = separatorInteraction.startHeaderHeight + deltaY;
          const nextHeaderHeight = Math.max(
            minHeaderHeight,
            Math.min(
              maxHeaderHeight,
              Math.min(unclampedHeaderHeight, totalContentHeight - separatorInteraction.startFooterHeight - minBodyHeight)
            )
          );
          const nextBodyHeight = Math.max(
            minBodyHeight,
            totalContentHeight - nextHeaderHeight - separatorInteraction.startFooterHeight
          );
          headerSection.style.minHeight = `${nextHeaderHeight}px`;
          bodySection.style.minHeight = `${nextBodyHeight}px`;
          setSectionHeights({
            body: nextBodyHeight,
            footer: separatorInteraction.startFooterHeight,
            header: nextHeaderHeight,
          });
        } else {
          const unclampedFooterHeight = separatorInteraction.startFooterHeight - deltaY;
          const nextFooterHeight = Math.max(
            minFooterHeight,
            Math.min(
              maxFooterHeight,
              Math.min(unclampedFooterHeight, totalContentHeight - separatorInteraction.startHeaderHeight - minBodyHeight)
            )
          );
          const nextBodyHeight = Math.max(
            minBodyHeight,
            totalContentHeight - separatorInteraction.startHeaderHeight - nextFooterHeight
          );
          footerSection.style.minHeight = `${nextFooterHeight}px`;
          bodySection.style.minHeight = `${nextBodyHeight}px`;
          setSectionHeights({
            body: nextBodyHeight,
            footer: nextFooterHeight,
            header: separatorInteraction.startHeaderHeight,
          });
        }
        syncEditorHtml();
        return;
      }

      const marginInteraction = marginInteractionRef.current;
      if (marginInteraction) {
        const deltaX = event.clientX - marginInteraction.startX;
        const deltaY = event.clientY - marginInteraction.startY;
        setForm((current) => {
          const next = { ...current };
          const previous = marginInteraction.margins;
          if (marginInteraction.side === 'left') {
            next.letterMarginLeft = Math.min(
              LETTER_PAGE_WIDTH - previous.right - MIN_CONTENT_WIDTH,
              Math.max(0, marginInteraction.startValue + deltaX)
            );
          } else if (marginInteraction.side === 'right') {
            next.letterMarginRight = Math.min(
              LETTER_PAGE_WIDTH - previous.left - MIN_CONTENT_WIDTH,
              Math.max(0, marginInteraction.startValue - deltaX)
            );
          } else if (marginInteraction.side === 'top') {
            next.letterMarginTop = Math.min(
              LETTER_PAGE_HEIGHT - previous.bottom - MIN_CONTENT_HEIGHT,
              Math.max(0, marginInteraction.startValue + deltaY)
            );
          } else {
            next.letterMarginBottom = Math.min(
              LETTER_PAGE_HEIGHT - previous.top - MIN_CONTENT_HEIGHT,
              Math.max(0, marginInteraction.startValue - deltaY)
            );
          }

          const root = editorRef.current;
          if (root) {
            const previousContentWidth = LETTER_PAGE_WIDTH - previous.left - previous.right;
            const nextContentWidth = LETTER_PAGE_WIDTH - next.letterMarginLeft - next.letterMarginRight;
            marginInteraction.elements.forEach((snapshot) => {
              const element = root.querySelector(
                `[data-letter-element-id="${snapshot.id}"]`
              ) as HTMLElement | null;
              if (!element) return;

              let leftOffset = snapshot.left - previous.left;
              let topOffset = snapshot.top - previous.top;
              let nextWidth = snapshot.width;
              let nextLeft = next.letterMarginLeft + leftOffset;
              let nextTop = next.letterMarginTop + topOffset;

              const previousRightGap =
                LETTER_PAGE_WIDTH - previous.right - snapshot.left - snapshot.width;
              const previousBottomGap =
                LETTER_PAGE_HEIGHT - previous.bottom - snapshot.top - snapshot.height;
              const anchoredRight = previousRightGap <= 8;
              const anchoredBottom = previousBottomGap <= 8;
              const spansPreviousContent =
                snapshot.type === 'line' &&
                Math.abs(snapshot.left - previous.left) <= 8 &&
                Math.abs(snapshot.width - previousContentWidth) <= 8;

              if (spansPreviousContent) {
                nextLeft = next.letterMarginLeft;
                nextWidth = Math.max(120, nextContentWidth);
              } else if (anchoredRight || marginInteraction.side === 'right') {
                nextLeft = LETTER_PAGE_WIDTH - next.letterMarginRight - snapshot.width - Math.max(0, previousRightGap);
              }

              if (anchoredBottom || marginInteraction.side === 'bottom') {
                nextTop = LETTER_PAGE_HEIGHT - next.letterMarginBottom - snapshot.height - Math.max(0, previousBottomGap);
              }

              if (snapshot.type === 'line' && !spansPreviousContent) {
                const maxAllowedWidth = LETTER_PAGE_WIDTH - next.letterMarginRight - nextLeft;
                nextWidth = Math.max(80, Math.min(snapshot.width, maxAllowedWidth));
              }

              const minLeft = next.letterMarginLeft;
              const maxLeft = Math.max(minLeft, LETTER_PAGE_WIDTH - next.letterMarginRight - nextWidth);
              const nextHeaderHeight = getSectionHeight(root, 'header') || DEFAULT_HEADER_SECTION_HEIGHT;
              const nextBodyHeight = getSectionHeight(root, 'body') || DEFAULT_BODY_SECTION_HEIGHT;
              const sectionTop =
                snapshot.scope === 'header'
                  ? next.letterMarginTop
                  : snapshot.scope === 'body'
                    ? next.letterMarginTop + nextHeaderHeight
                    : next.letterMarginTop + nextHeaderHeight + nextBodyHeight;
              const sectionHeight =
                snapshot.scope === 'header'
                  ? nextHeaderHeight
                  : snapshot.scope === 'body'
                    ? nextBodyHeight
                    : getSectionHeight(root, 'footer') || DEFAULT_FOOTER_SECTION_HEIGHT;
              const minTop = sectionTop;
              const maxTop = Math.max(minTop, sectionTop + sectionHeight - snapshot.height);
              const boundedLeft = Math.min(maxLeft, Math.max(minLeft, nextLeft));
              const boundedTop = Math.min(maxTop, Math.max(minTop, nextTop));

              element.style.width = `${nextWidth}px`;
              element.style.left = `${boundedLeft}px`;
              element.style.top = `${boundedTop}px`;
            });
          }

          return next;
        });
        return;
      }

      const interaction = interactionRef.current;
      const root = editorRef.current;
      if (!interaction || !root) return;
      const element = root.querySelector(
        `[data-letter-element-id="${interaction.id}"]`
      ) as HTMLElement | null;
      if (!element) return;

      const deltaX = event.clientX - interaction.startX;
      const deltaY = event.clientY - interaction.startY;
      const type = (element.dataset.letterElement as FloatingElementType) || 'line';
      const scope = ((element.dataset.letterSectionScope as 'header' | 'body' | 'footer' | undefined) || 'header');
      const elementWidth = parseNumericStyle(element.style.width) || element.offsetWidth;
      const elementHeight =
        type === 'logo'
          ? Math.max(element.offsetHeight || 60, Math.round(elementWidth * 0.42))
          : Math.max(element.offsetHeight || 14, 14);
      const { maxLeft, maxTop, minLeft, minTop } = getFloatingElementBounds(element, scope, elementWidth, elementHeight);
      const contentWidth = root.clientWidth - form.letterMarginLeft - form.letterMarginRight;

      if (interaction.mode === 'move') {
        let nextLeft = Math.min(maxLeft, Math.max(minLeft, interaction.startLeft + deltaX));
        const nextTop = Math.min(maxTop, Math.max(minTop, interaction.startTop + deltaY));
        element.style.bottom = '';
        if (type === 'line') {
          const centeredLeft = minLeft + Math.max(0, contentWidth / 2 - elementWidth / 2);
          if (Math.abs(nextLeft - centeredLeft) <= 12) {
            nextLeft = centeredLeft;
          }
        }
        element.style.left = `${nextLeft}px`;
        element.style.top = `${nextTop}px`;
      } else if (interaction.mode === 'resize-corner') {
        element.style.bottom = '';
        const nextWidth = Math.max(80, Math.min(maxLeft + elementWidth - interaction.startLeft, interaction.startWidth + deltaX));
        element.style.width = `${nextWidth}px`;
      } else if (interaction.mode === 'resize-right') {
        element.style.bottom = '';
        const nextWidth = Math.max(80, Math.min(maxLeft + elementWidth - interaction.startLeft, interaction.startWidth + deltaX));
        element.style.width = `${nextWidth}px`;
      } else {
        element.style.bottom = '';
        const nextWidth = Math.max(80, Math.min(contentWidth, interaction.startWidth - deltaX));
        const widthDiff = interaction.startWidth - nextWidth;
        element.style.width = `${nextWidth}px`;
        element.style.left = `${Math.min(maxLeft + elementWidth - nextWidth, Math.max(minLeft, interaction.startLeft + widthDiff))}px`;
      }

      applyFloatingDecorations();
    };

    const handleMouseUp = () => {
      if (separatorInteractionRef.current) {
        separatorInteractionRef.current = null;
        syncEditorHtml();
        return;
      }
      if (marginInteractionRef.current) {
        marginInteractionRef.current = null;
        setActiveMargin('');
        return;
      }
      if (!interactionRef.current) return;
      interactionRef.current = null;
      syncEditorHtml();
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  });

  return (
    <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-[13px] leading-6 text-slate-600">
          Hier bearbeitest du den kompletten Firmenbrief direkt wie in einem einfachen Word-Dokument.
          Wenn du Platzhalter wie `Telefon`, `Bank`, `IBAN` oder `Geschäftsführer` einsetzt, ziehen sie
          sich später automatisch die aktuellen Stammdaten der gewählten Firma.
        </p>
        <label className="min-w-[240px]">
          <span className="sr-only">Firma wählen</span>
          <select
            className="w-full rounded-full border border-stone-300 bg-white px-4 py-2 text-[13px] text-slate-900 outline-none transition focus:border-amber-700/60"
            onChange={(event) => setSelectedCompanyId(event.target.value)}
            value={selectedCompanyId}
          >
            {companies.length === 0 ? <option value="">Keine Firma vorhanden</option> : null}
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {cleanSignatureText(company.data.name) || company.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!selectedCompany ? (
        <div className="mt-5 rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-5 text-[13px] text-slate-600">
          Noch keine Firma vorhanden.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="rounded-[24px] border border-stone-200 bg-stone-50/70 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              {isTemplateView ? 'Firmendaten Einfügen' : isGreetingView ? 'Platzhalter für Anrede' : 'Platzhalter für Abschluss'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {isTemplateView ? (
                <>
                  <ToolButton label="Firma" onClick={() => insertTemplateToken('{{COMPANY_NAME}}')} />
                  <ToolButton label="Firmenzeile" onClick={() => insertTemplateToken('{{COMPANY_LINE}}')} />
                  <ToolButton label="Straße" onClick={() => insertTemplateToken('{{STREET_LINE}}')} />
                  <ToolButton label="Ort / PLZ" onClick={() => insertTemplateToken('{{CITY_LINE}}')} />
                  <ToolButton label="E-Mail" onClick={() => insertTemplateToken('{{EMAIL}}')} />
                  <ToolButton label="Telefon" onClick={() => insertTemplateToken('{{PHONE}}')} />
                  <ToolButton label="Homepage" onClick={() => insertTemplateToken('{{WEBSITE}}')} />
                  <ToolButton label="Bank" onClick={() => insertTemplateToken('{{BANK}}')} />
                  <ToolButton label="IBAN" onClick={() => insertTemplateToken('{{IBAN}}')} />
                  <ToolButton label="BIC / BLZ" onClick={() => insertTemplateToken('{{BIC}}')} />
                  <ToolButton label="Registergericht" onClick={() => insertTemplateToken('{{REGISTER_COURT_LINE}}')} />
                  <ToolButton label="HRB" onClick={() => insertTemplateToken('{{HRB_LINE}}')} />
                  <ToolButton label="Geschäftsführer 1" onClick={() => insertTemplateToken('{{MANAGING_DIRECTOR_1}}')} />
                  <ToolButton label="Geschäftsführer 2" onClick={() => insertTemplateToken('{{MANAGING_DIRECTOR_2}}')} />
                  <ToolButton label="Steuernummer" onClick={() => insertTemplateToken('{{TAX_NUMBER_LINE}}')} />
                  <ToolButton label="USt-IdNr." onClick={() => insertTemplateToken('{{VAT_ID_LINE}}')} />
                  <ToolButton label="Empfänger Firma" onClick={() => insertTemplateToken('{{RECIPIENT_COMPANY}}')} />
                  <ToolButton label="Empfänger Name" onClick={() => insertTemplateToken('{{RECIPIENT_NAME}}')} />
                  <ToolButton label="Empfänger Adresse" onClick={() => insertTemplateToken('{{RECIPIENT_ADDRESS}}')} />
                  <ToolButton label="Empfänger Block" onClick={() => insertTemplateToken('{{RECIPIENT_BLOCK}}')} />
                  <ToolButton label="Betreff" onClick={() => insertTemplateToken('{{SUBJECT}}')} />
                  <ToolButton label="Anrede" onClick={() => insertTemplateToken('{{GREETING}}')} />
                  <ToolButton label="Immobilie" onClick={() => insertTemplateToken('{{PROPERTY_NAME}}')} />
                  <ToolButton label="Einheit" onClick={() => insertTemplateToken('{{UNIT_LABEL}}')} />
                  <ToolButton label="Brieftext" onClick={() => insertTemplateToken('{{BODY_HTML}}')} />
                  <ToolButton label="Abschluss" onClick={() => insertTemplateToken('{{CLOSING_BLOCK}}')} />
                  <ToolButton label="Ort + Datum" onClick={() => insertTemplateToken('{{CITY_DATE}}')} />
                  <ToolButton label="Logo" onClick={() => insertFloatingElement('logo')} />
                  <label className="inline-flex items-center rounded-full border border-stone-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 transition hover:border-stone-400">
                    <span>{isUploading ? 'Logo wird hochgeladen...' : 'Logo auswählen'}</span>
                    <input
                      accept="image/*"
                      className="hidden"
                      disabled={isUploading}
                      onChange={(event) => handleLogoUpload(event.target.files?.[0])}
                      type="file"
                    />
                  </label>
                  <span className="max-w-[220px] truncate self-center text-xs text-slate-500">
                    {displayLogoFileName || 'Kein Logo'}
                  </span>
                </>
              ) : isGreetingView ? (
                <>
                  <ToolButton label="Sehr geehrte(r)" onClick={() => insertTemplateToken('{{FORMAL_SALUTATION}}')} />
                  <ToolButton label="Empfänger Name" onClick={() => insertTemplateToken('{{RECIPIENT_NAME}}')} />
                  <ToolButton label="Empfänger Firma" onClick={() => insertTemplateToken('{{RECIPIENT_COMPANY}}')} />
                  <ToolButton label="Immobilie" onClick={() => insertTemplateToken('{{PROPERTY_NAME}}')} />
                  <ToolButton label="Einheit" onClick={() => insertTemplateToken('{{UNIT_LABEL}}')} />
                </>
              ) : (
                <>
                  <ToolButton label="Abschlussformel" onClick={() => insertTemplateToken('{{LETTER_CLOSING}}')} />
                  <ToolButton label="Unterschrift" onClick={() => insertTemplateToken('{{SIGNATURE_NAME}}')} />
                  <ToolButton label="Firma" onClick={() => insertTemplateToken('{{COMPANY_NAME}}')} />
                  <ToolButton label="Rechtsform" onClick={() => insertTemplateToken('{{LEGAL_FORM}}')} />
                </>
              )}
            </div>
            <p className="mt-3 text-[12px] leading-5 text-slate-500">
              {isTemplateView
                ? 'Diese Platzhalter bleiben dynamisch. Wenn du später Stammdaten wie Telefon, Bank, Geschäftsführer oder Adresse änderst, werden sie beim Brief automatisch aktuell eingesetzt.'
                : isGreetingView
                  ? 'Hier definierst du nur die formatierbare Brief-Anrede. Durch die eigene Unterseite arbeitet die Toolbar nur auf diesem Feld.'
                  : 'Hier definierst du nur den formatierbaren Abschlussblock. Auch dieses Feld ist jetzt komplett getrennt von der Briefvorlage.'}
            </p>
          </div>
          <div className="rounded-[24px] border border-stone-200 bg-stone-50/70 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              Formatierung
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-xs text-slate-700 outline-none transition focus:border-amber-700/60"
                onChange={(event) => applyFontFamily(event.target.value)}
                value={fontFamily}
              >
                {FONT_FAMILY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-xs text-slate-700 outline-none transition focus:border-amber-700/60"
                onChange={(event) => applyFontSize(event.target.value)}
                value={fontSize}
              >
                {FONT_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option} pt
                  </option>
                ))}
              </select>
              <ToolButton active={isBold} label="B" onClick={() => runEditorCommand('bold')} />
              <ToolButton active={isItalic} label="I" onClick={() => runEditorCommand('italic')} />
              <ToolButton active={isUnderline} label="U" onClick={() => runEditorCommand('underline')} />
              <ToolButton active={textAlign === 'left'} label="L" onClick={() => runEditorCommand('justifyLeft')} />
              <ToolButton active={textAlign === 'center'} label="C" onClick={() => runEditorCommand('justifyCenter')} />
              <ToolButton active={textAlign === 'right'} label="R" onClick={() => runEditorCommand('justifyRight')} />
              <ToolButton active={textAlign === 'justify'} label="J" onClick={() => runEditorCommand('justifyFull')} />
              <label className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                A
                <input
                  className="h-5 w-6 border-0 bg-transparent p-0"
                  onChange={(event) => applyTextColor(event.target.value)}
                  title="Textfarbe"
                  type="color"
                />
              </label>
              <label className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                Marker
                <input
                  className="h-5 w-6 border-0 bg-transparent p-0"
                  defaultValue="#fff2a8"
                  onChange={(event) => applyHighlightColor(event.target.value)}
                  title="Text markieren"
                  type="color"
                />
              </label>
              <ToolButton label="Tabelle" onClick={insertTable} />
              <ToolButton label="Z+" onClick={() => editTable('add-row')} />
              <ToolButton label="S+" onClick={() => editTable('add-column')} />
              <ToolButton label="Z-" onClick={() => editTable('delete-row')} />
              <ToolButton label="S-" onClick={() => editTable('delete-column')} />
              <ToolButton label="Tab-" onClick={() => editTable('delete-table')} />
              <ToolButton label="Linie" onClick={() => insertFloatingElement('line')} />
              <select
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-xs text-slate-700 outline-none transition focus:border-amber-700/60"
                onChange={(event) => {
                  setSpecialCharacter(event.target.value);
                  insertSpecialCharacter(event.target.value);
                }}
                value={specialCharacter}
              >
                {SPECIAL_CHARACTER_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isTemplateView ? (
            <>
              <div className="rounded-[24px] border border-stone-200 bg-stone-50/70 p-4">
                <div className="overflow-auto rounded-[18px] border border-stone-200 bg-[#f5f1ea] p-5">
                  <div
                    className="relative mx-auto shadow-[0_18px_40px_-32px_rgba(15,23,42,0.25)]"
                    style={{ height: `${LETTER_PAGE_HEIGHT}px`, width: `${LETTER_PAGE_WIDTH}px` }}
                  >
                {(() => {
                  const contentWidth = LETTER_PAGE_WIDTH - form.letterMarginLeft - form.letterMarginRight;
                  const headerSeparatorTop = form.letterMarginTop + sectionHeights.header;
                  const footerSeparatorTop = form.letterMarginTop + sectionHeights.header + sectionHeights.body;
                  return (
                    <>
                      <button
                        className="absolute z-[18] h-[2px] border-0 bg-slate-300 p-0"
                        onMouseDown={(event) => startSeparatorDrag('header', event)}
                        style={{
                          cursor: 'row-resize',
                          left: `${form.letterMarginLeft}px`,
                          top: `${headerSeparatorTop}px`,
                          width: `${contentWidth}px`,
                        }}
                        type="button"
                      />
                      <button
                        className="absolute z-[18] h-[2px] border-0 bg-slate-300 p-0"
                        onMouseDown={(event) => startSeparatorDrag('footer', event)}
                        style={{
                          cursor: 'row-resize',
                          left: `${form.letterMarginLeft}px`,
                          top: `${footerSeparatorTop}px`,
                          width: `${contentWidth}px`,
                        }}
                        type="button"
                      />
                    </>
                  );
                })()}
                <div
                  className="pointer-events-none absolute inset-0 rounded-[2px] border border-stone-300 bg-white"
                  style={{
                    boxShadow: `inset ${form.letterMarginLeft}px 0 0 0 rgba(217,119,6,0.08),
                    inset -${form.letterMarginRight}px 0 0 0 rgba(217,119,6,0.08),
                    inset 0 ${form.letterMarginTop}px 0 0 rgba(217,119,6,0.08),
                    inset 0 -${form.letterMarginBottom}px 0 0 rgba(217,119,6,0.08)`,
                  }}
                />
                <div
                  className="pointer-events-none absolute left-0 right-0 z-[14]"
                  style={{
                    top: `${form.letterMarginTop}px`,
                    height: '2px',
                    backgroundImage: 'repeating-linear-gradient(to right, #b45309 0 10px, transparent 10px 16px)',
                  }}
                />
                <div
                  className="pointer-events-none absolute left-0 right-0 z-[14]"
                  style={{
                    top: `${LETTER_PAGE_HEIGHT - form.letterMarginBottom}px`,
                    height: '2px',
                    backgroundImage: 'repeating-linear-gradient(to right, #b45309 0 10px, transparent 10px 16px)',
                  }}
                />
                <div
                  className="pointer-events-none absolute z-[14]"
                  style={{
                    left: `${form.letterMarginLeft}px`,
                    top: `${form.letterMarginTop}px`,
                    bottom: `${form.letterMarginBottom}px`,
                    width: '2px',
                    backgroundImage: 'repeating-linear-gradient(to bottom, #b45309 0 10px, transparent 10px 16px)',
                  }}
                />
                <div
                  className="pointer-events-none absolute z-[14]"
                  style={{
                    right: `${form.letterMarginRight}px`,
                    top: `${form.letterMarginTop}px`,
                    bottom: `${form.letterMarginBottom}px`,
                    width: '2px',
                    backgroundImage: 'repeating-linear-gradient(to bottom, #b45309 0 10px, transparent 10px 16px)',
                  }}
                />
                <button
                  className="absolute z-20 h-5 rounded-full border border-amber-700 bg-white px-2 text-[10px] text-amber-700 shadow-sm"
                  onMouseDown={(event) => startMarginDrag('top', event)}
                  style={{ left: `${form.letterMarginLeft + 8}px`, top: `${form.letterMarginTop - 10}px` }}
                  type="button"
                >
                  {activeMargin === 'top' ? `${pxToCm(form.letterMarginTop)} cm` : `${pxToCm(form.letterMarginTop)} cm`}
                </button>
                <button
                  className="absolute z-20 h-5 rounded-full border border-amber-700 bg-white px-2 text-[10px] text-amber-700 shadow-sm"
                  onMouseDown={(event) => startMarginDrag('bottom', event)}
                  style={{ left: `${form.letterMarginLeft + 8}px`, top: `${LETTER_PAGE_HEIGHT - form.letterMarginBottom - 10}px` }}
                  type="button"
                >
                  {activeMargin === 'bottom' ? `${pxToCm(form.letterMarginBottom)} cm` : `${pxToCm(form.letterMarginBottom)} cm`}
                </button>
                <button
                  className="absolute z-20 h-5 rounded-full border border-amber-700 bg-white px-2 text-[10px] text-amber-700 shadow-sm"
                  onMouseDown={(event) => startMarginDrag('left', event)}
                  style={{ left: `${form.letterMarginLeft - 18}px`, top: `${form.letterMarginTop + 8}px` }}
                  type="button"
                >
                  {activeMargin === 'left' ? `${pxToCm(form.letterMarginLeft)} cm` : `${pxToCm(form.letterMarginLeft)} cm`}
                </button>
                <button
                  className="absolute z-20 h-5 rounded-full border border-amber-700 bg-white px-2 text-[10px] text-amber-700 shadow-sm"
                  onMouseDown={(event) => startMarginDrag('right', event)}
                  style={{ left: `${LETTER_PAGE_WIDTH - form.letterMarginRight - 18}px`, top: `${form.letterMarginTop + 8}px` }}
                  type="button"
                >
                  {activeMargin === 'right' ? `${pxToCm(form.letterMarginRight)} cm` : `${pxToCm(form.letterMarginRight)} cm`}
                </button>
                    <div
                      className="relative z-[1] cursor-text rounded-[2px] border border-stone-200 bg-transparent outline-none"
                      onBlur={() => {
                        isEditorFocusedRef.current = false;
                        syncEditorHtml();
                      }}
                      onFocus={() => {
                        isEditorFocusedRef.current = true;
                        syncToolbarState();
                      }}
                      onInput={handleEditorInput}
                      onKeyDown={handleEditorKeyDown}
                      onMouseDown={handleEditorMouseDown}
                      onMouseUp={() => syncToolbarState()}
                      ref={editorRef}
                      suppressContentEditableWarning
                      style={{
                        height: `${LETTER_PAGE_HEIGHT}px`,
                        overflow: 'hidden',
                        padding: `${form.letterMarginTop}px ${form.letterMarginRight}px ${form.letterMarginBottom}px ${form.letterMarginLeft}px`,
                        position: 'relative',
                        whiteSpace: 'pre-wrap',
                        width: `${LETTER_PAGE_WIDTH}px`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] border border-stone-200 bg-white px-4 py-3 text-[12px] leading-5 text-slate-500">
                `Linie` und `Logo` sind frei verschiebbare Elemente. Wenn du sie anklickst, kannst du sie
                horizontal über die Punkte links und rechts anpassen und per Ziehen frei im Brief positionieren.
                Mit `Entf` oder `Backspace` löschst du das ausgewählte Element wieder.
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-xs text-slate-700">
                  <span>Format übernehmen von</span>
                  <select
                    className="bg-transparent text-xs font-medium text-slate-900 outline-none"
                    onChange={(event) => adoptTemplateFromCompany(event.target.value)}
                    value={copyTemplateFromCompanyId}
                  >
                    <option value="">Firma wählen</option>
                    {companies
                      .filter((company) => company.id !== selectedCompanyId)
                      .map((company) => (
                        <option key={company.id} value={company.id}>
                          {cleanSignatureText(company.data.name) || company.id}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  className="rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-5 py-2 text-sm font-medium text-stone-100 transition hover:brightness-105 disabled:opacity-50"
                  disabled={isPending || isUploading}
                  onClick={saveLetter}
                  type="button"
                >
                  {isPending ? 'Wird gespeichert...' : 'Brief speichern'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-[24px] border border-stone-200 bg-stone-50/70 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                  {isGreetingView ? 'Anrede Vorlage' : 'Abschlussblock'}
                </p>
                <div
                  key={`${isGreetingView ? 'greeting' : 'closing'}-${selectedCompanyId}`}
                  ref={isGreetingView ? greetingRef : closingBlockRef}
                  className="mt-3 min-h-[220px] w-full rounded-[24px] border border-stone-300 bg-white px-5 py-4 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                  contentEditable
                  data-placeholder={
                    isGreetingView
                      ? 'Guten Tag {{RECIPIENT_NAME}},'
                      : `Mit freundlichen Grüßen\n{{SIGNATURE_NAME}}\n{{COMPANY_NAME}}`
                  }
                  onBlur={commitRichTextFields}
                  onFocus={() => {
                    activeRichTextRef.current = isGreetingView ? 'greeting' : 'closing';
                    rememberFormattingSelection();
                    syncToolbarState();
                  }}
                  onInput={() => {
                    activeRichTextRef.current = isGreetingView ? 'greeting' : 'closing';
                    syncRichTextField();
                    rememberFormattingSelection();
                    syncToolbarState();
                  }}
                  onKeyUp={() => {
                    activeRichTextRef.current = isGreetingView ? 'greeting' : 'closing';
                    rememberFormattingSelection();
                    syncToolbarState();
                  }}
                  onMouseDown={() => {
                    activeRichTextRef.current = isGreetingView ? 'greeting' : 'closing';
                  }}
                  onMouseUp={() => {
                    activeRichTextRef.current = isGreetingView ? 'greeting' : 'closing';
                    rememberFormattingSelection();
                    syncToolbarState();
                  }}
                  role="textbox"
                  suppressContentEditableWarning
                />
                <p className="mt-3 text-[12px] leading-5 text-slate-500">
                  Markiere den Text in diesem Feld und nutze dann die Formatierungsbuttons darüber.
                  Auf dieser Unterseite gibt es bewusst nur dieses eine Formatierfeld.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  className="rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-5 py-2 text-sm font-medium text-stone-100 transition hover:brightness-105 disabled:opacity-50"
                  disabled={isPending || isUploading}
                  onClick={saveLetter}
                  type="button"
                >
                  {isPending ? 'Wird gespeichert...' : isGreetingView ? 'Anrede speichern' : 'Abschluss speichern'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {message ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
    </section>
  );
}
