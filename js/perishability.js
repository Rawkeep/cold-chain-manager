/**
 * perishability.js
 *
 * Verderb-Risiko-Warnungen (Akzeptanzkriterium 4). Ueberschreitet ein aktives
 * Lot die produktabhaengige empfohlene Maximal-Lagerdauer (maxStorageDays,
 * bestimmt aus der Verderblichkeitsklasse), entsteht eine Warnung. Die
 * Warnliste wird nach Dringlichkeit sortiert (staerkste Ueberschreitung zuerst).
 * Nutzt dieselbe Kalendertag-Zaehlung wie die Gebuehrenberechnung (js/fees.js),
 * damit "Tage gelagert" konsistent zur Abrechnung ist. Keine externen Requests.
 */
(function (global) {
  'use strict';

  function resolveFees() {
    if (global.CCMFees) {
      return global.CCMFees;
    }
    if (typeof require === 'function') {
      return require('./fees.js');
    }
    throw new Error('CCMFees (js/fees.js) ist nicht verfuegbar.');
  }

  /**
   * Anzahl der bisher gelagerten Kalendertage eines Lots bis refTs (Standard:
   * jetzt). Einlagertag zaehlt mit, angebrochener Tag voll (siehe fees.js).
   */
  function daysStored(lot, refTs) {
    var CCMFees = resolveFees();
    var l = lot || {};
    return CCMFees.calendarDays(l.storedAt, null, refTs);
  }

  /**
   * Prueft, ob ein Lot die empfohlene Maximal-Lagerdauer seines Produkts
   * ueberschritten hat.
   */
  function isOverdue(lot, product, refTs) {
    var maxDays = product && Number.isInteger(product.maxStorageDays)
      ? product.maxStorageDays
      : Infinity;
    return daysStored(lot, refTs) > maxDays;
  }

  /**
   * Baut die nach Dringlichkeit sortierte Liste der Verderb-Risiko-Warnungen
   * fuer alle aktiven Lots. productsById bildet productId -> Produkt ab.
   * `overshoot` = gelagerte Tage - maxStorageDays (positiv = ueberfaellig).
   * Sortierung: groesster Overshoot zuerst.
   */
  function buildSpoilageWarnings(lots, productsById, refTs) {
    var list = Array.isArray(lots) ? lots : [];
    var map = productsById || {};
    var warnings = [];

    list.forEach(function (lot) {
      // Nur aktive Lots sind gefaehrdet.
      if (lot.status === 'released' || lot.releasedAt) {
        return;
      }
      var product = map[lot.productId];
      if (!product || !Number.isInteger(product.maxStorageDays)) {
        return;
      }
      var stored = daysStored(lot, refTs);
      var overshoot = stored - product.maxStorageDays;
      if (overshoot > 0) {
        warnings.push({
          lotId: lot.id,
          roomId: lot.roomId,
          customerId: lot.customerId,
          productId: lot.productId,
          crates: lot.crates,
          daysStored: stored,
          maxStorageDays: product.maxStorageDays,
          overshoot: overshoot,
          perishability: product.perishability
        });
      }
    });

    warnings.sort(function (a, b) {
      if (b.overshoot !== a.overshoot) {
        return b.overshoot - a.overshoot;
      }
      return String(a.lotId).localeCompare(String(b.lotId));
    });
    return warnings;
  }

  var CCMPerishability = {
    daysStored: daysStored,
    isOverdue: isOverdue,
    buildSpoilageWarnings: buildSpoilageWarnings
  };

  global.CCMPerishability = CCMPerishability;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CCMPerishability;
  }
})(typeof window !== 'undefined' ? window : globalThis);
