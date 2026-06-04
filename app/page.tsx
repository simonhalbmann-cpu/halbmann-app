import Image from 'next/image';
import Link from 'next/link';
import PublicShell from '../components/PublicShell';

const highlights = [
  {
    title: 'Tradition und Verantwortung',
    text: 'Halbmann Holding verbindet Vermoegensverwaltung und Bestandsentwicklung mit einem langfristigen Anspruch an Stabilitaet, Qualitaet und nachhaltige Entwicklung.',
  },
  {
    title: 'Qualitaet mit Haltung',
    text: 'Im Mittelpunkt stehen starke Standorte, verlaessliche Prozesse und eine Betreuung, die wirtschaftliche Klarheit mit persoenlicher Verbindlichkeit verbindet.',
  },
  {
    title: 'Verwaltung mit Substanz',
    text: 'Interne Ablaeufe, Kommunikation und Dokumentation werden strukturiert gefuehrt, damit Entscheidungen nachvollziehbar und Vorgaenge sauber steuerbar bleiben.',
  },
];

export default function Home() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-7xl px-6 pb-16 pt-4 xl:px-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.22fr)_minmax(0,0.78fr)] lg:items-end">
          <div className="space-y-9">
            <div className="max-w-4xl">
              <div className="-ml-24 flex items-end gap-3 sm:-ml-28 sm:gap-5">
                <Image
                  alt="Halbmann Holding"
                  className="-mt-12 h-72 w-auto shrink-0 object-contain sm:-mt-16 sm:h-[22rem]"
                  height={440}
                  src="/halbmann-logo.png"
                  width={1240}
                />
                <p className="-ml-24 whitespace-nowrap pb-24 text-[0.66rem] uppercase tracking-[0.3em] text-amber-700 sm:-ml-28 sm:pb-28 sm:text-[0.7rem]">
                  Family Office - Vermoegensmanagement
                </p>
              </div>

              <h1 className="-mt-5 max-w-3xl text-[2.25rem] leading-[0.98] text-slate-950 sm:text-[2.8rem]">
                Langfristige Werte. Klare Haltung.{` `}
                <span className="text-[0.84em] sm:text-[0.8em]">
                  Immobilien mit Substanz.
                </span>
              </h1>
              <p className="mt-5 max-w-3xl text-[1.03rem] leading-8 text-slate-600">
                Halbmann Holding steht fuer Tradition, Staerke und Innovation.
                Unser Fokus liegt auf einem nachhaltigen, diversifizierten
                Portfolio aus Wohn-, Gewerbe- und Lagerflaechen in starken
                Lagen, begleitet von einer strukturierten internen Verwaltung.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {highlights.map((item) => (
                <div
                  className="flex min-h-[272px] flex-col rounded-[30px] border border-stone-200 bg-white px-6 py-7 shadow-[0_28px_80px_-52px_rgba(15,23,42,0.45)]"
                  key={item.title}
                >
                  <h2 className="text-[1.58rem] leading-tight text-slate-950">
                    {item.title}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex h-full flex-col justify-end lg:pt-[132px]">
            <div className="absolute inset-x-8 top-8 -z-10 h-40 rounded-full bg-amber-200/45 blur-3xl" />
            <div className="space-y-4 rounded-[34px] border border-stone-200 bg-white/90 p-4 shadow-[0_36px_100px_-55px_rgba(15,23,42,0.65)] backdrop-blur">
              <div className="rounded-[26px] border border-stone-700/25 bg-[linear-gradient(180deg,#7a6651_0%,#5f4f3f_100%)] px-5 py-5 text-stone-100 shadow-[0_28px_60px_-38px_rgba(90,66,43,0.55)]">
                <p className="text-[10px] uppercase tracking-[0.32em] text-stone-200/80">
                  Intern
                </p>
                <h2 className="mt-3 text-[1.8rem] leading-tight text-stone-100">
                  Halbmann Verwaltungsportal
                </h2>
                <p className="mt-3 text-sm leading-7 text-stone-200/88">
                  Der digitale Zugang ist ausschliesslich fuer Verwaltung,
                  Kommunikation, Dokumentation und interne Vorgangsbearbeitung
                  vorgesehen.
                </p>
              </div>

              <div className="rounded-[26px] border border-stone-200 bg-stone-50 p-5">
                <p className="text-[10px] uppercase tracking-[0.28em] text-amber-700/80">
                  Zugriff
                </p>
                <h2 className="mt-3 text-2xl text-slate-950">Verwalter-Login</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Mieter erhalten Informationen gezielt per E-Mail oder Brief.
                  Das Portal bleibt ein internes Werkzeug fuer die Verwaltung.
                </p>
                <Link
                  className="mt-5 block rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-5 py-3 text-center text-sm font-medium text-stone-100 transition hover:brightness-105"
                  href="/login"
                >
                  Zum internen Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
