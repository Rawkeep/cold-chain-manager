# cold-chain-manager

Offline-faehige Web-App fuer Betreiber von (Solar-)Kuehlraeumen in
Westafrika ("pay-per-crate", Vorbild ColdHubs). Verwaltet Kuehlraeume,
erfasst Ein- und Auslagerungen je Kunde, rechnet Lagergebuehren
deterministisch ab (Tarif pro Kiste pro Kalendertag), protokolliert
Temperaturen mit Alarm bei Soll-Verletzung und zeigt Auslastung, Umsatz und
Verderb-Risiken auf einem Dashboard. Die Oberflaeche ist zweisprachig
Franzoesisch/Englisch (Zielmarkt Westafrika); Code-Kommentare sind Deutsch.

Es handelt sich um eine reine Client-Seite: kein Server, kein Build-Schritt,
kein `package.json` -- `index.html` plus ein Dutzend `<script>`-Module und
eine Stylesheet-Datei.

## Was die App tut

- **Kuehlraeume / Zonen**: Kapazitaet in Kisten, Typ (solar/netz/hybrid),
  Soll-Temperaturbereich je Raum. Stammdaten auch per CSV importierbar
  (Spalten: `lager_id, name, typ, kapazitaet_kisten, soll_temp_min, soll_temp_max`).
- **Produkte** mit Verderblichkeitsklasse (niedrig/mittel/hoch) und optionaler
  eigener Maximal-Lagerdauer; ohne expliziten Wert gilt eine aus der Klasse
  abgeleitete Empfehlung (3/7/30 Tage).
- **Einlagerung** je Kunde (Kunde, Produkt, Anzahl Kisten, Tarif pro Kiste und
  Tag, Waehrung XOF/NGN, Einlagerdatum). Eine Einlagerung kann die
  Raum-Kapazitaet nicht ueberschreiten -- die freien Kisten je Raum ergeben
  sich aus Kapazitaet minus Summe der Kisten aller aktiven Lots.
- **Auslagerung** mit automatischer Gebuehrenberechnung:
  `Gebuehr = Kisten x Tarif x Kalendertage`. Der Einlagertag zaehlt mit, ein
  angebrochener Tag zaehlt voll (Zaehlung ueber UTC-Tages-Indizes, keine
  Float-Arithmetik). Alle Betraege sind Integer in der kleinsten
  Waehrungseinheit (XOF/NGN, keine Nachkommastellen).
- **Belegdruck** fuer Ein- und Auslagerung (Beleg-Nr., Kunde, Produkt, Raum,
  Kisten, Tage, Betrag) als druckoptimiertes HTML-Fragment ueber den
  Browser-Druckdialog ("Als PDF speichern") -- keine externe PDF-Library.
- **Temperatur-Log** je Raum (manuelle Erfassung inkl. Zeitpunkt und
  Erfasser). Werte ausserhalb des Soll-Bereichs faerben die Raum-Kachel rot
  (Rahmen + Hintergrund) und erscheinen in einer nach Dringlichkeit
  sortierten Alarm-Liste. Der 7-Tage-Verlauf wird je Raum als Inline-SVG-
  Sparkline mit hinterlegtem Soll-Band gezeichnet (ohne Chart-Library).
- **Dashboard**: belegte vs. freie Kisten je Raum (Kachel-Raster), Umsatz
  pro Tag/Monat, Alarmliste, Verderb-Risiko-Warnungen (Lot ueber empfohlener
  Maximal-Lagerdauer, sortiert nach staerkster Ueberschreitung zuerst).
- **Kundenkonten**: offene Posten je Kunde (Summe Beleg-Restbetraege) und
  Teilzahlung auf einzelne Belege (Status nein/teil/ja).
- **CSV Import/Export** der Raum-Stammdaten (RFC4180-Escaping, ohne externe
  Bibliothek; Export gefolgt von Import ist round-trip-stabil).
- **Zweisprachig** Franzoesisch/Englisch, per Header-Buttons umschaltbar,
  Auswahl in `localStorage` gemerkt; vollstaendig offline nutzbar.

## Technik / Hausstil

- Vanilla JS, **kein Build-Tool**, **keine externen Requests** (kein CDN,
  kein fetch/XHR). Alle Skripte lokal ueber `<script>`-Tags in `index.html`
  in der von den Abhaengigkeiten vorgegebenen Reihenfolge geladen.
- Jedes Fachmodul ist eine IIFE, die ihre API an `window`/`globalThis` haengt
  (`CCMModels`, `CCMStorage`, `CCMFees`, ...) und zusaetzlich per
  `module.exports` fuer Node-Tests exportiert. `app.js` ist die Ausnahme:
  reiner Browser-Orchestrierungscode, der bei fehlendem `document` (Node)
  sich selbst deaktiviert.
- `js/storage.js`: IndexedDB als Primaerspeicher (ein Object-Store je
  Entitaet, `keyPath: 'id'`) mit transparentem localStorage-Fallback, beides
  Promise-basiert.
- Geldbetraege und Temperaturen (als `x10`, z.B. `45 = 4,5 Grad C`) sind
  durchgaengig Integer -- deterministische Berechnung mit `Math.round`,
  keine Float-Drift.

### Module (`js/`)

| Datei | Aufgabe |
|-------|---------|
| `models.js` | Entitaeten + Validierung (Room, Product, Customer, StorageLot, TempLog, Invoice) |
| `storage.js` | Persistenz (IndexedDB + localStorage-Fallback) |
| `i18n.js` | FR/EN-Woerterbuch + Sprachumschaltung |
| `fees.js` | Kalendertag-Zaehlung + Gebuehrenberechnung |
| `capacity.js` | Freie Kisten + Kapazitaets-Guard (keine Ueberbelegung) |
| `temperature.js` | Alarm-Bewertung, Alarm-Liste, 7-Tage-Sparkline (SVG) |
| `perishability.js` | Verderb-Risiko-Warnungen nach Dringlichkeit |
| `accounts.js` | Offene Posten + Teilzahlung |
| `receipt.js` | Ein-/Auslagerbelege (druckbar) |
| `csv.js` | CSV-Import/-Export der Raum-Stammdaten |
| `app.js` | UI-Orchestrierung (nur Browser, bindet alle obigen Module an `index.html`) |

Ansichten in `index.html` (per Navigation umschaltbar): Dashboard, Chambres
froides (Raeume + Produkte), Entree en stock (Einlagerung), Sortie de stock
(Auslagerung + Belegdruck), Temperature, Clients (Kunden + offene Posten),
Import/Export CSV.

## Starten

Die App braucht keinen Build und keinen `npm install`. Einen beliebigen
statischen Server im Projektverzeichnis starten und `index.html` oeffnen,
z.B.:

```bash
python3 -m http.server 8080   # dann http://localhost:8080 aufrufen
```

(Ein Server ist nur wegen IndexedDB/`file://`-Restriktionen empfehlenswert;
die App selbst macht keine Netzwerkzugriffe.)

## Testen

Tests laufen mit dem in Node eingebauten Test-Runner (keine npm-Deps, kein
`package.json` noetig):

```bash
node --test tests/
```

Die Tests (80 Faelle in 8 Dateien) decken die deterministische Kern-Logik
ab: Gebuehrenberechnung (inkl. "angebrochener Tag zaehlt voll"),
Kapazitaets-Check (keine Ueberbelegung), freie Kisten, Temperatur-Alarm bei
Ueber-/Unterschreitung samt Sparkline-Aufbau, Maximal-Lagerdauer-Warnung,
Teilzahlung/offene Posten sowie CSV-Round-Trip. Zusaetzlich fuehrt
`tests/syntax-check.test.js` fuer **jede** Datei in `js/` ein `node --check`
aus. `app.js` ist bewusst nicht durch Unit-Tests abgedeckt, da es direkt auf
`document`/`window` zugreift -- die fachliche Logik, die es orchestriert,
steckt und wird getestet in den uebrigen Modulen.
