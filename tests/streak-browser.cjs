const assert = require('node:assert/strict');

// Ville préparée : sessions réussies les 15 et 16 octobre, on est le samedi 17 à midi.
const SEED = { v: 2, coins: 5e6, settings: { lang: 'fr' },
  stats: { ok: 2, byCat: { calme: 20 }, days: { '2026-10-15': 10, '2026-10-16': 10 } },
  clock: { tz: 'Europe/Zurich', maxSeen: 0, lastDay: '2026-10-16' } };

async function settings(page) {
  if (await page.locator('#sheet').isVisible()) await page.locator('#sheetClose').click();
  await page.locator('#settingsBtn').click();
  await page.locator('#settingsStreak').waitFor();
  return page.locator('#settingsStreak');
}

async function runStreak(browser, baseURL) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Zurich' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.clock.install({ time: new Date('2026-10-17T12:00:00+02:00') });
    await page.addInitScript(seed => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('ville-bien-etre/v2', JSON.stringify(seed));
    }, SEED);
    await page.goto(baseURL);
    await page.waitForFunction(() => !!window.__ville);
    assert.equal(await page.locator('#streak').innerText(), '2\u00a0j');

    // Aucun jour de repos : hier est actif, la série tient.
    let section = await settings(page);
    await section.getByRole('radio', { name: '0', exact: true }).click();
    assert.equal(await page.evaluate(() => __ville.state.settings.restDays), 0);
    assert.equal(await page.locator('#streak').innerText(), '2\u00a0j');

    // Pause : icône dans l'en-tête et message dans le Journal.
    await section.getByRole('button', { name: 'Mettre ma série en pause', exact: true }).click();
    assert.equal(await page.locator('#streakChip use').getAttribute('href'), '#i-pause');
    assert.match(await page.locator('#settingsStreak').innerText(), /En pause depuis le/);
    await page.locator('#sheetClose').click();
    await page.locator('[data-tab="journal"]').click();
    assert.match(await page.locator('#kpis').innerText(), /En pause depuis le/);
    section = await settings(page);
    await section.getByRole('button', { name: 'Reprendre ma série', exact: true }).click();
    assert.equal(await page.locator('#streakChip use').getAttribute('href'), '#i-flame');
    assert.deepEqual(await page.evaluate(() => __ville.state.pauses), []);

    // Série masquée : plus de pastille, le Journal compte les jours actifs de la semaine.
    await page.locator('#settingsStreak').getByRole('switch', { name: 'Masquer la série', exact: true }).click();
    assert.equal(await page.locator('#streakChip').isVisible(), false);
    await page.locator('#sheetClose').click();
    assert.match(await page.locator('#kpis').innerText(), /Jours actifs cette semaine/);

    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    assert.equal(await page.locator('#streakChip').isVisible(), false);
    assert.equal(await page.evaluate(() => __ville.state.settings.restDays), 0);
    assert.deepEqual(errors, []);
    return { scenarios: ['Série : jours de repos, pause, masquage et rechargement'] };
  } finally { await context.close(); }
}
module.exports = { runStreak };
