const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Fichiers chargés par défaut : l'état, les règles et la séance.
const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '50-session.js'];
// Fonctions remplacées par du vide : l'écran de séance, l'écran allumé et les sons ne tournent pas dans la VM.
const STUBS = ['showRun', 'showFail', 'showSuccess', 'setWake', 'renderTimer', 'Chime.rest', 'Chime.play'];
// Noms toujours rendus dans `api` ; `expose` en ajoute.
const API = ['Store', 'defaultState', 'normalize', 'merge3', 'mergeList', 'startSession', 'completeSession', 'failSession', 'checkActive', 'tick', 'onLeave',
  'endRun', 'persistRun', 'commit', 'activeState'];

const sources = new Map();
const sourceOf = files => {
  const key = files.join('\n');
  if (!sources.has(key)) sources.set(key, files.map(file => fs.readFileSync(path.join(__dirname, '..', '..', 'src', file), 'utf8')).join('\n'));
  return sources.get(key);
};

// Stockage local en mémoire ; `fail` fait échouer les écritures (stockage plein).
function storage() {
  const data = new Map();
  return { data, fail: false, getItem(k) { return data.get(k) ?? null; }, setItem(k, v) { if (this.fail) throw new Error('QuotaExceededError'); data.set(k, String(v)); }, removeItem(k) { data.delete(k); } };
}
// Verrous partagés entre onglets : une demande à la fois, dans l'ordre.
function lockManager() {
  let queue = Promise.resolve();
  return { request(name, options, callback) { const job = queue.then(callback); queue = job.catch(() => {}); return job; } };
}
// Un onglet : les fichiers de src/ dans une VM, sur le stockage et les verrous donnés. L'horloge murale part du 17 octobre 2026
// à midi ; `advance(ms)` l'avance, `setNow(iso)` la fixe. `real` garde les vraies fonctions parmi STUBS (setWake, renderTimer…),
// pour un test qui leur donne de quoi tourner (un faux DOM).
function stateApp(localStorage = storage(), locks = lockManager(), { files = FILES, expose = [], real = [] } = {}) {
  let wall = Date.parse('2026-10-17T12:00:00Z');
  class Clock extends Date { constructor(...a) { super(...(a.length ? a : [wall])); } static now() { return wall; } }
  const element = { hidden: true, style: { setProperty() {} }, replaceChildren() {}, focus() {}, append() {}, querySelector() { return this; }, setAttribute() {} };
  const context = vm.createContext({ console, Date: Clock, Intl, Math, JSON, setTimeout, clearTimeout, setInterval: () => 1, clearInterval() {}, localStorage,
    navigator: { locks }, performance: { now: () => wall },
    window: { matchMedia: () => ({ matches: true }) },
    document: { visibilityState: 'visible', hasFocus: () => true, querySelector: () => element, querySelectorAll: () => [], createElement: () => element },
    currentTab: 'activites', Mode: {}, Selection: {}, City: { relayout() {} }, sheetKeepOnSync: true,
    renderStorageStatus() {}, renderSyncStatus() {}, renderAll() {}, renderVille() {}, updateInert() {}, closeSheet() {}, toast() {}, bump() {},
  });
  const stubs = STUBS.filter(name => !real.includes(name)).map(name => name + ' = () => {};').join(' ');
  const names = [...new Set([...API, ...expose])].join(', ');
  vm.runInContext(sourceOf(files) + `\n${stubs}\nthis.api = { ${names}, get state() { return S; }, set state(v) { S = normalize(v); }, get run() { return run; } };`, context);
  return { ...context.api, api: context.api, context, localStorage, advance(ms) { wall += ms; }, setNow(iso) { wall = Date.parse(iso); }, init() { context.api.Store.init(); } };
}

module.exports = { storage, lockManager, stateApp, FILES };
