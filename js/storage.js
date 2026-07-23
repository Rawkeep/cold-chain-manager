/**
 * storage.js
 *
 * Persistenz-Wrapper fuer cold-chain-manager. Nutzt IndexedDB als primaeren
 * Speicher; steht IndexedDB nicht zur Verfuegung, wird transparent auf
 * localStorage zurueckgefallen. Es werden ausschliesslich Browser-eigene
 * Storage-APIs verwendet -- keine Netzwerk-Requests (kein fetch, kein XHR).
 *
 * Alle Funktionen liefern Promises zurueck, damit Aufrufer unabhaengig vom
 * tatsaechlich genutzten Backend einheitlich arbeiten koennen.
 */
(function (global) {
  'use strict';

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

  var dbPromise = null;

  function hasIndexedDb() {
    return typeof global.indexedDB !== 'undefined' && global.indexedDB !== null;
  }

  function hasLocalStorage() {
    return typeof global.localStorage !== 'undefined' && global.localStorage !== null;
  }

  /**
   * Oeffnet (und initialisiert bei Bedarf) die IndexedDB-Datenbank mit einem
   * Object Store pro Entitaet (keyPath: id).
   */
  function openDatabase() {
    if (dbPromise) {
      return dbPromise;
    }
    dbPromise = new Promise(function (resolve, reject) {
      var request = global.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        Object.keys(STORES).forEach(function (key) {
          var storeName = STORES[key];
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        });
      };

      request.onsuccess = function (event) {
        resolve(event.target.result);
      };

      request.onerror = function (event) {
        reject(event.target.error || new Error('IndexedDB konnte nicht geoeffnet werden.'));
      };
    });
    return dbPromise;
  }

  // -----------------------------------------------------------------------
  // localStorage-Fallback: jede Entitaet als JSON-Array unter eigenem Key.
  // -----------------------------------------------------------------------
  function localStorageKey(storeName) {
    return LOCAL_STORAGE_PREFIX + storeName;
  }

  function localStorageReadAll(storeName) {
    var raw = global.localStorage.getItem(localStorageKey(storeName));
    if (!raw) {
      return [];
    }
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function localStorageWriteAll(storeName, items) {
    global.localStorage.setItem(localStorageKey(storeName), JSON.stringify(items));
  }

  function localStorageSave(storeName, record) {
    return new Promise(function (resolve, reject) {
      try {
        var items = localStorageReadAll(storeName);
        var index = items.findIndex(function (item) {
          return item.id === record.id;
        });
        if (index === -1) {
          items.push(record);
        } else {
          items[index] = record;
        }
        localStorageWriteAll(storeName, items);
        resolve(record);
      } catch (err) {
        reject(err);
      }
    });
  }

  function localStorageList(storeName) {
    return new Promise(function (resolve, reject) {
      try {
        resolve(localStorageReadAll(storeName));
      } catch (err) {
        reject(err);
      }
    });
  }

  function localStorageGet(storeName, id) {
    return new Promise(function (resolve, reject) {
      try {
        var items = localStorageReadAll(storeName);
        var found = items.find(function (item) {
          return item.id === id;
        });
        resolve(found || null);
      } catch (err) {
        reject(err);
      }
    });
  }

  function localStorageRemove(storeName, id) {
    return new Promise(function (resolve, reject) {
      try {
        var items = localStorageReadAll(storeName);
        var filtered = items.filter(function (item) {
          return item.id !== id;
        });
        localStorageWriteAll(storeName, filtered);
        resolve(true);
      } catch (err) {
        reject(err);
      }
    });
  }

  // -----------------------------------------------------------------------
  // IndexedDB-Backend.
  // -----------------------------------------------------------------------
  function indexedDbSave(storeName, record) {
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, 'readwrite');
        var store = tx.objectStore(storeName);
        var request = store.put(record);
        request.onsuccess = function () {
          resolve(record);
        };
        request.onerror = function (event) {
          reject(event.target.error || new Error('Speichern fehlgeschlagen: ' + storeName));
        };
      });
    });
  }

  function indexedDbList(storeName) {
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, 'readonly');
        var store = tx.objectStore(storeName);
        var request = store.getAll();
        request.onsuccess = function (event) {
          resolve(event.target.result || []);
        };
        request.onerror = function (event) {
          reject(event.target.error || new Error('Lesen fehlgeschlagen: ' + storeName));
        };
      });
    });
  }

  function indexedDbGet(storeName, id) {
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, 'readonly');
        var store = tx.objectStore(storeName);
        var request = store.get(id);
        request.onsuccess = function (event) {
          resolve(event.target.result || null);
        };
        request.onerror = function (event) {
          reject(event.target.error || new Error('Lesen fehlgeschlagen: ' + storeName));
        };
      });
    });
  }

  function indexedDbRemove(storeName, id) {
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, 'readwrite');
        var store = tx.objectStore(storeName);
        var request = store.delete(id);
        request.onsuccess = function () {
          resolve(true);
        };
        request.onerror = function (event) {
          reject(event.target.error || new Error('Loeschen fehlgeschlagen: ' + storeName));
        };
      });
    });
  }

  // -----------------------------------------------------------------------
  // Backend-Auswahl: IndexedDB bevorzugt, sonst localStorage-Fallback.
  // -----------------------------------------------------------------------
  function saveRecord(storeName, record) {
    if (!record || typeof record.id === 'undefined' || record.id === null) {
      return Promise.reject(new Error('Datensatz benoetigt ein id-Feld: ' + storeName));
    }
    if (hasIndexedDb()) {
      return indexedDbSave(storeName, record);
    }
    if (hasLocalStorage()) {
      return localStorageSave(storeName, record);
    }
    return Promise.reject(new Error('Kein Storage-Backend verfuegbar (weder IndexedDB noch localStorage).'));
  }

  function listRecords(storeName) {
    if (hasIndexedDb()) {
      return indexedDbList(storeName);
    }
    if (hasLocalStorage()) {
      return localStorageList(storeName);
    }
    return Promise.reject(new Error('Kein Storage-Backend verfuegbar (weder IndexedDB noch localStorage).'));
  }

  function getRecord(storeName, id) {
    if (hasIndexedDb()) {
      return indexedDbGet(storeName, id);
    }
    if (hasLocalStorage()) {
      return localStorageGet(storeName, id);
    }
    return Promise.reject(new Error('Kein Storage-Backend verfuegbar (weder IndexedDB noch localStorage).'));
  }

  function removeRecord(storeName, id) {
    if (hasIndexedDb()) {
      return indexedDbRemove(storeName, id);
    }
    if (hasLocalStorage()) {
      return localStorageRemove(storeName, id);
    }
    return Promise.reject(new Error('Kein Storage-Backend verfuegbar (weder IndexedDB noch localStorage).'));
  }

  // -----------------------------------------------------------------------
  // Oeffentliche, entitaetsspezifische CRUD-API.
  // -----------------------------------------------------------------------
  function saveRoom(room) {
    return saveRecord(STORES.rooms, room);
  }
  function listRooms() {
    return listRecords(STORES.rooms);
  }
  function getRoom(id) {
    return getRecord(STORES.rooms, id);
  }
  function deleteRoom(id) {
    return removeRecord(STORES.rooms, id);
  }

  function saveProduct(product) {
    return saveRecord(STORES.products, product);
  }
  function listProducts() {
    return listRecords(STORES.products);
  }
  function getProduct(id) {
    return getRecord(STORES.products, id);
  }
  function deleteProduct(id) {
    return removeRecord(STORES.products, id);
  }

  function saveCustomer(customer) {
    return saveRecord(STORES.customers, customer);
  }
  function listCustomers() {
    return listRecords(STORES.customers);
  }
  function getCustomer(id) {
    return getRecord(STORES.customers, id);
  }
  function deleteCustomer(id) {
    return removeRecord(STORES.customers, id);
  }

  function saveStorageLot(lot) {
    return saveRecord(STORES.storageLots, lot);
  }
  function listStorageLots() {
    return listRecords(STORES.storageLots);
  }
  function getStorageLot(id) {
    return getRecord(STORES.storageLots, id);
  }
  function deleteStorageLot(id) {
    return removeRecord(STORES.storageLots, id);
  }

  function saveTempLog(log) {
    return saveRecord(STORES.tempLogs, log);
  }
  function listTempLogs() {
    return listRecords(STORES.tempLogs);
  }
  function getTempLog(id) {
    return getRecord(STORES.tempLogs, id);
  }
  function deleteTempLog(id) {
    return removeRecord(STORES.tempLogs, id);
  }

  function saveInvoice(invoice) {
    return saveRecord(STORES.invoices, invoice);
  }
  function listInvoices() {
    return listRecords(STORES.invoices);
  }
  function getInvoice(id) {
    return getRecord(STORES.invoices, id);
  }
  function deleteInvoice(id) {
    return removeRecord(STORES.invoices, id);
  }

  var CCMStorage = {
    STORES: STORES,
    saveRoom: saveRoom,
    listRooms: listRooms,
    getRoom: getRoom,
    deleteRoom: deleteRoom,
    saveProduct: saveProduct,
    listProducts: listProducts,
    getProduct: getProduct,
    deleteProduct: deleteProduct,
    saveCustomer: saveCustomer,
    listCustomers: listCustomers,
    getCustomer: getCustomer,
    deleteCustomer: deleteCustomer,
    saveStorageLot: saveStorageLot,
    listStorageLots: listStorageLots,
    getStorageLot: getStorageLot,
    deleteStorageLot: deleteStorageLot,
    saveTempLog: saveTempLog,
    listTempLogs: listTempLogs,
    getTempLog: getTempLog,
    deleteTempLog: deleteTempLog,
    saveInvoice: saveInvoice,
    listInvoices: listInvoices,
    getInvoice: getInvoice,
    deleteInvoice: deleteInvoice
  };

  global.CCMStorage = CCMStorage;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CCMStorage;
  }
})(typeof window !== 'undefined' ? window : globalThis);
