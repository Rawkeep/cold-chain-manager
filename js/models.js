/**
 * models.js
 *
 * Datenmodell fuer cold-chain-manager: reine JS-Objekte/Factory-Funktionen mit
 * Validierung. Entitaeten: Room (Kuehlraum/Zone), StorageLot (Einlagerung),
 * TempLog (Temperatur-Messung), Customer (Kundenkonto), Product (Produkt mit
 * Verderblichkeitsklasse), Invoice (Ein-/Auslagerbeleg).
 *
 * Wichtige Regel: Geldbetraege (tarifPerCrateDay, amount, paidAmount,
 * openBalance, ...) werden IMMER als Integer in der kleinsten Waehrungseinheit
 * (XOF/NGN, keine Nachkommastellen) gespeichert -- niemals als Float. Auch
 * Temperaturen werden als Integer x10 (tempCx10, z.B. 45 = 4,5 Grad C) gefuehrt,
 * damit Alarm-Vergleiche ohne Gleitkomma-Drift deterministisch sind.
 */
(function (global) {
  'use strict';

  // Erlaubte Raum-Typen (Solar-/Netz-/Hybrid-Kuehlung).
  var ROOM_TYPES = ['solar', 'netz', 'hybrid'];

  // Unterstuetzte Waehrungen (kleinste Einheit ohne Nachkommastellen).
  var CURRENCIES = ['XOF', 'NGN'];

  // Kunden-Typen.
  var CUSTOMER_TYPES = ['farmer', 'aggregator', 'haendler'];

  // Verderblichkeitsklassen.
  var PERISHABILITY_CLASSES = ['low', 'medium', 'high'];

  // Empfohlene Maximal-Lagerdauer (Tage) je Verderblichkeitsklasse -- greift,
  // wenn ein Produkt keinen expliziten maxStorageDays-Wert mitbringt.
  var RECOMMENDED_MAX_DAYS = {
    high: 3,
    medium: 7,
    low: 30
  };

  // Lot- und Beleg-Status.
  var LOT_STATUS = ['active', 'released'];
  var PAID_STATUS = ['nein', 'teil', 'ja'];

  var idCounter = 0;

  /**
   * Erzeugt eine eindeutige ID pro Prozess (Praefix + Zeitstempel + Zaehler).
   */
  function generateId(prefix) {
    idCounter += 1;
    var ts = Date.now().toString(36);
    return (prefix || 'id') + '_' + ts + '_' + idCounter.toString(36);
  }

  function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function requireString(value, fieldName) {
    if (!isNonEmptyString(value)) {
      throw new Error('Pflichtfeld fehlt oder ungueltig: ' + fieldName);
    }
    return value;
  }

  /**
   * Prueft, ob ein Wert ein nicht-negativer Integer ist (Geldbetraege,
   * Kistenzahlen, Tage).
   */
  function isNonNegativeInteger(value) {
    return Number.isInteger(value) && value >= 0;
  }

  function requireNonNegativeInteger(value, fieldName) {
    if (!isNonNegativeInteger(value)) {
      throw new Error(
        'Ungueltiger Wert fuer ' + fieldName + ': muss ein nicht-negativer Integer sein.'
      );
    }
    return value;
  }

  function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
  }

  function requirePositiveInteger(value, fieldName) {
    if (!isPositiveInteger(value)) {
      throw new Error(
        'Ungueltiger Wert fuer ' + fieldName + ': muss ein positiver Integer sein.'
      );
    }
    return value;
  }

  /**
   * Wandelt einen Temperaturwert in Grad C (moeglicherweise mit
   * Nachkommastelle, z.B. 4.5) in einen Integer x10 (45). Bereits vorliegende
   * Integer-x10-Werte (z.B. aus dem TempLog) koennen direkt uebergeben werden.
   */
  function toTempCx10(value) {
    var num = Number(value);
    if (!isFinite(num)) {
      throw new Error('Ungueltige Temperatur: keine Zahl.');
    }
    return Math.round(num * 10);
  }

  function requireRoomType(value) {
    if (ROOM_TYPES.indexOf(value) === -1) {
      throw new Error('Ungueltiger Raum-Typ: erlaubt sind solar, netz, hybrid.');
    }
    return value;
  }

  function requireCurrency(value) {
    if (CURRENCIES.indexOf(value) === -1) {
      throw new Error('Ungueltige Waehrung: erlaubt sind XOF, NGN.');
    }
    return value;
  }

  function requireCustomerType(value) {
    if (CUSTOMER_TYPES.indexOf(value) === -1) {
      throw new Error('Ungueltiger Kunden-Typ: erlaubt sind farmer, aggregator, haendler.');
    }
    return value;
  }

  function requirePerishability(value) {
    if (PERISHABILITY_CLASSES.indexOf(value) === -1) {
      throw new Error('Ungueltige Verderblichkeitsklasse: erlaubt sind low, medium, high.');
    }
    return value;
  }

  /**
   * Liefert die empfohlene Maximal-Lagerdauer (Tage) fuer eine
   * Verderblichkeitsklasse.
   */
  function recommendedMaxDays(perishability) {
    return RECOMMENDED_MAX_DAYS[perishability] || RECOMMENDED_MAX_DAYS.medium;
  }

  // ---------------------------------------------------------------------
  // Room: Kuehlraum/Zone. CSV-Stammdaten-Spalten: lager_id, name, typ,
  // kapazitaet_kisten, soll_temp_min, soll_temp_max. Der Soll-Bereich wird
  // intern als Integer x10 (sollTempMinX10/sollTempMaxX10) gefuehrt, damit der
  // Alarm-Vergleich mit tempCx10 ohne Float-Drift funktioniert.
  // ---------------------------------------------------------------------
  function createRoom(data) {
    data = data || {};
    var type = requireRoomType(data.type);
    var capacityCrates = requirePositiveInteger(data.capacityCrates, 'capacityCrates');

    var minX10 = toTempCx10(data.sollTempMin !== undefined ? data.sollTempMin : data.sollTempMinX10 / 10);
    var maxX10 = toTempCx10(data.sollTempMax !== undefined ? data.sollTempMax : data.sollTempMaxX10 / 10);
    if (minX10 > maxX10) {
      throw new Error('Soll-Temperatur: Minimum darf nicht groesser als Maximum sein.');
    }

    return {
      id: isNonEmptyString(data.id) ? data.id : generateId('room'),
      name: requireString(data.name, 'name'),
      type: type,
      capacityCrates: capacityCrates,
      sollTempMinX10: minX10,
      sollTempMaxX10: maxX10
    };
  }

  // ---------------------------------------------------------------------
  // Product: eingelagertes Produkt mit FR/EN-Namen und Verderblichkeit.
  // maxStorageDays kann explizit gesetzt werden; fehlt er, wird er aus der
  // Verderblichkeitsklasse abgeleitet.
  // ---------------------------------------------------------------------
  function createProduct(data) {
    data = data || {};
    var perishability = requirePerishability(data.perishability);
    var maxStorageDays = isPositiveInteger(data.maxStorageDays)
      ? data.maxStorageDays
      : recommendedMaxDays(perishability);

    return {
      id: isNonEmptyString(data.id) ? data.id : generateId('product'),
      nameFr: requireString(data.nameFr, 'nameFr'),
      nameEn: requireString(data.nameEn, 'nameEn'),
      perishability: perishability,
      maxStorageDays: maxStorageDays
    };
  }

  // ---------------------------------------------------------------------
  // Customer: Kundenkonto mit offenem Saldo (Integer, kleinste Einheit).
  // ---------------------------------------------------------------------
  function createCustomer(data) {
    data = data || {};
    var type = requireCustomerType(data.type);
    var openBalance = data.openBalance === undefined ? 0 : data.openBalance;
    requireNonNegativeInteger(openBalance, 'openBalance');

    return {
      id: isNonEmptyString(data.id) ? data.id : generateId('customer'),
      name: requireString(data.name, 'name'),
      phone: typeof data.phone === 'string' ? data.phone : '',
      type: type,
      openBalance: openBalance
    };
  }

  // ---------------------------------------------------------------------
  // StorageLot: Einlagerung einer Kundencharge in einen Raum. einlagerTs
  // (storedAt) und auslagerTs (releasedAt) sind ISO-Zeitstempel; releasedAt
  // ist null, solange das Lot aktiv ist.
  // ---------------------------------------------------------------------
  function createStorageLot(data) {
    data = data || {};
    var roomId = requireString(data.roomId, 'roomId');
    var customerId = requireString(data.customerId, 'customerId');
    var productId = requireString(data.productId, 'productId');
    var crates = requirePositiveInteger(data.crates, 'crates');
    var storedAt = requireString(data.storedAt, 'storedAt');
    var tarifPerCrateDay = requireNonNegativeInteger(data.tarifPerCrateDay, 'tarifPerCrateDay');
    var currency = requireCurrency(data.currency);

    var releasedAt = isNonEmptyString(data.releasedAt) ? data.releasedAt : null;
    var status = releasedAt ? 'released' : 'active';
    if (data.status && LOT_STATUS.indexOf(data.status) !== -1) {
      status = data.status;
    }

    return {
      id: isNonEmptyString(data.id) ? data.id : generateId('lot'),
      roomId: roomId,
      customerId: customerId,
      productId: productId,
      crates: crates,
      storedAt: storedAt,
      releasedAt: releasedAt,
      tarifPerCrateDay: tarifPerCrateDay,
      currency: currency,
      status: status
    };
  }

  // ---------------------------------------------------------------------
  // TempLog: manuelle Temperatur-Messung je Raum. tempCx10 ist Integer x10.
  // ---------------------------------------------------------------------
  function createTempLog(data) {
    data = data || {};
    var roomId = requireString(data.roomId, 'roomId');
    var ts = requireString(data.ts, 'ts');
    if (data.tempCx10 === undefined && data.tempC === undefined) {
      throw new Error('Pflichtfeld fehlt: tempCx10 oder tempC.');
    }
    var tempCx10 = data.tempCx10 !== undefined ? data.tempCx10 : toTempCx10(data.tempC);
    if (!Number.isInteger(tempCx10)) {
      throw new Error('tempCx10 muss ein Integer sein (Grad C x10).');
    }

    return {
      id: isNonEmptyString(data.id) ? data.id : generateId('temp'),
      roomId: roomId,
      ts: ts,
      tempCx10: tempCx10,
      recordedBy: typeof data.recordedBy === 'string' ? data.recordedBy : ''
    };
  }

  // ---------------------------------------------------------------------
  // Invoice: Ein-/Auslagerbeleg. amount = kisten x tarif x tage (Integer).
  // paidAmount/paidStatus fuer Teilzahlungen (siehe js/accounts.js).
  // ---------------------------------------------------------------------
  function createInvoice(data) {
    data = data || {};
    var customerId = requireString(data.customerId, 'customerId');
    var lotId = requireString(data.lotId, 'lotId');
    var days = requirePositiveInteger(data.days, 'days');
    var crates = requirePositiveInteger(data.crates, 'crates');
    var amount = requireNonNegativeInteger(data.amount, 'amount');
    var currency = requireCurrency(data.currency);

    var paidAmount = data.paidAmount === undefined ? 0 : data.paidAmount;
    requireNonNegativeInteger(paidAmount, 'paidAmount');
    if (paidAmount > amount) {
      throw new Error('paidAmount darf amount nicht uebersteigen.');
    }

    var paidStatus = paidAmount === 0 ? 'nein' : paidAmount >= amount ? 'ja' : 'teil';
    if (data.paidStatus && PAID_STATUS.indexOf(data.paidStatus) !== -1) {
      paidStatus = data.paidStatus;
    }

    return {
      id: isNonEmptyString(data.id) ? data.id : generateId('beleg'),
      customerId: customerId,
      lotId: lotId,
      days: days,
      crates: crates,
      amount: amount,
      paidAmount: paidAmount,
      paidStatus: paidStatus,
      currency: currency
    };
  }

  var CCMModels = {
    ROOM_TYPES: ROOM_TYPES,
    CURRENCIES: CURRENCIES,
    CUSTOMER_TYPES: CUSTOMER_TYPES,
    PERISHABILITY_CLASSES: PERISHABILITY_CLASSES,
    RECOMMENDED_MAX_DAYS: RECOMMENDED_MAX_DAYS,
    LOT_STATUS: LOT_STATUS,
    PAID_STATUS: PAID_STATUS,
    generateId: generateId,
    isNonNegativeInteger: isNonNegativeInteger,
    isPositiveInteger: isPositiveInteger,
    toTempCx10: toTempCx10,
    recommendedMaxDays: recommendedMaxDays,
    createRoom: createRoom,
    createProduct: createProduct,
    createCustomer: createCustomer,
    createStorageLot: createStorageLot,
    createTempLog: createTempLog,
    createInvoice: createInvoice
  };

  // Im Browser als window.CCMModels, in Node/Tests ueber globalThis.
  global.CCMModels = CCMModels;

  // Zusaetzlicher CommonJS-Export fuer Node-basierte Tests.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CCMModels;
  }
})(typeof window !== 'undefined' ? window : globalThis);
