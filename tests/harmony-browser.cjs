const assert = require('node:assert/strict');
const { town } = require('./content-browser.cjs');
const { cityAt } = require('./ambient-browser.cjs');

// Étape 5, harmonie et ambiance : chaque scénario est une fonction à part, qu'on peut lancer seule.
const at = iso => Date.parse(iso);
const NOW = '2026-10-21T10:00:00Z';
const tile = (item, x, y, extra = {}) => ({ id: item + x + y, item, x, y, at: at('2026-10-01T09:00:00Z'), paid: 1e6, ...extra });
// Une ville amorcée à date de création fixe, avec peu de minutes : seuls les décors de départ sont débloqués.
const seed = (tiles, extra = {}) => town({ esprit: 5 }, tiles, { createdAt: at('2026-05-04T09:00:00Z'), ...extra });
const NAMES = { fleurs: 'Massif de fleurs', banc: 'Banc' }, PRICES = { fleurs: 1e6, banc: 2e6 };
const toastMatches = (page, re) => page.waitForFunction(source => new RegExp(source).test(document.querySelector('#toast').textContent), re.source, { timeout: 5000 });

// Pose : le décor souhaité, posé à côté du bâtiment, exauce le souhait — le bâtiment remercie, et 3 M arrivent.
async function wishGrantedOnBuild(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, seed([tile('maison', 3, 3)], { achievements: { 'premiere-pierre': at('2026-05-05T09:00:00Z') } }), NOW);
  try {
    const wish = await page.evaluate(() => __ville.harmony.wish());
    assert.ok(wish && NAMES[wish.item], JSON.stringify(wish));
    const coins = await page.evaluate(() => __ville.state.coins);
    await page.locator('#buildBtn').click();
    await page.getByRole('button', { name: new RegExp('^Placer ' + NAMES[wish.item] + ' pour') }).click();
    await page.locator('#city').press('ArrowRight');   // (4, 3), juste à côté de la maison (3, 3)
    await page.locator('#city').press('Enter');
    await page.locator('#placeConfirm').click();
    await toastMatches(page, /Souhait exaucé/);
    assert.match(await page.locator('#toast').innerText(), /Souhait exaucé · Maison\s:\s«\sMerci, c'est parfait\s!\s»\s·\s\+3\sM/);
    assert.deepEqual(await page.evaluate(() => ({ coins: __ville.state.coins, gift: !!__ville.state.gifts['wish:2026-10-21'] })),
      { coins: coins - PRICES[wish.item] + 3e6, gift: true });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Souhait exaucé en posant le décor voulu';
}

// Ville d'avant l'étape 5 : les étoiles qu'elle mérite déjà arrivent en un seul message à la première ouverture, payées une fois.
async function starsAtFirstOpen(browser, baseURL) {
  const tiles = [tile('maison', 0, 0), tile('bibliotheque', 6, 0), tile('kiosque', 0, 6), tile('arbre', 3, 3), tile('fleurs', 4, 4), tile('lampadaire', 6, 6)];
  const state = seed(tiles);
  const { context, page, errors } = await cityAt(browser, baseURL, state, NOW);
  try {
    await toastMatches(page, /Nouvelle étoile d'harmonie/);
    const text = await page.locator('#toast').innerText();
    assert.equal((text.match(/Nouvelle étoile d'harmonie/g) || []).length, 3, text);
    assert.match(text, /Verdure[\s\S]*Variété[\s\S]*Lumières du soir/);
    const coins = await page.evaluate(() => __ville.state.coins);
    assert.equal(coins, state.coins + 30e6);
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    await page.waitForTimeout(400);
    assert.doesNotMatch(await page.locator('#toast').innerText(), /Nouvelle étoile/);
    assert.equal(await page.evaluate(() => __ville.state.coins), coins);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Étoiles d’une ville déjà harmonieuse : un seul message, payées une fois';
}

// La page ne déborde pas, et la carte du souhait tient dans sa largeur.
const fits = page => page.evaluate(() => {
  const card = document.querySelector('#townWishCard');
  return document.documentElement.scrollWidth <= innerWidth && (!card || card.scrollWidth <= card.clientWidth + 1);
});
async function toEnglish(page) {
  await page.locator('#settingsBtn').click();
  await page.locator('#settingsLang').getByRole('radio', { name: 'English', exact: true }).click();
  await page.locator('#sheetClose').click();
}
// Ouvre la fiche de l'élément posé sur une case, en touchant la ville.
async function tapCell(page, x, y) {
  const [px, py] = await page.evaluate(([cx, cy]) => __ville.City.cellPoint(cx, cy), [x, y]);
  await page.locator('#city').click({ position: { x: px, y: py - 6 } });
}

// Carte « Souhait du jour » : le bâtiment, sa phrase, « Placer … » ; le même rappel dans sa fiche ; « Pas maintenant » la range,
// rechargement compris. À 320 px, en français puis en anglais.
async function wishCard(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, seed([tile('maison', 3, 3)]), NOW, { viewport: { width: 320, height: 640 } });
  try {
    const card = page.locator('#townWishCard');
    assert.match(await card.innerText(), /Souhait du jour[\s\S]*Maison[\s\S]*J'aimerais (des fleurs|un banc) juste à côté\.[\s\S]*même en diagonale/);
    assert.equal(await card.getByRole('button', { name: /^Placer (des fleurs|un banc) · \d\sM$/ }).isEnabled(), true);
    assert.equal(await fits(page), true);
    await tapCell(page, 3, 3);
    await page.locator('#sheet').waitFor();
    assert.match(await page.locator('#sheetBody').innerText(), /J'aimerais (des fleurs|un banc) juste à côté/);
    await page.locator('#sheetClose').click();
    await toEnglish(page);
    assert.match(await card.innerText(), /Wish of the day[\s\S]*House[\s\S]*I'd love (flowers|a bench) right next to me/);
    assert.equal(await fits(page), true);
    await card.getByRole('button', { name: 'Not now', exact: true }).click();
    assert.equal(await card.isHidden(), true);
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    assert.equal(await page.locator('#townWishCard').isHidden(), true);
    assert.equal(await page.evaluate(() => __ville.state.townWish.skipped), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Souhait du jour : carte, fiche du bâtiment, « Pas maintenant »';
}

// Pas assez de pièces : « Placer » est désactivé et dit ce qu'il faut encore, sans autre message. Réglage coupé : plus de carte.
async function wishCardPoorAndOff(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, seed([tile('maison', 3, 3)], { coins: 0 }), NOW);
  try {
    const card = page.locator('#townWishCard');
    assert.equal(await card.getByRole('button', { name: /^Placer/ }).isDisabled(), true);
    assert.match(await card.innerText(), /Il te manque \d\sM/);
    await page.locator('#settingsBtn').click();
    await page.locator('#settingsRituals').getByRole('switch', { name: 'Souhaits des habitants', exact: true }).click();
    await page.locator('#sheetClose').click();
    assert.equal(await card.isHidden(), true);
    assert.equal(await page.evaluate(() => __ville.state.settings.townWishes), false);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Souhait du jour : trop cher sans pression, ou coupé';
}

const SCENARIOS = [wishGrantedOnBuild, starsAtFirstOpen, wishCard, wishCardPoorAndOff];
async function runHarmony(browser, baseURL) {
  const scenarios = [];
  for (const scenario of SCENARIOS) scenarios.push(await scenario(browser, baseURL));
  return { scenarios };
}

module.exports = { runHarmony, SCENARIOS, seed, tile, NOW };
