const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/app.cjs');

const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js'];
const app = () => loadApp(FILES, { expose: ['fmt', 'fmtBalance', 'setLang', 'NB'] });

test('format : solde arrondi vers le bas, prix inchangés', () => {
  const { fmt, fmtBalance, setLang, NB } = app();
  // [pièces, solde en français, solde en anglais]
  const balances = [
    [2950000, '2,9' + NB + 'M', '2.9' + NB + 'M'],   // « 3 M » laisserait croire qu'on peut payer un élément à 3 M
    [3000000, '3' + NB + 'M', '3' + NB + 'M'],
    [999500, '999' + NB + 'k', '999' + NB + 'k'],     // ni « 1000 k », ni « 1 M » : on n'a pas 1 M
    [999960000, '999' + NB + 'M', '999' + NB + 'M'],  // ni « 1000 M », ni « 1 Md » ; dès 100 M, l'affichage n'a plus de décimale
    [100.6e6, '100' + NB + 'M', '100' + NB + 'M'],
    [1999, '1' + NB + 'k', '1' + NB + 'k'],
    [999, '999', '999'],
  ];
  // [pièces, prix en français, prix en anglais] : les prix gardent leur arrondi au plus proche
  const prices = [
    [7.5e6, '7,5' + NB + 'M', '7.5' + NB + 'M'],
    [5e5, '500' + NB + 'k', '500' + NB + 'k'],
    [2950000, '3' + NB + 'M', '3' + NB + 'M'],        // le même montant, arrondi vers le haut : seul le solde est arrondi vers le bas
    [1500, '2' + NB + 'k', '2' + NB + 'k'],
    [100.6e6, '101' + NB + 'M', '101' + NB + 'M'],
    [2e9, '2' + NB + 'Md', '2' + NB + 'B'],
  ];
  for (const [lang, column] of [['fr', 1], ['en', 2]]) {
    setLang(lang);
    for (const row of balances) assert.equal(fmtBalance(row[0]), row[column], `${lang} : solde ${row[0]}`);
    for (const row of prices) assert.equal(fmt(row[0]), row[column], `${lang} : prix ${row[0]}`);
  }
});

test('format : on passe à l’unité suivante quand l’arrondi atteint 1000, jamais « 1000 k »', () => {
  const { fmt, fmtBalance, setLang, NB } = app();
  setLang('fr');
  assert.equal(fmt(999500), '1' + NB + 'M');
  assert.equal(fmt(999960000), '1' + NB + 'Md');
  assert.equal(fmt(999499), '999' + NB + 'k');
  assert.equal(fmt(999499999), '999' + NB + 'M');
  assert.equal(fmt(999500000), '1' + NB + 'Md');
  assert.equal(fmt(1000000), '1' + NB + 'M');
  setLang('en');
  assert.equal(fmt(999960000), '1' + NB + 'B');
  // Le solde arrondi vers le bas n'atteint jamais 1000 : il garde l'unité d'en dessous jusqu'à l'unité suivante pleine.
  assert.equal(fmtBalance(999999), '999' + NB + 'k');
  assert.equal(fmtBalance(1e6), '1' + NB + 'M');
  assert.equal(fmtBalance(999999999), '999' + NB + 'M');
  assert.equal(fmtBalance(1e9), '1' + NB + 'B');
  assert.equal(fmtBalance(2999999999), '2.9' + NB + 'B');
  setLang('fr');
  assert.equal(fmtBalance(2999999999), '2,9' + NB + 'Md');
  assert.deepEqual([0, -0, NaN, Infinity, undefined].map(n => fmtBalance(n)), ['0', '0', '0', '0', '0']);
});

// Relit ce que montre un montant (« 2,9 M » → 2 900 000) pour le comparer à ce qu'on a.
function read(text, NB) {
  const [number, unit] = text.split(NB), factor = { k: 1e3, M: 1e6, Md: 1e9, B: 1e9 }[unit] || 1;
  return Math.round(Number(number.replace(',', '.')) * 10) * factor / 10;
}
// Le pas de l'affichage : 1, 1 k, 0,1 M puis 1 M (dès 100 M), 0,1 Md puis 1 Md (dès 100 Md).
const stepAt = n => (n < 1e3 ? 1 : n < 1e6 ? 1e3 : n < 1e8 ? 1e5 : n < 1e9 ? 1e6 : n < 1e11 ? 1e8 : 1e9);
test('format : sur toutes les valeurs, le solde ne montre jamais plus que ce qu’on a et aucun montant n’écrit 1000', () => {
  const { fmt, fmtBalance, setLang, NB } = app();
  const samples = new Set();
  for (let n = 0; n <= 3000; n++) samples.add(n);
  for (let x = 1; x < 1e13; x *= 1.0137) samples.add(Math.round(x));
  // Autour de chaque frontière : juste avant, sur, et juste après.
  for (const unit of [1, 1e3, 1e6, 1e9]) {
    for (const k of [1, 9.95, 10, 99, 99.5, 99.95, 100, 100.5, 999, 999.5, 999.9, 999.95, 999.99, 1000]) {
      for (const shift of [-1, 0, 1]) samples.add(Math.max(0, Math.round(k * unit) + shift));
    }
  }
  // Les valeurs exactes restent exactes : 2,3 M ne devient pas 2,2 M par un arrondi de division.
  setLang('fr');
  for (let tenths = 10; tenths < 1000; tenths++) {
    const text = Math.floor(tenths / 10) + (tenths % 10 ? ',' + (tenths % 10) : '') + NB;
    assert.equal(fmtBalance(tenths * 1e5), text + 'M');
    assert.equal(fmtBalance(tenths * 1e8), text + 'Md');
  }
  for (let whole = 100; whole < 1000; whole++) {
    assert.equal(fmtBalance(whole * 1e6), whole + NB + 'M');
    assert.equal(fmtBalance(whole * 1e9), whole + NB + 'Md');
  }
  for (const lang of ['fr', 'en']) {
    setLang(lang);
    for (const n of samples) {
      const balance = fmtBalance(n), price = fmt(n);
      assert.ok(read(balance, NB) <= n, `${lang} : le solde ${n} montre ${balance}`);
      assert.ok(n - read(balance, NB) < stepAt(n), `${lang} : le solde ${n} montre ${balance}, trop bas`);
      assert.ok(Math.abs(read(price, NB) - n) <= stepAt(n) / 2, `${lang} : le prix ${n} montre ${price}`);
      // Le milliard est la plus grande unité : à partir de 999,5 Md, il n'y a plus d'unité suivante où passer.
      if (n < 999.5e9) for (const text of [balance, price]) assert.doesNotMatch(text, /\d{4}/, `${lang} : ${n} montre ${text}`);
    }
  }
});
