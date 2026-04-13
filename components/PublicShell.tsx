import Link from 'next/link';
import type { ReactNode } from 'react';

type PublicShellProps = {
  children: ReactNode;
};

export default function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(201,165,107,0.18),_transparent_30%),linear-gradient(180deg,_#f6f1ea_0%,_#f3ede4_100%)] text-slate-900">
      <main>{children}</main>

      <footer className="border-t border-stone-200 bg-[#efe8de]">
        <div className="mx-auto flex max-w-7xl justify-center px-6 py-8 text-sm text-slate-600 xl:px-10">
          <div className="flex flex-wrap items-center justify-center gap-3 text-center">
            <Link className="transition hover:text-slate-950" href="/login">
              Verwalter-Login
            </Link>
            <span className="text-stone-400">|</span>
            <Link className="transition hover:text-slate-950" href="/impressum">
              Impressum
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
