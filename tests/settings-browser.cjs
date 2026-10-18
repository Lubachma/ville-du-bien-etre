const assert = require('node:assert/strict');

// Espions installés avant le chargement : oscillateurs créés, gains demandés, vibrations.
function spies(vibrate) {
  window.__audio = { oscillators: 0, ramps: [] };
  window.__vibrations = [];
  const AC = window.AudioContext || window.webkitAudioContext;
  const create = AC.prototype.createOscillator;
  AC.prototype.createOscillator = function () { window.__audio.oscillators++; return create.call(this); };
  const ramp = AudioParam.prototype.exponentialRampToValueAtTime;
  AudioParam.prototype.exponentialRampToValueAtTime = function (value, time) { window.__audio.ramps.push(value); return ramp.call(this, value, time); };
  if (vibrate) Navigator.prototype.vibrate = function (pattern) { window.__vibrations.push(pattern); return true; };
  else delete Navigator.prototype.vibrate;
}
async function openSessions(page) {
  if (await page.locator('#sheet').isVisible()) await page.locator('#sheetClose').click();
  await page.locator('#settingsBtn').click();
  await page.locator('#settingsSessions').waitFor();
  return page.locator('#settingsSessions');
}
async function newTown(browser, baseURL, vibrate) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(spies, vibrate);
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__ville);
  return { context, page, errors };
}

async function runSettings(browser, baseURL) {
  // Sans vibreur : chaque son se joue, le volume suit doux < normal < fort, pas d'interrupteur Vibration.
  {
    const { context, page, errors } = await newTown(browser, baseURL, false);
    try {
      const section = await openSessions(page);
      for (const name of ['Bol', 'Clochettes', 'Carillon']) {
        const before = await page.evaluate(() => window.__audio.oscillators);
        await section.getByRole('radio', { name, exact: true }).click();
        assert.ok(await page.evaluate(() => window.__audio.oscillators) > before, 'aucun son pour ' + name);
      }
      const peaks = [];
      for (const name of ['Doux', 'Normal', 'Fort']) {
        await page.evaluate(() => { window.__audio.ramps = []; });
        await section.getByRole('radio', { name, exact: true }).click();
        peaks.push(await page.evaluate(() => Math.max(...window.__audio.ramps)));
      }
      assert.ok(peaks[0] < peaks[1] && peaks[1] < peaks[2], 'volumes : ' + peaks.join(' < '));
      assert.equal(await section.getByRole('switch', { name: "Vibrer à la fin d'une session" }).count(), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  // Avec vibreur : l'interrupteur apparaît, et la fin de session vibre même son coupé.
  {
    const { context, page, errors } = await newTown(browser, baseURL, true);
    try {
      const section = await openSessions(page);
      assert.equal(await section.getByRole('switch', { name: "Vibrer à la fin d'une session" }).count(), 1);
      await section.getByRole('switch', { name: "Sonner à la fin d'une session" }).click();
      assert.equal(await page.evaluate(() => __ville.state.settings.sound), false);
      await page.locator('#sheetClose').click();
      await page.clock.install();
      await page.locator('[data-tab="activites"]').click();
      await page.getByRole('button', { name: /^Méditation/ }).click();
      await page.getByRole('radio', { name: '5 min', exact: true }).click();
      await page.getByRole('radio', { name: 'Activité libre', exact: true }).click();
      await page.getByRole('button', { name: /^Commencer/ }).click();
      await page.waitForFunction(() => window.__ville.activeState() === 'mine');
      await page.clock.fastForward(301000);
      await page.waitForFunction(() => __ville.state.stats.ok === 1);
      assert.deepEqual(await page.evaluate(() => window.__vibrations), [[160, 90, 160]]);
      assert.equal(await page.evaluate(() => window.__audio.oscillators), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return { scenarios: ['Son de fin : type, volume et vibration'] };
}
module.exports = { runSettings };
