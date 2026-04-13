import PublicShell from '../../components/PublicShell';

export default function ImpressumPage() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-4xl px-6 py-16 xl:px-10">
        <div className="rounded-[36px] border border-stone-200 bg-white/90 p-8 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] md:p-12">
          <p className="text-xs uppercase tracking-[0.28em] text-amber-700">
            Impressum
          </p>
          <h1 className="mt-4 text-5xl text-slate-950">Halbmann Holding GmbH</h1>

          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-2xl text-slate-950">Anschrift</h2>
              <div className="mt-4 space-y-2 text-sm leading-7 text-slate-600">
                <p>Halbmann Holding GmbH</p>
                <p>Lindenallee 43a</p>
                <p>14050 Berlin</p>
                <p>Deutschland</p>
              </div>
            </div>

            <div>
              <h2 className="text-2xl text-slate-950">Unternehmensumfeld</h2>
              <div className="mt-4 space-y-2 text-sm leading-7 text-slate-600">
                <p>Family Office und Immobilieninvestitionen</p>
                <p>Halbmann Vermögensverwaltungs GmbH</p>
                <p>Halbmann Bau und Vertrieb GmbH</p>
                <p>HS67 Immobilien GmbH</p>
                <p>Hansastraße18 Immobilien GmbH</p>
              </div>
            </div>
          </div>

          <div className="mt-10 rounded-[28px] bg-stone-50 p-6 text-sm leading-7 text-slate-600">
            <p>
              Diese Angaben basieren auf den derzeit im Projekt hinterlegten
              Informationen. Handelsregister-, Vertretungs- und Kontaktangaben
              können ergänzt werden, sobald sie final vorliegen.
            </p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
