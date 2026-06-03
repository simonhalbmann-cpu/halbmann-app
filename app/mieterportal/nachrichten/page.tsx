'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { buildPortalDisplayName, cleanPortalText } from '../../../lib/portalAccess';
import {
  formatDateTime,
  getMessageStatusClass,
  getMessageStatusLabel,
  type ThemeRecord,
} from './_lib';

export default function NachrichtenPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const [targetData, setTargetData] = useState<Record<string, unknown> | null>(null);
  const [themes, setThemes] = useState<ThemeRecord[]>([]);
  const [listMode, setListMode] = useState<'active' | 'archive'>('active');
  const [showSentModal, setShowSentModal] = useState(false);

  const targetType =
    profile?.targetType === 'contact'
      ? 'contact'
      : profile?.targetType === 'tenant'
        ? 'tenant'
        : null;
  const targetId = cleanPortalText(profile?.targetId);

  useEffect(() => {
    if (!targetType || !targetId) {
      setTargetData(null);
      setThemes([]);
      return;
    }

    let isMounted = true;

    async function loadPortalContext() {
      const response = await fetch('/api/portal/context', { cache: 'no-store' });
      const result = (await response.json()) as {
        ok?: boolean;
        targetData?: Record<string, unknown> | null;
        themes?: ThemeRecord[];
      };

      if (!isMounted || !response.ok || !result.ok) return;

      setTargetData(result.targetData ?? null);
      setThemes(Array.isArray(result.themes) ? result.themes : []);
    }

    void loadPortalContext();
    return () => {
      isMounted = false;
    };
  }, [targetId, targetType]);

  const displayName = useMemo(() => {
    if (!targetType || !targetData) return 'Portal';
    return buildPortalDisplayName(targetType, targetData);
  }, [targetData, targetType]);

  const visibleThemes = useMemo(
    () => themes.filter((theme) => Boolean(theme.archived) === (listMode === 'archive')),
    [listMode, themes]
  );

  useEffect(() => {
    if (searchParams.get('sent') !== '1') return;
    setShowSentModal(true);
    router.replace(pathname);
  }, [pathname, router, searchParams]);

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-stone-200 bg-white px-5 py-5 shadow-sm">
        <p className="font-serif text-2xl text-slate-950">Willkommen im Mieterportal</p>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          Hier finden Sie Ihre wichtigsten Mietdaten und die direkte Kommunikation mit der
          Verwaltung.
        </p>
      </section>

      <section className="rounded-[24px] border border-stone-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
              Nachrichtenübersicht
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              className="inline-flex items-center rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-4 py-2.5 text-sm font-medium text-stone-100 shadow-[0_10px_20px_-16px_rgba(89,71,55,0.7)] transition hover:brightness-105"
              href="/mieterportal/nachrichten/neu"
            >
              + Neue Nachricht
            </Link>
            <label className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-2 text-sm text-slate-700">
              <span>Bereich</span>
              <select
                className="bg-transparent text-sm text-slate-900 outline-none"
                onChange={(event) => setListMode(event.target.value === 'archive' ? 'archive' : 'active')}
                value={listMode}
              >
                <option value="active">Aktuell</option>
                <option value="archive">Archiv</option>
              </select>
            </label>
          </div>
        </div>

        {visibleThemes.length === 0 ? (
          <div className="mt-4 rounded-[18px] border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-slate-600">
            {listMode === 'archive'
              ? 'Aktuell liegen keine archivierten Nachrichten vor.'
              : 'Aktuell liegen keine Nachrichten vor.'}
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-[20px] border border-stone-200">
            <div className="hidden grid-cols-[minmax(0,1.3fr)_160px_180px] gap-4 border-b border-stone-200 bg-stone-50 px-4 py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500 md:grid">
              <div>Nachricht</div>
              <div>Status</div>
              <div>Letzte Aktivität</div>
            </div>
            {visibleThemes.map((theme) => (
              <Link
                className="grid w-full gap-3 border-b border-stone-200 bg-white px-4 py-4 text-left transition last:border-b-0 hover:bg-stone-50 md:grid-cols-[minmax(0,1.3fr)_160px_180px] md:items-center"
                href={`/mieterportal/nachrichten/${theme.id}`}
                key={theme.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-950">
                    {theme.subject || 'Ohne Betreff'}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                    {cleanPortalText(theme.latestEntry.data.bodyText) || 'Ohne Inhalt'}
                  </p>
                </div>
                <div>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getMessageStatusClass(theme)}`}
                  >
                    {getMessageStatusLabel(theme)}
                  </span>
                </div>
                <div className="text-sm text-slate-500">{formatDateTime(theme.latestActivityAt)}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {showSentModal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/30 px-4">
          <div className="w-full max-w-sm rounded-[20px] border border-stone-200 bg-white px-5 py-5 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.35)]">
            <p className="text-lg font-medium text-slate-950">Nachricht wurde verschickt.</p>
            <div className="mt-5 flex justify-end">
              <button
                className="rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-4 py-2 text-sm font-medium text-stone-100 transition hover:brightness-105"
                onClick={() => setShowSentModal(false)}
                type="button"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
