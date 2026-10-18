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

// Ville vivante : une ambiance imposée et figée (sans animation), pour que la planche ne dépende ni de l'heure ni du jour.
const ambience = (extra = {}) => ({ season: 'summer', moment: { name: 'day', t: .5 }, weather: 'sun', rainbow: false, festivals: [], visitor: null, ...extra });
const DAY = ambience(), NIGHT = ambience({ moment: { name: 'night', t: 0 } });
async function freeze(page, amb) {
  await page.evaluate(f => { window.__ville.state.settings.ambient = false; window.__ville.ambient.force(f); }, amb);
}
// Une petite ville de 7 × 7 avec de quoi accueillir chaque visiteur, et des cases libres au bord pour les fêtes.
const LIFE = [['phare', 0, 0, 4], ['maison', 1, 1], ['bibliotheque', 3, 1], ['boulangerie', 5, 1], ['arbre', 2, 2], ['cerisier', 4, 2], ['arbre', 6, 2],
  ['etang', 1, 3], ['banc', 3, 3], ['kiosque', 5, 3], ['fleurs', 2, 4], ['chemin', 3, 4], ['haie', 4, 4], ['jardin', 1, 5], ['chemin', 3, 5], ['fontaine', 5, 5]]
  .map(([item, x, y, stage]) => tile(item, x, y, stage));
const SPOTS = { chat: { x: 3, y: 3, on: 'banc' }, herisson: { x: 2, y: 3 }, ecureuil: { x: 2, y: 2, on: 'arbre' }, cigogne: { x: 1, y: 1, on: 'maison' },
  canards: { x: 1, y: 3, on: 'etang' }, renard: { x: 6, y: 5 }, chouette: { x: 6, y: 2, on: 'arbre' }, montgolfiere: { sky: true }, bonhomme: { x: 4, y: 5 },
  glaces: { x: 3, y: 4, on: 'chemin' }, accordeon: { x: 4, y: 3 }, artiste: { x: 2, y: 5 } };
const VISITOR_LOOK = { ecureuil: { season: 'autumn' }, renard: { season: 'autumn' }, chouette: { season: 'autumn' }, bonhomme: { season: 'winter', weather: 'snow' } };
const FEST_SEASON = { 'nouvel-an': 'winter', printemps: 'spring', ete: 'summer', recoltes: 'autumn', lumieres: 'winter', anniversaire: 'summer' };

// Réunit des captures en une seule image, en grille, chacune avec sa légende.
async function board(browser, name, shots, columns) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 40 } });
  await page.setContent('<body style="margin:0;padding:8px;display:grid;grid-template-columns:repeat(' + columns + ',1fr);gap:8px;background:#1d2721;font:14px sans-serif;color:#eef2ea">'
    + shots.map(([label, png]) => `<figure style="margin:0"><img style="width:100%;display:block" src="data:image/png;base64,${png.toString('base64')}"><figcaption style="padding:4px 2px">${label}</figcaption></figure>`).join('') + '</body>');
  await page.screenshot({ path: path.join(out, name), fullPage: true });
  await page.close();
  console.log('planche :', path.relative(root, path.join(out, name)));
}
async function lifeBoards(browser, baseURL) {
  const page = await browser.newPage({ viewport: { width: 560, height: 1000 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Zurich', serviceWorkers: 'block' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(state => localStorage.setItem('ville-bien-etre/v2', JSON.stringify(state)), town(7, LIFE));
  await page.goto(baseURL + '#debug');
  await page.waitForFunction(() => !!window.__ville);
  await page.evaluate(() => { const toast = document.querySelector('#toast'); if (toast) toast.hidden = true; });
  const city = page.locator('#city');
  const snap = async amb => { await freeze(page, amb); return city.screenshot(); };
  const shots = async list => { const done = []; for (const [label, amb] of list) done.push([label, await snap(amb)]); return done; };
  await board(browser, 'moments.png', await shots([['Nuit', 'night'], ['Aube', 'dawn'], ['Journée', 'day'], ["Fin d'après-midi", 'golden'], ['Crépuscule', 'dusk']]
    .map(([label, name]) => [label, ambience({ moment: { name, t: name === 'night' ? 0 : .5 } })])), 5);
  await board(browser, 'saisons.png', await shots([['Printemps', 'spring'], ['Été', 'summer'], ['Automne', 'autumn'], ['Hiver', 'winter']]
    .map(([label, season]) => [label, ambience({ season })])), 4);
  await board(browser, 'meteo.png', await shots([['Soleil', {}], ['Nuages', { weather: 'clouds' }], ['Pluie', { weather: 'rain' }], ['Neige', { season: 'winter', weather: 'snow' }],
    ['Brouillard', { season: 'autumn', weather: 'fog' }], ['Arc-en-ciel', { rainbow: true }]].map(([label, extra]) => [label, ambience(extra)])), 3);
  // Chaque visiteur, de jour puis de nuit, recadré autour de lui.
  const visitors = [];
  for (const moment of [{ name: 'day', t: .5 }, { name: 'night', t: 0 }]) {
    for (const [id, spot] of Object.entries(SPOTS)) {
      await freeze(page, ambience({ moment, ...VISITOR_LOOK[id], visitor: { id, spot } }));
      const box = await page.evaluate(() => window.__ville.City.visitorBox()), bounds = await city.boundingBox();
      const size = 150, cx = bounds.x + box.x + box.w / 2, cy = bounds.y + box.y + box.h / 2;
      const x = Math.max(bounds.x, Math.min(bounds.x + bounds.width - size, cx - size / 2)), y = Math.max(bounds.y, Math.min(bounds.y + bounds.height - size, cy - size / 2));
      visitors.push([id + (moment.name === 'night' ? ' · nuit' : ''), await page.screenshot({ clip: { x, y, width: size, height: size } })]);
    }
  }
  await board(browser, 'visiteurs.png', visitors, 6);
  await board(browser, 'fetes.png', await shots(Object.entries(FEST_SEASON).flatMap(([id, season]) => [false, true].map(night =>
    [id + (night ? ' · nuit' : ''), ambience({ season, moment: night ? { name: 'night', t: 0 } : { name: 'day', t: .5 }, festivals: [{ id, key: 'fest:' + id + ':2027', age: 2 }] })]))), 4);
  await page.close();
  if (errors.length) throw new Error('ville vivante : ' + errors.join(' | '));
}
// Temps moyen de dessin d'une image, ville 11 × 11 pleine, processeur ralenti 4 fois : une journée calme et une nuit de fête sous la pluie.
async function measure(browser, baseURL) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Zurich', serviceWorkers: 'block' });
  await page.addInitScript(state => localStorage.setItem('ville-bien-etre/v2', JSON.stringify(state)), town(11, lay(everything, 11, 4)));
  await page.goto(baseURL + '#debug');
  await page.waitForFunction(() => !!window.__ville);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  for (const [label, amb] of [['journée calme', DAY], ['nuit de fête sous la pluie', ambience({ moment: { name: 'night', t: 0 }, weather: 'rain', festivals: [{ id: 'lumieres', key: 'fest:lumieres:2027' }], visitor: { id: 'chat', spot: { x: 5, y: 5 } } })]]) {
    await freeze(page, amb);
    await page.evaluate(() => { window.__ville.state.settings.ambient = true; });
    const ms = await page.evaluate(() => {
      for (let i = 0; i < 5; i++) window.__ville.City.draw();
      const start = performance.now();
      for (let i = 0; i < 30; i++) window.__ville.City.draw();
      return (performance.now() - start) / 30;
    });
    console.log(`dessin : ${ms.toFixed(1)} ms par image (11 × 11, processeur ÷ 4, ${label})`);
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.close();
}

async function shoot(browser, baseURL, name, seed, { width = 560, height = 1000, scale = 2, carnet = false, amb = DAY } = {}) {
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
    await freeze(page, amb);
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
    await shoot(browser, baseURL, 'ville-nuit.png', town(11, lay(everything, 11, 4), 'dark'), { amb: NIGHT });
    for (const stage of [1, 2, 3]) {
      await shoot(browser, baseURL, `merveilles-etape-${stage}.png`, town(7, WONDERS.map((key, i) => tile(key, 1 + 2 * i, 5 - 2 * i, stage))));
    }
    await shoot(browser, baseURL, 'ville-320.png', town(7, lay(NEW_ITEMS, 7)), { width: 320, height: 568, scale: 3 });
    await shoot(browser, baseURL, 'vignettes.png', town(7, []), { height: 2600, carnet: true });
    await lifeBoards(browser, baseURL);
    await measure(browser, baseURL);
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
