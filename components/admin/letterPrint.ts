export function printLetterHtml(letterHtml: string, title = 'Brief') {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !letterHtml.trim()) return;

  const frame = document.createElement('iframe');
  frame.setAttribute('title', title);
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.style.opacity = '0';
  frame.style.pointerEvents = 'none';

  document.body.appendChild(frame);

  const printWindow = frame.contentWindow;
  const printDocument = printWindow?.document;
  if (!printWindow || !printDocument) {
    frame.remove();
    return;
  }

  printDocument.open();
  printDocument.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title.replace(/[<>&"]/g, '')}</title>
    <style>
      @page { size: A4; margin: 0; }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body {
        display: flex;
        justify-content: center;
        flex-direction: column;
      }
      [data-letter-page="true"] {
        break-after: page;
        page-break-after: always;
      }
      [data-letter-page="true"]:last-child {
        break-after: auto;
        page-break-after: auto;
      }
      [data-letter-line="true"],
      hr {
        border-color: #000000 !important;
        border-top-color: #000000 !important;
      }
      [style*="border-top"],
      [style*="border-bottom"],
      [style*="border-left"],
      [style*="border-right"] {
        border-color: #000000 !important;
      }
    </style>
  </head>
  <body>${letterHtml}</body>
</html>`);
  printDocument.close();

  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
    window.setTimeout(() => frame.remove(), 1000);
  }, 250);
}
