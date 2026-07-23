/**
 * csv.js
 *
 * CSV-Import/-Export der Kuehlraum-Stammdaten fuer cold-chain-manager.
 * Spalten (exakte Reihenfolge, siehe ROOM_CSV_COLUMNS):
 *   lager_id, name, typ, kapazitaet_kisten, soll_temp_min, soll_temp_max
 *
 * CSV-Escaping (Kommas, Anfuehrungszeichen, Zeilenumbrueche) wird ohne externe
 * Bibliotheken nach RFC4180-Prinzip selbst implementiert. Export gefolgt von
 * Import ergibt bei identischen Rohdaten identische Datensaetze. Keine externen
 * Requests, keine externen Bibliotheken.
 */
(function (global) {
  'use strict';

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

  // Exakte Spaltenreihenfolge fuer den Raum-Export/-Import (siehe Auftrag).
  var ROOM_CSV_COLUMNS = [
    'lager_id',
    'name',
    'typ',
    'kapazitaet_kisten',
    'soll_temp_min',
    'soll_temp_max'
  ];

  var CSV_LINE_BREAK = '\r\n';

  /**
   * Escaped ein einzelnes CSV-Feld nach RFC4180-Prinzip.
   */
  function csvEscapeField(value) {
    var str = value === undefined || value === null ? '' : String(value);
    var needsQuoting = /[",\n\r]/.test(str);
    if (!needsQuoting) {
      return str;
    }
    return '"' + str.replace(/"/g, '""') + '"';
  }

  function toCsvRow(fields) {
    return fields.map(csvEscapeField).join(',');
  }

  function buildCsv(headerColumns, rows) {
    var lines = [toCsvRow(headerColumns)];
    rows.forEach(function (row) {
      lines.push(toCsvRow(row));
    });
    return lines.join(CSV_LINE_BREAK);
  }

  /**
   * Parst einen vollstaendigen CSV-Text in ein Array von Zeilen (jede Zeile
   * ein Array von Rohfeld-Strings), ohne externe Bibliotheken. Unterstuetzt
   * gequotete Felder mit eingebetteten Kommas, Zeilenumbruechen und
   * verdoppelten Anfuehrungszeichen.
   */
  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var str = typeof text === 'string' ? text : '';
    var len = str.length;
    var i = 0;

    while (i < len) {
      var ch = str.charAt(i);

      if (inQuotes) {
        if (ch === '"') {
          if (str.charAt(i + 1) === '"') {
            field += '"';
            i += 2;
          } else {
            inQuotes = false;
            i += 1;
          }
        } else {
          field += ch;
          i += 1;
        }
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
        i += 1;
      } else if (ch === ',') {
        row.push(field);
        field = '';
        i += 1;
      } else if (ch === '\r' || ch === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        if (ch === '\r' && str.charAt(i + 1) === '\n') {
          i += 2;
        } else {
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
    }

    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }

  function dataRowsOf(rows) {
    if (rows.length === 0) {
      return [];
    }
    return rows.slice(1).filter(function (r) {
      return !(r.length === 1 && r[0] === '');
    });
  }

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
