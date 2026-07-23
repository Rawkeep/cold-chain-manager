# cold-chain-manager

Offline-first Web-App fuer Betreiber von (Solar-)Kuehlraeumen in Westafrika
("pay-per-crate", Vorbild ColdHubs). Verwaltet Kuehlraeume, erfasst Ein- und
Auslagerungen je Kunde, rechnet Lagergebuehren deterministisch ab (Tarif pro
Kiste pro Kalendertag), protokolliert Temperaturen mit Alarm bei
Soll-Verletzung und zeigt Auslastung, Umsatz und Verderb-Risiken auf einem
Dashboard.

## Was die App tut

- **Kuehlraeume / Zonen**: Kapazitaet in Kisten, Typ (solar/netz/hybrid),
  Soll-Temperaturbereich je Raum. Stammdaten auch per CSV importierbar
  (Spalten: `lager_id, name, typ, kapazitaet_kisten, soll_temp_min, soll_temp_max`).
- **Einlagerung** je Kunde (Kunde, Produkt, Anzahl Kisten, Einlagerdatum,
  Tarif). Eine Einlagerung kann die Raum-Kapazitaet nicht ueberschreiten.
- **Auslagerung** mit automatischer Gebuehrenberechnung:
  `Gebuehr = Kisten x Tarif x Kalendertage`. Der Einlagertag zaehlt mit, ein
  angebrochener Tag zaehlt voll. Alle Betraege sind Integer in der kleinsten
  Waehrungseinheit (XOF/NGN, keine Nachkommastellen).
- **Belegdruck** fuer Ein- und Auslagerung (Beleg-Nr., Kisten, Tage, Betrag)
  ueber den Browser-Druckdialog ("Als PDF speichern") -- keine externe
  PDF-Library.
- **Temperatur-Log** je Raum (manuelle Erfassung). Werte ausserhalb des
  Soll-Bereichs faerben die Raum-Kachel rot und erscheinen in einer
  Alarm-Liste. Der 7-Tage-Verlauf wird als Inline-SVG-Sparkline gezeichnet
  (ohne Chart-Library).
- **Dashboard**: belegte vs. freie Kisten je Raum, Umsatz pro Tag/Monat,
  Verderb-Risiko-Warnungen (Lot ueber empfohlener Maximal-Lagerdauer, sortiert
  nach Dringlichkeit).
- **Kundenkonten** mit offenen Posten und Teilzahlung.
- **Zweisprachig** Franzoesisch/Englisch, umschaltbar; vollstaendig offline.

## Technik / Hausstil

- Vanilla JS, **kein Build-Tool**, **keine externen Requests** (kein CDN, kein
  fetch/XHR). Alle Skripte lokal ueber `<script>`-Tags in `index.html` in
  korrekter Reihenfolge geladen.
- Jedes Logik-Modul ist eine IIFE, die ihre API an `globalThis`/`window`
  haengt und zusaetzlich per `module.exports` fuer Node-Tests exportiert.
- `js/storage.js`: IndexedDB als Primaerspeicher mit transparentem
  localStorage-Fallback, Promise-basiert.
- Geldbetraege und Temperaturen (als `x10`, z.B. `45 = 4,5 Grad C`) sind
  durchgaengig Integer -- deterministische Berechnung mit `Math.round`, keine
  Float-Drift.

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
| `app.js` | UI-Orchestrierung (nur Browser) |

## Starten

Die App braucht keinen Build. Einen beliebigen statischen Server im
Projektverzeichnis starten und `index.html` oeffnen, z.B.:

```bash
python3 -m http.server 8080   # dann http://localhost:8080 aufrufen
```

(Ein Server ist nur wegen IndexedDB/`file://`-Restriktionen empfehlenswert;
die App selbst macht keine Netzwerkzugriffe.)

## Testen

Tests laufen mit dem in Node eingebauten Test-Runner (keine npm-Deps):

```bash
node --test tests/
```

Die Tests decken die deterministische Kern-Logik ab: Gebuehrenberechnung
(inkl. "angebrochener Tag zaehlt voll"), Kapazitaets-Check (keine
Ueberbelegung), freie Kisten, Temperatur-Alarm bei Ueber-/Unterschreitung,
Maximal-Lagerdauer-Warnung, Teilzahlung sowie CSV-Round-Trip. Zusaetzlich
fuehrt `tests/syntax-check.test.js` fuer **jede** Datei in `js/` ein
`node --check` aus.
