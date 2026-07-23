'use strict';

/*
 * Tests fuer den CSV-Import/-Export der Raum-Stammdaten (js/csv.js).
 * Spalten: lager_id, name, typ, kapazitaet_kisten, soll_temp_min, soll_temp_max.
 * Export -> Import ergibt identische Datensaetze (Round-Trip).
 */

const test = require('node:test');
const assert = require('node:assert');
const Csv = require('../js/csv.js');
const Models = require('../js/models.js');

test('ROOM_CSV_COLUMNS: exakte Spaltenreihenfolge laut Auftrag', () => {
  assert.deepStrictEqual(Csv.ROOM_CSV_COLUMNS, [
    'lager_id', 'name', 'typ', 'kapazitaet_kisten', 'soll_temp_min', 'soll_temp_max'
  ]);
});

test('parseRoomsFromCsv: liest Grad-C-Werte und rechnet in x10 um', () => {
  const csv = 'lager_id,name,typ,kapazitaet_kisten,soll_temp_min,soll_temp_max\r\n' +
    'r1,Solar Nord,solar,100,2,8';
  const rooms = Csv.parseRoomsFromCsv(csv);
  assert.strictEqual(rooms.length, 1);
  assert.strictEqual(rooms[0].id, 'r1');
  assert.strictEqual(rooms[0].name, 'Solar Nord');
  assert.strictEqual(rooms[0].type, 'solar');
  assert.strictEqual(rooms[0].capacityCrates, 100);
  assert.strictEqual(rooms[0].sollTempMinX10, 20);
  assert.strictEqual(rooms[0].sollTempMaxX10, 80);
});

test('Export -> Import ergibt identische Datensaetze (Round-Trip)', () => {
  const rooms = [
    Models.createRoom({ id: 'r1', name: 'Solar Nord', type: 'solar', capacityCrates: 100, sollTempMin: 2, sollTempMax: 8 }),
    Models.createRoom({ id: 'r2', name: 'Hybrid, Sued', type: 'hybrid', capacityCrates: 50, sollTempMin: 0.5, sollTempMax: 4.5 })
  ];
  const csv = Csv.exportRoomsToCsv(rooms);
  const parsed = Csv.parseRoomsFromCsv(csv);
  assert.deepStrictEqual(parsed, rooms);
});

test('exportRoomsToCsv: quotet Felder mit Komma korrekt (RFC4180)', () => {
  const rooms = [
    Models.createRoom({ id: 'r2', name: 'Hybrid, Sued', type: 'hybrid', capacityCrates: 50, sollTempMin: 0, sollTempMax: 4 })
  ];
  const csv = Csv.exportRoomsToCsv(rooms);
  assert.ok(csv.indexOf('"Hybrid, Sued"') !== -1);
});

test('parseCsv: unterstuetzt gequotete Felder mit eingebettetem Komma', () => {
  const rows = Csv.parseCsv('a,"b,c",d');
  assert.deepStrictEqual(rows, [['a', 'b,c', 'd']]);
});
