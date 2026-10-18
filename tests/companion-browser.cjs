const assert = require('node:assert/strict');
const { town } = require('./content-browser.cjs');
const { cityAt } = require('./ambient-browser.cjs');
const { activities, startSession } = require('./rituals-browser.cjs');

// Étape 6, le compagnon : chaque scénario est une fonction à part, qu'on peut lancer seule.
const at = iso => Date.parse(iso);
const NOW = '2026-10-21T10:00:00Z';
const tile = (item, x, y, extra = {}) => ({ id: item + x + y, item, x, y, at: at('2026-10-01T09:00:00Z'), paid: 1e6, ...extra });
// Une ville amorcée à date de création fixe ; « extra » peut y ajouter un compagnon, des séances, des réglages.
const seed = (tiles, extra = {}) => town({ esprit: 5 }, tiles, { createdAt: at('2026-05-04T09:00:00Z'), ...extra });
// Un compagnon déjà accueilli (le 1er octobre), avec ce qui change d'un scénario à l'autre.
const pet = (extra = {}) => ({ species: 'lapin', name: 'Pompon', since: at('2026-10-01T09:00:00Z'), minutes: 0, wear: '', ...extra });
const SPECIES = ['lapin', 'marmotte', 'ourson'];
const POSES = ['idle', 'walk', 'sleep', 'read', 'stretch', 'meditate', 'water', 'paint', 'cheer'];
const WEAR = ['', 'echarpe', 'bonnet', 'lunettes', 'couronne', 'noeud', 'paille', 'sac', 'casque', 'cape'];

// Dessins : chaque animal, dans chaque geste et avec chaque accessoire (ou aucun), puis son visage seul, tient dans son cadre.
async function paintAll(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, seed([]), NOW);
  try {
    const out = await page.evaluate(([species, poses, wear]) => {
      const bad = [];
      for (const s of species) for (const pose of poses) for (const w of wear) {
        for (const face of [false, true]) {
          if (face && pose !== 'idle') continue;
          const b = __ville.companion.bounds({ species: s, pose, wear: w, face }, 96);
          if (b.empty || b.x0 < 1 || b.y0 < 1 || b.x1 > 95 || b.y1 > 95) bad.push([s, pose, w, face, JSON.stringify(b)].join(' '));
        }
      }
      return bad;
    }, [SPECIES, POSES, WEAR]);
    assert.deepEqual(out, []);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Compagnon : trois animaux, neuf gestes, neuf accessoires, chacun dans son cadre';
}

async function toEnglish(page) {
  await page.locator('#settingsBtn').click();
  await page.locator('#settingsLang').getByRole('radio', { name: 'English', exact: true }).click();
  await page.locator('#sheetClose').click();
}
// Mesure que rien ne déborde : dans la fenêtre ouverte, ou dans une partie de la page (sans ses décors cachés aux lecteurs d'écran,
// comme les étincelles de l'écran de fin).
const fitsSheet = page => page.evaluate(() => document.querySelector('#sheetBody').scrollWidth <= document.querySelector('#sheetBody').clientWidth + 1
  && document.documentElement.scrollWidth <= innerWidth);
const fitsIn = (page, sel) => page.evaluate(s => document.documentElement.scrollWidth <= innerWidth
  && [...document.querySelectorAll(s + ', ' + s + ' *')].filter(el => !el.closest('[aria-hidden="true"]'))
    .every(el => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= innerWidth + 1), sel);
const toastMatches = (page, re) => page.waitForFunction(source => new RegExp(source).test(document.querySelector('#toast').textContent), re.source, { timeout: 5000 });
const meet = page => page.locator('#companionInvite').getByRole('button').first().click();

// L'invitation : seulement après une séance réussie, contenue à 320 px ; « Pas maintenant » la range pour de bon.
async function inviteAfterFirstSession(browser, baseURL) {
  {
    const { context, page, errors } = await cityAt(browser, baseURL, seed([], { stats: { ok: 0, byCat: {}, days: {} } }), NOW);
    try {
      assert.equal(await page.locator('#companionInvite').isVisible(), false);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  const { context, page, errors } = await cityAt(browser, baseURL, seed([]), NOW, { viewport: { width: 320, height: 640 } });
  try {
    const card = page.locator('#companionInvite');
    await card.waitFor();
    assert.match(await card.innerText(), /Un compagnon pour ta ville[\s\S]*Un petit animal aimerait s'installer dans ta ville et faire tes séances avec toi\./);
    assert.equal(await fitsIn(page, '#companionInvite'), true);
    await toEnglish(page);
    assert.match(await card.innerText(), /A companion for your town/);
    assert.equal(await fitsIn(page, '#companionInvite'), true);
    await card.getByRole('button', { name: 'Not now', exact: true }).click();
    assert.equal(await card.isVisible(), false);
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    assert.equal(await page.locator('#companionInvite').isVisible(), false);
    assert.ok(await page.evaluate(() => __ville.state.companionLater > 0));
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Compagnon : l’invitation après une première séance, et « Pas maintenant » pour de bon';
}

// Le choix : la suggestion suit l'animal tant qu'on n'a rien tapé ; le bouton suit le nom ; l'arrivée est fêtée.
async function adoptDefault(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, seed([]), NOW);
  try {
    await page.locator('#companionInvite').getByRole('button', { name: 'Faire connaissance', exact: true }).click();
    assert.equal(await page.locator('#sheetTitle').innerText(), 'Ton compagnon');
    const name = page.locator('#companionName'), body = page.locator('#sheetBody');
    const pick = label => body.getByRole('radio', { name: label, exact: true }).click();
    assert.equal(await name.inputValue(), 'Pompon');
    await pick('Marmotte');
    assert.equal(await name.inputValue(), 'Noisette');
    assert.equal(await body.getByRole('button', { name: 'Accueillir Noisette', exact: true }).count(), 1);
    await pick('Lapin');
    assert.equal(await name.inputValue(), 'Pompon');
    await name.fill('Lune');
    await pick('Ourson');
    assert.equal(await name.inputValue(), 'Lune');
    await body.getByRole('button', { name: 'Accueillir Lune', exact: true }).click();
    await toastMatches(page, /Bienvenue à Lune/);
    const c = await page.evaluate(() => __ville.companion.state());
    assert.deepEqual({ ...c, since: c.since > 0 }, { species: 'ourson', name: 'Lune', minutes: 0, wear: '', since: true });
    assert.deepEqual([await page.locator('#companionInvite').isVisible(), await page.locator('#sheet').isVisible()], [false, false]);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Compagnon : choisir un animal et un nom, puis l’accueillir';
}

// Un nom de 20 caractères sans espace : la fenêtre du choix ne déborde pas à 320 px, en français puis en anglais.
async function adoptLongName(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, seed([]), NOW, { viewport: { width: 320, height: 640 } });
  try {
    for (const lang of ['fr', 'en']) {
      if (lang === 'en') await toEnglish(page);
      await meet(page);
      await page.locator('#companionName').fill('W'.repeat(20));
      assert.equal(await fitsSheet(page), true, lang);
      await page.locator('#sheetClose').click();
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Compagnon : un nom de 20 caractères tient à 320 px';
}

// Le nom suggéré suit la langue : un compagnon accueilli sans nom tapé (champ laissé tel quel, ou vidé) s'appelle Pompon, puis
// Pompom en anglais.
async function suggestedNameFollowsLanguage(browser, baseURL) {
  for (const empty of [false, true]) {
    const { context, page, errors } = await cityAt(browser, baseURL, seed([]), NOW);
    try {
      await meet(page);
      if (empty) await page.locator('#companionName').fill('');
      await page.locator('#sheetBody').getByRole('button', { name: 'Accueillir Pompon', exact: true }).click();
      await toastMatches(page, /Bienvenue à Pompon/);
      assert.deepEqual(await page.evaluate(() => [__ville.companion.state().name, __ville.companion.name()]), ['', 'Pompon']);
      await toEnglish(page);
      assert.equal(await page.evaluate(() => __ville.companion.name()), 'Pompom');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return 'Compagnon : le nom suggéré suit la langue';
}

// Dans la ville : il se promène le jour (10 h) et dort la nuit (23 h 30), sur une case du terrain.
async function townDayNight(browser, baseURL) {
  for (const [time, pose] of [['2026-10-21T08:00:00Z', 'walk'], ['2026-10-21T21:30:00Z', 'sleep']]) {
    const { context, page, errors } = await cityAt(browser, baseURL, seed([tile('maison', 3, 3)], { companion: pet() }), time);
    try {
      await page.waitForFunction(() => !!__ville.companion.spot());
      const spot = await page.evaluate(() => __ville.companion.spot());
      assert.equal(spot.pose, pose, time);
      assert.ok(spot.x >= 0 && spot.x < 7 && spot.y >= 0 && spot.y < 7, JSON.stringify(spot));
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return 'Compagnon : il se promène le jour et dort la nuit';
}

// Le bouton du compagnon, et le compagnon lui-même, ouvrent sa fiche, sur la petite carte comme dans la vue en grand.
async function townTapAndButton(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, seed([tile('maison', 3, 3)], { companion: pet(), settings: { lang: 'fr', ambient: false } }), NOW);
  try {
    await page.getByRole('button', { name: 'Pompon, ton compagnon', exact: true }).click();
    await page.locator('#sheet').waitFor();
    assert.equal(await page.locator('#sheetTitle').innerText(), 'Pompon');
    await page.locator('#sheetClose').click();
    const tapBox = async canvas => {
      const box = await page.evaluate(() => __ville.companion.box());
      assert.ok(box, canvas);
      await page.locator(canvas).click({ position: { x: box.x + box.w / 2, y: box.y + box.h / 2 } });
      await page.locator('#sheet').waitFor();
      assert.equal(await page.locator('#sheetTitle').innerText(), 'Pompon', canvas);
      await page.locator('#sheetClose').click();
    };
    await tapBox('#city');
    await page.locator('#cityExpand').click();
    await page.locator('#cityBig').waitFor();
    await tapBox('#cityBigCanvas');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Compagnon : son bouton et lui-même ouvrent sa fiche';
}

// Masqué : ni bouton ni compagnon ; en visite (même de sa propre ville) : pas de compagnon.
async function townHiddenAndVisit(browser, baseURL) {
  {
    const { context, page, errors } = await cityAt(browser, baseURL, seed([tile('maison', 3, 3)], { companion: pet(), settings: { lang: 'fr', companionShown: false } }), NOW);
    try {
      await page.waitForTimeout(300);
      assert.equal(await page.locator('#companionBtn').isVisible(), false);
      assert.equal(await page.evaluate(() => __ville.companion.spot()), null);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  const { context, page, errors } = await cityAt(browser, baseURL, seed([tile('maison', 3, 3)], { companion: pet() }), NOW);
  try {
    await page.waitForFunction(() => !!__ville.companion.spot());
    await page.evaluate(() => __ville.share.open(__ville.share.encode()));
    await page.locator('#cityBig').waitFor();
    await page.waitForFunction(() => __ville.companion.spot() === null);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Compagnon : masqué, ou en visite, il ne se montre pas';
}

const openSheetOf = page => page.locator('#companionBtn').click().then(() => page.locator('#sheet').waitFor());

// La fiche : animal et niveau, temps ensemble et prochain cadeau (rien au niveau 10), mot du jour.
async function sheetContent(browser, baseURL) {
  for (const [minutes, lines, absent] of [[70, /Lapin · complicité niveau 3[\s\S]*1\sh\s10 ensemble · prochain cadeau dans 50\smin\s:\sdes lunettes rondes/, null],
    [1800, /Lapin · complicité niveau 10[\s\S]*30\sh ensemble/, /prochain cadeau/]]) {
    const { context, page, errors } = await cityAt(browser, baseURL, seed([tile('maison', 3, 3)], { companion: pet({ minutes }) }), NOW);
    try {
      await openSheetOf(page);
      const text = await page.locator('#sheetBody').innerText();
      assert.match(text, lines);
      if (absent) assert.doesNotMatch(text, absent);
      const word = await page.evaluate(() => __ville.companion.word());
      assert.ok(word && text.replace(/\s/g, ' ').includes(word.replace(/\s/g, ' ')), word);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return 'Compagnon : sa fiche, son niveau, son mot du jour';
}

// La garde-robe : les accessoires gagnés se choisissent, les suivants attendent leur niveau ; le choix est gardé.
async function wardrobe(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, seed([tile('maison', 3, 3)], { companion: pet({ minutes: 70 }) }), NOW);
  try {
    await openSheetOf(page);
    const group = page.locator('#sheetBody').getByRole('radiogroup', { name: 'Garde-robe', exact: true });
    const item = name => group.getByRole('radio', { name: new RegExp('^' + name) });
    assert.deepEqual([await item('Écharpe').isDisabled(), await item('Bonnet').isDisabled(), await item('Lunettes rondes').isDisabled()], [false, false, true]);
    assert.match(await item('Lunettes rondes').innerText(), /Niveau 4/);
    await item('Bonnet').click();
    assert.equal(await page.evaluate(() => __ville.companion.state().wear), 'bonnet');
    assert.equal(await item('Bonnet').getAttribute('aria-checked'), 'true');
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    assert.equal(await page.evaluate(() => __ville.companion.state().wear), 'bonnet');
    await openSheetOf(page);
    await item('Aucun').click();
    assert.equal(await page.evaluate(() => __ville.companion.state().wear), '');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Compagnon : la garde-robe';
}

// Un nom de 20 caractères sans espace : la fiche ne déborde pas à 320 px, en français puis en anglais.
async function sheetLongName(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, seed([tile('maison', 3, 3)], { companion: pet({ name: 'W'.repeat(20), minutes: 70 }) }), NOW,
    { viewport: { width: 320, height: 640 } });
  try {
    for (const lang of ['fr', 'en']) {
      if (lang === 'en') await toEnglish(page);
      await openSheetOf(page);
      assert.equal(await fitsSheet(page), true, lang);
      assert.equal(await page.evaluate(() => document.querySelector('#sheetTitle').scrollWidth <= document.querySelector('#sheetTitle').clientWidth + 1), true, lang);
      await page.locator('#sheetClose').click();
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Compagnon : sa fiche tient à 320 px, même avec un nom long';
}

// Une ville avec une activité de 5 min par domaine (« Pratique esprit »…), son de fin coupé, horloge contrôlée ; « extra » ajoute
// un compagnon ou des réglages, « viewport » change la taille de l'écran.
async function sessionPage(browser, baseURL, extra = {}, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Zurich' });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date(NOW) });
  const { settings = {}, ...rest } = extra;
  await page.addInitScript(state => {
    window.__VILLE_DEBUG__ = true;
    if (!localStorage.getItem('ville-bien-etre/v2')) localStorage.setItem('ville-bien-etre/v2', JSON.stringify(state));
  }, seed([tile('maison', 3, 3)], { activities: activities(), ...rest, settings: { lang: 'fr', sound: false, ...settings } }));
  await page.goto(baseURL.replace(/#.*$/, ''));
  await page.waitForFunction(() => !!window.__ville);
  return { context, page, errors };
}
const abandonSession = async page => { await page.locator('#abandonBtn').click(); await page.locator('#abandonBtn').click(); await page.locator('#sessResult').waitFor(); };
const backToCity = page => page.locator('#sessResult').getByRole('button', { name: 'Retour à la ville', exact: true }).click();

// Pendant la séance, dans l'anneau : le geste du domaine ; immobile sans animation ; rien quand il est masqué ; dans l'anneau à 320 px.
async function sessionPoses(browser, baseURL) {
  {
    const { context, page, errors } = await sessionPage(browser, baseURL, { companion: pet() });
    try {
      for (const [cat, pose] of [['esprit', 'read'], ['corps', 'stretch'], ['calme', 'meditate'], ['foyer', 'water'], ['crea', 'paint']]) {
        await startSession(page, 'Pratique ' + cat, 5);
        assert.equal(await page.locator('#sessCompanion').isVisible(), true, cat);
        assert.deepEqual(await page.evaluate(() => __ville.companion.session()), { shown: true, pose, animated: true }, cat);
        await abandonSession(page);
        await backToCity(page);
      }
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  {
    const { context, page, errors } = await sessionPage(browser, baseURL, { companion: pet() }, { width: 320, height: 568 });
    try {
      await startSession(page, 'Pratique esprit', 5);
      const fit = await page.evaluate(() => {
        const ring = document.querySelector('.ring-wrap').getBoundingClientRect(), cv = document.querySelector('#sessCompanion').getBoundingClientRect();
        return document.documentElement.scrollWidth <= innerWidth && cv.left >= ring.left && cv.right <= ring.right && cv.top >= ring.top && cv.bottom <= ring.bottom;
      });
      assert.equal(fit, true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  for (const [settings, expected] of [[{ ambient: false }, { shown: true, pose: 'read', animated: false }], [{ companionShown: false }, { shown: false, pose: '', animated: false }]]) {
    const { context, page, errors } = await sessionPage(browser, baseURL, { companion: pet(), settings });
    try {
      await startSession(page, 'Pratique esprit', 5);
      assert.deepEqual(await page.evaluate(() => __ville.companion.session()), expected, JSON.stringify(settings));
      assert.equal(await page.locator('#sessCompanion').isVisible(), expected.shown);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return 'Compagnon : il fait ta séance avec toi, dans le geste de son domaine';
}

// L'écran de fin : le temps ensemble, le mot du jour à la première séance du jour, le niveau gagné et « Lui mettre ». Masqué, il
// gagne quand même le temps, sans rien montrer.
async function successScreen(browser, baseURL) {
  {
    const { context, page, errors } = await sessionPage(browser, baseURL, { companion: pet({ minutes: 15 }) });
    try {
      await startSession(page, 'Pratique esprit', 10);
      await page.clock.fastForward(10 * 60000 + 1000);
      await page.locator('#sessResult').waitFor();
      const res = page.locator('#sessResult'), word = await page.evaluate(() => __ville.companion.word());
      const text = (await res.innerText()).replace(/\s/g, ' ');
      assert.match(text, /\+10 min ensemble/);
      assert.match(text, /Complicité niveau 2 : Pompon reçoit une écharpe/);
      assert.ok(text.includes(word.replace(/\s/g, ' ')), word);
      await res.getByRole('button', { name: 'Lui mettre', exact: true }).click();
      assert.equal(await page.evaluate(() => __ville.companion.state().wear), 'echarpe');
      assert.equal(await res.getByRole('button', { name: "C'est fait", exact: true }).isDisabled(), true);
      await backToCity(page);
      // La deuxième séance du jour : pas de mot du jour.
      await startSession(page, 'Pratique corps', 5);
      await page.clock.fastForward(5 * 60000 + 1000);
      await page.locator('#sessResult').waitFor();
      const second = (await page.locator('#sessResult').innerText()).replace(/\s/g, ' ');
      assert.match(second, /\+5 min ensemble/);
      assert.ok(!second.includes(word.replace(/\s/g, ' ')), second);
      assert.equal(Math.round(await page.evaluate(() => __ville.companion.state().minutes)), 30);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  const { context, page, errors } = await sessionPage(browser, baseURL, { companion: pet({ minutes: 15 }), settings: { companionShown: false } });
  try {
    await startSession(page, 'Pratique esprit', 10);
    await page.clock.fastForward(10 * 60000 + 1000);
    await page.locator('#sessResult').waitFor();
    assert.doesNotMatch(await page.locator('#sessResult').innerText(), /ensemble/);
    assert.equal(Math.round(await page.evaluate(() => __ville.companion.state().minutes)), 25);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Compagnon : l’écran de fin, le niveau gagné et « Lui mettre »';
}

// Une séance abandonnée après 6 min : le temps compte pour la complicité, l'écran d'interruption montre le compagnon sans un mot de plus.
async function interruptedCounts(browser, baseURL) {
  const { context, page, errors } = await sessionPage(browser, baseURL, { companion: pet({ minutes: 15 }) });
  try {
    await startSession(page, 'Pratique calme', 10);
    await page.clock.fastForward(6 * 60000);
    await abandonSession(page);
    assert.equal(Math.round(await page.evaluate(() => __ville.companion.state().minutes)), 21);
    assert.equal(await page.locator('#sessResult canvas.res-companion').count(), 1);
    assert.doesNotMatch(await page.locator('#sessResult').innerText(), /ensemble|Complicité/);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Compagnon : une séance interrompue compte aussi, sans un mot de plus';
}

// Un nom de 20 caractères sans espace : l'écran de fin tient à 320 px.
async function successLongName(browser, baseURL) {
  const { context, page, errors } = await sessionPage(browser, baseURL, { companion: pet({ name: 'W'.repeat(20), minutes: 15 }) }, { width: 320, height: 640 });
  try {
    await startSession(page, 'Pratique esprit', 10);
    await page.clock.fastForward(10 * 60000 + 1000);
    await page.locator('#sessResult').waitFor();
    assert.equal(await fitsIn(page, '#sessResult'), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Compagnon : l’écran de fin tient à 320 px, même avec un nom long';
}

// Respiration : le bouton seulement en Calme, avec le nom du compagnon, éteint d'abord, décrit une fois pour les lecteurs d'écran.
async function breathOnlyCalm(browser, baseURL) {
  const { context, page, errors } = await sessionPage(browser, baseURL, { companion: pet() });
  try {
    await startSession(page, 'Pratique esprit', 5);
    assert.equal(await page.locator('#breathBtn').isVisible(), false);
    await abandonSession(page);
    await backToCity(page);
    await startSession(page, 'Pratique calme', 5);
    const btn = page.locator('#breathBtn');
    assert.equal(await btn.isVisible(), true);
    assert.equal((await btn.innerText()).trim(), 'Respirer avec Pompon');
    assert.equal(await btn.getAttribute('aria-pressed'), 'false');
    assert.equal(await page.evaluate(() => document.getElementById(document.querySelector('#breathBtn').getAttribute('aria-describedby')).textContent),
      '5 secondes pour inspirer, 5 pour expirer');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Respiration : seulement dans les séances Calme';
}

// Respiration allumée : « Inspire », puis « Expire » 5 s plus tard ; le choix revient à la séance Calme suivante ; les réglages l'éteignent.
async function breathCycle(browser, baseURL) {
  const { context, page, errors } = await sessionPage(browser, baseURL, { companion: pet() });
  try {
    await startSession(page, 'Pratique calme', 5);
    await page.locator('#breathBtn').click();
    const state = () => page.evaluate(() => ({ word: document.querySelector('#breathWord').hidden ? '' : document.querySelector('#breathWord').textContent,
      wrap: ['breathing', 'inhale', 'exhale'].filter(c => document.querySelector('.ring-wrap').classList.contains(c)).join(' '),
      sub: document.querySelector('#timerSub').hidden, pressed: document.querySelector('#breathBtn').getAttribute('aria-pressed') }));
    assert.deepEqual(await state(), { word: 'Inspire', wrap: 'breathing inhale', sub: true, pressed: 'true' });
    await page.clock.fastForward(5000);
    assert.deepEqual(await state(), { word: 'Expire', wrap: 'breathing exhale', sub: true, pressed: 'true' });
    await page.clock.fastForward(5000);
    assert.equal((await state()).word, 'Inspire');
    assert.equal(await page.evaluate(() => __ville.state.settings.breathing), true);
    await abandonSession(page);
    assert.equal((await state()).wrap, '');
    await backToCity(page);
    await startSession(page, 'Pratique calme', 5);
    assert.deepEqual(await state(), { word: 'Inspire', wrap: 'breathing inhale', sub: true, pressed: 'true' });
    await abandonSession(page);
    await backToCity(page);
    await page.locator('#settingsBtn').click();
    await page.locator('#settingsSessions').getByRole('switch', { name: 'Respiration guidée pendant les séances Calme', exact: true }).click();
    await page.locator('#sheetClose').click();
    assert.equal(await page.evaluate(() => __ville.state.settings.breathing), false);
    await startSession(page, 'Pratique calme', 5);
    assert.deepEqual(await state(), { word: '', wrap: '', sub: false, pressed: 'false' });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Respiration : 5 s pour inspirer, 5 s pour expirer, et le choix retenu';
}

// Mouvements réduits : rien ne grandit, seul le mot change.
async function breathReducedMotion(browser, baseURL) {
  const { context, page, errors } = await sessionPage(browser, baseURL, { companion: pet(), settings: { breathing: true } });
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await startSession(page, 'Pratique calme', 5);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#sessCompanion')).transform), 'none');
    assert.equal(await page.locator('#breathWord').innerText(), 'Inspire');
    await page.clock.fastForward(5000);
    assert.equal(await page.locator('#breathWord').innerText(), 'Expire');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Respiration : avec les mouvements réduits, seul le mot change';
}

// Routine Calme puis Corps : le guide s'arrête et le bouton disparaît à l'étape Corps.
async function breathRoutine(browser, baseURL) {
  const routines = [{ id: 'r1', name: 'Calme puis corps', activityIds: ['a-calme', 'a-corps'] }];
  const { context, page, errors } = await sessionPage(browser, baseURL, { companion: pet(), routines, settings: { breathing: true } });
  try {
    await page.locator('[data-tab="activites"]').click();
    await page.locator('#routinesCard').getByRole('button', { name: 'Lancer', exact: true }).click();
    await page.locator('#sessRun').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => document.querySelector('.ring-wrap').classList.contains('breathing')), true);
    await page.clock.fastForward(5 * 60000 + 1000);
    await page.getByRole('button', { name: 'Étape suivante', exact: true }).click();
    await page.locator('#sessRun').waitFor({ state: 'visible' });
    assert.match(await page.locator('#sessName').innerText(), /corps/);
    assert.deepEqual(await page.evaluate(() => [document.querySelector('.ring-wrap').className.includes('breathing'), document.querySelector('#breathBtn').hidden,
      document.querySelector('#timerSub').hidden]), [false, true, false]);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Respiration : elle s’arrête à l’étape suivante d’une routine qui n’est pas Calme';
}

// Compagnon masqué : « Respiration guidée », et le disque respire à sa place.
async function breathHidden(browser, baseURL) {
  const { context, page, errors } = await sessionPage(browser, baseURL, { companion: pet(), settings: { companionShown: false } });
  try {
    await startSession(page, 'Pratique calme', 5);
    assert.equal((await page.locator('#breathBtn').innerText()).trim(), 'Respiration guidée');
    await page.locator('#breathBtn').click();
    const scale = await page.evaluate(() => {
      const disc = document.querySelector('#breathDisc');
      disc.style.transition = 'none';   // la valeur visée, sans attendre les 5 s de la transition
      return disc.hidden ? null : new DOMMatrix(getComputedStyle(disc).transform).a;
    });
    assert.ok(scale > 1.05, String(scale));
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Respiration : sans compagnon visible, un disque respire';
}

const SCENARIOS = [paintAll, inviteAfterFirstSession, adoptDefault, adoptLongName, suggestedNameFollowsLanguage, townDayNight, townTapAndButton,
  townHiddenAndVisit, sheetContent, wardrobe, sheetLongName, sessionPoses, successScreen, interruptedCounts, successLongName, breathOnlyCalm, breathCycle,
  breathReducedMotion, breathRoutine, breathHidden];
async function runCompanion(browser, baseURL) {
  const scenarios = [];
  for (const scenario of SCENARIOS) scenarios.push(await scenario(browser, baseURL));
  return { scenarios };
}

module.exports = { runCompanion, SCENARIOS, seed, tile, NOW };
