const assert = require('node:assert/strict');
const { town } = require('./content-browser.cjs');

// Ville ouverte à un instant fixé avant le chargement : son horloge part de là (elle garde l'heure la plus avancée).
async function cityAt(browser, baseURL, seed, time, options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Zurich', ...options });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (time) await page.clock.setFixedTime(new Date(time));
  if (seed) await page.addInitScript(state => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('ville-bien-etre/v2', JSON.stringify(state));
  }, seed);
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__ville);
  return { context, page, errors };
}
const skyTop = page => page.evaluate(() => getComputedStyle(document.querySelector('#sky')).getPropertyValue('--sky-top').trim());
const luma = hex => { const n = parseInt(hex.slice(1), 16); return (.2126 * (n >> 16) + .7152 * (n >> 8 & 255) + .0722 * (n & 255)) / 255; };

async function runAmbient(browser, baseURL) {
  const scenarios = [];
  // Ciel selon l'heure : nuit à 22 h, journée à midi (Zurich, 1er juillet) ; « Selon l'apparence » rend le ciel du thème.
  {
    const night = await cityAt(browser, baseURL, town({ esprit: 5 }), '2026-07-01T20:00:00Z');
    try {
      const top = await skyTop(night.page);
      assert.ok(top && luma(top) < .2, 'ciel de nuit : ' + top);
      await night.page.evaluate(() => { __ville.state.settings.sky = 'theme'; __ville.City.draw(); });
      assert.equal(await skyTop(night.page), '#d3e8e0');
      assert.deepEqual(night.errors, []);
    } finally { await night.context.close(); }
    const noon = await cityAt(browser, baseURL, town({ esprit: 5 }), '2026-07-01T10:00:00Z');
    try {
      const top = await skyTop(noon.page);
      assert.ok(top && luma(top) > .6, 'ciel de midi : ' + top);
      assert.deepEqual(noon.errors, []);
    } finally { await noon.context.close(); }
    scenarios.push("Ciel selon l'heure");
  }
  // Boucle sobre : environ 12 images par seconde, seulement quand on regarde la ville.
  {
    const tiles = Array.from({ length: 9 }, (_, i) => ({ id: 'b' + i, item: 'maison', x: i % 7, y: Math.floor(i / 7), at: 1.79e12, paid: 5e6 }));
    const { context, page, errors } = await cityAt(browser, baseURL, town({ esprit: 5 }, tiles), null);
    try {
      const frames = () => page.evaluate(() => __ville.City.frames());
      const during = async ms => { const before = await frames(); await page.waitForTimeout(ms); return (await frames()) - before; };
      const still = async label => { await page.waitForTimeout(200); assert.equal(await during(500), 0, label); };
      const shown = await during(1000);
      assert.ok(shown >= 6 && shown <= 20, `${shown} images en 1 s`);
      await page.locator('#buildBtn').click();
      await still('fenêtre ouverte');
      await page.locator('#sheetClose').click();
      assert.ok(await during(600) > 0, 'reprise après la fenêtre');
      await page.locator('[data-tab="journal"]').click();
      await still('onglet Journal');
      await page.locator('[data-tab="ville"]').click();
      assert.ok(await during(600) > 0, 'reprise sur la Ville');
      const visibility = state => page.evaluate(value => {
        Object.defineProperty(document, 'visibilityState', { value, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      }, state);
      await visibility('hidden');
      await still('arrière-plan');
      await visibility('visible');
      assert.ok(await during(600) > 0, 'retour au premier plan');
      // La ville sortie de l'écran en faisant défiler la vue.
      await page.setViewportSize({ width: 390, height: 420 });
      await page.locator('.city-list summary').click();
      await page.evaluate(() => { const main = document.querySelector('#main'); main.scrollTop = main.scrollHeight; });
      assert.equal(await page.evaluate(() => document.querySelector('#city').getBoundingClientRect().bottom <= 0), true, 'ville encore visible');
      await still("ville hors de l'écran");
      await page.evaluate(() => { document.querySelector('#main').scrollTop = 0; });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(await during(600) > 0, "ville revenue à l'écran");
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await still('animations réduites');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.evaluate(() => __ville.City.wake());
      assert.ok(await during(600) > 0, 'animations permises de nouveau');
      await page.evaluate(() => { __ville.state.settings.ambient = false; __ville.City.wake(); });
      await page.waitForTimeout(200);
      assert.equal(await during(1000), 0, 'ville animée coupée');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
    scenarios.push('Boucle sobre');
  }
  // Habitants : trois promeneurs pour neuf éléments à midi, et un lecteur parce qu'on a pratiqué l'Esprit aujourd'hui.
  {
    const tiles = Array.from({ length: 9 }, (_, i) => ({ id: 'b' + i, item: 'maison', x: i % 7, y: Math.floor(i / 7), at: 1.79e12, paid: 5e6 }));
    const seed = town({ esprit: 15 }, tiles, { stats: { ok: 1, byCat: { esprit: 15 }, days: { '2026-11-02': 15 }, dailyCats: { '2026-11-02': { esprit: 15 } } } });
    const { context, page, errors } = await cityAt(browser, baseURL, seed, '2026-11-02T11:00:00Z');
    try {
      assert.deepEqual(await page.evaluate(() => __ville.City.walkers()), { walkers: 3, doers: ['esprit'] });
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
    scenarios.push('Habitants');
  }
  return { scenarios };
}

module.exports = { runAmbient, cityAt, luma };
