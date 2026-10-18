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

// Rituels, à une date fixée : le bilan de la semaine (mardi 27 octobre 2026), le récapitulatif d'octobre et son image partagée
// (lundi 2 novembre), la ville d'une amie en grand, et les cartes du Journal (défis, semaine, mois, humeur).
async function ritualBoards(browser, baseURL) {
  const { filledWeek } = require('./rituals-browser.cjs');
  // La semaine pleine des tests, puis trois séances de plus avec leur humeur ; les statistiques suivent les séances.
  const withMoods = () => {
    const seed = filledWeek(), moods = [4, 5, 3, 4, 5];
    const extra = [['2026-10-27', 'calme', 15, 5], ['2026-10-29', 'corps', 25, 4], ['2026-10-31', 'calme', 20, 4]].map(([d, cat, min, mood]) =>
      ({ id: 'x' + d, name: 'Pratique ' + cat, cat, min, ok: true, reward: min * 1e6, at: Date.parse(d + 'T17:00:00Z'), day: d, source: 'direct', mode: 'focus', mood }));
    const history = [...extra.reverse(), ...seed.history.map((e, i) => ({ ...e, mood: moods[i] }))];
    const stats = { ok: history.length, byCat: {}, days: {}, dailyCats: {} };
    for (const e of history) {
      stats.byCat[e.cat] = (stats.byCat[e.cat] || 0) + e.min;
      stats.days[e.day] = (stats.days[e.day] || 0) + e.min;
      stats.dailyCats[e.day] = { ...stats.dailyCats[e.day], [e.cat]: ((stats.dailyCats[e.day] || {})[e.cat] || 0) + e.min };
    }
    return { ...seed, history, stats };
  };
  const open = async (time, state, { height = 844, hash = '#debug', noShare = false } = {}) => {
    const page = await browser.newPage({ viewport: { width: 390, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Zurich', serviceWorkers: 'block' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date(time));
    await page.addInitScript(([seed, shareOff]) => {
      window.__VILLE_DEBUG__ = true;
      localStorage.setItem('ville-bien-etre/v2', JSON.stringify(seed));
      if (shareOff) navigator.canShare = () => false;
    }, [state, noShare]);
    await page.goto(baseURL + hash);
    await page.waitForFunction(() => !!window.__ville);
    await page.evaluate(() => { const toast = document.querySelector('#toast'); if (toast) toast.hidden = true; });
    return { page, errors };
  };
  const done = async ({ page, errors }, name, image = true) => {
    await page.close();
    if (errors.length) throw new Error(name + ' : ' + errors.join(' | '));
    if (image) console.log('planche :', path.relative(root, path.join(out, name)));
  };
  const unseen = { rituals: { week: '', month: '', year: '' } };
  let shot = await open('2026-10-27T09:00:00Z', { ...withMoods(), ...unseen }, { height: 1500 });
  await shot.page.locator('#sheet').screenshot({ path: path.join(out, 'bilan.png') });
  await done(shot, 'bilan.png');
  shot = await open('2026-11-02T09:00:00Z', { ...withMoods(), ...unseen }, { height: 1500, noShare: true });
  await shot.page.locator('#sheet').screenshot({ path: path.join(out, 'recap.png') });
  const [download] = await Promise.all([shot.page.waitForEvent('download'), shot.page.locator('#sheetBody').getByRole('button', { name: "Partager l'image", exact: true }).click()]);
  await download.saveAs(path.join(out, 'recap-image.png'));
  await done(shot, 'recap.png');
  console.log('planche :', path.relative(root, path.join(out, 'recap-image.png')));
  // La ville de Léa, lue dans un premier onglet, puis ouverte par son lien.
  const friend = await open('2026-11-02T09:00:00Z', { ...town(9, lay(['grandarbre', 'bibliotheque', 'maison', 'boulangerie', 'kiosque', 'cerisier', 'fontaine', 'banc', 'arbre', 'fleurs', 'etang', 'lampadaire'], 9, 4)),
    personal: { name: 'La ville de Léa' }, rituals: { week: '9999-12-31', month: '9999-12', year: '9999' } });
  const code = await friend.page.evaluate(() => window.__ville.share.encode());
  await done(friend, 'ville de Léa', false);
  shot = await open('2026-11-02T09:00:00Z', { ...withMoods(), rituals: { week: '2026-10-26', month: '2026-10', year: '' } }, { hash: '#ville=' + code });
  await shot.page.locator('#cityBig').waitFor();
  await shot.page.waitForTimeout(300);
  await shot.page.screenshot({ path: path.join(out, 'visite.png') });
  await done(shot, 'visite.png');
  shot = await open('2026-11-02T09:00:00Z', { ...withMoods(), rituals: { week: '2026-10-26', month: '2026-10', year: '' } }, { height: 2600 });
  await shot.page.locator('[data-tab="journal"]').click();
  await shot.page.locator('#view-journal').screenshot({ path: path.join(out, 'journal-rituels.png') });
  await done(shot, 'journal-rituels.png');
}

// Harmonie et ambiance, à une date fixée : la Ville avec la bulle et la carte du souhait du jour, la fenêtre de l'harmonie,
// l'Arche fleurie dans une ville, et l'écran d'une séance avec son ambiance.
async function harmonyBoards(browser, baseURL) {
  const { seed, tile, NOW } = require('./harmony-browser.cjs');
  const { activities, startSession } = require('./rituals-browser.cjs');
  const open = async (state, { height = 844, clock = false } = {}) => {
    const page = await browser.newPage({ viewport: { width: 390, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Zurich', serviceWorkers: 'block' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    if (clock) await page.clock.install({ time: new Date(NOW) }); else await page.clock.setFixedTime(new Date(NOW));
    await page.addInitScript(s => { window.__VILLE_DEBUG__ = true; if (!localStorage.getItem('ville-bien-etre/v2')) localStorage.setItem('ville-bien-etre/v2', JSON.stringify(s)); }, state);
    await page.goto(baseURL + '#debug');
    await page.waitForFunction(() => !!window.__ville);
    await page.evaluate(() => { const toast = document.querySelector('#toast'); if (toast) toast.hidden = true; });
    return { page, errors };
  };
  const done = async ({ page, errors }, name) => {
    await page.close();
    if (errors.length) throw new Error(name + ' : ' + errors.join(' | '));
    console.log('planche :', path.relative(root, path.join(out, name)));
  };
  let shot = await open(seed([tile('maison', 3, 3), tile('bibliotheque', 1, 5), tile('arbre', 2, 2)]), { height: 1100 });
  await shot.page.waitForTimeout(300);
  const bottom = await shot.page.evaluate(() => document.querySelector('#townWishCard').getBoundingClientRect().bottom);
  await shot.page.screenshot({ path: path.join(out, 'souhait.png'), clip: { x: 0, y: 0, width: 390, height: Math.ceil(bottom) + 12 } });
  await done(shot, 'souhait.png');
  shot = await open(seed([tile('maison', 0, 0), tile('bibliotheque', 6, 0), tile('kiosque', 0, 6), tile('arbre', 3, 3), tile('fleurs', 4, 4)]), { height: 1100 });
  await shot.page.locator('#harmonyBtn').click();
  await shot.page.locator('#sheet').screenshot({ path: path.join(out, 'harmonie.png') });
  await done(shot, 'harmonie.png');
  shot = await open(seed([tile('arche', 3, 3), tile('maison', 2, 2), tile('fleurs', 4, 3), tile('arbre', 3, 4), tile('cerisier', 2, 4), tile('banc', 4, 2)],
    { achievements: { 'ville-harmonieuse': Date.parse('2026-10-20T10:00:00Z') }, settings: { lang: 'fr', townWishes: false } }));
  await freeze(shot.page, DAY);
  await shot.page.locator('#city').screenshot({ path: path.join(out, 'arche.png') });
  await done(shot, 'arche.png');
  shot = await open(seed([tile('maison', 3, 3)], { activities: activities(), settings: { lang: 'fr', sound: false, ambience: 'rain' } }), { clock: true });
  await startSession(shot.page, 'Pratique calme', 5);
  await shot.page.evaluate(() => { const toast = document.querySelector('#toast'); if (toast) toast.hidden = true; });
  await shot.page.locator('#session').screenshot({ path: path.join(out, 'ambiance.png') });
  await done(shot, 'ambiance.png');
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
    await ritualBoards(browser, baseURL);
    await harmonyBoards(browser, baseURL);
    await measure(browser, baseURL);
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
