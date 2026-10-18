/* =========================================================================
   Traduction : un dictionnaire par langue (06-lang-fr.js, 07-lang-en.js),
   langue courante dans LANG (00-core.js), textes fixes du HTML marqués data-i18n.
   Une entrée est un texte ({nom} à remplacer), des pluriels { one, other }
   ou un accord { m, f } choisi par le paramètre g.
   ========================================================================= */
const DICT = {};
const pluralRules = new Map();
let tplIndex = null;

// Les langues connues sont celles dont le dictionnaire est chargé : en ajouter une, c'est ajouter un fichier.
function langs() { return Object.keys(DICT); }
// Choix du réglage Langue : « Automatique », puis chaque langue écrite dans sa propre langue.
function langChoices() { return [['auto', t('lang.auto')], ...langs().map(code => [code, DICT[code]['lang.self'] || code])]; }
function locale() { return (DICT[LANG] && DICT[LANG]['lang.locale']) || 'fr-CH'; }

// 'auto' : la première langue du navigateur que l'app connaît, sinon l'anglais.
function resolveLang(pref, preferred) {
  if (langs().includes(pref)) return pref;
  let list = preferred;
  if (!list) {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    list = nav.languages && nav.languages.length ? nav.languages : [nav.language];
  }
  for (const entry of list) {
    const code = String(entry || '').toLowerCase().slice(0, 2);
    if (langs().includes(code)) return code;
  }
  return 'en';
}

function setLang(pref) {
  LANG = resolveLang(pref);
  TYPO = (DICT[LANG] && DICT[LANG]['lang.typo']) || '';
  if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = LANG;
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent('ville:lang'));
  }
}

function pluralCategory(n) {
  if (!pluralRules.has(LANG)) pluralRules.set(LANG, new Intl.PluralRules(locale()));
  return pluralRules.get(LANG).select(n);
}

function t(key, params = {}) {
  let value = DICT[LANG] && DICT[LANG][key];
  if (value == null) value = DICT.fr && DICT.fr[key];
  if (value == null) return key;
  if (typeof value === 'object') {
    if ('one' in value || 'other' in value) value = value[pluralCategory(Number(params.n) || 0)] ?? value.other ?? value.one;
    else value = params.g === 'f' ? value.f : value.m;
  }
  return String(value).replace(/\{(\w+)\}/g, (all, name) => (params[name] == null ? all : String(params[name])));
}

// Comme t(), mais un paramètre peut être un élément (un nom en gras…) : renvoie les morceaux à passer à h().
function tParts(key, params = {}) {
  const nodes = {}, plain = {};
  for (const [name, value] of Object.entries(params)) {
    if (value && typeof value === 'object' && 'nodeType' in value) { nodes[name] = value; plain[name] = '\u0000' + name + '\u0000'; }
    else plain[name] = value;
  }
  return t(key, plain).split('\u0000').map((part, i) => (i % 2 ? nodes[part] : part)).filter(part => part !== '');
}

function applyStaticText(root) {
  const scope = root || (typeof document !== 'undefined' ? document : null);
  if (!scope || typeof scope.querySelectorAll !== 'function') return;
  for (const el of scope.querySelectorAll('[data-i18n]')) el.textContent = frTypo(t(el.getAttribute('data-i18n')));
  for (const attr of ['aria-label', 'aria-roledescription', 'placeholder', 'title']) {
    for (const el of scope.querySelectorAll('[data-i18n-' + attr + ']')) el.setAttribute(attr, frTypo(t(el.getAttribute('data-i18n-' + attr))));
  }
}

// Un exemple jamais renommé (nom par défaut dans n'importe quelle langue) suit la langue choisie.
function displayName(name) {
  if (!tplIndex) {
    tplIndex = new Map();
    for (const lang of langs()) {
      for (const [key, value] of Object.entries(DICT[lang] || {})) if (key.startsWith('tpl.') && typeof value === 'string') tplIndex.set(value, key);
    }
  }
  const key = tplIndex.get(name);
  return key ? t(key) : name;
}

// Noms des bâtiments, des domaines et des rubriques de la boutique.
function itemName(key) { return t('item.' + key); }
function itemGender(key) { return ITEMS[key] && ITEMS[key].fem ? 'f' : 'm'; }
function catName(c) { return t('cat.' + c); }
function catOf(c) { return t('cat.' + c + '.of'); }
function catHint(c) { return t('cat.' + c + '.hint'); }
function groupName(g) { return t('group.' + g); }

// Le nom par défaut, enregistré tel quel dans n'importe quelle langue (« Ma ville » d'avant la traduction compris),
// reste un nom par défaut : il suit la langue affichée.
function cityName() {
  const name = S.personal && S.personal.name;
  return name && !langs().some(lang => DICT[lang]['city.defaultName'] === name) ? name : t('city.defaultName');
}

if (typeof window !== 'undefined') window.VilleI18n = Object.freeze({ t: (key, params) => t(key, params), lang: () => LANG });
