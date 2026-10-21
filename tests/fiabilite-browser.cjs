const assert = require('node:assert/strict');
const { town } = require('./content-browser.cjs');
const { cityAt } = require('./ambient-browser.cjs');
const { sessionTown, startSession, setVisibility, leaCode } = require('./rituals-browser.cjs');

// Étape 7, la fiabilité : chaque scénario est une fonction à part, qu'on peut lancer seule. Les tâches suivantes y ajoutent les leurs.
const NOW = '2026-10-21T10:00:00Z';
// Un compagnon déjà accueilli (le 1er octobre), comme dans companion-browser.cjs.
const pet = (extra = {}) => ({ species: 'lapin', name: 'Pompon', since: Date.parse('2026-10-01T09:00:00Z'), minutes: 0, wear: '', ...extra });

// Garde générique : le texte visible de « selector » ne contient jamais « null », « undefined » ou « NaN » en mot entier, c'est-à-dire
// une valeur vide écrite telle quelle dans un écran. Le texte réservé aux lecteurs d'écran compte aussi.
const TECH_TEXT = /\b(null|undefined|NaN)\b/;
async function assertNoTechText(page, selector) {
  const zone = page.locator(selector);
  await zone.waitFor();   // visible : on lit ce que la personne voit, pas un écran encore caché
  const text = await zone.innerText(), found = TECH_TEXT.exec(text);
  if (found) assert.fail(`${selector} montre « ${found[0]} » : …${text.slice(Math.max(0, found.index - 40), found.index + 40).replace(/\s+/g, ' ')}…`);
}

// Attend que la séance tourne : la mise en garde « écran allumé » suit la demande au navigateur, parfois un peu plus tard.
async function confirmStart(page) {
  await page.waitForFunction(() => window.__ville.activeState() === 'mine' || !!document.querySelector('#wakeAck'));
  const warning = page.getByRole('button', { name: "C'est réglé, commencer", exact: true });
  if (await warning.isVisible()) await warning.click();
  await page.waitForFunction(() => window.__ville.activeState() === 'mine');
}
// Une séance en Concentration, choisie depuis l'onglet Activités : sa fenêtre de départ reste ouverte, rien n'est lancé.
async function pickFocus(page, name = 'Méditation', minutes = 5) {
  await page.locator('[data-tab="activites"]').click();
  await page.getByRole('button', { name: new RegExp('^' + name) }).first().click();
  await page.getByRole('radio', { name: minutes + ' min', exact: true }).click();
  await page.getByRole('radio', { name: 'Concentration', exact: true }).click();
}
// … puis lancée. L'horloge de la page est simulée (cityAt ou sessionTown).
async function startFocus(page, name, minutes) {
  await pickFocus(page, name, minutes);
  await page.getByRole('button', { name: /^Commencer/ }).click();
  await confirmStart(page);
}
const result = page => page.locator('#sessResult');
const backToCity = page => result(page).getByRole('button', { name: 'Retour à la ville', exact: true }).click();
// Une séance menée au bout : runFor fait tourner l'horloge pas à pas, et la Concentration compte le temps qui passe tic après tic.
async function succeed(page) {
  await startFocus(page);
  await page.clock.runFor('05:03');
  await result(page).waitFor();
  assert.equal(await result(page).locator('.res-title').innerText(), 'Session réussie');
}
// … et une séance interrompue : fastForward saute d'un coup plus loin que le délai de grâce, comme une app laissée de côté.
async function interrupt(page) {
  await startFocus(page);
  await page.clock.fastForward('05:02');
  await result(page).waitFor();
  assert.equal(await result(page).locator('.res-title').innerText(), 'Session interrompue');
}

// Écran de fin d'une ville sans compagnon : la réussite, puis l'interruption (et « Recommencer »), sans un mot technique.
// Chaque nouvelle personne passe par là dès sa première récompense.
async function endScreenWithoutCompanion(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, town({}, []), NOW);
  try {
    await succeed(page);
    await assertNoTechText(page, '#sessResult');
    await backToCity(page);
    await interrupt(page);
    await assertNoTechText(page, '#sessResult');
    await result(page).getByRole('button', { name: 'Recommencer', exact: true }).click();
    await confirmStart(page);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Écran de fin : aucun texte technique, sans compagnon';
}

// Même chose pour qui a masqué son compagnon : il existe encore, mais rien de lui n'est affiché.
async function endScreenHiddenCompanion(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, town({}, [], { companion: pet(), settings: { lang: 'fr', companionShown: false } }), NOW);
  try {
    await succeed(page);
    await assertNoTechText(page, '#sessResult');
    await backToCity(page);
    await interrupt(page);
    await assertNoTechText(page, '#sessResult');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Écran de fin : aucun texte technique, compagnon masqué';
}

// Une ville qui vient de faire sa première séance : la Ville, le Journal, la boutique et les Réglages ne disent rien de technique.
async function screensWithoutTechText(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, town({}, []), NOW);
  try {
    await succeed(page);
    await backToCity(page);
    await assertNoTechText(page, '#view-ville');
    await page.locator('[data-tab="journal"]').click();
    await assertNoTechText(page, '#view-journal');
    await page.locator('[data-tab="ville"]').click();
    await page.locator('#buildBtn').click();
    await assertNoTechText(page, '#sheet');
    await page.locator('#sheetClose').click();
    await page.locator('#settingsBtn').click();
    await assertNoTechText(page, '#sheet');
    await page.locator('#sheetClose').click();
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Écrans : aucun texte technique sur la ville, le Journal, la boutique et les réglages';
}

// Un onglet resté sur l'ancienne version (la mise à jour a été acceptée dans un autre onglet) se recharge de lui-même, mais seulement
// au repos. markLate rejoue ce que le service worker lui annonce alors ; window.marker disparaît avec la page : c'est la preuve d'un rechargement.
const markLate = page => page.evaluate(() => {
  window.marker = true;
  VillePWA.reloadAvailable = true; VillePWA.update = true;
  window.dispatchEvent(new CustomEvent('ville:pwa'));
});
// Rien ne s'est rechargé et rien n'est en train de l'être (reloading ne se pose qu'au moment de recharger), et le bandeau « Mettre à jour »
// reste affiché en attendant.
async function assertStays(page, label) {
  await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(() => [window.marker, VillePWA.reloading, document.querySelector('#updateNotice').hidden]), [true, false, false], label);
}
// Le geste qui libère l'onglet le recharge. On attend la disparition du marqueur plutôt qu'une navigation : fermer la vue en grand passe
// par history.back(), qui en est une aussi sans rien recharger.
async function assertReloads(page, release, label) {
  await release();
  const reloaded = await page.waitForFunction(() => window.marker === undefined && !!window.__ville, null, { timeout: 10000 }).then(() => true, () => false);
  assert.ok(reloaded, label + " : l'onglet ne s'est pas rechargé");
}

// Onglet en retard : au repos, l'annonce suffit pour qu'il se recharge. Une fenêtre ouverte, une séance qui tourne (et son écran de fin),
// la visite d'une ville amie ou une pose le retiennent jusqu'à leur fermeture ; en arrière-plan, seule la séance le retient. La séance
// libre suit l'horloge simulée, comme dans rituals-browser.cjs.
async function lateTabReloadsWhenIdle(browser, baseURL) {
  const code = await leaCode(browser, baseURL);
  const { context, page, errors } = await sessionTown(browser);
  try {
    await page.goto(baseURL);
    await page.waitForFunction(() => !!window.__ville);
    // Au repos.
    await assertReloads(page, () => markLate(page), 'onglet au repos');
    // Une fenêtre ouverte.
    await page.locator('#settingsBtn').click();
    await markLate(page);
    await assertStays(page, 'Réglages ouverts');
    await assertReloads(page, () => page.locator('#sheetClose').click(), 'Réglages fermés');
    // Une séance libre : elle tourne, même page passée en arrière-plan, puis son écran de fin attend « Retour à la ville ».
    await startSession(page, 'Pratique corps', 5);
    await markLate(page);
    await page.clock.runFor(60000);
    await assertStays(page, 'séance en cours');
    await setVisibility(page, 'hidden');
    await assertStays(page, 'séance en cours, page en arrière-plan');
    await setVisibility(page, 'visible');
    await page.clock.fastForward(4 * 60000 + 1000);
    await result(page).waitFor();
    await markLate(page);   // le service worker le redit : l'écran de fin retient aussi l'onglet
    await assertStays(page, 'écran de fin');
    await assertReloads(page, () => backToCity(page), 'retour à la ville');
    // La visite d'une ville amie, en grand.
    await page.evaluate(c => __ville.share.open(c), code);
    await page.locator('#cityBig').waitFor();
    await markLate(page);
    await assertStays(page, 'visite ouverte');
    await assertReloads(page, () => page.locator('#cityBigClose').click(), 'visite fermée');
    // La boutique se ferme pour une pose, qui retient l'onglet à son tour ; puis une fenêtre, et la page passe en arrière-plan.
    await page.locator('#buildBtn').click();
    await markLate(page);
    await assertStays(page, 'boutique ouverte');
    await page.getByRole('button', { name: /^Placer Banc pour/ }).click();
    await assertStays(page, 'pose en cours');
    await page.locator('#placeCancel').click();
    await page.locator('#settingsBtn').click();
    await assertStays(page, 'Réglages ouverts, page visible');
    await assertReloads(page, () => setVisibility(page, 'hidden'), 'page en arrière-plan');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Onglet en retard : rechargé au repos seulement';
}

// Le geste qui ferme une fenêtre ou l'écran de fin lance souvent la suite aussitôt (une séance, une visite reçue) : un rechargement entre
// les deux la couperait net. Ici en Concentration, avec un verrou d'écran accordé en retard ou une mise en garde, puis une visite reçue en séance.
async function lateTabWaitsForWhatFollows(browser, baseURL) {
  const code = await leaCode(browser, baseURL);
  const { context, page, errors } = await sessionTown(browser, { keepAwake: false });
  // Un verrou d'écran que le navigateur accorde avec 200 ms de retard : la séance démarre sans mise en garde, mais pas tout de suite.
  await page.addInitScript(() => {
    const lock = { released: false, release() { this.released = true; return Promise.resolve(); }, addEventListener() {} };
    Object.defineProperty(navigator, 'wakeLock', { value: { request: () => new Promise(resolve => setTimeout(() => resolve(lock), 200)) }, configurable: true });
  });
  const warning = page.getByRole('button', { name: "C'est réglé, commencer", exact: true });
  const running = () => page.waitForFunction(() => window.__ville.activeState() === 'mine');
  const interrupted = async () => { await page.clock.fastForward('05:02'); await result(page).waitFor(); };
  try {
    await page.goto(baseURL);
    await page.waitForFunction(() => !!window.__ville);
    // « Écran allumé » coupé : « Commencer » ferme la fenêtre de départ et ouvre la mise en garde, « C'est réglé, commencer » la ferme et lance la séance.
    await pickFocus(page, 'Pratique calme');
    await markLate(page);
    await assertStays(page, 'fenêtre de départ ouverte');
    await page.getByRole('button', { name: /^Commencer/ }).click();
    await assertStays(page, 'mise en garde ouverte');
    await warning.click();
    await assertStays(page, 'séance qui démarre');
    await running();
    await interrupted();
    await assertStays(page, 'séance interrompue');
    // « Écran allumé » remis : « Recommencer » ferme l'écran de fin, puis attend le verrou, sans fenêtre ni séance entre-temps.
    await page.evaluate(() => { __ville.state.settings.keepAwake = true; });
    await result(page).getByRole('button', { name: 'Recommencer', exact: true }).click();
    await assertStays(page, 'séance qui redémarre');
    await running();
    // Un lien d'amie reçu pendant la séance attend sa fin : la visite s'ouvre à la fermeture de l'écran de fin, avant tout rechargement.
    await page.evaluate(c => __ville.share.open(c), code);
    await interrupted();
    await backToCity(page);
    await page.locator('#cityBig').waitFor();
    await assertStays(page, 'visite reçue pendant la séance');
    await assertReloads(page, () => page.locator('#cityBigClose').click(), 'visite fermée');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Onglet en retard : la suite du geste passe avant le rechargement';
}

const SCENARIOS = [endScreenWithoutCompanion, endScreenHiddenCompanion, screensWithoutTechText, lateTabReloadsWhenIdle, lateTabWaitsForWhatFollows];
async function runFiabilite(browser, baseURL) {
  const scenarios = [];
  for (const scenario of SCENARIOS) scenarios.push(await scenario(browser, baseURL));
  return { scenarios };
}

module.exports = { runFiabilite, SCENARIOS, assertNoTechText };
