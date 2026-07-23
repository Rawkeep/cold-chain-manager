'use strict';

/*
 * Tests fuer die Temperatur-Auswertung (js/temperature.js).
 * Akzeptanzkriterium 3: Alarm bei Ueber-/Unterschreitung des Soll-Bereichs,
 * Alarm-Liste, 7-Tage-Verlauf als Inline-SVG.
 */

const test = require('node:test');
const assert = require('node:assert');
const Temperature = require('../js/temperature.js');

// Soll-Bereich 2,0..8,0 Grad C -> x10: 20..80
const room = { id: 'r1', name: 'Solar 1', sollTempMinX10: 20, sollTempMaxX10: 80 };

test('evaluateReading: innerhalb des Soll-Bereichs -> kein Alarm', () => {
  const res = Temperature.evaluateReading(45, room); // 4,5 C
  assert.deepStrictEqual(res, { alarm: false, type: null });
});

test('evaluateReading: an der Untergrenze -> kein Alarm', () => {
  assert.strictEqual(Temperature.evaluateReading(20, room).alarm, false);
});

test('evaluateReading: an der Obergrenze -> kein Alarm', () => {
  assert.strictEqual(Temperature.evaluateReading(80, room).alarm, false);
});

test('evaluateReading: Unterschreitung -> Alarm type low', () => {
  const res = Temperature.evaluateReading(15, room); // 1,5 C
  assert.deepStrictEqual(res, { alarm: true, type: 'low' });
});

test('evaluateReading: Ueberschreitung -> Alarm type high', () => {
  const res = Temperature.evaluateReading(95, room); // 9,5 C
  assert.deepStrictEqual(res, { alarm: true, type: 'high' });
});

test('isOutOfRange: Kurzform liefert Boolean', () => {
  assert.strictEqual(Temperature.isOutOfRange(90, room), true);
  assert.strictEqual(Temperature.isOutOfRange(50, room), false);
});

test('latestReading: liefert die zeitlich neueste Messung', () => {
  const logs = [
    { roomId: 'r1', ts: '2026-01-01T08:00:00Z', tempCx10: 40 },
    { roomId: 'r1', ts: '2026-01-03T08:00:00Z', tempCx10: 90 },
    { roomId: 'r1', ts: '2026-01-02T08:00:00Z', tempCx10: 50 }
  ];
  const latest = Temperature.latestReading('r1', logs);
  assert.strictEqual(latest.tempCx10, 90);
});

test('buildAlarmList: nur Raeume mit letzter Messung ausserhalb Soll', () => {
  const rooms = [
    room,
    { id: 'r2', name: 'Hybrid 2', sollTempMinX10: 20, sollTempMaxX10: 80 }
  ];
  const logs = [
    { roomId: 'r1', ts: '2026-01-03T08:00:00Z', tempCx10: 95 }, // zu warm -> Alarm
    { roomId: 'r2', ts: '2026-01-03T08:00:00Z', tempCx10: 50 } // im Soll -> kein Alarm
  ];
  const alarms = Temperature.buildAlarmList(rooms, logs);
  assert.strictEqual(alarms.length, 1);
  assert.strictEqual(alarms[0].roomId, 'r1');
  assert.strictEqual(alarms[0].type, 'high');
});

test('buildAlarmList: sortiert high vor low', () => {
  const rooms = [
    { id: 'a', name: 'A', sollTempMinX10: 20, sollTempMaxX10: 80 },
    { id: 'b', name: 'B', sollTempMinX10: 20, sollTempMaxX10: 80 }
  ];
  const logs = [
    { roomId: 'a', ts: '2026-01-03T08:00:00Z', tempCx10: 10 }, // low
    { roomId: 'b', ts: '2026-01-03T08:00:00Z', tempCx10: 95 } // high
  ];
  const alarms = Temperature.buildAlarmList(rooms, logs);
  assert.strictEqual(alarms[0].type, 'high');
  assert.strictEqual(alarms[1].type, 'low');
});

test('readingsLastDays: filtert das 7-Tage-Fenster relativ zu refTs', () => {
  const logs = [
    { roomId: 'r1', ts: '2026-01-01T08:00:00Z', tempCx10: 40 }, // >7 Tage vor ref
    { roomId: 'r1', ts: '2026-01-08T08:00:00Z', tempCx10: 50 },
    { roomId: 'r1', ts: '2026-01-10T08:00:00Z', tempCx10: 60 }
  ];
  const readings = Temperature.readingsLastDays('r1', logs, 7, '2026-01-10T12:00:00Z');
  assert.strictEqual(readings.length, 2);
  assert.strictEqual(readings[0].tempCx10, 50);
  assert.strictEqual(readings[1].tempCx10, 60);
});

test('buildSparklineSvg: erzeugt Inline-SVG ohne externe Library', () => {
  const readings = [
    { tempCx10: 40 },
    { tempCx10: 95 }, // ausserhalb -> roter Punkt
    { tempCx10: 50 }
  ];
  const svg = Temperature.buildSparklineSvg(readings, room);
  assert.ok(svg.indexOf('<svg') === 0);
  assert.ok(svg.indexOf('</svg>') > 0);
  assert.ok(svg.indexOf('<path') !== -1);
  assert.ok(svg.indexOf('#c0392b') !== -1); // roter Punkt fuer Ausreisser
  assert.ok(svg.indexOf('http') === -1 || svg.indexOf('www.w3.org') !== -1); // nur SVG-Namespace, kein Fremd-Host
});

test('buildSparklineSvg: leere Datenreihe liefert leeres SVG-Geruest', () => {
  const svg = Temperature.buildSparklineSvg([], room);
  assert.ok(svg.indexOf('<svg') === 0);
  assert.ok(svg.indexOf('<path') === -1);
});
