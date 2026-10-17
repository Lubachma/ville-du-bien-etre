const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const DICTIONARIES = ['06-lang-fr.js', '07-lang-en.js'];

function app() {
  const context = vm.createContext({ console, Intl, Date, Math, JSON, setTimeout, clearTimeout,
    window: {}, document: { documentElement: {} }, navigator: { languages: ['fr-CH'] } });
  const source = ['00-core.js', '05-i18n.js', ...DICTIONARIES, '10-state.js', '20-rules.js']
    .map(file => fs.readFileSync(path.join(root, 'src', file), 'utf8')).join('\n');
  vm.runInContext(source + `\nthis.api = { DICT, t, setLang, resolveLang, fmt, fmtMin, frTypo, normalize, defaultState,
    displayName, cityName, get state() { return S; }, set state(v) { S = v; } };`, context);
  return context.api;
}

test('les deux dictionnaires ont exactement les mêmes clés', () => {
  const { DICT } = app();
  assert.deepEqual(Object.keys(DICT.fr).sort(), Object.keys(DICT.en).sort());
});

test('chaque clé utilisée existe dans les deux langues', () => {
  const { DICT } = app();
  const used = new Set();
  for (const file of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && !DICTIONARIES.includes(f))) {
    for (const m of fs.readFileSync(path.join(root, 'src', file), 'utf8').matchAll(/\bt\(\s*'([^']+)'\s*[,)]/g)) used.add(m[1]);
  }
  for (const m of fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/data-i18n(?:-(?:aria-label|placeholder|title))?="([^"]+)"/g)) used.add(m[1]);
  const missing = [...used].filter(key => !(key in DICT.fr) || !(key in DICT.en));
  assert.deepEqual(missing, []);
});

test('resolveLang : préférences du navigateur', () => {
  const { resolveLang } = app();
  assert.equal(resolveLang('auto', ['de-CH', 'fr-FR']), 'fr');
  assert.equal(resolveLang('auto', ['en-US', 'fr']), 'en');
  assert.equal(resolveLang('auto', ['de-CH']), 'en');
  assert.equal(resolveLang('fr', ['en-US']), 'fr');
  assert.equal(resolveLang('en', ['fr-FR']), 'en');
});

test('t : interpolation, pluriels et genre', () => {
  const { DICT, t, setLang } = app();
  DICT.fr['test.n'] = { one: '{n} jour', other: '{n} jours' };
  DICT.en['test.n'] = { one: '{n} day', other: '{n} days' };
  DICT.fr['test.g'] = { m: 'construit', f: 'construite' };
  DICT.en['test.g'] = { m: 'built', f: 'built' };
  setLang('fr');
  assert.equal(t('test.n', { n: 0 }), '0 jour');
  assert.equal(t('test.n', { n: 2 }), '2 jours');
  assert.equal(t('test.g', { g: 'f' }), 'construite');
  assert.equal(t('test.g', { g: 'm' }), 'construit');
  setLang('en');
  assert.equal(t('test.n', { n: 0 }), '0 days');
  assert.equal(t('test.n', { n: 1 }), '1 day');
  assert.equal(t('when.today', { time: '09:30' }), 'today, 09:30');
  assert.equal(t('absent.key'), 'absent.key');
});

test('formats selon la langue', () => {
  const { setLang, fmt, fmtMin, frTypo } = app();
  setLang('fr');
  assert.equal(fmt(1.5e6), '1,5 M');
  assert.equal(fmt(2e9), '2 Md');
  assert.equal(fmtMin(90), '1 h 30');
  assert.equal(frTypo('Bonjour !'), 'Bonjour !');
  setLang('en');
  assert.equal(fmt(1.5e6), '1.5 M');
  assert.equal(fmt(2e9), '2 B');
  assert.equal(fmtMin(90), '1 h 30 min');
  assert.equal(frTypo('Hello !'), 'Hello !');
});

test("langue d'une ville existante et d'une ville neuve", () => {
  const { normalize, defaultState } = app();
  assert.equal(normalize({ settings: { grace: 10 } }).settings.lang, 'fr');
  assert.equal(normalize({ settings: { lang: 'en' } }).settings.lang, 'en');
  assert.equal(defaultState().settings.lang, 'auto');
});

test("exemples par défaut et nom de ville traduits tant qu'ils ne sont pas renommés", () => {
  const a = app();
  a.setLang('en');
  const names = a.defaultState().activities.map(x => x.name);
  assert.ok(names.includes('Reading') && names.includes('Walk outside'), names.join(', '));
  assert.equal(a.defaultState().wishes.find(x => x.name === 'Go for a walk').place, 'outside');
  assert.equal(a.displayName('Lecture'), 'Reading');
  assert.equal(a.displayName('Mon roman'), 'Mon roman');
  a.setLang('fr');
  assert.equal(a.displayName('Go for a walk'), 'Aller marcher');
  a.state.personal.name = 'Ma ville'; a.setLang('en');
  assert.equal(a.cityName(), 'My town');
  a.state.personal.name = '';
  assert.equal(a.cityName(), 'My town');
  a.state.personal.name = 'Lausanne';
  assert.equal(a.cityName(), 'Lausanne');
});
