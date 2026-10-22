const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Les couleurs viennent de styles.css lui-même, lues sans dépendance : un jeton ou une règle qui change est mesuré aussitôt.
const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

// Les déclarations d'un bloc, par propriété (« !important » et espaces retirés). Un « ; » dans une parenthèse ne coupe pas.
function declarations(body) {
  const found = {};
  for (const part of body.split(/;(?![^(]*\))/)) {
    const colon = part.indexOf(':');
    if (colon > 0) found[part.slice(0, colon).trim()] = part.slice(colon + 1).replace(/\s*!important\s*$/, '').trim();
  }
  return found;
}
// Les règles d'une feuille, dans l'ordre : { media, selectors, declarations }. Les @media sont parcourues ; @font-face et @keyframes, ignorées.
function rulesOf(text, media = '') {
  const rules = [], css = text.replace(/\/\*[\s\S]*?\*\//g, '');
  for (let from = 0; ;) {
    const open = css.indexOf('{', from);
    if (open < 0) return rules;
    let depth = 1, end = open + 1;
    for (; end < css.length && depth; end++) depth += css[end] === '{' ? 1 : css[end] === '}' ? -1 : 0;
    const prelude = css.slice(from, open).trim(), body = css.slice(open + 1, end - 1);
    if (prelude.startsWith('@media')) rules.push(...rulesOf(body, prelude.slice(6).trim()));
    else if (!prelude.startsWith('@')) rules.push({ media, selectors: prelude.split(',').map(selector => selector.replace(/\s+/g, ' ').trim()), declarations: declarations(body) });
    from = end;
  }
}
const RULES = rulesOf(SOURCE);
// La valeur que « property » prend pour « selector » (la dernière règle qui la pose, hors @media) ; undefined sans règle.
function valueOf(selector, property) {
  const own = RULES.filter(rule => rule.media === '' && rule.selectors.includes(selector) && property in rule.declarations);
  return own.length ? own[own.length - 1].declarations[property] : undefined;
}

// Les trois déclarations des couleurs : le thème clair, puis le sombre choisi par l'appareil et le sombre choisi dans les réglages.
const block = (selector, media = '') => {
  const rule = RULES.find(entry => entry.media === media && entry.selectors.includes(selector) && '--ink' in entry.declarations);
  assert.ok(rule, `styles.css : le bloc « ${selector} » des couleurs est introuvable`);
  return rule.declarations;
};
const LIGHT = block(':root');
const THEMES = [
  ['thème clair', LIGHT],
  ['thème sombre (apparence de l’appareil)', block(':root:not([data-theme="light"])', '(prefers-color-scheme: dark)')],
  ['thème sombre (choisi)', block(':root[data-theme="dark"]')],
];

// Contraste WCAG 2.x : (L1 + 0,05) / (L2 + 0,05), L étant la luminance relative.
function rgb(hex) {
  assert.match(String(hex), /^#([0-9a-f]{3}|[0-9a-f]{6})$/i, `couleur « ${hex} » : un code #rgb ou #rrggbb est attendu`);
  const digits = hex.slice(1).replace(/^(.)(.)(.)$/, '$1$1$2$2$3$3');
  return [0, 2, 4].map(at => parseInt(digits.slice(at, at + 2), 16));
}
const luminance = hex => {
  const [red, green, blue] = rgb(hex).map(channel => { const c = channel / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};
const ratio = (a, b) => { const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (light + 0.05) / (dark + 0.05); };
// « var(--ink) » devient la couleur du thème ; un code #rrggbb reste tel quel.
const resolve = (value, colors) => {
  const token = /^var\((--[\w-]+)\)$/.exec(value);
  return token ? resolve(colors[token[1]], colors) : value;
};

test('contraste : couleurs des réglages', () => {
  const failures = [];
  // Les règles qui peignent ces éléments, telles qu'écrites dans styles.css.
  const chosen = '.seg button[aria-checked="true"]';
  const expectRule = (selector, property, expected, why) => {
    const actual = valueOf(selector, property);
    if (actual !== expected) failures.push(`${selector} { ${property} } vaut ${actual === undefined ? '(rien)' : actual} au lieu de ${expected} : ${why}`);
  };
  expectRule(chosen, 'background', 'var(--ink)', 'l’option choisie d’un contrôle segmenté a le fond foncé des puces choisies');
  expectRule(chosen, 'color', 'var(--surface)', 'son texte est clair sur ce fond');
  expectRule(chosen, 'box-shadow', 'none', 'elle ne garde pas l’ombre d’avant');
  expectRule('.input::placeholder', 'color', 'var(--muted)', 'le texte indicatif des champs');
  expectRule('.input::placeholder', 'opacity', '1', 'Firefox éclaircit le texte indicatif sans cela');
  expectRule('.elsewhere .note', 'color', 'var(--ink-2)', 'la note du bandeau « séance ailleurs »');
  // Les couleurs mesurées sont celles que les règles posent. Sans règle, le texte indicatif prend le gris du navigateur (darkgray) et
  // la note celle de « .note ».
  const pairs = [
    ['l’option choisie contre le fond du contrôle', valueOf(chosen, 'background'), valueOf('.seg', 'background'), 3],
    ['le texte de l’option choisie', valueOf(chosen, 'color'), valueOf(chosen, 'background'), 4.5],
    ['le texte indicatif des champs', valueOf('.input::placeholder', 'color') || '#a9a9a9', valueOf('.input', 'background'), 4.5],
    ['la note du bandeau « séance ailleurs »', valueOf('.elsewhere .note', 'color') || valueOf('.note', 'color'), valueOf('.elsewhere', 'background'), 4.5],
    // Les mêmes paires, écrites en jetons : ce que les règles ci-dessus doivent réunir.
    ['--ink contre --surface-2', 'var(--ink)', 'var(--surface-2)', 3],
    ['--surface sur --ink', 'var(--surface)', 'var(--ink)', 4.5],
    ['--muted sur --surface', 'var(--muted)', 'var(--surface)', 4.5],
    ['--ink-2 sur --accent-soft', 'var(--ink-2)', 'var(--accent-soft)', 4.5],
  ];
  for (const [theme, own] of THEMES) {
    const colors = { ...LIGHT, ...own };
    // Chaque thème sombre redéfinit les jetons mesurés : un oubli laisserait la valeur claire.
    for (const token of ['--ink', '--ink-2', '--muted', '--surface', '--surface-2', '--accent-soft']) {
      if (!(token in own)) failures.push(`${theme} : « ${token} » n’est pas redéfini`);
    }
    for (const [what, foreground, background, minimum] of pairs) {
      const measured = ratio(resolve(foreground, colors), resolve(background, colors));
      if (measured < minimum) failures.push(`${theme} : ${what}, ${foreground} sur ${background} : ${measured.toFixed(2)}:1 (${minimum}:1 au moins)`);
    }
  }
  assert.equal(failures.length, 0, '\n' + failures.join('\n'));
});
