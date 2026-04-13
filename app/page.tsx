import Image from 'next/image';
import PublicShell from '../components/PublicShell';
import LoginForm from '../components/LoginForm';

const highlights = [
  {
    title: 'Tradition und Verantwortung',
    text: 'Halbmann Holding verbindet Vermögensverwaltung und Bestandsentwicklung mit einem langfristigen Anspruch an Stabilität, Qualität und nachhaltige Entwicklung.',
  },
  {
    title: 'Qualität mit Haltung',
    text: 'Im Mittelpunkt stehen starke Standorte, verlässliche Prozesse und eine Betreuung, die wirtschaftliche Klarheit mit persönlicher Verbindlichkeit verbindet.',
  },
  {
    title: 'Mieterportal mit Substanz',
    text: 'Das Portal bündelt Kommunikation, Dokumente und Abläufe an einem Ort, damit wir die Qualität unseres Services dauerhaft verlässlich und strukturiert gewährleisten können.',
  },
];

function DownloadButton({
  accentClassName,
  href,
  title,
}: {
  accentClassName: string;
  href: string;
  title: string;
}) {
  return (
    <a
      className={`relative inline-flex min-w-[156px] items-center justify-center overflow-hidden rounded-[18px] border px-4 py-3 text-sm font-medium text-stone-200/88 transition hover:-translate-y-0.5 hover:shadow-md [clip-path:polygon(10%_0%,90%_0%,100%_18%,100%_82%,90%_100%,10%_100%,0%_82%,0%_18%)] ${accentClassName}`}
      href={href}
    >
      <span className="pointer-events-none absolute inset-x-3 top-1 h-[42%] [clip-path:polygon(8%_0%,92%_0%,100%_28%,88%_100%,12%_100%,0%_28%)] bg-[linear-gradient(180deg,rgba(255,255,255,0.62)_0%,rgba(255,255,255,0.18)_70%,rgba(255,255,255,0)_100%)] blur-[1px]" />
      <span className="pointer-events-none absolute inset-y-2 left-2 w-8 [clip-path:polygon(100%_0%,0%_18%,0%_82%,100%_100%,72%_50%)] bg-white/12" />
      <span className="pointer-events-none absolute inset-y-2 right-2 w-8 [clip-path:polygon(0%_0%,100%_18%,100%_82%,0%_100%,28%_50%)] bg-blue-950/18" />
      <span className="pointer-events-none absolute bottom-1 left-1/2 h-4 w-20 -translate-x-1/2 [clip-path:polygon(10%_0%,90%_0%,100%_100%,0%_100%)] bg-sky-950/18 blur-[1px]" />
      <span className="relative">{title}</span>
    </a>
  );
}

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
                  Family Office • Vermögensmanagement
                </p>
              </div>

              <h1 className="-mt-5 max-w-3xl text-[2.25rem] leading-[0.98] text-slate-950 sm:text-[2.8rem]">
                Langfristige Werte. Klare Haltung.{` `}
                <span className="text-[0.84em] sm:text-[0.8em]">
                  Immobilien mit Substanz.
                </span>
              </h1>
              <p className="mt-5 max-w-3xl text-[1.03rem] leading-8 text-slate-600">
                Halbmann Holding steht für Tradition, Stärke und Innovation.
                Unser Fokus liegt auf einem nachhaltigen, diversifizierten
                Portfolio aus Wohn-, Gewerbe- und Lagerflächen in starken
                Lagen, begleitet von einer strukturierten Verwaltung und einem
                hochwertigen Mietererlebnis.
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
                  App
                </p>
                <h2 className="mt-3 text-[1.8rem] leading-tight text-stone-100">
                  Die App für schnellen Service
                </h2>
                <p className="mt-3 text-sm leading-7 text-stone-200/88">
                  Mit der App lassen sich Zählerstände bequem dokumentieren,
                  Schadensmeldungen mit Fotos einreichen und wichtige
                  Informationen ohne Umwege an die Verwaltung übermitteln.
                </p>

                <p className="mt-5 text-[10px] uppercase tracking-[0.32em] text-stone-200/80">
                  Download App
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                  <DownloadButton
                    accentClassName="border-sky-200/28 bg-[radial-gradient(circle_at_24%_22%,rgba(255,255,255,0.65)_0%,rgba(255,255,255,0.16)_18%,rgba(87,210,255,0.18)_26%,rgba(24,129,255,0.68)_58%,rgba(11,66,168,0.92)_100%)] shadow-[0_18px_40px_-22px_rgba(20,111,228,0.55),inset_0_1px_0_rgba(255,255,255,0.32)]"
                    href="#"
                    title="iPhone"
                  />
                  <DownloadButton
                    accentClassName="border-sky-200/28 bg-[radial-gradient(circle_at_28%_20%,rgba(255,255,255,0.62)_0%,rgba(255,255,255,0.14)_19%,rgba(118,226,255,0.18)_28%,rgba(28,150,255,0.7)_56%,rgba(14,79,186,0.93)_100%)] shadow-[0_18px_40px_-22px_rgba(20,111,228,0.55),inset_0_1px_0_rgba(255,255,255,0.32)]"
                    href="#"
                    title="Android"
                  />
                </div>
              </div>

              <div className="rounded-[26px] border border-stone-200 bg-stone-50 p-5">
                <LoginForm intendedRole="tenant" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
