const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Signe une sauvegarde VBE2 comme l'app (00-core.js) : corps en base64, puis empreinte salée.
function signBackup(state) {
  const context = vm.createContext({ TextEncoder, TextDecoder, btoa, atob, Math, JSON });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', '00-core.js'), 'utf8')
    + '\nthis.sign = s => { const body = b64encode(JSON.stringify(s)); return "VBE2." + body + "." + hash53(BACKUP_SALT + body); };', context);
  return context.sign(state);
}

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
// Les bilans de la semaine et du mois sont marqués comme vus : ils ne s'ouvrent d'eux-mêmes que si un test les demande (rituals).
const town = (byCat, tiles = [], extra = {}) => ({ v: 2, coins: 3e9, settings: { lang: 'fr' }, stats: { ok: 1, byCat, days: { '2026-10-16': 10 } },
  city: { size: 7, tiles }, clock: { tz: 'Europe/Zurich', maxSeen: 0, lastDay: '2026-10-16' }, rituals: { week: '9999-12-31', month: '9999-12', year: '9999' }, ...extra });
// Espions installés avant le chargement : oscillateurs créés, valeurs réglées (fréquences, volumes) et vibrations.
function audioSpies() {
  window.__audio = { oscillators: 0, values: [] };
  window.__vibrations = [];
  const AC = window.AudioContext || window.webkitAudioContext;
  const create = AC.prototype.createOscillator;
  AC.prototype.createOscillator = function () { window.__audio.oscillators++; return create.call(this); };
  const set = AudioParam.prototype.setValueAtTime;
  AudioParam.prototype.setValueAtTime = function (value, time) { window.__audio.values.push(value); return set.call(this, value, time); };
  Navigator.prototype.vibrate = function (pattern) { window.__vibrations.push(pattern); return true; };
}
async function placeFromShop(page, name, moves = []) {
  await page.locator('#buildBtn').click();
  await page.getByRole('button', { name: new RegExp('^Placer ' + name + ' pour') }).click();
  for (const key of moves) await page.locator('#city').press(key);
  await page.locator('#city').press('Enter');
  await page.locator('#placeConfirm').click();
}
async function openTile(page, name) {
  if (!(await page.locator('.city-list').evaluate(el => el.open))) await page.locator('.city-list summary').click();
  await page.locator('#cityList').getByRole('button', { name: new RegExp('^' + name) }).click();
}

async function runContent(browser, baseURL) {
  const scenarios = [];
  // Merveille choisie comme objectif : commencer le chantier, construire une étape au seuil, sans bouton Démolir, puis inaugurer.
  {
    const goals = { minutes: 60, days: 3, cat: 'all', building: 'grandarbre' };
    const { context, page, errors } = await newTown(browser, baseURL, town({ calme: 1500 }, [], { goals }));
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
      // Le chantier commencé, l'objectif devient son étape suivante, dans la Ville comme dans le Journal.
      assert.match(await page.locator('#nextCard').innerText(), /Prochaine étape du Grand Arbre/);
      await page.locator('[data-tab="journal"]').click();
      assert.match(await page.locator('#goalsCard').innerText(), /Grand Arbre\s·\sétape\s2\ssur\s4/);
      await page.locator('[data-tab="ville"]').click();
      await page.evaluate(() => { __ville.state.stats.byCat.calme = 1800; });
      await openTile(page, 'Grand Arbre');
      await build.click();
      assert.deepEqual(await page.evaluate(() => { const w = __ville.state.city.tiles.find(t => t.item === 'grandarbre'); return [w.stage, __ville.state.coins]; }), [2, 3e9 - 200e6 - 250e6]);
      // Inauguration : la quatrième étape lance les confettis, fête le succès et la boutique la dit inaugurée.
      await page.evaluate(() => { __ville.state.stats.byCat.calme = 2400; });
      for (let i = 0; i < 2; i++) { await openTile(page, 'Grand Arbre'); await build.click(); }
      assert.ok(await page.evaluate(() => __ville.City.effectCount()) > 0);
      assert.match(await page.locator('#toast').innerText(), /Grand Arbre est inauguré\s!.*Succès\s:\sPremière merveille/);
      assert.equal(await page.evaluate(() => !!__ville.state.achievements['premiere-merveille']), true);
      await page.locator('[data-tab="journal"]').click();
      assert.match(await page.locator('#goalsCard').innerText(), /Grand Arbre\s·\sinauguré/);
      await page.locator('[data-tab="ville"]').click();
      await page.locator('#buildBtn').click();
      const card = page.locator('.shop-item.wonder', { hasText: 'Grand Arbre' });
      assert.match(await card.innerText(), /Inauguré/);
      assert.equal(await card.getByRole('button', { name: /Continuer/ }).count(), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
    scenarios.push('Merveille : objectif, chantier, étape au seuil et inauguration');
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
  // Carnet : compteurs et repère Nouveau dans le Journal, trois onglets, rien ne déborde à 320 px.
  {
    const past = Date.parse('2025-10-10T12:00:00Z');
    const seed = town({ esprit: 5 }, [], { achievements: { 'premier-pas': past, hameau: past }, sets: { cocon: past } });
    const { context, page, errors } = await newTown(browser, baseURL, seed, { viewport: { width: 320, height: 640 } });
    try {
      await page.locator('[data-tab="journal"]').click();
      const card = page.locator('#carnetCard');
      const text = await card.innerText();
      assert.match(text, /Nouveau/);
      // Le rattrapage au démarrage ajoute « Bon voisinage » : la ville a déjà un ensemble.
      const have = await page.evaluate(() => Object.keys(__ville.state.achievements).length);
      assert.equal(have, 3);
      assert.match(text, /3 sur 42/);
      assert.match(text, /1 sur 12/);
      await card.getByRole('button', { name: 'Ouvrir le carnet', exact: true }).click();
      const body = page.locator('#sheetBody');
      const names = await body.locator('.carnet-row strong').allInnerTexts();
      assert.ok(names.indexOf('Premier pas') >= 0 && names.indexOf('Premier pas') < names.indexOf('Lève-tôt'), names.slice(0, 4).join(' | '));
      // Une vignette, une seule zone de dessin : les silhouettes n'en créent pas d'autres.
      await page.evaluate(() => {
        window.__canvases = 0;
        const make = document.createElement.bind(document);
        document.createElement = (tag, ...rest) => { if (String(tag).toLowerCase() === 'canvas') window.__canvases++; return make(tag, ...rest); };
      });
      await body.getByRole('radio', { name: 'Collection', exact: true }).click();
      assert.equal(await body.locator('.carnet-cell').count(), 50);
      assert.equal(await page.evaluate(() => window.__canvases), 50);
      await body.getByRole('radio', { name: 'Ensembles', exact: true }).click();
      const sets = await body.locator('.carnet-row strong').allInnerTexts();
      assert.equal(sets[0], 'Cocon');
      assert.equal(sets.filter(name => name === 'Ensemble à découvrir').length, 11);
      for (const tab of ['Succès', 'Collection', 'Ensembles', 'Visites']) {
        await body.getByRole('radio', { name: tab, exact: true }).click();
        const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, inner: innerWidth, body: document.querySelector('#sheetBody').scrollWidth, client: document.querySelector('#sheetBody').clientWidth }));
        assert.ok(w.doc <= w.inner && w.body <= w.client + 1, `le carnet déborde à 320 px (${tab})`);
      }
      await page.locator('#sheetClose').click();
      assert.doesNotMatch(await card.innerText(), /Nouveau/);
      // « Tout recommencer » efface aussi le carnet.
      await page.locator('#settingsBtn').click();
      await page.getByRole('button', { name: 'Tout recommencer', exact: true }).click();
      await page.getByRole('button', { name: /^Confirmer\s:\stout effacer/ }).click();
      await page.waitForFunction(() => !Object.keys(__ville.state.achievements).length && !Object.keys(__ville.state.sets).length);
      assert.match(await card.innerText(), /0\ssur\s42/);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
    scenarios.push('Carnet : compteurs, onglets et repère Nouveau');
  }
  // Bilan de session : les succès obtenus et leur cadeau, sans déblocage en double.
  {
    const { context, page, errors } = await newTown(browser, baseURL, null);
    try {
      await page.clock.install();
      await page.locator('[data-tab="activites"]').click();
      await page.getByRole('button', { name: /^Méditation/ }).first().click();
      await page.getByRole('radio', { name: '5 min', exact: true }).click();
      await page.getByRole('radio', { name: 'Activité libre', exact: true }).click();
      await page.getByRole('button', { name: /^Commencer/ }).click();
      const warning = page.getByRole('button', { name: "C'est réglé, commencer", exact: true });
      if (await warning.isVisible()) await warning.click();
      await page.waitForFunction(() => window.__ville.activeState() === 'mine');
      await page.clock.fastForward(301000);
      await page.waitForFunction(() => __ville.state.stats.ok === 1);
      const result = await page.locator('#sessResult').innerText();
      assert.match(result, /Succès\s:\sPremier pas/);
      assert.match(result, /Succès\s:\sPetit à petit/);
      assert.match(result, /Cadeau\s:\sPas japonais/);
      assert.doesNotMatch(result, /débloqué\s:\sPas japonais/);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
    scenarios.push('Bilan : succès et cadeau');
  }
  // Pose du dixième élément : le message de fête propose d'ouvrir le carnet.
  {
    const nine = Array.from({ length: 9 }, (_, i) => ({ id: 'c' + i, item: 'chemin', x: i % 7, y: i < 7 ? 0 : 1, at: 1.75e12, paid: 5e5 }));
    const { context, page, errors } = await newTown(browser, baseURL, town({ esprit: 5 }, nine));
    try {
      await page.locator('#buildBtn').click();
      await page.getByRole('button', { name: /^Placer Arbre pour/ }).click();
      await page.locator('#city').press('Enter'); await page.locator('#placeConfirm').click();
      await page.waitForFunction(() => !!__ville.state.achievements.hameau);
      assert.match(await page.locator('#toast').innerText(), /Succès\s:\sHameau/);
      assert.equal(await page.locator('#toast').getByRole('button', { name: 'Ouvrir le carnet', exact: true }).count(), 1);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
    scenarios.push('Pose : succès Hameau');
  }
  // Deux succès d'un coup : un message court, et le nom de chacun pour les lecteurs d'écran.
  {
    const nine = Array.from({ length: 9 }, (_, i) => ({ id: 't' + i, item: 'arbre', x: i % 7, y: i < 7 ? 0 : 1, at: 1.75e12, paid: 2e6 }));
    const { context, page, errors } = await newTown(browser, baseURL, town({ esprit: 5 }, nine));
    try {
      await placeFromShop(page, 'Arbre');
      await page.waitForFunction(() => !!__ville.state.achievements['main-verte']);
      assert.match(await page.locator('#toast').innerText(), /2\snouveaux\ssuccès/);
      await page.waitForFunction(() => /Hameau.*Main verte/.test(document.querySelector('#live').textContent));
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
    scenarios.push('Pose : deux succès, chaque nom annoncé');
  }
  // Ville d'avant la mise à jour : un seul message de rattrapage, puis plus rien au rechargement.
  {
    const lecture = [['bibliotheque', 2, 2], ['banc', 3, 2], ['arbre', 2, 3]].map(([item, x, y], i) => ({ id: 'l' + i, item, x, y, at: 1.75e12, paid: 2e6 }));
    const seed = { v: 2, coins: 5e7, settings: { lang: 'fr' }, stats: { ok: 3, byCat: { esprit: 70 }, days: { '2026-10-01': 30, '2026-10-02': 40 } },
      city: { size: 7, tiles: lecture }, clock: { tz: 'Europe/Zurich', maxSeen: 0, lastDay: '2026-10-02' } };
    const { context, page, errors } = await newTown(browser, baseURL, seed);
    try {
      const message = await page.locator('#toast').innerText();
      const n = Number((message.match(/a déjà (\d+) succès/) || [])[1]);
      assert.ok(n > 0, message);
      assert.equal(await page.evaluate(() => Object.keys(__ville.state.achievements).length), n);
      assert.equal(await page.evaluate(() => !!__ville.state.sets['coin-lecture']), true);
      await page.reload();
      await page.waitForFunction(() => !!window.__ville);
      assert.equal(await page.locator('#toast').isHidden(), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
    scenarios.push('Ville existante : un seul message de rattrapage');
  }
  // Restauration d'une sauvegarde d'avant la mise à jour : ses succès sont recalculés.
  {
    const old = { v: 2, coins: 4e7, settings: { lang: 'fr' }, stats: { ok: 2, byCat: { calme: 80 }, days: { '2026-10-05': 40, '2026-10-06': 40 } },
      city: { size: 7, tiles: [] }, clock: { tz: 'Europe/Zurich', maxSeen: 0, lastDay: '2026-10-06' } };
    const { context, page, errors } = await newTown(browser, baseURL, null);
    try {
      await page.locator('[data-tab="journal"]').click();
      await page.locator('#settingsBtn').click();
      await page.locator('#importArea').fill(signBackup(old));
      await page.getByRole('button', { name: 'Vérifier la sauvegarde', exact: true }).click();
      await page.getByRole('button', { name: 'Remplacer ma ville par cette sauvegarde', exact: true }).click();
      await page.getByRole('button', { name: 'Confirmer le remplacement', exact: true }).click();
      await page.waitForFunction(() => __ville.state.stats.ok === 2);
      assert.match(await page.locator('#toast').innerText(), /a déjà \d+ succès/);
      assert.equal(await page.evaluate(() => !!__ville.state.achievements['grand-calme']), true);
      // Restaurée depuis le Journal : la carte Carnet compte déjà les succès recalculés.
      const have = await page.evaluate(() => Object.keys(__ville.state.achievements).length);
      assert.match(await page.locator('#carnetCard').innerText(), new RegExp(have + '\\ssur\\s42'));
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
    scenarios.push('Restauration : succès recalculés');
  }
  // Boutique : raccourcis, prochain élément dévoilé, silhouettes, décor offert.
  {
    const { context, page, errors } = await newTown(browser, baseURL, null);
    try {
      await page.locator('#buildBtn').click();
      const nav = page.getByRole('navigation', { name: 'Rubriques' });
      assert.equal(await nav.getByRole('button').count(), 7);
      await nav.getByRole('button', { name: 'Prestige', exact: true }).click();
      await page.waitForFunction(() => { const r = document.querySelector('#shop-prestige').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; });
      const decor = page.locator('#shop-decor');
      assert.equal(await decor.getByRole('button', { name: /^Placer .+ pour / }).count(), 6);
      assert.match(await decor.innerText(), /Haie/);
      assert.equal(await decor.locator('.shop-item.hidden').count(), 9);
      assert.match(await decor.innerText(), /Récompense du succès «\sLève-tôt\s»/);
      await page.locator('#sheetClose').click();
      await page.evaluate(() => { __ville.state.achievements['leve-tot'] = Date.now(); });
      await page.locator('#buildBtn').click();
      const free = page.getByRole('button', { name: 'Placer Cadran solaire, offert', exact: true });
      assert.equal(await free.innerText(), 'Offert');
      const coins = await page.evaluate(() => __ville.state.coins);
      await free.click();
      for (let i = 0; i < 3; i++) await page.locator('#city').press('ArrowLeft');      // case (0, 3), libre dans une ville neuve
      await page.locator('#city').press('Enter'); await page.locator('#placeConfirm').click();
      await page.waitForFunction(() => __ville.state.city.tiles.some(t => t.item === 'cadran'));
      assert.equal(await page.evaluate(() => __ville.state.coins), coins);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
    scenarios.push('Boutique : raccourcis, silhouettes et décor offert');
  }
  // Pose vivante : chantier animé, son et vibration ; la note monte quand on enchaîne ; rien ne sonne son coupé.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Zurich' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.addInitScript(audioSpies);
      await page.addInitScript(state => {
        if (sessionStorage.getItem('seeded')) return;
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('ville-bien-etre/v2', JSON.stringify(state));
      }, town({ esprit: 5 }));
      await page.goto(baseURL);
      await page.waitForFunction(() => !!window.__ville);
      const highest = () => page.evaluate(() => Math.max(...window.__audio.values.filter(v => v > 20)));
      await placeFromShop(page, 'Arbre');
      assert.ok(await page.evaluate(() => __ville.City.effectCount()) > 0, 'aucun effet de chantier');
      assert.ok(await page.evaluate(() => window.__audio.oscillators) > 0, 'aucun son de pose');
      assert.deepEqual(await page.evaluate(() => window.__vibrations), [15]);
      const first = await highest();
      await page.waitForTimeout(1300);
      assert.equal(await page.evaluate(() => __ville.City.effectCount()), 0);
      await page.evaluate(() => { window.__audio.values = []; });
      await placeFromShop(page, 'Arbre', ['ArrowRight']);
      assert.ok(await highest() > first, 'la deuxième note ne monte pas');
      await page.evaluate(() => { __ville.state.settings.sound = false; window.__audio.oscillators = 0; });
      await placeFromShop(page, 'Arbre', ['ArrowRight']);
      assert.equal(await page.evaluate(() => window.__audio.oscillators), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  // Animations réduites : la pose ne lance aucun effet.
  {
    const { context, page, errors } = await newTown(browser, baseURL, town({ esprit: 5 }), { reducedMotion: 'reduce' });
    try {
      await placeFromShop(page, 'Arbre');
      assert.equal(await page.evaluate(() => __ville.City.effectCount()), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
    scenarios.push('Pose vivante : chantier, son, note qui monte, animations réduites');
  }
  return { scenarios };
}
module.exports = { runContent, newTown, town, openTile, signBackup };
