const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const playwright = require('playwright');
const engineName = process.env.BROWSER || 'chromium';
const engine = playwright[engineName];
assert.ok(engine && typeof engine.launch === 'function', `Unknown browser: ${engineName}`);
const root = path.resolve(__dirname, '..');
const basePath = '/ville-du-bien-etre/';
const key = 'ville-bien-etre/v2';
const errors = [];
const contexts = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
// Une séance peut relever un défi de la semaine (tiré selon la vraie date) : 5 M de plus par défi relevé.
// Pièces des cadeaux venus d'eux-mêmes pendant un parcours : défis relevés (5 M), étoiles d'harmonie (10 M, la ville de départ
// mérite déjà « Verdure ») et souhaits exaucés (3 M). Les parcours de séance comptent les pièces sans eux.
const BONUS = { 'chal:': 5e6, 'star:': 10e6, 'wish:': 3e6 };
const bonusCoins = state => Object.keys(state.gifts || {}).reduce((sum, key) => sum + (BONUS[key.slice(0, 5)] || 0), 0);
const coinsWithoutBonuses = page => page.evaluate(bonus => __ville.state.coins - Object.keys(__ville.state.gifts || {}).reduce((sum, key) => sum + (bonus[key.slice(0, 5)] || 0), 0), BONUS);
async function newPage(browser, url, options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', ...options });
  contexts.push(context);
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.waitForFunction(() => window.__ville);
  return { context, page };
}
async function chooseSession(page, { mode = 'free', activity = 'Méditation', duration = 5 } = {}) {
  await page.locator('[data-tab="activites"]').click();
  await page.getByRole('button', { name: new RegExp('^' + activity) }).first().click();
  await page.getByRole('radio', { name: duration + ' min', exact: true }).click();
  await page.getByRole('radio', { name: mode === 'free' ? 'Activité libre' : 'Concentration', exact: true }).click();
  await page.getByRole('button', { name: /^Commencer/ }).click();
  // La mise en garde « écran allumé » suit la demande au navigateur, parfois un peu plus tard : on attend la séance ou elle.
  await page.waitForFunction(() => window.__ville.activeState() === 'mine' || !!document.querySelector('#wakeAck'));
  const warning = page.getByRole('button', { name: "C'est réglé, commencer", exact: true });
  if (await warning.isVisible()) await warning.click();
  await page.waitForFunction(() => window.__ville.activeState() === 'mine');
}
(async () => {
  await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
  let workerSuffix = '';
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (!url.pathname.startsWith(basePath)) { res.writeHead(404).end(); return; }
      const name = url.pathname.slice(basePath.length) || 'index.html';
      const file = path.resolve(root, decodeURIComponent(name));
      if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
      const ext = path.extname(name);
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' }[ext] || 'text/plain';
      let content = await fs.readFile(file);
      if (name === 'sw.js' && workerSuffix) content = content.toString().replace(/const VERSION = '([^']+)'/, (_, version) => `const VERSION = '${version}${workerSuffix}'`);
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' }); res.end(content);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseURL = `http://127.0.0.1:${port}${basePath}`;
  let browser;
  try {
    browser = await engine.launch({ headless: true, ...(engineName === 'chromium' && process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
    {
      const { context, page } = await newPage(browser, baseURL + '#debug');
      await page.waitForFunction(() => window.VillePWA?.state === 'ready');
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
        for (const tab of ['ville', 'activites', 'tirage', 'journal']) {
          await page.locator(`[data-tab="${tab}"]`).click();
          const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, main: document.querySelector('#main').scrollWidth, client: document.querySelector('#main').clientWidth }));
          assert.ok(widths.document <= width, `${tab} document overflows at ${width}`);
          assert.ok(widths.main <= widths.client + 1, `${tab} content overflows at ${width}`);
        }
      }
      await page.setViewportSize({ width: 390, height: 844 }); await page.locator('[data-tab="ville"]').click();
      await page.screenshot({ path: path.join(root, 'test-results/ville-mobile.png') });
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
      // WebKit's setOffline rejects even responses produced entirely by a worker:
      // https://github.com/microsoft/playwright/issues/42775
      // Stop the real origin instead, then assert that navigation came from the worker.
      if (engineName === 'webkit') {
        await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
      } else await context.setOffline(true);
      const offlineResponse = await page.reload(); await page.waitForFunction(() => window.__ville);
      assert.equal(offlineResponse.fromServiceWorker(), true);
      assert.equal(await page.title(), 'Ville du bien-être');
      assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller));
      if (engineName === 'webkit') await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
      else await context.setOffline(false);
      await page.locator('#ctaStart').click();
      assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Activités');
      await page.getByRole('button', { name: /^Méditation/ }).click();
      await page.getByRole('radio', { name: '5 min', exact: true }).click();
      await page.getByRole('radio', { name: '5 min', exact: true }).press('ArrowRight');
      assert.equal(await page.getByRole('radio', { name: '10 min', exact: true }).getAttribute('aria-checked'), 'true');
      await page.locator('#sheetClose').click();
      await context.close();
      console.log('PASS: mobile/tablet layouts, keyboard focus/radios and offline under GitHub Pages subpath');
    }
    {
      const { context, page } = await newPage(browser, baseURL + '#debug');
      await page.clock.install();
      await chooseSession(page, { mode: 'focus' });
      await page.clock.runFor(300700);
      await page.waitForFunction(() => __ville.state.stats.ok === 1);
      const state = await page.evaluate(() => __ville.state);
      assert.equal(state.coins - bonusCoins(state), 10000000); assert.equal(state.stats.byCat.calme, 5); assert.equal(state.history[0].elapsedSec, 300);
      assert.match(await page.locator('#sessResult').innerText(), /Jardin zen/);
      await page.getByRole('button', { name: 'Retour à la ville', exact: true }).click();
      await page.getByRole('button', { name: 'Construire', exact: true }).click();
      await page.getByRole('button', { name: /Placer Jardin zen/ }).click();
      await page.locator('#city').focus(); await page.locator('#city').press('ArrowLeft'); await page.locator('#city').press('ArrowLeft');
      await page.locator('#city').press('Enter'); await page.locator('#placeConfirm').click();
      await page.reload(); await page.waitForFunction(() => __ville.state.city.tiles.some(t => t.item === 'jardin'));
      assert.equal(await coinsWithoutBonuses(page), 2000000);
      await context.close(); console.log('PASS: focus session reward/unlock, construction and reload persistence');
    }
    {
      const { context, page } = await newPage(browser, baseURL + '#debug');
      await page.clock.install(); await chooseSession(page, { mode: 'free' });
      await page.clock.runFor(90000);
      const activeId = await page.evaluate(() => __ville.state.active.id);
      await page.reload(); await page.waitForFunction(() => __ville.activeState() === 'mine');
      assert.equal(await page.evaluate(() => __ville.state.active.id), activeId);
      await page.clock.runFor(211000); await page.waitForFunction(() => __ville.state.stats.ok === 1);
      await page.reload(); await page.waitForFunction(() => window.__ville);
      assert.equal(await coinsWithoutBonuses(page), 10000000);
      assert.equal(await page.evaluate(() => __ville.state.history.filter(e => e.id === __ville.state.history[0].id).length), 1);
      await context.close(); console.log('PASS: free session survives reload and rewards once');
    }
    {
      const { context, page } = await newPage(browser, baseURL + '#debug');
      await page.evaluate(k => localStorage.setItem(k, '{broken'), key); await page.reload(); await page.waitForFunction(() => window.__ville);
      assert.ok(await page.locator('#storageStatus').isVisible());
      const original = await page.evaluate(() => __ville.Store.recoveryRaw);
      assert.equal(original, '{broken');
      await page.locator('[data-tab="activites"]').click(); await page.locator('#editActs').click();
      await page.locator('#actName').fill('Nouvelle activité conservée'); await page.locator('#addActForm button[type="submit"]').click();
      await page.reload(); await page.waitForFunction(() => window.__ville);
      assert.ok(await page.evaluate(() => __ville.state.activities.some(a => a.name === 'Nouvelle activité conservée')));
      assert.ok(await page.evaluate(() => Object.keys(localStorage).some(k => k.includes(':recovery:') && localStorage.getItem(k) === '{broken')));
      await context.close(); console.log('PASS: corrupted local data is preserved and new progression persists after repair');
    }
    {
      const { context, page: a } = await newPage(browser, baseURL + '#debug');
      await a.locator('#settingsBtn').click();
      await a.getByRole('switch', { name: "Garder l'écran allumé pendant une session", exact: true }).click();
      await a.locator('#sheetClose').click();
      const b = await context.newPage(); await b.goto(baseURL + '#debug'); await b.waitForFunction(() => window.__ville);
      for (const p of [a, b]) {
        await p.locator('[data-tab="activites"]').click(); await p.getByRole('button', { name: /^Lecture/ }).click();
        await p.getByRole('button', { name: /^Commencer/ }).click();
        await p.getByRole('button', { name: "C'est réglé, commencer", exact: true }).waitFor();
      }
      await a.getByRole('button', { name: "C'est réglé, commencer", exact: true }).click();
      await b.getByRole('button', { name: "C'est réglé, commencer", exact: true }).click();
      await pause(250);
      const states = await Promise.all([a, b].map(p => p.evaluate(() => ({ id: __ville.state.active?.id, mine: __ville.activeState() === 'mine', logs: __ville.log.length }))));
      assert.equal(states.filter(s => s.mine).length, 1); assert.equal(states[0].id, states[1].id);
      assert.ok(states.every(s => s.logs < 100), JSON.stringify(states));
      await context.close(); console.log('PASS: old confirmations across two tabs cannot start competing sessions');
    }
    {
      const { context, page } = await newPage(browser, baseURL + '#debug');
      await page.evaluate(k => {
        const old = structuredClone(__ville.state);
        old.v = 1; old.coins = 12000000;
        old.active = { id: 'legacy-live', name: 'Lecture', cat: 'esprit', min: 5, bonus: 0, startedAt: Date.now(), dev: __ville.Store.device, tab: 'old-tab' };
        localStorage.removeItem(k);
        localStorage.setItem('ville-bien-etre/v1', JSON.stringify(old));
        localStorage.setItem('ville-bien-etre/v1:beat', JSON.stringify({ id: old.active.id, at: Date.now() }));
      }, key);
      await page.reload(); await page.waitForFunction(() => __ville.Store.migrationPending);
      assert.ok(await page.locator('#settingsBtn').isDisabled());
      assert.equal(await page.locator('.tabbar').evaluate(el => el.inert), true);
      assert.equal(await page.evaluate(k => localStorage.getItem(k), key), null);
      await page.evaluate(() => {
        const old = JSON.parse(localStorage.getItem('ville-bien-etre/v1'));
        old.active = null; old.coins = 17000000;
        localStorage.setItem('ville-bien-etre/v1', JSON.stringify(old));
      });
      await page.getByRole('button', { name: 'Reprendre après la session', exact: true }).click();
      await page.waitForFunction(() => !__ville.Store.migrationPending);
      assert.equal(await page.evaluate(() => __ville.state.coins), 17000000);
      assert.equal(await page.locator('.tabbar').evaluate(el => el.inert), false);
      await page.evaluate(() => {
        const old = JSON.parse(localStorage.getItem('ville-bien-etre/v1'));
        old.coins = 0;
        localStorage.setItem('ville-bien-etre/v1', JSON.stringify(old));
      });
      await page.reload(); await page.waitForFunction(() => window.__ville);
      assert.equal(await page.evaluate(() => __ville.state.coins), 17000000);
      await context.close(); console.log('PASS: v1 migration waits for a live session, copies latest progression and isolates old tabs');
    }
    {
      const { context, page } = await newPage(browser, baseURL + '#debug');
      await page.addInitScript(k => {
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function(name, value) {
          if (name === k && sessionStorage.getItem('test-quota') === '1') throw new DOMException('Quota exceeded', 'QuotaExceededError');
          return set.call(this, name, value);
        };
      }, key);
      await page.evaluate(k => {
        const old = structuredClone(__ville.state); old.v = 1; old.coins = 42000000;
        old.personal.name = 'Ville conservée';
        localStorage.removeItem(k); localStorage.setItem('ville-bien-etre/v1', JSON.stringify(old));
        sessionStorage.setItem('test-quota', '1');
      }, key);
      await page.reload(); await page.waitForFunction(() => __ville.Store.migrationReason === 'storage');
      assert.equal(await page.evaluate(() => __ville.state.coins), 42000000);
      assert.equal(await page.locator('.brand-name').innerText(), 'Ville conservée');
      assert.ok(await page.locator('#storageStatus').getByRole('button', { name: 'Exporter ma progression' }).isEnabled());
      assert.equal(await page.evaluate(k => localStorage.getItem(k), key), null);
      await page.evaluate(() => sessionStorage.removeItem('test-quota'));
      await page.getByRole('button', { name: 'Réessayer la copie', exact: true }).click();
      await page.waitForFunction(() => !__ville.Store.migrationPending);
      await page.reload(); await page.waitForFunction(() => window.__ville);
      assert.equal(await page.evaluate(() => __ville.state.coins), 42000000);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ville-bien-etre/v1')).coins), 42000000);
      await context.close(); console.log('PASS: storage quota during migration preserves the visible city and retries safely');
    }
    {
      const result = await require('./features-browser.cjs').runFeatures(browser, baseURL + '#debug');
      console.log('PASS: ' + result.scenarios.join('; '));
    }
    {
      const result = await require('./i18n-browser.cjs').runI18n(browser, baseURL + '#debug');
      console.log('PASS: ' + result.scenarios.join('; '));
    }
    {
      const result = await require('./streak-browser.cjs').runStreak(browser, baseURL + '#debug');
      console.log('PASS: ' + result.scenarios.join('; '));
    }
    {
      const result = await require('./settings-browser.cjs').runSettings(browser, baseURL + '#debug');
      console.log('PASS: ' + result.scenarios.join('; '));
    }
    {
      const result = await require('./content-browser.cjs').runContent(browser, baseURL + '#debug');
      console.log('PASS: ' + result.scenarios.join('; '));
    }
    {
      const result = await require('./ambient-browser.cjs').runAmbient(browser, baseURL + '#debug');
      console.log('PASS: ' + result.scenarios.join('; '));
    }
    {
      const result = await require('./minors-browser.cjs').runMinors(browser, baseURL + '#debug');
      console.log('PASS: ' + result.scenarios.join('; '));
    }
    {
      const result = await require('./rituals-browser.cjs').runRituals(browser, baseURL + '#debug');
      console.log('PASS: ' + result.scenarios.join('; '));
    }
    {
      const result = await require('./harmony-browser.cjs').runHarmony(browser, baseURL + '#debug');
      console.log('PASS: ' + result.scenarios.join('; '));
    }
    {
      const result = await require('./companion-browser.cjs').runCompanion(browser, baseURL + '#debug');
      console.log('PASS: ' + result.scenarios.join('; '));
    }
    {
      const { context, page } = await newPage(browser, baseURL + '#debug');
      await page.evaluate(() => {
        window.installCalls = 0;
        const e = new Event('beforeinstallprompt', { cancelable: true });
        e.prompt = () => { window.installCalls++; return Promise.resolve(); };
        e.userChoice = Promise.resolve({ outcome: 'dismissed' });
        window.dispatchEvent(e);
      });
      await page.locator('#installCard [data-act="install"]').click();
      assert.equal(await page.locator('#installCard [data-act="install"]').isVisible(), false);
      assert.match(await page.locator('#installCard .install-help').innerText(), /menu de ton navigateur/);
      assert.equal(await page.evaluate(() => window.installCalls), 1);
      await page.waitForFunction(() => window.VillePWA?.state === 'ready' && window.VillePWA.version);
      const previous = await page.evaluate(() => VillePWA.version);
      const other = await context.newPage(); await other.goto(baseURL + '#debug');
      await other.waitForFunction(() => window.VillePWA?.version);
      await other.evaluate(() => { window.keepThisPage = true; });
      workerSuffix = '-test-update';
      await page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); await reg.update(); });
      await page.waitForFunction(() => VillePWA.update);
      assert.equal(await page.evaluate(() => VillePWA.version), previous);
      await page.clock.install(); await chooseSession(page, { mode: 'free' });
      await page.clock.fastForward(301000); await page.waitForFunction(() => __ville.state.stats.ok === 1);
      await page.getByRole('button', { name: 'Retour à la ville', exact: true }).click();
      await Promise.all([page.waitForNavigation(), page.locator('#updateNotice').getByRole('button', { name: 'Mettre à jour', exact: true }).click()]);
      await page.waitForFunction(() => __ville.state.stats.ok === 1 && VillePWA.version.endsWith('-test-update'));
      assert.equal(await coinsWithoutBonuses(page), 10000000);
      await other.waitForFunction(() => VillePWA.reloadAvailable && !__ville.state.active);
      assert.equal(await other.evaluate(() => window.keepThisPage), true);
      await Promise.all([other.waitForNavigation(), other.locator('#updateNotice').getByRole('button', { name: 'Mettre à jour', exact: true }).click()]);
      await other.waitForFunction(() => window.__ville && VillePWA.version.endsWith('-test-update'));
      assert.equal(await other.evaluate(() => !!window.keepThisPage), false);
      assert.equal(await other.evaluate(() => __ville.state.stats.ok), 1);
      await context.close(); workerSuffix = '';
      console.log('PASS: installation dismissal fallback and deferred service-worker update preserve progression');
    }
    assert.deepEqual(errors, []);
    console.log(`${engineName}: browser checks passed; no application JavaScript errors.`);
  } finally {
    if (browser) await browser.close(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
