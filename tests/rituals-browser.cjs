const assert = require('node:assert/strict');
const { town } = require('./content-browser.cjs');
const { cityAt } = require('./ambient-browser.cjs');

// Étape 4, rituels et partage : chaque scénario est une fonction à part, qu'on peut lancer seule.
const CATS = ['esprit', 'corps', 'calme', 'foyer', 'crea'];
const at = iso => Date.parse(iso);
// Une activité par domaine, pour lancer des séances au choix.
const activities = () => CATS.map(cat => ({ id: 'a-' + cat, name: 'Pratique ' + cat, cat, min: 5, mode: 'free' }));
// La semaine du lundi 19 au dimanche 25 octobre 2026, où les défis de chaque famille sont relevés. Les statistiques suivent
// les séances, comme dans l'app.
function filledWeek() {
  const entry = (day, cat, min, more = {}) => ({ id: 'h' + day + cat + min, name: 'Pratique ' + cat, cat, min, ok: true, reward: min * 1e6, at: at(day + 'T10:00:00Z'), day,
    source: 'direct', mode: 'focus', ...more });
  const history = [entry('2026-10-19', 'esprit', 10, { at: at('2026-10-19T06:00:00Z') }), entry('2026-10-20', 'corps', 60, { at: at('2026-10-20T19:30:00Z') }),
    entry('2026-10-22', 'crea', 10), entry('2026-10-24', 'calme', 10, { source: 'wishes' }), entry('2026-10-24', 'foyer', 10)];
  const byCat = {}, days = {}, dailyCats = {};
  for (const e of history) {
    byCat[e.cat] = (byCat[e.cat] || 0) + e.min;
    days[e.day] = (days[e.day] || 0) + e.min;
    dailyCats[e.day] = { ...dailyCats[e.day], [e.cat]: ((dailyCats[e.day] || {})[e.cat] || 0) + e.min };
  }
  return town(byCat, [{ id: 'n', item: 'banc', x: 0, y: 0, at: at('2026-10-21T09:00:00Z'), paid: 2e6 }], {
    createdAt: at('2026-05-04T09:00:00Z'), history, stats: { ok: history.length, byCat, days, dailyCats },
    gifts: { 'visit:2026-10-20': at('2026-10-20T08:00:00Z'), 'visit:2026-10-23': at('2026-10-23T08:00:00Z') },
  });
}
// Lance une activité libre, l'horloge simulée : en Concentration, un saut d'horloge passerait pour une sortie de l'app.
async function startSession(page, name, minutes) {
  await page.locator('[data-tab="activites"]').click();
  await page.getByRole('button', { name: new RegExp('^' + name) }).first().click();
  await page.getByRole('radio', { name: minutes + ' min', exact: true }).click();
  await page.getByRole('radio', { name: 'Activité libre', exact: true }).click();
  await page.getByRole('button', { name: /^Commencer/ }).click();
  const warning = page.getByRole('button', { name: "C'est réglé, commencer", exact: true });
  if (await warning.isVisible()) await warning.click();
  await page.waitForFunction(() => window.__ville.activeState() === 'mine');
}
// … et la mène au bout.
async function runSession(page, name, minutes) {
  await startSession(page, name, minutes);
  await page.clock.fastForward(minutes * 60000 + 1000);
  await page.locator('#sessResult').waitFor();
}
const setVisibility = (page, value) => page.evaluate(state => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}, value);
// Une ville neuve, l'horloge simulée au mercredi 21 octobre 2026, avec une activité par domaine.
async function sessionTown(browser, settings = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Zurich' });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-21T10:00:00Z') });
  await page.addInitScript(state => { window.__VILLE_DEBUG__ = true; if (!localStorage.getItem('ville-bien-etre/v2')) localStorage.setItem('ville-bien-etre/v2', JSON.stringify(state)); },
    town({ esprit: 5 }, [], { activities: activities(), settings: { lang: 'fr', sound: false, ...settings } }));
  return { context, page, errors };
}

// Défis relevés à l'ouverture : 5 M chacun, une seule fois ; le Journal les montre relevés.
async function challengesAtOpening(browser, baseURL) {
  const seed = filledWeek();
  const { context, page, errors } = await cityAt(browser, baseURL, seed, '2026-10-25T16:00:00Z');
  try {
    await page.waitForFunction(() => /Défi relevé/.test(document.querySelector('#toast').textContent));
    assert.equal(await page.evaluate(() => __ville.state.coins), seed.coins + 15e6);
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => __ville.state.coins), seed.coins + 15e6);
    await page.locator('[data-tab="journal"]').click();
    assert.equal(await page.locator('#challengesCard .chal-row.done').count(), 3);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Défis : relevés à l’ouverture, une seule fois';
}

// Changer un défi : un seul par semaine, gardé au rechargement.
async function challengeSwap(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, town({ esprit: 5 }, [], { createdAt: at('2026-05-04T09:00:00Z') }), '2026-10-21T10:00:00Z');
  try {
    await page.locator('[data-tab="journal"]').click();
    const card = page.locator('#challengesCard'), swaps = card.getByRole('button', { name: /^Changer le défi/ });
    assert.equal(await card.locator('.chal-row').count(), 3);
    assert.equal(await swaps.count(), 3);
    const before = await card.locator('.chal-text').allInnerTexts();
    await swaps.first().click();
    const after = await card.locator('.chal-text').allInnerTexts();
    assert.notEqual(after[0], before[0]);
    assert.equal(await swaps.count(), 0);
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    await page.locator('[data-tab="journal"]').click();
    assert.deepEqual(await page.locator('#challengesCard .chal-text').allInnerTexts(), after);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Défis : changer un défi';
}

// Défi relevé par une séance : l'écran de fin le dit, avec sa récompense.
async function challengeOnResult(browser, baseURL) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Zurich' });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-21T10:00:00Z') });
  await page.addInitScript(state => { window.__VILLE_DEBUG__ = true; if (!localStorage.getItem('ville-bien-etre/v2')) localStorage.setItem('ville-bien-etre/v2', JSON.stringify(state)); },
    town({ esprit: 5 }, [], { createdAt: at('2026-05-04T09:00:00Z'), activities: activities(), settings: { lang: 'fr', sound: false } }));
  try {
    await page.goto(baseURL);
    await page.waitForFunction(() => !!window.__ville);
    const practice = (await page.evaluate(() => __ville.rituals.challenges()))[0];
    const cats = practice.id === 'comeback' ? [practice.cat] : practice.id === 'long' ? ['esprit'] : ['esprit', 'corps'];
    const minutes = practice.id === 'long' ? practice.m : 5;
    for (const [i, cat] of cats.entries()) {
      await runSession(page, 'Pratique ' + cat, minutes);
      if (i < cats.length - 1) await page.getByRole('button', { name: 'Retour à la ville', exact: true }).click();
    }
    assert.match(await page.locator('#sessResult').innerText(), /Défi relevé/);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Défis : relevé sur l’écran de fin';
}

// Mesure, dans la fenêtre ouverte, que rien ne déborde.
async function fitsSheet(page, label) {
  const w = await page.evaluate(() => ({ body: document.querySelector('#sheetBody').scrollWidth, client: document.querySelector('#sheetBody').clientWidth,
    doc: document.documentElement.scrollWidth, inner: innerWidth }));
  assert.ok(w.body <= w.client + 1 && w.doc <= w.inner, `${label} déborde : ${JSON.stringify(w)}`);
}
async function toEnglish(page) {
  await page.locator('#settingsBtn').click();
  await page.locator('#settingsLang').getByRole('radio', { name: 'English', exact: true }).click();
  await page.locator('#sheetClose').click();
}

// Bilan de la semaine : il s'ouvre une seule fois au début de la semaine, puis reste dans le Journal ; à 320 px, il tient.
async function weekReviewOnce(browser, baseURL) {
  const seed = { ...filledWeek(), rituals: { week: '', month: '', year: '' } };
  const { context, page, errors } = await cityAt(browser, baseURL, seed, '2026-10-27T09:00:00Z', { viewport: { width: 320, height: 640 } });
  try {
    await page.locator('#sheet').waitFor();
    assert.equal(await page.locator('#sheetTitle').innerText(), 'Ta semaine');
    assert.match(await page.locator('#sheetBody').innerText(), /19 oct\.[\s\S]*25 oct\./);
    await fitsSheet(page, 'le bilan (fr)');
    await page.locator('#sheetBody').getByRole('button', { name: "C'est parti", exact: true }).click();
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    await page.waitForTimeout(400);
    assert.equal(await page.locator('#sheet').isHidden(), true);
    await page.locator('[data-tab="journal"]').click();
    const card = page.locator('#ritualCards');
    assert.match(await card.innerText(), /Ta semaine dernière/);
    await card.getByRole('button', { name: 'Revoir', exact: true }).click();
    await page.locator('#sheet').waitFor();
    await page.locator('#sheetClose').click();
    await toEnglish(page);
    await page.locator('#ritualCards').getByRole('button', { name: 'See again', exact: true }).click();
    assert.equal(await page.locator('#sheetTitle').innerText(), 'Your week');
    await fitsSheet(page, 'le bilan (en)');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Bilan de la semaine : une fois, puis dans le Journal';
}

// Humeur : demandée sur l'écran de fin, notée d'un geste et gardée ; le réglage coupé ne la demande plus.
async function moodAfterSession(browser, baseURL) {
  for (const mood of [true, false]) {
    const { context, page, errors } = await sessionTown(browser, { mood });
    try {
      await page.goto(baseURL);
      await page.waitForFunction(() => !!window.__ville);
      await runSession(page, 'Pratique calme', 5);
      const picker = page.locator('#sessResult').getByRole('radiogroup', { name: 'Comment te sens-tu ?' });
      if (!mood) { assert.equal(await picker.count(), 0); continue; }
      await picker.getByRole('radio', { name: 'Bien', exact: true }).click();
      assert.equal(await picker.getByRole('radio', { name: 'Bien', exact: true }).getAttribute('aria-checked'), 'true');
      assert.equal(await page.evaluate(() => __ville.state.history[0].mood), 4);
      await page.reload();
      await page.waitForFunction(() => !!window.__ville);
      assert.equal(await page.evaluate(() => __ville.state.history[0].mood), 4);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return 'Humeur : notée sur l’écran de fin, ou pas demandée';
}

// Activité libre finie pendant que l'app était en arrière-plan : au retour, l'humeur demandée va à cette séance-là.
async function moodAfterReturn(browser, baseURL) {
  const { context, page, errors } = await sessionTown(browser);
  try {
    await page.goto(baseURL);
    await page.waitForFunction(() => !!window.__ville);
    await startSession(page, 'Pratique corps', 5);
    const id = await page.evaluate(() => __ville.state.active.id);
    await setVisibility(page, 'hidden');
    await page.clock.fastForward(7 * 60000);
    await setVisibility(page, 'visible');
    await page.locator('#sessResult').waitFor();
    await page.locator('#sessResult').getByRole('radio', { name: 'Très bien', exact: true }).click();
    assert.equal(await page.evaluate(entry => __ville.state.history.find(e => e.id === entry).mood, id), 5);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Humeur : au retour, sur la bonne séance';
}

const SCENARIOS = [challengesAtOpening, challengeSwap, challengeOnResult, weekReviewOnce, moodAfterSession, moodAfterReturn];
async function runRituals(browser, baseURL) {
  const scenarios = [];
  for (const scenario of SCENARIOS) scenarios.push(await scenario(browser, baseURL));
  return { scenarios };
}

module.exports = { runRituals, SCENARIOS, filledWeek, runSession, startSession, activities };
