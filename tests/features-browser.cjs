const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

async function runFeatures(browser, baseURL = process.env.BASE_URL || 'http://127.0.0.1:8766/index.html#debug') {
  const context = await browser.newContext({ viewport: { width: 320, height: 760 }, reducedMotion: 'reduce', acceptDownloads: true, locale: 'fr-FR' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const output = path.join(__dirname, '..', 'test-results');
  await fs.mkdir(output, { recursive: true });
  try {
    await page.clock.install();
    const url = new URL(baseURL);
    url.hash = 'debug';
    await page.goto(url.href);
    await page.waitForFunction(() => !!window.__ville);
    // Un profil isolé et deux étapes courtes permettent de tester les transitions
    // sans accélérer la boucle d’un chrono de concentration.
    const ids = await page.evaluate(() => {
      const state = window.__ville.state;
      state.activities[0].mode = 'free'; state.activities[0].min = 1;
      state.activities[1].mode = 'free'; state.activities[1].min = 1;
      state.updatedAt = Date.now() + 1;
      window.__ville.Store.saveLocal();
      return state.activities.slice(0, 2).map(a => a.id);
    });
    await page.reload();
    await page.locator('[data-tab="activites"]').click();
    await page.getByRole('button', { name: 'Créer ma première routine' }).click();
    await page.locator('#routineName').fill('Mon matin tranquille');
    await page.locator('#routineActivity').selectOption(ids[0]);
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await page.locator('#routineActivity').selectOption(ids[1]);
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    assert.equal(await page.locator('.routine-steps li').count(), 2);
    assert.equal(await page.locator('#sheetBody').evaluate(el => el.scrollWidth <= el.clientWidth), true);
    await page.screenshot({ path: path.join(output, 'features-routine-editor-320.png'), fullPage: true });
    await page.getByRole('button', { name: 'Monter l’étape 2 : Sport', exact: true }).click();
    assert.match(await page.locator('.routine-steps li').first().innerText(), /Sport/);
    await page.getByRole('button', { name: 'Enregistrer la routine' }).click();
    await page.locator('#routinesCard').getByRole('button', { name: 'Lancer', exact: true }).click();
    await page.locator('#sessRun').waitFor({ state: 'visible' });
    assert.match(await page.locator('#sessName').innerText(), /Sport/);
    await page.clock.fastForward(61000);
    await page.getByRole('button', { name: 'Étape suivante', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__ville.state.routineRun.next), 1);
    assert.equal(await page.evaluate(() => window.__ville.state.active), null);
    await page.getByRole('button', { name: 'Reprendre plus tard', exact: true }).click();
    await page.reload();
    await page.locator('[data-tab="activites"]').click();
    await page.getByRole('button', { name: 'Reprendre la routine', exact: true }).click();
    await page.locator('#sessRun').waitFor({ state: 'visible' });
    assert.match(await page.locator('#sessName').innerText(), /Lecture/);
    await page.clock.fastForward(61000);
    await page.getByRole('heading', { name: 'Routine terminée !' }).waitFor();
    const finished = await page.evaluate(() => window.__ville.state.routineRun);
    assert.equal(finished.status, 'done');
    assert.equal(finished.completed, 2);
    assert.equal(finished.minutes, 2);
    assert.ok(finished.reward >= 2e6);
    assert.equal(await page.getByRole('button', { name: 'Étape suivante', exact: true }).count(), 0);
    await page.screenshot({ path: path.join(output, 'features-routine-320.png'), fullPage: true });
    await page.getByRole('button', { name: 'Retour à la ville', exact: true }).click();

    await page.locator('[data-tab="journal"]').click();
    await page.locator('#goalsCard').getByRole('button', { name: 'Modifier' }).click();
    // Valeur hors limites : un message sous le champ, qui revient sous les yeux. Sur iPhone, la bulle du navigateur
    // n'apparaît pas toujours, et « Enregistrer » semblait ne rien faire.
    await page.locator('#goalMinutes').fill('1500');
    await page.locator('#sheet').getByRole('button', { name: 'Enregistrer', exact: true }).click();
    const goalError = page.locator('#sheet [role="alert"]');
    assert.equal(await goalError.count(), 1);
    assert.match(await goalError.innerText(), /entre 5 et 1260\./);
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'goalMinutes');
    await page.locator('#goalMinutes').fill('5');
    assert.equal(await goalError.count(), 0);
    await page.locator('#goalDays').selectOption('1');
    await page.locator('#goalCat').selectOption('all');
    await page.locator('#goalBuilding').selectOption('ecole');
    await page.locator('#sheet').getByRole('button', { name: 'Enregistrer', exact: true }).click();
    assert.match(await page.locator('#goalsCard').innerText(), /2 \/ 5/);
    assert.match(await page.locator('#goalsCard').innerText(), /École/);
    await page.reload();
    await page.locator('[data-tab="journal"]').click();
    assert.match(await page.locator('#goalsCard').innerText(), /2 \/ 5/);
    assert.equal(await page.evaluate(() => window.__ville.state.goals.days), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, 'features-journal-320.png'), fullPage: true });

    await page.locator('[data-tab="ville"]').click();
    await page.locator('#personalizeCity').click();
    await page.locator('#cityName').fill('');
    await page.getByRole('button', { name: 'Enregistrer le nom', exact: true }).click();
    assert.equal(await page.locator('#sheet [role="alert"]').innerText(), 'Ce champ est à remplir.');
    // Un nom fait seulement de caractères invisibles (remplissage hangeul) ne s'enregistre pas ; ceux d'un vrai nom sont retirés.
    await page.locator('#cityName').fill('\u{3164}');
    await page.getByRole('button', { name: 'Enregistrer le nom', exact: true }).click();
    assert.equal(await page.locator('#cityName').isVisible(), true);
    assert.equal(await page.evaluate(() => window.__ville.state.personal.name), '');
    await page.locator('#cityName').fill('  Le jardin\u{2028} \u{200b}tranquille\u{3164} ');
    await page.getByRole('button', { name: 'Enregistrer le nom', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__ville.state.personal.name), 'Le jardin tranquille');
    await page.reload();
    await page.locator('#personalizeCity').click();
    assert.equal(await page.locator('#cityName').inputValue(), 'Le jardin tranquille');
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Enregistrer une image de ma ville', exact: true }).click();
    const download = await downloadEvent;
    const pngPath = path.join(output, 'features-ville.png');
    await download.saveAs(pngPath);
    const png = await fs.readFile(pngPath);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.ok(png.readUInt32BE(16) >= 1200);
    assert.ok(png.readUInt32BE(20) > 500);
    assert.deepEqual(errors, []);
    return { passed: 3, scenarios: ['Routine ordonnée, pause, rechargement et bilan', 'Objectif hebdomadaire enregistré et mobile 320 px', 'Nom de ville persistant et export PNG'], artifacts: output };
  } finally { await context.close(); }
}
module.exports = { runFeatures };
if (require.main === module) {
  (async () => {
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    try { console.log(JSON.stringify(await runFeatures(browser), null, 2)); }
    finally { await browser.close(); }
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
