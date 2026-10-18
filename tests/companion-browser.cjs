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

async function toEnglish(page) {
  await page.locator('#settingsBtn').click();
  await page.locator('#settingsLang').getByRole('radio', { name: 'English', exact: true }).click();
  await page.locator('#sheetClose').click();
}
// Mesure que rien ne déborde : dans la fenêtre ouverte, ou dans une partie de la page.
const fitsSheet = page => page.evaluate(() => document.querySelector('#sheetBody').scrollWidth <= document.querySelector('#sheetBody').clientWidth + 1
  && document.documentElement.scrollWidth <= innerWidth);
const fitsIn = (page, sel) => page.evaluate(s => document.documentElement.scrollWidth <= innerWidth
  && [...document.querySelectorAll(s + ', ' + s + ' *')].every(el => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= innerWidth + 1), sel);
const toastMatches = (page, re) => page.waitForFunction(source => new RegExp(source).test(document.querySelector('#toast').textContent), re.source, { timeout: 5000 });
const meet = page => page.locator('#companionInvite').getByRole('button').first().click();

// L'invitation : seulement après une séance réussie, contenue à 320 px ; « Pas maintenant » la range pour de bon.
async function inviteAfterFirstSession(browser, baseURL) {
  {
    const { context, page, errors } = await cityAt(browser, baseURL, seed([], { stats: { ok: 0, byCat: {}, days: {} } }), NOW);
    try {
      assert.equal(await page.locator('#companionInvite').isVisible(), false);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  const { context, page, errors } = await cityAt(browser, baseURL, seed([]), NOW, { viewport: { width: 320, height: 640 } });
  try {
    const card = page.locator('#companionInvite');
    await card.waitFor();
    assert.match(await card.innerText(), /Un compagnon pour ta ville[\s\S]*Un petit animal aimerait s'installer dans ta ville et faire tes séances avec toi\./);
    assert.equal(await fitsIn(page, '#companionInvite'), true);
    await toEnglish(page);
    assert.match(await card.innerText(), /A companion for your town/);
    assert.equal(await fitsIn(page, '#companionInvite'), true);
    await card.getByRole('button', { name: 'Not now', exact: true }).click();
    assert.equal(await card.isVisible(), false);
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    assert.equal(await page.locator('#companionInvite').isVisible(), false);
    assert.ok(await page.evaluate(() => __ville.state.companionLater > 0));
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Compagnon : l’invitation après une première séance, et « Pas maintenant » pour de bon';
}

// Le choix : la suggestion suit l'animal tant qu'on n'a rien tapé ; le bouton suit le nom ; l'arrivée est fêtée.
async function adoptDefault(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, seed([]), NOW);
  try {
    await page.locator('#companionInvite').getByRole('button', { name: 'Faire connaissance', exact: true }).click();
    assert.equal(await page.locator('#sheetTitle').innerText(), 'Ton compagnon');
    const name = page.locator('#companionName'), body = page.locator('#sheetBody');
    const pick = label => body.getByRole('radio', { name: label, exact: true }).click();
    assert.equal(await name.inputValue(), 'Pompon');
    await pick('Marmotte');
    assert.equal(await name.inputValue(), 'Noisette');
    assert.equal(await body.getByRole('button', { name: 'Accueillir Noisette', exact: true }).count(), 1);
    await pick('Lapin');
    assert.equal(await name.inputValue(), 'Pompon');
    await name.fill('Lune');
    await pick('Ourson');
    assert.equal(await name.inputValue(), 'Lune');
    await body.getByRole('button', { name: 'Accueillir Lune', exact: true }).click();
    await toastMatches(page, /Bienvenue à Lune/);
    const c = await page.evaluate(() => __ville.companion.state());
    assert.deepEqual({ ...c, since: c.since > 0 }, { species: 'ourson', name: 'Lune', minutes: 0, wear: '', since: true });
    assert.deepEqual([await page.locator('#companionInvite').isVisible(), await page.locator('#sheet').isVisible()], [false, false]);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Compagnon : choisir un animal et un nom, puis l’accueillir';
}

// Un nom de 20 caractères sans espace : la fenêtre du choix ne déborde pas à 320 px, en français puis en anglais.
async function adoptLongName(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, seed([]), NOW, { viewport: { width: 320, height: 640 } });
  try {
    for (const lang of ['fr', 'en']) {
      if (lang === 'en') await toEnglish(page);
      await meet(page);
      await page.locator('#companionName').fill('W'.repeat(20));
      assert.equal(await fitsSheet(page), true, lang);
      await page.locator('#sheetClose').click();
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Compagnon : un nom de 20 caractères tient à 320 px';
}

// Le nom suggéré suit la langue : un compagnon accueilli sans nom tapé (champ laissé tel quel, ou vidé) s'appelle Pompon, puis
// Pompom en anglais.
async function suggestedNameFollowsLanguage(browser, baseURL) {
  for (const empty of [false, true]) {
    const { context, page, errors } = await cityAt(browser, baseURL, seed([]), NOW);
    try {
      await meet(page);
      if (empty) await page.locator('#companionName').fill('');
      await page.locator('#sheetBody').getByRole('button', { name: 'Accueillir Pompon', exact: true }).click();
      await toastMatches(page, /Bienvenue à Pompon/);
      assert.deepEqual(await page.evaluate(() => [__ville.companion.state().name, __ville.companion.name()]), ['', 'Pompon']);
      await toEnglish(page);
      assert.equal(await page.evaluate(() => __ville.companion.name()), 'Pompom');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return 'Compagnon : le nom suggéré suit la langue';
}

const SCENARIOS = [paintAll, inviteAfterFirstSession, adoptDefault, adoptLongName, suggestedNameFollowsLanguage];
async function runCompanion(browser, baseURL) {
  const scenarios = [];
  for (const scenario of SCENARIOS) scenarios.push(await scenario(browser, baseURL));
  return { scenarios };
}

module.exports = { runCompanion, SCENARIOS, seed, tile, NOW };
