/**
 * csv.js
 *
 * CSV-Import/-Export der Kuehlraum-Stammdaten fuer cold-chain-manager.
 * Spalten (exakte Reihenfolge, siehe ROOM_CSV_COLUMNS):
 *   lager_id, name, typ, kapazitaet_kisten, soll_temp_min, soll_temp_max
 *
 * Das generische CSV-Escaping/-Parsing (RFC4180-Prinzip, ohne externe
 * Bibliotheken) lebt jetzt geteilt in js/shared/offline-kit.js
 * (OfflineKit.csv) -- identisch in fuenf weiteren Rawkeep-Offline-Apps.
 * Diese Datei enthaelt nur noch das App-spezifische: Spaltenliste,
 * Konvertierung von/zu CCMModels.createRoom, Persistenz ueber CCMStorage.
 * Keine externen Requests, keine externen Bibliotheken.
 */
(function (global) {
  'use strict';

  function resolveOfflineKit() {
    if (global.OfflineKit) {
      return global.OfflineKit;
    }
    if (typeof require === 'function') {
      return require('./shared/offline-kit.js');
    }
    throw new Error('OfflineKit (js/shared/offline-kit.js) ist nicht verfuegbar.');
  }

  function resolveModels() {
    if (global.CCMModels) {
      return global.CCMModels;
    }
    if (typeof require === 'function') {
      return require('./models.js');
    }
    throw new Error('CCMModels (js/models.js) ist nicht verfuegbar.');
  }

  function resolveStorage() {
    if (global.CCMStorage) {
      return global.CCMStorage;
    }
    if (typeof require === 'function') {
      return require('./storage.js');
    }
    throw new Error('CCMStorage (js/storage.js) ist nicht verfuegbar.');
  }

  var OfflineKit = resolveOfflineKit();
  var csvEscapeField = OfflineKit.csv.csvEscapeField;
  var toCsvRow = OfflineKit.csv.toCsvRow;
  var buildCsv = OfflineKit.csv.buildCsv;
  var parseCsv = OfflineKit.csv.parseCsv;
  var dataRowsOf = OfflineKit.csv.dataRowsOf;

  // Exakte Spaltenreihenfolge fuer den Raum-Export/-Import (siehe Auftrag).
  var ROOM_CSV_COLUMNS = [
    'lager_id',
    'name',
    'typ',
    'kapazitaet_kisten',
    'soll_temp_min',
    'soll_temp_max'
  ];

  function toIntOr(rawValue, fallback) {
    if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
      return fallback;
    }
    var num = Number(rawValue);
    return isFinite(num) ? Math.round(num) : fallback;
  }

  function toNumberOr(rawValue, fallback) {
    if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
      return fallback;
    }
    var num = Number(rawValue);
    return isFinite(num) ? num : fallback;
  }

  /**
   * Exportiert eine Liste von Raum-Stammsaetzen (siehe CCMModels.createRoom)
   * als CSV-Text mit exakt den Spalten lager_id, name, typ, kapazitaet_kisten,
   * soll_temp_min, soll_temp_max. Die intern als x10 gefuehrten Soll-Temperaturen
   * werden fuer den Export wieder in Grad C zurueckgerechnet.
   */
  function exportRoomsToCsv(rooms) {
    var list = Array.isArray(rooms) ? rooms : [];
    var rows = list.map(function (room) {
      var r = room || {};
      return [
        r.id,
        r.name,
        r.type,
        r.capacityCrates,
        typeof r.sollTempMinX10 === 'number' ? r.sollTempMinX10 / 10 : '',
        typeof r.sollTempMaxX10 === 'number' ? r.sollTempMaxX10 / 10 : ''
      ];
    });
    return buildCsv(ROOM_CSV_COLUMNS, rows);
  }

  /**
   * Parst einen Raum-CSV-Text (Spalten siehe ROOM_CSV_COLUMNS) in ein Array
   * validierter Raum-Datensaetze (CCMModels.createRoom), ohne Storage-
   * Seiteneffekt. Reine Funktion -- unabhaengig testbar.
   */
  function parseRoomsFromCsv(csvText) {
    var CCMModels = resolveModels();
    var rows = parseCsv(csvText);
    var dataRows = dataRowsOf(rows);
    return dataRows.map(function (r) {
      return CCMModels.createRoom({
        id: r[0],
        name: r[1],
        type: r[2],
        capacityCrates: toIntOr(r[3], 0),
        sollTempMin: toNumberOr(r[4], 0),
        sollTempMax: toNumberOr(r[5], 0)
      });
    });
  }

  /**
   * Importiert einen Raum-CSV-Text vollstaendig: parst die Datensaetze und
   * persistiert jeden ueber CCMStorage.saveRoom. Liefert ein Promise mit dem
   * Array der gespeicherten Raum-Datensaetze.
   */
  function importRoomsFromCsv(csvText) {
    return new Promise(function (resolve, reject) {
      try {
        var CCMStorage = resolveStorage();
        var rooms = parseRoomsFromCsv(csvText);
        Promise.all(
          rooms.map(function (room) {
            return CCMStorage.saveRoom(room);
          })
        )
          .then(resolve)
          .catch(reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  var CCMCsv = {
    ROOM_CSV_COLUMNS: ROOM_CSV_COLUMNS,
    csvEscapeField: csvEscapeField,
    toCsvRow: toCsvRow,
    parseCsv: parseCsv,
    exportRoomsToCsv: exportRoomsToCsv,
    parseRoomsFromCsv: parseRoomsFromCsv,
    importRoomsFromCsv: importRoomsFromCsv
  };

  global.CCMCsv = CCMCsv;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CCMCsv;
  }
})(typeof window !== 'undefined' ? window : globalThis);
