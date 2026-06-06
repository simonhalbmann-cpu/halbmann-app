import Link from 'next/link';
import PublicShell from '../../components/PublicShell';

const sections = [
  {
    title: 'Anbieter',
    content: [
      'Halbmann Holding GmbH',
      'Lindenallee 43a',
      '14050 Berlin',
      'Deutschland',
    ],
  },
  {
    title: 'Kontakt',
    content: ['Telefon: +49 (0) 176 9 666 21 66', 'E-Mail: kontakt@halbmann-holding.de'],
  },
  {
    title: 'Vertretungsberechtigt',
    content: ['Simon Halbmann', 'Yulia Halbmann'],
  },
  {
    title: 'Registereintrag',
    content: [
      'Eintragung im Handelsregister',
      'Registergericht: Amtsgericht Charlottenburg, Berlin',
      'Registernummer: HRB 219134 B',
    ],
  },
];

export default function ImpressumPage() {
  return (
    <PublicShell>
      <main className="mx-auto max-w-5xl px-6 py-16 xl:px-10">
        <div className="mx-auto mb-6 flex max-w-4xl">
          <Link
            className="inline-flex items-center rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm text-slate-200 shadow-[0_18px_50px_-36px_rgba(0,0,0,0.8)] backdrop-blur transition hover:border-white/30 hover:bg-white/12 hover:text-white"
            href="/"
          >
            Zurück zur Startseite
          </Link>
        </div>

        <section className="border-y border-white/10 bg-white/[0.06] py-10 shadow-[0_24px_90px_-60px_rgba(0,0,0,0.9)] backdrop-blur">
          <div className="mx-auto max-w-4xl px-6">
            <p className="text-xs uppercase tracking-[0.32em] text-[#c8a66a]">
              Impressum
            </p>
            <h1 className="mt-4 text-4xl text-white md:text-6xl">
              Halbmann Holding GmbH
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">
              Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG).
            </p>
          </div>
        </section>

        <section className="mx-auto mt-10 grid max-w-4xl gap-px overflow-hidden border-y border-white/10 bg-white/10 md:grid-cols-2">
          {sections.map((section) => (
            <div key={section.title} className="bg-white/[0.07] p-6 backdrop-blur md:p-8">
              <h2 className="text-xs uppercase tracking-[0.26em] text-[#c8a66a]">
                {section.title}
              </h2>
              <div className="mt-4 space-y-1 text-sm leading-7 text-slate-200">
                {section.content.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="mx-auto mt-12 max-w-4xl space-y-10 border-t border-white/10 pt-10 text-sm leading-7 text-slate-300">
          <article>
            <h2 className="text-lg text-white">Haftung für Inhalte</h2>
            <p className="mt-3">
              Die Inhalte dieser Website werden mit Sorgfalt erstellt. Für die
              Richtigkeit, Vollständigkeit und Aktualität der bereitgestellten
              Informationen übernehmen wir jedoch keine Gewähr. Als
              Diensteanbieter sind wir für eigene Inhalte nach den allgemeinen
              Gesetzen verantwortlich. Verpflichtungen zur Entfernung oder
              Sperrung der Nutzung von Informationen nach den gesetzlichen
              Vorschriften bleiben unberührt; eine Haftung kommt jedoch erst ab
              Kenntnis einer konkreten Rechtsverletzung in Betracht.
            </p>
          </article>

          <article>
            <h2 className="text-lg text-white">Externe Links</h2>
            <p className="mt-3">
              Soweit diese Website auf externe Seiten verweist, haben wir auf
              deren aktuelle und künftige Inhalte keinen Einfluss. Für Inhalte
              verlinkter Seiten ist stets der jeweilige Anbieter oder Betreiber
              verantwortlich. Bei Bekanntwerden von Rechtsverletzungen entfernen
              wir entsprechende Links unverzüglich.
            </p>
          </article>

          <article>
            <h2 className="text-lg text-white">Urheberrecht</h2>
            <p className="mt-3">
              Die durch die Seitenbetreiber erstellten Inhalte und Werke auf
              dieser Website unterliegen dem deutschen Urheberrecht.
              Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
              Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der
              vorherigen schriftlichen Zustimmung des jeweiligen Rechteinhabers.
              Soweit Inhalte nicht von uns erstellt wurden, werden die Rechte
              Dritter beachtet.
            </p>
          </article>

          <article>
            <h2 className="text-lg text-white">Datenschutzhinweis</h2>
            <p className="mt-3">
              Diese Website kann grundsätzlich ohne Angabe personenbezogener
              Daten besucht werden. Wenn Sie uns per Telefon oder E-Mail
              kontaktieren, verarbeiten wir die von Ihnen übermittelten Angaben
              zur Bearbeitung Ihrer Anfrage. Eine Weitergabe an Dritte erfolgt
              nicht ohne Rechtsgrundlage oder Ihre Einwilligung.
            </p>
            <p className="mt-3">
              Wir weisen darauf hin, dass die Datenübertragung im Internet,
              insbesondere bei der Kommunikation per E-Mail, Sicherheitslücken
              aufweisen kann. Ein lückenloser Schutz der Daten vor dem Zugriff
              durch Dritte ist nicht möglich.
            </p>
          </article>

          <article>
            <h2 className="text-lg text-white">Werbewiderspruch</h2>
            <p className="mt-3">
              Der Nutzung der im Rahmen der Impressumspflicht veröffentlichten
              Kontaktdaten zur Übersendung nicht ausdrücklich angeforderter
              Werbung und Informationsmaterialien wird widersprochen. Wir
              behalten uns rechtliche Schritte im Falle unverlangter
              Werbezusendungen vor.
            </p>
          </article>
        </section>
      </main>
    </PublicShell>
  );
}
