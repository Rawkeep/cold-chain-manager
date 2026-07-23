/**
 * temperature.js
 *
 * Temperatur-Auswertung je Kuehlraum (Akzeptanzkriterium 3): Alarm bei
 * Ueber-/Unterschreitung des Soll-Bereichs (sollTempMinX10..sollTempMaxX10),
 * Aufbau einer Alarm-Liste sowie eines Inline-SVG-Sparkline-Verlaufs der
 * letzten 7 Tage -- OHNE externe Chart-Library. Alle Temperaturen sind
 * Integer x10 (z.B. 45 = 4,5 Grad C), Vergleiche daher float-frei. Keine
 * externen Requests.
 */
(function (global) {
  'use strict';

  var MS_PER_DAY = 86400000;

  /**
   * Bewertet eine einzelne Messung gegen den Soll-Bereich eines Raums.
   * Liefert { alarm, type }: type ist 'low' (zu kalt), 'high' (zu warm) oder
   * null (im Soll).
   */
  function evaluateReading(tempCx10, room) {
    var r = room || {};
    var min = r.sollTempMinX10;
    var max = r.sollTempMaxX10;
    if (!Number.isInteger(tempCx10)) {
      throw new Error('tempCx10 muss ein Integer sein.');
    }
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new Error('Raum ohne gueltigen Soll-Bereich (sollTempMinX10/MaxX10).');
    }
    if (tempCx10 < min) {
      return { alarm: true, type: 'low' };
    }
    if (tempCx10 > max) {
      return { alarm: true, type: 'high' };
    }
    return { alarm: false, type: null };
  }

  /**
   * Prueft, ob eine Messung ausserhalb des Soll-Bereichs liegt (Kurzform).
   */
  function isOutOfRange(tempCx10, room) {
    return evaluateReading(tempCx10, room).alarm;
  }

  /**
   * Liefert die neueste Messung (nach ts) eines Raums oder null.
   */
  function latestReading(roomId, logs) {
    var list = Array.isArray(logs) ? logs : [];
    var latest = null;
    list.forEach(function (log) {
      if (log.roomId !== roomId) {
        return;
      }
      if (!latest || Date.parse(log.ts) > Date.parse(latest.ts)) {
        latest = log;
      }
    });
    return latest;
  }

  /**
   * Baut die Alarm-Liste ueber alle Raeume: fuer jeden Raum wird die neueste
   * Messung bewertet; liegt sie ausserhalb des Soll-Bereichs, entsteht ein
   * Alarm-Eintrag. Ergebnis ist nach Typ (high vor low) und Raum-Name
   * sortiert -- deterministisch.
   */
  function buildAlarmList(rooms, logs) {
    var roomList = Array.isArray(rooms) ? rooms : [];
    var alarms = [];
    roomList.forEach(function (room) {
      var reading = latestReading(room.id, logs);
      if (!reading) {
        return;
      }
      var evaluated = evaluateReading(reading.tempCx10, room);
      if (evaluated.alarm) {
        alarms.push({
          roomId: room.id,
          roomName: room.name,
          tempCx10: reading.tempCx10,
          type: evaluated.type,
          ts: reading.ts,
          sollTempMinX10: room.sollTempMinX10,
          sollTempMaxX10: room.sollTempMaxX10
        });
      }
    });
    alarms.sort(function (a, b) {
      if (a.type !== b.type) {
        return a.type === 'high' ? -1 : 1;
      }
      return String(a.roomName).localeCompare(String(b.roomName));
    });
    return alarms;
  }

  /**
   * Waehlt die Messungen eines Raums aus den letzten `days` Tagen (Standard 7)
   * relativ zu refTs (Standard: jetzt), aufsteigend nach ts sortiert.
   */
  function readingsLastDays(roomId, logs, days, refTs) {
    var list = Array.isArray(logs) ? logs : [];
    var windowDays = Number.isInteger(days) && days > 0 ? days : 7;
    var ref = refTs !== undefined ? Date.parse(String(refTs)) : Date.now();
    if (!isFinite(ref)) {
      ref = Date.now();
    }
    var cutoff = ref - windowDays * MS_PER_DAY;
    return list
      .filter(function (log) {
        if (log.roomId !== roomId) {
          return false;
        }
        var t = Date.parse(log.ts);
        return isFinite(t) && t >= cutoff && t <= ref;
      })
      .sort(function (a, b) {
        return Date.parse(a.ts) - Date.parse(b.ts);
      });
  }

  /**
   * Baut eine Inline-SVG-Sparkline aus den Temperatur-Messungen der letzten
   * 7 Tage. Reine String-Funktion ohne DOM-Zugriff (in Node testbar). Der
   * Soll-Bereich wird als hellgruenes Band hinterlegt; Werte ausserhalb des
   * Soll-Bereichs erhalten rote Punkte. Keine externe Chart-Library.
   */
  function buildSparklineSvg(readings, room, options) {
    var opts = options || {};
    var width = Number.isInteger(opts.width) ? opts.width : 160;
    var height = Number.isInteger(opts.height) ? opts.height : 40;
    var pad = 2;
    var r = room || {};
    var data = Array.isArray(readings) ? readings : [];

    if (data.length === 0) {
      return (
        '<svg class="ccm-sparkline" width="' + width + '" height="' + height +
        '" viewBox="0 0 ' + width + ' ' + height +
        '" xmlns="http://www.w3.org/2000/svg"></svg>'
      );
    }

    // Wertebereich bestimmen (inkl. Soll-Grenzen, damit das Band sichtbar ist).
    var values = data.map(function (d) {
      return d.tempCx10;
    });
    var minVal = Math.min.apply(null, values);
    var maxVal = Math.max.apply(null, values);
    if (Number.isInteger(r.sollTempMinX10)) {
      minVal = Math.min(minVal, r.sollTempMinX10);
    }
    if (Number.isInteger(r.sollTempMaxX10)) {
      maxVal = Math.max(maxVal, r.sollTempMaxX10);
    }
    var span = maxVal - minVal;
    if (span === 0) {
      span = 1; // Division vermeiden, flache Linie mittig zeichnen.
    }

    var innerW = width - 2 * pad;
    var innerH = height - 2 * pad;

    function xFor(index) {
      if (data.length === 1) {
        return pad + innerW / 2;
      }
      return pad + (innerW * index) / (data.length - 1);
    }
    function yFor(value) {
      // Hoehere Temperatur -> weiter oben.
      var ratio = (value - minVal) / span;
      return pad + innerH - ratio * innerH;
    }

    var parts = [];
    parts.push(
      '<svg class="ccm-sparkline" width="' + width + '" height="' + height +
      '" viewBox="0 0 ' + width + ' ' + height +
      '" xmlns="http://www.w3.org/2000/svg">'
    );

    // Soll-Band als Hintergrund-Rechteck.
    if (Number.isInteger(r.sollTempMinX10) && Number.isInteger(r.sollTempMaxX10)) {
      var yTop = yFor(r.sollTempMaxX10);
      var yBottom = yFor(r.sollTempMinX10);
      var bandH = yBottom - yTop;
      parts.push(
        '<rect x="' + pad + '" y="' + round2(yTop) + '" width="' + innerW +
        '" height="' + round2(bandH) + '" fill="#d8efd8"></rect>'
      );
    }

    // Linien-Pfad.
    var pathD = data
      .map(function (d, i) {
        return (i === 0 ? 'M' : 'L') + round2(xFor(i)) + ' ' + round2(yFor(d.tempCx10));
      })
      .join(' ');
    parts.push('<path d="' + pathD + '" fill="none" stroke="#2e5339" stroke-width="1.5"></path>');

    // Punkte; ausserhalb des Soll-Bereichs rot markiert.
    data.forEach(function (d, i) {
      var out = false;
      if (Number.isInteger(r.sollTempMinX10) && Number.isInteger(r.sollTempMaxX10)) {
        out = d.tempCx10 < r.sollTempMinX10 || d.tempCx10 > r.sollTempMaxX10;
      }
      parts.push(
        '<circle cx="' + round2(xFor(i)) + '" cy="' + round2(yFor(d.tempCx10)) +
        '" r="' + (out ? 2.5 : 1.5) + '" fill="' + (out ? '#c0392b' : '#2e5339') + '"></circle>'
      );
    });

    parts.push('</svg>');
    return parts.join('');
  }

  function round2(value) {
    return Math.round(value * 100) / 100;
  }

  var CCMTemperature = {
    evaluateReading: evaluateReading,
    isOutOfRange: isOutOfRange,
    latestReading: latestReading,
    buildAlarmList: buildAlarmList,
    readingsLastDays: readingsLastDays,
    buildSparklineSvg: buildSparklineSvg
  };

  global.CCMTemperature = CCMTemperature;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CCMTemperature;
  }
})(typeof window !== 'undefined' ? window : globalThis);
