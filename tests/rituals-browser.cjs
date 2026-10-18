const assert = require('node:assert/strict');
const { town } = require('./content-browser.cjs');
const { cityAt } = require('./ambient-browser.cjs');

// Étape 4, rituels et partage : chaque scénario est une fonction à part, qu'on peut lancer seule.
const CATS = ['esprit', 'corps', 'calme', 'foyer', 'crea'];
const at = iso => Date.parse(iso);
// Une activité par domaine, pour lancer des séances au choix.
const activities = () => CATS.map(cat => ({ id: 'a-' + cat, name: 'Pratique ' + cat, cat, min: 5, mode: 'free' }));
// La semaine du lundi 19 au dimanche 25 octobre 2026, où les défis de chaque famille sont relevés.
function filledWeek() {
  const entry = (day, cat, min, more = {}) => ({ id: 'h' + day + cat + min, name: 'Pratique ' + cat, cat, min, ok: true, reward: min * 1e6, at: at(day + 'T10:00:00Z'), day,
    source: 'direct', mode: 'focus', ...more });
  return town({ esprit: 10, corps: 60, calme: 10, foyer: 10, crea: 10 }, [{ id: 'n', item: 'banc', x: 0, y: 0, at: at('2026-10-21T09:00:00Z'), paid: 2e6 }], {
    createdAt: at('2026-05-04T09:00:00Z'),
    history: [entry('2026-10-19', 'esprit', 10, { at: at('2026-10-19T06:00:00Z') }), entry('2026-10-20', 'corps', 60, { at: at('2026-10-20T19:30:00Z') }),
      entry('2026-10-22', 'crea', 10), entry('2026-10-24', 'calme', 10, { source: 'wishes' }), entry('2026-10-24', 'foyer', 10)],
    gifts: { 'visit:2026-10-20': at('2026-10-20T08:00:00Z'), 'visit:2026-10-23': at('2026-10-23T08:00:00Z') },
  });
}
// Lance une activité libre et la mène au bout, l'horloge simulée : en Concentration, un saut d'horloge passerait pour une sortie de l'app.
async function runSession(page, name, minutes) {
  await page.locator('[data-tab="activites"]').click();
  await page.getByRole('button', { name: new RegExp('^' + name) }).first().click();
  await page.getByRole('radio', { name: minutes + ' min', exact: true }).click();
  await page.getByRole('radio', { name: 'Activité libre', exact: true }).click();
  await page.getByRole('button', { name: /^Commencer/ }).click();
  const warning = page.getByRole('button', { name: "C'est réglé, commencer", exact: true });
  if (await warning.isVisible()) await warning.click();
  await page.waitForFunction(() => window.__ville.activeState() === 'mine');
  await page.clock.fastForward(minutes * 60000 + 1000);
  await page.locator('#sessResult').waitFor();
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

const SCENARIOS = [challengesAtOpening, challengeSwap, challengeOnResult];
async function runRituals(browser, baseURL) {
  const scenarios = [];
  for (const scenario of SCENARIOS) scenarios.push(await scenario(browser, baseURL));
  return { scenarios };
}

module.exports = { runRituals, SCENARIOS, filledWeek, runSession, activities };
