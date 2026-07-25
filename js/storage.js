/**
 * storage.js
 *
 * Persistenz-Wrapper fuer cold-chain-manager. Die generische Storage-Engine
 * (IndexedDB als primaerer Speicher, transparenter localStorage-Fallback,
 * beides Promise-basiert) lebt jetzt geteilt in js/shared/offline-kit.js
 * (OfflineKit.createOfflineStorage) -- identisch in fuenf weiteren
 * Rawkeep-Offline-Apps. Diese Datei enthaelt nur noch die App-spezifischen
 * Werte: DB-Name, Object-Stores je Entitaet, localStorage-Praefix.
 *
 * Es werden ausschliesslich Browser-eigene Storage-APIs verwendet -- keine
 * Netzwerk-Requests (kein fetch, kein XHR). Alle Funktionen liefern Promises
 * zurueck, damit Aufrufer unabhaengig vom tatsaechlich genutzten Backend
 * einheitlich arbeiten koennen.
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

  var OfflineKit = resolveOfflineKit();

  var DB_NAME = 'cold_chain_manager_db';
  var DB_VERSION = 1;

  // Store-Namen je Entitaet.
  var STORES = {
    rooms: 'rooms',
    products: 'products',
    customers: 'customers',
    storageLots: 'storageLots',
    tempLogs: 'tempLogs',
    invoices: 'invoices'
  };

  var LOCAL_STORAGE_PREFIX = 'cold_chain_manager_store_';

  var CCMStorage = OfflineKit.createOfflineStorage({
    dbName: DB_NAME,
    dbVersion: DB_VERSION,
    stores: STORES,
    localStoragePrefix: LOCAL_STORAGE_PREFIX
  });

  global.CCMStorage = CCMStorage;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CCMStorage;
  }
})(typeof window !== 'undefined' ? window : globalThis);
