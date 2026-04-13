export default function MieterportalDashboard() {
  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
          Mieterportal
        </p>
        <h2 className="mt-3 text-4xl text-slate-950">Ihre Übersicht</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          Hier sehen Mieter künftig Dokumente, Nachrichten und relevante
          Informationen zu ihrem Mietverhältnis an einem Ort.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="text-2xl text-slate-950">Meine Dokumente</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Verträge, Schreiben und weitere Unterlagen werden hier gebündelt
            bereitgestellt.
          </p>
        </div>
        <div className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="text-2xl text-slate-950">Nachrichten</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Rückfragen und Mitteilungen laufen strukturiert über das Portal.
          </p>
        </div>
      </div>

      <div className="rounded-[28px] border border-sky-200 bg-sky-50 p-5 text-sm leading-7 text-sky-900">
        Das Mieterportal ist jetzt separat vom Verwalterbereich geschützt. Als
        nächstes können wir Inhalte aus Firestore einbinden.
      </div>
    </div>
  );
}
