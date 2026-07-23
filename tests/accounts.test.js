'use strict';

/*
 * Tests fuer Kundenkonten / offene Posten (js/accounts.js).
 * Akzeptanzkriterium 6: offene Posten, Teilzahlung moeglich.
 */

const test = require('node:test');
const assert = require('node:assert');
const Accounts = require('../js/accounts.js');

function invoice(id, customerId, amount, paidAmount) {
  return {
    id: id,
    customerId: customerId,
    lotId: 'lot_' + id,
    amount: amount,
    paidAmount: paidAmount || 0,
    currency: 'XOF'
  };
}

test('invoiceOpenAmount: offener Betrag = amount - paidAmount', () => {
  assert.strictEqual(Accounts.invoiceOpenAmount(invoice('b1', 'c1', 1000, 300)), 700);
});

test('invoiceOpenAmount: vollstaendig bezahlt -> 0', () => {
  assert.strictEqual(Accounts.invoiceOpenAmount(invoice('b1', 'c1', 1000, 1000)), 0);
});

test('customerOpenBalance: Summe der offenen Betraege eines Kunden', () => {
  const invoices = [
    invoice('b1', 'c1', 1000, 300),
    invoice('b2', 'c1', 500, 0),
    invoice('b3', 'c2', 800, 0) // anderer Kunde
  ];
  assert.strictEqual(Accounts.customerOpenBalance('c1', invoices), 1200);
});

test('openItems: nur Belege mit Restbetrag', () => {
  const invoices = [
    invoice('b1', 'c1', 1000, 1000), // bezahlt
    invoice('b2', 'c1', 500, 200) // offen 300
  ];
  const items = Accounts.openItems('c1', invoices);
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].invoice.id, 'b2');
  assert.strictEqual(items[0].openAmount, 300);
});

test('applyPayment: Teilzahlung setzt Status teil', () => {
  const inv = invoice('b1', 'c1', 1000, 0);
  const updated = Accounts.applyPayment(inv, 400);
  assert.strictEqual(updated.paidAmount, 400);
  assert.strictEqual(updated.paidStatus, 'teil');
  // Original unveraendert (immutable)
  assert.strictEqual(inv.paidAmount, 0);
});

test('applyPayment: Restzahlung setzt Status ja', () => {
  const inv = invoice('b1', 'c1', 1000, 600);
  const updated = Accounts.applyPayment(inv, 400);
  assert.strictEqual(updated.paidAmount, 1000);
  assert.strictEqual(updated.paidStatus, 'ja');
});

test('applyPayment: Betrag ueber offenem Rest wirft Fehler', () => {
  const inv = invoice('b1', 'c1', 1000, 600);
  assert.throws(function () {
    Accounts.applyPayment(inv, 500); // offen ist nur 400
  }, /uebersteigt offenen Betrag/);
});

test('applyPayment: nicht-positiver Betrag wirft Fehler', () => {
  const inv = invoice('b1', 'c1', 1000, 0);
  assert.throws(function () {
    Accounts.applyPayment(inv, 0);
  }, /positiver Integer/);
});

test('paidStatusFor: Grenzfaelle nein/teil/ja', () => {
  assert.strictEqual(Accounts.paidStatusFor(1000, 0), 'nein');
  assert.strictEqual(Accounts.paidStatusFor(1000, 500), 'teil');
  assert.strictEqual(Accounts.paidStatusFor(1000, 1000), 'ja');
});
