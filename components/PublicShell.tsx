import Link from 'next/link';
import type { ReactNode } from 'react';

type PublicShellProps = {
  children: ReactNode;
};

export default function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(201,165,107,0.14),_transparent_32%),linear-gradient(180deg,_#111820_0%,_#1e1713_52%,_#121820_100%)] text-slate-100">
      <main>{children}</main>

      <footer className="border-t border-white/10 bg-[#111820]">
        <div className="mx-auto flex max-w-7xl justify-center px-6 py-8 text-sm text-slate-300 xl:px-10">
          <div className="flex flex-wrap items-center justify-center gap-3 text-center">
            <Link className="transition hover:text-white" href="/login">
              Verwalter-Login
            </Link>
            <span className="text-white/25">|</span>
            <Link className="transition hover:text-white" href="/impressum">
              Impressum
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
