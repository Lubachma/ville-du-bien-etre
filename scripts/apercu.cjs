// Images d'aperçu : l'image des liens (1200 × 630) et trois captures d'écran (780 × 1688) pour le manifeste, écrites dans apercu/.
// À relancer quand l'apparence change : `npm run build && npm run apercu` (PLAYWRIGHT_CHANNEL=chrome pour réutiliser un Chrome installé).
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const basePath = '/ville-du-bien-etre/';
const out = path.join(root, 'apercu');

// Les tables du jeu, lues dans les sources comme l'app les déclare.
const context = vm.createContext({ TextEncoder, TextDecoder, Math, JSON });
vm.runInContext(fs.readFileSync(path.join(root, 'src', '00-core.js'), 'utf8') + '\nthis.data = { ids: ACHIEVEMENTS.map(a => a.id), cats: CAT_ORDER };', context);
const { ids, cats } = JSON.parse(JSON.stringify(context.data));

// Une ville de 9 × 9 et son compagnon, d'une personne qui pratique depuis des mois. Date de création fixe : mêmes habitants à chaque fois.
const DAY = 864e5;
const zurichDay = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(ms);
const week = Array.from({ length: 7 }, (_, i) => zurichDay(Date.now() - (i + 1) * DAY));
const tile = (item, x, y, stage) => ({ id: `${item}-${x}-${y}`, item, x, y, at: Date.now() - 3 * DAY, paid: 0, ...(stage ? { stage } : {}) });
const TILES = [
  ['phare', 0, 0, 3], ['bibliotheque', 2, 0], ['arbre', 4, 0], ['cerisier', 6, 0], ['moulin', 8, 0],
  ['arbre', 1, 1], ['maison', 3, 1], ['boulangerie', 5, 1], ['marche', 7, 1],
  ['haie', 0, 2], ['fontaine', 2, 2], ['chemin', 4, 2], ['pavillon', 6, 2], ['arbre', 8, 2],
  ['jardin', 1, 3], ['chemin', 3, 3], ['banc', 5, 3], ['etang', 7, 3],
  ['potager', 0, 4], ['kiosque', 2, 4], ['chemin', 4, 4], ['fleurs', 6, 4], ['cabane', 8, 4],
  ['fleurs', 1, 5], ['chemin', 3, 5], ['lanterne', 5, 5], ['cerisier', 7, 5],
  ['arbre', 2, 6], ['fleurs', 4, 6], ['statue', 6, 6], ['fanions', 3, 7], ['arbre', 5, 7],
].map(([item, x, y, stage]) => tile(item, x, y, stage));
const state = extra => ({ v: 2, createdAt: 1733259800000, coins: 0,
  settings: { lang: 'fr', theme: 'light', sound: false, townWishes: false, rituals: false },
  stats: { ok: 60, ko: 0, byCat: Object.fromEntries(cats.map(c => [c, 400])), days: Object.fromEntries(week.map(d => [d, 40])),
    dailyCats: Object.fromEntries(week.map(d => [d, Object.fromEntries(cats.map(c => [c, 8]))])) },
  city: { size: 9, tiles: TILES },
  companion: { species: 'ourson', name: 'Caramel', since: Date.now() - 40 * DAY, minutes: 600, wear: 'echarpe' },
  achievements: Object.fromEntries(ids.slice(0, 14).map(id => [id, Date.now() - 5 * DAY])),
  activities: [{ id: 'a-calme', name: 'Respirer', cat: 'calme', min: 5, mode: 'free' }, { id: 'a-esprit', name: 'Lire', cat: 'esprit', min: 15, mode: 'free' },
    { id: 'a-corps', name: 'Étirements', cat: 'corps', min: 10, mode: 'free' }],
  clock: { tz: 'Europe/Zurich', maxSeen: 0, lastDay: week[0] }, ...extra });
// Fin d'après-midi d'été, au soleil, sans fête ni visiteur.
const GOLDEN = { season: 'summer', moment: { name: 'golden', t: .5 }, weather: 'sun', rainbow: false, festivals: [], visitor: null };

async function open(browser, baseURL, seed, { width = 390, height = 844, scale = 2 } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Zurich', serviceWorkers: 'block' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(s => { localStorage.setItem('ville-bien-etre/v1:backup-at', String(Date.now())); if (!localStorage.getItem('ville-bien-etre/v2')) localStorage.setItem('ville-bien-etre/v2', JSON.stringify(s)); }, seed);
  await page.goto(baseURL + '#debug');
  await page.waitForFunction(() => !!window.__ville);
  await page.evaluate(f => { window.__ville.state.settings.ambient = false; window.__ville.ambient.force(f); window.__ville.renderAll(); const toast = document.querySelector('#toast'); if (toast) toast.hidden = true; }, GOLDEN);
  return { page, errors };
}
async function close({ page, errors }, name) {
  await page.close();
  if (errors.length) throw new Error(name + ' : ' + errors.join(' | '));
  console.log('apercu :', path.join('apercu', name));
}

async function screens(browser, baseURL) {
  let shot = await open(browser, baseURL, state());
  await shot.page.waitForTimeout(300);
  await shot.page.screenshot({ path: path.join(out, 'ecran-ville.png') });
  await close(shot, 'ecran-ville.png');

  shot = await open(browser, baseURL, state({ settings: { lang: 'fr', theme: 'light', sound: false, townWishes: false, rituals: false, breathing: true } }));
  await shot.page.locator('[data-tab="activites"]').click();
  await shot.page.getByRole('button', { name: /^Respirer/ }).first().click();
  await shot.page.getByRole('radio', { name: '5 min', exact: true }).click();
  await shot.page.getByRole('radio', { name: 'Activité libre', exact: true }).click();
  await shot.page.getByRole('button', { name: /^Commencer/ }).click();
  const warning = shot.page.getByRole('button', { name: "C'est réglé, commencer", exact: true });
  await warning.waitFor({ timeout: 1500 }).then(() => warning.click(), () => {});
  await shot.page.waitForFunction(() => window.__ville.activeState() === 'mine');
  await shot.page.waitForTimeout(2500);
  await shot.page.evaluate(() => { const toast = document.querySelector('#toast'); if (toast) toast.hidden = true; });
  await shot.page.screenshot({ path: path.join(out, 'ecran-seance.png') });
  await close(shot, 'ecran-seance.png');

  shot = await open(browser, baseURL, state());
  await shot.page.locator('[data-tab="journal"]').click();
  await shot.page.locator('#carnetCard button').click();
  await shot.page.getByRole('radio', { name: 'Collection', exact: true }).click();
  await shot.page.waitForTimeout(300);
  await shot.page.screenshot({ path: path.join(out, 'ecran-carnet.png') });
  await close(shot, 'ecran-carnet.png');
}

// L'image des liens : la ville dessinée par l'app, avec le nom et la promesse.
async function preview(browser, baseURL) {
  const shot = await open(browser, baseURL, state(), { width: 600, height: 900, scale: 2 });
  await shot.page.addStyleTag({ content: '#sky button, #sky .btn, #sky [class*="companion"] { display: none !important } #sky { border-radius: 0 !important; box-shadow: none !important; border: 0 !important }' });
  await shot.page.waitForTimeout(300);
  const city = (await shot.page.locator('#sky').screenshot()).toString('base64');
  await close(shot, 'ville-1200x630.png (ville)');
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, serviceWorkers: 'block' });
  const fonts = file => 'data:font/woff2;base64,' + fs.readFileSync(path.join(root, 'fonts', file)).toString('base64');
  await page.setContent(`<style>
    @font-face { font-family: 'Young Serif'; src: url(${fonts('young-serif-latin.woff2')}) format('woff2'); }
    @font-face { font-family: 'Figtree'; font-weight: 400 800; src: url(${fonts('figtree-latin.woff2')}) format('woff2'); }
    html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
    body { position: relative; background: #f3ecd9; }
    img { position: absolute; right: 0; top: 0; height: 630px; width: auto; -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 220px); }
    .text { position: absolute; left: 56px; top: 0; bottom: 0; width: 420px; display: flex; flex-direction: column; justify-content: center; gap: 22px; }
    h1 { margin: 0; font: 400 72px/1.05 'Young Serif', serif; color: #2f4a33; }
    p { margin: 0; font: 600 32px/1.25 'Figtree', sans-serif; color: #4a5a46; }
  </style><img src="data:image/png;base64,${city}">
  <div class="text"><h1>Ville du bien-être</h1><p>Prends soin de toi, ta ville grandit</p></div>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(out, 'ville-1200x630.png') });
  await page.close();
  console.log('apercu :', path.join('apercu', 'ville-1200x630.png'));
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
    await screens(browser, baseURL);
    await preview(browser, baseURL);
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
