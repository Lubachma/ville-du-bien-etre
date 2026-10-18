const assert = require('node:assert/strict');
const { town } = require('./content-browser.cjs');

// Ville ouverte à un instant fixé avant le chargement : son horloge part de là (elle garde l'heure la plus avancée).
async function cityAt(browser, baseURL, seed, time, options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Zurich', ...options });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (time) await page.clock.setFixedTime(new Date(time));
  if (seed) await page.addInitScript(state => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('ville-bien-etre/v2', JSON.stringify(state));
  }, seed);
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__ville);
  return { context, page, errors };
}
const skyTop = page => page.evaluate(() => getComputedStyle(document.querySelector('#sky')).getPropertyValue('--sky-top').trim());
const luma = hex => { const n = parseInt(hex.slice(1), 16); return (.2126 * (n >> 16) + .7152 * (n >> 8 & 255) + .0722 * (n & 255)) / 255; };

async function runAmbient(browser, baseURL) {
  const scenarios = [];
  // Ciel selon l'heure : nuit à 22 h, journée à midi (Zurich, 1er juillet) ; « Selon l'apparence » rend le ciel du thème.
  {
    const night = await cityAt(browser, baseURL, town({ esprit: 5 }), '2026-07-01T20:00:00Z');
    try {
      const top = await skyTop(night.page);
      assert.ok(top && luma(top) < .2, 'ciel de nuit : ' + top);
      await night.page.evaluate(() => { __ville.state.settings.sky = 'theme'; __ville.City.draw(); });
      assert.equal(await skyTop(night.page), '#d3e8e0');
      assert.deepEqual(night.errors, []);
    } finally { await night.context.close(); }
    const noon = await cityAt(browser, baseURL, town({ esprit: 5 }), '2026-07-01T10:00:00Z');
    try {
      const top = await skyTop(noon.page);
      assert.ok(top && luma(top) > .6, 'ciel de midi : ' + top);
      assert.deepEqual(noon.errors, []);
    } finally { await noon.context.close(); }
    scenarios.push("Ciel selon l'heure");
  }
  return { scenarios };
}

module.exports = { runAmbient, cityAt, luma };
