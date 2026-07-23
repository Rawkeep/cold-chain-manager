'use strict';

/*
 * Tests fuer das Datenmodell (js/models.js): Validierung, Integer-Geldbetraege,
 * Temperatur als Integer x10, abgeleitete Maximal-Lagerdauer.
 */

const test = require('node:test');
const assert = require('node:assert');
const Models = require('../js/models.js');

test('createRoom: rechnet Soll-Temperatur in Integer x10 um', () => {
  const room = Models.createRoom({
    name: 'Solar 1',
    type: 'solar',
    capacityCrates: 100,
    sollTempMin: 2,
    sollTempMax: 8
  });
  assert.strictEqual(room.sollTempMinX10, 20);
  assert.strictEqual(room.sollTempMaxX10, 80);
  assert.ok(Number.isInteger(room.sollTempMinX10));
});

test('createRoom: Nachkommastelle wird korrekt zu x10 (4,5 -> 45)', () => {
  const room = Models.createRoom({
    name: 'X', type: 'hybrid', capacityCrates: 10, sollTempMin: 0.5, sollTempMax: 4.5
  });
  assert.strictEqual(room.sollTempMinX10, 5);
  assert.strictEqual(room.sollTempMaxX10, 45);
});

test('createRoom: min > max wirft Fehler', () => {
  assert.throws(function () {
    Models.createRoom({ name: 'X', type: 'solar', capacityCrates: 10, sollTempMin: 9, sollTempMax: 2 });
  }, /Minimum darf nicht groesser/);
});

test('createRoom: ungueltiger Typ wirft Fehler', () => {
  assert.throws(function () {
    Models.createRoom({ name: 'X', type: 'diesel', capacityCrates: 10, sollTempMin: 2, sollTempMax: 8 });
  }, /Raum-Typ/);
});

test('createRoom: Kapazitaet muss positiver Integer sein', () => {
  assert.throws(function () {
    Models.createRoom({ name: 'X', type: 'solar', capacityCrates: 0, sollTempMin: 2, sollTempMax: 8 });
  }, /capacityCrates/);
});

test('createProduct: leitet maxStorageDays aus Verderblichkeit ab', () => {
  const high = Models.createProduct({ nameFr: 'Tomate', nameEn: 'Tomato', perishability: 'high' });
  assert.strictEqual(high.maxStorageDays, 3);
  const low = Models.createProduct({ nameFr: 'Igname', nameEn: 'Yam', perishability: 'low' });
  assert.strictEqual(low.maxStorageDays, 30);
});

test('createProduct: expliziter maxStorageDays hat Vorrang', () => {
  const p = Models.createProduct({ nameFr: 'A', nameEn: 'A', perishability: 'high', maxStorageDays: 5 });
  assert.strictEqual(p.maxStorageDays, 5);
});

test('createCustomer: openBalance default 0, Integer erzwungen', () => {
  const c = Models.createCustomer({ name: 'Awa', type: 'farmer' });
  assert.strictEqual(c.openBalance, 0);
  assert.throws(function () {
    Models.createCustomer({ name: 'B', type: 'farmer', openBalance: 12.5 });
  }, /openBalance/);
});

test('createStorageLot: aktiv ohne releasedAt, Tarif als Integer', () => {
  const lot = Models.createStorageLot({
    roomId: 'r1', customerId: 'c1', productId: 'p1', crates: 5,
    storedAt: '2026-01-10T06:00:00Z', tarifPerCrateDay: 100, currency: 'XOF'
  });
  assert.strictEqual(lot.status, 'active');
  assert.strictEqual(lot.releasedAt, null);
  assert.strictEqual(lot.tarifPerCrateDay, 100);
});

test('createStorageLot: Float-Tarif wird abgelehnt', () => {
  assert.throws(function () {
    Models.createStorageLot({
      roomId: 'r1', customerId: 'c1', productId: 'p1', crates: 5,
      storedAt: '2026-01-10T06:00:00Z', tarifPerCrateDay: 99.9, currency: 'XOF'
    });
  }, /tarifPerCrateDay/);
});

test('createTempLog: tempC wird zu Integer x10', () => {
  const log = Models.createTempLog({ roomId: 'r1', ts: '2026-01-10T06:00:00Z', tempC: 4.5 });
  assert.strictEqual(log.tempCx10, 45);
});

test('createInvoice: Status aus paidAmount abgeleitet', () => {
  const inv = Models.createInvoice({
    customerId: 'c1', lotId: 'l1', days: 3, crates: 5, amount: 1500, currency: 'XOF', paidAmount: 500
  });
  assert.strictEqual(inv.paidStatus, 'teil');
});

test('createInvoice: paidAmount > amount wirft Fehler', () => {
  assert.throws(function () {
    Models.createInvoice({
      customerId: 'c1', lotId: 'l1', days: 3, crates: 5, amount: 1000, currency: 'XOF', paidAmount: 2000
    });
  }, /paidAmount/);
});

test('recommendedMaxDays: bekannte Klassen, Fallback medium', () => {
  assert.strictEqual(Models.recommendedMaxDays('high'), 3);
  assert.strictEqual(Models.recommendedMaxDays('medium'), 7);
  assert.strictEqual(Models.recommendedMaxDays('low'), 30);
  assert.strictEqual(Models.recommendedMaxDays('unknown'), 7);
});
