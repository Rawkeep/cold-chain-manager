'use strict';

/*
 * Tests fuer die deterministische Gebuehrenberechnung (js/fees.js).
 * Akzeptanzkriterium 1: Gebuehr = kisten x tarif x Kalendertage,
 * Einlagertag zaehlt mit, angebrochener Tag zaehlt voll.
 */

const test = require('node:test');
const assert = require('node:assert');
const Fees = require('../js/fees.js');

test('calendarDays: gleicher Kalendertag zaehlt als 1 Tag (Einlagertag zaehlt)', () => {
  const days = Fees.calendarDays('2026-01-10T08:00:00Z', '2026-01-10T20:00:00Z');
  assert.strictEqual(days, 1);
});

test('calendarDays: angebrochener Folgetag zaehlt voll (23:00 -> 01:00 = 2 Tage)', () => {
  const days = Fees.calendarDays('2026-01-10T23:00:00Z', '2026-01-11T01:00:00Z');
  assert.strictEqual(days, 2);
});

test('calendarDays: inklusive beider Grenztage (10. bis 13. = 4 Tage)', () => {
  const days = Fees.calendarDays('2026-01-10T00:00:00Z', '2026-01-13T00:00:00Z');
  assert.strictEqual(days, 4);
});

test('calendarDays: nur wenige Minuten spaeter am selben Tag bleibt 1 Tag', () => {
  const days = Fees.calendarDays('2026-01-10T10:00:00Z', '2026-01-10T10:05:00Z');
  assert.strictEqual(days, 1);
});

test('calendarDays: Auslager vor Einlager wirft Fehler', () => {
  assert.throws(function () {
    Fees.calendarDays('2026-01-11T00:00:00Z', '2026-01-10T00:00:00Z');
  }, /vor dem Einlagerdatum/);
});

test('calendarDays: ohne releasedAt wird refTs genutzt', () => {
  const days = Fees.calendarDays('2026-01-10T00:00:00Z', null, '2026-01-12T05:00:00Z');
  assert.strictEqual(days, 3);
});

test('computeFee: kisten x tarif x tage (5 x 100 x 3 = 1500)', () => {
  assert.strictEqual(Fees.computeFee(5, 100, 3), 1500);
});

test('computeFee: Ergebnis bleibt Integer, keine Float-Drift', () => {
  const fee = Fees.computeFee(7, 125, 9);
  assert.strictEqual(fee, 7875);
  assert.ok(Number.isInteger(fee));
});

test('computeFee: days < 1 wirft Fehler', () => {
  assert.throws(function () {
    Fees.computeFee(1, 100, 0);
  }, /days/);
});

test('computeFee: nicht-integer tarif wirft Fehler', () => {
  assert.throws(function () {
    Fees.computeFee(1, 99.5, 1);
  }, /tarifPerCrateDay/);
});

test('computeLotFee: verrechnet Lot-Daten (10 Kisten, Tarif 50, 2 Tage = 1000)', () => {
  const lot = {
    crates: 10,
    tarifPerCrateDay: 50,
    currency: 'XOF',
    storedAt: '2026-03-01T06:00:00Z',
    releasedAt: '2026-03-02T18:00:00Z'
  };
  const fee = Fees.computeLotFee(lot);
  assert.deepStrictEqual(fee, { days: 2, crates: 10, amount: 1000, currency: 'XOF' });
});

test('computeLotFee: Einlagertag zaehlt -> Einlagerung und Auslagerung am selben Tag = 1 Tag', () => {
  const lot = {
    crates: 3,
    tarifPerCrateDay: 200,
    currency: 'NGN',
    storedAt: '2026-03-01T06:00:00Z',
    releasedAt: '2026-03-01T23:00:00Z'
  };
  const fee = Fees.computeLotFee(lot);
  assert.strictEqual(fee.days, 1);
  assert.strictEqual(fee.amount, 600);
});
