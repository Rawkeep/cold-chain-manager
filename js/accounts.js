/**
 * accounts.js
 *
 * Kundenkonten und offene Posten (Akzeptanzkriterium 6). Berechnet den offenen
 * Saldo eines Kunden als Summe (amount - paidAmount) seiner Belege und wickelt
 * Teilzahlungen ab. Alle Betraege sind Integer (kleinste Waehrungseinheit) --
 * keine Float-Arithmetik, keine externen Requests. Reine Funktionen; Invoices
 * werden unveraendert kopiert (immutable), damit Aufrufer die Persistenz selbst
 * steuern.
 */
(function (global) {
  'use strict';

  /**
   * Bestimmt den Zahlstatus aus amount und paidAmount.
   */
  function paidStatusFor(amount, paidAmount) {
    if (paidAmount <= 0) {
      return 'nein';
    }
    if (paidAmount >= amount) {
      return 'ja';
    }
    return 'teil';
  }

  /**
   * Offener Betrag eines Belegs (amount - paidAmount, nie negativ).
   */
  function invoiceOpenAmount(invoice) {
    var inv = invoice || {};
    var amount = Number.isInteger(inv.amount) ? inv.amount : 0;
    var paid = Number.isInteger(inv.paidAmount) ? inv.paidAmount : 0;
    var open = amount - paid;
    return open > 0 ? open : 0;
  }

  /**
   * Offener Saldo eines Kunden = Summe der offenen Betraege seiner Belege.
   */
  function customerOpenBalance(customerId, invoices) {
    var list = Array.isArray(invoices) ? invoices : [];
    return list.reduce(function (sum, inv) {
      if (inv.customerId !== customerId) {
        return sum;
      }
      return sum + invoiceOpenAmount(inv);
    }, 0);
  }

  /**
   * Liefert die offenen Posten eines Kunden (Belege mit Restbetrag > 0),
   * jeweils mit dem offenen Betrag angereichert.
   */
  function openItems(customerId, invoices) {
    var list = Array.isArray(invoices) ? invoices : [];
    return list
      .filter(function (inv) {
        return inv.customerId === customerId && invoiceOpenAmount(inv) > 0;
      })
      .map(function (inv) {
        return {
          invoice: inv,
          openAmount: invoiceOpenAmount(inv)
        };
      });
  }

  /**
   * Verbucht eine (Teil-)Zahlung auf einen Beleg. Der Zahlbetrag muss ein
   * positiver Integer sein und darf den offenen Betrag nicht uebersteigen.
   * Liefert eine neue Invoice-Kopie mit aktualisiertem paidAmount/paidStatus.
   */
  function applyPayment(invoice, amount) {
    var inv = invoice || {};
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('Zahlbetrag muss ein positiver Integer sein.');
    }
    var open = invoiceOpenAmount(inv);
    if (amount > open) {
      throw new Error('Zahlbetrag (' + amount + ') uebersteigt offenen Betrag (' + open + ').');
    }
    var newPaid = (Number.isInteger(inv.paidAmount) ? inv.paidAmount : 0) + amount;
    var copy = {};
    Object.keys(inv).forEach(function (key) {
      copy[key] = inv[key];
    });
    copy.paidAmount = newPaid;
    copy.paidStatus = paidStatusFor(inv.amount, newPaid);
    return copy;
  }

  var CCMAccounts = {
    paidStatusFor: paidStatusFor,
    invoiceOpenAmount: invoiceOpenAmount,
    customerOpenBalance: customerOpenBalance,
    openItems: openItems,
    applyPayment: applyPayment
  };

  global.CCMAccounts = CCMAccounts;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CCMAccounts;
  }
})(typeof window !== 'undefined' ? window : globalThis);
