const assert = require('node:assert/strict');

// Ville préparée une seule fois : un rechargement garde ce qui a changé.
async function newTown(browser, baseURL, seed, options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Zurich', ...options });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (seed) await page.addInitScript(state => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('ville-bien-etre/v2', JSON.stringify(state));
  }, seed);
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__ville);
  return { context, page, errors };
}
const town = (byCat, tiles = [], extra = {}) => ({ v: 2, coins: 3e9, settings: { lang: 'fr' }, stats: { ok: 1, byCat, days: { '2026-10-16': 10 } },
  city: { size: 7, tiles }, clock: { tz: 'Europe/Zurich', maxSeen: 0, lastDay: '2026-10-16' }, ...extra });
async function openTile(page, name) {
  if (!(await page.locator('.city-list').evaluate(el => el.open))) await page.locator('.city-list summary').click();
  await page.locator('#cityList').getByRole('button', { name: new RegExp('^' + name) }).click();
}

async function runContent(browser, baseURL) {
  const scenarios = [];
  // Merveille : commencer le chantier, construire une étape au seuil, sans bouton Démolir.
  {
    const { context, page, errors } = await newTown(browser, baseURL, town({ calme: 1500 }));
    try {
      await page.locator('#buildBtn').click();
      await page.getByRole('button', { name: /^Commencer le chantier : Grand Arbre/ }).click();
      await page.locator('#city').press('Enter'); await page.locator('#placeConfirm').click();
      await openTile(page, 'Grand Arbre');
      assert.match(await page.locator('#sheetBody').innerText(), /Étape 1 sur 4/);
      const build = page.getByRole('button', { name: /^Construire l'étape/ });
      assert.equal(await build.isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: 'Démolir', exact: true }).count(), 0);
      await page.locator('#sheetClose').click();
      await page.evaluate(() => { __ville.state.stats.byCat.calme = 1800; });
      await openTile(page, 'Grand Arbre');
      await build.click();
      assert.deepEqual(await page.evaluate(() => { const w = __ville.state.city.tiles.find(t => t.item === 'grandarbre'); return [w.stage, __ville.state.coins]; }), [2, 3e9 - 200e6 - 250e6]);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
    scenarios.push('Merveille : chantier et étape au seuil');
  }
  // Ensemble : la troisième pièce posée forme le Coin lecture ; le déplacer ensuite ne retire pas la découverte.
  {
    const { context, page, errors } = await newTown(browser, baseURL, town({ esprit: 5 }, [
      { id: 'b', item: 'bibliotheque', x: 2, y: 3, at: 1.8e12, paid: 10e6 }, { id: 'c', item: 'banc', x: 4, y: 3, at: 1.8e12, paid: 2e6 }]));
    try {
      await page.locator('#buildBtn').click();
      await page.getByRole('button', { name: /^Placer Arbre pour/ }).click();
      await page.locator('#city').press('Enter'); await page.locator('#placeConfirm').click();    // case (3, 3), entre les deux
      await page.waitForFunction(() => !!__ville.state.sets['coin-lecture']);
      assert.match(await page.locator('#toast').innerText(), /Nouvel ensemble\s:\sCoin lecture/);
      await openTile(page, 'Banc');
      await page.getByRole('button', { name: /Déplacer/ }).click();
      for (const key of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowDown']) await page.locator('#city').press(key);
      await page.locator('#city').press('Enter'); await page.locator('#placeConfirm').click();
      assert.equal(await page.evaluate(() => !!__ville.state.sets['coin-lecture']), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
    scenarios.push('Ensemble : découverte à la pose, gardée après un déplacement');
  }
  return { scenarios };
}
module.exports = { runContent, newTown, town, openTile };
