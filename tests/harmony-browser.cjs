const assert = require('node:assert/strict');
const { town } = require('./content-browser.cjs');
const { cityAt } = require('./ambient-browser.cjs');
const { activities, startSession } = require('./rituals-browser.cjs');

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

// Touche le centre de la bulle du souhait, sur le canevas donné.
async function tapBubble(page, canvas) {
  const box = await page.evaluate(() => __ville.City.wishBox());
  assert.ok(box, 'bulle du souhait');
  await page.locator(canvas).click({ position: { x: box.x + box.w / 2, y: box.y + box.h / 3 } });
}

// La bulle du souhait : au-dessus du bâtiment qui souhaite, elle ouvre sa fiche (petite ville et vue en grand) ; elle suit le
// bâtiment déplacé ; aucune bulle dans une visite.
async function wishBubble(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, seed([tile('maison', 3, 3)]), NOW);
  try {
    assert.equal((await page.evaluate(() => __ville.City.wishBox())).tile, await page.evaluate(() => __ville.harmony.wish().tile));
    await tapBubble(page, '#city');
    await page.locator('#sheet').waitFor();
    assert.equal(await page.locator('#sheetTitle').innerText(), 'Maison');
    await page.locator('#sheetClose').click();
    await page.locator('#cityExpand').click();
    await page.locator('#cityBig').waitFor();
    await tapBubble(page, '#cityBigCanvas');
    await page.locator('#sheet').waitFor();
    assert.equal(await page.locator('#sheetTitle').innerText(), 'Maison');
    await page.locator('#sheetClose').click();
    await page.locator('#cityBigClose').click();
    await page.locator('#cityBig').waitFor({ state: 'hidden' });
    // La maison déplacée en (3, 5) : la bulle la suit.
    await tapCell(page, 3, 3);
    await page.locator('#sheetBody').getByRole('button', { name: /Déplacer/ }).click();
    for (const key of ['ArrowDown', 'ArrowDown', 'Enter']) await page.locator('#city').press(key);
    await page.locator('#placeConfirm').click();
    const [box, cell] = await page.evaluate(() => [__ville.City.wishBox(), __ville.City.cellPoint(3, 5)]);
    assert.ok(Math.abs(box.x + box.w / 2 - cell[0]) < 4 && box.y + box.h < cell[1], JSON.stringify([box, cell]));
    // Visite de sa propre ville : pas de bulle.
    await page.evaluate(() => __ville.share.open(__ville.share.encode()));
    await page.locator('#cityBig').waitFor();
    assert.equal(await page.evaluate(() => __ville.City.wishBox()), null);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Souhait : la bulle au-dessus du bâtiment, qui ouvre sa fiche et le suit';
}

// Mesure, dans la fenêtre ouverte, que rien ne déborde.
const fitsSheet = page => page.evaluate(() => document.querySelector('#sheetBody').scrollWidth <= document.querySelector('#sheetBody').clientWidth + 1
  && document.documentElement.scrollWidth <= innerWidth);

// « Harmonie de ta ville » : le bouton dit les étoiles gagnées ; la fenêtre liste les cinq, avec leur date ou un conseil chiffré,
// jamais un mot de manque. À 320 px, en français puis en anglais.
async function harmonySheet(browser, baseURL) {
  const tiles = [tile('maison', 0, 0), tile('bibliotheque', 6, 0), tile('kiosque', 0, 6), tile('arbre', 3, 3), tile('fleurs', 4, 4)];
  const { context, page, errors } = await cityAt(browser, baseURL, seed(tiles), NOW, { viewport: { width: 320, height: 640 } });
  try {
    const button = page.getByRole('button', { name: 'Harmonie : 2 étoiles sur 5', exact: true });
    assert.equal(await button.innerText(), 'Harmonie ★★☆☆☆');
    await button.click();
    assert.equal(await page.locator('#sheetTitle').innerText(), 'Harmonie de ta ville');
    const text = await page.locator('#sheetBody').innerText();
    assert.match(text, /Verdure\s+Gagnée le[\s\S]*Variété\s+Gagnée le[\s\S]*Petits détails\s+Un bâtiment de plus, avec un décor à côté, ajouterait un petit détail/);
    assert.match(text, /Quartiers\s+2 ensembles de voisinage de plus formeraient des quartiers[\s\S]*Lumières du soir\s+Un lampadaire ou une lanterne de plus ferait briller ta ville le soir/);
    assert.doesNotMatch(text, /manque/i);
    assert.equal(await fitsSheet(page), true);
    await page.locator('#sheetClose').click();
    await toEnglish(page);
    await page.getByRole('button', { name: 'Harmony: 2 of 5 stars', exact: true }).click();
    assert.equal(await page.locator('#sheetTitle').innerText(), "Your town's harmony");
    assert.match(await page.locator('#sheetBody').innerText(), /Greenery\s+Earned on/);
    assert.equal(await fitsSheet(page), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Harmonie de ta ville : étoiles gagnées et conseils doux';
}

// Ambiances : chacune, rendue 4 s hors ligne au volume normal, reste sous la saturation avec un niveau moyen doux ; « Aucune » ne
// fait aucun son.
async function ambienceLevels(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, seed([]), NOW);
  try {
    for (const kind of ['rain', 'waves', 'fire', 'wind', 'brown']) {
      const m = await page.evaluate(k => __ville.ambience.measure(k), kind);
      assert.ok(m.peak < 0.9 && m.rms >= 0.01 && m.rms <= 0.25, kind + ' ' + JSON.stringify(m));
    }
    assert.deepEqual(await page.evaluate(() => __ville.ambience.measure('none')), { peak: 0, rms: 0 });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Ambiances : des niveaux doux, jamais saturés';
}

// Une ville avec une activité par domaine, l'horloge simulée, le son de fin coupé, et des espions qui comptent les sources
// sonores de plus d'une seconde (les ambiances, pas l'échantillon muet qui ouvre le son).
async function sessionPage(browser, baseURL, settings) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Zurich' });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date(NOW) });
  await page.addInitScript(state => {
    window.__VILLE_DEBUG__ = true;
    if (!localStorage.getItem('ville-bien-etre/v2')) localStorage.setItem('ville-bien-etre/v2', JSON.stringify(state));
    window.__sources = { started: 0, stopped: 0 };
    const proto = AudioBufferSourceNode.prototype, start = proto.start, stop = proto.stop;
    proto.start = function (...args) { if (this.buffer && this.buffer.duration > 1) window.__sources.started++; return start.apply(this, args); };
    proto.stop = function (...args) { if (this.buffer && this.buffer.duration > 1) window.__sources.stopped++; return stop.apply(this, args); };
  }, seed([tile('maison', 3, 3)], { activities: activities(), settings: { lang: 'fr', sound: false, ...settings } }));
  await page.goto(baseURL.replace(/#.*$/, ''));
  await page.waitForFunction(() => !!window.__ville);
  return { context, page, errors };
}
const sources = page => page.evaluate(() => window.__sources);
async function startFocus(page, name, minutes) {
  await page.locator('[data-tab="activites"]').click();
  await page.getByRole('button', { name: new RegExp('^' + name) }).first().click();
  await page.getByRole('radio', { name: minutes + ' min', exact: true }).click();
  await page.getByRole('radio', { name: 'Concentration', exact: true }).click();
  await page.getByRole('button', { name: /^Commencer/ }).click();
  // La mise en garde « écran allumé » suit la demande au navigateur, parfois un peu plus tard (Chromium de la CI) : on attend
  // la séance ou la mise en garde.
  await page.waitForFunction(() => window.__ville.activeState() === 'mine' || !!document.querySelector('#wakeAck'));
  const warning = page.getByRole('button', { name: "C'est réglé, commencer", exact: true });
  if (await warning.isVisible()) await warning.click();
  await page.waitForFunction(() => window.__ville.activeState() === 'mine');
}

// Ambiance pendant la séance, son de fin coupé : elle démarre avec la séance et s'arrête à la fin ; « Aucune » ne fait aucun son.
async function ambienceWithSession(browser, baseURL) {
  for (const kind of ['rain', 'none']) {
    const { context, page, errors } = await sessionPage(browser, baseURL, { ambience: kind });
    try {
      await startSession(page, 'Pratique calme', 5);
      const during = await sources(page);
      if (kind === 'none') assert.equal(during.started, 0);
      else assert.ok(during.started > 0 && during.stopped === 0, JSON.stringify(during));
      await page.clock.fastForward(5 * 60000 + 1000);
      await page.locator('#sessResult').waitFor();
      const after = await sources(page);
      assert.equal(after.stopped, after.started, JSON.stringify(after));
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return 'Ambiance : avec la séance, du début à la fin ; aucune si « Aucune »';
}

// Abandon d'une séance Concentration : l'ambiance s'arrête aussitôt.
async function ambienceStopsOnAbandon(browser, baseURL) {
  const { context, page, errors } = await sessionPage(browser, baseURL, { ambience: 'waves' });
  try {
    await startFocus(page, 'Pratique calme', 5);
    assert.ok((await sources(page)).started > 0);
    await page.locator('#abandonBtn').click();
    await page.locator('#abandonBtn').click();
    await page.locator('#sessResult').waitFor();
    const after = await sources(page);
    assert.equal(after.stopped, after.started, JSON.stringify(after));
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Ambiance : arrêtée à l’abandon';
}

// Rechargement pendant une séance : aucune erreur, aucun son avant un toucher ; au premier toucher, l'ambiance reprend.
async function ambienceAfterReload(browser, baseURL) {
  const { context, page, errors } = await sessionPage(browser, baseURL, { ambience: 'fire' });
  try {
    await startSession(page, 'Pratique calme', 5);
    assert.ok((await sources(page)).started > 0);
    await page.reload();
    await page.waitForFunction(() => window.__ville && window.__ville.activeState() === 'mine');
    await page.locator('#sessRun').waitFor();
    assert.equal((await sources(page)).started, 0);
    await page.locator('#sessRun').click({ position: { x: 20, y: 200 } });
    await page.waitForFunction(() => window.__sources.started > 0, null, { timeout: 3000 });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Ambiance : après un rechargement, elle reprend au premier toucher';
}

// Réglages › Sessions : choisir « Vagues » l'enregistre (gardé au rechargement) et fait entendre un aperçu de 3 s ; à 320 px, en
// français puis en anglais, rien ne déborde.
async function ambienceSettings(browser, baseURL) {
  const { context, page, errors } = await sessionPage(browser, baseURL, { ambience: 'none' });
  try {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.locator('#settingsBtn').click();
    const group = page.locator('#settingsSessions').getByRole('radiogroup', { name: 'Ambiance pendant les séances', exact: true });
    await group.getByRole('radio', { name: 'Vagues', exact: true }).click();
    assert.equal(await page.evaluate(() => __ville.state.settings.ambience), 'waves');
    assert.ok((await sources(page)).started > 0);
    await page.clock.fastForward(4000);
    const after = await sources(page);
    assert.equal(after.stopped, after.started, JSON.stringify(after));
    assert.match(await page.locator('#settingsSessions').innerText(), /Volume de l'ambiance[\s\S]*Sur iPhone, l'ambiance s'arrête quand l'écran se verrouille\./);
    assert.equal(await fitsSheet(page), true);
    await page.locator('#sheetClose').click();
    await toEnglish(page);
    await page.locator('#settingsBtn').click();
    assert.equal(await page.locator('#settingsSessions').getByRole('radio', { name: 'Waves', exact: true }).getAttribute('aria-checked'), 'true');
    assert.equal(await fitsSheet(page), true);
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    assert.equal(await page.evaluate(() => __ville.state.settings.ambience), 'waves');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Ambiance : choisie dans les réglages, avec un aperçu';
}

// Pendant la séance : « Ambiance : Vagues » ouvre le choix ; « Pluie » change le bouton, devient le choix par défaut et se fait
// entendre aussitôt.
async function ambienceDuringSession(browser, baseURL) {
  const { context, page, errors } = await sessionPage(browser, baseURL, { ambience: 'waves' });
  try {
    await startSession(page, 'Pratique calme', 5);
    const button = page.locator('#ambienceBtn');
    assert.match(await button.innerText(), /^Ambiance\s:\sVagues$/);
    const before = await sources(page);
    await button.click();
    await page.locator('#sheetBody').getByRole('radio', { name: 'Pluie', exact: true }).click();
    assert.equal(await page.evaluate(() => __ville.state.settings.ambience), 'rain');
    const after = await sources(page);
    assert.ok(after.started > before.started && after.stopped >= before.started, JSON.stringify([before, after]));
    await page.locator('#sheetClose').click();
    assert.match(await button.innerText(), /^Ambiance\s:\sPluie$/);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Ambiance : changée pendant la séance';
}

// Le son se met en veille quelques secondes après chaque son : l'aperçu suivant doit quand même se faire entendre.
async function ambiencePreviewAfterIdle(browser, baseURL) {
  const { context, page, errors } = await sessionPage(browser, baseURL, { ambience: 'none' });
  try {
    await page.locator('#settingsBtn').click();
    const group = page.locator('#settingsSessions').getByRole('radiogroup', { name: 'Ambiance pendant les séances', exact: true });
    await group.getByRole('radio', { name: 'Vagues', exact: true }).click();
    const first = (await sources(page)).started;
    assert.ok(first > 0);
    await page.clock.fastForward(6000);
    await page.waitForFunction(() => window.__ville && true);
    await group.getByRole('radio', { name: 'Pluie', exact: true }).click();
    await page.waitForFunction(n => window.__sources.started > n, first, { timeout: 3000 });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Ambiance : l’aperçu s’entend même après la mise en veille du son';
}

const SCENARIOS = [wishGrantedOnBuild, starsAtFirstOpen, wishCard, wishCardPoorAndOff, wishBubble, harmonySheet, ambienceLevels, ambienceWithSession,
  ambienceStopsOnAbandon, ambienceAfterReload, ambienceSettings, ambienceDuringSession, ambiencePreviewAfterIdle];
async function runHarmony(browser, baseURL) {
  const scenarios = [];
  for (const scenario of SCENARIOS) scenarios.push(await scenario(browser, baseURL));
  return { scenarios };
}

module.exports = { runHarmony, SCENARIOS, seed, tile, NOW };
