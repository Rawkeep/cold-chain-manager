'use strict';

/*
 * Fuehrt fuer JEDE Datei in js/ ein `node --check` aus (reine Syntaxpruefung).
 * Faellt der Check fuer eine Datei, faellt der Test mit der stderr-Ausgabe.
 */

const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const jsDir = path.join(__dirname, '..', 'js');

const files = fs.readdirSync(jsDir).filter(function (f) {
  return f.endsWith('.js');
});

test('js/ enthaelt Module', () => {
  assert.ok(files.length > 0, 'keine JS-Dateien in js/ gefunden');
});

files.forEach(function (file) {
  test('node --check: js/' + file, () => {
    const full = path.join(jsDir, file);
    try {
      execFileSync(process.execPath, ['--check', full], { stdio: 'pipe' });
    } catch (err) {
      const msg = err.stderr ? err.stderr.toString() : err.message;
      assert.fail('Syntaxfehler in ' + file + ':\n' + msg);
    }
  });
});
