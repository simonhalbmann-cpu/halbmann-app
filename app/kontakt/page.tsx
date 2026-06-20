import PublicShell from '../../components/PublicShell';

const groupCompanies = [
  'Halbmann Vermögensverwaltungs GmbH coming soon...',
  'Halbmann Bau und Vertrieb GmbH',
  'HS67 Immobilien GmbH',
  'Hansastraße18 Immobilien GmbH',
];

export default function KontaktPage() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-5xl px-6 py-16 xl:px-10">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[36px] border border-stone-200 bg-white/85 p-8 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] md:p-12">
            <p className="text-xs uppercase tracking-[0.28em] text-amber-700">
              Kontakt
            </p>
            <h1 className="mt-4 text-5xl text-slate-950">
              Kontakt zur Halbmann Holding
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Für allgemeine Anfragen erreichen Sie uns direkt in Berlin.
              Mieter und Verwaltung nutzen für laufende Anliegen bitte die
              bekannten direkten Kontaktwege.
            </p>
          </div>

          <div className="space-y-6">
            <div className="rounded-[32px] border border-stone-200 bg-[#efe6da] p-8">
              <h2 className="text-3xl text-slate-950">Adresse</h2>
              <div className="mt-5 space-y-3 text-sm leading-7 text-slate-700">
                <p>Halbmann Holding</p>
                <p>Lindenallee 43a</p>
                <p>14050 Berlin</p>
              </div>
            </div>

            <div className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-sm">
              <h2 className="text-3xl text-slate-950">Gesellschaften</h2>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                {groupCompanies.map((company) => (
                  <li key={company}>{company}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
