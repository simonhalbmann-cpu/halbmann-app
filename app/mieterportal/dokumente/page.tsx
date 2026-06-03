'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import {
  cleanPortalText,
  contactPortalDocumentFields,
  tenantPortalDocumentFields,
} from '../../../lib/portalAccess';

export default function DokumentePage() {
  const { profile } = useAuth();
  const [targetData, setTargetData] = useState<Record<string, unknown> | null>(null);

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
      return;
    }

    let isMounted = true;

    async function loadPortalContext() {
      const response = await fetch('/api/portal/context', { cache: 'no-store' });
      const result = (await response.json()) as {
        ok?: boolean;
        targetData?: Record<string, unknown> | null;
      };

      if (!isMounted || !response.ok || !result.ok) {
        return;
      }

      setTargetData(result.targetData ?? null);
    }

    void loadPortalContext();
    return () => {
      isMounted = false;
    };
  }, [targetId, targetType]);

  const documents = useMemo(() => {
    if (!targetData) return [];
    const fields =
      targetType === 'tenant' ? tenantPortalDocumentFields : contactPortalDocumentFields;
    return fields
      .map((field) => ({
        label: field.label,
        value: cleanPortalText(targetData?.[field.name]),
      }))
      .filter((entry) => entry.value);
  }, [targetData, targetType]);

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-3xl text-slate-950">Dokumente</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          Hier finden Sie die Unterlagen, die für Sie im Portal hinterlegt wurden.
        </p>
      </section>

      {documents.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-slate-600">
          Aktuell sind noch keine Unterlagen für Sie hinterlegt.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {documents.map((document) => (
            <article
              className="rounded-[22px] border border-stone-200 bg-white px-5 py-4 shadow-sm"
              key={`${document.label}-${document.value}`}
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">
                {document.label}
              </p>
              <p className="mt-2 text-sm text-slate-950">{document.value}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
