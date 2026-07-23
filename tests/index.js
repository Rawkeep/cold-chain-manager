'use strict';

/*
 * Sammel-Einstiegspunkt fuer den Node-Test-Runner.
 *
 * Damit `node --test tests/` (Aufloesung des Verzeichnisses auf diese
 * index.js) alle Testdateien ausfuehrt, werden hier saemtliche *.test.js
 * dieses Ordners eingebunden. Die einzelnen Dateien registrieren ihre Tests
 * beim gemeinsamen node:test-Runner.
 *
 * Ebenso funktionieren weiterhin:
 *   - `node --test`            (Auto-Discovery der *.test.js)
 *   - `node --test tests/*.test.js`
 * ohne dass Tests doppelt laufen: index.js selbst passt nicht auf das
 * Auto-Discovery-Namensmuster und wird dort nicht erneut geladen.
 */

const fs = require('node:fs');
const path = require('node:path');

fs.readdirSync(__dirname)
  .filter(function (f) {
    return f.endsWith('.test.js');
  })
  .sort()
  .forEach(function (f) {
    require(path.join(__dirname, f));
  });
