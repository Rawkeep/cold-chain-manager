/**
 * app.js
 *
 * Orchestrierungs-Layer der cold-chain-manager App-Shell (index.html). Bindet
 * die fachlichen Module (Models, Storage, Fees, Capacity, Temperature,
 * Perishability, Accounts, Receipt, CSV, I18n) an die UI. Reiner Browser-Code
 * ohne externe Requests: alle Daten liegen lokal (IndexedDB/localStorage).
 *
 * Dieses Modul ist bewusst NICHT Node-testbar (es greift direkt auf document/
 * window zu) -- die deterministische Kern-Logik steckt in den einzelnen
 * Fachmodulen und wird dort getestet.
 */
(function (global) {
  'use strict';

  // Ohne Browser-DOM (z.B. beim node --check) macht app.js nichts.
  if (typeof document === 'undefined') {
    return;
  }

  var Models = global.CCMModels;
  var Storage = global.CCMStorage;
  var Fees = global.CCMFees;
  var Capacity = global.CCMCapacity;
  var Temperature = global.CCMTemperature;
  var Perishability = global.CCMPerishability;
  var Accounts = global.CCMAccounts;
  var Receipt = global.CCMReceipt;
  var Csv = global.CCMCsv;
  var I18n = global.CCMI18n;

  // In-Memory-Spiegel der persistierten Daten (fuer synchrones Rendern).
  var state = {
    rooms: [],
    products: [],
    customers: [],
    lots: [],
    tempLogs: [],
    invoices: []
  };

  function $(id) {
    return document.getElementById(id);
  }

  function t(key) {
    return I18n.t(key, I18n.getLanguage());
  }

  function todayIso() {
    return new Date().toISOString();
  }

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        node.setAttribute(k, attrs[k]);
      });
    }
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  }

  // ---------------------------------------------------------------------
  // Daten laden / speichern
  // ---------------------------------------------------------------------
  function reloadAll() {
    return Promise.all([
      Storage.listRooms(),
      Storage.listProducts(),
      Storage.listCustomers(),
      Storage.listStorageLots(),
      Storage.listTempLogs(),
      Storage.listInvoices()
    ]).then(function (res) {
      state.rooms = res[0] || [];
      state.products = res[1] || [];
      state.customers = res[2] || [];
      state.lots = res[3] || [];
      state.tempLogs = res[4] || [];
      state.invoices = res[5] || [];
      renderAll();
    });
  }

  function productById(id) {
    var map = {};
    state.products.forEach(function (p) {
      map[p.id] = p;
    });
    return map[id];
  }

  function findById(list, id) {
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === id) {
        return list[i];
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Sprache / Navigation
  // ---------------------------------------------------------------------
  function applyTranslations() {
    var lang = I18n.getLanguage();
    document.documentElement.setAttribute('lang', lang);
    var nodes = document.querySelectorAll('[data-i18n]');
    Array.prototype.forEach.call(nodes, function (node) {
      node.textContent = I18n.t(node.getAttribute('data-i18n'), lang);
    });
    document.querySelectorAll('#language-switcher button').forEach(function (btn) {
      btn.classList.toggle('active-lang', btn.getAttribute('data-lang') === lang);
    });
  }

  function showView(viewId) {
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.toggle('active', v.id === viewId);
    });
    document.querySelectorAll('.nav-btn').forEach(function (b) {
      b.classList.toggle('active-nav', b.getAttribute('data-view') === viewId);
    });
  }

  // ---------------------------------------------------------------------
  // Select-Optionen fuellen
  // ---------------------------------------------------------------------
  function fillSelect(select, items, valueKey, labelFn) {
    if (!select) {
      return;
    }
    var current = select.value;
    select.innerHTML = '';
    items.forEach(function (item) {
      var opt = el('option', { value: item[valueKey] }, labelFn(item));
      select.appendChild(opt);
    });
    if (current) {
      select.value = current;
    }
  }

  function productLabel(p) {
    return I18n.getLanguage() === 'en' ? p.nameEn : p.nameFr;
  }

  function refreshSelects() {
    fillSelect($('lot-room-id'), state.rooms, 'id', function (r) {
      return r.name;
    });
    fillSelect($('lot-customer-id'), state.customers, 'id', function (c) {
      return c.name;
    });
    fillSelect($('lot-product-id'), state.products, 'id', productLabel);
    fillSelect($('temp-room-id'), state.rooms, 'id', function (r) {
      return r.name;
    });
    fillSelect($('payment-customer-id'), state.customers, 'id', function (c) {
      return c.name;
    });
    fillSelect($('openitems-customer-id'), state.customers, 'id', function (c) {
      return c.name;
    });
    // Auslager-Auswahl: nur aktive Lots.
    var activeLots = state.lots.filter(Capacity.isActiveLot);
    fillSelect($('release-lot-id'), activeLots, 'id', function (l) {
      var cust = findById(state.customers, l.customerId);
      return l.id + ' - ' + (cust ? cust.name : l.customerId) + ' (' + l.crates + ')';
    });
  }

  // ---------------------------------------------------------------------
  // Rendering: Dashboard
  // ---------------------------------------------------------------------
  function renderDashboard() {
    var container = $('dashboard-rooms');
    if (container) {
      container.innerHTML = '';
      state.rooms.forEach(function (room) {
        var free = Capacity.freeCrates(room, state.lots);
        var occ = Capacity.occupiedCrates(room, state.lots);
        var readings = Temperature.readingsLastDays(room.id, state.tempLogs, 7);
        var latest = Temperature.latestReading(room.id, state.tempLogs);
        var alarm = latest ? Temperature.evaluateReading(latest.tempCx10, room).alarm : false;

        var card = el('div', { class: 'room-card' + (alarm ? ' room-card-alarm' : '') });
        card.appendChild(el('h3', null, room.name + ' (' + t(room.type) + ')'));
        card.appendChild(el('div', null, t('occupiedCrates') + ': ' + occ + ' / ' + room.capacityCrates));
        card.appendChild(el('div', null, t('freeCrates') + ': ' + free));
        var sollText = t('sollRange') + ': ' + (room.sollTempMinX10 / 10) + '..' + (room.sollTempMaxX10 / 10) + ' C';
        card.appendChild(el('div', null, sollText));
        if (latest) {
          card.appendChild(el('div', null, t('tempCurrent') + ': ' + (latest.tempCx10 / 10) + ' C'));
        }
        var spark = el('div', { class: 'sparkline-wrap' });
        spark.innerHTML = Temperature.buildSparklineSvg(readings, room);
        card.appendChild(spark);
        container.appendChild(card);
      });
    }

    // Alarm-Liste
    var alarmBox = $('dashboard-alarms');
    if (alarmBox) {
      alarmBox.innerHTML = '';
      var alarms = Temperature.buildAlarmList(state.rooms, state.tempLogs);
      if (alarms.length === 0) {
        alarmBox.appendChild(el('li', null, '-'));
      }
      alarms.forEach(function (a) {
        var label = (a.type === 'high' ? t('alarmTooHigh') : t('alarmTooLow'));
        alarmBox.appendChild(
          el('li', { class: 'alarm-item' }, a.roomName + ': ' + (a.tempCx10 / 10) + ' C (' + label + ')')
        );
      });
    }

    // Verderb-Risiko-Warnungen
    var spoilBox = $('dashboard-spoilage');
    if (spoilBox) {
      spoilBox.innerHTML = '';
      var warnings = Perishability.buildSpoilageWarnings(state.lots, buildProductMap());
      if (warnings.length === 0) {
        spoilBox.appendChild(el('li', null, '-'));
      }
      warnings.forEach(function (w) {
        var prod = productById(w.productId);
        var pName = prod ? productLabel(prod) : w.productId;
        spoilBox.appendChild(
          el('li', { class: 'spoilage-item' },
            pName + ' (' + w.crates + '): ' + w.daysStored + '/' + w.maxStorageDays + ' ' +
            t('days') + ' +' + w.overshoot)
        );
      });
    }

    // Umsatz Tag / Monat (aus bezahlten + offenen Belegen: hier bruttoumsatz)
    var revenueBox = $('dashboard-revenue');
    if (revenueBox) {
      var now = new Date();
      var dayKey = now.toISOString().slice(0, 10);
      var monthKey = now.toISOString().slice(0, 7);
      var revDay = 0;
      var revMonth = 0;
      state.invoices.forEach(function (inv) {
        var lot = findById(state.lots, inv.lotId);
        var ref = lot && lot.releasedAt ? lot.releasedAt : '';
        if (ref.slice(0, 10) === dayKey) {
          revDay += inv.amount;
        }
        if (ref.slice(0, 7) === monthKey) {
          revMonth += inv.amount;
        }
      });
      revenueBox.innerHTML = '';
      revenueBox.appendChild(el('div', null, t('revenueDay') + ': ' + revDay));
      revenueBox.appendChild(el('div', null, t('revenueMonth') + ': ' + revMonth));
    }
  }

  function buildProductMap() {
    var map = {};
    state.products.forEach(function (p) {
      map[p.id] = p;
    });
    return map;
  }

  // ---------------------------------------------------------------------
  // Rendering: Raum-Liste
  // ---------------------------------------------------------------------
  function renderRooms() {
    var body = $('rooms-table-body');
    if (!body) {
      return;
    }
    body.innerHTML = '';
    state.rooms.forEach(function (room) {
      var tr = el('tr');
      tr.appendChild(el('td', null, room.id));
      tr.appendChild(el('td', null, room.name));
      tr.appendChild(el('td', null, t(room.type)));
      tr.appendChild(el('td', null, String(room.capacityCrates)));
      tr.appendChild(el('td', null, (room.sollTempMinX10 / 10) + '..' + (room.sollTempMaxX10 / 10)));
      body.appendChild(tr);
    });
  }

  // ---------------------------------------------------------------------
  // Rendering: Kundenkonten / offene Posten
  // ---------------------------------------------------------------------
  function renderCustomers() {
    var body = $('customers-table-body');
    if (body) {
      body.innerHTML = '';
      state.customers.forEach(function (c) {
        var open = Accounts.customerOpenBalance(c.id, state.invoices);
        var tr = el('tr');
        tr.appendChild(el('td', null, c.name));
        tr.appendChild(el('td', null, t(c.type)));
        tr.appendChild(el('td', null, c.phone || ''));
        tr.appendChild(el('td', null, String(open)));
        body.appendChild(tr);
      });
    }
    renderOpenItems();
  }

  function renderOpenItems() {
    var box = $('openitems-list');
    var sel = $('openitems-customer-id');
    if (!box || !sel) {
      return;
    }
    box.innerHTML = '';
    var customerId = sel.value;
    if (!customerId) {
      return;
    }
    var items = Accounts.openItems(customerId, state.invoices);
    items.forEach(function (item) {
      var li = el('li', { class: 'openitem' });
      li.appendChild(el('span', null,
        item.invoice.id + ': ' + item.openAmount + ' ' + (item.invoice.currency || '')));
      var payBtn = el('button', { type: 'button', class: 'pay-btn' }, t('partialPayment'));
      payBtn.addEventListener('click', function () {
        onPartialPayment(item.invoice);
      });
      li.appendChild(payBtn);
      box.appendChild(li);
    });
  }

  function onPartialPayment(invoice) {
    var raw = global.prompt(t('payment') + ' (' + (invoice.currency || '') + ')');
    if (raw === null) {
      return;
    }
    var amount = Math.round(Number(raw));
    if (!Number.isInteger(amount) || amount <= 0) {
      global.alert(t('payment') + ': ?');
      return;
    }
    var open = Accounts.invoiceOpenAmount(invoice);
    if (amount > open) {
      amount = open;
    }
    var updated = Accounts.applyPayment(invoice, amount);
    Storage.saveInvoice(updated).then(reloadAll);
  }

  // ---------------------------------------------------------------------
  // Rendering: Temperatur-Ansicht
  // ---------------------------------------------------------------------
  function renderTemperature() {
    var box = $('temperature-rooms');
    if (!box) {
      return;
    }
    box.innerHTML = '';
    state.rooms.forEach(function (room) {
      var readings = Temperature.readingsLastDays(room.id, state.tempLogs, 7);
      var latest = Temperature.latestReading(room.id, state.tempLogs);
      var alarm = latest ? Temperature.evaluateReading(latest.tempCx10, room) : { alarm: false };
      var card = el('div', { class: 'room-card' + (alarm.alarm ? ' room-card-alarm' : '') });
      card.appendChild(el('h3', null, room.name));
      card.appendChild(el('div', null,
        t('sollRange') + ': ' + (room.sollTempMinX10 / 10) + '..' + (room.sollTempMaxX10 / 10) + ' C'));
      if (latest) {
        card.appendChild(el('div', null, t('tempCurrent') + ': ' + (latest.tempCx10 / 10) + ' C'));
      }
      var spark = el('div', { class: 'sparkline-wrap' });
      spark.innerHTML = Temperature.buildSparklineSvg(readings, room);
      card.appendChild(spark);
      box.appendChild(card);
    });
  }

  function renderAll() {
    applyTranslations();
    refreshSelects();
    renderDashboard();
    renderRooms();
    renderCustomers();
    renderTemperature();
  }

  // ---------------------------------------------------------------------
  // Formular-Handler
  // ---------------------------------------------------------------------
  function onCreateRoom(e) {
    e.preventDefault();
    try {
      var room = Models.createRoom({
        name: $('room-name').value,
        type: $('room-type').value,
        capacityCrates: Math.round(Number($('room-capacity').value)),
        sollTempMin: Number($('room-soll-min').value),
        sollTempMax: Number($('room-soll-max').value)
      });
      Storage.saveRoom(room).then(reloadAll);
      $('room-form').reset();
    } catch (err) {
      global.alert(err.message);
    }
  }

  function onCreateProduct(e) {
    e.preventDefault();
    try {
      var data = {
        nameFr: $('product-name-fr').value,
        nameEn: $('product-name-en').value,
        perishability: $('product-perishability').value
      };
      var maxDays = Number($('product-max-days').value);
      if (Number.isInteger(maxDays) && maxDays > 0) {
        data.maxStorageDays = maxDays;
      }
      var product = Models.createProduct(data);
      Storage.saveProduct(product).then(reloadAll);
      $('product-form').reset();
    } catch (err) {
      global.alert(err.message);
    }
  }

  function onCreateCustomer(e) {
    e.preventDefault();
    try {
      var customer = Models.createCustomer({
        name: $('customer-name').value,
        type: $('customer-type').value,
        phone: $('customer-phone').value
      });
      Storage.saveCustomer(customer).then(reloadAll);
      $('customer-form').reset();
    } catch (err) {
      global.alert(err.message);
    }
  }

  function onStoreIn(e) {
    e.preventDefault();
    try {
      var room = findById(state.rooms, $('lot-room-id').value);
      var crates = Math.round(Number($('lot-crates').value));
      // Kapazitaets-Guard: keine Ueberbelegung.
      Capacity.assertCanStore(room, state.lots, crates);
      var lot = Models.createStorageLot({
        roomId: $('lot-room-id').value,
        customerId: $('lot-customer-id').value,
        productId: $('lot-product-id').value,
        crates: crates,
        storedAt: $('lot-date').value ? new Date($('lot-date').value).toISOString() : todayIso(),
        tarifPerCrateDay: Math.round(Number($('lot-tarif').value)),
        currency: $('lot-currency').value
      });
      Storage.saveStorageLot(lot).then(function () {
        return reloadAll();
      }).then(function () {
        // Einlagerbeleg anzeigen
        var customer = findById(state.customers, lot.customerId);
        var product = productById(lot.productId);
        var html = Receipt.buildStorageReceiptHtml(lot, customer, product, room);
        showReceipt(html);
      });
      $('storein-form').reset();
    } catch (err) {
      global.alert(err.message);
    }
  }

  function onRelease(e) {
    e.preventDefault();
    try {
      var lot = findById(state.lots, $('release-lot-id').value);
      if (!lot) {
        return;
      }
      var releasedAt = $('release-date').value
        ? new Date($('release-date').value).toISOString()
        : todayIso();
      // Lot als ausgelagert markieren
      var releasedLot = Models.createStorageLot({
        id: lot.id,
        roomId: lot.roomId,
        customerId: lot.customerId,
        productId: lot.productId,
        crates: lot.crates,
        storedAt: lot.storedAt,
        releasedAt: releasedAt,
        tarifPerCrateDay: lot.tarifPerCrateDay,
        currency: lot.currency,
        status: 'released'
      });
      var fee = Fees.computeLotFee(releasedLot);
      var invoice = Models.createInvoice({
        customerId: lot.customerId,
        lotId: lot.id,
        days: fee.days,
        crates: fee.crates,
        amount: fee.amount,
        currency: fee.currency
      });
      Promise.all([
        Storage.saveStorageLot(releasedLot),
        Storage.saveInvoice(invoice)
      ]).then(reloadAll).then(function () {
        var customer = findById(state.customers, lot.customerId);
        var product = productById(lot.productId);
        var room = findById(state.rooms, lot.roomId);
        var html = Receipt.buildReleaseReceiptHtml(releasedLot, fee, invoice, customer, product, room);
        showReceipt(html);
      });
      $('release-form').reset();
    } catch (err) {
      global.alert(err.message);
    }
  }

  function onRecordTemp(e) {
    e.preventDefault();
    try {
      var log = Models.createTempLog({
        roomId: $('temp-room-id').value,
        ts: $('temp-date').value ? new Date($('temp-date').value).toISOString() : todayIso(),
        tempC: Number($('temp-value').value),
        recordedBy: $('temp-recorder').value
      });
      Storage.saveTempLog(log).then(reloadAll);
      $('temp-form').reset();
    } catch (err) {
      global.alert(err.message);
    }
  }

  function showReceipt(html) {
    var target = $('receipt-preview');
    if (target) {
      target.innerHTML = html;
    }
  }

  // ---------------------------------------------------------------------
  // CSV
  // ---------------------------------------------------------------------
  function onExportRoomsCsv() {
    var csv = Csv.exportRoomsToCsv(state.rooms);
    var blob = new Blob([csv], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: 'rooms.csv' });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function onImportRoomsCsv() {
    var input = $('rooms-csv-file');
    if (!input || !input.files || input.files.length === 0) {
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      Csv.importRoomsFromCsv(String(reader.result)).then(reloadAll).catch(function (err) {
        global.alert(err.message);
      });
    };
    reader.readAsText(input.files[0]);
  }

  // ---------------------------------------------------------------------
  // Verdrahtung
  // ---------------------------------------------------------------------
  function bind() {
    document.querySelectorAll('.nav-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showView(btn.getAttribute('data-view'));
      });
    });
    document.querySelectorAll('#language-switcher button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        I18n.setLanguage(btn.getAttribute('data-lang'));
        renderAll();
      });
    });

    var forms = [
      ['room-form', onCreateRoom],
      ['product-form', onCreateProduct],
      ['customer-form', onCreateCustomer],
      ['storein-form', onStoreIn],
      ['release-form', onRelease],
      ['temp-form', onRecordTemp]
    ];
    forms.forEach(function (pair) {
      var f = $(pair[0]);
      if (f) {
        f.addEventListener('submit', pair[1]);
      }
    });

    bindClick('btn-export-rooms-csv', onExportRoomsCsv);
    bindClick('btn-import-rooms-csv', onImportRoomsCsv);
    bindClick('btn-print-receipt', function () {
      var target = $('receipt-preview');
      if (target && target.innerHTML) {
        Receipt.printReceiptHtml(target.innerHTML);
      }
    });

    var openSel = $('openitems-customer-id');
    if (openSel) {
      openSel.addEventListener('change', renderOpenItems);
    }
  }

  function bindClick(id, handler) {
    var node = $(id);
    if (node) {
      node.addEventListener('click', handler);
    }
  }

  function init() {
    bind();
    showView('view-dashboard');
    reloadAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.CCMApp = {
    reloadAll: reloadAll,
    state: state
  };
})(typeof window !== 'undefined' ? window : globalThis);
