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
  // Visiteur : on le touche, sa fiche s'ouvre, son cadeau se reçoit une fois ; la liste de la ville le cite.
  {
    const tiles = [{ id: 'b', item: 'banc', x: 2, y: 2, at: 1.79e12, paid: 2e6 }];
    const { context, page, errors } = await cityAt(browser, baseURL, town({ esprit: 5 }, tiles), null);
    try {
      await page.evaluate(() => __ville.ambient.force({ visitor: { id: 'chat', spot: { x: 2, y: 2, on: 'banc' } } }));
      const box = await page.evaluate(() => __ville.City.visitorBox());
      assert.ok(box, 'le visiteur a une zone touchable');
      const city = await page.locator('#city').boundingBox();
      const coins = await page.evaluate(() => __ville.state.coins);
      await page.mouse.click(city.x + box.x + box.w / 2, city.y + box.y + box.h / 2);
      await page.locator('#sheet').waitFor();
      assert.equal(await page.locator('#sheetTitle').innerText(), 'Le chat voyageur');
      const gift = page.locator('#sheetBody').getByRole('button', { name: /^Recevoir\s2\sM/ });
      await gift.click();
      assert.equal(await page.evaluate(() => __ville.state.coins), coins + 2e6);
      await page.mouse.click(city.x + box.x + box.w / 2, city.y + box.y + box.h / 2);
      await page.locator('#sheet').waitFor();
      assert.equal(await page.locator('#sheetBody').getByRole('button', { name: /^Recevoir/ }).count(), 0);
      await page.locator('#sheetClose').click();
      if (!(await page.locator('.city-list').evaluate(el => el.open))) await page.locator('.city-list summary').click();
      assert.match(await page.locator('#cityList li').first().innerText(), /^Visiteur du jour\s:\sle chat voyageur/);
      assert.equal(await page.evaluate(() => __ville.state.visits.chat.count), 1);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
    scenarios.push('Visiteur');
  }
  // Fête : le jour de la Fête du printemps, un message et 5 M à la première ouverture, puis plus rien au rechargement.
  {
    const seed = town({ esprit: 5 }, [], { createdAt: Date.parse('2026-05-04T10:00:00Z'), coins: 1e8 });
    const { context, page, errors } = await cityAt(browser, baseURL, seed, '2027-03-21T10:00:00Z');
    try {
      await page.waitForFunction(() => /Bonne Fête du printemps/.test(document.querySelector('#toast').textContent));
      assert.equal(await page.evaluate(() => __ville.state.coins), 1e8 + 5e6);
      await page.reload();
      await page.waitForFunction(() => !!window.__ville);
      await page.waitForTimeout(300);
      assert.doesNotMatch(await page.locator('#toast').textContent(), /Fête du printemps/);
      assert.equal(await page.evaluate(() => __ville.state.coins), 1e8 + 5e6);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
    scenarios.push('Fête');
  }
  // Carnet des visites : quatre onglets, douze visiteurs dont onze à découvrir, six fêtes, rien ne déborde à 320 px ;
  // la carte du Journal compte les visites et la légende de la ville commence par le moment.
  {
    const met = Date.parse('2026-06-20T09:00:00Z');
    const seed = town({ esprit: 5 }, [], { createdAt: Date.parse('2026-05-04T10:00:00Z'), visits: { chat: { first: met, count: 3, last: '2026-06-28' } }, gifts: { 'fest:ete:2026': met } });
    const { context, page, errors } = await cityAt(browser, baseURL, seed, '2026-07-01T10:00:00Z', { viewport: { width: 320, height: 640 } });
    try {
      assert.match(await page.locator('#cityCaption').innerText(), /^Journée\s·\s/);
      await page.locator('[data-tab="journal"]').click();
      const card = page.locator('#carnetCard');
      assert.match(await card.innerText(), /Visites\s+1\ssur\s12/);
      await card.getByRole('button', { name: 'Ouvrir le carnet', exact: true }).click();
      const body = page.locator('#sheetBody');
      assert.equal(await body.getByRole('radio').count(), 4);
      await body.getByRole('radio', { name: 'Visites', exact: true }).click();
      const visitors = await body.locator('.carnet-visitor strong').allInnerTexts();
      assert.equal(visitors.length, 12);
      assert.equal(visitors[0], 'Le chat voyageur');
      assert.equal(visitors.filter(name => name === 'Visiteur à découvrir').length, 11);
      assert.match(await body.locator('.carnet-visitor').first().innerText(), /3\srencontres/);
      const fests = await body.locator('.carnet-fest').allInnerTexts();
      assert.equal(fests.length, 6);
      assert.match(fests.find(text => /Fête de l'été/.test(text)), /2026/);
      assert.match(fests.find(text => /Nouvel An/.test(text)), /Revient le/);
      const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, inner: innerWidth, body: document.querySelector('#sheetBody').scrollWidth, client: document.querySelector('#sheetBody').clientWidth }));
      assert.ok(w.doc <= w.inner && w.body <= w.client + 1, 'le carnet déborde à 320 px (Visites)');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
    scenarios.push('Carnet des visites');
  }
  // Réglages de la ville vivante : ciel selon l'apparence, hémisphère sud en juillet, ville animée coupée ;
  // les trois restent après un rechargement, et la section Apparence tient en anglais à 320 px.
  {
    const { context, page, errors } = await cityAt(browser, baseURL, town({ esprit: 5 }), '2026-07-01T10:00:00Z');
    try {
      const settings = async () => { await page.locator('#settingsBtn').click(); await page.locator('#settingsTheme').waitFor(); return page.locator('#settingsTheme'); };
      let block = await settings();
      await block.getByRole('radio', { name: "Selon l'apparence", exact: true }).click();
      assert.equal(await page.evaluate(() => document.querySelector('#sky').style.getPropertyValue('--sky-top')), '');
      await block.getByRole('radio', { name: 'Hémisphère sud', exact: true }).click();
      assert.equal(await page.evaluate(() => __ville.ambient.at().season), 'winter');
      await block.getByRole('switch', { name: 'Ville animée', exact: true }).click();
      assert.equal(await block.getByRole('switch', { name: 'Ville animée', exact: true }).getAttribute('aria-checked'), 'false');
      await page.locator('#sheetClose').click();
      const before = await page.evaluate(() => __ville.City.frames());
      await page.waitForTimeout(700);
      assert.equal(await page.evaluate(() => __ville.City.frames()), before, 'la ville bouge encore');
      await page.reload();
      await page.waitForFunction(() => !!window.__ville);
      assert.deepEqual(await page.evaluate(() => [__ville.state.settings.sky, __ville.state.settings.hemisphere, __ville.state.settings.ambient]), ['theme', 'south', false]);
      block = await settings();
      for (const name of ["Selon l'apparence", 'Hémisphère sud']) assert.equal(await block.getByRole('radio', { name, exact: true }).getAttribute('aria-checked'), 'true');
      await page.locator('#settingsLang').getByRole('radio', { name: 'English', exact: true }).click();
      await page.setViewportSize({ width: 320, height: 640 });
      await page.locator('#sheetClose').click();
      block = await settings();
      await block.getByRole('radio', { name: 'Match appearance', exact: true }).waitFor();
      await block.scrollIntoViewIfNeeded();
      const w = await page.evaluate(() => ({ body: document.querySelector('#sheetBody').scrollWidth, client: document.querySelector('#sheetBody').clientWidth, doc: document.documentElement.scrollWidth, inner: innerWidth }));
      assert.ok(w.body <= w.client + 1 && w.doc <= w.inner, `la section Apparence déborde à 320 px : ${JSON.stringify(w)}`);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
    scenarios.push('Réglages de la ville vivante');
  }
  return { scenarios };
}

module.exports = { runAmbient, cityAt, luma };
