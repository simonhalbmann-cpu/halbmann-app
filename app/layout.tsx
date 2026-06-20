import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Manrope } from 'next/font/google';
import Script from 'next/script';
import { AuthProvider } from '../context/AuthContext';
import './globals.css';

const displayFont = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
});

const bodyFont = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'Halbmann Holding',
  description: 'Digitale Plattform für Mieter und Verwaltung.',
};

export const viewport: Viewport = {
  initialScale: 1,
  width: 'device-width',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${displayFont.variable} ${bodyFont.variable}`}
      lang="de"
    >
      <body>
        <Script
          id="halbmann-json-overlay-guard"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var pattern = /Unexpected token '<'|DOCTYPE|not valid JSON/i;
                function isTarget(value) {
                  return value && value.name === 'SyntaxError' && pattern.test(String(value.message || ''));
                }
                function contains(args) {
                  return Array.prototype.some.call(args, function (value) {
                    return isTarget(value) || (typeof value === 'string' && pattern.test(value));
                  });
                }
                var originalError = console.error.bind(console);
                var originalWarn = console.warn.bind(console);
                console.error = function () {
                  if (contains(arguments)) return;
                  return originalError.apply(console, arguments);
                };
                console.warn = function () {
                  if (contains(arguments)) return;
                  return originalWarn.apply(console, arguments);
                };
                window.addEventListener('unhandledrejection', function (event) {
                  if (isTarget(event.reason)) event.preventDefault();
                });
                window.addEventListener('error', function (event) {
                  if (isTarget(event.error)) event.preventDefault();
                });
              })();
            `,
          }}
        />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
