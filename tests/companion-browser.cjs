const assert = require('node:assert/strict');
const { town } = require('./content-browser.cjs');
const { cityAt } = require('./ambient-browser.cjs');

// Étape 6, le compagnon : chaque scénario est une fonction à part, qu'on peut lancer seule.
const at = iso => Date.parse(iso);
const NOW = '2026-10-21T10:00:00Z';
const tile = (item, x, y, extra = {}) => ({ id: item + x + y, item, x, y, at: at('2026-10-01T09:00:00Z'), paid: 1e6, ...extra });
// Une ville amorcée à date de création fixe ; « extra » peut y ajouter un compagnon, des séances, des réglages.
const seed = (tiles, extra = {}) => town({ esprit: 5 }, tiles, { createdAt: at('2026-05-04T09:00:00Z'), ...extra });
// Un compagnon déjà accueilli (le 1er octobre), avec ce qui change d'un scénario à l'autre.
const pet = (extra = {}) => ({ species: 'lapin', name: 'Pompon', since: at('2026-10-01T09:00:00Z'), minutes: 0, wear: '', ...extra });
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

// Dans la ville : il se promène le jour (10 h) et dort la nuit (23 h 30), sur une case du terrain.
async function townDayNight(browser, baseURL) {
  for (const [time, pose] of [['2026-10-21T08:00:00Z', 'walk'], ['2026-10-21T21:30:00Z', 'sleep']]) {
    const { context, page, errors } = await cityAt(browser, baseURL, seed([tile('maison', 3, 3)], { companion: pet() }), time);
    try {
      await page.waitForFunction(() => !!__ville.companion.spot());
      const spot = await page.evaluate(() => __ville.companion.spot());
      assert.equal(spot.pose, pose, time);
      assert.ok(spot.x >= 0 && spot.x < 7 && spot.y >= 0 && spot.y < 7, JSON.stringify(spot));
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return 'Compagnon : il se promène le jour et dort la nuit';
}

// Le bouton du compagnon, et le compagnon lui-même, ouvrent sa fiche, sur la petite carte comme dans la vue en grand.
async function townTapAndButton(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, seed([tile('maison', 3, 3)], { companion: pet(), settings: { lang: 'fr', ambient: false } }), NOW);
  try {
    await page.getByRole('button', { name: 'Pompon, ton compagnon', exact: true }).click();
    await page.locator('#sheet').waitFor();
    assert.equal(await page.locator('#sheetTitle').innerText(), 'Pompon');
    await page.locator('#sheetClose').click();
    const tapBox = async canvas => {
      const box = await page.evaluate(() => __ville.companion.box());
      assert.ok(box, canvas);
      await page.locator(canvas).click({ position: { x: box.x + box.w / 2, y: box.y + box.h / 2 } });
      await page.locator('#sheet').waitFor();
      assert.equal(await page.locator('#sheetTitle').innerText(), 'Pompon', canvas);
      await page.locator('#sheetClose').click();
    };
    await tapBox('#city');
    await page.locator('#cityExpand').click();
    await page.locator('#cityBig').waitFor();
    await tapBox('#cityBigCanvas');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Compagnon : son bouton et lui-même ouvrent sa fiche';
}

// Masqué : ni bouton ni compagnon ; en visite (même de sa propre ville) : pas de compagnon.
async function townHiddenAndVisit(browser, baseURL) {
  {
    const { context, page, errors } = await cityAt(browser, baseURL, seed([tile('maison', 3, 3)], { companion: pet(), settings: { lang: 'fr', companionShown: false } }), NOW);
    try {
      await page.waitForTimeout(300);
      assert.equal(await page.locator('#companionBtn').isVisible(), false);
      assert.equal(await page.evaluate(() => __ville.companion.spot()), null);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  const { context, page, errors } = await cityAt(browser, baseURL, seed([tile('maison', 3, 3)], { companion: pet() }), NOW);
  try {
    await page.waitForFunction(() => !!__ville.companion.spot());
    await page.evaluate(() => __ville.share.open(__ville.share.encode()));
    await page.locator('#cityBig').waitFor();
    await page.waitForFunction(() => __ville.companion.spot() === null);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Compagnon : masqué, ou en visite, il ne se montre pas';
}

const openSheetOf = page => page.locator('#companionBtn').click().then(() => page.locator('#sheet').waitFor());

// La fiche : animal et niveau, temps ensemble et prochain cadeau (rien au niveau 10), mot du jour.
async function sheetContent(browser, baseURL) {
  for (const [minutes, lines, absent] of [[70, /Lapin · complicité niveau 3[\s\S]*1\sh\s10 ensemble · prochain cadeau dans 50\smin\s:\sdes lunettes rondes/, null],
    [1800, /Lapin · complicité niveau 10[\s\S]*30\sh ensemble/, /prochain cadeau/]]) {
    const { context, page, errors } = await cityAt(browser, baseURL, seed([tile('maison', 3, 3)], { companion: pet({ minutes }) }), NOW);
    try {
      await openSheetOf(page);
      const text = await page.locator('#sheetBody').innerText();
      assert.match(text, lines);
      if (absent) assert.doesNotMatch(text, absent);
      const word = await page.evaluate(() => __ville.companion.word());
      assert.ok(word && text.replace(/\s/g, ' ').includes(word.replace(/\s/g, ' ')), word);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return 'Compagnon : sa fiche, son niveau, son mot du jour';
}

// La garde-robe : les accessoires gagnés se choisissent, les suivants attendent leur niveau ; le choix est gardé.
async function wardrobe(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, seed([tile('maison', 3, 3)], { companion: pet({ minutes: 70 }) }), NOW);
  try {
    await openSheetOf(page);
    const group = page.locator('#sheetBody').getByRole('radiogroup', { name: 'Garde-robe', exact: true });
    const item = name => group.getByRole('radio', { name: new RegExp('^' + name) });
    assert.deepEqual([await item('Écharpe').isDisabled(), await item('Bonnet').isDisabled(), await item('Lunettes rondes').isDisabled()], [false, false, true]);
    assert.match(await item('Lunettes rondes').innerText(), /Niveau 4/);
    await item('Bonnet').click();
    assert.equal(await page.evaluate(() => __ville.companion.state().wear), 'bonnet');
    assert.equal(await item('Bonnet').getAttribute('aria-checked'), 'true');
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    assert.equal(await page.evaluate(() => __ville.companion.state().wear), 'bonnet');
    await openSheetOf(page);
    await item('Aucun').click();
    assert.equal(await page.evaluate(() => __ville.companion.state().wear), '');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Compagnon : la garde-robe';
}

// Un nom de 20 caractères sans espace : la fiche ne déborde pas à 320 px, en français puis en anglais.
async function sheetLongName(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, seed([tile('maison', 3, 3)], { companion: pet({ name: 'W'.repeat(20), minutes: 70 }) }), NOW,
    { viewport: { width: 320, height: 640 } });
  try {
    for (const lang of ['fr', 'en']) {
      if (lang === 'en') await toEnglish(page);
      await openSheetOf(page);
      assert.equal(await fitsSheet(page), true, lang);
      assert.equal(await page.evaluate(() => document.querySelector('#sheetTitle').scrollWidth <= document.querySelector('#sheetTitle').clientWidth + 1), true, lang);
      await page.locator('#sheetClose').click();
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Compagnon : sa fiche tient à 320 px, même avec un nom long';
}

const SCENARIOS = [paintAll, inviteAfterFirstSession, adoptDefault, adoptLongName, suggestedNameFollowsLanguage, townDayNight, townTapAndButton,
  townHiddenAndVisit, sheetContent, wardrobe, sheetLongName];
async function runCompanion(browser, baseURL) {
  const scenarios = [];
  for (const scenario of SCENARIOS) scenarios.push(await scenario(browser, baseURL));
  return { scenarios };
}

module.exports = { runCompanion, SCENARIOS, seed, tile, NOW };
