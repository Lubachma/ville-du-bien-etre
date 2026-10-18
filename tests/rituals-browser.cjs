const assert = require('node:assert/strict');
const { town } = require('./content-browser.cjs');
const { cityAt } = require('./ambient-browser.cjs');

// Étape 4, rituels et partage : chaque scénario est une fonction à part, qu'on peut lancer seule.
const CATS = ['esprit', 'corps', 'calme', 'foyer', 'crea'];
const at = iso => Date.parse(iso);
// Une activité par domaine, pour lancer des séances au choix.
const activities = () => CATS.map(cat => ({ id: 'a-' + cat, name: 'Pratique ' + cat, cat, min: 5, mode: 'free' }));
// La semaine du lundi 19 au dimanche 25 octobre 2026, où les défis de chaque famille sont relevés. Les statistiques suivent
// les séances, comme dans l'app.
function filledWeek() {
  const entry = (day, cat, min, more = {}) => ({ id: 'h' + day + cat + min, name: 'Pratique ' + cat, cat, min, ok: true, reward: min * 1e6, at: at(day + 'T10:00:00Z'), day,
    source: 'direct', mode: 'focus', ...more });
  const history = [entry('2026-10-19', 'esprit', 10, { at: at('2026-10-19T06:00:00Z') }), entry('2026-10-20', 'corps', 60, { at: at('2026-10-20T19:30:00Z') }),
    entry('2026-10-22', 'crea', 10), entry('2026-10-24', 'calme', 10, { source: 'wishes' }), entry('2026-10-24', 'foyer', 10)];
  const byCat = {}, days = {}, dailyCats = {};
  for (const e of history) {
    byCat[e.cat] = (byCat[e.cat] || 0) + e.min;
    days[e.day] = (days[e.day] || 0) + e.min;
    dailyCats[e.day] = { ...dailyCats[e.day], [e.cat]: ((dailyCats[e.day] || {})[e.cat] || 0) + e.min };
  }
  return town(byCat, [{ id: 'n', item: 'banc', x: 0, y: 0, at: at('2026-10-21T09:00:00Z'), paid: 2e6 }], {
    createdAt: at('2026-05-04T09:00:00Z'), history, stats: { ok: history.length, byCat, days, dailyCats },
    gifts: { 'visit:2026-10-20': at('2026-10-20T08:00:00Z'), 'visit:2026-10-23': at('2026-10-23T08:00:00Z') },
  });
}
// Lance une activité libre, l'horloge simulée : en Concentration, un saut d'horloge passerait pour une sortie de l'app.
async function startSession(page, name, minutes) {
  await page.locator('[data-tab="activites"]').click();
  await page.getByRole('button', { name: new RegExp('^' + name) }).first().click();
  await page.getByRole('radio', { name: minutes + ' min', exact: true }).click();
  await page.getByRole('radio', { name: 'Activité libre', exact: true }).click();
  await page.getByRole('button', { name: /^Commencer/ }).click();
  const warning = page.getByRole('button', { name: "C'est réglé, commencer", exact: true });
  if (await warning.isVisible()) await warning.click();
  await page.waitForFunction(() => window.__ville.activeState() === 'mine');
}
// … et la mène au bout.
async function runSession(page, name, minutes) {
  await startSession(page, name, minutes);
  await page.clock.fastForward(minutes * 60000 + 1000);
  await page.locator('#sessResult').waitFor();
}
const setVisibility = (page, value) => page.evaluate(state => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}, value);
// Une ville neuve, l'horloge simulée au mercredi 21 octobre 2026, avec une activité par domaine.
async function sessionTown(browser, settings = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Zurich' });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-21T10:00:00Z') });
  await page.addInitScript(state => { window.__VILLE_DEBUG__ = true; if (!localStorage.getItem('ville-bien-etre/v2')) localStorage.setItem('ville-bien-etre/v2', JSON.stringify(state)); },
    town({ esprit: 5 }, [], { activities: activities(), settings: { lang: 'fr', sound: false, ...settings } }));
  return { context, page, errors };
}

// Défis relevés à l'ouverture : 5 M chacun, une seule fois ; le Journal les montre relevés.
async function challengesAtOpening(browser, baseURL) {
  const seed = filledWeek();
  const { context, page, errors } = await cityAt(browser, baseURL, seed, '2026-10-25T16:00:00Z');
  try {
    await page.waitForFunction(() => /Défi relevé/.test(document.querySelector('#toast').textContent));
    assert.equal(await page.evaluate(() => __ville.state.coins), seed.coins + 15e6);
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => __ville.state.coins), seed.coins + 15e6);
    await page.locator('[data-tab="journal"]').click();
    assert.equal(await page.locator('#challengesCard .chal-row.done').count(), 3);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Défis : relevés à l’ouverture, une seule fois';
}

// Changer un défi : un seul par semaine, gardé au rechargement.
async function challengeSwap(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, town({ esprit: 5 }, [], { createdAt: at('2026-05-04T09:00:00Z') }), '2026-10-21T10:00:00Z');
  try {
    await page.locator('[data-tab="journal"]').click();
    const card = page.locator('#challengesCard'), swaps = card.getByRole('button', { name: /^Changer le défi/ });
    assert.equal(await card.locator('.chal-row').count(), 3);
    assert.equal(await swaps.count(), 3);
    const before = await card.locator('.chal-text').allInnerTexts();
    await swaps.first().click();
    const after = await card.locator('.chal-text').allInnerTexts();
    assert.notEqual(after[0], before[0]);
    assert.equal(await swaps.count(), 0);
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    await page.locator('[data-tab="journal"]').click();
    assert.deepEqual(await page.locator('#challengesCard .chal-text').allInnerTexts(), after);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Défis : changer un défi';
}

// Défi relevé par une séance : l'écran de fin le dit, avec sa récompense.
async function challengeOnResult(browser, baseURL) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Zurich' });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-21T10:00:00Z') });
  await page.addInitScript(state => { window.__VILLE_DEBUG__ = true; if (!localStorage.getItem('ville-bien-etre/v2')) localStorage.setItem('ville-bien-etre/v2', JSON.stringify(state)); },
    town({ esprit: 5 }, [], { createdAt: at('2026-05-04T09:00:00Z'), activities: activities(), settings: { lang: 'fr', sound: false } }));
  try {
    await page.goto(baseURL);
    await page.waitForFunction(() => !!window.__ville);
    const practice = (await page.evaluate(() => __ville.rituals.challenges()))[0];
    const cats = practice.id === 'comeback' ? [practice.cat] : practice.id === 'long' ? ['esprit'] : ['esprit', 'corps'];
    const minutes = practice.id === 'long' ? practice.m : 5;
    for (const [i, cat] of cats.entries()) {
      await runSession(page, 'Pratique ' + cat, minutes);
      if (i < cats.length - 1) await page.getByRole('button', { name: 'Retour à la ville', exact: true }).click();
    }
    assert.match(await page.locator('#sessResult').innerText(), /Défi relevé/);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Défis : relevé sur l’écran de fin';
}

// Mesure, dans la fenêtre ouverte, que rien ne déborde.
async function fitsSheet(page, label) {
  const w = await page.evaluate(() => ({ body: document.querySelector('#sheetBody').scrollWidth, client: document.querySelector('#sheetBody').clientWidth,
    doc: document.documentElement.scrollWidth, inner: innerWidth }));
  assert.ok(w.body <= w.client + 1 && w.doc <= w.inner, `${label} déborde : ${JSON.stringify(w)}`);
}
async function toEnglish(page) {
  await page.locator('#settingsBtn').click();
  await page.locator('#settingsLang').getByRole('radio', { name: 'English', exact: true }).click();
  await page.locator('#sheetClose').click();
}

// Bilan de la semaine : il s'ouvre une seule fois au début de la semaine, puis reste dans le Journal ; à 320 px, il tient.
async function weekReviewOnce(browser, baseURL) {
  const seed = { ...filledWeek(), rituals: { week: '', month: '', year: '' } };
  const { context, page, errors } = await cityAt(browser, baseURL, seed, '2026-10-27T09:00:00Z', { viewport: { width: 320, height: 640 } });
  try {
    await page.locator('#sheet').waitFor();
    assert.equal(await page.locator('#sheetTitle').innerText(), 'Ta semaine');
    assert.match(await page.locator('#sheetBody').innerText(), /19 oct\.[\s\S]*25 oct\./);
    await fitsSheet(page, 'le bilan (fr)');
    await page.locator('#sheetBody').getByRole('button', { name: "C'est parti", exact: true }).click();
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    await page.waitForTimeout(400);
    assert.equal(await page.locator('#sheet').isHidden(), true);
    await page.locator('[data-tab="journal"]').click();
    const card = page.locator('#ritualCards');
    assert.match(await card.innerText(), /Ta semaine dernière/);
    await card.getByRole('button', { name: 'Revoir', exact: true }).click();
    await page.locator('#sheet').waitFor();
    await page.locator('#sheetClose').click();
    await toEnglish(page);
    await page.locator('#ritualCards').getByRole('button', { name: 'See again', exact: true }).click();
    assert.equal(await page.locator('#sheetTitle').innerText(), 'Your week');
    await fitsSheet(page, 'le bilan (en)');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Bilan de la semaine : une fois, puis dans le Journal';
}

// Humeur : demandée sur l'écran de fin, notée d'un geste et gardée ; le réglage coupé ne la demande plus.
async function moodAfterSession(browser, baseURL) {
  for (const mood of [true, false]) {
    const { context, page, errors } = await sessionTown(browser, { mood });
    try {
      await page.goto(baseURL);
      await page.waitForFunction(() => !!window.__ville);
      await runSession(page, 'Pratique calme', 5);
      const picker = page.locator('#sessResult').getByRole('radiogroup', { name: 'Comment te sens-tu ?' });
      if (!mood) { assert.equal(await picker.count(), 0); continue; }
      await picker.getByRole('radio', { name: 'Bien', exact: true }).click();
      assert.equal(await picker.getByRole('radio', { name: 'Bien', exact: true }).getAttribute('aria-checked'), 'true');
      assert.equal(await page.evaluate(() => __ville.state.history[0].mood), 4);
      await page.reload();
      await page.waitForFunction(() => !!window.__ville);
      assert.equal(await page.evaluate(() => __ville.state.history[0].mood), 4);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return 'Humeur : notée sur l’écran de fin, ou pas demandée';
}

// Activité libre finie pendant que l'app était en arrière-plan : au retour, l'humeur demandée va à cette séance-là.
async function moodAfterReturn(browser, baseURL) {
  const { context, page, errors } = await sessionTown(browser);
  try {
    await page.goto(baseURL);
    await page.waitForFunction(() => !!window.__ville);
    await startSession(page, 'Pratique corps', 5);
    const id = await page.evaluate(() => __ville.state.active.id);
    await setVisibility(page, 'hidden');
    await page.clock.fastForward(7 * 60000);
    await setVisibility(page, 'visible');
    await page.locator('#sessResult').waitFor();
    await page.locator('#sessResult').getByRole('radio', { name: 'Très bien', exact: true }).click();
    assert.equal(await page.evaluate(entry => __ville.state.history.find(e => e.id === entry).mood, id), 5);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Humeur : au retour, sur la bonne séance';
}

// Des séances avec leur humeur, la plus récente d'abord, un jour d'écart chacune avant le mercredi 21 octobre 2026.
function moodTown(moods) {
  const history = moods.map(([cat, mood], i) => ({ id: 'm' + i, name: 'Pratique ' + cat, cat, min: 10, ok: true, reward: 10e6, at: at('2026-10-21T08:00:00Z') - i * 864e5,
    day: '2026-10-' + String(21 - i).padStart(2, '0'), source: 'direct', mode: 'focus', mood }));
  return town({ esprit: 5 }, [], { history, stats: { ok: history.length, byCat: { esprit: 5 }, days: {}, dailyCats: {} } });
}
const fitsPage = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

// Journal : « Ce qui te fait du bien » dès 5 humeurs, avec la phrase du domaine en tête ; la carte douce des moments
// difficiles, que « Merci » range pour 7 jours, rechargement compris. À 320 px, en français et en anglais.
async function moodCards(browser, baseURL) {
  const options = { viewport: { width: 320, height: 640 } };
  const good = await cityAt(browser, baseURL, moodTown([['calme', 5], ['corps', 2], ['calme', 4], ['corps', 4], ['calme', 4]]), '2026-10-21T10:00:00Z', options);
  try {
    await good.page.locator('[data-tab="journal"]').click();
    const card = good.page.locator('#moodCard');
    assert.match(await card.innerText(), /Ce qui te fait du bien[\s\S]*Après Calme, tu te sentais bien 3 fois sur 3/);
    assert.deepEqual(await card.locator('.meter-row .name').allInnerTexts(), ['Corps', 'Calme']);
    assert.equal(await good.page.locator('#moodSupport').count(), 0);
    assert.equal(await fitsPage(good.page), true);
    await toEnglish(good.page);
    assert.match(await card.innerText(), /What makes you feel good[\s\S]*After Calm, you felt good 3 times out of 3/);
    assert.deepEqual(good.errors, []);
  } finally { await good.context.close(); }
  const hard = await cityAt(browser, baseURL, moodTown([['calme', 2], ['corps', 1], ['calme', 4], ['corps', 2], ['calme', 5]]), '2026-10-21T10:00:00Z', options);
  try {
    await hard.page.locator('[data-tab="journal"]').click();
    const support = hard.page.locator('#moodSupport');
    assert.match(await support.innerText(), /Tes dernières séances ont été difficiles\.[\s\S]*un professionnel de santé peut t'accompagner/);
    assert.equal(await fitsPage(hard.page), true);
    await support.getByRole('button', { name: 'Merci', exact: true }).click();
    assert.equal(await support.count(), 0);
    await hard.page.reload();
    await hard.page.waitForFunction(() => !!window.__ville);
    await hard.page.locator('[data-tab="journal"]').click();
    assert.equal(await hard.page.locator('#moodCard').isVisible(), true);
    assert.equal(await hard.page.locator('#moodSupport').count(), 0);
    assert.deepEqual(hard.errors, []);
  } finally { await hard.context.close(); }
  return 'Ce qui te fait du bien, et les moments difficiles';
}

// Récapitulatifs : au premier lundi de novembre, le mois d'octobre s'ouvre avant le bilan de la semaine (une fenêtre par
// ouverture), puis reste dans le Journal ; en janvier, c'est l'année. À 320 px, rien ne déborde, en français et en anglais.
async function recapsOnce(browser, baseURL) {
  const seed = { ...filledWeek(), rituals: { week: '', month: '', year: '' } }, options = { viewport: { width: 320, height: 640 } };
  const nov = await cityAt(browser, baseURL, seed, '2026-11-02T09:00:00Z', options);
  try {
    const { page } = nov;
    await page.locator('#sheet').waitFor();
    assert.equal(await page.locator('#sheetTitle').innerText(), 'Octobre 2026');
    assert.match(await page.locator('#sheetBody').innerText(), /Ton mois en un coup d'œil[\s\S]*Temps de pratique[\s\S]*Tes domaines[\s\S]*Ton plus beau jour/);
    await fitsSheet(page, 'le récapitulatif du mois (fr)');
    await page.locator('#sheetClose').click();
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    await page.locator('#sheet').waitFor();
    assert.equal(await page.locator('#sheetTitle').innerText(), 'Ta semaine');
    await page.locator('#sheetClose').click();
    await page.locator('[data-tab="journal"]').click();
    const cards = page.locator('#ritualCards');
    assert.match(await cards.innerText(), /Ton mois[\s\S]*Octobre 2026/);
    assert.doesNotMatch(await cards.innerText(), /Ton année/);
    await toEnglish(page);
    await cards.getByRole('button', { name: 'View', exact: true }).click();
    assert.equal(await page.locator('#sheetTitle').innerText(), 'October 2026');
    await fitsSheet(page, 'le récapitulatif du mois (en)');
    assert.deepEqual(nov.errors, []);
  } finally { await nov.context.close(); }
  const jan = await cityAt(browser, baseURL, seed, '2027-01-04T09:00:00Z', options);
  try {
    await jan.page.locator('#sheet').waitFor();
    assert.equal(await jan.page.locator('#sheetTitle').innerText(), '2026');
    assert.match(await jan.page.locator('#sheetBody').innerText(), /Ton année en un coup d'œil/);
    assert.doesNotMatch(await jan.page.locator('#sheetBody').innerText(), /Séances réussies/);
    await fitsSheet(jan.page, 'le récapitulatif de l’année (fr)');
    assert.deepEqual(jan.errors, []);
  } finally { await jan.context.close(); }
  return 'Récapitulatifs du mois et de l’année';
}

// Image du récapitulatif : 1080 × 1350, partagée en un seul fichier PNG quand le téléphone accepte les fichiers, sinon
// téléchargée. Le temps de pratique y est, l'humeur jamais (une humeur est notée en octobre).
async function recapImage(browser, baseURL) {
  const seed = { ...filledWeek(), rituals: { week: '', month: '', year: '' } };
  seed.history = seed.history.map((e, i) => (i ? e : { ...e, mood: 5 }));
  for (const canShare of [true, false]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Zurich' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.clock.setFixedTime(new Date('2026-11-02T09:00:00Z'));
      await page.addInitScript(([state, share]) => {
        localStorage.setItem('ville-bien-etre/v2', JSON.stringify(state));
        window.__texts = [];
        const fill = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) { window.__texts.push(String(text)); return fill.call(this, text, ...rest); };
        navigator.canShare = () => share;
        navigator.share = async data => { window.__shared = data; };
      }, [seed, canShare]);
      await page.goto(baseURL);
      await page.locator('#sheet').waitFor();
      assert.match(await page.locator('#sheetBody').innerText(), /tu te sentais bien/);
      const button = page.locator('#sheetBody').getByRole('button', { name: "Partager l'image", exact: true });
      if (canShare) {
        await button.click();
        await page.waitForFunction(() => !!window.__shared);
        const shared = await page.evaluate(async () => {
          const files = window.__shared.files, bitmap = await createImageBitmap(files[0]);
          return { count: files.length, type: files[0].type, name: files[0].name, width: bitmap.width, height: bitmap.height };
        });
        assert.deepEqual(shared, { count: 1, type: 'image/png', name: 'mon-mois-2026-10.png', width: 1080, height: 1350 });
        const texts = await page.evaluate(() => window.__texts);
        assert.ok(texts.includes('Octobre 2026') && texts.some(text => /^1\sh\s40$/.test(text)), texts.join(' | '));
        assert.ok(!texts.some(text => /sentais/.test(text)), texts.join(' | '));
      } else {
        const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
        assert.equal(download.suggestedFilename(), 'mon-mois-2026-10.png');
      }
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return 'Image du récapitulatif : partagée, ou téléchargée';
}

// La ville de Léa : six éléments, dont un Grand Arbre en fleurs ; son code, lu dans un premier navigateur.
const LEA_TILES = [['maison', 1, 1], ['arbre', 2, 1], ['grandarbre', 3, 3, 4], ['banc', 4, 2], ['fontaine', 5, 5], ['fleurs', 0, 6]]
  .map(([item, x, y, stage], i) => ({ id: 'l' + i, item, x, y, at: at('2026-10-01T09:00:00Z'), paid: 1e6, ...(stage ? { stage } : {}) }));
async function leaCode(browser, baseURL) {
  const seed = town({ esprit: 300, calme: 40 }, LEA_TILES, { personal: { name: 'Léa' }, stats: { ok: 3, byCat: { esprit: 300, calme: 40 }, days: {}, dailyCats: { '2026-10-20': { calme: 10 } } } });
  const { context, page } = await cityAt(browser, baseURL, seed, '2026-10-21T10:00:00Z');
  try { return await page.evaluate(() => __ville.share.encode()); } finally { await context.close(); }
}
const visitHead = page => page.locator('#cityVisitHead');

// Visite : un lien #ville= ouvre la ville de Léa en grand, sans toucher à la sienne ; on zoome, on ferme. Un lien abîmé
// donne un message doux. Pendant une séance, la visite attend la fin de la séance.
async function visitFriend(browser, baseURL) {
  const code = await leaCode(browser, baseURL), origin = baseURL.replace(/#.*$/, '');
  const { context, page, errors } = await sessionTown(browser);
  try {
    await page.addInitScript(() => { window.__VILLE_DEBUG__ = true; });
    await page.goto(origin + '#ville=' + code);
    await page.waitForFunction(() => !!window.__ville);
    await page.locator('#cityBig').waitFor();
    assert.match(await visitHead(page).innerText(), /Léa[\s\S]*6 éléments · terrain 7×7/);
    assert.doesNotMatch(await visitHead(page).innerText(), /null|Ta ville, telle/);
    assert.equal(await page.evaluate(() => location.hash), '');
    const own = await page.evaluate(() => JSON.stringify(__ville.state.city));
    assert.deepEqual(JSON.parse(own), { size: 7, tiles: [] });
    assert.equal(await page.evaluate(() => __ville.City.bigState().visit), true);
    await page.locator('#visitKeep').click();
    await page.locator('#toast').getByText('Carte postale gardée dans ton carnet').waitFor();
    assert.equal(await page.locator('#visitKeep').innerText(), 'Gardée');
    assert.deepEqual(await page.evaluate(() => Object.values(__ville.state.postcards).map(c => [c.name, c.size, c.count])), [['Léa', 7, 6]]);
    await page.locator('#cityBigIn').click();
    await page.waitForFunction(() => __ville.City.bigState().zoom > 1);
    await page.locator('#cityBigClose').click();
    await page.waitForFunction(() => !__ville.City.bigState().open);
    assert.equal(await page.evaluate(() => __ville.City.bigState().visit), false);
    assert.equal(await page.evaluate(() => JSON.stringify(__ville.state.city)), own);
    // Lien abîmé : un message, aucune vue.
    await page.evaluate(() => { location.hash = '#ville=abc'; });
    await page.locator('#toast').getByText("Ce lien de ville n'est pas lisible").waitFor();
    assert.equal(await page.locator('#cityBig').isHidden(), true);
    // Pendant une séance : la visite attend que la séance et son écran de fin soient fermés.
    await startSession(page, 'Pratique calme', 5);
    await page.evaluate(c => { location.hash = '#ville=' + c; }, code);
    await page.locator('#toast').getByText("Ta séance d'abord : la ville amie s'ouvrira juste après").waitFor();
    assert.equal(await page.locator('#cityBig').isHidden(), true);
    await page.clock.fastForward(5 * 60000 + 1000);
    await page.locator('#sessResult').waitFor();
    await page.locator('#sessResult').getByRole('button', { name: 'Retour à la ville', exact: true }).click();
    await page.locator('#cityBig').waitFor();
    assert.match(await visitHead(page).innerText(), /Léa/);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return "Visite d'une ville amie";
}

// Partager ma ville : « Envoyer » passe par le partage du téléphone avec le lien ; sans lui, « Copier le lien » le copie.
// « Visiter une ville amie » ouvre un lien collé, et « Partager ma ville en retour » rouvre la fenêtre. À 320 px, la fenêtre
// tient, en français et en anglais.
async function shareCity(browser, baseURL) {
  const code = await leaCode(browser, baseURL), origin = baseURL.replace(/#.*$/, '');
  for (const canShare of [true, false]) {
    const context = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Zurich' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.clock.setFixedTime(new Date('2026-10-21T10:00:00Z'));
      await page.addInitScript(([state, share]) => {
        window.__VILLE_DEBUG__ = true;
        if (!localStorage.getItem('ville-bien-etre/v2')) localStorage.setItem('ville-bien-etre/v2', JSON.stringify(state));
        if (share) navigator.share = async data => { window.__shared = data; };
        else { delete Navigator.prototype.share; delete Navigator.prototype.canShare; }
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.__copied = text; } }, configurable: true });
      }, [town({ esprit: 5 }, [{ id: 'b', item: 'banc', x: 0, y: 0, at: at('2026-10-20T09:00:00Z'), paid: 1e6 }]), canShare]);
      await page.goto(origin);
      await page.waitForFunction(() => !!window.__ville);
      await page.locator('#shareCity').click();
      const sheet = page.locator('#sheetBody');
      assert.match(await sheet.innerText(), /Ton ami verra ta ville telle qu'elle est[\s\S]*nom par défaut/);
      const link = await page.locator('#shareLinkField').inputValue();
      assert.ok(link.startsWith(origin + '#ville='), link);
      if (canShare) {
        await sheet.getByRole('button', { name: 'Envoyer', exact: true }).click();
        await page.waitForFunction(() => !!window.__shared);
        assert.equal(await page.evaluate(() => window.__shared.url), link);
        await fitsSheet(page, 'le partage (fr)');
      } else {
        assert.equal(await sheet.getByRole('button', { name: 'Envoyer', exact: true }).count(), 0);
        await sheet.getByRole('button', { name: 'Copier le lien', exact: true }).click();
        await page.locator('#toast').getByText('Lien copié').waitFor();
        assert.equal(await page.evaluate(() => window.__copied), link);
        await page.locator('#sheetClose').click();
        await toEnglish(page);
        await page.locator('#shareCity').click();
        await fitsSheet(page, 'le partage (en)');
        await page.locator('#visitLinkField').fill('Look at my town ' + origin + '#ville=' + code + ' !');
        await sheet.getByRole('button', { name: 'Visit', exact: true }).click();
        await page.locator('#cityBig').waitFor();
        assert.match(await page.locator('#cityVisitHead').innerText(), /Léa/);
        await page.locator('#visitShare').click();
        assert.equal(await page.locator('#sheetTitle').innerText(), 'Share my town');
      }
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return 'Partager ma ville, et visiter en collant un lien';
}

// Deux codes de la ville de Léa : le premier, puis le même après un banc de plus (même identifiant).
async function leaCodes(browser, baseURL) {
  const seed = town({ esprit: 300, calme: 40 }, LEA_TILES, { personal: { name: 'Léa' }, stats: { ok: 3, byCat: { esprit: 300, calme: 40 }, days: {}, dailyCats: {} } });
  const { context, page } = await cityAt(browser, baseURL, seed, '2026-10-21T10:00:00Z');
  try {
    return await page.evaluate(() => {
      const first = __ville.share.encode();
      __ville.state.city.tiles.push({ id: 'l9', item: 'banc', x: 6, y: 6, at: Date.now(), paid: 1e6 });
      return [first, __ville.share.encode()];
    });
  } finally { await context.close(); }
}
async function openVisits(page) {
  await page.locator('[data-tab="journal"]').click();
  await page.locator('#carnetCard').getByRole('button', { name: 'Ouvrir le carnet', exact: true }).click();
  await page.locator('#sheetBody').getByRole('radio', { name: 'Visites', exact: true }).click();
  return page.locator('#sheetBody .carnet-postcard');
}

// Cartes postales : gardée pendant la visite, la carte de Léa est dans le carnet (Visites, « Villes amies »), avec une
// vignette ; la toucher rouvre sa ville. Revisiter sa ville avec un code plus récent garde une seule carte, mise à jour. Le
// lien de sa propre ville se montre « telle que tes amis la voient », sans carte à garder. À 320 px, rien ne déborde.
async function postcardsInCarnet(browser, baseURL) {
  const [first, second] = await leaCodes(browser, baseURL);
  const { context, page, errors } = await cityAt(browser, baseURL, town({ esprit: 5 }), '2026-10-21T10:00:00Z', { viewport: { width: 320, height: 640 } });
  try {
    let cards = await openVisits(page);
    assert.match(await page.locator('#sheetBody').innerText(), /Villes amies[\s\S]*Les villes de tes amis apparaîtront ici\./);
    await page.locator('#sheetClose').click();
    await page.locator('[data-tab="ville"]').click();
    for (const [code, items] of [[first, 6], [second, 7]]) {
      await page.evaluate(c => { location.hash = '#ville=' + c; }, code);
      await page.locator('#cityBig').waitFor();
      await page.locator('#visitKeep').click();
      await page.locator('#toast').getByText('Carte postale gardée dans ton carnet').waitFor();
      await page.locator('#cityBigClose').click();
      await page.locator('#cityBig').waitFor({ state: 'hidden' });
      cards = await openVisits(page);
      assert.equal(await cards.count(), 1);
      assert.match(await cards.first().innerText(), /Léa[\s\S]*Visitée le/);
      assert.equal(await cards.first().locator('canvas').count(), 1);
      assert.equal(await page.evaluate(() => Object.values(__ville.state.postcards)[0].count), items);
      assert.ok(await page.evaluate(() => __ville.state.achievements['carte-postale']), 'succès « Carte postale »');
      const w = await page.evaluate(() => ({ body: document.querySelector('#sheetBody').scrollWidth, client: document.querySelector('#sheetBody').clientWidth, doc: document.documentElement.scrollWidth }));
      assert.ok(w.body <= w.client + 1 && w.doc <= 320, 'le carnet déborde à 320 px : ' + JSON.stringify(w));
      await cards.first().click();
      await page.locator('#cityBig').waitFor();
      assert.match(await page.locator('#cityVisitHead').innerText(), /Léa[\s\S]*éléments/);
      await page.locator('#cityBigClose').click();
      await page.locator('#cityBig').waitFor({ state: 'hidden' });
      await page.locator('[data-tab="ville"]').click();
    }
    // Sa propre ville : vue comme les amis la voient, sans carte postale à garder.
    const own = await page.evaluate(() => __ville.share.encode());
    await page.evaluate(c => { location.hash = '#ville=' + c; }, own);
    await page.locator('#cityBig').waitFor();
    assert.match(await page.locator('#cityVisitHead').innerText(), /Ta ville, telle que tes amis la voient/);
    assert.equal(await page.locator('#visitKeep').isHidden(), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Cartes postales des villes amies';
}

// Réglages des rituels : trois interrupteurs, gardés au rechargement ; « Défis de la semaine » coupé retire la carte des défis.
async function ritualSettings(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, town({ esprit: 5 }), '2026-10-21T10:00:00Z', { viewport: { width: 320, height: 640 } });
  const names = ['Bilans au début de la semaine et du mois', 'Défis de la semaine', 'Demander mon humeur après une séance'];
  const sw = name => page.locator('#settingsRituals').getByRole('switch', { name, exact: true });
  try {
    await page.locator('[data-tab="journal"]').click();
    assert.equal(await page.locator('#challengesCard').count(), 1);
    await page.locator('#settingsBtn').click();
    for (const name of names) {
      assert.equal(await sw(name).getAttribute('aria-checked'), 'true');
      await sw(name).click();
      assert.equal(await sw(name).getAttribute('aria-checked'), 'false');
    }
    await fitsSheet(page, 'les réglages');
    await page.locator('#sheetClose').click();
    assert.equal(await page.locator('#challengesCard').count(), 0);
    assert.deepEqual(await page.evaluate(() => ['rituals', 'challenges', 'mood'].map(key => __ville.state.settings[key])), [false, false, false]);
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    await page.locator('#settingsBtn').click();
    for (const name of names) assert.equal(await sw(name).getAttribute('aria-checked'), 'false');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Réglages des rituels';
}

const SCENARIOS = [challengesAtOpening, challengeSwap, challengeOnResult, weekReviewOnce, moodAfterSession, moodAfterReturn, moodCards, recapsOnce, recapImage, visitFriend, shareCity,
  postcardsInCarnet, ritualSettings];
async function runRituals(browser, baseURL) {
  const scenarios = [];
  for (const scenario of SCENARIOS) scenarios.push(await scenario(browser, baseURL));
  return { scenarios };
}

module.exports = { runRituals, SCENARIOS, filledWeek, runSession, startSession, activities };
