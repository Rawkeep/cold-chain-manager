'use strict';

/*
 * Tests fuer Kapazitaets- und Bestandsrechnung (js/capacity.js).
 * Akzeptanzkriterium 2: keine Ueberbelegung; freie Kisten = Kapazitaet minus
 * Summe der aktiven Lots.
 */

const test = require('node:test');
const assert = require('node:assert');
const Capacity = require('../js/capacity.js');

const room = { id: 'r1', capacityCrates: 100 };

function lot(id, roomId, crates, released) {
  return {
    id: id,
    roomId: roomId,
    crates: crates,
    releasedAt: released || null,
    status: released ? 'released' : 'active'
  };
}

test('occupiedCrates: Summe nur der aktiven Lots des Raums', () => {
  const lots = [
    lot('l1', 'r1', 30),
    lot('l2', 'r1', 20),
    lot('l3', 'r2', 50), // anderer Raum
    lot('l4', 'r1', 10, '2026-01-01T00:00:00Z') // ausgelagert -> zaehlt nicht
  ];
  assert.strictEqual(Capacity.occupiedCrates('r1', lots), 50);
});

test('freeCrates: Kapazitaet minus belegte Kisten', () => {
  const lots = [lot('l1', 'r1', 30), lot('l2', 'r1', 20)];
  assert.strictEqual(Capacity.freeCrates(room, lots), 50);
});

test('freeCrates: leerer Raum ist voll frei', () => {
  assert.strictEqual(Capacity.freeCrates(room, []), 100);
});

test('freeCrates: wird nie negativ (inkonsistente Daten auf 0 begrenzt)', () => {
  const lots = [lot('l1', 'r1', 120)];
  assert.strictEqual(Capacity.freeCrates(room, lots), 0);
});

test('canStore: passt genau in die freie Kapazitaet', () => {
  const lots = [lot('l1', 'r1', 60)];
  assert.strictEqual(Capacity.canStore(room, lots, 40), true);
});

test('canStore: eine Kiste zu viel wird abgelehnt (keine Ueberbelegung)', () => {
  const lots = [lot('l1', 'r1', 60)];
  assert.strictEqual(Capacity.canStore(room, lots, 41), false);
});

test('canStore: nicht-positive Kistenzahl ist unzulaessig', () => {
  assert.strictEqual(Capacity.canStore(room, [], 0), false);
  assert.strictEqual(Capacity.canStore(room, [], -5), false);
});

test('assertCanStore: wirft bei Ueberbelegung mit aussagekraeftiger Meldung', () => {
  const lots = [lot('l1', 'r1', 95)];
  assert.throws(function () {
    Capacity.assertCanStore(room, lots, 10);
  }, /Kapazitaet ueberschritten/);
});

test('assertCanStore: erlaubt Einlagerung innerhalb der Kapazitaet', () => {
  const lots = [lot('l1', 'r1', 95)];
  assert.strictEqual(Capacity.assertCanStore(room, lots, 5), true);
});

test('isActiveLot: released-Status oder releasedAt beenden ein Lot', () => {
  assert.strictEqual(Capacity.isActiveLot(lot('a', 'r1', 5)), true);
  assert.strictEqual(Capacity.isActiveLot(lot('b', 'r1', 5, '2026-01-01T00:00:00Z')), false);
});
