import Image from 'next/image';
import PublicShell from '../components/PublicShell';

const focusAreas = [
  {
    title: 'Eigener Bestand',
    text: 'Ein Portfolio aus Wohn-, Gewerbe- und Lagerflächen, gehalten mit langfristigem Anspruch.',
  },
  {
    title: 'Klare Entscheidungen',
    text: 'Vermögensverwaltung mit ruhiger Analyse, verbindlicher Haltung und Blick auf dauerhafte Substanz.',
  },
  {
    title: 'Entwicklung mit Maß',
    text: 'Standorte, Objekte und Strukturen werden nicht verwaltet, um stillzustehen, sondern um tragfähig zu bleiben.',
  },
];

export default function Home() {
  return (
    <PublicShell>
      <section className="relative isolate overflow-hidden bg-[#111827] text-white">
        <Image
          alt="Moderne Architektur mit reflektierter Berliner Stadtansicht"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[50%_45%] sm:object-[58%_45%]"
          fill
          priority
          sizes="100vw"
          src="/berlin-architecture-hero.jpg"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(9,15,24,0.9)_0%,rgba(14,20,29,0.72)_42%,rgba(9,15,24,0.86)_100%)] sm:bg-[linear-gradient(90deg,rgba(9,15,24,0.86)_0%,rgba(18,24,32,0.72)_38%,rgba(18,24,32,0.26)_68%,rgba(18,24,32,0.08)_100%)]" />
        <div className="pointer-events-none absolute right-0 top-0 -z-10 hidden h-[45%] w-[42%] bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.22),transparent_34%),repeating-linear-gradient(45deg,rgba(255,255,255,0.055)_0,rgba(255,255,255,0.055)_1px,transparent_1px,transparent_8px),repeating-linear-gradient(135deg,rgba(0,0,0,0.035)_0,rgba(0,0,0,0.035)_1px,transparent_1px,transparent_8px)] opacity-55 mix-blend-soft-light sm:block" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-[linear-gradient(0deg,rgba(9,15,24,0.62),transparent)]" />
        <div className="pointer-events-none absolute -right-8 top-2 hidden lg:block lg:-right-4 lg:top-3">
          <div className="relative h-36 w-[320px] sm:h-48 sm:w-[430px] lg:h-56 lg:w-[510px]">
            <div className="absolute left-[15%] top-[20%] h-[48%] w-[60%] rounded-full bg-[radial-gradient(circle,rgba(245,247,247,0.72)_0%,rgba(226,229,230,0.38)_42%,transparent_76%)] blur-lg" />
            <div
              aria-hidden="true"
              className="absolute left-[2px] top-[2px] h-full w-full opacity-72 blur-[0.2px]"
              style={{
                background: 'rgba(28, 32, 37, 0.78)',
                WebkitMask: 'url(/halbmann-logo.png) center / contain no-repeat',
                mask: 'url(/halbmann-logo.png) center / contain no-repeat',
              }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 h-full w-full opacity-100 drop-shadow-[0_10px_20px_rgba(0,0,0,0.28)]"
              style={{
                background:
                  'linear-gradient(120deg, #5f656b 0%, #f9fafb 18%, #8f969c 36%, #ffffff 48%, #737a80 68%, #dfe3e5 100%)',
                WebkitMask: 'url(/halbmann-logo.png) center / contain no-repeat',
                mask: 'url(/halbmann-logo.png) center / contain no-repeat',
              }}
            />
            <div
              aria-hidden="true"
              className="absolute -left-[1px] -top-[1px] h-full w-full opacity-34"
              style={{
                background: 'rgba(255,255,255,0.92)',
                WebkitMask: 'url(/halbmann-logo.png) center / contain no-repeat',
                mask: 'url(/halbmann-logo.png) center / contain no-repeat',
              }}
            />
          </div>
        </div>

        <div className="mx-auto flex min-h-[100svh] max-w-7xl flex-col px-5 py-7 sm:min-h-[86vh] sm:px-6 sm:py-8 xl:px-10">
          <header className="flex min-h-32 items-start justify-center sm:min-h-36 lg:min-h-40">
            <Image
              alt="Halbmann Holding"
              className="h-auto w-[220px] opacity-100 drop-shadow-[0_12px_26px_rgba(0,0,0,0.58)] sm:w-[280px] lg:hidden"
              height={363}
              priority
              src="/halbmann-logo-white.png"
              width={680}
            />
          </header>

          <div className="grid flex-1 items-end gap-8 pb-7 sm:gap-10 sm:pb-10 lg:grid-cols-[minmax(0,0.94fr)_minmax(320px,0.56fr)]">
            <div className="max-w-3xl">
              <p className="max-w-xs text-[0.62rem] font-medium uppercase leading-5 text-[#d7b978] sm:max-w-none sm:text-[0.68rem]">
                Family Office - Immobilien - Vermögensmanagement
              </p>
              <h1 className="mt-5 max-w-4xl font-serif text-[2.85rem] leading-[1.02] text-white sm:mt-6 sm:text-6xl sm:leading-[0.98] lg:text-7xl">
                Werte bewahren. Zukunft gestalten.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-white/80 sm:mt-7 sm:text-lg sm:leading-8">
                Halbmann Holding verbindet privates Vermögensmanagement mit
                substanzorientiertem Immobilienbestand. Diskret, langfristig
                und mit dem Anspruch, Entscheidungen nicht dem Zufall zu
                überlassen.
              </p>
            </div>

            <aside className="max-w-md border-t border-white/24 bg-black/18 pt-6 sm:max-w-lg lg:mb-4 lg:border-l lg:border-t-0 lg:px-6 lg:py-5">
              <blockquote className="mt-4 font-serif text-2xl italic leading-tight text-white sm:text-4xl">
                „Die Zukunft kann man am besten voraussagen, indem man sie gestaltet.“
              </blockquote>
              <cite className="mt-5 block text-[0.72rem] not-italic font-semibold uppercase tracking-[0.3em] text-[#ffe2a3] drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                Alan Kay
              </cite>
            </aside>
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#1f1713_0%,#151c24_100%)] text-slate-100">
        <div className="mx-auto grid max-w-7xl gap-9 px-5 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.78fr_1.22fr] xl:px-10">
          <div>
            <p className="text-[0.68rem] font-medium uppercase text-[#d7b978]">
              Haltung
            </p>
            <h2 className="mt-5 max-w-xl font-serif text-3xl leading-tight text-white sm:text-5xl">
              Immobilien sind Vermögen, Verantwortung und Zukunftsraum.
            </h2>
          </div>

          <div className="grid border-y border-white/14">
            {focusAreas.map((item) => (
              <article
                className="grid gap-3 border-b border-white/14 py-6 last:border-b-0 sm:gap-4 md:grid-cols-[210px_minmax(0,1fr)]"
                key={item.title}
              >
                <h3 className="font-serif text-2xl text-white">{item.title}</h3>
                <p className="text-sm leading-7 text-slate-300">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#18222c_0%,#202a33_100%)] text-stone-100">
        <div className="mx-auto grid max-w-7xl gap-9 px-5 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.86fr)] xl:px-10">
          <div>
            <p className="text-[0.68rem] font-medium uppercase text-[#d7b978]">
              Profil
            </p>
            <h2 className="mt-5 max-w-3xl font-serif text-3xl leading-tight sm:text-5xl">
              Ein Bestand ist nur so stark wie die Haltung, mit der er geführt wird.
            </h2>
          </div>
          <div className="space-y-6 text-base leading-8 text-stone-300">
            <p>
              Der Fokus liegt auf nachvollziehbaren Lagen, solider
              Bewirtschaftung und einer Eigentümerkultur, die auf Dauer
              angelegt ist. Stabilität entsteht dabei nicht aus Stillstand,
              sondern aus konsequenter Pflege, klaren Prozessen und dem Mut,
              Zukunft rechtzeitig zu gestalten.
            </p>
            <p className="border-t border-stone-700 pt-6 text-sm leading-7 text-stone-400">
              Diese Website enthält keine Anlageberatung, kein öffentliches
              Beteiligungsangebot und keine Aufforderung zum Erwerb von
              Vermögensanlagen.
            </p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
