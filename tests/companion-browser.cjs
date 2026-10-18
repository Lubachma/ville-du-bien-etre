const assert = require('node:assert/strict');
const { town } = require('./content-browser.cjs');
const { cityAt } = require('./ambient-browser.cjs');

// Étape 6, le compagnon : chaque scénario est une fonction à part, qu'on peut lancer seule.
const at = iso => Date.parse(iso);
const NOW = '2026-10-21T10:00:00Z';
const tile = (item, x, y, extra = {}) => ({ id: item + x + y, item, x, y, at: at('2026-10-01T09:00:00Z'), paid: 1e6, ...extra });
// Une ville amorcée à date de création fixe ; « extra » peut y ajouter un compagnon, des séances, des réglages.
const seed = (tiles, extra = {}) => town({ esprit: 5 }, tiles, { createdAt: at('2026-05-04T09:00:00Z'), ...extra });
const SPECIES = ['lapin', 'marmotte', 'ourson'];
const POSES = ['idle', 'walk', 'sleep', 'read', 'stretch', 'meditate', 'water', 'paint', 'cheer'];
const WEAR = ['', 'echarpe', 'bonnet', 'lunettes', 'couronne', 'noeud', 'paille', 'sac', 'casque', 'cape'];

// Dessins : chaque animal, dans chaque geste et avec chaque accessoire (ou aucun), puis son visage seul, tient dans son cadre.
async function paintAll(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, seed([]), NOW);
  try {
    const out = await page.evaluate(([species, poses, wear]) => {
      const bad = [];
      for (const s of species) for (const pose of poses) for (const w of wear) {
        for (const face of [false, true]) {
          if (face && pose !== 'idle') continue;
          const b = __ville.companion.bounds({ species: s, pose, wear: w, face }, 96);
          if (b.empty || b.x0 < 1 || b.y0 < 1 || b.x1 > 95 || b.y1 > 95) bad.push([s, pose, w, face, JSON.stringify(b)].join(' '));
        }
      }
      return bad;
    }, [SPECIES, POSES, WEAR]);
    assert.deepEqual(out, []);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Compagnon : trois animaux, neuf gestes, neuf accessoires, chacun dans son cadre';
}

const SCENARIOS = [paintAll];
async function runCompanion(browser, baseURL) {
  const scenarios = [];
  for (const scenario of SCENARIOS) scenarios.push(await scenario(browser, baseURL));
  return { scenarios };
}

module.exports = { runCompanion, SCENARIOS, seed, tile, NOW };
