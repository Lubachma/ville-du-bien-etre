const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/app.cjs');

// Joueur de référence : même durée chaque jour, cinq domaines à parts égales, +45 % de bonus.
// Il achète un exemplaire de chaque élément (hors décors offerts) et chaque étape de merveille dès qu'il le peut,
// le moins cher d'abord, et agrandit sa ville quand il reste deux cases libres ou moins.
function simulate(minutesPerDay) {
  const a = loadApp(['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js'], { expose: ['ITEMS', 'EXPAND_PRICE', 'CAT_ORDER', 'lockInfo'] });
  const { ITEMS } = a, keys = Object.keys(ITEMS).filter(k => !ITEMS[k].reward);
  const owned = new Set(), stage = {};
  let coins = 5e6, size = 7, placed = 6, allUnlocked = 0;
  for (let day = 1; day <= 1500; day++) {
    for (const c of a.CAT_ORDER) a.state.stats.byCat[c] += minutesPerDay / 5;
    const total = minutesPerDay * day;
    coins += minutesPerDay * 1e6 * 1.45;
    if (!allUnlocked && keys.every(k => !a.lockInfo(k) && (!ITEMS[k].wonder || ITEMS[k].wonder.every(([need]) => total >= need)))) allUnlocked = day;
    for (;;) {
      const room = size * size - placed, options = [];
      for (const k of keys) {
        const w = ITEMS[k].wonder;
        if (w) { const s = stage[k] || 0; if (w[s] && total >= w[s][0] && (s || room > 0)) options.push({ k, price: w[s][1] }); }
        else if (!owned.has(k) && room > 0 && !a.lockInfo(k)) options.push({ k, price: ITEMS[k].price });
      }
      if (room <= 2 && size < 11) options.push({ expand: true, price: a.EXPAND_PRICE[size + 2] });
      const choice = options.sort((x, y) => x.price - y.price).find(o => o.price <= coins);
      if (!choice) break;
      coins -= choice.price;
      if (choice.expand) size += 2;
      else if (ITEMS[choice.k].wonder) { if (!stage[choice.k]) placed++; stage[choice.k] = (stage[choice.k] || 0) + 1; }
      else { owned.add(choice.k); placed++; }
    }
    if (keys.every(k => (ITEMS[k].wonder ? stage[k] === ITEMS[k].wonder.length : owned.has(k)))) return { allUnlocked, allBuilt: day };
  }
  return { allUnlocked, allBuilt: Infinity };
}

test('rythme : environ un an à 30 min par jour', () => {
  const r = simulate(30);
  assert.ok(r.allUnlocked >= 240 && r.allUnlocked <= 300, JSON.stringify(r));
  assert.ok(r.allBuilt >= 340 && r.allBuilt <= 410, JSON.stringify(r));
});

test('rythme : plus on pratique, plus on avance vite', () => {
  const [slow, ref, fast] = [20, 30, 45].map(simulate);
  assert.ok(slow.allBuilt > ref.allBuilt && ref.allBuilt > fast.allBuilt, JSON.stringify({ slow, ref, fast }));
});
