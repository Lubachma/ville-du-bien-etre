const assert = require('node:assert/strict');
const { town } = require('./content-browser.cjs');
const { cityAt } = require('./ambient-browser.cjs');

// Points mineurs de la revue de l'étape 3 : molette, minuit, clavier et robustesse de la ville vivante.
// Chaque scénario est une fonction à part, qu'on peut lancer seule.

// Molette de Firefox : elle compte en lignes (deltaMode 1), trois lignes par cran.
async function wheelLines(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, town({ esprit: 5 }), null);
  try {
    await page.locator('#cityExpand').click();
    await page.locator('#cityBig').waitFor();
    const box = await page.locator('#cityBigCanvas').boundingBox();
    await page.evaluate(([x, y]) => document.querySelector('#cityBigCanvas').dispatchEvent(new WheelEvent('wheel', { deltaY: -3, deltaMode: 1, clientX: x, clientY: y, bubbles: true, cancelable: true })),
      [box.x + box.width / 2, box.y + box.height / 2]);
    assert.ok(await page.evaluate(() => __ville.City.bigState().zoom) > 1.05, 'un cran de molette en lignes ne zoome presque pas');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Molette en lignes (Firefox)';
}

// Fiche du visiteur ouverte juste avant minuit : après minuit, « Recevoir » dit que le jour a changé et rouvre la fiche du jour.
async function visitorMidnight(browser, baseURL) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Zurich' });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-07-01T21:59:00Z') });
  const tiles = [{ id: 'b', item: 'banc', x: 2, y: 2, at: 1.79e12, paid: 2e6 }];
  await page.addInitScript(state => localStorage.setItem('ville-bien-etre/v2', JSON.stringify(state)), town({ esprit: 5 }, tiles, { settings: { lang: 'fr', ambient: false } }));
  try {
    await page.goto(baseURL);
    await page.waitForFunction(() => !!window.__ville);
    await page.evaluate(() => __ville.ambient.force({ visitor: { id: 'chat', spot: { x: 2, y: 2, on: 'banc' } }, festivals: [] }));
    const box = await page.evaluate(() => __ville.City.visitorBox()), city = await page.locator('#city').boundingBox();
    await page.mouse.click(city.x + box.x + box.w / 2, city.y + box.y + box.h / 2);
    await page.locator('#sheet').waitFor();
    const coins = await page.evaluate(() => __ville.state.coins);
    await page.clock.fastForward('02:00');
    await page.locator('#sheetBody').getByRole('button', { name: /^Recevoir/ }).click();
    await page.waitForFunction(() => /Un nouveau jour commence/.test(document.querySelector('#toast').textContent));
    await page.locator('#sheetBody').getByRole('button', { name: /^Recevoir/ }).click();
    assert.equal(await page.evaluate(() => __ville.state.coins), coins + 2e6);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Fiche du visiteur ouverte à minuit';
}

// Vue en grand au clavier : retour arrière avec la fiche du visiteur ouverte, Tab qui reste dans la vue, + et flèches,
// zoom jusqu'au bout sans perdre le focus.
async function bigKeyboard(browser, baseURL) {
  const tiles = [{ id: 'b', item: 'banc', x: 1, y: 5, at: 1.79e12, paid: 2e6 }];
  const { context, page, errors } = await cityAt(browser, baseURL, town({ esprit: 5 }, tiles), null);
  try {
    await page.evaluate(() => __ville.ambient.force({ visitor: { id: 'chat', spot: { x: 1, y: 5, on: 'banc' } }, festivals: [] }));
    const focused = () => page.evaluate(() => document.activeElement && document.activeElement.id);
    const state = () => page.evaluate(() => __ville.City.bigState());
    await page.locator('#cityExpand').focus();
    await page.keyboard.press('Enter');
    await page.locator('#cityBig').waitFor();
    assert.equal(await focused(), 'cityBigClose');
    const vb = await page.evaluate(() => __ville.City.visitorBox()), bb = await page.locator('#cityBigCanvas').boundingBox();
    await page.mouse.click(bb.x + vb.x + vb.w / 2, bb.y + vb.y + vb.h / 2);
    await page.locator('#sheet').waitFor();
    await page.goBack();
    await page.locator('#cityBig').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#sheet').isHidden(), true);
    assert.equal(await focused(), 'cityExpand');
    await page.keyboard.press('Enter');
    await page.locator('#cityBig').waitFor();
    await page.keyboard.press('Tab');
    assert.equal(await focused(), 'cityBigOut', 'Tab sort de la vue en grand');
    // « + » puis une flèche aussitôt, pendant le zoom en douceur : les deux comptent.
    const before = (await state()).focus;
    await page.keyboard.press('+');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    const after = await state();
    assert.equal(after.zoom, 1.5);
    assert.ok(after.focus[0] - after.focus[1] > before[0] - before[1] + .1, 'la flèche droite ne déplace pas la vue vers la droite');
    await page.locator('#cityBigIn').focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press('Enter');
    assert.equal((await state()).zoom, 3);
    assert.equal(await focused(), 'cityBigIn', 'le bouton Zoomer perd le focus au zoom maximal');
    assert.equal(await page.locator('#cityBigIn').getAttribute('aria-disabled'), 'true');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Vue en grand au clavier';
}

// Visiteur sur une case libre : au clavier, sa case l'annonce et Entrée ouvre sa fiche.
async function visitorKeyboard(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, town({ esprit: 5 }), null);
  try {
    await page.evaluate(() => __ville.ambient.force({ visitor: { id: 'chat', spot: { x: 2, y: 3 } }, festivals: [] }));
    await page.locator('#city').focus();
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => /chat voyageur/.test(document.querySelector('#live').textContent));
    await page.keyboard.press('Enter');
    await page.locator('#sheet').waitFor();
    assert.equal(await page.locator('#sheetTitle').innerText(), 'Le chat voyageur');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Visiteur au clavier';
}

// Une couche de vie illisible (ici un visiteur inconnu) n'arrête pas la ville.
async function brokenLayer(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, town({ esprit: 5 }), null);
  try {
    await page.evaluate(() => __ville.ambient.force({ visitor: { id: 'licorne', spot: { x: 2, y: 3 } } }));
    const before = await page.evaluate(() => __ville.City.frames());
    await page.waitForTimeout(600);
    assert.ok(await page.evaluate(() => __ville.City.frames()) > before, 'la ville ne bouge plus');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Couche de vie en erreur';
}

const SCENARIOS = [wheelLines, visitorMidnight, bigKeyboard, visitorKeyboard, brokenLayer];
async function runMinors(browser, baseURL) {
  const scenarios = [];
  for (const scenario of SCENARIOS) scenarios.push(await scenario(browser, baseURL));
  return { scenarios };
}

module.exports = { runMinors, SCENARIOS };
