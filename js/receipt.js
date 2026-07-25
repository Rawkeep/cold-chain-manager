/**
 * receipt.js
 *
 * Erzeugt druck-/PDF-faehige Belege fuer Ein- und Auslagerung
 * (Akzeptanzkriterium 5). Es werden keine externen PDF-Bibliotheken oder
 * CDN-Ressourcen verwendet: der Beleg wird als druckoptimiertes HTML/CSS-
 * Fragment in den DOM eingehaengt, der Nutzer erzeugt die PDF-Datei ueber den
 * Browser-Druckdialog via window.print(). Beschriftungen sind FR/EN ueber
 * js/i18n.js (CCMI18n). Der Auslagerbeleg enthaelt Beleg-Nr., Kisten, Tage und
 * Betrag.
 *
 * HTML-Escaping, Geldformatierung und der DOM-/window.print()-Mechanismus
 * sind generisch und leben jetzt geteilt in js/shared/offline-kit.js
 * (OfflineKit.receipt) -- identisch in fuenf weiteren Rawkeep-Offline-Apps.
 * Diese Datei enthaelt nur noch das App-spezifische Beleg-Layout (HTML/CSS
 * fuer Ein-/Auslagerung).
 */
(function (global) {
  'use strict';

  var RECEIPT_ROOT_ID = 'ccm-receipt-root';

  function resolveOfflineKit() {
    if (global.OfflineKit) {
      return global.OfflineKit;
    }
    if (typeof require === 'function') {
      return require('./shared/offline-kit.js');
    }
    throw new Error('OfflineKit (js/shared/offline-kit.js) ist nicht verfuegbar.');
  }

  function resolveI18n() {
    if (global.CCMI18n) {
      return global.CCMI18n;
    }
    if (typeof require === 'function') {
      return require('./i18n.js');
    }
    throw new Error('CCMI18n (js/i18n.js) ist nicht verfuegbar.');
  }

  var OfflineKit = resolveOfflineKit();
  var escapeHtml = OfflineKit.receipt.escapeHtml;
  var formatMoney = OfflineKit.receipt.formatMoney;

  function receiptStyle() {
    return (
      '<style>' +
      '.ccm-receipt{font-family:Arial,sans-serif;color:#111;max-width:480px;margin:0 auto;padding:16px;}' +
      '.ccm-receipt table{width:100%;border-collapse:collapse;margin-top:12px;}' +
      '.ccm-receipt th{text-align:left;padding:4px 8px;font-weight:bold;width:45%;}' +
      '.ccm-receipt td{padding:4px 8px;}' +
      '.ccm-receipt .ccm-receipt-total td{font-weight:bold;border-top:1px solid #111;}' +
      '@media print{' +
      'body *{visibility:hidden;}' +
      '#' + RECEIPT_ROOT_ID + ',#' + RECEIPT_ROOT_ID + ' *{visibility:visible;}' +
      '#' + RECEIPT_ROOT_ID + '{position:absolute;top:0;left:0;width:100%;}' +
      '}' +
      '</style>'
    );
  }

  /**
   * Baut das druckoptimierte HTML-Fragment eines EINLAGER-Belegs. Reine
   * String-Funktion (in Node testbar).
   */
  function buildStorageReceiptHtml(lot, customer, product, room, lang) {
    var CCMI18n = resolveI18n();
    var l = lot || {};
    var c = customer || {};
    var prod = product || {};
    var rm = room || {};
    var targetLang = lang || CCMI18n.getLanguage();

    var productName = targetLang === 'en' ? prod.nameEn : prod.nameFr;

    return (
      '<div class="ccm-receipt" id="' + RECEIPT_ROOT_ID + '-content">' +
      receiptStyle() +
      '<h1>' + escapeHtml(CCMI18n.t('storageReceipt', targetLang)) + '</h1>' +
      '<table>' +
      '<tr><th>' + escapeHtml(CCMI18n.t('receiptNo', targetLang)) + '</th><td>' + escapeHtml(l.id) + '</td></tr>' +
      '<tr><th>' + escapeHtml(CCMI18n.t('customer', targetLang)) + '</th><td>' + escapeHtml(c.name || l.customerId) + '</td></tr>' +
      '<tr><th>' + escapeHtml(CCMI18n.t('product', targetLang)) + '</th><td>' + escapeHtml(productName || l.productId) + '</td></tr>' +
      '<tr><th>' + escapeHtml(CCMI18n.t('room', targetLang)) + '</th><td>' + escapeHtml(rm.name || l.roomId) + '</td></tr>' +
      '<tr><th>' + escapeHtml(CCMI18n.t('crates', targetLang)) + '</th><td>' + escapeHtml(l.crates) + '</td></tr>' +
      '<tr><th>' + escapeHtml(CCMI18n.t('storedAt', targetLang)) + '</th><td>' + escapeHtml(l.storedAt) + '</td></tr>' +
      '<tr><th>' + escapeHtml(CCMI18n.t('ratePerCrateDay', targetLang)) + '</th><td>' + escapeHtml(formatMoney(l.tarifPerCrateDay, l.currency)) + '</td></tr>' +
      '</table>' +
      '</div>'
    );
  }

  /**
   * Baut das druckoptimierte HTML-Fragment eines AUSLAGER-Belegs. `fee` ist
   * das Ergebnis von CCMFees.computeLotFee (days, crates, amount, currency);
   * `invoice` liefert die Beleg-Nr. (beleg_nr). Enthaelt Beleg-Nr., Kisten,
   * Tage und Betrag (Akzeptanzkriterium 5).
   */
  function buildReleaseReceiptHtml(lot, fee, invoice, customer, product, room, lang) {
    var CCMI18n = resolveI18n();
    var l = lot || {};
    var f = fee || {};
    var inv = invoice || {};
    var c = customer || {};
    var prod = product || {};
    var rm = room || {};
    var targetLang = lang || CCMI18n.getLanguage();

    var productName = targetLang === 'en' ? prod.nameEn : prod.nameFr;
    var currency = f.currency || l.currency;
    var belegNr = inv.id || l.id;

    return (
      '<div class="ccm-receipt" id="' + RECEIPT_ROOT_ID + '-content">' +
      receiptStyle() +
      '<h1>' + escapeHtml(CCMI18n.t('releaseReceipt', targetLang)) + '</h1>' +
      '<table>' +
      '<tr><th>' + escapeHtml(CCMI18n.t('receiptNo', targetLang)) + '</th><td>' + escapeHtml(belegNr) + '</td></tr>' +
      '<tr><th>' + escapeHtml(CCMI18n.t('customer', targetLang)) + '</th><td>' + escapeHtml(c.name || l.customerId) + '</td></tr>' +
      '<tr><th>' + escapeHtml(CCMI18n.t('product', targetLang)) + '</th><td>' + escapeHtml(productName || l.productId) + '</td></tr>' +
      '<tr><th>' + escapeHtml(CCMI18n.t('room', targetLang)) + '</th><td>' + escapeHtml(rm.name || l.roomId) + '</td></tr>' +
      '<tr><th>' + escapeHtml(CCMI18n.t('crates', targetLang)) + '</th><td>' + escapeHtml(f.crates) + '</td></tr>' +
      '<tr><th>' + escapeHtml(CCMI18n.t('storedAt', targetLang)) + '</th><td>' + escapeHtml(l.storedAt) + '</td></tr>' +
      '<tr><th>' + escapeHtml(CCMI18n.t('releasedAt', targetLang)) + '</th><td>' + escapeHtml(l.releasedAt) + '</td></tr>' +
      '<tr><th>' + escapeHtml(CCMI18n.t('days', targetLang)) + '</th><td>' + escapeHtml(f.days) + '</td></tr>' +
      '<tr><th>' + escapeHtml(CCMI18n.t('ratePerCrateDay', targetLang)) + '</th><td>' + escapeHtml(formatMoney(l.tarifPerCrateDay, currency)) + '</td></tr>' +
      '<tr class="ccm-receipt-total"><th>' + escapeHtml(CCMI18n.t('amount', targetLang)) + '</th><td>' + escapeHtml(formatMoney(f.amount, currency)) + '</td></tr>' +
      '</table>' +
      '</div>'
    );
  }

  /**
   * Rendert ein Beleg-HTML-Fragment in den DOM und startet window.print().
   */
  function printReceiptHtml(html) {
    return OfflineKit.receipt.printReceipt(RECEIPT_ROOT_ID, html);
  }

  var CCMReceipt = {
    RECEIPT_ROOT_ID: RECEIPT_ROOT_ID,
    formatMoney: formatMoney,
    buildStorageReceiptHtml: buildStorageReceiptHtml,
    buildReleaseReceiptHtml: buildReleaseReceiptHtml,
    printReceiptHtml: printReceiptHtml
  };

  global.CCMReceipt = CCMReceipt;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CCMReceipt;
  }
})(typeof window !== 'undefined' ? window : globalThis);
