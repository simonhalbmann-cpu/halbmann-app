import PublicShell from '../../components/PublicShell';

const values = [
  'Langfristige Partnerschaften statt kurzfristiger Effekte',
  'Qualität, Integrität und verlässliche Kommunikation',
  'Nachhaltige Entwicklung von Wohn-, Gewerbe- und Lagerflächen',
  'Offenheit für neue Technologien und moderne Verwaltungsprozesse',
];

export default function UeberPage() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-5xl px-6 py-16 xl:px-10">
        <div className="rounded-[36px] border border-stone-200 bg-white/85 p-8 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] md:p-12">
          <p className="text-xs uppercase tracking-[0.28em] text-amber-700">
            Über uns
          </p>
          <h1 className="mt-4 text-5xl text-slate-950">
            Familienunternehmen mit Fokus auf Werte, Bestand und Entwicklung
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
            Halbmann Holding führt Vermögensverwaltung und
            Immobilieninvestitionen mit jahrzehntelanger Erfahrung zusammen.
            Unser Ziel ist es, Werte zu schaffen, die über Generationen hinweg
            Bestand haben und gleichzeitig neue Wege in der Immobilienbranche zu
            gehen.
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="rounded-[28px] bg-stone-50 p-6">
              <h2 className="text-3xl text-slate-950">Unsere Vision</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Wir bauen ein nachhaltiges und diversifiziertes Portfolio aus
                Gewerbe-, Wohn- und Lagerflächen in starken Lagen auf und
                entwickeln es mit strategischer Verwaltung weiter.
              </p>
            </div>
            <div className="rounded-[28px] bg-stone-50 p-6">
              <h2 className="text-3xl text-slate-950">Unsere Werte</h2>
              <ul className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
                {values.map((value) => (
                  <li key={value}>{value}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
