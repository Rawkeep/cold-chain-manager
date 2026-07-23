/**
 * fees.js
 *
 * Deterministische Gebuehrenberechnung fuer die Lagerung ("pay-per-crate").
 *
 * Regel (Akzeptanzkriterium 1):
 *   Gebuehr = kisten x tarif x Kalendertage
 *   - Der Einlagertag zaehlt mit.
 *   - Ein angebrochener Tag zaehlt voll.
 *
 * Umsetzung: Ein "Kalendertag" ist ein UTC-Kalendertag. Wir bestimmen den
 * Tages-Index (Math.floor(epochMs / 86400000)) von Ein- und Auslagerung und
 * zaehlen inklusive beider Grenztage: days = idxAus - idxEin + 1. Dadurch
 * zaehlt der Einlagertag mit und jeder angebrochene Tag voll. Ergebnis ist
 * immer mindestens 1 Tag. Alle Betraege sind Integer (kleinste Waehrungs-
 * einheit) -- keine Float-Arithmetik, keine externen Requests.
 */
(function (global) {
  'use strict';

  var MS_PER_DAY = 86400000;

  /**
   * Wandelt einen Zeitstempel (ISO-String oder epoch-ms) in seinen
   * UTC-Tages-Index (ganze Tage seit Epoch). Wirft bei ungueltiger Eingabe.
   */
  function dayIndex(ts) {
    var ms;
    if (typeof ts === 'number' && isFinite(ts)) {
      ms = ts;
    } else if (typeof ts === 'string') {
      ms = Date.parse(ts);
    } else if (ts instanceof Date) {
      ms = ts.getTime();
    } else {
      ms = NaN;
    }
    if (!isFinite(ms)) {
      throw new Error('Ungueltiger Zeitstempel: ' + String(ts));
    }
    return Math.floor(ms / MS_PER_DAY);
  }

  /**
   * Zaehlt die abrechenbaren Kalendertage zwischen Ein- und Auslagerung
   * (inklusive beider Grenztage; angebrochener Tag zaehlt voll). Ohne
   * Auslagerzeitpunkt (noch aktives Lot) wird refTs (Standard: jetzt) genutzt.
   * Ergebnis ist immer >= 1.
   */
  function calendarDays(storedAt, releasedAt, refTs) {
    var startIdx = dayIndex(storedAt);
    var endSource = releasedAt !== undefined && releasedAt !== null
      ? releasedAt
      : (refTs !== undefined ? refTs : Date.now());
    var endIdx = dayIndex(endSource);
    if (endIdx < startIdx) {
      throw new Error('Auslagerdatum liegt vor dem Einlagerdatum.');
    }
    return endIdx - startIdx + 1;
  }

  /**
   * Deterministische Gebuehr = kisten x tarif x tage. Alle Faktoren muessen
   * nicht-negative Integer sein; das Produkt bleibt Integer.
   */
  function computeFee(crates, tarifPerCrateDay, days) {
    if (!Number.isInteger(crates) || crates < 0) {
      throw new Error('crates muss ein nicht-negativer Integer sein.');
    }
    if (!Number.isInteger(tarifPerCrateDay) || tarifPerCrateDay < 0) {
      throw new Error('tarifPerCrateDay muss ein nicht-negativer Integer sein.');
    }
    if (!Number.isInteger(days) || days < 1) {
      throw new Error('days muss ein Integer >= 1 sein.');
    }
    return crates * tarifPerCrateDay * days;
  }

  /**
   * Berechnet Tage, Kisten und Betrag fuer ein Lot (siehe
   * CCMModels.createStorageLot). Nutzt lot.releasedAt, sonst refTs/jetzt.
   * Liefert { days, crates, amount, currency }.
   */
  function computeLotFee(lot, refTs) {
    var l = lot || {};
    var days = calendarDays(l.storedAt, l.releasedAt, refTs);
    var crates = l.crates;
    var amount = computeFee(crates, l.tarifPerCrateDay, days);
    return {
      days: days,
      crates: crates,
      amount: amount,
      currency: l.currency
    };
  }

  var CCMFees = {
    MS_PER_DAY: MS_PER_DAY,
    dayIndex: dayIndex,
    calendarDays: calendarDays,
    computeFee: computeFee,
    computeLotFee: computeLotFee
  };

  global.CCMFees = CCMFees;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CCMFees;
  }
})(typeof window !== 'undefined' ? window : globalThis);
