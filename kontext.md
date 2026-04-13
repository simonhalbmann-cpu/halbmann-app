# HALBMANN APP - PROJEKTKONTEXT

**Projekt:** Digitale Immobilien-Verwaltungsplattform  
**Stand:** 02.04.2026

---

## Ãœberblick

Wir bauen eine zentrale Plattform mit drei Bereichen:

1. **Ã–ffentliche Website**  
   SeriÃ¶se Family-Office-Darstellung mit Fokus auf Bestand, Haltung und Service.

2. **Mieterportal**  
   GeschÃ¼tzter Bereich fÃ¼r Mieter, spÃ¤ter auch als App-OberflÃ¤che fÃ¼r iPhone und Android.

3. **Verwalterbereich**  
   Interner Bereich fÃ¼r Stammdaten, Zuordnungen und spÃ¤tere Verwaltungsprozesse.

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
- **QualitÃ¤tssicherung:** `npm run lint`

Wichtige Vorgabe:
- Vor Ã„nderungen an Next.js-Code immer die passende Doku in `node_modules/next/dist/docs/` prÃ¼fen, weil diese Next.js-Version von Ã¼blichen Annahmen abweichen kann.

---

## Aktueller Produktstand

### Ã–ffentliche Website

- Startseite ist gestalterisch auf Halbmann Holding ausgerichtet
- echtes Logo aus `public/halbmann-logo.png` eingebunden
- Footer mit `Verwalter-Login` und `Impressum`
- separater Verwalter-Login unter `/login`
- Impressum-Seite vorhanden
- App-Bereich auf der Startseite integriert
- Mieter-Login direkt auf der Startseite

### Auth & Rollen

- Login lÃ¤uft Ã¼ber Firebase Auth
- Rollen werden Ã¼ber Firestore in `userProfiles/{uid}` gepflegt
- aktuell relevante Rollen:
  - `admin`
  - `tenant`
- Mieter und Verwalter sind sauber getrennt
- ein Mieter kommt nicht mehr in den Verwalterbereich

### Verwalterbereich

- Admin-Dashboard vorhanden
- Navigation im Verwalterbereich vorhanden
- `HinzufÃ¼gen` im linken MenÃ¼ ist jetzt als aufklappbares Dropdown aufgebaut
- Ãœber `HinzufÃ¼gen` gibt es links jetzt zusÃ¤tzlich einen Bestands-Reiter mit Hierarchie:
  - Firma
  - zugehÃ¶rige Objekte
  - zugehÃ¶rige Einheiten
  - aktueller Mieter plus letzte Mieter chronologisch darunter
- Ãœber dem Dashboard gibt es links jetzt ein globales Suchfeld fÃ¼r Firma, Objekt, Einheit und Mieter
- Ein Klick im Bestandsbaum Ã¶ffnet jetzt zusÃ¤tzlich direkt die passende Ansicht:
  - Firma Ã¶ffnet Firmenansicht
  - Objekt Ã¶ffnet Immobilienansicht
  - Einheit Ã¶ffnet die Immobilie mit Fokus auf die gewÃ¤hlte Einheit
  - aktueller oder frÃ¼herer Mieter Ã¶ffnet die Mieteransicht
- Bereiche zum Anlegen von:
  - Mieter
  - Dritte & Dienstleister
  - Immobilien
  - Firmen
- Formulare arbeiten bereits mit Beziehungen per Dropdown statt Freitext
- Formulare fÃ¼r Firmen, Personen und Immobilien wurden deutlich erweitert
- Uploadbereiche sind strukturell vorbereitet, speichern aktuell aber zunÃ¤chst Dateinamen statt echter Storage-Dateien
- Firmenformular enthÃ¤lt jetzt auch eine Steuerberater-Zuordnung per Dropdown
- Firmenbereich hat jetzt eine echte Ãœbersicht Ã¼ber allen Firmen oberhalb des Anlegeformulars
- In der FirmenÃ¼bersicht gibt es pro Firma die Aktionen:
  - `Ansehen`
  - `Bearbeiten`
  - `LÃ¶schen`
- Detailseite fÃ¼r Firmen unter `/admin/firma/[id]` vorhanden
- Bearbeitungsseite fÃ¼r Firmen unter `/admin/firma/[id]/bearbeiten` vorhanden
- Detailseite fÃ¼r Immobilien unter `/admin/immobilie/[id]` vorhanden
- Detailseite fÃ¼r Mieter unter `/admin/mieter/[id]` vorhanden
- FirmenÃ¼bersicht zeigt jetzt nur noch den Firmennamen mit den drei Aktionen
- Admin-Formulare fÃ¼r Firmen, Personen und Immobilien arbeiten jetzt mit gemeinsamer Adresshilfe:
  - StraÃŸe wird separat von Hausnummer gefÃ¼hrt
  - PLZ wird formatiert
  - Ort und Land werden soweit mÃ¶glich aus vorhandenen Adressen ergÃ¤nzt
- Admin-Felder formatieren Eingaben jetzt beim AusfÃ¼llen und beim Speichern stÃ¤rker automatisch
- Admin-Formulare bremsen Browser-Credential-Autofill jetzt stÃ¤rker aus, damit Kontakt- oder Postfachfelder nicht als Login gespeichert werden
- Personenbereich ist jetzt fachlich stÃ¤rker aufgeteilt in:
  - Mieter separat
  - externe Partner / Handwerker / Dienstleister
- Im Bereich `Dritte & Dienstleister` sind die auswÃ¤hlbaren Rollen jetzt deutlich konkreter:
  - Elektriker
  - SanitÃ¤r / Rohrreinigung
  - Heizungsdienst
  - MÃ¼llabfuhrunternehmen
  - Abrechnungsunternehmen
  - Winterdienst
  - Reinigungsdienst
  - Dachwartung
  - Regenrinnenreinigung
  - sowie allgemeine externe Kontakte
- Bei `Dritte & Dienstleister` wurde der Dokumentbereich auf einen einzigen Upload `Dokumente` reduziert
- Das zusÃ¤tzliche Feld `Adresse intelligent Ã¼bernehmen` wurde wieder entfernt
- Ãœbersichten in Mieter, Dritte & Dienstleister, Immobilien und Firmen sind jetzt kompakter und einheitlicher aufgebaut
- Verwalterbereich gestalterisch an Startseite angenÃ¤hert
- Dashboard grob neu ausgerichtet auf:
  - neueste Mieterkommunikation
  - Tickets
  - Leerstand an Einheiten
  - Online-Status und spÃ¤tere Historie von Mietern
- Immobilienverwaltung hat jetzt eine eigene, intelligentere Admin-Komponente statt der generischen Formularschablone
- Interne Objektnummern werden dort automatisch fortlaufend vergeben
- EigentÃ¼mer werden Ã¼ber ein einziges Feld aus `companies` gewÃ¤hlt
- `Verwalter` erscheint nur bei `Teileigentum`
- Einheiten werden direkt im Objekt gepflegt:
  - Lage / GebÃ¤udeteil
  - Geschoss
  - Maisonette als zusÃ¤tzliche Geschoss-/Lageoption
  - Positionsangaben `li`, `mi`, `re`
  - Mieterzuordnung
  - wohnungsbezogene ZÃ¤hler als optionale, einzeln hinzufÃ¼gbare Bausteine
  - vorbereitete Dokument- und Bildfelder
- Leerstand wird dort automatisch aus Einheiten ohne Mieterzuordnung abgeleitet
- Objekt-ZÃ¤hler und Dienstleister-Zuordnungen sind jetzt als eigene Bereiche vorbereitet
- Objekt-ZÃ¤hler werden jetzt ebenfalls nur bei Bedarf hinzugefÃ¼gt statt als starre Feldliste
- TeilungserklÃ¤rung liegt jetzt auf Objektebene
- Ãœbergabeprotokolle sind aus der Einheit entfernt und fÃ¼r die spÃ¤tere Mieterlogik vorgesehen
- Kaufdatum, Eigentum seit, Kaufpreis und Anfangsrendite sind im Immobilienformular ergÃ¤nzt
- Mieter werden jetzt im Adminbereich nicht mehr per Freitext an Objekt / Einheit gehÃ¤ngt, sondern aus bestehenden Einheiten ausgewÃ¤hlt
- Die Einheit ist damit die fachliche Basis fÃ¼r Mietzuordnung und Leerstandslogik
- Beim Anlegen eines Mieters wird die gewÃ¤hlte Einheit jetzt direkt im Objekt als belegt zurÃ¼ckgeschrieben
- Das Mieterformular enthÃ¤lt jetzt zusÃ¤tzlich:
  - Steuernummer
  - BÃ¼rgschaft
  - weitere Personen / Mitmieter inkl. Telefon und E-Mail
  - Kaltmiete, Betriebskosten, Umsatzsteuer-Regelung, automatisch berechnete Warmmiete (netto), Kaution
  - MieterhÃ¶hungsart und nÃ¤chstes PrÃ¼fdatum
  - vorbereitete Dokumentfelder fÃ¼r Mietvertrag, NachtrÃ¤ge, Ausweiskopien, SCHUFA, Gehaltsnachweise, Jahresabrechnungen u. a.
- Bei Immobilien sind zusÃ¤tzlich Felder fÃ¼r:
  - Baujahr Heizung
  - letzte Heizungswartung
  - letzte Dachwartung
  - letzte Regenrinnenreinigung
  vorbereitet
- Bei Immobilien kÃ¶nnen jetzt mehrere Heizungsarten pro Objekt hinterlegt werden
- Kaufpreis wird im Immobilienformular jetzt als Geldbetrag formatiert
- Neue Einheiten werden im Immobilienformular jetzt direkt oberhalb der bestehenden Einheiten eingefÃ¼gt
- Objekt- und EinheitenzÃ¤hler werden jetzt nur bei Bedarf hinzugefÃ¼gt und enthalten jeweils:
  - ZÃ¤hlernummer
  - erster ZÃ¤hlerstand
  - Ablesedatum
  - Eichdatum
- Die groÃŸe Einleitungsbox oberhalb des Immobilienformulars wurde entfernt
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
- Admin darf fremde Profile lesen / Ã¤ndern / lÃ¶schen
- `people`, `properties`, `companies`, `tenants` nur fÃ¼r Admin
- sonst alles standardmÃ¤ÃŸig gesperrt

Die Regeldefinition liegt in:
- `firestore.rules`

Wichtig:
- Diese Regeln passen zum aktuellen Stand des Verwalterbereichs
- FÃ¼r spÃ¤tere Mieterfunktionen im Portal oder in der App mÃ¼ssen die Regeln gezielt erweitert werden

---

## Designstand

### Startseite

- Logo und Claim fein ausgerichtet
- Claim aktuell:
  - `Family Office â€¢ VermÃ¶gensmanagement`
- HauptÃ¼berschrift:
  - `Langfristige Werte. Klare Haltung. Immobilien mit Substanz.`
- App-Karte auf der rechten Seite in warmen Erdtonen
- Download-Buttons in blauer Edelstein-Optik

### Verwalter-Login

- Gestaltung an die Startseite angepasst
- kein hartes Schwarz mehr
- warmer, hochwertiger Stil
- zusÃ¤tzlicher `Home`-Button zurÃ¼ck zur Startseite
- Formulartext oberhalb des Logins entfernt
- Submit-Button heiÃŸt nur noch `Anmelden`

---

## NÃ¤chster sinnvoller Fokus

Der aktuell beste nÃ¤chste Schritt ist:

### Verwalterbereich funktional ausbauen

Empfohlene Reihenfolge:

1. DatensÃ¤tze nicht nur anlegen, sondern auch bearbeiten und lÃ¶schen
2. Detailfelder fÃ¼r Personen, Firmen und Immobilien erweitern
3. Beziehungen und Zuordnungen sauber ausbauen
4. Ãœbersichten mit Suche / Filtern ergÃ¤nzen
5. spÃ¤tere VorgÃ¤nge vorbereiten:
   - Schadensmeldungen
   - ZÃ¤hlerstÃ¤nde
   - Dokumente
   - ZustÃ¤ndigkeiten

---

## App-Strategie

Empfohlener Workflow:

1. zuerst Webplattform sauber fertig bauen
2. Verwalterbereich und Mieterportal fachlich stabil machen
3. Datenmodell, Rechte und AblÃ¤ufe festziehen
4. danach iPhone- und Android-App auf dieselbe Logik und Datenbasis setzen

BegrÃ¼ndung:
- Die App sollte auf denselben Rollen, Daten und Prozessen aufbauen
- So vermeiden wir doppelte Entscheidungen und spÃ¤tere Umbauten

---

## Wichtige Dateien

- `app/page.tsx`  
  Ã–ffentliche Startseite

- `app/login/page.tsx`  
  Verwalter-Login

- `app/impressum/page.tsx`  
  Impressum

- `components/LoginForm.tsx`  
  zentrales Loginformular

- `components/PublicShell.tsx`  
  HÃ¼lle der Ã¶ffentlichen Seiten

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
  zentrale Felddefinitionen fÃ¼r Firmen

- `lib/auth.ts`  
  Rollenlogik und Zielbereiche

- `context/AuthContext.tsx`  
  Client-seitiger Auth-/Rollenstatus

- `firestore.rules`  
  Sicherheitsregeln fÃ¼r Firestore

---

## Kurzstatus

**Website:** vorzeigbar in Arbeit  
**Auth:** funktionsfÃ¤hig  
**Rollentrennung:** funktionsfÃ¤hig  
**Verwalterbereich:** Grundstruktur vorhanden, Ausbau als nÃ¤chster Fokus  
**Mieter-App:** noch nicht begonnen, bewusst nachgelagert

---

## Neuester Fachstand

### Nachrichten, E-Mail und Tickets

- Die bisherigen Platzhalterseiten `Nachrichten` und `Tickets` wurden als erste echte ArbeitsoberflÃ¤chen aufgebaut
- Neue Admin-Seiten:
  - `/admin/nachrichten`
  - `/admin/tickets`
- Die Mieterportal-Seite `/mieterportal/nachrichten` ist jetzt ebenfalls als echter Eingang an `messages` angebunden
- Mieter kÃ¶nnen dort:
  - frei schreiben
  - optional eine grobe Kategorie auswÃ¤hlen
  - ihre bisherigen Nachrichten im Portalverlauf sehen
- ZusÃ¤tzlich gibt es jetzt einen serverseitigen E-Mail-Eingang unter `/api/inbound-email`
- Feste EmpfÃ¤ngeradresse dafÃ¼r:
  - `portal@halbmann-holding.de`
- Der Endpoint ist dafÃ¼r gedacht, spÃ¤ter von einem Mailanbieter / Inbound-Webhook bedient zu werden
- ZusÃ¤tzlich gibt es jetzt einen serverseitigen IMAP-Sync unter `/api/inbound-email/sync`
- Der IONOS-Posteingang ist lokal vorbereitet Ã¼ber:
  - `imap.ionos.de`
  - Port `993`
  - Benutzer `portal@halbmann-holding.de`
- Der Sync holt ungelesene Mails aus dem Postfach, parsed sie serverseitig und schreibt sie in `messages`
- Nach erfolgreichem Import werden die abgerufenen Mails im Postfach als gelesen markiert
- Der IMAP-Sync lÃ¤uft jetzt automatisch an, sobald ein Admin den geschÃ¼tzten Bereich Ã¶ffnet
- Pro Admin-Session wird der automatische Sync nur einmal ausgelÃ¶st
- Es gibt jetzt zusÃ¤tzlich einen serverseitigen SMTP-Versand fÃ¼r vorbereitete EntwÃ¼rfe
- Neue Serverroute dafÃ¼r:
  - `/api/message-drafts/send`
- EntwÃ¼rfe kÃ¶nnen jetzt aus:
  - `Nachrichten`
  - `Tickets`
  direkt versendet werden
- Beim Versand passiert jetzt serverseitig:
  - SMTP-Versand Ã¼ber den IONOS-Account
  - `messageDrafts.status = sent`
  - Versandzeit und SMTP-Message-ID werden gespeichert
  - ein ausgehender Nachrichten-Eintrag wird erzeugt
  - am Ticket wird ein `ticketEvent` fÃ¼r den Versand angelegt
- Eingehende E-Mails werden serverseitig in `messages` geschrieben und nach bekannter Absenderadresse direkt gegen `tenants` gematcht
- Wenn eine E-Mail nicht eindeutig einem Mieter zugeordnet werden kann, landet sie mit Status `needs_review` in der Admin-Inbox
- Neue Portal-Nachrichten werden direkt in `messages` gespeichert mit:
  - `channel = portal`
  - `direction = inbound`
  - `tenantId`
  - `propertyId`
  - `unitId`
- Firestore Rules erlauben Mietern jetzt:
  - Lesen des eigenen `tenant`-Datensatzes Ã¼ber die eigene E-Mail
  - Lesen der eigenen `messages`
  - Anlegen eigener Portal-Nachrichten
  - Lesen eigener `tickets`
- `Nachrichten` enthÃ¤lt jetzt:
  - Inbox mit Statusfiltern
  - Originalnachricht
  - automatische Analyse
  - Zuordnungsvorschlag fÃ¼r Mieter, Objekt, Einheit und Gewerk
  - vorbereitete EntwÃ¼rfe
- `Tickets` enthÃ¤lt jetzt:
  - Ticketliste
  - Statuswechsel
  - verknÃ¼pfte Ursprungsnachricht
  - verknÃ¼pfte EntwÃ¼rfe
  - Timeline Ã¼ber `ticketEvents`
- Neue Collections dafÃ¼r:
  - `messages`
  - `tickets`
  - `ticketEvents`
  - `messageDrafts`
  - `documentTemplates`
- Neue Hilfslogik in `lib/adminWorkflow.ts`:
  - Kategorisierung aus Betreff und Nachrichtentext
  - PrioritÃ¤tserkennung
  - Zuordnung Ã¼ber bekannte Mieter, Objekte und Einheiten
  - Vorschlag passender Dienstleister Ã¼ber Objekt-Zuordnungen
  - Entwurf fÃ¼r Antwort an Mieter
  - Entwurf fÃ¼r Nachricht an Handwerker / Dienstleister
- Neue Server-Hilfsdateien:
  - `lib/mailbox.ts`
  - `lib/firebaseAdmin.ts`
  - `lib/inboundEmailIngest.ts`
  - `lib/imapSync.ts`
  - `lib/smtp.ts`
- Firestore Rules wurden fÃ¼r diese neuen Collections erweitert
- Der Gesamt-Build ist mit diesem Stand grÃ¼n
- Die groÃŸen EinleitungsblÃ¶cke auf:
  - `Dashboard`
  - `Nachrichten`
  - `Tickets`
  wurden entfernt
- Titel und Beschreibung dieser Bereiche liegen jetzt im gemeinsamen Header des geschÃ¼tzten Layouts statt doppelt in den Seiten selbst
- Im Admin-Header gibt es jetzt ein globales EinstellungsmenÃ¼ Ã¼ber ein Zahnrad
- Erste Einstellungsseite:
  - `/admin/einstellungen`
- Dort kann das globale Mail-Postfach jetzt gepflegt, deaktiviert oder komplett gelÃ¶scht werden:
  - E-Mail-Adresse
  - IMAP Host / Port / Benutzer / Passwort
  - SMTP Host / Port / Benutzer / Passwort
- Die Serverlogik fÃ¼r IMAP-Sync und SMTP-Versand liest die Mailbox-Konfiguration jetzt zuerst aus `adminSettings/mailbox`
- ENV-Werte bleiben als Fallback fÃ¼r die Entwicklung erhalten
- Neue Collection:
  - `adminSettings`
- Firestore Rules wurden dafÃ¼r auf Adminzugriff erweitert

NÃ¤chster sinnvoller Ausbau in diesem Bereich:

1. Firebase-Admin-Zugang lokal / auf dem Server vollstÃ¤ndig hinterlegen, damit die Serverrouten produktiv schreiben kÃ¶nnen
2. IMAP-Sync einmal gegen das echte IONOS-Postfach testen
3. Vorlagenbereich fÃ¼r Standardschreiben aufbauen
4. manuelle Korrektur der KI-Zuordnung in `Nachrichten` erweitern
5. AnhÃ¤nge und echte Antwortketten in Ein- und Ausgang ergÃ¤nzen

### Mieter

- Mieter werden Ã¼ber bestehende freie Einheiten angelegt
- Die Warmmiete wird jetzt automatisch aus `Kaltmiete + Betriebskosten` gebildet
- Kaution hat jetzt die Arten:
  - `Barkaution`
  - `BankbÃ¼rgschaft`
- BÃ¼rge wird nicht mehr frei eingetippt, sondern aus der Personenliste gewÃ¤hlt
- DafÃ¼r gibt es bei `Dritte & Dienstleister` jetzt zusÃ¤tzlich die Kategorie `BÃ¼rge`
- MieterhÃ¶hung ist fachlich vorbereitet:
  - `Staffelmiete` mit wiederholbaren Zeilen
  - je Zeile: `von`, `bis`, `Kaltmiete`, `ErhÃ¶hung %`, `ErhÃ¶hung EUR`
  - Prozent und Euro rechnen sich gegenseitig
  - Erinnerungslogik:
    - Staffel: 1 Monat vor der nÃ¤chsten Staffel
    - Index: jÃ¤hrlich mit 1 Monat Puffer
    - Gesetz: alle 3 Jahre mit 1 Monat Puffer

### Immobilien

- Bei Immobilien gibt es jetzt einen eigenen Block `JÃ¤hrliche Wartungen`
- Dort stehen untereinander:
  - `Heizung`
  - `Dach`
  - `Regenrinnenreinigung`
- FÃ¼r alle Wartungen wird das letzte Wartungsdatum gepflegt
- Fachliche Zielrichtung: spÃ¤tere Ticket-Erinnerung nach 11 Monaten

### Formulare

- `Dritte & Dienstleister` haben jetzt ebenfalls Detail- und Bearbeitungsseiten
- `Immobilien` haben jetzt eine Bearbeitungsseite unter `/admin/immobilie/[id]/bearbeiten`
- `Mieter` haben jetzt eine Bearbeitungsseite unter `/admin/mieter/[id]/bearbeiten`
- `Ansehen / Bearbeiten / LÃ¶schen` ist jetzt Ã¼bergreifend fÃ¼r Firmen, Immobilien, Mieter und Dritte & Dienstleister ausgebaut
- Beim LÃ¶schen eines Mieters wird die Zuordnung in der betroffenen Einheit wieder entfernt

- Das Immobilienformular startet jetzt ohne vorgelagerten Einleitungsblock direkt im Formular
- Die Umsatzsteuer im Mieterformular ist neutral als Regelung fÃ¼r die Nettomiete modelliert und nicht mehr falsch an die Warmmiete gekoppelt

### ZÃƒÂ¤hler und Heizungen

- Immobilien zeigen jetzt eine kompakte ZÃƒÂ¤hler-Tabelle mit `ZÃƒÂ¤hler`, `ZÃƒÂ¤hlernummer`, `Eichdatum` und `Position`
- Es gibt eine eigene ZÃƒÂ¤hler-Detailseite mit Historie, neuen ZÃƒÂ¤hlerstÃƒÂ¤nden und dokumentiertem ZÃƒÂ¤hlerwechsel
- ZÃƒÂ¤hler haben im Formular jetzt zusÃƒÂ¤tzlich das Feld `Position`
- Heizungen werden auf Objektebene jetzt pro Heizsystem mit eigener Wartung und eigenem Baujahr gepflegt
- Falls keine Zentralheizung vorhanden ist, kÃƒÂ¶nnen Heizungen auch auf Einheitenebene gepflegt werden

### MenÃƒÂ¼

- Im Admin-MenÃƒÂ¼ gibt es jetzt zusÃƒÂ¤tzlich die Bereiche `Nachrichten` und `Tickets` als vorbereitete Platzhalterseiten

### Admin-Einstellungen / Mailbox

- Im Admin-Header gibt es jetzt ein globales Zahnrad-Menü
- Darin gibt es eine Einstiegsseite für das globale E-Mail-Postfach unter `/admin/einstellungen`
- Die Mailbox-Konfiguration wird nicht mehr direkt aus dem Browser nach Firestore geschrieben, sondern über die Serverroute `/api/admin/mailbox-settings`
- Dadurch sind Speichern und Löschen stabiler und nicht mehr von clientseitigen Firestore-Regeln abhängig
- Das Löschen setzt die Mailbox bewusst auf inaktiv und leer, damit nicht ungewollt eine alte Fallback-Konfiguration aktiv bleibt
- In den Passwortfeldern für IMAP und SMTP gibt es jetzt `Anzeigen` / `Verbergen`
- `npm run build` läuft nach diesem Umbau grün
- Für `/admin/einstellungen` gibt es jetzt zusätzlich einen lokalen Dev-Fallback ohne Firebase-Admin-Credentials
- Wenn lokal keine Admin-Creds gesetzt sind, speichert die Mailbox-Seite in `.mailbox-settings.local.json`
- Die Serverlogik für IMAP/SMTP liest diese lokale Mailbox-Datei vor dem ENV-Fallback
- Passwortfelder für IMAP und SMTP haben jetzt `Anzeigen` / `Verbergen`
- `npm run build` bleibt nach diesem Fallback grün

### Nachrichten / Tickets Automatik

- Eingehende Nachrichten aus E-Mail und Mieterportal laufen jetzt in einen gemeinsamen Auto-Workflow
- Neue Server-Hilfe: `lib/workflowAutomation.ts`
- Aus einer eingehenden Nachricht werden jetzt automatisch vorbereitet:
  - Analyse / Zuordnung
  - Ticket
  - Antwortentwurf an den Absender
  - Entwurf für das passende Gewerk / den Dienstleister
- E-Mail-Import ruft den Auto-Workflow jetzt direkt nach dem Speichern der Nachricht auf
- Das Mieterportal schreibt Nachrichten nicht mehr direkt in Firestore, sondern über `/api/portal/messages`
- Auch Portal-Nachrichten bekommen dadurch sofort Ticket und Entwürfe
- Neue Route: `/api/portal/messages`
- `npm run build` läuft nach diesem Ausbau grün
- Firestore-Regeln wurden jetzt live nach `halbmann-app` deployt (`firebase deploy --only firestore:rules --project halbmann-app`)
- Dadurch sollten die Permission-Denied-Fehler in `Nachrichten`, `Tickets`, `messageDrafts` und `ticketEvents` im Browser verschwinden
- Der automatische IMAP-Sync im Admin-Layout sendet jetzt den eingeloggten Token mit
- Wenn lokal kein Firebase-Admin vorhanden ist, liefert der IMAP-Sync die eingegangenen Mails an den Browser zurück und der Admin-Client schreibt sie selbst in Firestore
- Dashboard, Nachrichten und Tickets fangen Firestore-Lesefehler jetzt sauber ab, statt die Dev-Overlay-Fehler hochzuschaukeln
- `npm run build` läuft nach diesem Umbau grün
- Die Firestore-Regeln wurden live nach `halbmann-app` deployt, damit Admin-Listener auf `messages`, `tickets`, `messageDrafts` und `ticketEvents` nicht mehr mit `permission-denied` abbrechen
- Der Adminbereich crasht bei Listener-Fehlern jetzt nicht mehr in die Dev-Overlay-Spirale
- Der automatische Mail-Sync läuft nicht mehr nur einmal pro Session, sondern beim Einstieg und danach alle 30 Sekunden erneut
- Wenn kein Firebase-Admin konfiguriert ist, holt der Server die E-Mails per IMAP und der Admin-Client importiert sie anschließend selbst in Firestore
- Damit ist der lokale Entwicklungsmodus für echten E-Mail-Eingang ohne Service-Account vorbereitet
- `npm run build` läuft nach diesem Umbau grün
- Im lokalen Dev-Modus markiert der IMAP-Sync Mails nicht mehr vorschnell als `gesehen`
- Stattdessen werden die letzten bis zu 20 Mails regelmäßig erneut geprüft und über `messageId` dedupliziert importiert
- So können zuvor verpasste oder bereits einmal gesehene Testmails im lokalen Workflow trotzdem noch in `messages` auftauchen
- `npm run build` läuft nach dieser Änderung grün

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
- `Nachrichten` wurde weiter vereinfacht: sichtbare Entwürfe sind aus dem UI entfernt, `Posteingang` zeigt nur offene eingehende Nachrichten, `ticket_created` und `done` verschwinden aus der Inbox.
- `Mail senden` wurde neu gewichtet: Empfängerbereich schmaler, Editor größer, bei `Einzelne Empfänger` jetzt Auswahl `Immobilie -> Mieter` plus manuelle E-Mail und Vorlagenwahl.
- Nachrichtendetail wurde gestrafft: kompakte Zuordnungsinfos oben, kein separates Zuordnungsfeld mehr, keine Buttons für Antwortentwurf/Dienstleister/Löschen mehr. Stattdessen direkter Antwortbereich mit Vorlagenwahl, `Ticket erstellen` und `Als erledigt markieren` bzw. Rückgängig.
- `Bestand > Mieter` zeigt jetzt zusätzlich den Nachrichten- bzw. Chatverlauf des Mieters mit Link in die jeweilige Nachricht.
- Globale Einstellungen wurden erweitert: `/admin/einstellungen` hat jetzt Reiter für `E-Mail-Postfach` und `Signaturen`; im Zahnrad-Menü im Admin-Header gibt es jetzt auch den Link `Signaturen`.
- Signaturen bleiben pro Firma pflegbar, inklusive Logo-Upload über Firebase Storage.
- `Tickets` zeigt keine sichtbaren Entwurfsblöcke mehr.
- Verifiziert mit `npm run build` in `C:\Users\simon\Documents\halbmann-app`.
- Signaturen erweitert: neues Feld `Name` oberhalb des Firmennamens, Feld `Rollenzeile` inhaltlich durch `Mobilfunk` ersetzt. Logo-Upload speichert jetzt direkt; wenn Firebase Storage im Projekt noch nicht eingerichtet ist, wird als lokaler Fallback ein eingebettetes Bild gespeichert und ein klarer Hinweis angezeigt.
- `Mail senden` wurde weiter verschoben: Empfängerbereich schmaler, Editor breiter.
- `Tickets` wurde neu geordnet: keine zusammenfallenden schmalen Spalten mehr, klare Zweiteilung aus Liste und Detail, Ticket-Löschen ergänzt.
- `storage.rules` und `firebase.json` um Storage-Regeln ergänzt. Beim Deploy zeigte sich: Firebase Storage ist im Projekt `halbmann-app` noch nicht initialisiert. Für echtes Bucket-Hosting muss Storage in der Firebase-Konsole einmal aktiviert werden.
- Verifiziert mit `npm run build`.

## Update 2026-04-03 – Signaturen, Mail senden und Tickets
- Signaturen wurden fachlich erweitert: pro Firma jetzt mit `Name`, `Firmenname`, `Straße`, `Hausnummer`, `PLZ`, `Ort`, `Mobilfunk`, `Telefon`, `E-Mail`, `Website` und Logo.
- Die Signaturfelder werden jetzt aus vorhandenen Firmendaten vorausgefüllt und bleiben anschließend manuell anpassbar.
- Die Signaturvorschau wurde optisch gestrafft: Name über Firmenname, Anschrift integriert, Kontaktblock kleiner und enger gesetzt.
- Der bisher hängende Logo-Upload wurde von Firebase Storage entkoppelt und läuft jetzt lokal über `/api/admin/signature-logo` direkt in `public/uploads/signatures`.
- `Mail senden` nutzt jetzt die gewählte Firmen-/Mieter-Zuordnung für die Signatur automatisch mit.
- Bei Einzelversand wird die passende Signatur direkt in den Editor eingesetzt.
- Beim Sammelversand an mehrere Mieter wird die Signatur pro Empfänger anhand der zugehörigen Firma erzeugt.
- Das Empfängerfeld in `Mail senden` wurde weiter verkleinert, der Editorbereich entsprechend vergrößert.
- Eine Nachricht kann jetzt mehrere Tickets erzeugen; dafür werden zusätzliche Ticket-IDs an der Nachricht mitgeführt.
- `Tickets` wurde auf dieselbe Arbeitslogik wie `Nachrichten` umgestellt:
  - `/admin/tickets` ist jetzt reine Listenansicht mit einer Zeile pro Ticket
  - Klick auf ein Ticket öffnet `/admin/tickets/[ticketId]`
- Die neue Ticket-Detailseite enthält jetzt:
  - Verlauf aus verknüpften Nachrichten und Ticket-Events
  - manuellen Verlaufsblock
  - Mieter kontaktieren
  - Gewerk kontaktieren
  - Gewerk-Vorschlag aus der App, aber mit freier Auswahl aus allen hinterlegten Gewerken
  - Statuswechsel und Ticket-Löschen
- Antwort- und Dienstleistertexte bauen Signaturen jetzt nicht mehr hart selbst, sondern bekommen sie aus der Firmen-Signaturlogik.
- Verifiziert mit `npm run build` in `C:\Users\simon\Documents\halbmann-app`.

## Update 2026-04-03 – Ticket-Detailseite und professionelle Signaturen
- Die Ticket-Detailseite wurde erneut neu geordnet und stärker an einen echten Arbeitschat angelehnt.
- Oben steht jetzt nur noch der Ticketkopf mit Ticketnummer sowie Firma, Objekt, Einheit und Mieter in einer kompakten Zeile.
- Der frühere breite Info-Block unter dem Ticketkopf wurde entfernt.
- Der Status wird jetzt primär über hervorgehobene Status-Buttons gesteuert statt über einen separaten Statusblock.
- Tickets haben jetzt zusätzlich eine echte Wiedervorlage über `followUpDate`.
- Der Verlauf auf der Ticketseite führt jetzt alles zusammen:
  - Nachricht vom Mieter
  - Antworten an den Mieter
  - Nachrichten an Gewerke
  - interne Notizen
  - sonstige Ticket-Events
- Diese Verlaufseinträge sind farblich und inhaltlich voneinander getrennt, damit klar bleibt, was Mieterchat ist und was interner bzw. Gewerk-Verlauf.
- Die ursprüngliche Nachricht des Mieters steht jetzt nicht mehr separat als freier Textblock im Kopf, sondern im eigentlichen Verlauf.
- Das bisher getrennte Feld `Mieter kontaktieren`, das Feld `Gewerk kontaktieren` und das Feld `Verlauf manuell ergänzen` wurden in einen gemeinsamen Eingabebereich überführt.
- Dort kann jetzt zwischen drei Modi gewechselt werden:
  - `Mieter`
  - `Gewerk`
  - `Notiz`
- Für `Gewerk` gibt es eine Auswahl aller hinterlegten Gewerke am Objekt; der von der App erkannte Vorschlag wird vorausgewählt.
- Nachrichten an den Mieter werden weiter als reguläre ausgehende Nachrichten gespeichert und erscheinen dadurch sowohl im Ticketverlauf als auch im Nachrichtenverlauf des Mieters.
- Nachrichten an Gewerke werden ebenfalls aus dem Ticket verschickt, sind aber im Verlauf als eigener Typ gekennzeichnet.
- Tickets bleiben löschbar.
- Signaturen wurden fachlich deutlich erweitert:
  - zusätzlich zu Name, Firma, Anschrift, Mobilfunk, Telefon, E-Mail und Website jetzt auch Rechtsform, Abteilung/Zusatz, Registergericht, Handelsregister, Steuernummer und USt-IdNr.
- Diese Signaturfelder werden beim Öffnen einer Firma aus vorhandenen Firmendaten vorausgefüllt.
- Die Signaturvorschau wurde gestalterisch verfeinert:
  - Logo größer
  - Name über Firmenname
  - Kontaktblock kleiner und enger
  - Anschrift und Pflichtangaben eingebunden
- Der Logo-Upload läuft weiter lokal über `/api/admin/signature-logo` und legt Dateien in `public/uploads/signatures` ab.
- Der Versandpfad schreibt jetzt bei ausgehenden Nachrichten zusätzlich `draftKind`, `recipientType` und `recipientId` mit, damit Ticket- und Nachrichtenverläufe sauber unterscheiden können, ob eine Nachricht an Mieter oder Gewerk ging.
- Verifiziert mit `npm run build` in `C:\Users\simon\Documents\halbmann-app`.

## Update 2026-04-03 21:05
- Ticket-Detailseite in components/admin/TicketDetailWorkspace.tsx stark verdichtet und auf echten Chatfokus umgebaut.
- Ticketkopf jetzt kompakt: TK-... plus Firma, Objekt, Einheit, Mieter in einer Zeile ohne Kartenhintergrund.
- Wiedervorlage sitzt jetzt direkt bei den Status-/Lösch-Buttons im Kopf.
- Timeline zeigt nur noch Mieter-Nachrichten, Gewerk-Nachrichten und manuelle Notizen; doppelte System-/Vorgangsboxen werden im Ticket nicht mehr angezeigt.
- Einheit wird lesbar aufgelöst statt UUID-Fallback, bevorzugt aus 	enant.unitLabel bzw. property.units mit kompakter Floor/Positionslogik.
- Composer im Ticket vereinheitlicht: Modi Mieter, Gewerk, Notiz; Eingabe wird nach Senden/Speichern geleert.
- Portal-/Mietertext nutzt kleine Portal-Signatur, E-Mail-Version nutzt volle Firmensignatur.
- Signaturen erweitert: zusätzliche Felder Sitz der Gesellschaft und Geschäftsführung in lib/signatures.ts und components/admin/AdminSignatureSettings.tsx.
- Signaturvorschau dichter gestaltet, Kontaktdaten kleiner gesetzt, Logo in der Vorschau deutlich größer.
- 
pm run build läuft grün.

## Update 2026-04-03 21:28
- Ticket-Detailseite erneut verdichtet und funktional angepasst.
- Ticketkopf jetzt mit editierbarem Titel, kompakter Metazeile (Firma, Objekt, Einheit, Mieter) und nur noch Status In Bearbeitung / Erledigt plus Ticket löschen und Wiedervorlage.
- Ticket löschen fragt jetzt per Bestätigungsdialog nach und leitet danach zur Ticketliste zurück.
- Composer im Ticket steht jetzt über dem Verlauf; Verlauf sortiert neueste Nachricht zuerst.
- Tenant-/Gewerk-Nachrichten und Notizen laufen im Verlauf mit klar unterschiedlichen Karten; doppelte System-Vorgänge bleiben ausgeblendet.
- Antwortentwürfe an Mieter verwenden jetzt bevorzugt den erkannten Mieter statt romName.
- Gewerk-Composer nutzt im Editor die kleine Signatur; E-Mail-Versand erhält zusätzlich HTML mit kompaktem Signaturblock plus Footer.
- Signaturen erweitert um Sitz der Gesellschaft und Geschäftsführung; Vorschau dichter und Logo größer.
- pp/api/message-drafts/send/route.ts akzeptiert jetzt optional htmlBody.
- 
pm run build läuft grün.

## Update 2026-04-03 21:46
- Ticket-Composer weiter korrigiert: Mieteransprache priorisiert erkannte Tenant-Daten, nicht mehr romName.
- Gewerk-Entwürfe nutzen jetzt einen stabileren Empfängernamen-Fallback (Person, Firma oder E-Mail), damit nicht nur Guten Tag, erscheint.
- Ticket-Textarea setzt jetzt lang=de und spellCheck=false, damit die rote Browser-Unterstreichung im Editor verschwindet.
- HTML-Mail-Signatur im Versandpfad optisch verbessert: oberer Signaturblock kompakt, restliche Pflichtangaben zentriert in mehreren Spalten statt als lange Einzelsäule.
- 
pm run build bleibt grün.

## Update 2026-04-04 00:06
- OpenAI-Anbindung für individuelle Ticket-Antworten vorbereitet.
- Neue Serverroute: pp/api/ai/ticket-draft/route.ts.
- Nutzt OpenAI Responses API über das offizielle openai SDK.
- Ticket-Composer hat jetzt einen Button KI-Entwurf für die Modi Mieter und Gewerk; Notiz bleibt manuell.
- KI bekommt Tickettitel, Objekt, Einheit, Mieter, Gewerk und Originalnachricht und erzeugt daraus einen fallbezogenen Text statt starrer Vorlagen.
- Die erzeugten Texte landen direkt im Composer und werden dort noch manuell angepasst/freigegeben.
- Für produktive Nutzung muss OPENAI_API_KEY in .env.local gesetzt sein; optional OPENAI_MODEL (Fallback aktuell gpt-5-mini).
- 
pm run build läuft grün.
[2026-04-04T10:35:00+02:00] KI- und Kommunikations-Feinschliff weitergezogen: Im globalen Zahnrad-Menü gibt es jetzt einen direkten Link zu /admin/einstellungen?tab=ki. Für Mehrfach-Themen in einer Eingangsnachricht existiert nun /api/ai/message-ticket-suggestions; die Nachrichtendetailseite nutzt lokale Fallback-Vorschläge plus KI-Titelvorschläge, zeigt sie als auswählbare Chips und speichert beim Ticket-Anlegen zusätzlich issueFocus. Ticket-KI liest jetzt diesen issueFocus statt pauschal die gesamte Ursprungsnachricht. In Nachrichten-Details wurden Ticket-Hinweis, KI-Titel/Anwenden sowie größere Chat-/Antwort-/Notizflächen ergänzt. In Tickets wurden Composer und Verlauf deutlich vergrößert und beim KI-Hinweis ein zusätzlicher Anwenden-Button ergänzt. Im Mieterbereich wurde der Chatverlauf auf ein nachrichtenähnliches Muster erweitert: eigener Composer mit KI-Entwurf, größere Eingabefläche, Scrollbereich für den Verlauf und direkte Antworten an genau diesen Mieter. Mail senden in Nachrichten wurde weiter vergrößert. Build ist grün.

## Update 2026-04-04 12:03
- Nachrichten: Posteingang zeigt keine Endlöschung mehr. Alte Nachrichten bietet jetzt Endgültig löschen nur dort an.
- Tickets: Filter Gelöscht bleibt aktiv. Soft-Delete läuft über Ticketstatus deleted, endgültige Löschung nur in der Gelöscht-Ansicht.
- Dritte & Dienstleister: Chatbereich in PersonDetailView ist aktiv. Ausgehende Gewerk-Nachrichten aus Tickets landen über messages.recipientType = contact und ecipientId im Kontakt-Chat, während sie im Ticketverlauf weiterhin sichtbar bleiben.
- Encoding-Schäden in den zuletzt bearbeiteten Admin-Dateien bereinigt; 
pm run build ist wieder grün.

## Update 2026-04-04 12:42
- Tickets: Composer füllt sich nicht mehr automatisch bei Mieter/Gewerk. Inhalt entsteht erst durch Freitext oder KI-Entwurf.
- Ticket-KI: Promptlogik auf Revision umgestellt. Zusätzliche Anweisung überschreibt Standardformulierungen, bestehender Entwurf wird gezielt überarbeitet.
- Nachrichten > Mail senden: lädt Absenderadresse aus den Mailbox-Einstellungen, zeigt sie im Formular an und gibt sie an die KI mit.
- Nachrichten > Mail senden: Zählerauswahl für den gewählten Mieter / das gewählte Objekt ergänzt; ausgewählte Zähler gehen in den KI-Entwurf ein.
- Nachrichten > Mail senden: KI-Hinweis hat jetzt sichtbaren Anwenden-Button.
- Mieter und Dritte & Dienstleister: KI-Hinweis + Anwenden im Chatbereich ergänzt.
- Mail-Footer: kompakter auf maximal drei zentrierte Zeilen reduziert.
- message-drafts/send: nutzt für gespeicherte ausgehende Nachrichten jetzt die konfigurierte Mailbox-Adresse als romEmail statt hartem Fallback.
- 
pm run build ist grün.
[2026-04-04T11:34:00+02:00] UI/Workflow-Runde: TicketDetailWorkspace komplett neu aufgebaut (eigener Verlauf je Ticket plus gemeinsame Ursprungsnachricht, KI-Hinweis/Anwenden/Entwurf jetzt über dem Texteingabefeld, Composer leer bei Moduswechsel, Wiedervorlage/Status/Delete oben kompakt). TenantDetailView und PersonDetailView neu aufgebaut, Chatbereich jetzt ganz oben vor den Stammdaten. MessagesWorkspace: manuelle Zählerauswahl entfernt, stattdessen automatische Zählerübergabe an die KI bei passenden Betreffen; permanentes Löschen alter Nachrichten schreibt jetzt Tombstones in deletedMessages. Mailbox-Einstellungen um mailHeaderText erweitert; ausgehende E-Mails erhalten jetzt einen gestalteten Header-Banner aus den Mail-Einstellungen. KI-Routen ticket-draft, message-draft, message-reply-draft vollständig in sauberem UTF-8 ersetzt und auf strengere Einzelthemen-/Anweisungslogik umgestellt. Firestore-Regeln erweitert um deletedMessages und live nach halbmann-app deployt. npm run build grün.

[2026-04-04T14:10:00+02:00] Chat-/Mail-Logik erneut gehärtet: Mail-Import nutzt jetzt zusätzlich externalMessageKey (lib/mailIdentity.ts) für Dedupe/Tombstones, sowohl serverseitig in lib/inboundEmailIngest.ts als auch im Client-Fallback in lib/clientWorkflow.ts. Alte, endgültig gelöschte Mails sollen dadurch nicht mehr wieder erscheinen, selbst wenn Message-IDs fehlen oder variieren. Outbound-Mails werden in app/api/message-drafts/send/route.ts jetzt immer als messages-Dokument gespeichert, auch ohne related messageId, und übernehmen tenantId/propertyId/unitId/recipientType sauber aus dem Draft. Dadurch sollen ausgehende Nachrichten aus Mail senden künftig auch im Mieter-/Dienstleister-Chat auftauchen. Der Sendepfad nutzt jetzt Signaturdaten aus dem Draft und baut HTML-Footer zentraler über lib/signatures.ts. KI-Routen message-reply-draft, message-draft und ticket-draft wurden erneut in sauberem UTF-8 überarbeitet und um klaren Kontextmodus Neue Nachricht vs. Antwort auf Verlauf erweitert. TenantDetailView, PersonDetailView, TicketDetailWorkspace und MessageDetailWorkspace übergeben diesen Modus jetzt an die KI bzw. setzen ihn im UI sichtbar. MessageDetailWorkspace wurde funktional aufgeräumt: direkte Antwort steht jetzt über dem Verlauf, Ticket-KI-Hinweis und KI-Titel-Button sind entfernt, stattdessen bleiben nur noch Vorschlags-Chips für Mehrfachthemen-Tickets. TicketDetailWorkspace setzt Composer-Zustand beim Ticketwechsel zurück, damit Inhalte nicht ins nächste Ticket mitwandern. PersonDetailView nutzt jetzt ebenfalls Firmen-Signaturdaten beim Versand. npm run build grün.
[2026-04-04T15:55:00+02:00] Navigation/Signatur/Composer weiter bereinigt: In ProtectedAreaLayout wird der aktive Link jetzt als längster passender Treffer bestimmt, damit links nur noch genau eine Seite markiert bleibt. Neue Hilfslogik in lib/draftComposer.ts setzt Begrüßung und Portal-Signatur systemseitig, strippt KI-Begrüßung/Abschluss aus Antworten heraus und verhindert damit falsche Anreden oder Empfänger-Signaturen in TenantDetailView, PersonDetailView, TicketDetailWorkspace, MessageDetailWorkspace und MessagesWorkspace. lib/signatures.ts vollständig in sauberes UTF-8 ersetzt; E-Mail-Signatur besteht nun aus kurzem Abschlussblock (Mit freundlichen Grüßen / Name / Firma) plus kompaktem, zentriertem Footer mit bis zu drei Zeilen und absolut aufgelöstem Logo. app/api/message-drafts/send/route.ts ebenfalls in sauberem UTF-8 ersetzt und an die neue Abschluss-/Footer-Logik angepasst. buildTenantContact in lib/adminWorkflow.ts leitet Anreden nun zusätzlich aus anrede/gender ab. MessagesWorkspace zeigt Wiedervorlage jetzt nicht mehr nur im Einzelmodus, sondern überall dort, wo Empfänger ausgewählt sind. npm run build grün.

[2026-04-04T16:35:00+02:00] Mail-/Ticket-Runde weiter bereinigt: draftComposer priorisiert jetzt eine im Kontext gefundene Anrede (z. B. Frau Tran) vor fehlerhaften Stammdaten-Anreden. app/api/ai/ticket-draft/route.ts wurde auf strikteren Einzelticket-Fokus gehärtet: andere Maengel aus derselben Ursprungsmail sollen explizit ignoriert werden, und Nutzerkorrekturen muessen Vorrang haben. AdminMailboxSettings wurde komplett in sauberes UTF-8 ersetzt und erlaubt jetzt getrennte Bearbeitung von Mail-Header und Mail-Footer mit benutzerfreundlichen Formatoptionen (Schriftart, Schriftgroesse, Ausrichtung, Fett, Kursiv, Unterstreichen, Trennlinie) neben den IMAP/SMTP-Daten. MailboxSettings/LocalConfig/ServerConfig/API wurden um diese Header-/Footer-Felder erweitert. app/api/message-drafts/send/route.ts rendert Header und Footer nun mit den gespeicherten Stiloptionen. Build ist gruen.

[2026-04-04T16:55:00+02:00] Navigations-/Ticket-/Settings-Runde: ProtectedAreaLayout weiter verdichtet (Bestand-Block optisch neutraler, Sidebar-Logo größer). TicketsWorkspace nach oben gezogen, Filterbuttons und manueller Ticketbutton kompakter. TicketDetailWorkspace weiter nach oben gezogen; Zurück-Link sitzt jetzt links oben im Content, Ticketkopf dichter in einer Zeile mit TK/Firma/Objekt/Einheit/Mieter. Einstellungen umgebaut: Tab Postfach heißt nun Postfach-Zugang und zeigt nur noch Zugangsdaten; unter Signaturen werden jetzt AdminSignatureSettings plus die vollständige Header-/Footer-Steuerung aus AdminMailboxSettings angezeigt. Mailbox-Einstellungen unterstützen getrennte Header-/Footer-Formatierung (Schriftart, Schriftgröße, Ausrichtung, Fett, Kursiv, Unterstreichen, Trennlinie) serverseitig und lokal. buildIssueSuggestionsFromText in lib/adminWorkflow.ts ergänzt bekannte Problemvorschläge priorisiert (u.a. Verstopfung in Küche, Tropfende Toilette, Mangelhafte Treppenhausreinigung), damit Tickettitel aus Mehrfach-Nachrichten brauchbarer vorgeschlagen werden. npm run build grün.

## Update 2026-04-04 17:20
- `Signaturen` und `Postfach-Zugang` weiter getrennt: unter `Signaturen` werden jetzt Signatur plus Header/Footer-Editor gezeigt, ohne IMAP/SMTP-Zugangsdaten.
- `AdminMailboxSettings` unterstützt jetzt die Modi `credentials`, `layout`, `full`.
- KI für `Neue Nachricht` bei Mieter/Dienstleister härter vom Verlauf getrennt: `message-reply-draft` ignoriert alte Themen in `new`-Kontext jetzt explizit, und Mieter sollen nicht mehr zur Firmen-Mailadresse geschickt werden.
- Sidebar `Bestand` optisch weiter neutralisiert, damit es nicht wie ein aktiver Link wirkt.
- Header/Settings-Menü mit höherem `z-index`, damit das Zahnrad nicht hinter Ticketfeldern verschwindet.
- Ticketliste und Ticketdetail weiter nach oben gezogen; Ticketdetail mit kompakterem Kopf und Back-Button oben links.
- Build geprüft: `npm run build` grün.
## Update 2026-04-04 17:40
- Ticket-/Ticketdetail-Headerleiste weiter vereinfacht: globaler Kopfstreifen für `/admin/tickets` und `/admin/tickets/[ticketId]` entfernt, Settings-Zahnrad dort jetzt separat/floating.
- `AdminSignatureSettings` erweitert: Signatur hat jetzt eigenen Formatierungsblock mit Schriftart, Schriftgröße, Ausrichtung, Fett, Kursiv, Unterstreichen und Trennlinie.
- Signaturdaten speichern jetzt zusätzliche Felder `signatureFontFamily`, `signatureFontSize`, `signatureTextAlign`, `signatureFontBold`, `signatureFontItalic`, `signatureFontUnderline`, `signatureUseDivider`.
- `lib/signatures.ts` aktualisiert, damit E-Mail-Signaturen diese Formatierung auch tatsächlich im HTML-Footer berücksichtigen.
- UTF-8-Fehler nach Dateineuschreiben bereinigt.
- Build geprüft: `npm run build` grün.

---

## Update 2026-04-04 19:51

- Ticketliste und Ticketdetail wurden weiter nach oben gezogen, damit die Kopfzeilen nÃ¤her an die Zahnrad-Zeile rÃ¼cken.
- Die Ticketdetailseite nutzt jetzt eine kompaktere Metadatenzeile oben und einen zurÃ¼ckgesetzten Arbeitsbereich darunter.
- Die Sidebar im Bereich Bestand wurde optisch entschÃ¤rft, damit nur noch echte aktive EintrÃ¤ge hervortreten.
- Im Mieterchat nutzt Neue Nachricht jetzt den KI-Pfad fÃ¼r eigenstÃ¤ndige Nachrichten statt den Antwortpfad auf den Verlauf.
- Der KI-Kontext fÃ¼r Mieter berÃ¼cksichtigt jetzt zusÃ¤tzlich die konfigurierte Absenderadresse und vorhandene ZÃ¤hlerdaten.
- Die KI-Regeln wurden verschÃ¤rft, damit bei Tickets und Mieter-Nachrichten die Anrede Frau/Herr verbindlich ist und nur das aktuelle Einzelticket behandelt wird.
- matchCategory() priorisiert Hausreinigung und konkrete ProblemfÃ¤lle wie Treppenhausreinigung, tropfende Toilette und Verstopfung in KÃ¼che jetzt vor allgemeineren Treffern.
- Im Reiter Signaturen bleibt Header/Footer-Bearbeitung erhalten, aber der Postfach-Aktiv-Schalter wird dort nicht mehr angezeigt.
- 
pm run build ist auf diesem Stand grÃ¼n.

---

## Update 2026-04-13 12:41

- Einstellungen > Brief wurde funktional in drei Unterbereiche aufgeteilt:
  - `Briefvorlage`
  - `Anrede`
  - `Abschluss`
- Die Umschaltung läuft über:
  - `/admin/einstellungen?tab=brief&sub=vorlage`
  - `/admin/einstellungen?tab=brief&sub=anrede`
  - `/admin/einstellungen?tab=brief&sub=abschluss`
- `app/admin/einstellungen/page.tsx` wurde dafür erweitert und übergibt den aktiven Unterbereich an `components/admin/AdminLetterSettings.tsx`.
- `AdminLetterSettings` unterstützt jetzt einen `view`-Prop:
  - `vorlage`
  - `anrede`
  - `abschluss`
- Ziel dieser Trennung:
  - pro Unterseite nur noch ein echtes Formatierfeld
  - dadurch soll die Toolbar nicht mehr zwischen mehreren `contentEditable`-Feldern auf derselben Seite durcheinanderkommen

### Aktueller Stand Brief-Einstellungen

- `Briefvorlage` zeigt weiterhin das große Vorlagenfeld mit Logo, Linien, Rändern und Platzhaltern.
- `Anrede` hat jetzt ein eigenes großes Rich-Text-Feld nur für die formatierbare Brief-Anrede.
- `Abschluss` hat jetzt ein eigenes großes Rich-Text-Feld nur für den formatierbaren Abschlussblock.
- Die Toolbar-Buttons wurden bereits so angepasst, dass ihre Auswahl per `selectionchange` zentraler gemerkt wird.
- Speichern der Rich-Text-Inhalte für Anrede und Abschluss erfolgt nicht mehr bei jedem Tastendruck, sondern erst beim Verlassen des Feldes bzw. beim Speichern.
- `npm run build` lief nach dieser Umstellung erfolgreich grün.

### Noch offener Punkt vor dem Neustart

- Die Trennung in drei Unterseiten ist jetzt drin, aber noch nicht abschließend im Browser verifiziert.
- Vor dem Neustart war genau das der nächste Prüfpunkt:
  - Funktioniert Formatieren in `Anrede` jetzt sauber?
  - Funktioniert Formatieren in `Abschluss` jetzt sauber?
  - Bleibt `Briefvorlage` stabil und arbeitet nur noch auf dem großen Vorlagenfeld?

### Wichtige betroffene Dateien

- `app/admin/einstellungen/page.tsx`
- `components/admin/AdminLetterSettings.tsx`
- außerdem weiter relevant für Brief-/Signatur-Rendering:
  - `lib/signatures.ts`

### Hinweis für den nächsten Chat

- Erster sinnvoller Schritt im neuen Chat:
  1. VS Code / Browser neu starten
  2. `Einstellungen > Brief > Anrede` testen: markieren + Fett/Kursiv/Unterstreichen
  3. `Einstellungen > Brief > Abschluss` genauso testen
  4. danach `Briefvorlage` kurz gegenprüfen
- Falls die Selektion dort immer noch springt, dann als nächstes nicht wieder symptomatisch patchen, sondern die Toolbar-/Selection-Logik in `AdminLetterSettings.tsx` für die drei Views jeweils strikt getrennt behandeln.
