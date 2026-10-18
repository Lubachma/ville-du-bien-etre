// Planche des dessins : des villes amorcées, photographiées dans test-results/planche/ pour une relecture à l'œil.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const basePath = '/ville-du-bien-etre/';
const out = path.join(root, 'test-results', 'planche');

// Les tables du jeu (éléments, succès), lues dans les sources comme l'app les déclare.
const context = vm.createContext({ TextEncoder, TextDecoder, Math, JSON });
vm.runInContext(fs.readFileSync(path.join(root, 'src', '00-core.js'), 'utf8') + '\nthis.data = { ITEMS, ids: ACHIEVEMENTS.map(a => a.id), cats: CAT_ORDER };', context);
const { ITEMS, ids, cats } = JSON.parse(JSON.stringify(context.data));
const NEW_ITEMS = ['lavoir', 'moulin', 'marche', 'musee', 'universite', 'planetarium', 'skatepark', 'escalade', 'gymnase', 'labyrinthe', 'source', 'pagode',
  'galerie', 'cinema', 'chapiteau', 'haie', 'cerisier', 'livres', 'lanterne', 'potager', 'cadran', 'pasjaponais', 'fanions', 'nichoir', 'statue'];
const WONDERS = Object.keys(ITEMS).filter(key => ITEMS[key].wonder);

// Une semaine pratiquée dans les cinq domaines (fleurs du Grand Arbre), des statistiques hautes et, au besoin, tous les succès.
const zurichDay = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(ms);
const week = Array.from({ length: 7 }, (_, i) => zurichDay(Date.now() - i * 864e5));
const day = (fill) => Object.fromEntries(week.map(d => [d, fill()]));
const tile = (item, x, y, stage) => ({ id: `${item}-${x}-${y}`, item, x, y, at: Date.now() - 864e5, paid: 0, ...(stage ? { stage } : {}) });
const town = (size, tiles, theme = 'light') => ({ v: 2, coins: 9e9, settings: { lang: 'fr', theme, sound: false },
  stats: { ok: 400, byCat: Object.fromEntries(cats.map(c => [c, 9000])), days: day(() => 60), dailyCats: day(() => Object.fromEntries(cats.map(c => [c, 12]))) },
  city: { size, tiles }, achievements: Object.fromEntries(ids.map(id => [id, Date.now() - 864e5])), clock: { tz: 'Europe/Zurich', maxSeen: 0, lastDay: week[0] } });
// Les cases d'un damier, du fond vers l'avant : les plus hauts éléments derrière, pour que chacun reste lisible.
const checker = size => Array.from({ length: size * size }, (_, i) => [i % size, Math.floor(i / size)])
  .filter(([x, y]) => (x + y) % 2 === 0).sort((p, q) => p[0] + p[1] - q[0] - q[1] || p[0] - q[0]);
function lay(keys, size, stage) {
  const cells = checker(size);
  return keys.map((key, i) => tile(key, ...cells[i], ITEMS[key].wonder ? stage : undefined));
}
const everything = Object.keys(ITEMS).sort((a, b) => ITEMS[b].hf - ITEMS[a].hf);

async function shoot(browser, baseURL, name, seed, { width = 560, height = 1000, scale = 2, carnet = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Zurich', serviceWorkers: 'block' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(state => localStorage.setItem('ville-bien-etre/v2', JSON.stringify(state)), seed);
  await page.goto(baseURL + '#debug');
  await page.waitForFunction(() => !!window.__ville);
  await page.evaluate(() => { const toast = document.querySelector('#toast'); if (toast) toast.hidden = true; });
  if (carnet) {
    await page.locator('[data-tab="journal"]').click();
    await page.locator('#carnetCard button').click();
    await page.getByRole('radio', { name: 'Collection', exact: true }).click();
    await page.locator('#sheet').screenshot({ path: path.join(out, name) });
  } else {
    await page.evaluate(() => window.__ville.City.draw());
    await page.locator('#city').screenshot({ path: path.join(out, name) });
  }
  await page.close();
  if (errors.length) throw new Error(name + ' : ' + errors.join(' | '));
  console.log('planche :', path.relative(root, path.join(out, name)));
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (!url.pathname.startsWith(basePath)) { res.writeHead(404).end(); return; }
      const name = url.pathname.slice(basePath.length) || 'index.html';
      const file = path.resolve(root, decodeURIComponent(name));
      if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' }[path.extname(name)] || 'text/plain';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' }); res.end(await fs.promises.readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseURL = `http://127.0.0.1:${server.address().port}${basePath}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    await shoot(browser, baseURL, 'ville-jour.png', town(11, lay(everything, 11, 4)));
    await shoot(browser, baseURL, 'ville-nuit.png', town(11, lay(everything, 11, 4), 'dark'));
    for (const stage of [1, 2, 3]) {
      await shoot(browser, baseURL, `merveilles-etape-${stage}.png`, town(7, WONDERS.map((key, i) => tile(key, 1 + 2 * i, 5 - 2 * i, stage))));
    }
    await shoot(browser, baseURL, 'ville-320.png', town(7, lay(NEW_ITEMS, 7)), { width: 320, height: 568, scale: 3 });
    await shoot(browser, baseURL, 'vignettes.png', town(7, []), { height: 2600, carnet: true });
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
