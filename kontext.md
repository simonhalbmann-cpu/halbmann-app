# HALBMANN APP - PROJEKTKONTEXT

**Projekt:** Digitale Immobilien-Verwaltungsplattform
**Stand:** 02.04.2026

---

## ÃƒÆ’Ã…â€œberblick

Wir bauen eine zentrale Plattform mit drei Bereichen:

1. **ÃƒÆ’Ã¢â‚¬â€œffentliche Website**
   SeriÃƒÆ’Ã‚Â¶se Family-Office-Darstellung mit Fokus auf Bestand, Haltung und Service.

2. **Mieterportal**
   GeschÃƒÆ’Ã‚Â¼tzter Bereich fÃƒÆ’Ã‚Â¼r Mieter, spÃƒÆ’Ã‚Â¤ter auch als App-OberflÃƒÆ’Ã‚Â¤che fÃƒÆ’Ã‚Â¼r iPhone und Android.

3. **Verwalterbereich**
   Interner Bereich fÃƒÆ’Ã‚Â¼r Stammdaten, Zuordnungen und spÃƒÆ’Ã‚Â¤tere Verwaltungsprozesse.

---

## Technischer Stand

- **Framework:** Next.js 15
- **Sprache:** TypeScript
- **UI:** React 19, Tailwind CSS
- **Backend:** Firebase
  - Auth
  - Firestore
  - Storage vorbereitet
- **Lokale Entwicklung:** `npm run dev`
- **QualitÃƒÆ’Ã‚Â¤tssicherung:** `npm run lint`

Wichtige Vorgabe:
- Vor ÃƒÆ’Ã¢â‚¬Å¾nderungen an Next.js-Code immer die passende Doku in `node_modules/next/dist/docs/` prÃƒÆ’Ã‚Â¼fen, weil diese Next.js-Version von ÃƒÆ’Ã‚Â¼blichen Annahmen abweichen kann.

---

## Aktueller Produktstand

### ÃƒÆ’Ã¢â‚¬â€œffentliche Website

- Startseite ist gestalterisch auf Halbmann Holding ausgerichtet
- echtes Logo aus `public/halbmann-logo.png` eingebunden
- Footer mit `Verwalter-Login` und `Impressum`
- separater Verwalter-Login unter `/login`
- Impressum-Seite vorhanden
- App-Bereich auf der Startseite integriert
- Mieter-Login direkt auf der Startseite

### Auth & Rollen

- Login lÃƒÆ’Ã‚Â¤uft ÃƒÆ’Ã‚Â¼ber Firebase Auth
- Rollen werden ÃƒÆ’Ã‚Â¼ber Firestore in `userProfiles/{uid}` gepflegt
- aktuell relevante Rollen:
  - `admin`
  - `tenant`
- Mieter und Verwalter sind sauber getrennt
- ein Mieter kommt nicht mehr in den Verwalterbereich

### Verwalterbereich

- Admin-Dashboard vorhanden
- Navigation im Verwalterbereich vorhanden
- `HinzufÃƒÆ’Ã‚Â¼gen` im linken MenÃƒÆ’Ã‚Â¼ ist jetzt als aufklappbares Dropdown aufgebaut
- ÃƒÆ’Ã…â€œber `HinzufÃƒÆ’Ã‚Â¼gen` gibt es links jetzt zusÃƒÆ’Ã‚Â¤tzlich einen Bestands-Reiter mit Hierarchie:
  - Firma
  - zugehÃƒÆ’Ã‚Â¶rige Objekte
  - zugehÃƒÆ’Ã‚Â¶rige Einheiten
  - aktueller Mieter plus letzte Mieter chronologisch darunter
- ÃƒÆ’Ã…â€œber dem Dashboard gibt es links jetzt ein globales Suchfeld fÃƒÆ’Ã‚Â¼r Firma, Objekt, Einheit und Mieter
- Ein Klick im Bestandsbaum ÃƒÆ’Ã‚Â¶ffnet jetzt zusÃƒÆ’Ã‚Â¤tzlich direkt die passende Ansicht:
  - Firma ÃƒÆ’Ã‚Â¶ffnet Firmenansicht
  - Objekt ÃƒÆ’Ã‚Â¶ffnet Immobilienansicht
  - Einheit ÃƒÆ’Ã‚Â¶ffnet die Immobilie mit Fokus auf die gewÃƒÆ’Ã‚Â¤hlte Einheit
  - aktueller oder frÃƒÆ’Ã‚Â¼herer Mieter ÃƒÆ’Ã‚Â¶ffnet die Mieteransicht
- Bereiche zum Anlegen von:
  - Mieter
  - Dritte & Dienstleister
  - Immobilien
  - Firmen
- Formulare arbeiten bereits mit Beziehungen per Dropdown statt Freitext
- Formulare fÃƒÆ’Ã‚Â¼r Firmen, Personen und Immobilien wurden deutlich erweitert
- Uploadbereiche sind strukturell vorbereitet, speichern aktuell aber zunÃƒÆ’Ã‚Â¤chst Dateinamen statt echter Storage-Dateien
- Firmenformular enthÃƒÆ’Ã‚Â¤lt jetzt auch eine Steuerberater-Zuordnung per Dropdown
- Firmenbereich hat jetzt eine echte ÃƒÆ’Ã…â€œbersicht ÃƒÆ’Ã‚Â¼ber allen Firmen oberhalb des Anlegeformulars
- In der FirmenÃƒÆ’Ã‚Â¼bersicht gibt es pro Firma die Aktionen:
  - `Ansehen`
  - `Bearbeiten`
  - `LÃƒÆ’Ã‚Â¶schen`
- Detailseite fÃƒÆ’Ã‚Â¼r Firmen unter `/admin/firma/[id]` vorhanden
- Bearbeitungsseite fÃƒÆ’Ã‚Â¼r Firmen unter `/admin/firma/[id]/bearbeiten` vorhanden
- Detailseite fÃƒÆ’Ã‚Â¼r Immobilien unter `/admin/immobilie/[id]` vorhanden
- Detailseite fÃƒÆ’Ã‚Â¼r Mieter unter `/admin/mieter/[id]` vorhanden
- FirmenÃƒÆ’Ã‚Â¼bersicht zeigt jetzt nur noch den Firmennamen mit den drei Aktionen
- Admin-Formulare fÃƒÆ’Ã‚Â¼r Firmen, Personen und Immobilien arbeiten jetzt mit gemeinsamer Adresshilfe:
  - StraÃƒÆ’Ã…Â¸e wird separat von Hausnummer gefÃƒÆ’Ã‚Â¼hrt
  - PLZ wird formatiert
  - Ort und Land werden soweit mÃƒÆ’Ã‚Â¶glich aus vorhandenen Adressen ergÃƒÆ’Ã‚Â¤nzt
- Admin-Felder formatieren Eingaben jetzt beim AusfÃƒÆ’Ã‚Â¼llen und beim Speichern stÃƒÆ’Ã‚Â¤rker automatisch
- Admin-Formulare bremsen Browser-Credential-Autofill jetzt stÃƒÆ’Ã‚Â¤rker aus, damit Kontakt- oder Postfachfelder nicht als Login gespeichert werden
- Personenbereich ist jetzt fachlich stÃƒÆ’Ã‚Â¤rker aufgeteilt in:
  - Mieter separat
  - externe Partner / Handwerker / Dienstleister
- Im Bereich `Dritte & Dienstleister` sind die auswÃƒÆ’Ã‚Â¤hlbaren Rollen jetzt deutlich konkreter:
  - Elektriker
  - SanitÃƒÆ’Ã‚Â¤r / Rohrreinigung
  - Heizungsdienst
  - MÃƒÆ’Ã‚Â¼llabfuhrunternehmen
  - Abrechnungsunternehmen
  - Winterdienst
  - Reinigungsdienst
  - Dachwartung
  - Regenrinnenreinigung
  - sowie allgemeine externe Kontakte
- Bei `Dritte & Dienstleister` wurde der Dokumentbereich auf einen einzigen Upload `Dokumente` reduziert
- Das zusÃƒÆ’Ã‚Â¤tzliche Feld `Adresse intelligent ÃƒÆ’Ã‚Â¼bernehmen` wurde wieder entfernt
- ÃƒÆ’Ã…â€œbersichten in Mieter, Dritte & Dienstleister, Immobilien und Firmen sind jetzt kompakter und einheitlicher aufgebaut
- Verwalterbereich gestalterisch an Startseite angenÃƒÆ’Ã‚Â¤hert
- Dashboard grob neu ausgerichtet auf:
  - neueste Mieterkommunikation
  - Tickets
  - Leerstand an Einheiten
  - Online-Status und spÃƒÆ’Ã‚Â¤tere Historie von Mietern
- Immobilienverwaltung hat jetzt eine eigene, intelligentere Admin-Komponente statt der generischen Formularschablone
- Interne Objektnummern werden dort automatisch fortlaufend vergeben
- EigentÃƒÆ’Ã‚Â¼mer werden ÃƒÆ’Ã‚Â¼ber ein einziges Feld aus `companies` gewÃƒÆ’Ã‚Â¤hlt
- `Verwalter` erscheint nur bei `Teileigentum`
- Einheiten werden direkt im Objekt gepflegt:
  - Lage / GebÃƒÆ’Ã‚Â¤udeteil
  - Geschoss
  - Maisonette als zusÃƒÆ’Ã‚Â¤tzliche Geschoss-/Lageoption
  - Positionsangaben `li`, `mi`, `re`
  - Mieterzuordnung
  - wohnungsbezogene ZÃƒÆ’Ã‚Â¤hler als optionale, einzeln hinzufÃƒÆ’Ã‚Â¼gbare Bausteine
  - vorbereitete Dokument- und Bildfelder
- Leerstand wird dort automatisch aus Einheiten ohne Mieterzuordnung abgeleitet
- Objekt-ZÃƒÆ’Ã‚Â¤hler und Dienstleister-Zuordnungen sind jetzt als eigene Bereiche vorbereitet
- Objekt-ZÃƒÆ’Ã‚Â¤hler werden jetzt ebenfalls nur bei Bedarf hinzugefÃƒÆ’Ã‚Â¼gt statt als starre Feldliste
- TeilungserklÃƒÆ’Ã‚Â¤rung liegt jetzt auf Objektebene
- ÃƒÆ’Ã…â€œbergabeprotokolle sind aus der Einheit entfernt und fÃƒÆ’Ã‚Â¼r die spÃƒÆ’Ã‚Â¤tere Mieterlogik vorgesehen
- Kaufdatum, Eigentum seit, Kaufpreis und Anfangsrendite sind im Immobilienformular ergÃƒÆ’Ã‚Â¤nzt
- Mieter werden jetzt im Adminbereich nicht mehr per Freitext an Objekt / Einheit gehÃƒÆ’Ã‚Â¤ngt, sondern aus bestehenden Einheiten ausgewÃƒÆ’Ã‚Â¤hlt
- Die Einheit ist damit die fachliche Basis fÃƒÆ’Ã‚Â¼r Mietzuordnung und Leerstandslogik
- Beim Anlegen eines Mieters wird die gewÃƒÆ’Ã‚Â¤hlte Einheit jetzt direkt im Objekt als belegt zurÃƒÆ’Ã‚Â¼ckgeschrieben
- Das Mieterformular enthÃƒÆ’Ã‚Â¤lt jetzt zusÃƒÆ’Ã‚Â¤tzlich:
  - Steuernummer
  - BÃƒÆ’Ã‚Â¼rgschaft
  - weitere Personen / Mitmieter inkl. Telefon und E-Mail
  - Kaltmiete, Betriebskosten, Umsatzsteuer-Regelung, automatisch berechnete Warmmiete (netto), Kaution
  - MieterhÃƒÆ’Ã‚Â¶hungsart und nÃƒÆ’Ã‚Â¤chstes PrÃƒÆ’Ã‚Â¼fdatum
  - vorbereitete Dokumentfelder fÃƒÆ’Ã‚Â¼r Mietvertrag, NachtrÃƒÆ’Ã‚Â¤ge, Ausweiskopien, SCHUFA, Gehaltsnachweise, Jahresabrechnungen u. a.
- Bei Immobilien sind zusÃƒÆ’Ã‚Â¤tzlich Felder fÃƒÆ’Ã‚Â¼r:
  - Baujahr Heizung
  - letzte Heizungswartung
  - letzte Dachwartung
  - letzte Regenrinnenreinigung
  vorbereitet
- Bei Immobilien kÃƒÆ’Ã‚Â¶nnen jetzt mehrere Heizungsarten pro Objekt hinterlegt werden
- Kaufpreis wird im Immobilienformular jetzt als Geldbetrag formatiert
- Neue Einheiten werden im Immobilienformular jetzt direkt oberhalb der bestehenden Einheiten eingefÃƒÆ’Ã‚Â¼gt
- Objekt- und EinheitenzÃƒÆ’Ã‚Â¤hler werden jetzt nur bei Bedarf hinzugefÃƒÆ’Ã‚Â¼gt und enthalten jeweils:
  - ZÃƒÆ’Ã‚Â¤hlernummer
  - erster ZÃƒÆ’Ã‚Â¤hlerstand
  - Ablesedatum
  - Eichdatum
- Die groÃƒÆ’Ã…Â¸e Einleitungsbox oberhalb des Immobilienformulars wurde entfernt
- Nach dem Speichern von Immobilien und Mietern springt die Seite wieder nach oben

### Datenmodell / Collections

Aktuell werden diese Collections verwendet:

- `userProfiles`
- `people`
- `properties`
- `companies`
- `tenants`
- `messages`
- `tickets`
- `ticketEvents`
- `messageDrafts`
- `documentTemplates`

---

## Firestore Rules

Der aktuelle Sicherheitsansatz:

- eigener Nutzer darf eigenes Profil lesen / anlegen / aktualisieren
- Admin darf fremde Profile lesen / ÃƒÆ’Ã‚Â¤ndern / lÃƒÆ’Ã‚Â¶schen
- `people`, `properties`, `companies`, `tenants` nur fÃƒÆ’Ã‚Â¼r Admin
- sonst alles standardmÃƒÆ’Ã‚Â¤ÃƒÆ’Ã…Â¸ig gesperrt

Die Regeldefinition liegt in:
- `firestore.rules`

Wichtig:
- Diese Regeln passen zum aktuellen Stand des Verwalterbereichs
- FÃƒÆ’Ã‚Â¼r spÃƒÆ’Ã‚Â¤tere Mieterfunktionen im Portal oder in der App mÃƒÆ’Ã‚Â¼ssen die Regeln gezielt erweitert werden

---

## Designstand

### Startseite

- Logo und Claim fein ausgerichtet
- Claim aktuell:
  - `Family Office ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ VermÃƒÆ’Ã‚Â¶gensmanagement`
- HauptÃƒÆ’Ã‚Â¼berschrift:
  - `Langfristige Werte. Klare Haltung. Immobilien mit Substanz.`
- App-Karte auf der rechten Seite in warmen Erdtonen
- Download-Buttons in blauer Edelstein-Optik

### Verwalter-Login

- Gestaltung an die Startseite angepasst
- kein hartes Schwarz mehr
- warmer, hochwertiger Stil
- zusÃƒÆ’Ã‚Â¤tzlicher `Home`-Button zurÃƒÆ’Ã‚Â¼ck zur Startseite
- Formulartext oberhalb des Logins entfernt
- Submit-Button heiÃƒÆ’Ã…Â¸t nur noch `Anmelden`

---

## NÃƒÆ’Ã‚Â¤chster sinnvoller Fokus

Der aktuell beste nÃƒÆ’Ã‚Â¤chste Schritt ist:

### Verwalterbereich funktional ausbauen

Empfohlene Reihenfolge:

1. DatensÃƒÆ’Ã‚Â¤tze nicht nur anlegen, sondern auch bearbeiten und lÃƒÆ’Ã‚Â¶schen
2. Detailfelder fÃƒÆ’Ã‚Â¼r Personen, Firmen und Immobilien erweitern
3. Beziehungen und Zuordnungen sauber ausbauen
4. ÃƒÆ’Ã…â€œbersichten mit Suche / Filtern ergÃƒÆ’Ã‚Â¤nzen
5. spÃƒÆ’Ã‚Â¤tere VorgÃƒÆ’Ã‚Â¤nge vorbereiten:
   - Schadensmeldungen
   - ZÃƒÆ’Ã‚Â¤hlerstÃƒÆ’Ã‚Â¤nde
   - Dokumente
   - ZustÃƒÆ’Ã‚Â¤ndigkeiten

---

## App-Strategie

Empfohlener Workflow:

1. zuerst Webplattform sauber fertig bauen
2. Verwalterbereich und Mieterportal fachlich stabil machen
3. Datenmodell, Rechte und AblÃƒÆ’Ã‚Â¤ufe festziehen
4. danach iPhone- und Android-App auf dieselbe Logik und Datenbasis setzen

BegrÃƒÆ’Ã‚Â¼ndung:
- Die App sollte auf denselben Rollen, Daten und Prozessen aufbauen
- So vermeiden wir doppelte Entscheidungen und spÃƒÆ’Ã‚Â¤tere Umbauten

---

## Wichtige Dateien

- `app/page.tsx`
  ÃƒÆ’Ã¢â‚¬â€œffentliche Startseite

- `app/login/page.tsx`
  Verwalter-Login

- `app/impressum/page.tsx`
  Impressum

- `components/LoginForm.tsx`
  zentrales Loginformular

- `components/PublicShell.tsx`
  HÃƒÆ’Ã‚Â¼lle der ÃƒÆ’Ã‚Â¶ffentlichen Seiten

- `components/admin/AdminCollectionManager.tsx`
  Admin-Formulare und Listen

- `app/admin/page.tsx`
  Admin-Dashboard

- `app/admin/personen/page.tsx`
  Personenverwaltung

- `app/admin/immobilie/page.tsx`
  Immobilienverwaltung

- `app/admin/firma/page.tsx`
  Firmenverwaltung

- `app/admin/firma/[id]/page.tsx`
  Firmenansicht / Detailseite

- `app/admin/firma/[id]/bearbeiten/page.tsx`
  Firmenbearbeitung

- `components/admin/CompanyDetailView.tsx`
  Darstellung einer einzelnen Firma

- `components/admin/companyConfig.ts`
  zentrale Felddefinitionen fÃƒÆ’Ã‚Â¼r Firmen

- `lib/auth.ts`
  Rollenlogik und Zielbereiche

- `context/AuthContext.tsx`
  Client-seitiger Auth-/Rollenstatus

- `firestore.rules`
  Sicherheitsregeln fÃƒÆ’Ã‚Â¼r Firestore

---

## Kurzstatus

**Website:** vorzeigbar in Arbeit
**Auth:** funktionsfÃƒÆ’Ã‚Â¤hig
**Rollentrennung:** funktionsfÃƒÆ’Ã‚Â¤hig
**Verwalterbereich:** Grundstruktur vorhanden, Ausbau als nÃƒÆ’Ã‚Â¤chster Fokus
**Mieter-App:** noch nicht begonnen, bewusst nachgelagert

---

## Neuester Fachstand

### Nachrichten, E-Mail und Tickets

- Die bisherigen Platzhalterseiten `Nachrichten` und `Tickets` wurden als erste echte ArbeitsoberflÃƒÆ’Ã‚Â¤chen aufgebaut
- Neue Admin-Seiten:
  - `/admin/nachrichten`
  - `/admin/tickets`
- Die Mieterportal-Seite `/mieterportal/nachrichten` ist jetzt ebenfalls als echter Eingang an `messages` angebunden
- Mieter kÃƒÆ’Ã‚Â¶nnen dort:
  - frei schreiben
  - optional eine grobe Kategorie auswÃƒÆ’Ã‚Â¤hlen
  - ihre bisherigen Nachrichten im Portalverlauf sehen
- ZusÃƒÆ’Ã‚Â¤tzlich gibt es jetzt einen serverseitigen E-Mail-Eingang unter `/api/inbound-email`
- Feste EmpfÃƒÆ’Ã‚Â¤ngeradresse dafÃƒÆ’Ã‚Â¼r:
  - `portal@halbmann-holding.de`
- Der Endpoint ist dafÃƒÆ’Ã‚Â¼r gedacht, spÃƒÆ’Ã‚Â¤ter von einem Mailanbieter / Inbound-Webhook bedient zu werden
- ZusÃƒÆ’Ã‚Â¤tzlich gibt es jetzt einen serverseitigen IMAP-Sync unter `/api/inbound-email/sync`
- Der IONOS-Posteingang ist lokal vorbereitet ÃƒÆ’Ã‚Â¼ber:
  - `imap.ionos.de`
  - Port `993`
  - Benutzer `portal@halbmann-holding.de`
- Der Sync holt ungelesene Mails aus dem Postfach, parsed sie serverseitig und schreibt sie in `messages`
- Nach erfolgreichem Import werden die abgerufenen Mails im Postfach als gelesen markiert
- Der IMAP-Sync lÃƒÆ’Ã‚Â¤uft jetzt automatisch an, sobald ein Admin den geschÃƒÆ’Ã‚Â¼tzten Bereich ÃƒÆ’Ã‚Â¶ffnet
- Pro Admin-Session wird der automatische Sync nur einmal ausgelÃƒÆ’Ã‚Â¶st
- Es gibt jetzt zusÃƒÆ’Ã‚Â¤tzlich einen serverseitigen SMTP-Versand fÃƒÆ’Ã‚Â¼r vorbereitete EntwÃƒÆ’Ã‚Â¼rfe
- Neue Serverroute dafÃƒÆ’Ã‚Â¼r:
  - `/api/message-drafts/send`
- EntwÃƒÆ’Ã‚Â¼rfe kÃƒÆ’Ã‚Â¶nnen jetzt aus:
  - `Nachrichten`
  - `Tickets`
  direkt versendet werden
- Beim Versand passiert jetzt serverseitig:
  - SMTP-Versand ÃƒÆ’Ã‚Â¼ber den IONOS-Account
  - `messageDrafts.status = sent`
  - Versandzeit und SMTP-Message-ID werden gespeichert
  - ein ausgehender Nachrichten-Eintrag wird erzeugt
  - am Ticket wird ein `ticketEvent` fÃƒÆ’Ã‚Â¼r den Versand angelegt
- Eingehende E-Mails werden serverseitig in `messages` geschrieben und nach bekannter Absenderadresse direkt gegen `tenants` gematcht
- Wenn eine E-Mail nicht eindeutig einem Mieter zugeordnet werden kann, landet sie mit Status `needs_review` in der Admin-Inbox
- Neue Portal-Nachrichten werden direkt in `messages` gespeichert mit:
  - `channel = portal`
  - `direction = inbound`
  - `tenantId`
  - `propertyId`
  - `unitId`
- Firestore Rules erlauben Mietern jetzt:
  - Lesen des eigenen `tenant`-Datensatzes ÃƒÆ’Ã‚Â¼ber die eigene E-Mail
  - Lesen der eigenen `messages`
  - Anlegen eigener Portal-Nachrichten
  - Lesen eigener `tickets`
- `Nachrichten` enthÃƒÆ’Ã‚Â¤lt jetzt:
  - Inbox mit Statusfiltern
  - Originalnachricht
  - automatische Analyse
  - Zuordnungsvorschlag fÃƒÆ’Ã‚Â¼r Mieter, Objekt, Einheit und Gewerk
  - vorbereitete EntwÃƒÆ’Ã‚Â¼rfe
- `Tickets` enthÃƒÆ’Ã‚Â¤lt jetzt:
  - Ticketliste
  - Statuswechsel
  - verknÃƒÆ’Ã‚Â¼pfte Ursprungsnachricht
  - verknÃƒÆ’Ã‚Â¼pfte EntwÃƒÆ’Ã‚Â¼rfe
  - Timeline ÃƒÆ’Ã‚Â¼ber `ticketEvents`
- Neue Collections dafÃƒÆ’Ã‚Â¼r:
  - `messages`
  - `tickets`
  - `ticketEvents`
  - `messageDrafts`
  - `documentTemplates`
- Neue Hilfslogik in `lib/adminWorkflow.ts`:
  - Kategorisierung aus Betreff und Nachrichtentext
  - PrioritÃƒÆ’Ã‚Â¤tserkennung
  - Zuordnung ÃƒÆ’Ã‚Â¼ber bekannte Mieter, Objekte und Einheiten
  - Vorschlag passender Dienstleister ÃƒÆ’Ã‚Â¼ber Objekt-Zuordnungen
  - Entwurf fÃƒÆ’Ã‚Â¼r Antwort an Mieter
  - Entwurf fÃƒÆ’Ã‚Â¼r Nachricht an Handwerker / Dienstleister
- Neue Server-Hilfsdateien:
  - `lib/mailbox.ts`
  - `lib/firebaseAdmin.ts`
  - `lib/inboundEmailIngest.ts`
  - `lib/imapSync.ts`
  - `lib/smtp.ts`
- Firestore Rules wurden fÃƒÆ’Ã‚Â¼r diese neuen Collections erweitert
- Der Gesamt-Build ist mit diesem Stand grÃƒÆ’Ã‚Â¼n
- Die groÃƒÆ’Ã…Â¸en EinleitungsblÃƒÆ’Ã‚Â¶cke auf:
  - `Dashboard`
  - `Nachrichten`
  - `Tickets`
  wurden entfernt
- Titel und Beschreibung dieser Bereiche liegen jetzt im gemeinsamen Header des geschÃƒÆ’Ã‚Â¼tzten Layouts statt doppelt in den Seiten selbst
- Im Admin-Header gibt es jetzt ein globales EinstellungsmenÃƒÆ’Ã‚Â¼ ÃƒÆ’Ã‚Â¼ber ein Zahnrad
- Erste Einstellungsseite:
  - `/admin/einstellungen`
- Dort kann das globale Mail-Postfach jetzt gepflegt, deaktiviert oder komplett gelÃƒÆ’Ã‚Â¶scht werden:
  - E-Mail-Adresse
  - IMAP Host / Port / Benutzer / Passwort
  - SMTP Host / Port / Benutzer / Passwort
- Die Serverlogik fÃƒÆ’Ã‚Â¼r IMAP-Sync und SMTP-Versand liest die Mailbox-Konfiguration jetzt zuerst aus `adminSettings/mailbox`
- ENV-Werte bleiben als Fallback fÃƒÆ’Ã‚Â¼r die Entwicklung erhalten
- Neue Collection:
  - `adminSettings`
- Firestore Rules wurden dafÃƒÆ’Ã‚Â¼r auf Adminzugriff erweitert

NÃƒÆ’Ã‚Â¤chster sinnvoller Ausbau in diesem Bereich:

1. Firebase-Admin-Zugang lokal / auf dem Server vollstÃƒÆ’Ã‚Â¤ndig hinterlegen, damit die Serverrouten produktiv schreiben kÃƒÆ’Ã‚Â¶nnen
2. IMAP-Sync einmal gegen das echte IONOS-Postfach testen
3. Vorlagenbereich fÃƒÆ’Ã‚Â¼r Standardschreiben aufbauen
4. manuelle Korrektur der KI-Zuordnung in `Nachrichten` erweitern
5. AnhÃƒÆ’Ã‚Â¤nge und echte Antwortketten in Ein- und Ausgang ergÃƒÆ’Ã‚Â¤nzen

### Mieter

- Mieter werden ÃƒÆ’Ã‚Â¼ber bestehende freie Einheiten angelegt
- Die Warmmiete wird jetzt automatisch aus `Kaltmiete + Betriebskosten` gebildet
- Kaution hat jetzt die Arten:
  - `Barkaution`
  - `BankbÃƒÆ’Ã‚Â¼rgschaft`
- BÃƒÆ’Ã‚Â¼rge wird nicht mehr frei eingetippt, sondern aus der Personenliste gewÃƒÆ’Ã‚Â¤hlt
- DafÃƒÆ’Ã‚Â¼r gibt es bei `Dritte & Dienstleister` jetzt zusÃƒÆ’Ã‚Â¤tzlich die Kategorie `BÃƒÆ’Ã‚Â¼rge`
- MieterhÃƒÆ’Ã‚Â¶hung ist fachlich vorbereitet:
  - `Staffelmiete` mit wiederholbaren Zeilen
  - je Zeile: `von`, `bis`, `Kaltmiete`, `ErhÃƒÆ’Ã‚Â¶hung %`, `ErhÃƒÆ’Ã‚Â¶hung EUR`
  - Prozent und Euro rechnen sich gegenseitig
  - Erinnerungslogik:
    - Staffel: 1 Monat vor der nÃƒÆ’Ã‚Â¤chsten Staffel
    - Index: jÃƒÆ’Ã‚Â¤hrlich mit 1 Monat Puffer
    - Gesetz: alle 3 Jahre mit 1 Monat Puffer

### Immobilien

- Bei Immobilien gibt es jetzt einen eigenen Block `JÃƒÆ’Ã‚Â¤hrliche Wartungen`
- Dort stehen untereinander:
  - `Heizung`
  - `Dach`
  - `Regenrinnenreinigung`
- FÃƒÆ’Ã‚Â¼r alle Wartungen wird das letzte Wartungsdatum gepflegt
- Fachliche Zielrichtung: spÃƒÆ’Ã‚Â¤tere Ticket-Erinnerung nach 11 Monaten

### Formulare

- `Dritte & Dienstleister` haben jetzt ebenfalls Detail- und Bearbeitungsseiten
- `Immobilien` haben jetzt eine Bearbeitungsseite unter `/admin/immobilie/[id]/bearbeiten`
- `Mieter` haben jetzt eine Bearbeitungsseite unter `/admin/mieter/[id]/bearbeiten`
- `Ansehen / Bearbeiten / LÃƒÆ’Ã‚Â¶schen` ist jetzt ÃƒÆ’Ã‚Â¼bergreifend fÃƒÆ’Ã‚Â¼r Firmen, Immobilien, Mieter und Dritte & Dienstleister ausgebaut
- Beim LÃƒÆ’Ã‚Â¶schen eines Mieters wird die Zuordnung in der betroffenen Einheit wieder entfernt

- Das Immobilienformular startet jetzt ohne vorgelagerten Einleitungsblock direkt im Formular
- Die Umsatzsteuer im Mieterformular ist neutral als Regelung fÃƒÆ’Ã‚Â¼r die Nettomiete modelliert und nicht mehr falsch an die Warmmiete gekoppelt

### ZÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¤hler und Heizungen

- Immobilien zeigen jetzt eine kompakte ZÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¤hler-Tabelle mit `ZÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¤hler`, `ZÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¤hlernummer`, `Eichdatum` und `Position`
- Es gibt eine eigene ZÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¤hler-Detailseite mit Historie, neuen ZÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¤hlerstÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¤nden und dokumentiertem ZÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¤hlerwechsel
- ZÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¤hler haben im Formular jetzt zusÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¤tzlich das Feld `Position`
- Heizungen werden auf Objektebene jetzt pro Heizsystem mit eigener Wartung und eigenem Baujahr gepflegt
- Falls keine Zentralheizung vorhanden ist, kÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¶nnen Heizungen auch auf Einheitenebene gepflegt werden

### MenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼

- Im Admin-MenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼ gibt es jetzt zusÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¤tzlich die Bereiche `Nachrichten` und `Tickets` als vorbereitete Platzhalterseiten

### Admin-Einstellungen / Mailbox

- Im Admin-Header gibt es jetzt ein globales Zahnrad-MenÃƒÂ¼
- Darin gibt es eine Einstiegsseite fÃƒÂ¼r das globale E-Mail-Postfach unter `/admin/einstellungen`
- Die Mailbox-Konfiguration wird nicht mehr direkt aus dem Browser nach Firestore geschrieben, sondern ÃƒÂ¼ber die Serverroute `/api/admin/mailbox-settings`
- Dadurch sind Speichern und LÃƒÂ¶schen stabiler und nicht mehr von clientseitigen Firestore-Regeln abhÃƒÂ¤ngig
- Das LÃƒÂ¶schen setzt die Mailbox bewusst auf inaktiv und leer, damit nicht ungewollt eine alte Fallback-Konfiguration aktiv bleibt
- In den Passwortfeldern fÃƒÂ¼r IMAP und SMTP gibt es jetzt `Anzeigen` / `Verbergen`
- `npm run build` lÃƒÂ¤uft nach diesem Umbau grÃƒÂ¼n
- FÃƒÂ¼r `/admin/einstellungen` gibt es jetzt zusÃƒÂ¤tzlich einen lokalen Dev-Fallback ohne Firebase-Admin-Credentials
- Wenn lokal keine Admin-Creds gesetzt sind, speichert die Mailbox-Seite in `.mailbox-settings.local.json`
- Die Serverlogik fÃƒÂ¼r IMAP/SMTP liest diese lokale Mailbox-Datei vor dem ENV-Fallback
- Passwortfelder fÃƒÂ¼r IMAP und SMTP haben jetzt `Anzeigen` / `Verbergen`
- `npm run build` bleibt nach diesem Fallback grÃƒÂ¼n

### Nachrichten / Tickets Automatik

- Eingehende Nachrichten aus E-Mail und Mieterportal laufen jetzt in einen gemeinsamen Auto-Workflow
- Neue Server-Hilfe: `lib/workflowAutomation.ts`
- Aus einer eingehenden Nachricht werden jetzt automatisch vorbereitet:
  - Analyse / Zuordnung
  - Ticket
  - Antwortentwurf an den Absender
  - Entwurf fÃƒÂ¼r das passende Gewerk / den Dienstleister
- E-Mail-Import ruft den Auto-Workflow jetzt direkt nach dem Speichern der Nachricht auf
- Das Mieterportal schreibt Nachrichten nicht mehr direkt in Firestore, sondern ÃƒÂ¼ber `/api/portal/messages`
- Auch Portal-Nachrichten bekommen dadurch sofort Ticket und EntwÃƒÂ¼rfe
- Neue Route: `/api/portal/messages`
- `npm run build` lÃƒÂ¤uft nach diesem Ausbau grÃƒÂ¼n
- Firestore-Regeln wurden jetzt live nach `halbmann-app` deployt (`firebase deploy --only firestore:rules --project halbmann-app`)
- Dadurch sollten die Permission-Denied-Fehler in `Nachrichten`, `Tickets`, `messageDrafts` und `ticketEvents` im Browser verschwinden
- Der automatische IMAP-Sync im Admin-Layout sendet jetzt den eingeloggten Token mit
- Wenn lokal kein Firebase-Admin vorhanden ist, liefert der IMAP-Sync die eingegangenen Mails an den Browser zurÃƒÂ¼ck und der Admin-Client schreibt sie selbst in Firestore
- Dashboard, Nachrichten und Tickets fangen Firestore-Lesefehler jetzt sauber ab, statt die Dev-Overlay-Fehler hochzuschaukeln
- `npm run build` lÃƒÂ¤uft nach diesem Umbau grÃƒÂ¼n
- Die Firestore-Regeln wurden live nach `halbmann-app` deployt, damit Admin-Listener auf `messages`, `tickets`, `messageDrafts` und `ticketEvents` nicht mehr mit `permission-denied` abbrechen
- Der Adminbereich crasht bei Listener-Fehlern jetzt nicht mehr in die Dev-Overlay-Spirale
- Der automatische Mail-Sync lÃƒÂ¤uft nicht mehr nur einmal pro Session, sondern beim Einstieg und danach alle 30 Sekunden erneut
- Wenn kein Firebase-Admin konfiguriert ist, holt der Server die E-Mails per IMAP und der Admin-Client importiert sie anschlieÃƒÅ¸end selbst in Firestore
- Damit ist der lokale Entwicklungsmodus fÃƒÂ¼r echten E-Mail-Eingang ohne Service-Account vorbereitet
- `npm run build` lÃƒÂ¤uft nach diesem Umbau grÃƒÂ¼n
- Im lokalen Dev-Modus markiert der IMAP-Sync Mails nicht mehr vorschnell als `gesehen`
- Stattdessen werden die letzten bis zu 20 Mails regelmÃƒÂ¤ÃƒÅ¸ig erneut geprÃƒÂ¼ft und ÃƒÂ¼ber `messageId` dedupliziert importiert
- So kÃƒÂ¶nnen zuvor verpasste oder bereits einmal gesehene Testmails im lokalen Workflow trotzdem noch in `messages` auftauchen
- `npm run build` lÃƒÂ¤uft nach dieser Ãƒâ€žnderung grÃƒÂ¼n

### Update 03.04.2026

- Der Entwurfsversand ueber `/api/message-drafts/send` hat jetzt auch ohne lokale Firebase-Admin-Credentials einen REST-Fallback ueber den eingeloggten Admin-Token.
- Neue Portal- und E-Mail-Nachrichten erzeugen nicht mehr automatisch Tickets. Sie werden nur noch analysiert und als `new` oder `needs_review` einsortiert.
- `Nachrichten` wurde als Kommunikationszentrale neu aufgebaut:
  - linke Inbox mit Statusfiltern und Suche
  - Mitte als Verlauf fuer Nachricht, spaetere Antworten und interne Notizen
  - rechte Spalte fuer Zuordnung, Ticket-Erstellung, Erledigt/Loeschen und Entwurfsbearbeitung
- Der Analyse-Block ist aus der Oberflaeche entfernt.
- Neue Collection: `messageEvents` fuer manuelle Verlaufsnotizen und Nachrichten-Historie.
- Aus `Nachrichten` kann jetzt manuell:
  - ein Ticket erstellt werden
  - die Zuordnung angepasst werden
  - eine Nachricht erledigt markiert werden
  - eine Nachricht weich geloescht werden
  - eine manuelle Verlaufsnotiz ergaenzt werden
  - ein Antwortentwurf, Dienstleisterentwurf oder leerer Entwurf erstellt werden
- Dienstleister-Entwuerfe enthalten jetzt die Kontaktangaben des Mieters, soweit vorhanden.
- Standard-Signaturen in den Entwuerfen wurden auf `Halbmann Holding / Vermoegensverwaltung GmbH / portal@halbmann-holding.de` vereinheitlicht.
- `Tickets` wurde klarer auf Aufgaben fokussiert:
  - Tabs `Offen`, `Erledigt`, `Alle`
  - manuelle Ticketanlage
  - Statuswechsel
  - Timeline / Notizen
  - verknuepfte Nachrichten
  - verknuepfte Entwuerfe
- Firestore Rules wurden danach erneut live nach `halbmann-app` deployt.
- `npm run build` ist nach dem Umbau weiter gruen.

### Update 03.04.2026 - Nachrichtenlayout neu

- Die Seite `/admin/nachrichten` wurde bewusst von der bisherigen Kartenlogik auf ein Mailfenster-Modell umgebaut.
- Neues Grundprinzip: 3 Spalten wie bei einer klassischen Mail-App.
  - links: Ordner / Bereiche
  - mitte: Listenansicht
  - rechts: Arbeitsbereich zur ausgewaehlten Nachricht oder zum ausgewaehlten Entwurf
- Linke Ordner aktuell:
  - Posteingang
  - Mail senden
  - Entwuerfe
  - Gesendet
  - Notizen
- `Posteingang` zeigt Nachrichten jetzt kompakt einzeilig in der mittleren Liste statt als grosse Arbeitskarten.
- Klick auf eine Nachricht oeffnet rechts den Inhalt, den Verlauf und darunter den Bereich fuer schnelle Antwort, Ticket-Erstellung, Dienstleister-Entwurf und Loeschen.
- `Mail senden` arbeitet jetzt mit 2 Arbeitsstufen innerhalb des 3-Spalten-Layouts:
  - links Bereichsauswahl
  - mitte Empfaengergruppe
  - rechts Composer
- In `Mail senden` sind aktuell vorgesehen:
  - einzelne Empfaenger
  - alle Mieter eines Objekts
  - alle Mieter einer Firma
  - alle Mieter
- `Entwuerfe` hat jetzt eine eigene Listenansicht in der Mitte und einen Editor rechts.
- `Gesendet` nutzt dasselbe Listen-/Detailprinzip wie der Posteingang, aber fuer ausgehende Nachrichten.
- `Notizen` ist als eigener Bereich fuer manuelle Verlaufsnotizen getrennt sichtbar.
- Der Schwerpunkt in `Nachrichten` liegt jetzt klar auf Kommunikation statt auf Analyse- oder Zuordnungsboxen.
- `npm run build` ist nach diesem Umbau gruen.

[2026-04-03T11:14:30+02:00] Nachrichten neu strukturiert: /admin/nachrichten zeigt jetzt oben eine horizontale Reiterzeile und darunter im Posteingang nur noch eine kompakte Listenansicht. Die eigentliche Bearbeitung liegt jetzt auf /admin/nachrichten/[messageId] mit zentralem Chatverlauf, Aktionen fuer Ticket/Loeschen sowie Antwort und Entwurfsbearbeitung.

[2026-04-03T11:36:16+02:00] Nachrichten und Bestand weiter verfeinert: Auf /admin/nachrichten bleibt der Posteingang als reine Listenansicht. In Mail senden gibt es fuer einzelne Empfaenger jetzt Immobilie -> Mieter plus manuelle E-Mail sowie Vorlagenwahl aus documentTemplates. Die Nachrichtendetailseite zeigt die Zuordnung kompakt oben, Chat zentral, direkte Antwort mit Vorlagenwahl darunter; das separate Entwurfsfeld wurde entfernt. Auf der Immobilien-Detailseite gibt es neben der Zaehleruebersicht jetzt einen direkten Dienstleisterblock mit speicherbaren Zuweisungen pro Gewerk.

## Update 2026-04-03
- `Nachrichten` wurde weiter vereinfacht: sichtbare EntwÃƒÂ¼rfe sind aus dem UI entfernt, `Posteingang` zeigt nur offene eingehende Nachrichten, `ticket_created` und `done` verschwinden aus der Inbox.
- `Mail senden` wurde neu gewichtet: EmpfÃƒÂ¤ngerbereich schmaler, Editor grÃƒÂ¶ÃƒÅ¸er, bei `Einzelne EmpfÃƒÂ¤nger` jetzt Auswahl `Immobilie -> Mieter` plus manuelle E-Mail und Vorlagenwahl.
- Nachrichtendetail wurde gestrafft: kompakte Zuordnungsinfos oben, kein separates Zuordnungsfeld mehr, keine Buttons fÃƒÂ¼r Antwortentwurf/Dienstleister/LÃƒÂ¶schen mehr. Stattdessen direkter Antwortbereich mit Vorlagenwahl, `Ticket erstellen` und `Als erledigt markieren` bzw. RÃƒÂ¼ckgÃƒÂ¤ngig.
- `Bestand > Mieter` zeigt jetzt zusÃƒÂ¤tzlich den Nachrichten- bzw. Chatverlauf des Mieters mit Link in die jeweilige Nachricht.
- Globale Einstellungen wurden erweitert: `/admin/einstellungen` hat jetzt Reiter fÃƒÂ¼r `E-Mail-Postfach` und `Signaturen`; im Zahnrad-MenÃƒÂ¼ im Admin-Header gibt es jetzt auch den Link `Signaturen`.
- Signaturen bleiben pro Firma pflegbar, inklusive Logo-Upload ÃƒÂ¼ber Firebase Storage.
- `Tickets` zeigt keine sichtbaren EntwurfsblÃƒÂ¶cke mehr.
- Verifiziert mit `npm run build` in `C:\Users\simon\Documents\halbmann-app`.
- Signaturen erweitert: neues Feld `Name` oberhalb des Firmennamens, Feld `Rollenzeile` inhaltlich durch `Mobilfunk` ersetzt. Logo-Upload speichert jetzt direkt; wenn Firebase Storage im Projekt noch nicht eingerichtet ist, wird als lokaler Fallback ein eingebettetes Bild gespeichert und ein klarer Hinweis angezeigt.
- `Mail senden` wurde weiter verschoben: EmpfÃƒÂ¤ngerbereich schmaler, Editor breiter.
- `Tickets` wurde neu geordnet: keine zusammenfallenden schmalen Spalten mehr, klare Zweiteilung aus Liste und Detail, Ticket-LÃƒÂ¶schen ergÃƒÂ¤nzt.
- `storage.rules` und `firebase.json` um Storage-Regeln ergÃƒÂ¤nzt. Beim Deploy zeigte sich: Firebase Storage ist im Projekt `halbmann-app` noch nicht initialisiert. FÃƒÂ¼r echtes Bucket-Hosting muss Storage in der Firebase-Konsole einmal aktiviert werden.
- Verifiziert mit `npm run build`.

## Update 2026-04-03 Ã¢â‚¬â€œ Signaturen, Mail senden und Tickets
- Signaturen wurden fachlich erweitert: pro Firma jetzt mit `Name`, `Firmenname`, `StraÃƒÅ¸e`, `Hausnummer`, `PLZ`, `Ort`, `Mobilfunk`, `Telefon`, `E-Mail`, `Website` und Logo.
- Die Signaturfelder werden jetzt aus vorhandenen Firmendaten vorausgefÃƒÂ¼llt und bleiben anschlieÃƒÅ¸end manuell anpassbar.
- Die Signaturvorschau wurde optisch gestrafft: Name ÃƒÂ¼ber Firmenname, Anschrift integriert, Kontaktblock kleiner und enger gesetzt.
- Der bisher hÃƒÂ¤ngende Logo-Upload wurde von Firebase Storage entkoppelt und lÃƒÂ¤uft jetzt lokal ÃƒÂ¼ber `/api/admin/signature-logo` direkt in `public/uploads/signatures`.
- `Mail senden` nutzt jetzt die gewÃƒÂ¤hlte Firmen-/Mieter-Zuordnung fÃƒÂ¼r die Signatur automatisch mit.
- Bei Einzelversand wird die passende Signatur direkt in den Editor eingesetzt.
- Beim Sammelversand an mehrere Mieter wird die Signatur pro EmpfÃƒÂ¤nger anhand der zugehÃƒÂ¶rigen Firma erzeugt.
- Das EmpfÃƒÂ¤ngerfeld in `Mail senden` wurde weiter verkleinert, der Editorbereich entsprechend vergrÃƒÂ¶ÃƒÅ¸ert.
- Eine Nachricht kann jetzt mehrere Tickets erzeugen; dafÃƒÂ¼r werden zusÃƒÂ¤tzliche Ticket-IDs an der Nachricht mitgefÃƒÂ¼hrt.
- `Tickets` wurde auf dieselbe Arbeitslogik wie `Nachrichten` umgestellt:
  - `/admin/tickets` ist jetzt reine Listenansicht mit einer Zeile pro Ticket
  - Klick auf ein Ticket ÃƒÂ¶ffnet `/admin/tickets/[ticketId]`
- Die neue Ticket-Detailseite enthÃƒÂ¤lt jetzt:
  - Verlauf aus verknÃƒÂ¼pften Nachrichten und Ticket-Events
  - manuellen Verlaufsblock
  - Mieter kontaktieren
  - Gewerk kontaktieren
  - Gewerk-Vorschlag aus der App, aber mit freier Auswahl aus allen hinterlegten Gewerken
  - Statuswechsel und Ticket-LÃƒÂ¶schen
- Antwort- und Dienstleistertexte bauen Signaturen jetzt nicht mehr hart selbst, sondern bekommen sie aus der Firmen-Signaturlogik.
- Verifiziert mit `npm run build` in `C:\Users\simon\Documents\halbmann-app`.

## Update 2026-04-03 Ã¢â‚¬â€œ Ticket-Detailseite und professionelle Signaturen
- Die Ticket-Detailseite wurde erneut neu geordnet und stÃƒÂ¤rker an einen echten Arbeitschat angelehnt.
- Oben steht jetzt nur noch der Ticketkopf mit Ticketnummer sowie Firma, Objekt, Einheit und Mieter in einer kompakten Zeile.
- Der frÃƒÂ¼here breite Info-Block unter dem Ticketkopf wurde entfernt.
- Der Status wird jetzt primÃƒÂ¤r ÃƒÂ¼ber hervorgehobene Status-Buttons gesteuert statt ÃƒÂ¼ber einen separaten Statusblock.
- Tickets haben jetzt zusÃƒÂ¤tzlich eine echte Wiedervorlage ÃƒÂ¼ber `followUpDate`.
- Der Verlauf auf der Ticketseite fÃƒÂ¼hrt jetzt alles zusammen:
  - Nachricht vom Mieter
  - Antworten an den Mieter
  - Nachrichten an Gewerke
  - interne Notizen
  - sonstige Ticket-Events
- Diese VerlaufseintrÃƒÂ¤ge sind farblich und inhaltlich voneinander getrennt, damit klar bleibt, was Mieterchat ist und was interner bzw. Gewerk-Verlauf.
- Die ursprÃƒÂ¼ngliche Nachricht des Mieters steht jetzt nicht mehr separat als freier Textblock im Kopf, sondern im eigentlichen Verlauf.
- Das bisher getrennte Feld `Mieter kontaktieren`, das Feld `Gewerk kontaktieren` und das Feld `Verlauf manuell ergÃƒÂ¤nzen` wurden in einen gemeinsamen Eingabebereich ÃƒÂ¼berfÃƒÂ¼hrt.
- Dort kann jetzt zwischen drei Modi gewechselt werden:
  - `Mieter`
  - `Gewerk`
  - `Notiz`
- FÃƒÂ¼r `Gewerk` gibt es eine Auswahl aller hinterlegten Gewerke am Objekt; der von der App erkannte Vorschlag wird vorausgewÃƒÂ¤hlt.
- Nachrichten an den Mieter werden weiter als regulÃƒÂ¤re ausgehende Nachrichten gespeichert und erscheinen dadurch sowohl im Ticketverlauf als auch im Nachrichtenverlauf des Mieters.
- Nachrichten an Gewerke werden ebenfalls aus dem Ticket verschickt, sind aber im Verlauf als eigener Typ gekennzeichnet.
- Tickets bleiben lÃƒÂ¶schbar.
- Signaturen wurden fachlich deutlich erweitert:
  - zusÃƒÂ¤tzlich zu Name, Firma, Anschrift, Mobilfunk, Telefon, E-Mail und Website jetzt auch Rechtsform, Abteilung/Zusatz, Registergericht, Handelsregister, Steuernummer und USt-IdNr.
- Diese Signaturfelder werden beim Ãƒâ€“ffnen einer Firma aus vorhandenen Firmendaten vorausgefÃƒÂ¼llt.
- Die Signaturvorschau wurde gestalterisch verfeinert:
  - Logo grÃƒÂ¶ÃƒÅ¸er
  - Name ÃƒÂ¼ber Firmenname
  - Kontaktblock kleiner und enger
  - Anschrift und Pflichtangaben eingebunden
- Der Logo-Upload lÃƒÂ¤uft weiter lokal ÃƒÂ¼ber `/api/admin/signature-logo` und legt Dateien in `public/uploads/signatures` ab.
- Der Versandpfad schreibt jetzt bei ausgehenden Nachrichten zusÃƒÂ¤tzlich `draftKind`, `recipientType` und `recipientId` mit, damit Ticket- und NachrichtenverlÃƒÂ¤ufe sauber unterscheiden kÃƒÂ¶nnen, ob eine Nachricht an Mieter oder Gewerk ging.
- Verifiziert mit `npm run build` in `C:\Users\simon\Documents\halbmann-app`.

## Update 2026-04-03 21:05
- Ticket-Detailseite in components/admin/TicketDetailWorkspace.tsx stark verdichtet und auf echten Chatfokus umgebaut.
- Ticketkopf jetzt kompakt: TK-... plus Firma, Objekt, Einheit, Mieter in einer Zeile ohne Kartenhintergrund.
- Wiedervorlage sitzt jetzt direkt bei den Status-/LÃƒÂ¶sch-Buttons im Kopf.
- Timeline zeigt nur noch Mieter-Nachrichten, Gewerk-Nachrichten und manuelle Notizen; doppelte System-/Vorgangsboxen werden im Ticket nicht mehr angezeigt.
- Einheit wird lesbar aufgelÃƒÂ¶st statt UUID-Fallback, bevorzugt aus 	enant.unitLabel bzw. property.units mit kompakter Floor/Positionslogik.
- Composer im Ticket vereinheitlicht: Modi Mieter, Gewerk, Notiz; Eingabe wird nach Senden/Speichern geleert.
- Portal-/Mietertext nutzt kleine Portal-Signatur, E-Mail-Version nutzt volle Firmensignatur.
- Signaturen erweitert: zusÃƒÂ¤tzliche Felder Sitz der Gesellschaft und GeschÃƒÂ¤ftsfÃƒÂ¼hrung in lib/signatures.ts und components/admin/AdminSignatureSettings.tsx.
- Signaturvorschau dichter gestaltet, Kontaktdaten kleiner gesetzt, Logo in der Vorschau deutlich grÃƒÂ¶ÃƒÅ¸er.
-
pm run build lÃƒÂ¤uft grÃƒÂ¼n.

## Update 2026-04-03 21:28
- Ticket-Detailseite erneut verdichtet und funktional angepasst.
- Ticketkopf jetzt mit editierbarem Titel, kompakter Metazeile (Firma, Objekt, Einheit, Mieter) und nur noch Status In Bearbeitung / Erledigt plus Ticket lÃƒÂ¶schen und Wiedervorlage.
- Ticket lÃƒÂ¶schen fragt jetzt per BestÃƒÂ¤tigungsdialog nach und leitet danach zur Ticketliste zurÃƒÂ¼ck.
- Composer im Ticket steht jetzt ÃƒÂ¼ber dem Verlauf; Verlauf sortiert neueste Nachricht zuerst.
- Tenant-/Gewerk-Nachrichten und Notizen laufen im Verlauf mit klar unterschiedlichen Karten; doppelte System-VorgÃƒÂ¤nge bleiben ausgeblendet.
- AntwortentwÃƒÂ¼rfe an Mieter verwenden jetzt bevorzugt den erkannten Mieter statt romName.
- Gewerk-Composer nutzt im Editor die kleine Signatur; E-Mail-Versand erhÃƒÂ¤lt zusÃƒÂ¤tzlich HTML mit kompaktem Signaturblock plus Footer.
- Signaturen erweitert um Sitz der Gesellschaft und GeschÃƒÂ¤ftsfÃƒÂ¼hrung; Vorschau dichter und Logo grÃƒÂ¶ÃƒÅ¸er.
- pp/api/message-drafts/send/route.ts akzeptiert jetzt optional htmlBody.
-
pm run build lÃƒÂ¤uft grÃƒÂ¼n.

## Update 2026-04-03 21:46
- Ticket-Composer weiter korrigiert: Mieteransprache priorisiert erkannte Tenant-Daten, nicht mehr romName.
- Gewerk-EntwÃƒÂ¼rfe nutzen jetzt einen stabileren EmpfÃƒÂ¤ngernamen-Fallback (Person, Firma oder E-Mail), damit nicht nur Guten Tag, erscheint.
- Ticket-Textarea setzt jetzt lang=de und spellCheck=false, damit die rote Browser-Unterstreichung im Editor verschwindet.
- HTML-Mail-Signatur im Versandpfad optisch verbessert: oberer Signaturblock kompakt, restliche Pflichtangaben zentriert in mehreren Spalten statt als lange EinzelsÃƒÂ¤ule.
-
pm run build bleibt grÃƒÂ¼n.

## Update 2026-04-04 00:06
- OpenAI-Anbindung fÃƒÂ¼r individuelle Ticket-Antworten vorbereitet.
- Neue Serverroute: pp/api/ai/ticket-draft/route.ts.
- Nutzt OpenAI Responses API ÃƒÂ¼ber das offizielle openai SDK.
- Ticket-Composer hat jetzt einen Button KI-Entwurf fÃƒÂ¼r die Modi Mieter und Gewerk; Notiz bleibt manuell.
- KI bekommt Tickettitel, Objekt, Einheit, Mieter, Gewerk und Originalnachricht und erzeugt daraus einen fallbezogenen Text statt starrer Vorlagen.
- Die erzeugten Texte landen direkt im Composer und werden dort noch manuell angepasst/freigegeben.
- FÃƒÂ¼r produktive Nutzung muss OPENAI_API_KEY in .env.local gesetzt sein; optional OPENAI_MODEL (Fallback aktuell gpt-5-mini).
-
pm run build lÃƒÂ¤uft grÃƒÂ¼n.
[2026-04-04T10:35:00+02:00] KI- und Kommunikations-Feinschliff weitergezogen: Im globalen Zahnrad-MenÃƒÂ¼ gibt es jetzt einen direkten Link zu /admin/einstellungen?tab=ki. FÃƒÂ¼r Mehrfach-Themen in einer Eingangsnachricht existiert nun /api/ai/message-ticket-suggestions; die Nachrichtendetailseite nutzt lokale Fallback-VorschlÃƒÂ¤ge plus KI-TitelvorschlÃƒÂ¤ge, zeigt sie als auswÃƒÂ¤hlbare Chips und speichert beim Ticket-Anlegen zusÃƒÂ¤tzlich issueFocus. Ticket-KI liest jetzt diesen issueFocus statt pauschal die gesamte Ursprungsnachricht. In Nachrichten-Details wurden Ticket-Hinweis, KI-Titel/Anwenden sowie grÃƒÂ¶ÃƒÅ¸ere Chat-/Antwort-/NotizflÃƒÂ¤chen ergÃƒÂ¤nzt. In Tickets wurden Composer und Verlauf deutlich vergrÃƒÂ¶ÃƒÅ¸ert und beim KI-Hinweis ein zusÃƒÂ¤tzlicher Anwenden-Button ergÃƒÂ¤nzt. Im Mieterbereich wurde der Chatverlauf auf ein nachrichtenÃƒÂ¤hnliches Muster erweitert: eigener Composer mit KI-Entwurf, grÃƒÂ¶ÃƒÅ¸ere EingabeflÃƒÂ¤che, Scrollbereich fÃƒÂ¼r den Verlauf und direkte Antworten an genau diesen Mieter. Mail senden in Nachrichten wurde weiter vergrÃƒÂ¶ÃƒÅ¸ert. Build ist grÃƒÂ¼n.

## Update 2026-04-04 12:03
- Nachrichten: Posteingang zeigt keine EndlÃƒÂ¶schung mehr. Alte Nachrichten bietet jetzt EndgÃƒÂ¼ltig lÃƒÂ¶schen nur dort an.
- Tickets: Filter GelÃƒÂ¶scht bleibt aktiv. Soft-Delete lÃƒÂ¤uft ÃƒÂ¼ber Ticketstatus deleted, endgÃƒÂ¼ltige LÃƒÂ¶schung nur in der GelÃƒÂ¶scht-Ansicht.
- Dritte & Dienstleister: Chatbereich in PersonDetailView ist aktiv. Ausgehende Gewerk-Nachrichten aus Tickets landen ÃƒÂ¼ber messages.recipientType = contact und
ecipientId im Kontakt-Chat, wÃƒÂ¤hrend sie im Ticketverlauf weiterhin sichtbar bleiben.
- Encoding-SchÃƒÂ¤den in den zuletzt bearbeiteten Admin-Dateien bereinigt;
pm run build ist wieder grÃƒÂ¼n.

## Update 2026-04-04 12:42
- Tickets: Composer fÃƒÂ¼llt sich nicht mehr automatisch bei Mieter/Gewerk. Inhalt entsteht erst durch Freitext oder KI-Entwurf.
- Ticket-KI: Promptlogik auf Revision umgestellt. ZusÃƒÂ¤tzliche Anweisung ÃƒÂ¼berschreibt Standardformulierungen, bestehender Entwurf wird gezielt ÃƒÂ¼berarbeitet.
- Nachrichten > Mail senden: lÃƒÂ¤dt Absenderadresse aus den Mailbox-Einstellungen, zeigt sie im Formular an und gibt sie an die KI mit.
- Nachrichten > Mail senden: ZÃƒÂ¤hlerauswahl fÃƒÂ¼r den gewÃƒÂ¤hlten Mieter / das gewÃƒÂ¤hlte Objekt ergÃƒÂ¤nzt; ausgewÃƒÂ¤hlte ZÃƒÂ¤hler gehen in den KI-Entwurf ein.
- Nachrichten > Mail senden: KI-Hinweis hat jetzt sichtbaren Anwenden-Button.
- Mieter und Dritte & Dienstleister: KI-Hinweis + Anwenden im Chatbereich ergÃƒÂ¤nzt.
- Mail-Footer: kompakter auf maximal drei zentrierte Zeilen reduziert.
- message-drafts/send: nutzt fÃƒÂ¼r gespeicherte ausgehende Nachrichten jetzt die konfigurierte Mailbox-Adresse als romEmail statt hartem Fallback.
-
pm run build ist grÃƒÂ¼n.
[2026-04-04T11:34:00+02:00] UI/Workflow-Runde: TicketDetailWorkspace komplett neu aufgebaut (eigener Verlauf je Ticket plus gemeinsame Ursprungsnachricht, KI-Hinweis/Anwenden/Entwurf jetzt ÃƒÂ¼ber dem Texteingabefeld, Composer leer bei Moduswechsel, Wiedervorlage/Status/Delete oben kompakt). TenantDetailView und PersonDetailView neu aufgebaut, Chatbereich jetzt ganz oben vor den Stammdaten. MessagesWorkspace: manuelle ZÃƒÂ¤hlerauswahl entfernt, stattdessen automatische ZÃƒÂ¤hlerÃƒÂ¼bergabe an die KI bei passenden Betreffen; permanentes LÃƒÂ¶schen alter Nachrichten schreibt jetzt Tombstones in deletedMessages. Mailbox-Einstellungen um mailHeaderText erweitert; ausgehende E-Mails erhalten jetzt einen gestalteten Header-Banner aus den Mail-Einstellungen. KI-Routen ticket-draft, message-draft, message-reply-draft vollstÃƒÂ¤ndig in sauberem UTF-8 ersetzt und auf strengere Einzelthemen-/Anweisungslogik umgestellt. Firestore-Regeln erweitert um deletedMessages und live nach halbmann-app deployt. npm run build grÃƒÂ¼n.

[2026-04-04T14:10:00+02:00] Chat-/Mail-Logik erneut gehÃƒÂ¤rtet: Mail-Import nutzt jetzt zusÃƒÂ¤tzlich externalMessageKey (lib/mailIdentity.ts) fÃƒÂ¼r Dedupe/Tombstones, sowohl serverseitig in lib/inboundEmailIngest.ts als auch im Client-Fallback in lib/clientWorkflow.ts. Alte, endgÃƒÂ¼ltig gelÃƒÂ¶schte Mails sollen dadurch nicht mehr wieder erscheinen, selbst wenn Message-IDs fehlen oder variieren. Outbound-Mails werden in app/api/message-drafts/send/route.ts jetzt immer als messages-Dokument gespeichert, auch ohne related messageId, und ÃƒÂ¼bernehmen tenantId/propertyId/unitId/recipientType sauber aus dem Draft. Dadurch sollen ausgehende Nachrichten aus Mail senden kÃƒÂ¼nftig auch im Mieter-/Dienstleister-Chat auftauchen. Der Sendepfad nutzt jetzt Signaturdaten aus dem Draft und baut HTML-Footer zentraler ÃƒÂ¼ber lib/signatures.ts. KI-Routen message-reply-draft, message-draft und ticket-draft wurden erneut in sauberem UTF-8 ÃƒÂ¼berarbeitet und um klaren Kontextmodus Neue Nachricht vs. Antwort auf Verlauf erweitert. TenantDetailView, PersonDetailView, TicketDetailWorkspace und MessageDetailWorkspace ÃƒÂ¼bergeben diesen Modus jetzt an die KI bzw. setzen ihn im UI sichtbar. MessageDetailWorkspace wurde funktional aufgerÃƒÂ¤umt: direkte Antwort steht jetzt ÃƒÂ¼ber dem Verlauf, Ticket-KI-Hinweis und KI-Titel-Button sind entfernt, stattdessen bleiben nur noch Vorschlags-Chips fÃƒÂ¼r Mehrfachthemen-Tickets. TicketDetailWorkspace setzt Composer-Zustand beim Ticketwechsel zurÃƒÂ¼ck, damit Inhalte nicht ins nÃƒÂ¤chste Ticket mitwandern. PersonDetailView nutzt jetzt ebenfalls Firmen-Signaturdaten beim Versand. npm run build grÃƒÂ¼n.
[2026-04-04T15:55:00+02:00] Navigation/Signatur/Composer weiter bereinigt: In ProtectedAreaLayout wird der aktive Link jetzt als lÃƒÂ¤ngster passender Treffer bestimmt, damit links nur noch genau eine Seite markiert bleibt. Neue Hilfslogik in lib/draftComposer.ts setzt BegrÃƒÂ¼ÃƒÅ¸ung und Portal-Signatur systemseitig, strippt KI-BegrÃƒÂ¼ÃƒÅ¸ung/Abschluss aus Antworten heraus und verhindert damit falsche Anreden oder EmpfÃƒÂ¤nger-Signaturen in TenantDetailView, PersonDetailView, TicketDetailWorkspace, MessageDetailWorkspace und MessagesWorkspace. lib/signatures.ts vollstÃƒÂ¤ndig in sauberes UTF-8 ersetzt; E-Mail-Signatur besteht nun aus kurzem Abschlussblock (Mit freundlichen GrÃƒÂ¼ÃƒÅ¸en / Name / Firma) plus kompaktem, zentriertem Footer mit bis zu drei Zeilen und absolut aufgelÃƒÂ¶stem Logo. app/api/message-drafts/send/route.ts ebenfalls in sauberem UTF-8 ersetzt und an die neue Abschluss-/Footer-Logik angepasst. buildTenantContact in lib/adminWorkflow.ts leitet Anreden nun zusÃƒÂ¤tzlich aus anrede/gender ab. MessagesWorkspace zeigt Wiedervorlage jetzt nicht mehr nur im Einzelmodus, sondern ÃƒÂ¼berall dort, wo EmpfÃƒÂ¤nger ausgewÃƒÂ¤hlt sind. npm run build grÃƒÂ¼n.

[2026-04-04T16:35:00+02:00] Mail-/Ticket-Runde weiter bereinigt: draftComposer priorisiert jetzt eine im Kontext gefundene Anrede (z. B. Frau Tran) vor fehlerhaften Stammdaten-Anreden. app/api/ai/ticket-draft/route.ts wurde auf strikteren Einzelticket-Fokus gehÃƒÂ¤rtet: andere Maengel aus derselben Ursprungsmail sollen explizit ignoriert werden, und Nutzerkorrekturen muessen Vorrang haben. AdminMailboxSettings wurde komplett in sauberes UTF-8 ersetzt und erlaubt jetzt getrennte Bearbeitung von Mail-Header und Mail-Footer mit benutzerfreundlichen Formatoptionen (Schriftart, Schriftgroesse, Ausrichtung, Fett, Kursiv, Unterstreichen, Trennlinie) neben den IMAP/SMTP-Daten. MailboxSettings/LocalConfig/ServerConfig/API wurden um diese Header-/Footer-Felder erweitert. app/api/message-drafts/send/route.ts rendert Header und Footer nun mit den gespeicherten Stiloptionen. Build ist gruen.

[2026-04-04T16:55:00+02:00] Navigations-/Ticket-/Settings-Runde: ProtectedAreaLayout weiter verdichtet (Bestand-Block optisch neutraler, Sidebar-Logo grÃƒÂ¶ÃƒÅ¸er). TicketsWorkspace nach oben gezogen, Filterbuttons und manueller Ticketbutton kompakter. TicketDetailWorkspace weiter nach oben gezogen; ZurÃƒÂ¼ck-Link sitzt jetzt links oben im Content, Ticketkopf dichter in einer Zeile mit TK/Firma/Objekt/Einheit/Mieter. Einstellungen umgebaut: Tab Postfach heiÃƒÅ¸t nun Postfach-Zugang und zeigt nur noch Zugangsdaten; unter Signaturen werden jetzt AdminSignatureSettings plus die vollstÃƒÂ¤ndige Header-/Footer-Steuerung aus AdminMailboxSettings angezeigt. Mailbox-Einstellungen unterstÃƒÂ¼tzen getrennte Header-/Footer-Formatierung (Schriftart, SchriftgrÃƒÂ¶ÃƒÅ¸e, Ausrichtung, Fett, Kursiv, Unterstreichen, Trennlinie) serverseitig und lokal. buildIssueSuggestionsFromText in lib/adminWorkflow.ts ergÃƒÂ¤nzt bekannte ProblemvorschlÃƒÂ¤ge priorisiert (u.a. Verstopfung in KÃƒÂ¼che, Tropfende Toilette, Mangelhafte Treppenhausreinigung), damit Tickettitel aus Mehrfach-Nachrichten brauchbarer vorgeschlagen werden. npm run build grÃƒÂ¼n.

## Update 2026-04-04 17:20
- `Signaturen` und `Postfach-Zugang` weiter getrennt: unter `Signaturen` werden jetzt Signatur plus Header/Footer-Editor gezeigt, ohne IMAP/SMTP-Zugangsdaten.
- `AdminMailboxSettings` unterstÃƒÂ¼tzt jetzt die Modi `credentials`, `layout`, `full`.
- KI fÃƒÂ¼r `Neue Nachricht` bei Mieter/Dienstleister hÃƒÂ¤rter vom Verlauf getrennt: `message-reply-draft` ignoriert alte Themen in `new`-Kontext jetzt explizit, und Mieter sollen nicht mehr zur Firmen-Mailadresse geschickt werden.
- Sidebar `Bestand` optisch weiter neutralisiert, damit es nicht wie ein aktiver Link wirkt.
- Header/Settings-MenÃƒÂ¼ mit hÃƒÂ¶herem `z-index`, damit das Zahnrad nicht hinter Ticketfeldern verschwindet.
- Ticketliste und Ticketdetail weiter nach oben gezogen; Ticketdetail mit kompakterem Kopf und Back-Button oben links.
- Build geprÃƒÂ¼ft: `npm run build` grÃƒÂ¼n.
## Update 2026-04-04 17:40
- Ticket-/Ticketdetail-Headerleiste weiter vereinfacht: globaler Kopfstreifen fÃƒÂ¼r `/admin/tickets` und `/admin/tickets/[ticketId]` entfernt, Settings-Zahnrad dort jetzt separat/floating.
- `AdminSignatureSettings` erweitert: Signatur hat jetzt eigenen Formatierungsblock mit Schriftart, SchriftgrÃƒÂ¶ÃƒÅ¸e, Ausrichtung, Fett, Kursiv, Unterstreichen und Trennlinie.
- Signaturdaten speichern jetzt zusÃƒÂ¤tzliche Felder `signatureFontFamily`, `signatureFontSize`, `signatureTextAlign`, `signatureFontBold`, `signatureFontItalic`, `signatureFontUnderline`, `signatureUseDivider`.
- `lib/signatures.ts` aktualisiert, damit E-Mail-Signaturen diese Formatierung auch tatsÃƒÂ¤chlich im HTML-Footer berÃƒÂ¼cksichtigen.
- UTF-8-Fehler nach Dateineuschreiben bereinigt.
- Build geprÃƒÂ¼ft: `npm run build` grÃƒÂ¼n.

---

## Update 2026-04-04 19:51

- Ticketliste und Ticketdetail wurden weiter nach oben gezogen, damit die Kopfzeilen nÃƒÆ’Ã‚Â¤her an die Zahnrad-Zeile rÃƒÆ’Ã‚Â¼cken.
- Die Ticketdetailseite nutzt jetzt eine kompaktere Metadatenzeile oben und einen zurÃƒÆ’Ã‚Â¼ckgesetzten Arbeitsbereich darunter.
- Die Sidebar im Bereich Bestand wurde optisch entschÃƒÆ’Ã‚Â¤rft, damit nur noch echte aktive EintrÃƒÆ’Ã‚Â¤ge hervortreten.
- Im Mieterchat nutzt Neue Nachricht jetzt den KI-Pfad fÃƒÆ’Ã‚Â¼r eigenstÃƒÆ’Ã‚Â¤ndige Nachrichten statt den Antwortpfad auf den Verlauf.
- Der KI-Kontext fÃƒÆ’Ã‚Â¼r Mieter berÃƒÆ’Ã‚Â¼cksichtigt jetzt zusÃƒÆ’Ã‚Â¤tzlich die konfigurierte Absenderadresse und vorhandene ZÃƒÆ’Ã‚Â¤hlerdaten.
- Die KI-Regeln wurden verschÃƒÆ’Ã‚Â¤rft, damit bei Tickets und Mieter-Nachrichten die Anrede Frau/Herr verbindlich ist und nur das aktuelle Einzelticket behandelt wird.
- matchCategory() priorisiert Hausreinigung und konkrete ProblemfÃƒÆ’Ã‚Â¤lle wie Treppenhausreinigung, tropfende Toilette und Verstopfung in KÃƒÆ’Ã‚Â¼che jetzt vor allgemeineren Treffern.
- Im Reiter Signaturen bleibt Header/Footer-Bearbeitung erhalten, aber der Postfach-Aktiv-Schalter wird dort nicht mehr angezeigt.
-
pm run build ist auf diesem Stand grÃƒÆ’Ã‚Â¼n.

---

## Update 2026-04-13 12:41

- Einstellungen > Brief wurde funktional in drei Unterbereiche aufgeteilt:
  - `Briefvorlage`
  - `Anrede`
  - `Abschluss`
- Die Umschaltung lÃƒÂ¤uft ÃƒÂ¼ber:
  - `/admin/einstellungen?tab=brief&sub=vorlage`
  - `/admin/einstellungen?tab=brief&sub=anrede`
  - `/admin/einstellungen?tab=brief&sub=abschluss`
- `app/admin/einstellungen/page.tsx` wurde dafÃƒÂ¼r erweitert und ÃƒÂ¼bergibt den aktiven Unterbereich an `components/admin/AdminLetterSettings.tsx`.
- `AdminLetterSettings` unterstÃƒÂ¼tzt jetzt einen `view`-Prop:
  - `vorlage`
  - `anrede`
  - `abschluss`
- Ziel dieser Trennung:
  - pro Unterseite nur noch ein echtes Formatierfeld
  - dadurch soll die Toolbar nicht mehr zwischen mehreren `contentEditable`-Feldern auf derselben Seite durcheinanderkommen

### Aktueller Stand Brief-Einstellungen

- `Briefvorlage` zeigt weiterhin das groÃƒÅ¸e Vorlagenfeld mit Logo, Linien, RÃƒÂ¤ndern und Platzhaltern.
- `Anrede` hat jetzt ein eigenes groÃƒÅ¸es Rich-Text-Feld nur fÃƒÂ¼r die formatierbare Brief-Anrede.
- `Abschluss` hat jetzt ein eigenes groÃƒÅ¸es Rich-Text-Feld nur fÃƒÂ¼r den formatierbaren Abschlussblock.
- Die Toolbar-Buttons wurden bereits so angepasst, dass ihre Auswahl per `selectionchange` zentraler gemerkt wird.
- Speichern der Rich-Text-Inhalte fÃƒÂ¼r Anrede und Abschluss erfolgt nicht mehr bei jedem Tastendruck, sondern erst beim Verlassen des Feldes bzw. beim Speichern.
- `npm run build` lief nach dieser Umstellung erfolgreich grÃƒÂ¼n.

### Noch offener Punkt vor dem Neustart

- Die Trennung in drei Unterseiten ist jetzt drin, aber noch nicht abschlieÃƒÅ¸end im Browser verifiziert.
- Vor dem Neustart war genau das der nÃƒÂ¤chste PrÃƒÂ¼fpunkt:
  - Funktioniert Formatieren in `Anrede` jetzt sauber?
  - Funktioniert Formatieren in `Abschluss` jetzt sauber?
  - Bleibt `Briefvorlage` stabil und arbeitet nur noch auf dem groÃƒÅ¸en Vorlagenfeld?

### Wichtige betroffene Dateien

- `app/admin/einstellungen/page.tsx`
- `components/admin/AdminLetterSettings.tsx`
- auÃƒÅ¸erdem weiter relevant fÃƒÂ¼r Brief-/Signatur-Rendering:
  - `lib/signatures.ts`

### Hinweis fÃƒÂ¼r den nÃƒÂ¤chsten Chat

- Erster sinnvoller Schritt im neuen Chat:
  1. VS Code / Browser neu starten
  2. `Einstellungen > Brief > Anrede` testen: markieren + Fett/Kursiv/Unterstreichen
  3. `Einstellungen > Brief > Abschluss` genauso testen
  4. danach `Briefvorlage` kurz gegenprÃƒÂ¼fen
- Falls die Selektion dort immer noch springt, dann als nÃƒÂ¤chstes nicht wieder symptomatisch patchen, sondern die Toolbar-/Selection-Logik in `AdminLetterSettings.tsx` fÃƒÂ¼r die drei Views jeweils strikt getrennt behandeln.

---

## Update 2026-04-23 00:00 - rekonstruierter Stand nach VS-Code-Neustart

Dieser Eintrag wurde nachtraeglich aus `git status`, `git diff` und einem frischen Build rekonstruiert, weil der Arbeitsstand seit dem letzten Kontext-Eintrag nicht fortlaufend dokumentiert war.

### Aktueller Git-Arbeitsstand

- Es gibt uncommitted Aenderungen in:
  - `.ai-settings.local.json`
  - `app/api/ai/message-draft/route.ts`
  - `app/api/ai/message-reply-draft/route.ts`
  - `app/api/ai/ticket-draft/route.ts`
  - `components/admin/AdminLetterSettings.tsx`
  - `components/admin/LetterComposeEditor.tsx`
  - `components/admin/MessageDetailWorkspace.tsx`
  - `components/admin/MessagesWorkspace.tsx`
  - `components/admin/PersonDetailView.tsx`
  - `components/admin/TenantAdminManager.tsx`
  - `components/admin/TenantDetailView.tsx`
  - `components/admin/TicketDetailWorkspace.tsx`
  - `lib/draftComposer.ts`
  - `lib/signatures.ts`
  - `package.json`
  - `package-lock.json`
- Letzter Commit ist `b038068 backup: codewort nordstern-briefstand`.
- `npm run build` wurde am 2026-04-23 erneut ausgefuehrt und laeuft gruen mit Next.js 16.2.1.

### Rekonstruierte Hauptaenderungen seit 2026-04-13

- Der Brief-Composer `LetterComposeEditor` wurde von einem einfachen Text-/HTML-Editor auf TipTap umgebaut.
- Neue TipTap-Abhaengigkeiten wurden ergaenzt:
  - StarterKit
  - TextStyle
  - Color
  - Highlight
  - TextAlign
  - Underline
  - FontFamily
  - Table / TableRow / TableCell / TableHeader
  - ProseMirror-Paket `@tiptap/pm`
- Im Brief-Composer gibt es jetzt Formatierung fuer:
  - Schriftart
  - Schriftgroesse
  - Fett/Kursiv/Unterstrichen
  - Ausrichtung links/zentriert/rechts/Blocksatz
  - Textfarbe
  - Markierung
  - Tabellen einfuegen und Zeilen/Spalten bearbeiten
- Die Briefvorschau wird jetzt in echte Seiten (`data-letter-page="true"`) aufgeteilt und mit Vor-/Zurueck-Navigation angezeigt.
- `lib/signatures.ts` wurde stark erweitert, damit Brief-HTML mehrseitig aufgebaut werden kann:
  - Body-Bloecke werden seitenweise verteilt.
  - Absaetze koennen an Wortgrenzen getrennt werden.
  - Tabellen, Absaetze und leere Zeilen werden fuer den Briefdruck staerker normalisiert.
  - Seitenmarker und Briefseiten-Container werden erzeugt.
- Fuer Brief-Anreden wurden neue Platzhalter ergaenzt:
  - `{{FORMAL_SALUTATION}}`
  - `{{GEEHRTE_SUFFIX}}`
- Die Brief-Anrede kann dadurch automatisch zwischen z. B. `Sehr geehrte Frau` und `Sehr geehrter Herr` unterscheiden.
- `AdminLetterSettings` hat im Anrede-Editor einen neuen Token-Button `Sehr geehrte(r)`.
- Mieter-Stammdaten wurden um Anrede-Felder erweitert:
  - `salutation`
  - `companyContactSalutation`
- In Mieter-/Nachrichten-/Ticket-/Kontakt-Kontexten wird die Anrede jetzt an Brief- und KI-Logik weitergereicht.
- KI-Routen wurden erweitert um:
  - `deliveryMode`
  - `recipientSalutation`
- Bei `deliveryMode = letter` soll die KI keine Anrede und keine Abschlussformel mehr erzeugen, weil das Briefsystem diese Bestandteile selbst einsetzt.
- `.ai-settings.local.json` wurde entsprechend angepasst: Bei Briefversand keine Anrede und keine Verabschiedung durch die KI.
- `lib/draftComposer.ts` strippt KI-Entwuerfe staerker:
  - fuehrende Anreden werden entfernt
  - Schlussformeln werden entfernt
  - bei normalen Portal-/E-Mail-Antworten setzt die App selbst Anrede + Signatur
  - bei Briefen wird nur der reine Inhalt verwendet
- In Mieter-, Personen-, Ticket- und Nachrichten-Workspaces wurden einige alte `Anwenden`-Buttons neben KI-Hinweisfeldern entfernt; die KI-Erzeugung laeuft weiterhin ueber die vorhandenen KI-Buttons.

### Verifizierter Stand

- `npm run build` laeuft gruen.
- TypeScript-Check im Build laeuft gruen.
- Noch nicht im Browser verifiziert.

### Naechster sinnvoller Schritt

1. App lokal starten.
2. Im Browser `Einstellungen > Brief > Anrede` testen:
   - Token `Sehr geehrte(r)` einfuegen
   - Formatieren mit Fett/Kursiv/Unterstreichen pruefen
   - Speichern und Vorschau/Briefausgabe pruefen
3. `Einstellungen > Brief > Abschluss` testen.
4. In einem Mieter oder einer Nachricht `Versand: Brief` testen:
   - KI-Entwurf darf keine Anrede und keine Verabschiedung enthalten.
   - Briefvorschau muss Anrede/Abschluss aus der Vorlage einsetzen.
   - Bei Frau/Herr muss die formale Anrede korrekt sein.
5. Mehrseitigen Brief mit langem Text testen:
   - Seitenumbruch
   - Pfeilnavigation
   - leere Zeilen
   - Tabellen
6. Danach entscheiden:
   - Wenn Browser-Test gruen ist: Aenderungen committen.
   - Wenn Briefvorschau/Seitenumbruch hakt: zuerst `LetterComposeEditor.tsx` und die Mehrseitenlogik in `lib/signatures.ts` pruefen.

## Update 2026-04-27 00:00
- Objekt-Detailseite (`/admin/immobilie/[id]`) im Layout angepasst.
- Links oben im Sidebar-Kopf steht auf der Objekt-Detailseite unter `Interner Bereich` jetzt `Objekt` statt `Verwaltungsbereich`.
- Im globalen Header zeigt die Objekt-Detailseite jetzt den echten Objektnamen aus Firestore an, z. B. `Brandenburger Strasse 26`.
- In `PropertyDetailView` wurde die doppelte grosse Namenszeile im Content entfernt, damit der Objektname nur noch einmal im Header erscheint.
- Build geprueft: `npm run build` gruen.

## Update 2026-04-27 00:10
- Einheits-Detailseite (`/admin/einheit/[propertyId]/[unitId]`) an den Kopfaufbau der Objekt-Detailseite angeglichen.
- Links oben im Sidebar-Kopf steht auf der Einheits-Detailseite unter `Interner Bereich` jetzt `Einheit`.
- Im globalen Header zeigt die Einheits-Detailseite jetzt die aktuelle Einheitsbezeichnung aus dem Objektbestand an.
- In `UnitDetailView` wurde die doppelte grosse Namenszeile im Content entfernt, damit die Einheit nur noch einmal im Header erscheint.
- In den Zaehlerkarten wurde die Position von `Eichdatum` und `Ablesedatum` getauscht; `Ablesedatum` steht jetzt vor `Eichdatum`.
- Build geprueft: `npm run build` gruen.

## Update 2026-04-27 00:20
- Zaehler-Detailseite/Historie repariert.
- `MeterDetailView` baut die Zaehlerstand-Historie jetzt robuster auf:
  - vorhandene `readingHistory`
  - `initialReading` + `initialReadingDate`
  - `latestReading` + `latestReadingDate`
- Dadurch bleiben auch alte oder nur teilweise strukturierte Zaehlerstaende in der Historie sichtbar.
- Beim Speichern eines neuen Zaehlersstands auf der Detailseite werden doppelte Historieneintraege vermieden.
- `UnitDetailView` schreibt Schnell-Erfassungen fuer Objekt- und Einheiten-Zaehler jetzt ebenfalls in `readingHistory`, nicht nur in `latestReading` und `latestReadingDate`.
- Dadurch tauchen neue Staende aus der Uebersichtsseite anschliessend auch in der Detail-Historie auf.
- Build geprueft: `npm run build` gruen.

## Update 2026-04-27 00:30
- Zaehlerwechsel-Formular verbessert.
- In `MeterDetailView` wird die alte Zaehlernummer jetzt automatisch mit der aktuell bekannten `meterNumber` vorbelegt.
- Das Feld bleibt trotzdem editierbar.
- Nach einem gespeicherten Zaehlerwechsel wird das Feld fuer die alte Zaehlernummer direkt auf die neue Zaehlernummer gesetzt, damit ein weiterer Wechsel logisch weitergefuehrt werden kann.
- Build geprueft: `npm run build` gruen.

## Update 2026-04-27 00:45
- Admin-UI insgesamt verdichtet, damit deutlich mehr Informationsdichte pro Viewport entsteht.
- In `app/globals.css` wurden kompaktere Admin-Standards eingefuehrt:
  - kleinere Header-Hoehen
  - engere Card-/Row-/Field-Abstaende
  - kompaktere Buttons, Inputs, Selects und Textareas
  - geringere Zeilenhoehen in Detailwerten
- `ProtectedAreaLayout` wurde sichtbar verdichtet:
  - Sidebar-Kopf kompakter
  - Suchfeld enger
  - Section-/Nav-Abstaende reduziert
  - globaler Header hoehenreduziert
- Detailseiten fuer Firma, Objekt, Einheit, Person und Zaehler auf gemeinsame kompakte Card-/Row-/Field-Klassen umgestellt.
- Grid-Gaps zwischen Info-Karten wurden auf den betroffenen Detailseiten reduziert.
- Build geprueft: `npm run build` gruen.

## Update 2026-04-27 00:55
- Einheiten-Uebersicht bei den Zaehlern bereinigt.
- In `UnitDetailView` wurden in den Zaehlerkarten die redundanten Felder `Zaehlerart` entfernt; die Art steht bereits als Kartenueberschrift.
- Die Schnell-Eingaben `Neuer Stand` und `Ablesedatum` wurden aus der Einheiten-Uebersicht vollstaendig entfernt.
- Die Bearbeitung von Zaehlerstaenden erfolgt damit nur noch auf der jeweiligen Detailseite hinter `Details`.
- Der bisherige lokale Schnell-Speicherpfad fuer Zaehlerstaende in `UnitDetailView` wurde komplett entfernt.
- Build geprueft: `npm run build` gruen.

## Update 2026-04-27 01:05
- Einheiten-Uebersicht bei Zaehlerkarten weiter verdichtet.
- Das separate Feld `Zaehlernummer` wurde in `UnitDetailView` aus den Karten entfernt.
- Stattdessen wird die Zaehlernummer jetzt direkt in der Kachel-Ueberschrift hinter der Zaehlerart in Klammern angezeigt.
- Das Grid der Zaehlerkarten wurde entsprechend verkleinert.
- Build geprueft: `npm run build` gruen.

## Update 2026-04-27 01:15
- Objekt-Detailseite fachlich neu sortiert.
- `Einheiten` und `Leerstand` wurden aus `Technik` herausgenommen und nach `Adresse und Bestand` verschoben.
- `Kaufdatum` und `Eigentum seit` wurden aus `Wartung` herausgenommen und nach `Eigentum und Wirtschaftlichkeit` verschoben.
- `Technik` enthaelt jetzt nur noch wirklich technische Objektangaben.
- `Wartung` enthaelt jetzt nur noch Wartungsinformationen.
- Die Dienstleister-Zuordnung wurde deutlich weiter nach unten auf der Seite verschoben und als eigener breiter Block unter die Einheiten gesetzt.
- Build geprueft: `npm run build` gruen.

- Objekt-Topstat Eigentuemer in PropertyDetailView auf eine Zeile mit Ellipse begrenzt; voller Wert erscheint per Hover-Tooltip.


## Update 2026-04-27 01:30
- Mieter-Uebersicht um Objektfilter erweitert.
- In `TenantAdminManager` kann in der Kachel `Uebersicht` jetzt zwischen `Alle` und einzelnen Objekten per Dropdown gefiltert werden.
- `ProtectedAreaLayout` fuer `/admin/mieter` angepasst:
  - links unter `Interner Bereich` steht jetzt `Mieter`
  - der obere globale Header wird auf der Mieter-Uebersichtsseite nicht mehr angezeigt
  - dadurch verschwindet dort auch `Verwaltungsbereich`
- Build geprueft: `npm run build` gruen.

## Update 2026-04-27 01:40
- Mieter-Uebersicht nach UI-Fix nachgebessert.
- Sichtbare kaputte Sonderzeichen/Fragezeichen in `TenantAdminManager` bereinigt, insbesondere im Uebersichtsblock.
- Der Seiteninhalt auf `/admin/mieter` wurde etwas nach unten versetzt (`mt-6`), damit das Einstellungs-Zahnrad nicht in die erste Kachel bzw. das erste Feld hineinragt.
- Beim Nachziehen des Text-Fixes versehentlich beschaedigte `??`-Operatoren in `TenantAdminManager` wiederhergestellt.
- Build geprueft: `npm run build` gruen.

## Update 2026-04-27 01:55
- Objekt-Detailseite sprachlich bereinigt.
- In `PropertyDetailView` werden englische Rohwerte jetzt in deutsche Anzeigenamen uebersetzt, insbesondere bei:
  - `usageType` wie `mixed_use`
  - `ownershipType` wie `full_ownership`
  - `heatingSystems` wie `district_heating`
- In der Kachel `Eigentum und Wirtschaftlichkeit` wurden die doppelten Felder `Eigentuemer` und `Eigentumsart` entfernt, weil diese bereits oben im Kopfbereich stehen.
- Build geprueft: `npm run build` gruen.

## Update 2026-04-27 02:20
- Mieter-Bearbeitung bei Mieterhoehungen erweitert.
- In `TenantAdminManager` wurde die Erinnerung fuer `Nach Gesetz` von 36 Monaten auf 30 Monate Vorlauf umgestellt, damit sechs Monate vor Ablauf der 3-Jahres-Frist erinnert wird.
- Im Bereich `Mieterhoehung` gibt es jetzt eine direkt bearbeitbare `Aktuelle Kaltmiete`, unabhaengig von `Staffelmiete`, `Indexmiete` oder `Nach Gesetz`.
- Aenderungen an der aktuellen Kaltmiete aktualisieren bei Staffelmieten die berechneten Staffelwerte automatisch mit.
- In der Mieter-Uebersicht wird pro Datensatz jetzt ein kompakter Hinweis zur naechsten Mieterhoehungs-Pruefung angezeigt, z. B. `jetzt pruefen` oder `pruefbar ab ...`.
- Der Hinweistext fuer `Nach Gesetz` wurde auf die neue 2,5-Jahres-Erinnerungslogik angepasst.
- Build geprueft: `npm run build` gruen.

## Update 2026-04-27 02:35
- Bug in der Mieterhoehungs-Erinnerung fuer `Nach Gesetz` korrigiert.
- Die Erinnerung wird jetzt nicht nur mit der richtigen 30-Monats-Regel berechnet, sondern beim Laden eines bestehenden Mieters auch immer neu aus `Letzte Mieterhoehung` und Mieterhoehungsart abgeleitet.
- Dadurch werden veraltete Altwerte in `Naechste Erinnerung` nicht mehr blind aus Firestore uebernommen.
- Feldbezeichnung in der Mieter-Bearbeitung angepasst: `Basisdatum Pruefung` heisst jetzt `Letzte Mieterhoehung`.
- Hinweistext fuer `Nach Gesetz` sprachlich passend auf das hinterlegte Datum bezogen.

## Update 2026-04-27 02:50
- Mieter-Bearbeitung im Bereich Miete/Mieterhoehung klarer strukturiert.
- Das obere Feld zeigt jetzt nur noch die `Aktuelle Kaltmiete` als Read-only-Status.
- Der eigentliche Eingabepunkt fuer Aenderungen sitzt jetzt kompakt im Block `Mieterhoehung` und heisst `Neue Kaltmiete`.
- Ueber dem Block wurde ein kurzer Hinweis ergaenzt, dass die neue Miete dort eingetragen wird und oben nur der aktuelle Stand angezeigt wird.
- Ziel: weniger Doppelung, klarer Blickfokus, eindeutiger Ort fuer die Mietaenderung.

## Update 2026-04-27 03:20
- Mieter-Bearbeitung um eine Mietentwicklungs-Grafik erweitert.
- Oberhalb der ersten Stammdaten-/Zuordnungsfelder gibt es jetzt ein eigenes Feld `Mietentwicklung` mit SVG-Chart.
- Die Chart kann zwischen `Beide`, `Kaltmiete` und `Nebenkosten` umgeschaltet werden.
- Hover auf Datenpunkten zeigt Datum und Hoehe per Tooltip.
- `Neue Kaltmiete` ist jetzt ein separates, beim Laden leeres Aenderungsfeld und nicht mehr mit der aktuellen Miete vorbelegt.
- Die obere `Aktuelle Kaltmiete` bleibt als reiner Read-only-Status sichtbar.
- Beim Speichern einer neuen Kaltmiete wird diese als neuer aktueller Wert uebernommen und zugleich in `rentHistory` historisiert.
- Die Mietverlaufslogik zeigt vergangene bekannte Mieten, die aktuelle Miete und Zukunftspunkte fuer `Staffelmiete` sowie fuer `Nach Gesetz` mit 15 Prozent alle 3 Jahre.
- Bei `Indexmiete` endet die Vorschau bewusst beim aktuellen Stand.
- Build geprueft: `npm run build` gruen.

## Update 2026-04-27 03:35
- Mietentwicklungs-Grafik nur noch im Bearbeiten-Kontext eines konkreten Mieters sichtbar (`/admin/mieter/[id]/bearbeiten`).
- Auf der allgemeinen Seite `/admin/mieter` erscheint die Grafik nicht mehr im Neuanlage-/Uebersichtsbereich.
- Im selben Bearbeiten-Bereich wurde eine manuelle Historienpflege fuer vergangene Miethoehen ergaenzt.
- Rueckwirkende Eintraege koennen jetzt mit Datum, Kaltmiete und Nebenkosten angelegt, geaendert und entfernt werden.
- Diese Historieneintraege fliessen direkt in die Mietentwicklungs-Grafik ein.
- Build geprueft: `npm run build` gruen.

## Update 2026-04-27 04:05
- Mietgrafik neu verteilt.
- Die Mieter-Grafik wurde aus `/admin/mieter/[id]/bearbeiten` entfernt und auf die konkrete Mieter-Detailseite `/admin/mieter/[id]` verschoben.
- Dort zeigt sie vergangene Miethoehen, den aktuellen Stand sowie Zukunftspunkte fuer `Staffelmiete` und `Nach Gesetz`; `Indexmiete` endet beim aktuellen Stand.
- Die manuelle Pflege `Vergangene Miethoehen` bleibt in `TenantAdminManager` und ist jetzt sowohl bei `Mieter bearbeiten` als auch bei `Mieter anlegen` sichtbar.
- Dashboard erweitert: neue Grafik zur gesamten Kaltmiete der ausgewaehlten Objekte.
- Im Dashboard koennen jetzt `Alle` oder beliebige einzelne/mehrere Objekte zur Summenansicht ausgewaehlt werden.
- Die Dashboard-Grafik zeigt bewusst nur Kaltmiete, ohne Nebenkosten und nicht mieterspezifisch.
- Neue wiederverwendbare Komponente: `components/admin/RentHistoryChart.tsx`.
- Build geprueft: `npm run build` gruen.

## Update 2026-04-27 04:25
- Sichtbare Rohwerte/Englischreste im Mieterbereich weiter auf Deutsch umgestellt.
- In `TenantAdminManager` wird der Status in der Mieter-Uebersicht jetzt deutsch angezeigt statt z. B. `active`.
- In `TenantDetailView` werden jetzt insbesondere folgende Werte deutsch angezeigt:
  - Status
  - Mieterhoehungsart
  - Kautionsart
  - Umsatzsteuer-Regelung
  - Beziehungen weiterer Personen
- Grundlage dafuer sind zentrale Label-Mappings statt verstreuter Einzelfixes.
- Build geprueft: `npm run build` gruen.

## Update 2026-04-27 04:40
- Deutsch-Bereinigung im Kontakt-/Dienstleisterbereich erweitert.
- In `PersonDetailView` werden jetzt auch Rohwerte fuer `Bereich`, `Anrede` und `Bevorzugter Kontaktweg` deutsch angezeigt statt interne Schluessel wie `heating_service`, `mr` oder `mail`.
- Damit wurden die sichtbaren Rohwerte in den aktuell bearbeiteten Bereichen weiter reduziert: Mieter-Uebersicht, Mieter-Detail, Mieter-Pflege sowie Kontakt-/Dienstleister-Detail.
- Build geprueft: `npm run build` gruen.

## Update 2026-04-28 00:35
- Portalzugang fuer externe Personen begonnen und funktional angebunden.
- Rollenmodell erweitert:
  - `lib/auth.ts` nutzt jetzt `admin` und `portal` statt `admin` und `tenant`.
  - Portal-Profile in `userProfiles` koennen jetzt `username`, `targetType`, `targetId`, `displayName`, `authEmail` und `contactEmail` tragen.
  - Automatisches stilles Erzeugen eines Portalprofils beim Login wurde entfernt; Portalzugriffe muessen jetzt vorab angelegt sein.
- Neue zentrale Portal-Helfer in `lib/portalAccess.ts`:
  - Username-Normalisierung
  - interne Auth-E-Mail fuer Firebase
  - Anzeige-/Zuordnungslogik fuer `tenant` und `contact`
  - Dokumentlisten fuer Portalansichten
- Neue API-Routen:
  - `POST /api/portal-auth/resolve`: loest Benutzername -> interne Auth-E-Mail fuer den Portal-Login auf
  - `POST /api/admin/portal-access`: legt Portalzugang fuer Mieter oder Dienstleister an bzw. aktualisiert ihn
  - `POST /api/admin/portal-invitation`: verschickt Einladung mit Begruessung, Zugangsdaten und kurzer Erklaerung; legt bei Bedarf fuer Kontakte den Auth-Zugang direkt mit an
- Login umgestellt:
  - Startseite nutzt jetzt `LoginForm intendedRole="portal"`
  - Portal-Login fragt Benutzername + Passwort statt E-Mail + Passwort ab
  - `app/mieterportal/layout.tsx` verlangt jetzt `requiredRole="portal"`
- Mieter anlegen/bearbeiten:
  - `TenantAdminManager` hat jetzt einen eigenen Block `Portalzugang`
  - dort koennen `Benutzername` und `Passwort` gepflegt werden
  - beim Speichern wird der Portalzugang ueber die neue API eingerichtet
  - vorhandene gespeicherte Portal-Passwoerter bleiben bei leerem Passwortfeld im Bearbeiten-Kontext erhalten
- Detailseiten:
  - `TenantDetailView` hat jetzt den Button `Einladung senden` und zeigt den hinterlegten Portal-Benutzernamen an
  - `PersonDetailView` hat ebenfalls `Einladung senden`
- Mieterportal inhaltlich ersetzt:
  - `/mieterportal` zeigt jetzt echte Daten des zugeordneten Mieters oder Dienstleisters
  - bei Mietern werden auch Objekt-/Einheitsinformationen geladen
  - Schnellzugriffe fuer Kommunikation und Dokumente sind eingebaut
  - `/mieterportal/nachrichten` ist jetzt ein reiner Chat-/Verlaufsbereich ohne Briefauswahl
  - `/mieterportal/dokumente` zeigt die fuer den jeweiligen Datensatz hinterlegten Unterlagen an
- Portal-Nachrichten laufen jetzt nicht mehr ueber einen E-Mail-Abgleich, sondern ueber die Zuordnung im `userProfiles`-Profil (`targetType` + `targetId`).
- Build geprueft: `npm run build` gruen.

## Update 2026-04-28 01:10
- Portal-Login lokal repariert, wenn keine Firebase-Admin-Service-Account-Daten in `.env.local` vorhanden sind.
- Grundursache: Lokal war nur `NEXT_PUBLIC_FIREBASE_PROJECT_ID` gesetzt; Admin-SDK war nicht konfiguriert. Dadurch konnten Portal-Accounts serverseitig weder sauber erzeugt noch Benutzername -> Auth-E-Mail aufgeloest werden.
- Neuer Dev-Fallback eingebaut:
  - `app/api/admin/portal-access/route.ts` kann jetzt lokal ohne Admin-SDK Portal-Auth-User ueber Firebase Auth REST anlegen/aktualisieren.
  - `app/api/portal-auth/resolve/route.ts` kann lokal ueber `.portal-access.local.json` den Benutzernamen aufloesen.
  - `app/api/admin/portal-invitation/route.ts` kann lokal fehlende Auth-User ebenfalls nachziehen.
- Neue Hilfsdateien:
  - `lib/firebaseAuthRest.ts`
  - `lib/localPortalAccess.ts`
  - `lib/portalSecrets.ts`
- Passwort-Haertung verbessert:
  - Portal-Passwoerter sollen nicht mehr als Klartext im Firestore-Datensatz landen.
  - Stattdessen werden sie serverseitig verschluesselt (`portalPasswordCipher`) abgelegt.
  - Bestehende alte Klartextwerte werden beim Versand / Update weiterhin als Uebergang gelesen, damit nichts sofort kaputtgeht.
- `TenantAdminManager` speichert das Portal-Passwort nicht mehr direkt in den Mieter-Datensatz.
- `AdminCollectionManager` macht dasselbe jetzt auch fuer Kontakte/Dienstleister und richtet nach dem Speichern den Portalzugang nachgelagert ein.
- Login-Fehlermeldungen fuer Portal-Zugaenge sind jetzt konkreter (`Benutzername nicht gefunden`, `Portal lokal nicht eingerichtet` usw.).
- Build geprueft: `npm run build` gruen.

## Update 2026-04-28 01:35
- Zwei konkrete Fehler beim lokalen Portalzugang abgefangen:
  - `portal_user_not_found` beim Login
  - `429 RESOURCE_EXHAUSTED / Quota exceeded` beim Speichern des Portalzugangs fuer Mieter
- Ursache: Beim lokalen Bearbeiten eines bestehenden Mieters konnte die REST-basierte Firebase-Auth-Anlage an Quoten scheitern. Dadurch wurde anschliessend kein aufloesbarer Portalzugang gefunden.
- Neuer lokaler Portal-Fallback:
  - `POST /api/portal-local/login`
  - `GET /api/portal-local/session`
  - `POST /api/portal-local/logout`
- Damit funktioniert das Portal auf `localhost` jetzt auch ohne erfolgreiche Firebase-Auth-Provisionierung, solange der Zugang lokal gespeichert wurde.
- `app/api/admin/portal-access/route.ts` faengt lokale Quotenfehler jetzt ab und legt den Zugang trotzdem als lokalen Portalzugang an.
- `app/api/portal/messages/route.ts` akzeptiert im lokalen Modus jetzt auch die lokale Portalsitzung statt nur Firebase-ID-Tokens.
- `AuthContext` und `ProtectedAreaLayout` akzeptieren jetzt lokale Portal-Sessions ohne Firebase-Userobjekt.
- In `TenantAdminManager` gibt es jetzt bei der Passwortvergabe einen sichtbaren `Anzeigen` / `Verbergen`-Schalter.
- Build geprueft: `npm run build` gruen.

[2026-04-28 07:50] Portalzugang lokal stabilisiert
- Lokale Portalanlage fuer Mieter speichert ohne Firebase-Admin-/Auth-Token in .portal-access.local.json.
- Neuer Admin-Endpoint /api/admin/portal-access-secret liefert das vergebene Portal-Passwort serverseitig entschluesselt fuer die Bearbeiten-Maske.
- Mieter-Bearbeiten laedt das vergebene Passwort jetzt wieder verborgen in das Feld und kann es per Anzeigen-Schalter sichtbar machen.
- Lokale Portalsitzung liest die Portaldatei jetzt robust auch dann, wenn eine UTF-8-BOM vorhanden ist.
- Lokaler Login /api/portal-local/login und Session /api/portal-local/session fuer den echten Test-Mieter erfolgreich verifiziert.
- npm run build ist gruÃ‚Â¨n.
[2026-04-28 08:05] Portal-Weiterleitung nach Login korrigiert
- ProtectedAreaLayout akzeptiert fuer requiredRole='portal' jetzt auch lokale Portalsitzungen ohne Firebase-User.
- Vorher wurde bei role='portal' aber user=null das Layout verworfen; dadurch landete der Mieter nach Login wieder auf der Startseite.
- Sidebar zeigt fuer Portal jetzt contactEmail oder Benutzername, falls kein Firebase-User vorhanden ist.
- npm run build ist gruÃ‚Â¨n.
[2026-04-28 08:12] Lokalen Portal-Login auf harten Seitenwechsel umgestellt
- Nach erfolgreichem lokalem Portal-Login nutzt LoginForm jetzt window.location.assign('/mieterportal') statt nur router.push().
- Hintergrund: Der Client-Auth-Context bekam bei lokaler Sitzung ohne Firebase-Auth-Event den neuen Portalstatus auf der Startseite nicht rechtzeitig mit und leitete wieder zur Startseite zurueck.
- AuthContext hat zusaetzlich einen manuellen Loader fuer lokale Portalsitzungen und einen Event-Hook fuer spaetere Session-Refreshes erhalten.
- npm run build ist gruÃ‚Â¨n.

[2026-04-28 08:58] Portal-Datenzugriff und Portal-Chat auf serverseitige APIs umgestellt
- Mieterportal-, Dokumente- und Nachrichten-Seite greifen lokal nicht mehr direkt per Firestore-Client auf Daten zu.
- Neue Route /api/portal/context liefert Portal-Zieldaten, Objekt-/Einheitsdaten und Nachrichten serverseitig.
- /api/portal/messages unterstuetzt jetzt lokal auch GET und POST ueber die Portalsitzung ohne Firebase-Mieter-Login.
- Lokale Portal-Nachrichten werden in .portal-messages.local.json gehalten; Senden und Verlauf wurden erfolgreich verifiziert.
- npm run build ist gruen.


[2026-04-28 09:05] Nachrichtenformat im lokalen Portal vereinheitlicht
- /api/portal/context und /api/portal/messages liefern lokale Nachrichten jetzt im selben Format wie die Firestore-Variante: { id, data }.
- Dadurch greift die Nachrichten-Seite nicht mehr auf entry.data eines flachen Objekts zu.
- npm run build ist gruen.


[2026-04-28 09:18] Lokale Portalnachrichten in Admin-Posteingang integriert
- Neue Admin-Route /api/admin/local-portal-messages liest lokale Portalnachrichten und mappt sie ins gleiche Nachrichtenformat wie Firestore.
- MessagesWorkspace mischt lokale Portalnachrichten jetzt in den Verwalter-Posteingang und aktualisiert sie zyklisch.
- Damit erscheinen lokal gesendete Mieterportal-Nachrichten unter /admin/nachrichten, auch ohne Firebase-Admin-Backend.
- npm run build ist gruen.


[2026-04-28 09:24] Detailansicht fuer lokale Portalnachrichten angebunden
- MessageDetailWorkspace laedt jetzt neben Firestore-Nachrichten auch lokale Portalnachrichten ueber /api/admin/local-portal-messages.
- Dadurch koennen lokal erzeugte Portalnachrichten aus dem Admin-Posteingang angeklickt und angezeigt werden, statt in 'Nachricht nicht gefunden' zu laufen.
- npm run build ist gruen.


## Update 2026-04-28 10:05
- Nachrichten-Flow verschlankt: Klick aus Dashboard und Nachrichtenuebersicht fuehrt bei Mieteranfragen jetzt direkt auf /admin/mieter/[id]?messageId=... statt in eine separate Nachrichten-Detailseite.
- TenantDetailView als Arbeitsflaeche umgebaut: rechts getrennte Anfragenliste mit Neu-Badge, links ausgewaehlter Verlauf sowie Antworten und Ticket-erstellen direkt am Mieter.
- Dashboard zieht lokale Portalnachrichten jetzt mit in neue Nachrichten und Kennzahlen ein, damit neue Portalnachrichten dort sofort sichtbar sind.
- Build erfolgreich mit npm run build.


## Update 2026-04-28 10:28
- Mietentwicklung beim konkreten Mieter nach unten verschoben.
- Kommunikationsbereich erweitert: Button 'Neue Nachricht' rechts in Anfragen oeffnet jetzt einen allgemeinen Kommunikationsverlauf fuer den Mieter; dort wird die gesamte Kommunikation zeitlich sortiert gezeigt.
- Beim Oeffnen einer neuen oder zu pruefenden Mieteranfrage wird der Status jetzt auf 'in_progress' gesetzt; dadurch verschwindet das Neu-Badge.
- Lokale Portalnachrichten speichern und liefern jetzt ihren Status ueber /api/admin/local-portal-messages; Build erfolgreich mit npm run build.


## Update 2026-04-28 10:44
- Ticket-Erstellen im Mieter-Nachrichtenbereich entfernt, damit der Umbau fachlich konsequent in Richtung Themenmodell geht.
- Rechte Spalte im Mieterbereich jetzt sprachlich auf 'Themen' statt 'Anfragen' gezogen.
- Allgemeiner Kommunikationsstrang und Statuswechsel fuer lokale Portalnachrichten bleiben aktiv; Build erfolgreich mit npm run build.


## Update 2026-04-28 11:05
- lib/messageThemes.ts eingefuehrt: Themen werden aktuell aus bestehenden Nachrichten pro Mieter und Root-Nachricht abgeleitet, damit Posteingang und Archiv bereits themenbezogen statt nach Einzelnachrichten arbeiten koennen.
- MessagesWorkspace zeigt im Posteingang und Archiv jetzt gruppierte Themen mit letzter Aktivitaet und Themenstatus; Klick fuehrt weiter direkt zum Mieter/Thema.
- Tickets aus der Admin-Hauptnavigation entfernt. Ticket-Routen sind technisch noch vorhanden, aber nicht mehr Teil des sichtbaren Hauptflows.
- Build erfolgreich mit npm run build.


## Update 2026-04-28 12:25
- Dashboard sprachlich und funktional weiter von Tickets auf Themen umgestellt.
- AdminDashboardOverview zeigt offene und neue Themen statt sichtbarer Ticket-Widgets.
- Dashboard-Links fuehren fuer Themen jetzt in den Nachrichten-/Mieterfluss statt auf Ticketseiten.
- Ticket-Navigation bleibt aus dem sichtbaren Hauptfluss entfernt.
- Headertext im Admin-Layout fuer das Dashboard von "Kommunikation, Tickets und Bestand" auf "Kommunikation, Themen und Bestand" angepasst.
- Wichtiger Zwischenstand: alte Ticket-Routen existieren technisch noch, sind aber nicht mehr Teil des gewollten Hauptflows. Sie bleiben vorerst als Rueckfallpfad bestehen, bis die echte Themenstruktur komplett traegt.
- npm run build ist gruen.

## Update 2026-04-28 13:05
- Erste echte Themen-Metadaten eingefuehrt.
- Neue lokale Themenablage in `.message-themes.local.json` ueber `lib/localMessageThemes.ts`.
- Neue Admin-API `/api/admin/message-themes` zum Laden und Aktualisieren von Themen-Metadaten.
- `lib/messageThemes.ts` kann jetzt gespeicherte Themen-Metadaten mit bestehenden Nachrichten zusammenfuehren.
- Thema hat damit erstmals eine eigene gespeicherte Ebene fuer Titel, Status, Archiv und zugeordnete Nachrichten.
- `MessagesWorkspace`, `AdminDashboardOverview` und `TenantDetailView` lesen diese Themen-Metadaten jetzt ein und arbeiten nicht mehr nur mit rein abgeleiteten Nachrichtengruppen.
- Im Mieter-Detailbereich wird beim Oeffnen eines neuen Themas jetzt der Themenstatus auf `in_progress` ueber die neue Themen-API geschrieben statt nur auf Einzel-Nachrichtenebene.
- Wichtiger Zwischenstand: das ist noch nicht die finale `themeEntry`-Architektur, aber es ist die erste persistente Themenbasis, auf der Splitten, Zusammenfuehren, Archivieren und Reaktivieren weiter aufgebaut werden kann.
- `npm run build` ist gruen.

## Update 2026-04-28 14:20
- Lokalen Dev-Server nach festhaengendem Turbopack-/Importzustand neu gestartet; `localhost:3000` antwortet wieder mit 200.
- Nachrichtenbereich-Tab `Alte Nachrichten` in `Archiv` umbenannt.
- Archivierte Themen koennen jetzt im Nachrichtenbereich manuell reaktiviert werden.
- Beim konkreten Mieter kann ein Thema jetzt direkt auf `In Bearbeitung` oder `Erledigt` gesetzt werden.
- `Erledigt` archiviert das Thema, `Reaktivieren` holt es wieder aktiv zurueck.
- Statuswechsel laufen ueber die neue Themen-API `/api/admin/message-themes` und damit ueber die persistente Themen-Metadatenebene statt ueber Einzel-Nachrichtenstatus.
- `npm run build` ist gruen.

## Update 2026-04-28 14:45
- `Neue Nachricht` beim konkreten Mieter ist nicht mehr als Sammelverlauf gedacht, sondern startet beim Senden ein echtes neues Thema.
- Fuer neue allgemeine Verwalternachrichten wird jetzt eine eigene Themen-ID erzeugt und direkt als Thema-Referenz in den Verlauf geschrieben.
- Nach dem Senden springt die Mieteransicht direkt in das neu entstandene Thema.
- Der Bereich `Neue Nachricht` zeigt jetzt bewusst keinen alten Sammelverlauf mehr, sondern erklaert, dass mit dem Senden ein neues Thema mit eigenem Verlauf entsteht.
- Geprueft: Splitten und Zusammenfuehren sind Stand jetzt noch nicht implementiert.
- `npm run build` ist gruen.

## Update 2026-04-28 15:10
- Themen koennen beim konkreten Mieter jetzt erstmals zusammengefuehrt werden.
- Im aktiven Thema kann ein zweites offenes Thema desselben Mieters ausgewaehlt und in das aktuelle Thema ueberfuehrt werden.
- Technisch werden die zugeordneten Nachrichten-IDs ins Zielthema uebernommen; das Quellthema wird archiviert, geleert und mit `mergedIntoThemeId` markiert.
- Themen-Metadaten wurden dafuer um `mergedIntoThemeId` erweitert.
- Allgemeine Admin-Nachricht als echtes neues Thema bleibt aktiv.
- Geprueft: Splitten ist weiterhin noch nicht implementiert.
- `npm run build` ist gruen.

## Update 2026-04-28 15:40
- Themen koennen beim konkreten Mieter jetzt auch gesplittet werden.
- Im aktiven Thema lassen sich einzelne Verlaufseintraege auswaehlen und als neues Thema abspalten.
- Fuer das neue Thema kann optional ein eigener Titel vergeben werden; sonst wird ein Titel aus dem ersten ausgewaehlten Eintrag abgeleitet.
- Das Ausgangsthema behaelt die uebrigen Verlaufseintraege, das neue Thema bekommt die ausgewaehlten Eintraege und wird direkt geoeffnet.
- Damit sind jetzt auf erster arbeitsfaehiger Stufe vorhanden: allgemeine Admin-Nachricht als echtes Thema, Zusammenfuehren und Splitten.
- `npm run build` ist gruen.

## Update 2026-04-28 16:20
- Mieterportal-Nachrichtenbereich auf Themen umgestellt.
- Portal zeigt jetzt Themenliste statt eines einzigen Sammelverlaufs.
- Antwort im Portal kann in ein bestehendes Thema gehen; ohne Auswahl entsteht ein neues Thema.
- Portal-Kontext und Portal-Nachrichten-API liefern/verwenden jetzt Themen plus nur portal-sichtbare Eintraege.
- Portal-Dashboard zeigt die Anzahl der Themen statt nur Roh-Nachrichten.
- Im Adminbereich beim konkreten Mieter sind jetzt pro Thema zusaetzlich moeglich:
  - interne Notizen
  - Gewerk/Dienstleister kontaktieren
- Diese Eintraege laufen im Verwalterverlauf des Themas mit, bleiben aber im Portal fuer den Mieter unsichtbar.
- Lokale Portalnachrichten wurden dafuer um `entryType`, `visibleToTenant`, Empfaengerinfos und Themenbezug erweitert.
- Wichtiger Zwischenstand: Portal hat jetzt Themenlogik, aber noch keine eigene Archivansicht im Portal und noch keine feine Statussteuerung auf Mieterseite.
- `npm run build` ist gruen.

## Update 2026-04-28 16:50
- Mieterportal-Themenbereich um sichtbare Archiv- und Statuslogik erweitert.
- Portal zeigt jetzt offene und archivierte Themen getrennt an und kann zwischen `Offene Themen` und `Archiv` umschalten.
- Beim ausgewaehlten Thema werden Statuschips (`Neu`, `Neu pruefen`, `In Bearbeitung`, `Erledigt`, `Archiv`) sichtbar angezeigt.
- Im Portal wurden kleine Uebersichtskarten fuer offene Themen, archivierte Themen und den aktuell aktiven Bereich ergaenzt.
- Wenn im Portal in ein bereits archiviertes Thema erneut geschrieben wird, wird das Thema lokal automatisch wieder aktiviert (`archived: false`, `status: new`).
- Das Portal-Dashboard fasst Kommunikation jetzt kompakt als `offen / im Archiv` zusammen statt nur einer rohen Gesamtzahl.
- Geprueft: `npm run build` ist gruen.

## Update 2026-04-28 17:40
- Alter Ticket-Zweig jetzt technisch deutlich hÃƒÂ¤rter entfernt.
- Geloescht wurden die alten Admin-Ticketseiten (`/admin/tickets` und Detailroute) samt der zugehoerigen Workspaces.
- Ebenfalls entfernt wurden die speziellen KI-Endpunkte fuer Ticketvorschlaege und Ticketentwuerfe.
- In der Nachrichten-Detailansicht wurden die ungenutzten Ticket-Helfer aus dem aktiven Codepfad entfernt.
- Damit existiert im App-Routing kein eigener Ticketbereich mehr; der sichtbare und technische Hauptfluss laeuft jetzt ueber Nachrichten und Themen.
- Geprueft: `npm run build` ist gruen, die Route-Liste enthaelt keine `/admin/tickets`- oder Ticket-KI-Routen mehr.

## Update 2026-04-28 23:18
- Themenbereich beim konkreten Mieter im neuen Modell weiter aufgeraeumt.
- Linke Themenarbeitsflaeche in components/admin/TenantDetailView.tsx strukturell neu aufgebaut, damit der Build wieder stabil ist.
- Bisherige drei getrennte Eingabebereiche fuer Mieter-Nachricht, interne Notiz und Gewerk-Kommunikation auf einen gemeinsamen Themen-Komposer mit Modus-Umschaltung (Nachricht, Notiz, Gewerk) reduziert.
- Themenstatus jetzt sichtbarer ueber Status-Chips im aktiven Thema und in der Themenliste rechts.
- Archiv-/Inbox-Filter in MessagesWorkspace und Dashboard-Themenfilter bereinigt, damit sie nicht mehr an alter Ticket-Logik haengen.
-
pm run build am Ende erfolgreich gruen.

## Update 2026-04-28 23:27
- Sichtbare kaputte Umlaute im Mieterfluss bereinigt.
- components/admin/TenantDetailView.tsx sprachlich geglaettet (z. B. Rueckfrage/Rueckmeldung, Mieteruebersicht, Status und Pruefung, Naechste Erinnerung, Buerge).
- components/admin/TenantAdminManager.tsx Hinweistext zur Letzten Mieterhoehung ebenfalls bereinigt.
- Kontrolle per Suche: in den beiden aktiven Mieterdateien keine Mojibake-Reste mehr gefunden.
-
pm run build weiterhin erfolgreich gruen.


## Update 2026-04-28 23:46
- Sprachputz im Nachrichtenbereich und in der Objekt-/Immobilienverwaltung weitergezogen.
- `components/admin/MessageDetailWorkspace.tsx` sichtbare Mojibake-Reste bereinigt (u. a. Zurueck, verfuegbar, Prioritaet, Verlauf manuell ergaenzen).
- `components/admin/PropertyAdminManager.tsx` sichtbare Mojibake-Reste in Formularen und Auswahllisten bereinigt (Zaehler, Waermepumpe, Eigentuemer, Strasse, Flurstueck, Jaehrliche Wartungen, Einheit hinzufuegen usw.).
- `npm run build` nach dem Text-Fix weiterhin erfolgreich gruen.


## Update 2026-04-28 23:55
- Letzten sichtbaren Sprachputz im Adminbereich weitergezogen.
- `components/admin/AdminAiSettings.tsx` Texte und Platzhalter bereinigt.
- `components/admin/MessageDetailWorkspace.tsx` Nachrichten-Detailtexte bereinigt.
- `components/admin/PropertyAdminManager.tsx` Objekt-/Immobilienformular weiter sprachlich geglaettet.
- `components/admin/AdminMailboxSettings.tsx` weitere sichtbare Textreste angefasst.
- `npm run build` weiterhin erfolgreich gruen.


## Update 2026-04-29 00:52
- Nachrichtenansicht beim konkreten Mieter weiter verdichtet.
- Oberste Mieter-Kachel in `components/admin/TenantDetailView.tsx` neu aufgebaut: Label `Mieter`, Name inline, daneben `Bearbeiten` und `Einladung senden`, rechtsbuendig `Zur Mieteruebersicht`.
- Kommunikationskachel vereinfacht: Einleitungs-/Ueberschriftstexte entfernt, bei `Neue Nachricht` startet der Bereich direkt im Composer.
- KI-/Composer-Bereich neu angeordnet: oben `KI-Entwurf`, daneben KI-Anweisungen und Versand-Dropdown, darunter Eingabefeld, Wiedervorlage, Senden und Verlauf.
- Kontext-Umschaltung fuer KI (`reply`/`new`) wird jetzt automatisch aus ausgewaehltem Thema vs. allgemeiner neuer Nachricht gesetzt; die alten Buttons dafuer sind aus der UI entfernt.
- `npm run build` nach dem Umbau erfolgreich gruen.


## Update 2026-04-29 01:03
- Konkrete Mieter-Nachrichtenseite weiter verdichtet.
- Kompakten Header fuer `/admin/mieter/[id]` in `components/ProtectedAreaLayout.tsx` entfernt bzw. entschraenkt, damit die Seite hoeher startet und das Einstellungsrad nicht mehr in den Content drueckt.
- Mieter-Kachel in `components/admin/TenantDetailView.tsx` weiter vereinfacht: Label `Mieter` entfernt, `Zur Mieteruebersicht` mit rechtem Abstand zum Einstellungsrad.
- Kommunikationskachel weiter reduziert: Versand-Dropdown jetzt in eigener Zeile ueber `KI-Entwurf` und KI-Hinweisfeld.
- `npm run build` nach dem UI-Feinschliff erfolgreich gruen.


## Update 2026-04-29 08:10
- Konkrete Mieter-Nachrichtenseite oben weiter entkernt.
- Hintergrund-Kachel fuer den Mieterkopf in `components/admin/TenantDetailView.tsx` entfernt.
- Name, `Bearbeiten`, `Einladung senden` und `Zur Mieteruebersicht` als schlanke Kopfzeile auf Hoehe des Einstellungsrads hochgezogen.
- `npm run build` nach dem Kopfzeilen-Umbau erfolgreich gruen.


## Update 2026-04-29 08:38
- Rechte Themenspalte beim konkreten Mieter auf kompakte Sidebar umgebaut.
- Sidebar in `components/admin/TenantDetailView.tsx` von breiten Themenkarten auf schmale Themenliste reduziert.
- Neue Struktur: `+ Neues Thema` in der Ueberschrift, Tabs `Offen` und `Archiv`, kompakte Listeneintraege mit Betreff, Status-Chip, kurzer Vorschau und Zeitstempel.
- Themenbereich links gleichzeitig auf breitere Hauptspalte umgestellt (`xl:grid-cols-[minmax(0,1.75fr)_280px]`).
- `npm run build` nach dem Sidebar-Umbau erfolgreich gruen.

## Update 2026-04-29 14:20
- Konkrete Mieter-Nachrichtenseite weiter verdichtet.
- Status-/Aktionsbereich ueber dem Verlauf in components/admin/TenantDetailView.tsx kompakter gemacht.
- Themenliste rechts mit staerkeren Status-Akzenten und Umschaltung Offen / Archiv weiter geschaerft.
- Briefvorschau in components/admin/LetterComposeEditor.tsx skaliert jetzt automatisch auf die verfuegbare Breite, damit kein horizontales Scrollen mehr noetig ist.
- Sichtbare Textreste im Briefeditor bereinigt (Empfaengeradresse, Seitenwechsel-Buttons).
-
pm run build nach dem UI- und Briefvorschau-Feinschliff erfolgreich gruen.

## Update 2026-04-29 13:45
- Splitten auf der konkreten Mieter-Nachrichtenseite grundlegend vereinfacht.
- In components/admin/TenantDetailView.tsx wird beim Splitten nicht mehr mit vielen auswÃƒÂ¤hlbaren VerlaufseintrÃƒÂ¤gen gearbeitet.
- Neuer Flow: aktives Thema oeffnen -> letzte Nachricht des Themas sehen -> Titel fuer neues Thema vergeben -> daraus neues Thema erzeugen.
- Nach dem Split bleibt die Ansicht im aktuellen Thema, damit dieselbe letzte Nachricht mehrfach nacheinander in weitere neue Themen aufgeteilt werden kann.
- In lib/messageThemes.ts die Themenzuordnung erweitert, sodass dieselbe Ausgangsnachricht mehreren Themen als Startpunkt zugeordnet werden kann.
-
pm run build nach dem Split-Umbau erfolgreich gruen.


## Update 2026-04-29 14:05
- Split-Themen wurden in der Themenliste bisher faelschlich wieder herausgefiltert, wenn keine eingehende Mieternachricht direkt am neuen Thema hing.
- In components/admin/TenantDetailView.tsx den Filter auf latestInbound entfernt, damit auch ausgehende bzw. manuell abgesplittete Themen sichtbar bleiben.
-
pm run build nach dem Fix erfolgreich gruen.



## Update 2026-04-30 00:10
- Themen auf der konkreten Mieter-Nachrichtenseite koennen jetzt endgueltig geloescht werden.
- In components/admin/TenantDetailView.tsx pro Thema ein x in der rechten Themenliste ergaenzt, sowohl fuer offene Themen als auch fuer Themen im Archiv.
- Klick auf x oeffnet eine Sicherheitsabfrage Thema endgueltig loeschen? mit Ja / Nein.
- In lib/localMessageThemes.ts, pp/api/admin/message-themes/route.ts und lib/messageThemes.ts eine deleted-Logik ergaenzt, damit geloeschte Themen nicht aus den Ursprungsnachrichten wieder neu auftauchen.
- Wird das aktuell geoeffnete Thema geloescht, springt die Ansicht zur Mieterseite zurueck.
-
pm run build nach dem Themen-Loeschflow erfolgreich gruen.



## Update 2026-04-30 00:32
- Thementitel auf der konkreten Mieter-Nachrichtenseite direkt bearbeitbar gemacht.
- In components/admin/TenantDetailView.tsx ein kompaktes Titelfeld mit Speichern ergaenzt; die Umbenennung wird jetzt fuer jedes Thema persistent gespeichert, egal ob abgesplittet oder nicht.
- Den separaten Split-Block entfernt; Splitten sitzt jetzt in der Aktionsleiste neben den Status-/Archiv-Aktionen.
- Den Titel Thema splitten und den Erklaertext zum Splitten aus der UI entfernt.
-
pm run build nach dem Themen-Titel-/Split-Feinschliff erfolgreich gruen.



## Update 2026-04-30 00:40
- Doppelte Statusanzeige in der mittleren Themenflaeche entfernt.
- In components/admin/TenantDetailView.tsx den Status-Chip oberhalb der Aktionen rausgenommen, da der Themenstatus bereits rechts in der Themenliste sichtbar ist.
-
pm run build nach dem kleinen UI-Aufraeumen erfolgreich gruen.



## Update 2026-04-30 00:52
- Beim Markieren eines Themas als Erledigt bleibt die rechte Themenliste jetzt auf Offen und springt nicht mehr automatisch ins Archiv.
- In components/admin/TenantDetailView.tsx die automatische Umschaltung von 	hemeListMode auf Archiv entfernt.
- Kopfzeile auf der konkreten Mieterseite weiter gestrafft: Mieteruebersicht jetzt rechtsbuendig, Text Zur entfernt, Einladung senden als reiner Brief-Icon-Button rechts daneben umgesetzt.
-
pm run build nach dem Kopfzeilen-/Archiv-Feinschliff erfolgreich gruen.



## Update 2026-04-30 01:00
- Reaktivieren auf der konkreten Mieterseite auf den echten Archiv-Kontext begrenzt.
- In components/admin/TenantDetailView.tsx erscheint der Button jetzt nur noch, wenn das Thema archiviert ist und die rechte Themenliste auf Archiv steht.
- Beim Klick auf Erledigt wird das Thema weiter ins Archiv verschoben, die Ansicht springt aber direkt zur offenen Mieteransicht zurueck, damit kein archiviertes Thema im offenen Arbeitsmodus haengen bleibt.
-
pm run build nach dem Themenfluss-Fix erfolgreich gruen.



## Update 2026-04-30 01:25
- Portaleinladung lokal robuster gemacht: in pp/api/admin/portal-invitation/route.ts fuehrt ein fehlendes userProfiles-Dokument beim Nachpflegen der Einladung nicht mehr zu einem Fehler nach erfolgreichem Versand.
- Einladungsmail ueberarbeitet: Homepage https://halbmann-holding.de wird explizit genannt, Text um Portal-/App-Vorteile erweitert und ueber neue Begruessungsmail-Einstellungen konfigurierbar gemacht.
- Neuer Bereich Begruessungsmail in den Einstellungen ergaenzt (pp/admin/einstellungen/page.tsx, components/admin/AdminPortalInvitationSettings.tsx, pp/api/admin/portal-invitation-settings/route.ts, neue Hilfsdateien unter lib/).
- Einladungsbutton auf der konkreten Mieterseite und der Kontaktseite mit cursor-pointer versehen.
-
pm run build nach dem Portal-Einladungs-/Einstellungsumbau erfolgreich gruen.



## Update 2026-04-30 01:33
- Portaleinladung lokal robuster gemacht: in pp/api/admin/portal-invitation/route.ts fuehrt ein fehlendes userProfiles-Dokument beim Nachpflegen der Einladung nicht mehr zu einem Fehler nach erfolgreichem Versand.
- Einladungsmail ueberarbeitet: Homepage https://halbmann-holding.de wird explizit genannt, Text um Portal-/App-Vorteile erweitert und ueber neue Begruessungsmail-Einstellungen konfigurierbar gemacht.
- Neuer Bereich Begruessungsmail in den Einstellungen ergaenzt (pp/admin/einstellungen/page.tsx, components/admin/AdminPortalInvitationSettings.tsx, pp/api/admin/portal-invitation-settings/route.ts, neue Hilfsdateien unter lib/).
- Einladungsbutton auf der konkreten Mieterseite und der Kontaktseite mit cursor-pointer versehen.
-
pm run build nach dem Portal-Einladungs-/Einstellungsumbau erfolgreich gruen.



## Update 2026-04-30 01:47
- Restfehler beim Einladungsbutton weiter abgesichert: lokale Nebenupdates nach erfolgreichem Versand (Zeitstempel in Ziel-/Profil-Dokumenten) laufen jetzt als Best-Effort und werfen den Einladungsflow nicht mehr um.
- Begruessungsmail nutzt jetzt die Portalsignatur der Vermieterfirma statt festem Mit freundlichen Gruessen / Halbmann Holding-Abschluss.
- In pp/api/admin/portal-invitation/route.ts wird dafuer die Eigentuemer-/Firmenzuordnung geladen und uildPortalSignatureText(createSignatureRecord(...)) verwendet.
- Standardvorlage der Begruessungsmail auf {{SIGNATURE}} umgestellt und im Einstellungsbereich als Platzhalter dokumentiert.
- Tab-Label Begruessungsmail in pp/admin/einstellungen/page.tsx sicht- und lesbar korrigiert.
-
pm run build nach dem Signatur-/Einladungs-Fix erfolgreich gruen.



## Update 2026-04-30 02:00
- Einstellungs-Tab von Begruessungsmail auf Einladungsmail umbenannt (pp/admin/einstellungen/page.tsx, components/admin/AdminPortalInvitationSettings.tsx).
- Nach erfolgreichem Versand der Portaleinladung wird auf Mieter- und Kontaktseite jetzt ein Popup Einladung wurde verschickt. angezeigt (components/admin/TenantDetailView.tsx, components/admin/PersonDetailView.tsx).
- pp/api/admin/portal-invitation/route.ts um Firmensignatur der Vermieterfirma erweitert und lokale Folgeupdates beim Versand weiter auf Best-Effort gestellt.
-
pm run build nach dem Einladungsmail-/Popup-Feinschliff erfolgreich gruen.


## Update 2026-04-30 15:28
- Zahnrad-Menue in components/ProtectedAreaLayout.tsx ueberarbeitet: Einladungsmail-Link ergaenzt, Menue oeffnet jetzt bei Hover oder Klick, Links reagieren sichtbarer auf Hover und das Menue blendet sich beim Verlassen des Bereichs oder nach Navigation wieder aus.
- Einladungsmail in app/api/admin/portal-invitation/route.ts von Portalsignatur auf normale Mail-Signatur der Vermieterfirma umgestellt; der Platzhalter {{SIGNATURE}} nutzt jetzt buildSignatureText(createSignatureRecord(...)).
- npm run build nach Menue-/Signatur-Fix erfolgreich gruen.

## Update 2026-04-30 15:44
- Zahnrad-Menue in components/ProtectedAreaLayout.tsx weiter stabilisiert: Dropdown sitzt jetzt direkt unter dem Zahnrad mit Hover-Bruecke, damit der Mausweg zu den Links nicht mehr zusammenbricht.
- Einladungsmail-Fallback in app/api/admin/portal-invitation/route.ts gehaertet: wenn eine gespeicherte Vorlage leer oder kaputt ist, wird automatisch ein vollstaendiger Standardtext mit Zugangsdaten, Homepage, Portalerklaerung und Mail-Signatur verwendet.
- Standardtext in lib/portalInvitationSettings.ts sprachlich/zeichensauber auf ASCII-Deutsch bereinigt.

## Update 2026-04-30 16:04
- Einladungsmail in app/api/admin/portal-invitation/route.ts auf echte Mail-Signaturdarstellung umgestellt: HTML nutzt jetzt Logo, Ausrichtung, Divider und Detailblock der normalen Mail-Signatur statt der schlichten Portal-/Plaintext-Signatur.
- Neue Hilfsfunktion buildFullEmailSignatureHtml(...) in lib/signatures.ts ergaenzt, damit die Einladungsmail die Vorschau aus den Signatur-Einstellungen fachlich besser nachbildet.
- Zahnrad-Menue in components/ProtectedAreaLayout.tsx weiter toleranter gemacht: groesserer Hover-Bereich nach links und verzoegertes Schliessen, damit der Mausweg vom Zahnrad zu den Links stabiler bleibt.

## Update 2026-04-30 16:19
- Einladungsmail-Logo in app/api/admin/portal-invitation/route.ts auf Inline-Embedding umgestellt: relative Signatur-Logos aus public/uploads/signatures werden jetzt als cid-Anhang in die Mail eingebettet statt als lokal unerreichbarer Pfad referenziert.
- lib/smtp.ts fuer optionale Mail-Anhaenge erweitert, damit eingebettete Signatur-Logos ueber sendPortalEmail mitgeschickt werden koennen.
- Zahnrad-Menue in components/ProtectedAreaLayout.tsx leicht weiter nach links gerueckt, damit es nicht mehr am rechten Bildschirmrand klebt.

## Update 2026-04-30 16:46
- Wiedervorlage auf Themenebene erweitert: LocalMessageTheme / MessageTheme tragen jetzt reminderDate, die beim Antworten aus der Mieter-Themenansicht zusammen mit der Wiedervorlage gespeichert wird.
- Rechte Themenliste beim konkreten Mieter zeigt jetzt Wiedervorlage: TT.MM.JJJJ direkt in der Themenkachel.
- Dashboard um eigene Liste Themen mit Termin erweitert; diese greift themenbezogene Wiedervorlagen direkt auf und verlinkt in das konkrete Mieterthema.
- Normale Portal-/Themenmails ueber app/api/message-drafts/send/route.ts auf dieselbe hochwertige Mail-Signatur wie die Einladungsmail umgestellt, inklusive eingebettetem Logo per cid-Anhang.

## Update 2026-04-30 16:58
- Mail-Draft-Erzeugung fuer Antworten vereinheitlicht: TenantDetailView, PersonDetailView, MessagesWorkspace und MessageDetailWorkspace speichern fuer E-Mails jetzt nur noch den eigentlichen Nachrichtentext im Draft-Body. Die Mail-Signatur wird erst im Versandpfad app/api/message-drafts/send/route.ts sauber als Plaintext+HTML ergaenzt, damit keine alte unformatierte Signatur mehr ueber der formatierten Signatur auftaucht.
## 2026-04-30 17:35 - Themen-Wiedervorlage, Mail-HTML und Mieter-Reply-Flow
- `components/admin/TenantDetailView.tsx`: Themen-Metadaten robuster gemacht. `saveThemeMeta` speichert jetzt auch fuer neue Admin-Themen ohne ausgewaehlte Inbound-Nachricht, und lokale Themeneintraege aktualisieren Theme-Liste / Message-IDs sofort im State.
- `app/api/message-drafts/send/route.ts`: normale Mieter-Mails werden jetzt als komplettes UTF-8-HTML-Dokument verschickt; Inline-Logo kann auch aus lokalen absoluten App-URLs eingebettet werden.
- `app/api/admin/portal-invitation/route.ts`: gleiche robustere HTML-/Inline-Logo-Behandlung fuer Einladungsmails.
- `lib/signatures.ts`: mehrere kaputte Ternaries/Syntaxschaeden repariert, damit Build wieder sauber laeuft.
- Erwarteter Effekt: Wiedervorlagen sollten jetzt am Thema selbst persistieren und dadurch rechts in der Themenliste sowie im Dashboard erscheinen; gesendete Nachrichten im konkreten Mieter-Thema sollten nicht mehr am 404 auf `messages/{themeId}` scheitern und dadurch Eingabefeld/Verlauf direkt aktualisieren.
- Verifiziert: `npm run build` gruen mit Next.js 16.2.1.
## 2026-05-01 08:35 - KI-Neunachricht und Permission-Overlay
- `components/admin/TenantDetailView.tsx`: Bei `Neue Nachricht` werden fuer den KI-Entwurf keine alten Objekt-/Einheits-/Zaehlerdaten mehr mitgegeben. Direkter Client-Write in `followUps` entfernt; Wiedervorlage bleibt nur noch am Thema selbst und sollte damit keinen Firestore-Permission-Overlay mehr ausloesen.
- `app/api/ai/message-reply-draft/route.ts`: Prompt fuer Kontextmodus `Neue Nachricht` verschaerft. Alte Themen wie Wasserschaden, Zaehler oder Ablesung duerfen nicht mehr auftauchen, wenn die aktuelle Anweisung sie nicht ausdruecklich verlangt.
- Verifiziert: `npm run build` gruen.
## 2026-05-01 08:55 - 429 beim Mieter-Senden beseitigt
- `components/admin/TenantDetailView.tsx`: Client erzeugt fuer Tenant-Mails keine `messageDrafts` mehr direkt in Firestore. Der Browser schickt den Draft jetzt direkt an `/api/message-drafts/send`. Direkte Client-Writes fuer `messages` im Modus `both`/`letter` entfernt; der sichtbare Verlauf bleibt ueber lokale Theme-Eintraege konsistent.
- `app/api/message-drafts/send/route.ts`: Route akzeptiert jetzt alternativ ein komplettes `draft`-Payload ohne vorheriges Firestore-Dokument. Damit umgeht der Mieter-Sendefluss lokal Firestore-Quota/Rules beim Draft-Anlegen.
- Verifiziert: `npm run build` gruen.
## 2026-05-01 09:05 - Normale Mail-Signatur und aktive Themenmarkierung
- `app/api/message-drafts/send/route.ts`: Der normale Nachrichtenversand erkennt jetzt, ob `draft.signature` bereits ein fertiger `SignatureRecord` ist. In dem Fall wird er direkt weiterverwendet statt erneut durch `createSignatureRecord` aus Rohdaten gejagt. Dadurch sollten Logo, Umlaute und Form wie bei der Einladungsmail erhalten bleiben.
- `components/admin/TenantDetailView.tsx`: Aktives Thema rechts deutlicher markiert (staerkerer Hintergrund, Ring, klarere Rahmen-/Titelbetonung).
- Verifiziert: `npm run build` gruen.
## 2026-05-05 10:05 - Portal-ÃƒÅ“bersicht aufgerÃƒÂ¤umt
- `components/ProtectedAreaLayout.tsx`: FÃƒÂ¼r `requiredRole="portal"` zeigt die linke obere Kachel jetzt nur noch den Portal-Namen (`profile.displayName` / Benutzername) ohne `Interner Bereich`. Der obere Header-Bereich wird fÃƒÂ¼r Portal-Seiten komplett ausgeblendet.
- `app/mieterportal/page.tsx`: Die groÃƒÅ¸e Einstiegskachel mit `Portal`, Mieternamen und ErklÃƒÂ¤rungstext wurde entfernt.
- Verifiziert: `npm run build` grÃƒÂ¼n.
## 2026-05-05 10:28 - Portal-ÃƒÅ“bersicht auf Mieterblick umgebaut
- `components/ProtectedAreaLayout.tsx`: Portal-Seitenleiste lÃƒÂ¤dt jetzt den echten Portal-Anzeigenamen aus `/api/portal/context` und zeigt dadurch oben links den Mieternamen statt E-Mail/Benutzername.
- `app/mieterportal/page.tsx`: ÃƒÅ“bersicht komplett neu aufgebaut. Statt alter Kacheln jetzt BegrÃƒÂ¼ÃƒÅ¸ungstext, kompakte Mieterinformationen und ein ZÃƒÂ¤hlerbereich mit aktuellem Stand pro ZÃƒÂ¤hler.
- `app/api/portal/meters/route.ts`: Neuer Server-Endpunkt fÃƒÂ¼r ZÃƒÂ¤hlerstand-Meldungen aus dem Portal. Aktualisiert im Admin-Modus die Property/Unit-Meter in Firestore und im lokalen Portalmodus die hinterlegten lokalen Portaldaten.
- `app/api/portal/context/route.ts`: Lokaler Portal-Kontext liefert jetzt vorhandene `propertyData` aus `.portal-access.local.json` aus und unterstÃƒÂ¼tzt Meterdaten in `targetData`/`unitMeters`.
- `lib/localPortalAccess.ts`: Lokale Portalrecords um optionales `propertyData` erweitert.
- Verifiziert: `npm run build` grÃƒÂ¼n.
## 2026-05-05 10:42 - Portal-Uebersicht weiter beruhigt
- `app/mieterportal/page.tsx`: Mini-Dashboard-Kacheln auf der Uebersichtsseite weiter reduziert. Mieterinformationen jetzt als ruhige Zeilenuebersicht statt Einzelkarten; offene Themen nur noch als kleine Textzeile im Begruessungsblock.
- Portal-Uebersicht sprachlich bereinigt: sichtbare Umlaute/Trennzeichen im Begruessungstext, Zaehlerbereich und Zaehler-Popup korrigiert.
- Zaehleransicht bleibt ohne Historie; Portal zeigt nur den aktuellen Stand und erlaubt per Popup die Meldung von neuem Zaehlerwert plus Ablesedatum.
- Verifiziert: `npm run build` gruen.
## 2026-05-05 10:58 - Portal-Uebersicht Feinschliff
- `components/ProtectedAreaLayout.tsx`: Portal-Name links oben kompakter gemacht (`truncate`, kleinere Schrift), damit der Mietename in einer Zeile bleibt.
- `app/mieterportal/page.tsx`: Begruessungstext angepasst; statt des Ruhe-Hinweises steht jetzt der Hinweis, dass Zaehlerstaende unten aktualisiert werden koennen.
- Uebersichtsseite zeigt jetzt einen klickbaren Hinweis `Neue Nachrichten`, der direkt auf `/mieterportal/nachrichten` fuehrt.
- Bei den Mieterinformationen wurde `Adresse und Einheit` vor `Mietbeginn` ergaenzt.
## 2026-05-05 11:14 - Lokale Portal-Zaehler und Mojibake
- `components/admin/TenantAdminManager.tsx`: Lokale Portalzugang-Anlage uebergibt jetzt neben dem Tenant-Snapshot auch einen `propertySnapshot` mit Objekt-/Einheitsdaten sowie hinterlegten Zaehlern und Unit-Metern.
- `app/api/admin/portal-access/route.ts`: Speichert diesen `propertySnapshot` in `.portal-access.local.json` als `propertyData`, damit das Portal im lokalen Modus Objekt-/Einheitszaehler wirklich anzeigen kann.
- `lib/portalAccess.ts`: `cleanPortalText(...)` repariert jetzt haeufige Mojibake-Sequenzen (`StraÃƒÆ’Ã…Â¸e`, `Ãƒâ€šÃ‚Â·`, Umlaute usw.) direkt beim Lesen, damit alte lokale Portal-Datensaetze sauberer dargestellt werden.
- Verifiziert: `npm run build` gruen.
## 2026-05-05 11:24 - Portal ohne Zaehleruebersicht
- `app/mieterportal/page.tsx`: Zaehler-Kachel komplett aus der Portal-Uebersicht entfernt.
- Begruessungstext im Portal enthaelt keinen Zaehler-Hinweis mehr; Uebersicht fokussiert jetzt nur auf Mieterinformationen und den Einstieg in Nachrichten.
## 2026-05-05 11:39 - Portal-Nachrichten als Listenansicht
- `app/mieterportal/nachrichten/page.tsx` komplett umgebaut: statt Themenkarten jetzt oben ein Bereich fuer neue Nachrichten und darunter eine tabellarische Nachrichtenuebersicht mit Zeilen pro Nachricht.
- Im Portal wird fachlich ueberall `Nachrichten` statt `Themen` gezeigt.
- Dropdown `Aktuell` / `Archiv` ergaenzt; ein Klick auf eine Zeile oeffnet den Verlauf dieser Nachricht und darunter das Antwortfeld.
- Archivierte Nachrichten bleiben lesbar, Antwortfeld erscheint nur bei aktuellen Nachrichten.
## 2026-05-05 13:52 - Portal-Nachrichten in Uebersicht / Neu / Detail getrennt
- `app/mieterportal/nachrichten/page.tsx`: Nachrichten-Uebersicht jetzt nur noch mit Button `Neue Nachricht`, Dropdown `Aktuell/Archiv` und Tabellen-/Zeilenliste aller Nachrichten.
- `app/mieterportal/nachrichten/neu/page.tsx`: neue eigenstaendige Seite zum Schreiben einer neuen Nachricht.
- `app/mieterportal/nachrichten/[themeId]/page.tsx`: neue Detailseite fuer Verlauf und Antworten zu genau einer Nachricht.
- `app/mieterportal/nachrichten/_lib.ts`: gemeinsame Hilfen fuer Status-Labels und Datumsformatierung ausgelagert.
## 2026-05-05 14:03 - Portal-Navigation und Login-Ziel angepasst
- `app/mieterportal/layout.tsx`: Link-Reihenfolge im Portal geaendert auf `Nachrichten`, `Dokumente`, `Stammdaten`.
- Ehemalige Bezeichnung `Uebersicht` im Portal durch `Stammdaten` ersetzt.
- `lib/auth.ts`: Standard-Zielroute fuer Portal-Logins von `/mieterportal` auf `/mieterportal/nachrichten` umgestellt.
## 2026-05-05 14:17 - Portal-Nachrichtenkopf und CTA geschaerft
- `app/mieterportal/nachrichten/page.tsx`: oberste Kachel auf schlichten Willkommen-im-Mieterportal-Text reduziert.
- Button `Neue Nachricht` aus der oberen Kachel entfernt und gut sichtbar in die Kachel `Nachrichtenuebersicht` verlegt.
- Erklaertext `Alle Nachrichten untereinander...` unter `Nachrichtenuebersicht` entfernt.
## 2026-05-05 14:29 - Neue Portal-Nachricht mit Ruecksprung auf Uebersicht
- `app/mieterportal/nachrichten/neu/page.tsx`: Erklaertext unter `Neues Anliegen an die Verwaltung` entfernt.
- Nach erfolgreichem Senden bleibt der Portal-Flow nicht mehr auf einer Detailseite, sondern springt zur Nachrichtenuebersicht zurueck.
- `app/mieterportal/nachrichten/page.tsx`: Bei Rueckkehr mit `?sent=1` erscheint ein BestÃƒÂ¤tigungs-Popup `Nachricht wurde verschickt.` und der Query-Parameter wird direkt wieder bereinigt.

## 2026-05-05 - Portal-Nachrichten mit Anhaengen
- Mieter koennen im Portal jetzt bei neuer Nachricht und bei Antworten Anhaenge hochladen und mitsenden.
- Neue Upload-Route: /api/portal/attachments speichert Dateien lokal unter public/uploads/portal-attachments und gibt Portal-Links zurueck.
- /api/portal/messages speichert Anhang-Metadaten jetzt mit in lokale Portalnachrichten und Firestore-Nachrichten.
- Im Mieterportal werden Anhaenge im Nachrichtenverlauf als klickbare Dateien angezeigt.
- Im Adminbereich beim konkreten Mieter werden Portal-Anhaenge im Verlauf ebenfalls angezeigt.
- Verifiziert mit
pm run build (gruen).

## 2026-05-05 - Verlauf korrigiert
- Adminbereich beim konkreten Mieter: Verlauf jetzt mit neuester Nachricht oben statt unten.
- Doppelte Admin-Antworten im Verlauf behoben: tenant-sichtbare Antworten werden nicht mehr zusaetzlich als lokaler Spiegel eingetragen, solange sie bereits als echte Nachricht ueber den Sendepfad entstehen.
- Mieterportal Nachrichten-Detailseite: Antwortfeld jetzt vor dem Verlauf; Verlauf darunter und ebenfalls mit neuester Nachricht oben.
- Verifiziert mit
pm run build (gruen).

## 2026-05-05 - Admin-Nachrichten als globale Themen-Arbeitsansicht
- /admin/nachrichten nutzt fuer Posteingang und Archiv jetzt dieselbe Arbeitsansicht wie die konkrete Mieterseite.
- Links bleibt die komplette Kommunikations- und Verlaufssicht des jeweils ausgewaehlten Mieters/Themas erhalten.
- Rechts wurde die mieterbezogene Themenspalte durch eine globale Nachrichtenliste ueber alle Mieter ersetzt, sortiert nach letzter Aktivitaet.
- Auswahl laeuft ueber 	hemeId im Querystring, damit Themen direkt in der globalen Ansicht angesteuert werden koennen.
- Verifiziert mit
pm run build (gruen).

## 2026-05-05 - Globaler Nachrichtenkopf nachjustiert
- /admin/nachrichten: Rechte globale Liste zeigt jetzt wieder echte Mieternamen ueber 	enantId statt haeufig auf romName/romEmail zu fallen, wodurch Unbekannter Mieter verschwindet.
- Globale Nachrichtenansicht nutzt beim eingebetteten Mieterkopf keinen Bearbeiten-Button und keinen Einladungs-Button mehr.
- Der Mietername im Kopf der globalen Nachrichtenansicht wurde weiter nach rechts gesetzt, damit er die Tab-Leiste oben nicht mehr ueberlagert.
- Verifiziert mit
pm run build (gruen).

## 2026-05-05 - Admin-Nachrichten Kopf und Navigation gestrafft
- In /admin/nachrichten wurde Mieteruebersicht im eingebetteten Mieterkopf entfernt.
- Die Ansichten Posteingang, Archiv und Gesendet laufen jetzt ueber ein Dropdown statt ueber mehrere Buttons.
- Mail senden wurde in der Kopfnavigation durch Neue Nachricht ersetzt.
- In der globalen Nachrichtenansicht zeigt die grosse Arbeitskachel jetzt den Namen des aktuellen Mieters statt des Wortes Kommunikation.
- Verifiziert mit
pm run build (gruen).

## 2026-05-05 - Schwarzer Mieternamen-Kopf in globaler Nachrichtenansicht entfernt
- In /admin/nachrichten wird der grosse schwarze Mieternamen-Kopf oberhalb der Arbeitskachel jetzt nicht mehr angezeigt, wenn Bearbeiten/Einladung/Mieteruebersicht im Kopf deaktiviert sind.
- Verifiziert mit
pm run build (gruen).

## 2026-05-05 - Mieterdetailkarten weiter verdichtet
- In der eingebetteten Mietersicht wurden Zeilenabstaende der Info-Karten (Stammdaten, Zuordnung, usw.) deutlich reduziert.
- Detailzeilen haben jetzt kleinere vertikale Abstaende, schmalere Label-Spalte und kuerzere Zeilenhoehe.
- Verifiziert mit
pm run build (gruen).

- 2026-05-05: Admin-Nachrichten/Mieteransicht weiter verdichtet: Detailzeilen enger gesetzt, Labelspalte in den Infokarten verbreitert gegen Textueberlagerung und in 'Miete und Kaution' die doppelten Felder 'Kautionsart' und 'Buerge' entfernt. Build gruen.

- 2026-05-06: Admin-Nachrichtenansicht erweitert: eingebettete Mieterdetails zeigen jetzt im Nachrichtenmodus wieder Miete/Nebenkosten/Warmmiete/Umsatzsteuer/Gesamtmiete, naechste Mieterhoehungspruefung und die Mietentwicklungsgrafik. Zusatzelemente wie weitere Personen bleiben dort ausgeblendet. Build gruen.

- 2026-05-06: Admin-Nachrichtenansicht weiter verdichtet: in der eingebetteten Mietersicht fuer Nachrichten die Kachel 'Zuordnung' in 'Infos' umbenannt, Mietdaten/Steuernummer/Mieterhoehungsart/Naechste Pruefung dort integriert, separate Kachel 'Miete und Kaution' im Nachrichtenmodus entfernt und Zeilenabstaende der Detailzeilen weiter reduziert. Build gruen.

- 2026-05-06: Admin-Nachrichtenansicht weiter verdichtet: in der eingebetteten Mietersicht Objekt/Einheit nach Stammdaten verschoben, Steuernummer unter Telefon gesetzt, Kautionsart mit Barkautionshoehe in Stammdaten integriert, Kacheln 'Status und Pruefung' und 'Miete und Kaution' im Nachrichtenmodus entfernt. Gesamtmiete fuer Nachrichtenmodus neu berechnet: Kaltmiete+Nebenkosten, bei Umsatzsteuer zusaetzlich 19 Prozent. Build gruen.

- 2026-05-06: Admin-Nachrichtenansicht Layout angepasst: Verlauf nun unter Composer und rechter Nachrichtenliste ueber die volle Arbeitsbreite; in Stammdaten die Zeile Anrede entfernt und in den Namen integriert.

- 2026-05-06: Admin-Nachrichtenliste erweitert: jede Nachrichtskarte rechts hat jetzt ein X zum Loeschen; Klick oeffnet Popup 'Nachricht endgueltig loeschen?' mit Ja/Abbruch. Endgueltiges Loeschen markiert das zugehoerige Thema als geloescht. Build gruen.

- 2026-05-06: In der Admin-Nachrichten/Theme-Aktionsleiste den Button 'In Bearbeitung' entfernt, da Themen beim Oeffnen automatisch von Neu auf In Bearbeitung wechseln. Build gruen.

- 2026-05-06: Admin-Nachrichtenansicht aufgeraeumt: Option 'Gesendet' unter Ansicht entfernt; im Archivmodus wird links statt Composer nur der Verlauf gezeigt. Reaktivieren springt aus dem Archiv direkt zur offenen Nachrichtenansicht mit dem Thema und setzt es durch neues lastActivityAt oben ein. Build gruen.

- 2026-05-06: Archivmodus in der Admin-Nachrichtenansicht weiter reduziert: Thementitel-Feld und Speichern-Button sind im Archiv ausgeblendet. Build gruen.

- 2026-05-06: Archivansicht im Admin-Nachrichtenbereich weiter angepasst: Button 'Reaktivieren' von der Aktionsleiste in den Kopf neben den Mieternamen verschoben. Build gruen.

- 2026-05-06: Admin-Nachrichtenarchiv weiter bereinigt: die leere Aktionskachel im Archivmodus entfernt. Build gruen.

- 2026-05-06: Admin-Nachrichtenkopf verfeinert: linke Bereichskachel zeigt bei /admin/nachrichten nun dynamisch 'Posteingang' oder 'Archiv'. Einheit-Label in der eingebetteten Mietersicht gegen doppelte Teile bereinigt (z. B. 1.OG nicht doppelt). Build gruen.
- 2026-05-06: Admin-Nachrichtenansicht Datenanzeige korrigiert: Einheit zieht im eingebetteten Mieterblock nun die aktuelle Bezeichnung direkt aus der Einheit/Immobilie statt nur aus dem Tenant-Snapshot. Barkaution in Stammdaten als Eurobetrag formatiert, Display-Platzhalter von mojibake auf sauberen Gedankenstrich normalisiert. Build gruen.
- 2026-05-06: Admin-Nachrichtenansicht erweitert: unter Stammdaten/Infos eine neue Vollbreiten-Kachel fuer dem Objekt zugeordnete Gewerke und Dienstleister. Pro Zeile: Gewerk, Firma, Ansprechperson, Telefonnummer, E-Mail; Klick fuehrt auf die bestehende Person/Dienstleister-Detailseite.
- 2026-05-06: Reihenfolge in der eingebetteten Admin-Mietersicht angepasst: Kachel 'Gewerke und Dienstleister' jetzt vor 'Mietentwicklung'.
- 2026-05-06: Konkrete Mieterseite /admin/mieter/[id] auf Nachrichtenmodus umgestellt: nutzt jetzt denselben Steuerungsmodus wie die allgemeine Nachrichtenansicht (Ansicht-Dropdown Posteingang/Archiv, Button Neue Nachricht, rechte Nachrichtenliste mit Suche, Archiv/Inbox-Verhalten gleichgezogen). Im Standalone-Nachrichtenmodus zeigt die Hauptkachel den Mieternamen statt 'Kommunikation'.
- Konkrete Mieterseite im Nachrichtenmodus gleicht jetzt auch die linke Seitenleisten-Kachel an den allgemeinen Posteingang an: Bei `messageId`/`tab` auf `/admin/mieter/[id]` steht dort jetzt `Posteingang` oder `Archiv` statt `Mieter`.
- Der Ansicht-Dropdown auf der konkreten Mieterseite sendet jetzt denselben `admin-mailbox-view`-Status wie die allgemeine Nachrichtenseite, damit die Seitenleiste sofort synchron bleibt.
- Die konkrete Mieterseite `/admin/mieter/[id]` wird in der Seitenleiste jetzt konsequent wie die allgemeine Nachrichtenansicht behandelt: links oben steht dort im Nachrichtenmodus immer `Posteingang` bzw. `Archiv` statt `Mieter`.
- Konkrete Mieterseite im Nachrichtenmodus nutzt jetzt denselben Zweispalten-Grid wie der allgemeine Posteingang: die rechte Nachrichtenliste bleibt neben Composer/ArbeitsflÃƒÂ¤che und rutscht nicht mehr unter das Eingabefeld.
- Die obere Arbeitskachel im Nachrichtenmodus wurde vertikal gestrafft: weniger Top-Padding, geringerer Abstand unter der Titelzeile und kompaktere Aktionsbox, damit die oberen Buttons sauberer und hoeher sitzen.
- Auf Mieterseiten ohne Kopf-Aktionen wird die leere obere Header-Zeile nicht mehr gerendert. Dadurch verschiebt die alte Negativmarge den Nachrichtenblock nicht mehr nach unten.
- Auf Mieterseiten ohne Kopf-Aktionen wird die leere obere Header-Zeile nicht mehr gerendert. Dadurch verschiebt die alte Negativmarge den Nachrichtenblock nicht mehr nach unten.
- Build-Blocker nebenbei bereinigt: `app/ÃƒÂ¼ber/page.tsx` war leer und wurde als gueltiges Modul ergÃƒÂ¤nzt.
- In den Nachrichten-Infokacheln heisst `Einzug` jetzt `Mietbeginn`.
- Darunter wurden fuer beide Nachrichtenansichten `Mietende` und `Optionen` ergÃƒÂ¤nzt. Wenn im Datensatz nichts vorhanden ist, erscheinen die Defaultwerte `Unbefristet` und `Keine Option hinterlegt`.
- Unter `Nebenkosten` wird die ausgewiesene Umsatzsteuer jetzt als Eurobetrag gezeigt; `Gesamtmiete` bleibt die Summe inklusive Umsatzsteuer.
- Die Kachel `Mietentwicklung` ist aus beiden Admin-Nachrichtenansichten entfernt.
- Im Dashboard wurde die Mietentwicklungs-Grafik auf einen erweiterten Filter umgestellt: `Alle`, `Objekte`, `Firmen` und einzelne `Mieter`.
- `Bankbuergschaft` ist in der Nachrichten-Stammdatenkachel auf `BankbÃƒÂ¼rgschaft` korrigiert.
- Brief-Paginierung gestrafft: Die Vorschau reserviert auf jeder Seite jetzt konsequent Platz am unteren Rand, statt der ersten Seite kuenstlich Extra-Hoehe zu geben. Dadurch wird der Abschlussblock bei der ersten ueberlaufenden Zeile sauber auf eine zweite Seite umgebrochen.
- Brief-Paginierung weiter robuster gemacht: Der Umbruch misst jetzt direkt die reale Scrollhoehe des Brief-Body-Bereichs statt Body- und Closing-Offsets manuell zusammenzurechnen. Das ist verlÃƒÂ¤sslicher fuer den Fall, dass der Abschlussblock noch verdeckt unter der ersten Seite haengt.
- Der Briefmodus arbeitet jetzt ohne Seitenvorschau und Pagination. Stattdessen erscheint beim Versandmodus `Brief` ein direkt editierbares A4-Blatt mit sichtbarem Header, EmpfÃƒÂ¤ngerblock, Betreff, Footer und bearbeitbarem Body.
- Die Formatierungsleiste im Briefeditor bleibt erhalten.
- Alter Vorschau-/Pagination-Rest im Briefeditor entfernt. Der Briefmodus verwendet jetzt nur noch das direkte editierbare A4-Blatt.

- 2026-05-06: Admin-Nachrichtenlayout weiter angeglichen: Zweispalten-Grid im Nachrichtenmodus jetzt explizit verankert (linke Arbeitsflaeche Zeile 1 Spalte 1, rechte Nachrichtenliste Zeile 1 Spalte 2, Verlauf darunter ueber volle Breite). Rechte Spalte zugleich schmaler auf 248px reduziert, damit das editierbare A4-Blatt im Briefmodus mehr Platz bekommt und nicht mehr links abgeschnitten wird. Build gruen.

- 2026-05-06: Briefmodus im Admin-Nachrichtenbereich neu angeordnet: rechte Nachrichtenliste wieder mit 280px Breite, aber kuerzerer Listenhoehe; editierbares A4-Blatt im Briefmodus aus der linken Spalte in einen Vollbreiten-Bereich ueber die gesamte Arbeitsflaeche verschoben, wie der Verlauf darunter. Zusaetzlich die kuenstliche Mindesthoehe des A4-Viewport-Containers entfernt, damit zwischen Brief und Verlauf kein Leerraum mehr stehen bleibt. Build gruen.

- 2026-05-06: Briefmodus im Admin jetzt an die echte Briefvorlage aus Einstellungen > Brief gekoppelt. LetterComposeEditor rendert Header/Body/Footer direkt aus signature.letterTemplateHtml und portalt den editierbaren TipTap-Body in den vorgesehenen Body-Slot der Vorlage. Dadurch kommen Logo, Header, Footer und Layout aus derselben Vorlage wie in den Brief-Einstellungen. Build gruen.

- 2026-05-06: Briefeditor-Slot im A4-Template stabilisiert: Der Vorlagenrahmen aus der Briefvorlage wird im Compose-Modus nicht mehr bei jeder Body-Aenderung neu aufgebaut. Der editierbare TipTap-Body aktualisiert jetzt den Inhalt, ohne den Body-Slot selbst zu zerstÃƒÂ¶ren. Das behebt den Fall, dass KI-Entwuerfe zwar erzeugt werden, aber im Briefblatt nicht erscheinen. Build gruen.

- 2026-05-06: Briefeditor-Body-Sync nachgezogen: externer Text (z. B. KI-Entwurf) wird nun gegen den aktuellen TipTap-Inhalt geprÃƒÂ¼ft und mit setContent direkt in den Body geschrieben, statt nur gegen einen internen Ref zu vergleichen. Das stabilisiert den Fall, dass KI-EntwÃƒÂ¼rfe im Briefmodus erzeugt, aber nicht sichtbar wurden. Build gruen.

- 2026-05-06: Doppelter Editor-Mount im Briefmodus entfernt. LetterComposeEditor hatte oberhalb des A4-Blatts noch einen separaten 'Briefinhalt'-Editor fuer denselben TipTap-Editor. Dieser Block ist jetzt weg, damit der Body nur noch einmal existiert und im A4-Blatt selbst gerendert wird. Build gruen.

- 2026-05-06: Briefeditor von React-Portal auf Overlay-Render umgestellt. Der editierbare TipTap-Body wird jetzt nicht mehr in den Vorlagen-Slot portaled, sondern exakt ueber dem gemessenen Body-Bereich der gespeicherten Briefvorlage positioniert. Das umgeht Slot-/Portal-Probleme und sorgt dafuer, dass KI-Entwuerfe sowie manueller Text im A4-Blatt sichtbar sind. Build gruen.

- 2026-05-06: Briefeditor-Overlay korrekt in denselben relativen A4-Container gezogen. Der editierbare Body war zuvor als falsches Geschwister des Briefblatts positioniert; jetzt liegt er im selben positionierten Wrapper wie die Vorlagenflaeche. Das behebt den Fall, dass KI-Entwuerfe bei Mail sichtbar, bei Brief aber unsichtbar blieben. Build gruen.

- 2026-05-06: Briefeditor-Body-Messung im A4-Template korrigiert. Der Overlay-Body wurde zuvor ueber getBoundingClientRect() in skalierten Pixeln gemessen und dann im unskalierten Blatt positioniert. Jetzt nutzt der Editor fuer den Body-Slot offsetLeft, offsetTop, offsetWidth und offsetHeight/scrollHeight aus dem echten Layout. Das richtet den editierbaren Body im Briefmodus an die korrekte Stelle der Vorlage aus. Build gruen.
- 2026-05-06: Briefeditor-Body in LetterComposeEditor jetzt nicht mehr am leeren Compose-Slot gemessen, sondern am echten [data-letter-body="true"]-Container. Damit soll der KI-Entwurf im Briefblatt in normaler Breite statt als schmale Buchstabenspalte erscheinen. useEffect-AbhÃƒÂ¤ngigkeit fÃƒÂ¼r die Body-Messung auf konstante Form gebracht.
- 2026-05-06: Briefeditor-Overlay in LetterComposeEditor misst den Body-Slot jetzt per getBoundingClientRect relativ zum echten A4-Canvas und rechnet die Skalierung ueber sheetScale heraus. Ziel: korrekte linke/top Position und volle Breite des editierbaren Briefkoerpers statt schmaler vertikaler Textspalte links.
- 2026-05-06: LetterComposeEditor nutzt im Briefmodus jetzt keinen absolut positionierten Overlay-Editor mehr. Der TipTap-Editor wird per createPortal direkt in den echten Compose-Slot der Briefvorlage gemountet. Damit entfaellt die fehleranfaellige Slot-Messung, die zuvor den KI-Entwurf als schmale vertikale Textspalte links zeigte bzw. kurz aufblitzen liess.
- 2026-05-06: Briefvorlage in LetterComposeEditor als memoisiertes StaticTemplateSheet gekapselt. Ziel: der per createPortal gemountete Body-Slot bleibt bei KI-Entwurf und Editor-Updates stabil und wird nicht durch wiederholtes dangerous innerHTML-Neurendern kurz aufgebaut und sofort wieder entfernt.
- 2026-05-06: LetterComposeEditor rendert die Briefvorlage im Compose-Modus jetzt ohne Portal/Overlay direkt als feste Struktur: Header-Section, Body-Section mit Editor inline im data-letter-body-Bereich und Footer-Section. buildLetterComposeLayout liefert dafuer Body-Sektion und Body-Container getrennt aus. Ziel: stabil sichtbarer KI-Entwurf direkt im Briefkoerper.

- 2026-05-06: Briefmodus in LetterComposeEditor auf feste DIN-A4-Seiten umgestellt. Seite 1 bleibt jetzt hart auf 1123px Hoehe mit verstecktem Overflow im Body-Bereich; fuer laengeren Text werden mit buildLetterBodyPageFragments und buildLetterEditorPageTemplates echte Folgeseiten aus derselben Briefvorlage darunter erzeugt. Die Fortsetzungsseiten rendern ohne Header und uebernehmen den Abschlussblock erst auf der letzten Seite, wenn noch Platz ueber der Footerlinie ist.

- 2026-05-06: Briefmodus weiter beruhigt: Fortsetzungsseiten werden im Compose-Modus jetzt auf maximal eine zweite Seite zusammengefasst. Der Abschlussblock auf Seite 1 wird nur noch gerendert, wenn es keine Fortsetzungsseite gibt; dadurch entsteht beim leeren Brief keine automatische zweite Seite nur wegen 'Mit freundlichen Gruessen'. Bei Ueberlauf wird der Rest des Brieftexts zusammen mit dem Abschlussblock auf einer einzigen Seite 2 gerendert, ohne Header.

- 2026-05-06: Dubletten im Briefmodus weiter angegangen: Seite 2 wird nicht mehr aus einer theoretischen Fragmentliste zusammengesetzt, sondern aus dem tatsaechlich ueberlaufenden Teil des live gerenderten ProseMirror-Brieftexts. Dazu misst LetterComposeEditor die echten Top-Level-Knoten im ersten Briefblatt, clippt Seite 1 am ersten ueberlaufenden Block und rendert nur diese ueberlaufenden Knoten als einzige Fortsetzungsseite mit Abschlussblock. Ziel: keine wiederholten Textpassagen zwischen Seite 1 und 2.

- 2026-05-06: Briefmodus weiter verfeinert: Der editierbare Body auf Seite 1 reserviert jetzt den realen Platz fuer Begruessung und Abschlussblock, statt die komplette Body-Sektion fuer den Editor zu beanspruchen. LetterComposeEditor misst dafuer die Hoehe der vor- und nachgelagerten Template-Bloecke und clippt den Editor nur auf den verbleibenden Raum. Auf Seite 2 wird der Abschlussblock inline direkt hinter den ueberlaufenden Resttext gesetzt, damit kein grosser Leerraum zwischen Resttext und 'Mit freundlichen Gruessen' entsteht.

- 2026-05-06: Briefmodus erneut vereinfacht. Der Versuch, Seite 2 aus dem live ueberlaufenden ProseMirror-Anteil zu schneiden, wurde verworfen. LetterComposeEditor nutzt jetzt wieder einen klaren, stabileren Weg: ein editierbarer Brief-Body nur im ersten A4-Blatt mit fixer Hoehe und internem Scrollen; alle Folgeseiten werden aus buildLetterBodyPageFragments erzeugt und ohne Header darunter angezeigt. Ziel: keine theoretisch/visuell auseinanderlaufenden Split-Logiken mehr zwischen Seite 1 und den Fortsetzungsseiten.

- 2026-06-02: Strategiewechsel fuer den Briefmodus beschlossen, aber noch nicht umgesetzt. Der bisherige Live-Mehrseiten-Briefeditor wird verworfen. Neuer Ziel-Flow: Bei Versandart Brief verhaelt sich die Bearbeitung zunaechst wie bei Mail (KI-Entwurf, Editor, Textaenderungen im normalen Editor). Beim Klick auf Senden wird keine E-Mail verschickt; stattdessen wird im Verlauf ein Eintrag mit Kennzeichnung Brief gespeichert. Gleichzeitig wird lokal eine Office-Datei aus einer firmenspezifischen Briefvorlage geoeffnet (auf dem jeweiligen Rechner im Standardprogramm, z. B. OpenOffice oder Microsoft Word). Die Vorlage wird je Firma in den Einstellungen hinterlegt. Der im Programm verfasste Brieftext soll in diese Vorlage eingesetzt werden, damit finaler Layout-Feinschliff und Druck ausserhalb des Programms in Word/OpenOffice erfolgen.

- 2026-06-02: Erste Umsetzung der Briefmodus-Auslagerung: In MessagesWorkspace, TenantDetailView und MessageDetailWorkspace nutzt Versandart Brief jetzt wieder den normalen Texteditor statt LetterComposeEditor/Live-A4-Editor. Die alten printLetterHtml-Aufrufe wurden durch downloadLetterDocument(...) ersetzt. Neue Datei components/admin/letterOfficeExport.ts erzeugt aus dem bestehenden Brief-HTML eine Word-kompatible .doc-Datei und startet den Download. Der Verlaufseintrag bleibt weiterhin als channel: letter dokumentiert. Build gruen mit npm.cmd run build.

- 2026-06-02: Verlaufskanal fuer Nachrichten ergaenzt: Ausgehende Verlaufseintraege zeigen neben der Ueberschrift jetzt (Mail), (Brief) oder (Brief und Mail). message-drafts/send speichert deliveryMode im gesendeten Mail-Verlauf. Lokale Portal-/Briefverlaufseintraege persistieren deliveryMode ebenfalls. Versandart Beides erzeugt jetzt neben der Mail auch die Word-kompatible Briefdatei. Build gruen mit npm.cmd run build.

- 2026-06-02: Einstellungen > Brief auf firmenspezifische Word-Vorlagenverwaltung umgestellt. Der alte sichtbare Brief-Vorlageneditor mit Untertabs Vorlage/Anrede/Abschluss wurde aus der Einstellungsnavigation entfernt. Neue Komponente components/admin/AdminLetterTemplateSettings.tsx listet Firmen, zeigt vorhandene Vorlage und erlaubt Upload/Entfernen von .doc/.docx/.dot/.dotx pro Firma. Neue Route app/api/admin/letter-templates/route.ts speichert Dateien lokal unter public/uploads/letter-templates und gibt Metadaten zurueck; Metadaten werden an companies gespeichert (letterTemplateUrl, letterTemplateOriginalName usw.). Build gruen mit npm.cmd run build.

- 2026-06-02: Zweite Betreffzeile fuer Briefe ergaenzt. lib/signatures.ts kennt jetzt die Platzhalter {{BETREFF_ZEILE_2}} und {{SUBJECT_LINE_2}}; der aktuelle HTML/.doc-Uebergang rendert diese Zeile unter dem Betreff. Die drei Brief-Erzeugungsstellen fuellen die zweite Betreffzeile automatisch aus Objektadresse plus Einheit (StraÃƒÅ¸e Hausnummer, PLZ Ort Ã‚Â· Einheit). Build gruen mit npm.cmd run build.

- 2026-06-02: Briefversand nutzt jetzt hochgeladene Word-Vorlagen, sofern an der Firma letterTemplateUrl hinterlegt ist. Neue Route /api/admin/letter-documents liest die .docx aus public/uploads/letter-templates, ersetzt Platzhalter in Word-XML-Dateien und liefert eine fertige .docx aus. Neue Hilfen lib/docxTemplate.ts und downloadFilledLetterTemplate(...). Fallback bleibt: ohne Firmenvorlage wird weiterhin die alte Word-kompatible .doc aus Brief-HTML erzeugt. Ersetzte Platzhalter u. a. {{BETREFF}}, {{SUBJECT}}, {{BETREFF_ZEILE_2}}, {{BRIEFTEXT}}, {{EMPFAENGER_BLOCK}}, {{DATUM}}, {{ANREDE}}. Build gruen mit npm.cmd run build.

- 2026-06-02: DOCX-Platzhalterersetzung robuster gemacht. lib/docxTemplate.ts ersetzt Platzhalter jetzt auch, wenn Word/OpenOffice sie intern ueber mehrere <w:t>-Textknoten splitten. Das soll Faelle beheben, in denen einzelne Platzhalter in der hochgeladenen Vorlage nicht erkannt wurden. Build gruen mit npm.cmd run build.

- 2026-06-02: DOCX-Vorlagenbefuellung nach Word-Test korrigiert: Mehrzeilige Werte wie {{EMPFAENGER_BLOCK}} und {{BETREFF_ZEILE_2}} werden jetzt mit echten Word-Zeilenumbruechen (w:br) ersetzt statt als zusammenlaufender Text. Zusaetzlich Platzhalter {{ABSCHLUSS}}, {{CLOSING}} und {{CLOSING_BLOCK}} ergaenzt; Abschluss kommt aus der Firmensignatur, Fallback Mit freundlichen GrÃƒÂ¼ÃƒÅ¸en. Build gruen mit npm.cmd run build.

- 2026-06-02: Absenderperson dynamisch gemacht. Neue Hilfsdatei components/admin/adminSenderSignature.ts ermittelt den eingeloggten Adminnamen aus profile.displayName, Firebase-DisplayName oder E-Mail und ueberschreibt damit signature.name/portalName. Angewendet in MessagesWorkspace, TenantDetailView, MessageDetailWorkspace und PersonDetailView fuer Mail-/Portal-/Briefsignaturen. {{ABSCHLUSS}} in Word-Vorlagen enthaelt jetzt Abschlussformel, eingeloggten Namen und Firmenname untereinander. Build gruen mit npm.cmd run build.

- 2026-06-02: DOCX-Abschlussformatierung verfeinert. {{ABSCHLUSS}}/{{CLOSING_BLOCK}} erzeugt jetzt Abschlussformel, danach drei Word-Zeilenumbrueche vor dem Namen, zwei Word-Zeilenumbrueche vor der Firma; Firmenzeile wird kleiner gesetzt (w:sz 18). Build gruen mit npm.cmd run build.

- 2026-06-02: DOCX-Platzhalterersetzung auf Tahoma normalisiert. Neu erzeugte Word-Runs fuer mehrzeilige Platzhalter und Abschluss ({{ABSCHLUSS}}/{{CLOSING_BLOCK}}) setzen jetzt explizit w:rFonts Tahoma; Abschlussname nutzt Standardgroesse 22 half-points, Firmenzeile 18 half-points. Build gruen mit npm.cmd run build.

- 2026-06-02: DOCX-Schriftformatierung konsequent normalisiert. Bei der Word-Vorlagenbefuellung werden vorhandene Text-Runs jetzt auf Tahoma 10 pt gesetzt, Bild-Runs bleiben unveraendert. Neu eingefuegte Platzhalter-Runs nutzen ebenfalls Tahoma 10 pt; Firmenzeile im Abschluss Tahoma 8 pt. Ziel: keine Mischung aus Arial/Times/Tahoma mehr. Build gruen mit npm.cmd run build.

- 2026-06-02: DOCX-Blocksatzproblem behoben. Bei der Word-Vorlagenbefuellung werden Absatz-Eigenschaften jetzt auf linksbuendig (w:jc left) normalisiert, damit Word die Woerter nicht wegen Blocksatz ueber die komplette Zeile auseinanderzieht. Build gruen mit npm.cmd run build.

- 2026-06-02: DOCX-Blocksatz erhalten und Lueckenursache korrigiert. Die vorherige Linksbuendig-Normalisierung wurde entfernt. Fuer {{BRIEFTEXT}}/{{BODY}}/{{BODY_TEXT}} werden harte Zeilenumbrueche beim Einsetzen zu Leerzeichen normalisiert, damit Word den Blocksatz natuerlich umbrechen kann und keine riesigen Wortabstaende durch manuelle Zeilenumbrueche entstehen. Adresse/Abschluss behalten echte Zeilenumbrueche. Build gruen mit npm.cmd run build.

## 02.06.2026 - Word automatisch oeffnen
- Bei Brief und Brief+Mail wird eine ausgefuellte Firmen-DOCX jetzt lokal unter .generated-letters gespeichert und direkt ueber das Betriebssystem geoeffnet.
- app/api/admin/letter-documents/route.ts akzeptiert openLocal=true und startet unter Windows cmd /c start fuer die erzeugte Datei.
- components/admin/letterOfficeExport.ts sendet openLocal standardmaessig true; bei JSON-Antwort wird kein Browser-Download mehr gestartet.
- Build mit npm.cmd run build war erfolgreich.

## 02.06.2026 - Auto-Oeffnen wieder entfernt
- Automatisches lokales Oeffnen von erzeugten Word-Dateien wurde wieder rueckgaengig gemacht.
- Bei Brief und Brief+Mail wird die ausgefuellte DOCX wieder normal als Browser-Download ausgeliefert, damit es auch online sauber funktioniert.
- Build mit npm.cmd run build war erfolgreich.

## 02.06.2026 - DOCX Footer/Header unveraendert lassen
- DOCX-Befueller verarbeitet jetzt nur noch word/document.xml.
- Header/Footer werden nicht mehr normalisiert oder neu geschrieben, damit Fusszeilen aus der Word-Vorlage unveraendert bleiben.
- Build mit npm.cmd run build war erfolgreich.

## 02.06.2026 - Freie E-Mail-Signatur
- Einstellungen > Signaturen hat jetzt eine freie HTML-Vorlage fuer E-Mail-Signaturen je Firma.
- Neues Firmenfeld: signatureEmailTemplateHtml; wird beim Mailversand vor der alten festen Signatur bevorzugt.
- Platzhalter u.a. {{NAME}} und {{SIGNATURE_NAME}} werden gerendert; der Name kommt in den normalen Versandpfaden aus dem eingeloggten Admin, weil applyAdminSenderToSignature den Signaturdatensatz vorher ueberschreibt.
- Signatur kann in den Einstellungen geloescht werden; alte feste Signatur bleibt nur Fallback, wenn keine freie Vorlage hinterlegt ist.
- Build mit npm.cmd run build war erfolgreich.

## 04.06.2026 - Aktueller Stand nach Dokumenten- und Nachrichten-Ausbau

### Git / Build / Dev-Server
- Aktueller sauberer Commit vor dieser Kontext-Aktualisierung: c736d54 Fix Dashboard Reminder Keys.
- Davor wurde der groessere Sicherungsstand 5b5f0c2 Sicherung Verwaltungsbereich und Dokumente erstellt.
- git status war nach c736d54 sauber.
- npm.cmd run build war erfolgreich.
- Der lokale Dev-Server laeuft wieder unter http://localhost:3000.
- Nach dem Dashboard-Key-Fix wurde der Next-Dev-Server neu gestartet, weil der Browser noch ein altes Bundle mit der alten React-Key-Warnung angezeigt hatte.

### Dokumente / Uploads / Firebase Storage
- Firebase Storage ist aktiviert und die Storage-Regeln wurden erweitert.
- Dokumentuploads funktionieren jetzt tatsaechlich ueber Firebase Storage.
- Es gibt eine gemeinsame Dokumentbibliothek mit Kategorien.
- Dateien koennen je nach Bereich hochgeladen, angesehen/geoeffnet und geloescht werden.
- Dokumentkategorien: Standardkategorien, neue Kategorien hinzufuegen, Kategorien wieder loeschen.
- Im Filter-Dropdown erscheinen nur Kategorien, in denen wirklich Dateien vorhanden sind.
- Die neue Dokumentbibliothek wird fuer mehrere Bereiche genutzt, unter anderem Mieter, Immobilien, Einheiten, Firmen und Dritte/Dienstleister.
- Alte Uploadfelder wurden weitgehend durch die neue Kategorie-Dokumentbibliothek ersetzt.
- Dokumentupload-Kacheln sollen in Detailansichten moeglichst ganz unten stehen.

### E-Mail-Anhaenge
- Eingehende Mailanhaenge werden verarbeitet und als Dokumente im passenden Kontext abgelegt, soweit eine Zuordnung moeglich ist.
- Bilder, PDFs, Docs, Videos und sonstige Dateien sollen nicht durch die App blockiert werden. Wenn der Mailserver eine Mail ablehnt, liegt das ausserhalb der App.
- Im Nachrichtenverlauf werden Anhaenge direkt an der jeweiligen Nachricht angezeigt.
- Vorschaufaehige Dateien werden klein angezeigt, damit der Chat nicht ueberladen wird.
- Nicht direkt vorschaufaehige Dateien erscheinen als klickbare Datei.
- Anhaenge koennen im Chat/Verlauf geloescht werden; dabei wird auch die zugehoerige Dokumentreferenz entfernt.
- In der Dokumentbibliothek erscheinen alte reine Dateinamen ohne echten Upload separat und koennen geloescht werden.

### Nachrichten- und Chat-Oberflaeche
- Die allgemeine Nachrichtenansicht und die Mieter-Chatansicht wurden umgebaut.
- Nachrichten-/Themenliste steht links.
- Verlauf steht ueber dem Eingabefeld.
- Aktionen wie Erledigt, Splitten, Thema zusammenfuehren und Thementitel speichern stehen zwischen Verlauf und Eingabefeld.
- Das Eingabefeld sitzt unter Verlauf und Aktionsleiste.
- Die Ansicht wurde optisch flacher gemacht: weniger verschachtelte Karten, mehr horizontale Trenner.
- Einzelne Nachrichten in Liste und Verlauf haben keine eigenen grossen Kartenrahmen mehr.

### Mieterwechsel / ehemalige Mieter
- Einheit, Immobilie und Mieter bleiben getrennte Datenbereiche.
- Ehemalige Mieter bleiben als Profile erhalten.
- Chatverlauf, Chatfunktion und Dateien bleiben auch nach Ende des Mietverhaeltnisses erhalten.
- In der Mieteruebersicht gibt es Filter fuer aktive, zukuenftige/in Vorbereitung befindliche, ehemalige und alle Mieter.
- Beim Anlegen eines Mieters kann eine bereits belegte Einheit als zukuenftiges Mietverhaeltnis genutzt werden.
- Bei bestehenden Mietern gibt es eine Funktion, das Mietverhaeltnis zu beenden, ohne das Profil zu loeschen.
- Beim Beenden wird die Einheit nur dann freigegeben, wenn der beendete Mieter dort aktuell als aktiver Mieter hinterlegt war.

### Immobilien / Einheiten / Wartungen / Zaehler
- Immobilien-Detailansicht wurde umsortiert: Objektdaten oben, Einheiten weit oben, Zaehleruebersicht ueber Wartungen dokumentieren, Dokumentupload unten.
- Einheit-Detailansicht wurde kompakter: Einheitdaten oben; Objekt, Geschoss, Position und Status nebeneinander.
- Objektzaehler liegen auf Hauptimmobilienebene, nicht mehr doppelt in Einheiten.
- Einheiten koennen weiterhin eigene Heizungen/Thermen mit Wartungsdatum und Erinnerungsintervall haben.
- Wartungen fuer Heizung, Dach und Regenrinnenreinigung haben ein einstellbares Erinnerungsintervall in Monaten.
- Dashboard-Erinnerungen nutzen jetzt eindeutige interne Keys, damit mehrere Erinnerungen an derselben Immobilie am selben Datum keine React-Key-Warnung mehr ausloesen.

### Dienstleister / Gewerke
- Dienstleisterzuordnung wurde kompakter als Dropdown-Workflow umgesetzt: Dienstleisterart auswaehlen, Firma/Person auswaehlen, speichern.
- Zugeordnete Dienstleister erscheinen als Zeile, fuehren zur Detailseite und koennen wieder geloescht werden.
- Dienstleisterarten wurden erweitert und alphabetisch gedacht, inklusive Tischler und Sonstiges.
- Diese Zuordnungslogik soll bei Immobilien und Einheiten gleich funktionieren.

### Vorlagen / Uebergabeprotokoll
- Einstellungen > Brief wurde fachlich in Richtung Vorlagen erweitert.
- Uebergabeprotokolle fuer Einzug und Auszug sind als Vorlagen vorgesehen.
- In der Mieteransicht gibt es eine schlanke Uebergabe-Auswahl oben in der Nachrichtenzeile: Dropdown fuer Einzug/Auszug plus Bestaetigungsbutton.
- Das Uebergabeprotokoll ist nicht mehr Teil der Dokumentenkachel selbst.

### Rechte / Mitarbeiter
- Mitarbeiterrechte sind so gedacht, dass deaktivierte Bereiche fuer Mitarbeiter ausgeblendet werden.
- Direkte Einstellungszugriffe ueber Profil/Zahnrad wurden nachgezogen, damit gesperrte Einstellungsbereiche nicht ueber Umwege erreichbar sind.
- Super-Admin-Daten sollen im Programm bearbeitbar sein.
- Signaturen, Mails und Briefe nutzen die Daten des aktuell eingeloggten Verwalters fuer Name, Telefon und Mobilnummer, soweit im Profil vorhanden.

### Wichtig fuer den naechsten Einstieg
- .env.local enthaelt lokale Geheimnisse und darf nicht committed werden.
- Bei Next.js-Aenderungen weiterhin zuerst die lokale Doku unter node_modules/next/dist/docs/ lesen.
- Wenn ein rotes Next-Overlay nach einem Fix unveraendert bleibt, erst Dev-Server neu starten und im Browser hart neu laden: Strg + F5.
- Nach jeder groesseren Aenderung npm.cmd run build ausfuehren.
## 06.06.2026 - Aktueller Stand nach Dashboard-, Design- und Briefkontext-Fixes

### Build / Git
- npm.cmd run build wurde nach den letzten Aenderungen erfolgreich ausgefuehrt.
- Vor dem Commit waren geaendert: components/admin/AdminDashboardOverview.tsx, components/admin/MessagesWorkspace.tsx und diese kontext.md.
- .env.local bleibt lokal und wird nicht committed.

### Dashboard
- Dashboard wurde nach dem Prinzip weniger ist mehr ueberarbeitet.
- Die Dashboard-Kacheln sind jetzt undurchsichtig und wie die restliche Oberflaeche abgerundet.
- Kleine Statistik-/Rasterelemente wurden ebenfalls optisch an die restliche Verwaltungsoberflaeche angepasst.

### Nachrichten / Dienstleister / Briefe
- Wartungs-Erinnerungen aus dem Dashboard koennen direkt in den Nachrichtenbereich fuehren.
- Bei Wartungen wird der zugeordnete Dienstleister vorausgewaehlt und die KI kann sofort einen passenden Entwurf erzeugen.
- Beim Briefversand an Dienstleister bleibt der Objektkontext erhalten.
- Die Briefvorlage wird bei objektbezogenen Dienstleister-Briefen zuerst aus der Firma der Immobilie gezogen, nicht aus der Dienstleisterfirma.
- Dadurch funktioniert z. B. Dachwartung Brandenburger Strasse mit der Briefvorlage der zugehoerigen Objektfirma.
- Falls bei der Objektfirma keine Briefvorlage gespeichert ist, faellt das System weiter auf die einfache .doc-Variante zurueck; mit Vorlage wird .docx erzeugt.
- Signatur, E-Mail-Draft, Briefverlauf und Wiedervorlage nutzen denselben Objekt-/Firmenkontext.
- Briefe an Dienstleister speichern nun auch die Dienstleister-Kontakt-ID im Verlauf.
- Wenn ein Dienstleister als Firma ohne einzelne Kontaktperson hinterlegt ist, wird fuer Briefe dessen Firmenadresse genutzt.

### Behobene Fehlmeldung
- In der allgemeinen Nachrichtenansicht wurde teilweise faelschlich die Mieter-Detailansicht geladen, wenn ein Thema keine echte Mieterzuordnung hatte.
- Dadurch erschien nach Dienstleister-Briefen die Meldung Der Mieter wurde nicht gefunden.
- Das wurde korrigiert: Die Mieteransicht wird nur noch geladen, wenn der referenzierte Mieter wirklich existiert.

## 16.06.2026 - Mobile Admin-/Portal-Reparaturen, Nachrichten und Uebergabe

### Dev / Zugriff
- Next.js laeuft lokal mit `npm run dev -- --hostname 0.0.0.0`.
- Desktop-Link: `http://localhost:3000`.
- Handy im selben WLAN: `http://192.168.178.141:3000`.
- `next.config.ts` enthaelt `allowedDevOrigins: ['192.168.178.141']`, damit der Dev-Server auf dem Handy sauber erreichbar ist.
- Fuer Next.js-Aenderungen wurde gemaess AGENTS.md die lokale Next-Doku in `node_modules/next/dist/docs/` gelesen.

### Lokaler Portal-Login / Mobile Portal
- Lokaler Portal-Login wurde wiederhergestellt und gegen lokale Portal-Daten verdrahtet.
- Betroffene API-Routen: `app/api/portal-local/login`, `session`, `logout`, `app/api/portal-auth/resolve`, `app/api/portal/context`, `messages`, `attachments`.
- `app/mieterportal/layout.tsx` prueft lokale Portal-Sessions und verwendet lokale Kontextdaten.
- `app/layout.tsx` exportiert jetzt einen mobilen Viewport (`width: device-width`, `initialScale: 1`).

### Mobile Admin-Oberflaeche
- `ProtectedAreaLayout` wurde mobil stabilisiert: Sidebar verschwindet unter `lg`, mobile Navigation ist vorhanden, Hauptbereiche nutzen `min-w-0` und verhindern horizontales Scrollen.
- `app/globals.css` verhindert in der mobilen Admin-Shell horizontales Scrollen robuster (`overflow-x: clip`, max-width-Regeln, Medien/Formulare max. 100%).
- Dashboard und Nachrichtenbereich wurden auf mobile Breiten angepasst.
- Dashboard-Titel im Adminbereich wurde auf `Ueberblick` reduziert; die Postfach-Synchronisationsnotiz bleibt darunter.

### Dashboard
- `AdminDashboardOverview` zeigt im Dashboard bei den relevanten Kacheln zuerst nur drei Eintraege.
- Buttons in den Kacheln oeffnen die jeweilige gefilterte Liste; `Alle` zeigt die vollstaendige Liste.
- `Bestand` steht unter `Heute relevant`.
- `Fristen` und `Mieterhoehungen` wurden getrennt: Fristen enthalten keine Mieterhoehungen; Mieterhoehungen zeigt nur aktive/zeitnahe Erinnerungen.
- Dashboard-Kategorien umfassen u. a. Offen, Neu, Fristen, Mieterhoehung, Firmen, Immobilien, aktive Mieter und Leerstand.

### Nachrichtenuebersicht / bekannte und unbekannte Absender
- `MessagesWorkspace` wurde mobil gegen abgeschnittene Inhalte und horizontales Scrollen repariert.
- Klick auf unbekannte Absender oeffnet eine eigene Seite `/admin/nachrichten/[messageId]`.
- Auf dieser Einzel-Nachrichtenseite steht der Verlauf oben, darunter der Antwortbereich, dann Absender-Einordnung.
- Unbekannte Absender koennen direkt beantwortet werden, ohne vorher als Mieter/Dienstleister angelegt zu sein.
- Unbekannte Absender koennen auf der Einzel-Nachrichtenseite einem Mieter zugeordnet werden.
- Unbekannte Absender koennen von dort aus als Dienstleister/Kontakt neu angelegt werden.
- Antworten an unbekannte Absender werden als E-Mail-Empfaenger behandelt, solange noch kein Mieter zugeordnet ist.
- Klick auf bekannte Mieter-Nachrichten in der allgemeinen Nachrichtenuebersicht fuehrt direkt zu `/admin/mieter/[id]?messageId=[themeId]`.
- Die allgemeine Nachrichtenuebersicht bettet keine globale Alle-Absender-Liste mehr unter der Mieteransicht ein.
- `/admin/nachrichten` ohne `themeId` zeigt nur die Nachrichtenliste und laedt nicht automatisch den ersten Mieter-Vorgang.

### Einzel-Nachrichtenseite
- `MessageDetailWorkspace` wurde fuer mobile Nutzung korrigiert.
- Verlauf steht ueber `Direkt antworten`.
- Lange Betreff-/Absender-/Nachrichtentexte brechen um.
- Mobile Chatkarten haben keine seitlichen Einrueckungen mehr.
- Antwort-, Zuordnungs- und Notizkacheln nutzen `min-w-0` und `overflow-x-hidden`.

### Uebergabeprotokoll
- In der Mieter-Nachrichtenansicht gibt es oben `Uebergabe` mit Auswahl `Einzug`/`Auszug` und einem Haken.
- Der Haken startet keinen Download mehr, sondern oeffnet die neue Seite `/admin/mieter/[id]/uebergabe?art=moveIn|moveOut`.
- Das alte Inline-Formular unter dem Uebergabe-Button ist ausgeblendet.
- Neue Komponente: `components/admin/TenantHandoverWorkspace.tsx`.
- Neue Route: `app/admin/mieter/[id]/uebergabe/page.tsx`.
- Ort/Treffpunkt wird aus Objektadresse plus Einheit vorbelegt.
- Mietername und Vermieter werden aus den vorhandenen Daten vorbelegt.
- `Zustand der Einheit` wurde entfernt.
- `Maengel / offene Punkte` bleibt als Freitext.
- Zaehlerstaende entstehen aus den an der Einheit hinterlegten Zaehlern: Bezeichnung, Zaehlernummer und Eingabefeld fuer den Stand.
- Zaehler koennen im Protokoll manuell ergaenzt werden.
- Schluessel entstehen aus neuen Schluessel-Stammdaten an der Einheit: Bezeichnung, Soll-Anzahl und aenderbare Uebergabe-Anzahl.
- Schluessel koennen im Protokoll manuell ergaenzt werden.
- Foto- und Videoaufnahmen koennen zum Protokoll hochgeladen werden.
- Beim Speichern landet ein Protokolldokument plus Foto-/Videoanlagen in den Mieterdokumenten.
- Wenn fuer die Firma eine Uebergabeprotokoll-Vorlage fuer Einzug/Auszug hinterlegt ist, wird bevorzugt ein `.docx` daraus erzeugt; sonst wird ein HTML-Protokoll als Fallback gespeichert.
- Samsung Browser Fix: `TenantHandoverWorkspace` nutzt nicht mehr direkt `crypto.randomUUID()`, sondern `createClientId()` mit Fallback fuer Browser ohne `randomUUID`.

### Immobilien / Einheiten
- `PropertyAdminManager` speichert nun pro Einheit eine `keys`-Liste.
- In der Desktop-Immobilien-/Einheitenbearbeitung gibt es pro Einheit einen Bereich `Schluessel`.
- Per `+ Schluessel` erscheinen zwei Felder: Schluesselbezeichnung und Anzahl.
- Diese Stammdaten werden vom Uebergabeprotokoll als Vorbelegung verwendet.

### Verifikation
- Nach den Aenderungen wurde mehrfach `npx tsc --noEmit` erfolgreich ausgefuehrt.
- `/admin/nachrichten` antwortete lokal mit HTTP 200.

## 17.06.2026 - Uebergabeprotokoll aktualisiert Zaehlerstaende

- Beim Speichern eines Uebergabeprotokolls werden eingetragene Staende vorhandener Einheiten-Zaehler jetzt auch im zugehoerigen Objekt/der Einheit aktualisiert.
- Aktualisiert werden `latestReading`, `latestReadingDate` und `readingHistory`; der Historieneintrag bekommt als Notiz `Uebergabeprotokoll Einzug` oder `Uebergabeprotokoll Auszug`.
- Manuell ergaenzte Zaehlerzeilen ohne passenden Stammdaten-Zaehler bleiben Teil des Protokolls, legen aber keinen neuen Zaehler im Objekt an.
- Tenant-Protokoll und Property-Zaehlerupdate werden gemeinsam per Firestore-Batch geschrieben.
- Verifikation: `npx tsc --noEmit` erfolgreich, `npm run build` erfolgreich, Dev-Server antwortet lokal mit HTTP 200.
## 17.06.2026 - Uebergabeprotokoll speichert mehrere Foto-/Videoaufnahmen

- Datei-Auswahl im Uebergabeprotokoll haengt neue Fotos/Videos jetzt an die bestehende Liste an, statt die vorherigen Aufnahmen zu ersetzen.
- Das Datei-Input wird nach jeder Auswahl geleert, damit auf mobilen Browsern direkt weitere Kameraaufnahmen hinzugefuegt werden koennen.
- Ausgewaehlte Aufnahmen werden einzeln angezeigt und koennen vor dem Speichern wieder entfernt werden.
- Verifikation: `npx tsc --noEmit` erfolgreich, `npm run build` erfolgreich, Dev-Server antwortet lokal mit HTTP 200.
## 17.06.2026 - Mobile Kameraauswahl im Uebergabeprotokoll korrigiert

- Der Mehrdateien-Fix fuer Foto-/Videoaufnahmen wurde nachgezogen: Die `FileList` wird jetzt sofort im `onChange` in ein stabiles `File[]` kopiert, bevor das Datei-Input geleert wird.
- Grund: Mobile Browser liefern eine live `FileList`; wenn sie erst im State-Updater gelesen wird, kann sie nach dem Leeren des Inputs bereits leer sein.
- Verifikation: `npx tsc --noEmit` erfolgreich, `npm run build` erfolgreich, Dev-Server antwortet lokal mit HTTP 200.
## 17.06.2026 - Uebergabeprotokoll mit Signaturfeldern

- Das Uebergabeprotokoll hat jetzt einen Abschnitt `Bestaetigung und Unterschriften` mit Standardtext zur Richtigkeit des Protokolls und zur Einbeziehung von Fotos/Videos als Protokollbestandteil.
- Es gibt digitale Zeichenfelder fuer `Unterschrift Mieter` und `Unterschrift Vermieter`; die Felder funktionieren mit Finger/Stift/Maus und koennen einzeln geloescht werden.
- Signaturen werden als PNG-Data-URL im Protokolldatensatz gespeichert (`tenantSignatureImage`, `landlordSignatureImage`) und im HTML-Fallback-Protokoll eingebettet.
- Bei DOCX-Vorlagen wird der Bestaetigungstext im BODY ausgegeben; die Signaturbilder bleiben zusaetzlich im gespeicherten Protokolldatensatz erhalten.
- Verifikation: `npx tsc --noEmit` erfolgreich, `npm run build` erfolgreich, Dev-Server antwortet lokal mit HTTP 200.
## 17.06.2026 - Uebergabeprotokoll versenden und zurueck zum Mieter

- Beim Speichern des Uebergabeprotokolls wird jetzt vorab geprueft, ob der Admin angemeldet ist und beim Mieter eine E-Mail-Adresse hinterlegt ist.
- Nach erfolgreichem Speichern in Firestore/Storage wird das Protokoll ueber `/api/message-drafts/send` an die Mieter-E-Mail versendet.
- Die E-Mail enthaelt das erzeugte Protokolldokument plus die aufgenommenen Foto-/Videoanlagen als Anhaenge.
- Erst nach erfolgreichem Versand wird per `router.replace('/admin/mieter/[id]')` zur Mieteransicht zurueck navigiert, damit die Uebergabeseite aus dem Browserverlauf verschwindet.
- Wenn der Versand fehlschlaegt, bleibt die Seite offen und zeigt eine Fehlermeldung; das Protokoll kann dabei bereits lokal gespeichert sein.
- Verifikation: `npx tsc --noEmit` erfolgreich, `npm run build` erfolgreich, Dev-Server antwortet lokal mit HTTP 200.
## 17.06.2026 - Uebergabeprotokoll als PDF, Medien nur intern

- Neue API-Route `app/api/admin/handover-protocol-pdf/route.ts` erzeugt Uebergabeprotokolle serverseitig als PDF mit `pdf-lib`.
- `pdf-lib` wurde als Dependency ergaenzt; `package.json` und `package-lock.json` wurden aktualisiert.
- `TenantHandoverWorkspace` erzeugt und speichert das Protokolldokument jetzt als `application/pdf` statt HTML/DOCX.
- Die E-Mail an den Mieter enthaelt nur noch das PDF-Protokoll als Anhang; Fotos und Videos werden weiterhin intern in Storage/Mieterdokumenten gespeichert, aber nicht per Mail versendet.
- Der Bestaetigungstext wurde angepasst: Fotos/Videos sind digitale Anlagen der Dokumentation, werden intern gespeichert und koennen den Vertragsparteien auf Anfrage bereitgestellt werden.
- PDF-Route wurde lokal mit Testpayload geprueft: HTTP 200, `application/pdf`.
- Verifikation: `npx tsc --noEmit` erfolgreich, `npm run build` erfolgreich, Dev-Server antwortet lokal mit HTTP 200.
## 17.06.2026 - Mieter-Nachrichten rechts abgeschnitten behoben

- `TenantDetailView` wurde im Nachrichtenlayout gegen horizontales Abschneiden stabilisiert.
- Verlauf, Nachrichten-Section, innere Grid-Container, Composer und Themenliste nutzen jetzt konsequenter `min-w-0` und `overflow-x-hidden`.
- Mobile Einrueckungen im Nachrichtenverlauf wurden reduziert; links/rechts eingerueckte Antworten greifen erst ab `sm`.
- Feste Mindestbreiten in den Aktions-/Composer-Grids wurden auf `minmax(0, ...)` umgestellt, damit die Felder innerhalb des Containers schrumpfen koennen.
- Verifikation: `npx tsc --noEmit` erfolgreich, `npm run build` erfolgreich, `/admin/mieter` antwortet lokal mit HTTP 200.
## 17.06.2026 - Mobile Dashboard-Navigation vereinfacht

- Mobile Admin-Kopfleiste wurde umgebaut: links oben ein Menuebutton, Logo mittig, Abmelden rechts.
- Die separaten mobilen Buttons `Dashboard` und `Nachrichten` wurden entfernt und in das neue Menue verschoben.
- Das Menue enthaelt `Dashboard`, `Nachrichten` und `Bestand`; `Bestand` kann per Plus/Minus aufgeklappt werden und enthaelt Suche sowie den bestehenden Firmen-/Objekt-/Einheiten-/Mieterbaum.
- Klicks aus dem mobilen Menue schliessen das Menue anschliessend.
- Der Admin-Header richtet `Ueberblick` auf mobilen Breiten mittig aus; Desktop bleibt linksbuendig.
- Verifikation: `npx tsc --noEmit` erfolgreich, `npm run build` erfolgreich, `/admin` antwortet lokal mit HTTP 200.
## 17.06.2026 - Mobiler Bestand im Menue hierarchisch geschlossen

- Im mobilen Admin-Menue zeigt `Bestand` nach dem Oeffnen jetzt zunaechst nur die Firmen.
- Firmen koennen per Plus aufgeklappt werden; darunter erscheinen Objekte, ebenfalls per Plus aufklappbar.
- Einheiten sind ebenfalls per Plus aufklappbar; Mieter erscheinen erst darunter.
- Klick auf den Namen navigiert weiterhin direkt zum jeweiligen Datensatz, Klick auf Plus klappt nur auf/zu.
- Verifikation: `npx tsc --noEmit` erfolgreich, `npm run build` erfolgreich, `/admin` antwortet lokal mit HTTP 200.

## 2026-06-17 - Nachrichten-Header Overlay
- In components/ProtectedAreaLayout.tsx die kompakte Admin-Header-Zeile auf mobilen Ansichten ausgeblendet, damit sie auf /admin/nachrichten keine oberen Buttons ueberlagert.
- Fuer die Nachrichtenseite wurde der negative Abstand der kompakten Header-Zeile entfernt, damit Desktop-Schaltflaechen nicht in den Toolbarbereich rutschen.
- Verifiziert mit `npx tsc --noEmit` und `npm run build`.

## 2026-06-17 - Dokumente Uploadbereich mobil vereinfacht
- components/admin/DocumentLibrarySection.tsx umgebaut: Upload-Kategorie startet mit Platzhalter Kategorie waehlen; Neue Kategorie erscheint nur bei Auswahl von Sonstiges.
- Aktionen fuer Kategorie hinzufuegen, Kategorie loeschen und Datei auswaehlen liegen jetzt in einem kompakten Symbolmenue neben der Kategorieauswahl.
- components/admin/PendingDocumentUploadSection.tsx auf dasselbe kompakte Bedienmuster umgestellt, damit neue Firma/Person/Objekt-Uploads mobil gleich funktionieren.
- components/admin/DocumentUploadControl.tsx kann Datei-Auswahl extern ausloesen und zeigt keinen separaten Foto aufnehmen-Button mehr; Kamera bleibt ueber die normale Dateiauswahl des Mobilgeraets erreichbar.
- Verifiziert mit `npx tsc --noEmit` und `npm run build`.

## 2026-06-17 - Uploadfehler Samsung Browser crypto.randomUUID
- Ursache der Upload-Fehlermeldung war `crypto.randomUUID is not a function` im mobilen Browser beim Erzeugen von Storage-Dateinamen/Client-IDs.
- In lib/tenantDocuments.ts wurde `createClientId(prefix)` als gemeinsamer Fallback eingefuehrt: nutzt crypto.randomUUID, sonst crypto.getRandomValues, sonst Math.random-Fallback.
- Direkte crypto.randomUUID()-Aufrufe in Dokument-Uploads, Pending-Uploads und Nachrichtenanhaengen wurden auf createClientId umgestellt.
- Verifiziert mit `npx tsc --noEmit` und `npm run build`.

## 2026-06-17 - Mieter Nachrichten Kopfzeile kompakter
- In components/admin/TenantDetailView.tsx wurde Neue Nachricht in das Ansicht-Dropdown verschoben: Reihenfolge Posteingang, Neue Nachricht, Archiv.
- Der separate Button Neue Nachricht wurde entfernt.
- Die Uebergabe-Auswahl Einzug/Auszug in der Kopfzeile wurde entfernt; rechts in derselben Zeile bleibt nur ein Dokument/Seiten-Iconbutton, der direkt /admin/mieter/[id]/uebergabe oeffnet.
- Verifiziert mit `npx tsc --noEmit` und `npm run build`.

## 2026-06-17 - Mieter Nachrichten Composer kompakter
- In components/admin/TenantDetailView.tsx gibt es fuer Neue Nachricht ein eigenes Betrefffeld oberhalb des Nachrichtenfelds; der Betreff wird fuer KI und Versand genutzt.
- Themenaktion bei ausgewaehlter Nachricht wurde auf eine kompakte Ein-Zeilen-Struktur gebracht: Aktion, Ziel/Betreff, Haken.
- Composer-Kopfzeile wurde verdichtet: kleines Versandart-Dropdown links, daneben Betreff/aktueller Betreff, daneben KI-Hinweis und kleiner KI-Button rechts.
- Verifiziert mit `npx tsc --noEmit` und `npm run build`.

## 2026-06-17 - Mieter Composer Reihenfolge und Fetch-Overlays
- components/admin/TenantDetailView.tsx: Composer neu gestapelt: Versandart oben links, darunter Themenaktion, darunter KI-Hinweis mit kleinem KI-Button rechts, darunter einzige Betreffzeile direkt ueber dem Nachrichtenfeld.
- Doppelte Betreffzeile entfernt; bei neuer Nachricht wird `newMessageSubject`, bei bestehendem Thema `themeTitleDraft` genutzt.
- Polling-Fehler fuer lokale Portalnachrichten und Message-Themes loggen jetzt `console.warn` statt `console.error`, damit kurzzeitige `Failed to fetch`-Netzwerkfehler keine rote Next-Dev-Overlay-Meldung ausloesen.
- components/ProtectedAreaLayout.tsx: automatischer Mail-Sync loggt Fetch-Fehler ebenfalls als Warnung statt Error.
- Verifiziert mit `npx tsc --noEmit` und `npm run build`.

## 2026-06-17 - Nachrichten Dropdown und Bestand Akkordeons
- components/admin/MessagesWorkspace.tsx: Auf /admin/nachrichten wurde Neue Nachricht in das Ansicht-Dropdown zwischen Posteingang und Archiv verschoben; der separate Button wurde entfernt.
- components/admin/PropertyDetailView.tsx: Objekt-Zaehlersicht und Wartungen sind jetzt standardmaessig zugeklappt. Jeweils ein Plus/Minus-Button oeffnet die Uebersicht/Formulare erst bei Klick.
- Verifiziert mit `npx tsc --noEmit` und `npm run build`.

## 2026-06-17 - Bestand weitere Klappbereiche
- components/admin/PropertyDetailView.tsx: Dienstleister und Dokumente sind jetzt wie Zaehler/Wartungen standardmaessig zugeklappt und per Plus/Minus oeffnbar.
- Objekt-Zaehlereintraege haben zusaetzlich einen sichtbaren Detail-Button wie die Einheiten-Zaehler.
- components/admin/UnitDetailView.tsx: Einheiten-Zaehlereintraege, Dienstleister und Dokumente sind jetzt ebenfalls standardmaessig zugeklappt und per Plus/Minus oeffnbar.
- Verifiziert mit `npx tsc --noEmit` und `npm run build`.

## 2026-06-17 - Zaehlerkarten mobile Anordnung
- components/admin/PropertyDetailView.tsx: Objektzaehler sind keine mobile Tabelle mehr, sondern Karten mit sauber zugeordneten Feldern und Eingabezeile fuer neuen Stand.
- Info-Link bei Objektzaehlern sitzt oben rechts in der Karte und zeigt nur noch `i` statt Details.
- components/admin/UnitDetailView.tsx: Einheiten-Zaehler verwenden ebenfalls den kleinen `i`-Info-Button statt Details.
- Verifiziert mit `npx tsc --noEmit` und `npm run build`.

## 2026-06-17 - Mietermail App-/Portal-Hinweis entfernt
- Den alten Standard-Mailheader "Holen Sie sich die App oder nutzen Sie das Online-Mieterportal..." aus `lib/mailboxConfigServer.ts` entfernt.
- Mailbox-Headertexte werden beim Laden zusaetzlich bereinigt, damit der Hinweis auch aus vorhandenen ENV-/lokalen-/DB-Einstellungen nicht mehr in ausgehenden Mietermails erscheint.
- Verifiziert mit `npx tsc --noEmit` und `npm run build`.

## 2026-06-17 - Uebergabeprotokoll-Mail nutzt Mailvorlage
- components/admin/TenantHandoverWorkspace.tsx uebergibt beim Versand des Uebergabeprotokolls jetzt die Firmensignatur an `/api/message-drafts/send`, damit die gleiche Mailvorlage wie bei normalen Mietermails verwendet wird.
- Der Body der Uebergabe-Mail enthaelt keine manuell angehaengte Halbmann-Signatur mehr; Signatur, Logo und Adresse kommen aus der Vorlage.
- lib/signatures.ts rendert den `{{LOGO}}`-Token in E-Mail-Signaturen kleiner (`width`/`max-width` 180px), damit das Logo ueber der Adresse nicht mehr ueberdimensioniert erscheint.
- Verifiziert mit `npx tsc --noEmit` und `npm run build`.

## 2026-06-17 - Cleanup-Sicherung vor Online-Aufraeumen
- Vor dem Aufraeumen wurde der aktuelle stabile Stand mit dem Git-Tag `pre-cleanup-online-release` gesichert.
- Fuer die Aufraeumarbeiten wurde der Branch `cleanup/remove-unused-portal` erstellt und ausgecheckt.
- Ausgangspunkt ist Commit `b35c4cd` (`Use mail signature for handover protocol emails`); `git status` war vor Beginn sauber.
## 2026-06-17 - Cleanup Schritt 1: Oeffentliches Mieterportal entfernt
- Auf Branch `cleanup/remove-unused-portal` wurden die oeffentlichen Mieterportal-Seiten unter `app/mieterportal` entfernt.
- Entfernt wurden auch die zugehoerigen Portal-Client-API-Routen: `app/api/portal`, `app/api/portal-auth` und `app/api/portal-local`.
- `components/LoginForm.tsx` wurde auf reinen Admin-Login reduziert; Portal-Benutzername, lokale Portal-Anmeldung und Portal-Auth-Aufloesung sind raus.
- `lib/auth.ts` kennt nur noch die Rolle `admin`; Portal-Routing und Portal-Profilfelder wurden entfernt.
- `components/ProtectedAreaLayout.tsx` laedt keinen Portal-Kontext mehr und enthaelt keine mobile Portalnavigation/Portal-Logoutlogik mehr.
- Verifiziert mit `npm run build` und `npx tsc --noEmit`; die Next-Route-Liste ist von 47 auf 35 Eintraege geschrumpft.
## 2026-06-17 - Mobile JSON-Fehlermeldung nach Portal-Cleanup behoben
- Nach dem Entfernen des oeffentlichen Mieterportals wurden automatische Polling-Aufrufe auf `/api/admin/local-portal-messages` aus Dashboard, Nachrichtenuebersicht, Mieter-Detail und Nachrichten-Detail entfernt.
- Ursache der mobilen Fehlermeldung war ein JSON-Parse auf eine HTML-Antwort (`<!DOCTYPE ...`), ausgelöst durch alte Portal-Pollingpfade nach dem Cleanup.
- Verifiziert mit `npx tsc --noEmit` und `npm run build`; Dev-Server wurde auf `0.0.0.0:3000` neu gestartet und `/admin` antwortet mit HTTP 200.
## 2026-06-17 - JSON/DOCTYPE Overlay weiter entschaerft
- Automatische JSON-Loader geben keine `SyntaxError`-Objekte mehr an `console.warn/error` weiter, wenn eine HTML-Antwort statt JSON kommt.
- `ProtectedAreaLayout.tsx` faengt genau den Dev-Overlay-Fall `Unexpected token '<' / DOCTYPE / not valid JSON` global ab, damit alte/kurzzeitige Nicht-JSON-Antworten die mobile Ansicht nicht blockieren.
- Der automatische Mail-Sync ignoriert Nicht-JSON-Antworten still statt daraus einen Console-SyntaxError zu machen.
- Verifiziert mit `npx tsc --noEmit` und `npm run build`.

## 2026-06-20 - Mieterportal-Cleanup abgeschlossen
- Die verbliebenen deaktivierten Portal-API-Stubs unter `app/api/admin` wurden entfernt: `local-portal-messages`, `portal-access`, `portal-access-secret`, `portal-invitation` und `portal-invitation-settings`.
- Nicht mehr genutzte Portal-Helfer in `lib/` wurden geloescht, inklusive lokaler Portalzugang-/Session-/Einladungs-/Nachrichten- und Secret-Module.
- `AdminPortalInvitationSettings` wurde entfernt; Mieter- und Kontaktansichten enthalten keine Portaleinladungsfunktion und kein Einladungsmodal mehr.
- `TenantAdminManager` legt keine Portalzugaenge mehr an, laedt keine Portalpasswoerter mehr und enthaelt kein verstecktes Portalzugangsformular mehr.
- Reine Brief-Verlaufseintraege werden nicht mehr ueber lokale Portalnachrichten geschrieben, sondern direkt als normale `messages`-Dokumente gespeichert.
- Dashboard, Nachrichtenuebersicht, Nachrichtendetail und Mieterdetail verwenden keine `localPortalMessages`-States mehr.
- Sichtbare Portaltexte wurden neutralisiert: Admin-Nachrichtenheader, Kontaktseite, Profil-/Mitarbeitertexte, Berechtigungsbeschreibung und Signatur-UI sprechen nicht mehr vom Portal.
- Neue manuelle Nachrichten in der allgemeinen Nachrichtenuebersicht schreiben `channel: 'email'` statt `channel: 'portal'`; alte `portal`-Eintraege bleiben nur als historische Nachrichten lesbar.
- Next-Typegen wurde nach dem Loeschen der Routen aktualisiert; stale `.next/dev/types` wurde entfernt.
- Verifiziert mit `npx tsc --noEmit` und `npm run build`; die Build-Route-Liste enthaelt keine Portal-API-Routen mehr.

## 2026-06-20 - Release-Cleanup nach Portalentfernung
- Der gruene Portal-Cleanup wurde als Commit `5841d0a` (`Remove unused tenant portal`) gesichert.
- Die temporaeren JSON/DOCTYPE-Overlay-Guards wurden aus `app/layout.tsx` und `components/ProtectedAreaLayout.tsx` entfernt, damit echte JSON-/Fetch-Fehler wieder sichtbar werden.
- Release-Hygiene: `.ai-settings.local.json` und `firebase-debug.log` wurden aus dem Git-Index entfernt und bleiben lokal; `.ai-settings.local.json` ist jetzt in `.gitignore` eingetragen. `.next-dev.*`, `.portal-*.local.json`, `.env.local`, Mailbox- und Message-Themes-Local-Dateien sind ignoriert.
- Gefahrlos umbenannte interne Portal-Begriffe: `PORTAL_INBOX_EMAIL` -> `DEFAULT_INBOX_EMAIL`, `sendPortalEmail` -> `sendMailboxEmail`, `composePortalDraft` -> `composeMessageDraft`, `buildPortalSignatureText` -> `buildMessageSignatureText`, `PORTAL_SIGNATURE_EMAIL` -> `DEFAULT_SIGNATURE_EMAIL`, `portalBodyText` -> `messageBodyText` fuer neue Payloads.
- Rueckwaertskompatibilitaet bleibt erhalten: `app/api/message-drafts/send` akzeptiert alte `portalBodyText`-Entwuerfe weiterhin, und Signatur-Firestore-Felder wie `signaturePortalClosing` bleiben bestehen.
- Verifiziert mit `npx tsc --noEmit` und `npm run build`.
