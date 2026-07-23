/**
 * capacity.js
 *
 * Kapazitaets- und Bestandsrechnung je Kuehlraum (Akzeptanzkriterium 2).
 * Ein Raum kann nicht ueber seine Kapazitaet (kapazitaet_kisten) belegt
 * werden; die freien Kisten je Raum sind immer die Kapazitaet minus der
 * Summe der Kisten aller AKTIVEN Lots (releasedAt == null, status active).
 * Reine, seiteneffektfreie Funktionen -- keine externen Requests.
 */
(function (global) {
  'use strict';

  /**
   * Prueft, ob ein Lot aktiv ist (noch eingelagert): kein Auslagerzeitpunkt
   * und Status nicht 'released'.
   */
  function isActiveLot(lot) {
    if (!lot) {
      return false;
    }
    if (lot.status === 'released') {
      return false;
    }
    return !lot.releasedAt;
  }

  /**
   * Filtert die aktiven Lots eines Raums.
   */
  function activeLotsForRoom(roomId, lots) {
    var list = Array.isArray(lots) ? lots : [];
    return list.filter(function (lot) {
      return isActiveLot(lot) && lot.roomId === roomId;
    });
  }

  /**
   * Summe der aktuell belegten Kisten eines Raums (Sigma aktive Lots).
   */
  function occupiedCrates(roomId, lots) {
    return activeLotsForRoom(roomId, lots).reduce(function (sum, lot) {
      return sum + (Number.isInteger(lot.crates) ? lot.crates : 0);
    }, 0);
  }

  /**
   * Freie Kisten eines Raums = Kapazitaet - belegte Kisten. Kann nie negativ
   * werden (auf 0 begrenzt, falls Daten inkonsistent sind).
   */
  function freeCrates(room, lots) {
    var r = room || {};
    var capacity = Number.isInteger(r.capacityCrates) ? r.capacityCrates : 0;
    var free = capacity - occupiedCrates(r.id, lots);
    return free > 0 ? free : 0;
  }

  /**
   * Prueft, ob eine gewuenschte Kistenzahl in den Raum passt, ohne die
   * Kapazitaet zu ueberschreiten. Verlangt eine positive Kistenzahl.
   */
  function canStore(room, lots, crates) {
    if (!Number.isInteger(crates) || crates <= 0) {
      return false;
    }
    return crates <= freeCrates(room, lots);
  }

  /**
   * Wie canStore, wirft aber mit aussagekraeftiger Meldung, wenn die
   * Einlagerung die Kapazitaet ueberschreiten wuerde. Nuetzlich als Guard vor
   * dem Anlegen eines Lots.
   */
  function assertCanStore(room, lots, crates) {
    if (!Number.isInteger(crates) || crates <= 0) {
      throw new Error('Kistenzahl muss ein positiver Integer sein.');
    }
    var free = freeCrates(room, lots);
    if (crates > free) {
      throw new Error(
        'Kapazitaet ueberschritten: angefragt ' + crates + ' Kisten, frei ' +
        free + ' Kisten in Raum ' + (room ? room.id : '?') + '.'
      );
    }
    return true;
  }

  var CCMCapacity = {
    isActiveLot: isActiveLot,
    activeLotsForRoom: activeLotsForRoom,
    occupiedCrates: occupiedCrates,
    freeCrates: freeCrates,
    canStore: canStore,
    assertCanStore: assertCanStore
  };

  global.CCMCapacity = CCMCapacity;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CCMCapacity;
  }
})(typeof window !== 'undefined' ? window : globalThis);
