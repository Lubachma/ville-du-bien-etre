const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Stockage local en mémoire, pour les fichiers qui lisent localStorage.
function memoryStorage() {
  const data = new Map();
  return { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k), clear: () => data.clear() };
}
// Charge des fichiers de src/ dans une machine virtuelle, l'horloge figée à « now ».
function loadApp(files, { now = '2026-10-18T12:00:00Z', expose = [], globals = {} } = {}) {
  const wall = Date.parse(now);
  class Clock extends Date { constructor(...a) { super(...(a.length ? a : [wall])); } static now() { return wall; } }
  const context = vm.createContext({ console, Date: Clock, Intl, Math, JSON, setTimeout, clearTimeout, TextEncoder, TextDecoder,
    window: {}, document: { documentElement: {} }, navigator: { languages: ['fr-CH'] }, localStorage: memoryStorage(), ...globals });
  const source = files.map(file => fs.readFileSync(path.join(__dirname, '..', '..', 'src', file), 'utf8')).join('\n');
  vm.runInContext(source + `\nthis.api = { ${expose.join(', ')}, get state() { return S; }, set state(v) { S = v; } };`, context);
  return context.api;
}
// Recopie une valeur de la machine virtuelle dans ce royaume : les comparaisons strictes refusent les prototypes d'ailleurs.
const plain = value => structuredClone(value);
module.exports = { loadApp, memoryStorage, plain };
