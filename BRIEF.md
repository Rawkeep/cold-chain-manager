# Brief 02 — cold-chain-manager

**Position in der Kette:** Kühlung/Lagerung. Ein Tomatenbauer verdient nur,
wenn die Ernte rechtzeitig verkauft ist — ein Kühlraum-Betreiber verdient an
Dutzenden Farmern gleichzeitig, pro Kiste und Tag. Solar-Kühlräume sind in
Nigeria/Togo ein bewiesenes Geschäftsmodell (Vorbild: ColdHubs, „pay-per-crate").

## Copy-&-Paste-Auftrag (CLI/UI)

```
Eine offline-first Web-App "cold-chain-manager" für Betreiber von (Solar-)Kühlräumen in Westafrika: Kühlräume/Zonen mit Kapazität in Kisten verwalten, Einlagerung je Kunde erfassen (Kunde, Produkt, Anzahl Kisten, Einlagerdatum, erwartete Lagerdauer), Auslagerung mit automatischer Gebührenberechnung (Tarif pro Kiste pro Tag in XOF/NGN, Integer-Arithmetik, angebrochener Tag zählt voll), Belegdruck für Ein- und Auslagerung, Temperatur-Log je Raum (manuelle Erfassung mehrmals täglich, Soll-Bereich je Raum, Alarm-Anzeige bei Überschreitung), Auslastungs-Dashboard (belegte vs. freie Kisten je Raum, Umsatz pro Tag/Monat, Temperaturverlauf als einfache Sparkline ohne externe Chart-Library), Kundenkonten mit offenen Posten, CSV-Import der Lager-Stammdaten (Spalten: lager_id, name, typ, kapazitaet_kisten, soll_temp_min, soll_temp_max). Vanilla JS + localStorage/IndexedDB, keine externen Requests, UI Französisch und Englisch, Verderblichkeitsklasse je Produkt bestimmt empfohlene Maximal-Lagerdauer mit Warnung bei Überschreitung.
```

## Zielgruppe & Nutzenversprechen

- **Nutzer:** Betreiber von 1–10 Kühlräumen (Solar oder Netz+Generator) an
  Märkten/Sammelpunkten; Personal ohne IT-Vorkenntnisse; Délestages sind
  Alltag → die App selbst muss stromausfall-tolerant (offline, lokal) sein.
- **Nutzen:** Abrechnung wird wasserdicht (pro Kiste/Tag), Temperatur wird
  nachweisbar (Qualitätsargument gegenüber Abnehmern), Auslastung sichtbar.

## Kern-Datenmodell

| Tabelle | Felder (Auszug) |
|---|---|
| `rooms` | lager_id, name, typ (solar/netz/hybrid), kapazitaet_kisten, soll_temp_min, soll_temp_max |
| `storage_lots` | lot_id, kunde_id, produkt_id, kisten, einlager_ts, auslager_ts?, tarif_pro_kiste_tag, status |
| `temp_log` | id, lager_id, ts, temp_c_x10 (Integer, z. B. 45 = 4,5 °C), erfasser |
| `customers` | kunde_id, name, telefon, typ (farmer/aggregator/haendler), offener_saldo |
| `products` | produkt_id, name_fr, name_en, max_lagerdauer_tage, verderblichkeit |
| `invoices` | beleg_nr, kunde_id, lot_id, tage, kisten, betrag, bezahlt (ja/nein/teil) |

## Akzeptanzkriterien (prüfbar)

1. Gebühr = kisten × tarif × Kalendertage (Einlagertag zählt, angebrochener
   Tag voll) — deterministisch, mit Unit-Test-Beispielen im Brief-Repo.
2. Ein Raum kann nicht über Kapazität belegt werden; freie Kisten je Raum
   immer korrekt (Σ aktive Lots).
3. Temperatur-Eintrag außerhalb des Soll-Bereichs färbt Raum-Kachel rot und
   erscheint in einer Alarm-Liste; Verlauf der letzten 7 Tage als Inline-SVG.
4. Lot über `max_lagerdauer_tage` hinaus → Warnhinweis auf Dashboard
   („Verderb-Risiko"), sortiert nach Dringlichkeit.
5. Ein-/Auslagerbeleg druckbar mit Beleg-Nr., Kisten, Tagen, Betrag.
6. Kundenkonto zeigt offene Posten; Teilzahlung möglich.
7. Vollständig offline nutzbar, FR/EN umschaltbar, Beträge Integer.

## Ausbau-Ideen (nicht Teil des MVP)

Bluetooth-Temperatursensoren, SMS/WhatsApp-Benachrichtigung „deine Ware
lagert seit X Tagen", Übergabe an togo-logistics für Kühltransport,
Mehr-Standort-Sync.
