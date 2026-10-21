const assert = require('node:assert/strict');
const { town } = require('./content-browser.cjs');
const { cityAt } = require('./ambient-browser.cjs');

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
// Une séance en Concentration, lancée depuis l'onglet Activités. L'horloge de la page est simulée par cityAt.
async function startFocus(page, name = 'Méditation', minutes = 5) {
  await page.locator('[data-tab="activites"]').click();
  await page.getByRole('button', { name: new RegExp('^' + name) }).first().click();
  await page.getByRole('radio', { name: minutes + ' min', exact: true }).click();
  await page.getByRole('radio', { name: 'Concentration', exact: true }).click();
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

const SCENARIOS = [endScreenWithoutCompanion, endScreenHiddenCompanion, screensWithoutTechText];
async function runFiabilite(browser, baseURL) {
  const scenarios = [];
  for (const scenario of SCENARIOS) scenarios.push(await scenario(browser, baseURL));
  return { scenarios };
}

module.exports = { runFiabilite, SCENARIOS, assertNoTechText };
