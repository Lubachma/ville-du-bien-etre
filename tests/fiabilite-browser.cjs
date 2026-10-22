const assert = require('node:assert/strict');
const { town } = require('./content-browser.cjs');
const { cityAt } = require('./ambient-browser.cjs');
const { sessionTown, startSession, setVisibility, leaCode } = require('./rituals-browser.cjs');
const { sessionPage, sources } = require('./harmony-browser.cjs');

// Étape 7, la fiabilité : chaque scénario est une fonction à part, qu'on peut lancer seule. Les tâches suivantes y ajoutent les leurs.
const NOW = '2026-10-21T10:00:00Z';
// Un compagnon déjà accueilli (le 1er octobre), comme dans companion-browser.cjs.
const pet = (extra = {}) => ({ species: 'lapin', name: 'Pompon', since: Date.parse('2026-10-01T09:00:00Z'), minutes: 0, wear: '', ...extra });

// Garde générique : le texte visible de « selector » ne contient jamais « null », « undefined » ou « NaN » en mot entier, c'est-à-dire
// une valeur vide écrite telle quelle dans un écran. Le texte réservé aux lecteurs d'écran compte aussi.
const TECH_TEXT = /\b(null|undefined|NaN)\b/;
async function assertNoTechText(page, selector) {
  const zone = page.locator(selector);
  await zone.waitFor();   // visible : on lit ce que la personne voit, pas un écran encore caché
  const text = await zone.innerText(), found = TECH_TEXT.exec(text);
  if (found) assert.fail(`${selector} montre « ${found[0]} » : …${text.slice(Math.max(0, found.index - 40), found.index + 40).replace(/\s+/g, ' ')}…`);
}

// Attend que la séance tourne : la mise en garde « écran allumé » suit la demande au navigateur, parfois un peu plus tard.
async function confirmStart(page) {
  await page.waitForFunction(() => window.__ville.activeState() === 'mine' || !!document.querySelector('#wakeAck'));
  const warning = page.getByRole('button', { name: "C'est réglé, commencer", exact: true });
  if (await warning.isVisible()) await warning.click();
  await page.waitForFunction(() => window.__ville.activeState() === 'mine');
}
// Une séance en Concentration, choisie depuis l'onglet Activités : sa fenêtre de départ reste ouverte, rien n'est lancé.
async function pickFocus(page, name = 'Méditation', minutes = 5) {
  await page.locator('[data-tab="activites"]').click();
  await page.getByRole('button', { name: new RegExp('^' + name) }).first().click();
  await page.getByRole('radio', { name: minutes + ' min', exact: true }).click();
  await page.getByRole('radio', { name: 'Concentration', exact: true }).click();
}
// … puis lancée. L'horloge de la page est simulée (cityAt ou sessionTown).
async function startFocus(page, name, minutes) {
  await pickFocus(page, name, minutes);
  await page.getByRole('button', { name: /^Commencer/ }).click();
  await confirmStart(page);
}
const result = page => page.locator('#sessResult');
const backToCity = page => result(page).getByRole('button', { name: 'Retour à la ville', exact: true }).click();
// Une séance menée au bout : runFor fait tourner l'horloge pas à pas, et la Concentration compte le temps qui passe tic après tic.
async function succeed(page) {
  await startFocus(page);
  await page.clock.runFor('05:03');
  await result(page).waitFor();
  assert.equal(await result(page).locator('.res-title').innerText(), 'Session réussie');
}
// … et une séance interrompue : fastForward saute d'un coup plus loin que le délai de grâce, comme une app laissée de côté.
async function interrupt(page) {
  await startFocus(page);
  await page.clock.fastForward('05:02');
  await result(page).waitFor();
  assert.equal(await result(page).locator('.res-title').innerText(), 'Session interrompue');
}

// Écran de fin d'une ville sans compagnon : la réussite, puis l'interruption (et « Recommencer »), sans un mot technique.
// Chaque nouvelle personne passe par là dès sa première récompense.
async function endScreenWithoutCompanion(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, town({}, []), NOW);
  try {
    await succeed(page);
    await assertNoTechText(page, '#sessResult');
    await backToCity(page);
    await interrupt(page);
    await assertNoTechText(page, '#sessResult');
    await result(page).getByRole('button', { name: 'Recommencer', exact: true }).click();
    await confirmStart(page);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Écran de fin : aucun texte technique, sans compagnon';
}

// Même chose pour qui a masqué son compagnon : il existe encore, mais rien de lui n'est affiché.
async function endScreenHiddenCompanion(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, town({}, [], { companion: pet(), settings: { lang: 'fr', companionShown: false } }), NOW);
  try {
    await succeed(page);
    await assertNoTechText(page, '#sessResult');
    await backToCity(page);
    await interrupt(page);
    await assertNoTechText(page, '#sessResult');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Écran de fin : aucun texte technique, compagnon masqué';
}

// Une ville qui vient de faire sa première séance : la Ville, le Journal, la boutique et les Réglages ne disent rien de technique.
async function screensWithoutTechText(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, town({}, []), NOW);
  try {
    await succeed(page);
    await backToCity(page);
    await assertNoTechText(page, '#view-ville');
    await page.locator('[data-tab="journal"]').click();
    await assertNoTechText(page, '#view-journal');
    await page.locator('[data-tab="ville"]').click();
    await page.locator('#buildBtn').click();
    await assertNoTechText(page, '#sheet');
    await page.locator('#sheetClose').click();
    await page.locator('#settingsBtn').click();
    await assertNoTechText(page, '#sheet');
    await page.locator('#sheetClose').click();
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Écrans : aucun texte technique sur la ville, le Journal, la boutique et les réglages';
}

// Un onglet resté sur l'ancienne version (la mise à jour a été acceptée dans un autre onglet) se recharge de lui-même, mais seulement
// au repos. markLate rejoue ce que le service worker lui annonce alors ; window.marker disparaît avec la page : c'est la preuve d'un rechargement.
const markLate = page => page.evaluate(() => {
  window.marker = true;
  VillePWA.reloadAvailable = true; VillePWA.update = true;
  window.dispatchEvent(new CustomEvent('ville:pwa'));
});
// Rien ne s'est rechargé et rien n'est en train de l'être (reloading ne se pose qu'au moment de recharger), et le bandeau « Mettre à jour »
// reste affiché en attendant.
async function assertStays(page, label) {
  await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(() => [window.marker, VillePWA.reloading, document.querySelector('#updateNotice').hidden]), [true, false, false], label);
}
// Le geste qui libère l'onglet le recharge. On attend la disparition du marqueur plutôt qu'une navigation : fermer la vue en grand passe
// par history.back(), qui en est une aussi sans rien recharger.
async function assertReloads(page, release, label) {
  await release();
  const reloaded = await page.waitForFunction(() => window.marker === undefined && !!window.__ville, null, { timeout: 10000 }).then(() => true, () => false);
  assert.ok(reloaded, label + " : l'onglet ne s'est pas rechargé");
}

// Onglet en retard : au repos, l'annonce suffit pour qu'il se recharge. Une fenêtre ouverte, une séance qui tourne (et son écran de fin),
// la visite d'une ville amie ou une pose le retiennent jusqu'à leur fermeture ; en arrière-plan, seule la séance le retient. La séance
// libre suit l'horloge simulée, comme dans rituals-browser.cjs.
async function lateTabReloadsWhenIdle(browser, baseURL) {
  const code = await leaCode(browser, baseURL);
  const { context, page, errors } = await sessionTown(browser);
  try {
    await page.goto(baseURL);
    await page.waitForFunction(() => !!window.__ville);
    // Au repos.
    await assertReloads(page, () => markLate(page), 'onglet au repos');
    // Une fenêtre ouverte.
    await page.locator('#settingsBtn').click();
    await markLate(page);
    await assertStays(page, 'Réglages ouverts');
    await assertReloads(page, () => page.locator('#sheetClose').click(), 'Réglages fermés');
    // Une séance libre : elle tourne, même page passée en arrière-plan, puis son écran de fin attend « Retour à la ville ».
    await startSession(page, 'Pratique corps', 5);
    await markLate(page);
    await page.clock.runFor(60000);
    await assertStays(page, 'séance en cours');
    await setVisibility(page, 'hidden');
    await assertStays(page, 'séance en cours, page en arrière-plan');
    await setVisibility(page, 'visible');
    await page.clock.fastForward(4 * 60000 + 1000);
    await result(page).waitFor();
    await markLate(page);   // le service worker le redit : l'écran de fin retient aussi l'onglet
    await assertStays(page, 'écran de fin');
    await assertReloads(page, () => backToCity(page), 'retour à la ville');
    // La visite d'une ville amie, en grand.
    await page.evaluate(c => __ville.share.open(c), code);
    await page.locator('#cityBig').waitFor();
    await markLate(page);
    await assertStays(page, 'visite ouverte');
    await assertReloads(page, () => page.locator('#cityBigClose').click(), 'visite fermée');
    // La boutique se ferme pour une pose, qui retient l'onglet à son tour ; annulée, elle le libère.
    await page.locator('#buildBtn').click();
    await markLate(page);
    await assertStays(page, 'boutique ouverte');
    await page.getByRole('button', { name: /^Placer Banc pour/ }).click();
    await assertStays(page, 'pose en cours');
    await assertReloads(page, () => page.locator('#placeCancel').click(), 'pose annulée');
    // Une fenêtre encore ouverte, mais la page passe en arrière-plan : plus rien ne retient l'onglet.
    await page.locator('#settingsBtn').click();
    await markLate(page);
    await assertStays(page, 'Réglages ouverts, page visible');
    await assertReloads(page, () => setVisibility(page, 'hidden'), 'page en arrière-plan');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Onglet en retard : rechargé au repos seulement';
}

// Le geste qui ferme une fenêtre ou l'écran de fin lance souvent la suite aussitôt (une séance, une visite reçue) : un rechargement entre
// les deux la couperait net. Ici en Concentration, avec un verrou d'écran accordé en retard ou une mise en garde, puis une visite reçue en séance.
async function lateTabWaitsForWhatFollows(browser, baseURL) {
  const code = await leaCode(browser, baseURL);
  const { context, page, errors } = await sessionTown(browser, { keepAwake: false });
  // Un verrou d'écran que le navigateur accorde avec 200 ms de retard : la séance démarre sans mise en garde, mais pas tout de suite.
  await page.addInitScript(() => {
    const lock = { released: false, release() { this.released = true; return Promise.resolve(); }, addEventListener() {} };
    Object.defineProperty(navigator, 'wakeLock', { value: { request: () => new Promise(resolve => setTimeout(() => resolve(lock), 200)) }, configurable: true });
  });
  const warning = page.getByRole('button', { name: "C'est réglé, commencer", exact: true });
  const running = () => page.waitForFunction(() => window.__ville.activeState() === 'mine');
  const interrupted = async () => { await page.clock.fastForward('05:02'); await result(page).waitFor(); };
  try {
    await page.goto(baseURL);
    await page.waitForFunction(() => !!window.__ville);
    // « Écran allumé » coupé : « Commencer » ferme la fenêtre de départ et ouvre la mise en garde, « C'est réglé, commencer » la ferme et lance la séance.
    await pickFocus(page, 'Pratique calme');
    await markLate(page);
    await assertStays(page, 'fenêtre de départ ouverte');
    await page.getByRole('button', { name: /^Commencer/ }).click();
    await assertStays(page, 'mise en garde ouverte');
    await warning.click();
    await assertStays(page, 'séance qui démarre');
    await running();
    await interrupted();
    await assertStays(page, 'séance interrompue');
    // « Écran allumé » remis : « Recommencer » ferme l'écran de fin, puis attend le verrou, sans fenêtre ni séance entre-temps.
    await page.evaluate(() => { __ville.state.settings.keepAwake = true; });
    await result(page).getByRole('button', { name: 'Recommencer', exact: true }).click();
    await assertStays(page, 'séance qui redémarre');
    await running();
    // Un lien d'amie reçu pendant la séance attend sa fin : la visite s'ouvre à la fermeture de l'écran de fin, avant tout rechargement.
    await page.evaluate(c => __ville.share.open(c), code);
    await interrupted();
    await backToCity(page);
    await page.locator('#cityBig').waitFor();
    await assertStays(page, 'visite reçue pendant la séance');
    await assertReloads(page, () => page.locator('#cityBigClose').click(), 'visite fermée');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Onglet en retard : la suite du geste passe avant le rechargement';
}

// Un texte saisi hors fenêtre et pas encore envoyé retient l'onglet visible, même si la personne change d'onglet : le recharger l'effacerait.
// Envoyé, il est enregistré et l'onglet se recharge. Des espaces seuls, ou un texte laissé dans une fenêtre fermée, ne retiennent rien, et en
// arrière-plan plus rien ne retient l'onglet (voulu : la personne est partie).
async function lateTabWaitsForTyping(browser, baseURL) {
  const { context, page, errors } = await sessionTown(browser);
  const wish = page.locator('#addWish [name="name"]');
  try {
    await page.goto(baseURL);
    await page.waitForFunction(() => !!window.__ville);
    // Un texte laissé dans une fenêtre qu'on ferme n'est plus une saisie en cours.
    await page.locator('#shareCity').click();
    await page.locator('#visitLinkField').fill('lien à moitié collé');
    await markLate(page);
    await assertStays(page, 'fenêtre de partage ouverte');
    await assertReloads(page, () => page.locator('#sheetClose').click(), 'fenêtre de partage fermée');
    // Une envie à moitié écrite, page visible et aucune fenêtre ouverte ; le texte reste quand on change d'onglet, ouvre et ferme une fenêtre.
    await page.locator('[data-tab="tirage"]').click();
    await wish.fill('Faire du pain');
    await markLate(page);
    await assertStays(page, 'envie à moitié écrite');
    await page.locator('[data-tab="ville"]').click();
    await page.locator('#settingsBtn').click();
    await page.locator('#sheetClose').click();
    await assertStays(page, 'envie gardée, autre onglet');
    // Envoyée : enregistrée, puis l'onglet se recharge.
    await page.locator('[data-tab="tirage"]').click();
    await assertReloads(page, () => wish.press('Enter'), 'envie envoyée');
    assert.ok(await page.evaluate(() => __ville.state.wishes.some(entry => entry.name === 'Faire du pain')), 'envie enregistrée');
    // Des espaces seuls ne sont pas un texte à garder.
    await page.locator('[data-tab="tirage"]').click();
    await wish.fill('   ');
    await assertReloads(page, () => markLate(page), 'espaces seuls');
    // La page passe en arrière-plan avec un texte non envoyé : plus rien ne retient l'onglet.
    await page.locator('[data-tab="tirage"]').click();
    await wish.fill('Encore une envie');
    await markLate(page);
    await assertStays(page, 'autre envie à moitié écrite');
    await assertReloads(page, () => setVisibility(page, 'hidden'), 'page en arrière-plan');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return "Onglet en retard : attend la fin d'une saisie";
}

// Un démarrage refusé libère l'onglet qu'il retenait : ici l'activité n'existe plus quand on touche « Commencer » (supprimée ailleurs).
// En séance libre, puis en Concentration derrière la mise en garde « écran allumé » (réglage coupé).
async function lateTabReloadsWhenStartIsRefused(browser, baseURL) {
  for (const [label, mode, settings] of [['séance libre', 'Activité libre', {}], ['mise en garde', 'Concentration', { keepAwake: false }]]) {
    const { context, page, errors } = await sessionTown(browser, settings);
    try {
      await page.goto(baseURL);
      await page.waitForFunction(() => !!window.__ville);
      await page.locator('[data-tab="activites"]').click();
      await page.getByRole('button', { name: /^Pratique corps/ }).first().click();
      await page.getByRole('radio', { name: '5 min', exact: true }).click();
      await page.getByRole('radio', { name: mode, exact: true }).click();
      await markLate(page);
      await assertStays(page, label + ' : fenêtre de départ ouverte');
      await page.evaluate(() => { __ville.state.activities = __ville.state.activities.filter(entry => entry.id !== 'a-corps'); });
      const start = page.getByRole('button', { name: /^Commencer/ });
      if (mode === 'Concentration') {
        await start.click();
        await assertStays(page, label + ' : mise en garde ouverte');
        await assertReloads(page, () => page.getByRole('button', { name: "C'est réglé, commencer", exact: true }).click(), label + ' : démarrage refusé');
      } else await assertReloads(page, () => start.click(), label + ' : démarrage refusé');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return 'Onglet en retard : un démarrage refusé le libère';
}

// Le solde est arrondi vers le bas : « 3 M » s'affiche seulement à partir de 3 M. L'en-tête, la boutique et l'écran de fin le disent
// pareil (les prix gardent leur arrondi au plus proche).
const NBSP = '\u00a0';
// Le solde attendu entre 1 M et 100 M : une décimale, vers le bas (2 950 000 → « 2,9 M »).
function floored(coins) {
  assert.ok(coins >= 1e6 && coins < 1e8, 'solde hors de la plage de ce test : ' + coins);
  const tenths = Math.floor(coins / 1e5);
  return Math.floor(tenths / 10) + (tenths % 10 ? ',' + (tenths % 10) : '') + NBSP + 'M';
}
async function balanceRoundsDown(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, town({}, [], { coins: 2950000 }), NOW);
  const coins = () => page.evaluate(() => __ville.state.coins);
  try {
    assert.equal(await page.locator('#balance').innerText(), '2,9' + NBSP + 'M');
    await page.locator('#buildBtn').click();
    assert.match(await page.locator('#sheetBody .note').first().innerText(), /^Solde\s:\s2,9\sM\./);
    await page.locator('#sheetClose').click();
    await succeed(page);
    const after = await coins();
    assert.ok(after > 2950000 && after < 1e8, 'solde après la séance : ' + after);
    assert.equal(await result(page).locator('.res-lines li').last().locator('span').last().innerText(), floored(after));
    assert.equal(await page.locator('#balance').innerText(), floored(after));
    await backToCity(page);
    assert.equal(await page.locator('#balance').innerText(), floored(after));
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Solde : arrondi vers le bas dans l’en-tête, la boutique et l’écran de fin';
}

// Octobre 2026 à « count » séances de 10 min, 6 par jour depuis le 1er. Le journal en garde 150 au plus, les statistiques tout.
const at = iso => Date.parse(iso);
function busyOctober(count, extra = {}) {
  const history = [], days = {}, dailyCats = {};
  for (let i = 0; i < count; i++) {
    const day = '2026-10-' + String(1 + Math.floor(i / 6)).padStart(2, '0');
    history.unshift({ id: 'b' + i, name: 'Pratique calme', cat: 'calme', min: 10, ok: true, reward: 1e7, at: at(day + 'T06:00:00Z') + (i % 6) * 6e5, day, source: 'direct',
      mode: 'focus', ...(i % 5 === 0 ? { mood: 5 } : {}) });
    days[day] = (days[day] || 0) + 10;
    dailyCats[day] = { calme: days[day] };
  }
  history.length = Math.min(history.length, 150);
  return town({ calme: count * 10 }, [], { createdAt: at('2026-05-04T09:00:00Z'), history, stats: { ok: count, byCat: { calme: count * 10 }, days, dailyCats },
    rituals: { week: '', month: '', year: '' }, ...extra });
}
const sheet = page => page.locator('#sheetBody');
// Un journal plein ne couvre plus tout le mois : le récapitulatif n'affiche ni nombre de séances, ni plus longue séance, ni humeur, mais le
// temps de pratique et les jours actifs (venus des statistiques). Le bilan de la semaine d'après, que le journal couvre, garde tous les siens.
async function recapWithFullJournal(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, busyOctober(186), '2026-11-02T09:00:00Z');
  try {
    await page.locator('#sheet').waitFor();
    assert.equal(await page.locator('#sheetTitle').innerText(), 'Octobre 2026');
    const month = await sheet(page).innerText();
    assert.match(month, /Temps de pratique[\s\S]*31\sh/);
    assert.match(month, /Jours actifs[\s\S]*31/);
    assert.match(month, /Tes domaines/);
    assert.doesNotMatch(month, /Séances réussies|plus longue séance|tu te sentais bien/);
    assert.equal(await page.locator('#sheetBody .review-figure').count(), 2);
    await assertNoTechText(page, '#sheetBody');
    // Le bilan de la semaine du 26 octobre au 1er novembre : le journal remonte au 7 octobre, il la couvre.
    await page.locator('#sheetClose').click();
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    await page.locator('#sheet').waitFor();
    assert.equal(await page.locator('#sheetTitle').innerText(), 'Ta semaine');
    const week = await sheet(page).innerText();
    assert.match(week, /Séances réussies/);
    assert.match(week, /Après 8 séances sur 8, tu te sentais bien/);
    assert.equal(await page.locator('#sheetBody .review-figure').count(), 3);
    await assertNoTechText(page, '#sheetBody');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Récapitulatif du mois : un journal plein ne montre pas de chiffres faux';
}

// Le bilan d'une semaine que le journal plein ne couvre pas en entier (150 séances en 5 jours) : deux chiffres, pas de séances.
async function weekReviewWithFullJournal(browser, baseURL) {
  const history = [], days = {}, dailyCats = {};
  for (let i = 0; i < 150; i++) {
    const day = '2026-10-' + String(21 + Math.floor(i / 30));
    history.unshift({ id: 'w' + i, name: 'Pratique calme', cat: 'calme', min: 10, ok: true, reward: 1e7, at: at(day + 'T06:00:00Z') + (i % 30) * 6e5, day, source: 'direct',
      mode: 'focus', mood: 5 });
    days[day] = (days[day] || 0) + 10;
    dailyCats[day] = { calme: days[day] };
  }
  const seed = town({ calme: 1500 }, [], { createdAt: at('2026-05-04T09:00:00Z'), history, stats: { ok: 150, byCat: { calme: 1500 }, days, dailyCats },
    rituals: { week: '', month: '', year: '' } });
  const { context, page, errors } = await cityAt(browser, baseURL, seed, '2026-10-26T09:00:00Z', { viewport: { width: 320, height: 640 } });
  try {
    await page.locator('#sheet').waitFor();
    assert.equal(await page.locator('#sheetTitle').innerText(), 'Ta semaine');
    const week = await sheet(page).innerText();
    assert.match(week, /Temps de pratique[\s\S]*25\sh/);
    assert.match(week, /Jours actifs[\s\S]*5/);
    assert.doesNotMatch(week, /Séances réussies|plus longue séance|tu te sentais bien/);
    // Deux chiffres qui se partagent la ligne, sans case vide.
    assert.equal(await page.locator('#sheetBody .review-figure').count(), 2);
    assert.equal(await page.locator('#sheetBody .review-figures').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 2);
    await assertNoTechText(page, '#sheetBody');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Bilan de la semaine : un journal plein ne montre pas de chiffres faux';
}

// La fenêtre « Ambiance », ouverte pendant la séance, se ferme avec elle (réussie ou interrompue) : l'écran de fin répond, et plus rien ne joue.
// Hors séance, la même fenêtre (rouverte par le crochet de test) enregistre seulement le choix : une boucle lancée là, rien ne l'arrêterait.
// sessionPage (harmony-browser.cjs) simule l'horloge et compte les sources sonores de plus d'une seconde, c'est-à-dire les ambiances.
async function ambienceClosedAtEnd(browser, baseURL) {
  const { context, page, errors } = await sessionPage(browser, baseURL, { ambience: 'rain' });
  // La séance tourne avec son ambiance, et la fenêtre « Ambiance » est ouverte par-dessus.
  const withSheetOpen = async begin => {
    const { started } = await sources(page);
    await begin();
    await page.waitForFunction(count => window.__sources.started > count, started);
    await page.locator('#ambienceBtn').click();
    await page.locator('#sheet').waitFor();
    assert.equal(await page.locator('#sheetTitle').innerText(), 'Ambiance');
  };
  // La séance a pris fin : la fenêtre est fermée, l'écran de fin répond (« Retour à la ville »), aucune ambiance ne joue plus.
  const endedClosed = async (title, label) => {
    await result(page).waitFor();
    assert.equal(await result(page).locator('.res-title').innerText(), title);
    assert.equal(await page.locator('#sheet').isHidden(), true, label + " : la fenêtre « Ambiance » est restée ouverte sur l'écran de fin");
    const audio = await sources(page);
    assert.equal(audio.stopped, audio.started, label + ' : une ambiance joue encore ' + JSON.stringify(audio));
    await backToCity(page);
  };
  try {
    await withSheetOpen(() => startSession(page, 'Pratique calme', 5));
    await page.clock.fastForward(5 * 60000 + 1000);
    await endedClosed('Session réussie', 'séance réussie');
    // Hors séance : « Vagues » est enregistré et le bouton le dit, mais rien ne démarre, même une fois le son rouvert.
    const before = await sources(page);
    await page.evaluate(() => __ville.ambience.open());
    await page.locator('#sheetBody').getByRole('radio', { name: 'Vagues', exact: true }).click();
    assert.equal(await page.evaluate(() => __ville.state.settings.ambience), 'waves');
    assert.match((await page.locator('#ambienceBtn').textContent()).trim(), /^Ambiance\s:\sVagues$/);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => __ville.ambience.kind()), 'none', 'une ambiance joue hors séance');
    assert.deepEqual(await sources(page), before, 'une boucle a démarré hors séance');
    await page.locator('#sheetClose').click();
    // Une séance interrompue en Concentration ferme la fenêtre de la même façon, avec l'ambiance choisie entre-temps.
    await withSheetOpen(() => startFocus(page, 'Pratique calme', 5));
    await page.clock.fastForward('05:02');
    await endedClosed('Session interrompue', 'séance interrompue');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Ambiance : fermée à la fin, aucun son hors séance';
}

const SCENARIOS = [endScreenWithoutCompanion, endScreenHiddenCompanion, screensWithoutTechText, lateTabReloadsWhenIdle, lateTabWaitsForWhatFollows,
  lateTabWaitsForTyping, lateTabReloadsWhenStartIsRefused, balanceRoundsDown, recapWithFullJournal, weekReviewWithFullJournal, ambienceClosedAtEnd];
async function runFiabilite(browser, baseURL) {
  const scenarios = [];
  for (const scenario of SCENARIOS) scenarios.push(await scenario(browser, baseURL));
  return { scenarios };
}

module.exports = { runFiabilite, SCENARIOS, assertNoTechText };
