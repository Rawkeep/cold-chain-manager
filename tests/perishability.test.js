'use strict';

/*
 * Tests fuer Verderb-Risiko-Warnungen (js/perishability.js).
 * Akzeptanzkriterium 4: Lot ueber max_lagerdauer_tage -> Warnung, sortiert
 * nach Dringlichkeit.
 */

const test = require('node:test');
const assert = require('node:assert');
const Perishability = require('../js/perishability.js');

function activeLot(id, productId, storedAt, crates) {
  return {
    id: id,
    roomId: 'r1',
    customerId: 'c1',
    productId: productId,
    crates: crates || 5,
    storedAt: storedAt,
    releasedAt: null,
    status: 'active'
  };
}

const products = {
  tomate: { id: 'tomate', maxStorageDays: 3, perishability: 'high' },
  yam: { id: 'yam', maxStorageDays: 30, perishability: 'low' }
};

test('daysStored: zaehlt Kalendertage seit Einlagerung (inkl. Einlagertag)', () => {
  const lot = activeLot('l1', 'tomate', '2026-01-10T06:00:00Z');
  const days = Perishability.daysStored(lot, '2026-01-12T10:00:00Z');
  assert.strictEqual(days, 3);
});

test('isOverdue: innerhalb der Frist -> false', () => {
  const lot = activeLot('l1', 'tomate', '2026-01-10T06:00:00Z');
  assert.strictEqual(Perishability.isOverdue(lot, products.tomate, '2026-01-12T10:00:00Z'), false);
});

test('isOverdue: 4 Tage bei max 3 -> ueberfaellig', () => {
  const lot = activeLot('l1', 'tomate', '2026-01-10T06:00:00Z');
  assert.strictEqual(Perishability.isOverdue(lot, products.tomate, '2026-01-13T10:00:00Z'), true);
});

test('buildSpoilageWarnings: nur ueberfaellige aktive Lots', () => {
  const lots = [
    activeLot('l1', 'tomate', '2026-01-10T06:00:00Z'), // 6 Tage @ max 3 -> ueberfaellig
    activeLot('l2', 'yam', '2026-01-10T06:00:00Z') // 6 Tage @ max 30 -> ok
  ];
  const warnings = Perishability.buildSpoilageWarnings(lots, products, '2026-01-15T10:00:00Z');
  assert.strictEqual(warnings.length, 1);
  assert.strictEqual(warnings[0].lotId, 'l1');
  assert.strictEqual(warnings[0].overshoot, 3); // 6 - 3
});

test('buildSpoilageWarnings: sortiert nach Dringlichkeit (groesster Overshoot zuerst)', () => {
  const lots = [
    activeLot('l1', 'tomate', '2026-01-14T06:00:00Z'), // 2 Tage @ max 3 -> ok
    activeLot('l2', 'tomate', '2026-01-05T06:00:00Z'), // 11 Tage @ max 3 -> +8
    activeLot('l3', 'tomate', '2026-01-11T06:00:00Z') // 5 Tage @ max 3 -> +2
  ];
  const warnings = Perishability.buildSpoilageWarnings(lots, products, '2026-01-15T10:00:00Z');
  assert.strictEqual(warnings.length, 2);
  assert.strictEqual(warnings[0].lotId, 'l2'); // dringlichster zuerst
  assert.strictEqual(warnings[0].overshoot, 8);
  assert.strictEqual(warnings[1].lotId, 'l3');
  assert.strictEqual(warnings[1].overshoot, 2);
});

test('buildSpoilageWarnings: ausgelagerte Lots werden ignoriert', () => {
  const released = activeLot('l1', 'tomate', '2026-01-05T06:00:00Z');
  released.releasedAt = '2026-01-06T06:00:00Z';
  released.status = 'released';
  const warnings = Perishability.buildSpoilageWarnings([released], products, '2026-01-15T10:00:00Z');
  assert.strictEqual(warnings.length, 0);
});
