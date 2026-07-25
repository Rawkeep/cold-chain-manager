/**
 * i18n.js
 *
 * Minimale i18n-Basis fuer cold-chain-manager: Woerterbuch mit Franzoesisch
 * (fr) und Englisch (en) fuer alle UI-Kernbegriffe, plus Uebersetzungsfunktion
 * t(key, lang) und Sprachumschaltung setLanguage/getLanguage mit Persistenz in
 * localStorage. Jeder Begriff besitzt sowohl einen fr- als auch einen
 * en-Eintrag. Keine externen Requests, keine externen i18n-Bibliotheken.
 *
 * Die generische Engine (t/setLanguage/getLanguage, localStorage-Persistenz)
 * lebt jetzt geteilt in js/shared/offline-kit.js (OfflineKit.createI18n) --
 * identisch in fuenf weiteren Rawkeep-Offline-Apps. Diese Datei enthaelt nur
 * noch das App-spezifische Woerterbuch und die Sprachkonfiguration.
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

  var LANGUAGE_STORAGE_KEY = 'cold_chain_manager_lang';
  var SUPPORTED_LANGUAGES = ['fr', 'en'];
  var DEFAULT_LANGUAGE = 'fr';

  var TRANSLATIONS = {
    // App-Shell / Navigation
    appTitle: { fr: 'Gestionnaire de chaine du froid', en: 'Cold Chain Manager' },
    navDashboard: { fr: 'Tableau de bord', en: 'Dashboard' },
    navRooms: { fr: 'Chambres froides', en: 'Cold Rooms' },
    navStorage: { fr: 'Entree en stock', en: 'Store-In' },
    navRelease: { fr: 'Sortie de stock', en: 'Release' },
    navTemperature: { fr: 'Temperature', en: 'Temperature' },
    navCustomers: { fr: 'Clients', en: 'Customers' },
    navCsv: { fr: 'Import/Export CSV', en: 'CSV Import/Export' },

    // Allgemeine Begriffe
    room: { fr: 'Chambre froide', en: 'Cold Room' },
    rooms: { fr: 'Chambres froides', en: 'Cold Rooms' },
    roomType: { fr: 'Type', en: 'Type' },
    capacity: { fr: 'Capacite (caisses)', en: 'Capacity (crates)' },
    freeCrates: { fr: 'Caisses libres', en: 'Free crates' },
    occupiedCrates: { fr: 'Caisses occupees', en: 'Occupied crates' },
    customer: { fr: 'Client', en: 'Customer' },
    product: { fr: 'Produit', en: 'Product' },
    crates: { fr: 'Caisses', en: 'Crates' },
    days: { fr: 'Jours', en: 'Days' },
    amount: { fr: 'Montant', en: 'Amount' },
    currency: { fr: 'Devise', en: 'Currency' },
    date: { fr: 'Date', en: 'Date' },
    phone: { fr: 'Telephone', en: 'Phone' },
    ratePerCrateDay: { fr: 'Tarif par caisse et par jour', en: 'Rate per crate per day' },
    storedAt: { fr: "Date d'entree", en: 'Stored at' },
    releasedAt: { fr: 'Date de sortie', en: 'Released at' },

    // Typen
    solar: { fr: 'Solaire', en: 'Solar' },
    netz: { fr: 'Reseau', en: 'Grid' },
    hybrid: { fr: 'Hybride', en: 'Hybrid' },
    farmer: { fr: 'Agriculteur', en: 'Farmer' },
    aggregator: { fr: 'Agregateur', en: 'Aggregator' },
    haendler: { fr: 'Commercant', en: 'Trader' },

    // Verderblichkeit
    perishability: { fr: 'Perissabilite', en: 'Perishability' },
    low: { fr: 'Faible', en: 'Low' },
    medium: { fr: 'Moyenne', en: 'Medium' },
    high: { fr: 'Elevee', en: 'High' },
    maxStorageDays: { fr: 'Duree max. de stockage (jours)', en: 'Max storage days' },

    // Temperatur
    temperature: { fr: 'Temperature', en: 'Temperature' },
    tempCurrent: { fr: 'Temperature actuelle', en: 'Current temperature' },
    sollRange: { fr: 'Plage de consigne', en: 'Target range' },
    sollTempMin: { fr: 'Temp. min.', en: 'Min temp.' },
    sollTempMax: { fr: 'Temp. max.', en: 'Max temp.' },
    recordTemp: { fr: 'Enregistrer la temperature', en: 'Record temperature' },
    recordedBy: { fr: 'Releve par', en: 'Recorded by' },
    alarm: { fr: 'Alarme', en: 'Alarm' },
    alarms: { fr: 'Alarmes', en: 'Alarms' },
    alarmTooLow: { fr: 'Trop froid', en: 'Too cold' },
    alarmTooHigh: { fr: 'Trop chaud', en: 'Too warm' },
    tempHistory7d: { fr: 'Historique 7 jours', en: '7-day history' },

    // Ein-/Auslagerung + Belege
    storeIn: { fr: 'Entree en stock', en: 'Store-in' },
    release: { fr: 'Sortie de stock', en: 'Release' },
    storageReceipt: { fr: "Recu d'entree", en: 'Storage Receipt' },
    releaseReceipt: { fr: 'Recu de sortie', en: 'Release Receipt' },
    receiptNo: { fr: 'No de recu', en: 'Receipt No.' },
    printReceipt: { fr: 'Imprimer le recu', en: 'Print receipt' },
    fee: { fr: 'Frais', en: 'Fee' },

    // Dashboard
    dashboard: { fr: 'Tableau de bord', en: 'Dashboard' },
    utilization: { fr: 'Taux d occupation', en: 'Utilization' },
    revenueDay: { fr: 'Chiffre d affaires (jour)', en: 'Revenue (day)' },
    revenueMonth: { fr: 'Chiffre d affaires (mois)', en: 'Revenue (month)' },
    spoilageRisk: { fr: 'Risque de deperissement', en: 'Spoilage risk' },
    overdue: { fr: 'En retard', en: 'Overdue' },

    // Kundenkonto
    openBalance: { fr: 'Solde du', en: 'Open balance' },
    openItems: { fr: 'Postes ouverts', en: 'Open items' },
    payment: { fr: 'Paiement', en: 'Payment' },
    partialPayment: { fr: 'Paiement partiel', en: 'Partial payment' },
    paid: { fr: 'Paye', en: 'Paid' },
    unpaid: { fr: 'Non paye', en: 'Unpaid' },
    partial: { fr: 'Partiel', en: 'Partial' },

    // CSV
    csvImportExport: { fr: 'Import/Export CSV', en: 'CSV Import/Export' },
    exportCsv: { fr: 'Exporter CSV', en: 'Export CSV' },
    importCsv: { fr: 'Importer CSV', en: 'Import CSV' },

    // Aktionen
    save: { fr: 'Enregistrer', en: 'Save' },
    name: { fr: 'Nom', en: 'Name' }
  };

  var CCMI18n = OfflineKit.createI18n({
    languageStorageKey: LANGUAGE_STORAGE_KEY,
    supportedLanguages: SUPPORTED_LANGUAGES,
    defaultLanguage: DEFAULT_LANGUAGE,
    translations: TRANSLATIONS
  });

  global.CCMI18n = CCMI18n;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CCMI18n;
  }
})(typeof window !== 'undefined' ? window : globalThis);
