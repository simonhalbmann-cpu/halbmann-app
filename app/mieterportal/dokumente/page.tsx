export default function DokumentePage() {
  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-sm">
        <h2 className="text-4xl text-slate-950">Dokumente</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          Verträge, Betriebskostenunterlagen und weitere Dokumente erscheinen
          künftig in diesem Bereich.
        </p>
      </div>

      <div className="rounded-[28px] border border-dashed border-stone-300 bg-stone-50 p-8 text-sm text-slate-600">
        Der Dokumentenbereich ist vorbereitet, aktuell sind noch keine Dateien
        hinterlegt.
      </div>
    </div>
  );
}
