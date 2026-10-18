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
  vm.runInContext(source + `\nthis.api = { DICT, t, setLang, resolveLang, langs, langChoices, locale, fmt, fmtMin, frTypo, normalize, defaultState,
    displayName, cityName, tParts, applyStaticText, ITEMS, CAT_ORDER, itemName, itemGender, catName, catOf, catHint, groupName,
    get state() { return S; }, set state(v) { S = v; } };`, context);
  return context.api;
}

test('tous les dictionnaires ont les mêmes clés', () => {
  const { DICT } = app();
  for (const lang of Object.keys(DICT)) assert.deepEqual(Object.keys(DICT[lang]).sort(), Object.keys(DICT.fr).sort(), lang);
});

test('chaque clé utilisée existe dans les deux langues', () => {
  const { DICT } = app();
  const used = new Set();
  for (const file of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && !DICTIONARIES.includes(f))) {
    for (const m of fs.readFileSync(path.join(root, 'src', file), 'utf8').matchAll(/\b(?:t|tParts|ex)\(\s*'([^']+)'\s*[,)]/g)) used.add(m[1]);
  }
  for (const m of fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/data-i18n(?:-(?:aria-label|aria-roledescription|placeholder|title))?="([^"]+)"/g)) used.add(m[1]);
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

test('noms dynamiques présents', () => {
  const a = app();
  for (const lang of ['fr', 'en']) {
    const dict = a.DICT[lang];
    for (const k of Object.keys(a.ITEMS)) assert.ok('item.' + k in dict, lang + ' item.' + k);
    for (const c of a.CAT_ORDER) for (const key of ['cat.' + c, 'cat.' + c + '.of', 'cat.' + c + '.hint']) assert.ok(key in dict, lang + ' ' + key);
    assert.ok('group.decor' in dict && 'group.prestige' in dict, lang + ' groupes');
  }
  for (const file of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js'))) {
    assert.equal(fs.readFileSync(path.join(root, 'src', file), 'utf8').match(/(ITEMS|CATS)\[[^\]]+\]\.(name|de|hint)/g), null, file);
  }
  assert.deepEqual(Object.keys(a.ITEMS).filter(k => 'name' in a.ITEMS[k]), []);
  a.setLang('fr');
  assert.equal(a.itemName('maison'), 'Maison');
  assert.equal(a.itemGender('maison'), 'f');
  assert.equal(a.itemGender('stade'), 'm');
  assert.equal(a.catOf('esprit'), "d'Esprit");
  assert.equal(a.groupName('decor'), 'Décor');
  a.setLang('en');
  assert.equal(a.itemName('atelier'), "Artist's studio");
  assert.equal(a.catName('crea'), 'Creativity');
  assert.equal(a.catOf('corps'), 'of Body');
  assert.equal(a.groupName('prestige'), 'Landmarks');
});

// Fichiers dont tout le texte visible passe par t() ; chaque tâche de traduction y ajoute les siens.
const CLEAN_FILES = ['00-core.js', '05-i18n.js', '10-state.js', '20-rules.js', '22-sets.js', '23-achievements.js', '24-ambient.js', '25-challenges.js', '26-summaries.js', '27-share.js', '30-paint.js', '31-paint-buildings.js', '32-paint-decor.js', '33-paint-wonders.js', '34-paint-life.js', '35-city.js', '40-ui.js', '41-activities.js', '42-draw.js',
  '43-journal.js', '44-shop.js', '45-settings.js', '46-features.js', '47-accessibility.js', '48-status.js', '49-reminder.js', '50-session.js', '52-carnet.js', '53-visits.js', '54-rituals.js', '55-share.js', '60-boot.js', '70-install.js'];
// Exceptions purement techniques : listes de classes CSS, polices, clés de stockage, nom de l'app
// et sélecteurs CSS qui commencent par un identifiant ou une classe (« #poolSeg button »).
const TECHNICAL = [/^[a-z0-9-]+( [a-z0-9-]+)+$/, /px|serif|system-ui/, /^ville-(du-)?bien-etre/, /^Ville du bien-être$/, /^[#.][\w-]+( [#.]?[\w-]+)*$/];
const KEYWORDS_BEFORE_REGEX = new Set(['return', 'typeof', 'case', 'void', 'in', 'of', 'delete', 'new', 'throw', 'else', 'do', 'yield', 'await']);

// Chaînes d'un fichier JavaScript, sans les commentaires ni les expressions régulières.
function jsStrings(code) {
  const out = [];
  let i = 0, operand = false;
  while (i < code.length) {
    const c = code[i], n = code[i + 1];
    if (c === '/' && n === '/') { const end = code.indexOf('\n', i); i = end < 0 ? code.length : end; continue; }
    if (c === '/' && n === '*') { const end = code.indexOf('*/', i + 2); i = end < 0 ? code.length : end + 2; continue; }
    if (c === '/' && !operand) {
      let cls = false; i++;
      while (i < code.length && (code[i] !== '/' || cls)) { if (code[i] === '\\') i++; else if (code[i] === '[') cls = true; else if (code[i] === ']') cls = false; i++; }
      i++; operand = true; continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1, s = '';
      while (j < code.length && code[j] !== c) {
        if (code[j] === '\\') { s += code[j + 1]; j += 2; continue; }
        if (c === '`' && code[j] === '$' && code[j + 1] === '{') {
          let depth = 1; j += 2;
          while (j < code.length && depth) { if (code[j] === '{') depth++; else if (code[j] === '}') depth--; j++; }
          s += '{}'; continue;
        }
        s += code[j]; j++;
      }
      out.push(s); i = j + 1; operand = true; continue;
    }
    const word = /^[\w$.]+/.exec(code.slice(i, i + 40));
    if (word) { operand = !KEYWORDS_BEFORE_REGEX.has(word[0]); i += word[0].length; continue; }
    if (!/\s/.test(c)) operand = c === ')' || c === ']' || c === '}';
    i++;
  }
  return out;
}
function looksLikeText(s) {
  return (/[à-ÿœÀ-ŸŒ]/.test(s) || /[A-Za-zÀ-ÿ]{2,}[ '’][A-Za-zÀ-ÿ]{2,}/.test(s)) && !TECHNICAL.some(re => re.test(s));
}

test('tous les fichiers source sont traduits', () => {
  const sources = fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && !DICTIONARIES.includes(f));
  assert.deepEqual([...CLEAN_FILES].sort(), sources.sort());
});

test('aucun texte en dur dans les fichiers traduits', () => {
  const found = [];
  for (const file of CLEAN_FILES) {
    for (const s of jsStrings(fs.readFileSync(path.join(root, 'src', file), 'utf8'))) if (looksLikeText(s)) found.push(file + ': ' + s);
  }
  assert.deepEqual(found, []);
});

test("chaque texte fixe de la page est marqué data-i18n", () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|svg|title)\b[\s\S]*?<\/\1>/g, '');
  const body = html.slice(html.indexOf('<body'));
  const VOID = new Set(['input', 'img', 'br', 'hr', 'meta', 'link', 'source', 'use', 'path', 'circle', 'rect']);
  const stack = [], found = [];
  for (const m of body.matchAll(/<(\/?)([a-zA-Z0-9-]+)([^>]*)>|([^<]+)/g)) {
    if (m[4] !== undefined) {
      const text = m[4].replace(/&nbsp;/g, ' ').trim();
      if (/[A-Za-zÀ-ÿ]/.test(text) && !TECHNICAL.some(re => re.test(text)) && !(stack.length && /\sdata-i18n="/.test(stack[stack.length - 1]))) found.push('texte: ' + text);
      continue;
    }
    const [, close, tag, attrs] = m;
    if (close) { stack.pop(); continue; }
    for (const a of ['aria-label', 'aria-roledescription', 'placeholder', 'title']) {
      if (new RegExp('\\s' + a + '="').test(attrs) && !new RegExp('\\sdata-i18n-' + a + '="').test(attrs)) found.push(a + ': <' + tag + attrs + '>');
    }
    if (!VOID.has(tag.toLowerCase()) && !attrs.endsWith('/')) stack.push(attrs);
  }
  assert.deepEqual(found, []);
});

test('tParts : un paramètre peut être un élément de la page', () => {
  const a = app();
  a.DICT.fr['test.p'] = 'Tu as assez pour : {item} ({price}).';
  a.DICT.en['test.p'] = 'You can afford: {item} ({price}).';
  const node = { nodeType: 1 };
  a.setLang('fr');
  assert.deepEqual([...a.tParts('test.p', { item: node, price: '5 M' })], ['Tu as assez pour : ', node, ' (5 M).']);
  a.setLang('en');
  assert.deepEqual([...a.tParts('test.p', { item: node, price: '5 M' })], ['You can afford: ', node, ' (5 M).']);
});

test('applyStaticText remplit textes et attributs marqués', () => {
  const a = app();
  const el = (attrs, text = '') => ({ attrs: { ...attrs }, textContent: text, getAttribute(k) { return this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; } });
  const title = el({ 'data-i18n': 'city.listTitle' }), canvas = el({ 'data-i18n-aria-label': 'city.canvasLabel', 'data-i18n-aria-roledescription': 'city.roleDescription' });
  const all = [title, canvas];
  const root = { querySelectorAll(sel) { const attr = sel.slice(1, -1); return all.filter(x => attr in x.attrs); } };
  a.setLang('en'); a.applyStaticText(root);
  assert.equal(title.textContent, 'List of buildings');
  assert.equal(canvas.attrs['aria-roledescription'], 'town');
  assert.match(canvas.attrs['aria-label'], /^Your town\. /);
});

test('aucun mot de perte dans les textes', () => {
  const { DICT } = app();
  // Un mot entier, accent final compris (« raté » suivi d'une espace).
  const loss = /(^|[^\p{L}])(perdue?s?|raté|lost|missed)(?![\p{L}])/iu;
  const found = [];
  for (const lang of Object.keys(DICT)) {
    for (const [key, value] of Object.entries(DICT[lang])) {
      for (const text of typeof value === 'object' ? Object.values(value) : [value]) if (loss.test(text)) found.push(lang + ' ' + key + ': ' + text);
    }
  }
  assert.deepEqual(found, []);
});

test('pourcentage de bonus selon la langue', () => {
  const { setLang, t } = app();
  setLang('fr');
  assert.equal(t('unit.bonusPct', { pct: 20 }), '+20 %');
  setLang('en');
  assert.equal(t('unit.bonusPct', { pct: 20 }), '+20%');
});

test('les règles de gain décrivent le bon retour comme le début d’une nouvelle série', () => {
  const { DICT } = app();
  assert.match(DICT.fr['settings.rules'], /bon retour \+20 % pour la première session qui relance une série, après au moins 2 jours sans session/);
  assert.match(DICT.en['settings.rules'], /welcome back \+20% on the first session that starts a new streak, after at least 2 days without one/);
});

test('une troisième langue ne demande que son dictionnaire', () => {
  const a = app();
  a.DICT.xx = Object.assign({}, a.DICT.en, { 'lang.self': 'Xxx', 'lang.locale': 'de-CH', 'lang.typo': '', 'fmt.decimal': ',',
    'fmt.million': 'Mio', 'fmt.billion': 'Mrd', 'fmt.hoursMinutes': '{h} Std. {mm}', 'nav.city': 'Xstadt' });
  assert.ok(a.langs().includes('xx'));
  assert.deepEqual([...a.langChoices().at(-1)], ['xx', 'Xxx']);
  assert.equal(a.resolveLang('auto', ['xx-CH']), 'xx');
  a.setLang('xx');
  assert.equal(a.t('nav.city'), 'Xstadt');
  assert.equal(a.locale(), 'de-CH');
  assert.equal(a.fmt(1.5e9), '1,5 Mrd');
  assert.equal(a.fmt(2.5e6), '2,5 Mio');
  assert.equal(a.fmtMin(75), '1 Std. 15');
  assert.equal(a.frTypo('a : b'), 'a : b');
  assert.equal(a.normalize({ settings: { lang: 'xx' } }).settings.lang, 'xx');
});

test('français et anglais gardent leurs formats', () => {
  const a = app();
  a.setLang('fr');
  assert.deepEqual(Array.from(a.langChoices(), choice => [...choice]), [['auto', 'Automatique'], ['fr', 'Français'], ['en', 'English']]);
  assert.deepEqual([a.fmt(1.5e9), a.fmt(2.5e6), a.fmt(1500), a.locale()], ['1,5 Md', '2,5 M', '2 k', 'fr-CH']);
  assert.deepEqual([a.fmtMin(45), a.fmtMin(90), a.fmtMin(120)], ['45 min', '1 h 30', '2 h']);
  assert.equal(a.frTypo('a : b « c »'), 'a : b « c »');
  a.setLang('en');
  assert.deepEqual([a.fmt(1.5e9), a.fmtMin(90), a.locale()], ['1.5 B', '1 h 30 min', 'en-GB']);
  assert.equal(a.frTypo('a : b'), 'a : b');
});

test('les libellés dans la phrase viennent du dictionnaire', () => {
  const { DICT } = app();
  const keys = ['act.energyLow', 'act.energyMedium', 'act.energyHigh', 'act.placeAny', 'act.placeInside', 'act.placeOutside',
    'act.repeatAlways', 'act.repeatOnce', 'act.repeatDaily', 'act.repeatWeekly', 'draw.energyAny', 'draw.energyLow', 'draw.energyMedium', 'draw.energyHigh'];
  for (const lang of ['fr', 'en']) for (const k of keys) assert.equal(DICT[lang][k + '.inline'], DICT[lang][k].toLowerCase(), lang + ' ' + k);
  for (const file of ['41-activities.js', '42-draw.js']) assert.doesNotMatch(fs.readFileSync(path.join(root, 'src', file), 'utf8'), /toLowerCase\(\)/, file);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'src', '00-core.js'), 'utf8'), /function plural\(/);
});

test('anglais : « Green thumb » cite les cerisiers, une merveille finie est « Inaugurated »', () => {
  const { DICT } = app();
  assert.match(DICT.en['ach.main-verte.desc'], /cherry trees/);
  assert.equal(DICT.en['shop.wonderDone'], 'Inaugurated');
});

test('le nom par défaut enregistré tel quel, dans une langue ou l’autre, suit encore la langue', () => {
  const a = app();
  a.state = a.defaultState();
  a.state.personal.name = 'My town';
  a.setLang('fr');
  assert.equal(a.cityName(), 'Ma ville');
  a.state.personal.name = 'Ma ville';
  a.setLang('en');
  assert.equal(a.cityName(), 'My town');
  a.state.personal.name = 'Lumière';
  assert.equal(a.cityName(), 'Lumière');
});

test('le son « bol » porte son nom entier', () => {
  const { DICT } = app();
  assert.deepEqual([DICT.fr['settings.soundBowl'], DICT.en['settings.soundBowl']], ['Bol chantant', 'Singing bowl']);
});

test('aucun pluriel entre parenthèses : chaque texte choisit le singulier ou le pluriel', () => {
  const { DICT, t, setLang } = app();
  for (const lang of Object.keys(DICT)) {
    for (const [key, value] of Object.entries(DICT[lang])) {
      for (const text of typeof value === 'object' ? Object.values(value) : [value]) assert.doesNotMatch(String(text), /\(s\)/, lang + ' ' + key);
    }
  }
  setLang('fr');
  assert.match(t('storage.conflicts', { n: 1 }), /1\s?champ\./);
  assert.match(t('storage.conflicts', { n: 3 }), /3\s?champs\./);
});

test('la série compte des jours actifs : avec les jours de repos, ils ne se suivent pas forcément', () => {
  const { t, setLang } = app();
  setLang('fr');
  assert.equal(t('header.streakTitle', { n: 4 }), 'Série : 4\u00a0jours actifs');
  setLang('en');
  assert.equal(t('header.streakTitle', { n: 1 }), 'Streak: 1\u00a0active day');
});
