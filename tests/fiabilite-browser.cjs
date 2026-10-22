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
// La mise en garde de la séance d'avant reste dans la fenêtre fermée : seule celle d'une fenêtre ouverte compte.
async function confirmStart(page) {
  await page.waitForFunction(() => window.__ville.activeState() === 'mine' || !!document.querySelector('#sheet:not([hidden]) #wakeAck'));
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

// Le son d'une séance, interrompu pendant que l'app était en arrière-plan (appel, verrouillage), repart au retour au premier plan, par le
// vrai écouteur « visibilitychange » ; interrompu page visible (Siri), il repart aussitôt. Chromium n'interrompt jamais le son de lui-même :
// le test le met en veille, comme iOS. Les tests unitaires (session-platform.test.cjs) couvrent le repli au toucher.
async function soundResumedOnReturn(browser, baseURL) {
  const { context, page, errors } = await sessionTown(browser, { ambience: 'rain' });
  // Les contextes audio de l'app, gardés pour le test.
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    window.__audio = [];
    window.AudioContext = class extends Native { constructor(...args) { super(...args); window.__audio.push(this); } };
  });
  const audioState = () => page.evaluate(() => window.__audio.map(c => c.state).join());
  const interruptSound = () => page.evaluate(() => window.__audio[0].suspend().then(() => window.__audio[0].state));
  const soundBack = async label => {
    try { await page.waitForFunction(() => window.__audio.length === 1 && window.__audio[0].state === 'running', null, { timeout: 3000 }); }
    catch (error) { assert.fail(`${label} : le son ne repart pas (${await audioState()})`); }
  };
  try {
    await page.goto(baseURL);
    await page.waitForFunction(() => !!window.__ville);
    await startSession(page, 'Pratique calme', 5);
    await soundBack('au départ');
    assert.equal(await page.evaluate(() => __ville.ambience.kind()), 'rain');
    // En arrière-plan, le son s'interrompt : rien ne le relance tant que la page est cachée.
    await setVisibility(page, 'hidden');
    assert.equal(await interruptSound(), 'suspended');
    await page.waitForTimeout(300);
    assert.equal(await audioState(), 'suspended', 'son relancé page cachée');
    // Retour au premier plan : il repart, avec la pluie qui jouait.
    await setVisibility(page, 'visible');
    await soundBack('au retour au premier plan');
    // Siri, page visible : il repart aussitôt.
    assert.equal(await interruptSound(), 'suspended');
    await soundBack('après une interruption page visible');
    assert.equal(await page.evaluate(() => __ville.ambience.kind()), 'rain');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Son : relancé au retour au premier plan, et après une interruption';
}

// La ville d'un ami : 9 × 9, trois éléments, une autre ville que la sienne (créée à une autre date, avec son propre identifiant de
// partage). Son code est lu dans un premier navigateur, comme celui de Léa.
const FRIEND_TILES = [['maison', 1, 1], ['arbre', 4, 2], ['fontaine', 7, 7]].map(([item, x, y], i) => ({ id: 'f' + i, item, x, y, at: at('2026-10-01T09:00:00Z'), paid: 1e6 }));
async function nineByNineCode(browser, baseURL) {
  const seed = town({ esprit: 5 }, FRIEND_TILES, { createdAt: at('2026-03-02T09:00:00Z'), city: { size: 9, tiles: FRIEND_TILES } });
  const { context, page } = await cityAt(browser, baseURL, seed, NOW);
  try { return await page.evaluate(() => __ville.share.encode()); } finally { await context.close(); }
}
// L'image de la ville montre toujours sa propre ville, avec la mise en page de sa carte : prise pendant la visite d'une ville amie de
// 9 × 9, elle garde les proportions de celle prise hors visite et le même dessin (l'heure est figée, et une image ne bouge pas), et la
// visite reste telle quelle. Les deux images, celle de la ville et celle du récapitulatif, prennent le ciel du moment : la nuit à 22 h
// (Zurich) même en thème clair, avec un titre clair pour rester lisible ; avec « Ciel selon l'apparence », le ciel clair du thème et
// son encre foncée.
async function imagesOwnCityUnderSky(browser, baseURL) {
  const code = await nineByNineCode(browser, baseURL);
  const seed = town({ esprit: 5 }, [{ id: 'b', item: 'banc', x: 3, y: 3, at: at('2026-10-20T09:00:00Z'), paid: 2e6 }],
    { createdAt: at('2026-05-04T09:00:00Z'), settings: { lang: 'fr', theme: 'light' } });
  const { context, page, errors } = await cityAt(browser, baseURL, seed, '2026-10-21T20:00:00Z');
  // Le dessin de la ville, sans ciel : ses proportions (largeur / hauteur) et ses pixels. État de la vue en grand : ouverte, en visite,
  // place de la case (4, 4) à l'écran.
  const drawing = () => page.evaluate(() => { const image = __ville.City.snapshot(); return { ratio: image.width / image.height, png: image.toDataURL() }; });
  const view = () => page.evaluate(() => { const big = __ville.City.bigState(); return [big.open, big.visit, __ville.City.cellPoint(4, 4)]; });
  // Luminance (0 à 255) du pixel (4, 4) de chaque image, le haut de son ciel, et de l'encre de son titre (le premier texte écrit).
  const images = () => page.evaluate(async () => {
    const luma = ([r, g, b]) => Math.round(.2126 * r + .7152 * g + .0722 * b), rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const fillText = CanvasRenderingContext2D.prototype.fillText, inks = [];
    CanvasRenderingContext2D.prototype.fillText = function (...args) { inks.push(this.fillStyle); return fillText.apply(this, args); };
    const read = async make => {
      inks.length = 0;
      const image = await make();
      return { sky: luma(image.getContext('2d').getImageData(4, 4, 1, 1).data), title: luma(rgb(inks[0])) };
    };
    try { return { png: await read(() => __ville.png.canvas()), recap: await read(() => __ville.rituals.recapCanvas('month', '2026-09')) }; }
    finally { CanvasRenderingContext2D.prototype.fillText = fillText; }
  });
  try {
    // Ma ville, même pendant une visite : ni la vue en grand, ni la ville amie.
    const alone = await drawing();
    assert.equal(await page.evaluate(c => __ville.share.open(c), code), true);
    await page.locator('#cityBig').waitFor();
    const shown = await view();
    assert.deepEqual(shown.slice(0, 2), [true, true]);
    const visiting = await drawing();
    assert.ok(Math.abs(visiting.ratio - alone.ratio) <= .01, `image prise pendant la visite : proportions ${visiting.ratio.toFixed(3)} au lieu de ${alone.ratio.toFixed(3)}`);
    assert.ok(visiting.png === alone.png, "image prise pendant la visite : ce n'est pas le dessin de sa propre ville");
    assert.deepEqual(await view(), shown, "la visite n'est plus la même après l'image");
    await page.locator('#cityBigClose').click();
    await page.locator('#cityBig').waitFor({ state: 'hidden' });
    // Le ciel du moment : la nuit à 22 h, même en thème clair.
    const night = await images();
    assert.ok(night.png.sky < 60 && night.recap.sky < 60, 'ciel des images à 22 h : ' + JSON.stringify(night));
    assert.ok(night.png.title > 180 && night.recap.title > 180, 'titre des images sur le ciel de nuit : ' + JSON.stringify(night));
    // « Ciel selon l'apparence » : le ciel du thème clair.
    await page.evaluate(() => { __ville.state.settings.sky = 'theme'; __ville.City.draw(); });
    const theme = await images();
    assert.ok(theme.png.sky > 180 && theme.recap.sky > 180, 'ciel du thème clair : ' + JSON.stringify(theme));
    assert.ok(theme.png.title < 60 && theme.recap.title < 60, 'titre des images sur le ciel du thème clair : ' + JSON.stringify(theme));
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Images : ma ville, sous le ciel du moment';
}

// Les trois chiffres de l'image du récapitulatif sont posés dans des encadrés couleur de carte (--surface), un peu transparents sur le ciel
// du moment. À .82 d'opacité, leurs libellés (--muted) n'avaient que 3,8:1 en thème clair sous le ciel de nuit, et 3,2:1 en thème sombre
// sous un ciel de jour. Mesuré sur l'image elle-même : chaque libellé a au moins 4,5:1 contre le fond de son encadré, juste à sa gauche, à
// mi-hauteur, dans les deux thèmes, sous les ciels de nuit, de crépuscule (au milieu et à sa fin) et de jour, par beau temps (le plus contrasté).
async function recapFiguresReadable(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, town({ esprit: 5 }, [], { createdAt: at('2026-05-04T09:00:00Z') }), NOW);
  const LABELS = ['Temps de pratique', 'Jours actifs', 'Éléments posés'];
  const SKIES = { nuit: { name: 'night', t: 0 }, crépuscule: { name: 'dusk', t: .5 }, 'fin du crépuscule': { name: 'dusk', t: .9 }, jour: { name: 'day', t: 0 } };
  // Le contraste de chaque libellé de l'image : son encre (fillStyle au moment de l'écrire) contre le pixel du fond à sa gauche.
  const measure = () => page.evaluate(async labels => {
    const lum = ([r, g, b]) => { const c = [r, g, b].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
    const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const fillText = CanvasRenderingContext2D.prototype.fillText, written = [];
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, max) {
      if (labels.includes(text)) written.push({ text, x, y, ink: this.fillStyle, width: Math.min(this.measureText(text).width, max || Infinity), size: parseFloat(/(\d+)px/.exec(this.font)[1]) });
      return fillText.apply(this, arguments);
    };
    try {
      const ctx = (await __ville.rituals.recapCanvas('month', '2026-09')).getContext('2d');
      return written.map(({ text, x, y, ink, width, size }) => {
        const back = ctx.getImageData(Math.round(x - width / 2 - 6), Math.round(y - size * .3), 1, 1).data, [a, b] = [lum(rgb(ink)), lum(back)].sort((p, q) => q - p);
        return { text, ink, back: Array.from(back.slice(0, 3)), ratio: (a + .05) / (b + .05) };
      });
    } finally { CanvasRenderingContext2D.prototype.fillText = fillText; }
  }, LABELS);
  try {
    const weak = [];
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { __ville.state.settings.theme = theme; __ville.renderAll(); }, theme);
      for (const [name, moment] of Object.entries(SKIES)) {
        await page.evaluate(moment => __ville.ambient.force({ moment, weather: 'sun' }), moment);
        const found = await measure(), where = `thème ${theme === 'light' ? 'clair' : 'sombre'}, ciel ${name}`;
        assert.deepEqual(found.map(label => label.text), LABELS, where + " : les libellés de l'image");
        for (const label of found) if (label.ratio < 4.5) weak.push(`${where} : « ${label.text} » à ${label.ratio.toFixed(2)}:1 (${label.ink} sur rgb(${label.back}))`);
      }
    }
    assert.deepEqual(weak, [], 'libellés à moins de 4,5:1');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Image du récapitulatif : des libellés lisibles sous tous les ciels';
}

// Dans la vue en grand, un pincement ou une molette qui tourne vite change la vue aussitôt, mais la ville n'est dessinée qu'une fois, à
// l'image suivante, quel que soit le nombre d'événements reçus d'ici là (avant : un dessin par événement). Les événements sont synthétiques
// et partent d'un coup, dans la même tâche : aucune image ne passe entre eux.
async function zoomDrawsOncePerFrame(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, town({ esprit: 5 }), null);
  // Joue un geste dans la page, puis rend la vue (zoom, place de la case (3, 3) à l'écran) et le nombre de dessins faits : au départ, juste
  // après les événements, et deux images plus tard.
  const play = gesture => page.evaluate(async gesture => {
    const City = __ville.City, canvas = document.querySelector('#cityBigCanvas'), box = canvas.getBoundingClientRect();
    const x = box.left + box.width / 2, y = box.top + box.height / 2;
    const read = () => ({ zoom: City.bigState().zoom, cell: City.cellPoint(3, 3), draws: City.drawCount() });
    const finger = (type, id, dx) => canvas.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x + dx, clientY: y, bubbles: true }));
    canvas.setPointerCapture = () => {};   // un pointeur synthétique n'est pas « actif » : le navigateur refuserait de le capturer
    if (gesture === 'pinch') { finger('pointerdown', 1, -50); finger('pointerdown', 2, 50); }
    const start = read();
    // Pincement : dix paires de déplacements, deux doigts qui s'écartent de 100 à 160 points (la vue zoome de 1,6).
    if (gesture === 'pinch') for (let step = 1; step <= 10; step++) { finger('pointermove', 1, -50 - 3 * step); finger('pointermove', 2, 50 + 3 * step); }
    // Molette : vingt crans de 15 points (la vue zoome d'environ 1,6).
    else for (let notch = 0; notch < 20; notch++) canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -15, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    const now = read();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const later = read();
    if (gesture === 'pinch') { finger('pointerup', 1, -80); finger('pointerup', 2, 80); }
    return { start, now, later };
  }, gesture);
  // La vue a changé aussitôt (zoom et place de la ville à l'écran, pour que les touchers visent juste), le dessin fait une fois en deux
  // images au plus, et rien n'a été dessiné avant l'image suivante.
  const drawnOnce = (label, run) => {
    assert.ok(run.now.zoom > run.start.zoom, `${label} : la vue ne zoome pas aussitôt (${run.start.zoom} puis ${run.now.zoom})`);
    assert.notDeepEqual(run.now.cell, run.start.cell, `${label} : la ville ne bouge pas aussitôt à l'écran`);
    const draws = run.later.draws - run.start.draws;
    assert.ok(draws >= 1 && draws <= 2, `${label} : ${draws} dessins en deux images (de 1 à 2 attendus)`);
    assert.equal(run.now.draws, run.start.draws, `${label} : ${run.now.draws - run.start.draws} dessins avant l'image suivante`);
  };
  try {
    await page.locator('#cityExpand').click();
    await page.locator('#cityBig').waitFor();
    drawnOnce('pincement', await play('pinch'));
    drawnOnce('molette', await play('wheel'));
    // Les boutons gardent leur zoom en douceur : un dessin aussitôt, qui lance la transition, puis un par image tant qu'elle dure.
    const button = await page.evaluate(async () => {
      const City = __ville.City, before = City.drawCount();
      document.querySelector('#cityBigOut').click();
      const now = City.drawCount() - before;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { now, later: City.drawCount() - before };
    });
    assert.equal(button.now, 1, `bouton Dézoomer : ${button.now} dessins aussitôt au lieu d'un`);
    assert.ok(button.later >= 2, `bouton Dézoomer : ${button.later} dessin en deux images, la transition ne se dessine pas image après image`);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Zoom : un seul dessin par image';
}

// Focus jamais perdu, au clavier (Entrée sur l'élément focalisé) : après chaque action qui redessine l'écran, le focus est sur l'élément
// d'origine, sur son remplaçant (même data-focus-key), sur un voisin après une suppression, ou sur le titre de la vue (la Ville n'en a
// pas : la vue elle-même), jamais sur body. Une visite ouverte par une carte postale rend la main au carnet, sur cette carte. Une fenêtre
// qui s'ouvre ne vole plus le focus d'un champ refusé dans ses 30 premières ms (ce qui faisait échouer la suite sur WebKit), et un rendu
// de l'arrière-plan laisse le focus dans la fenêtre ouverte.
async function focusNeverLost(browser, baseURL) {
  const code = await leaCode(browser, baseURL);
  const bench = { id: 'b', item: 'banc', x: 1, y: 5, at: at('2026-10-01T09:00:00Z'), paid: 2e6 };
  const { context, page, errors } = await cityAt(browser, baseURL, town({ esprit: 5 }, [bench]), NOW);
  // L'élément focalisé : sa clé, sinon son id, sinon sa balise ; BODY quand le focus est perdu.
  const focused = () => page.evaluate(() => {
    const el = document.activeElement;
    return !el || el === document.body ? 'BODY' : el.dataset.focusKey || el.id || el.tagName;
  });
  const enter = async locator => { await locator.focus(); await page.keyboard.press('Enter'); };
  const view = name => enter(page.locator(`[data-tab="${name}"]`));
  // Une fenêtre qui s'ouvre met son titre au focus 30 ms plus tard : on attend ce moment avant d'y aller au clavier.
  const sheetReady = () => page.waitForFunction(() => document.activeElement === document.querySelector('#sheetTitle'));
  // La carte du tirage a fini de tourner.
  const drawn = () => page.waitForFunction(() => !document.querySelector('#drawCard').hasAttribute('aria-busy'));
  const activityIds = () => page.evaluate(() => __ville.state.activities.map(a => a.id));
  const button = (selector, name) => page.locator(selector).getByRole('button', { name, exact: true });
  try {
    // La carte postale de Léa, gardée pendant sa visite.
    await page.evaluate(c => __ville.share.open(c), code);
    await page.locator('#visitKeep').click();
    await page.locator('#cityBigClose').click();
    await page.locator('#cityBig').waitFor({ state: 'hidden' });
    const postcard = await page.evaluate(() => Object.keys(__ville.state.postcards)[0]);
    // Tirage : la carte se redessine après avoir tourné.
    await view('tirage');
    await enter(button('#drawCard', 'Tirer au sort'));
    await drawn();
    assert.equal(await focused(), 'draw:go', '« Tirer au sort »');
    await enter(page.locator('#drawCard').getByRole('button', { name: /^Relancer/ }));
    await drawn();
    assert.equal(await focused(), 'draw:reroll', '« Relancer »');
    // La 2e envie supprimée : le focus va à la suppression de la 3e.
    const wishes = await page.evaluate(() => __ville.state.wishes.map(w => w.id));
    await enter(page.locator('#wishList li').nth(1).getByRole('button', { name: /^Supprimer/ }));
    assert.equal(await focused(), 'task-del:' + wishes[2], 'suppression de la 2e envie');
    // Activités, en mode Modifier : la 2e activité enregistrée.
    await view('activites');
    await enter(page.locator('#editActs'));
    const acts = await activityIds();
    await enter(page.locator('#actsGrid .act').nth(1));
    await sheetReady();
    await enter(page.locator('#sheet button[type="submit"]'));
    assert.equal(await focused(), 'act-edit:' + acts[1], '« Enregistrer » dans « Modifier l’activité »');
    // Journal : l'objectif enregistré.
    await view('journal');
    await enter(button('#goalsCard', 'Modifier'));
    await sheetReady();
    await enter(page.locator('#sheet button[type="submit"]'));
    assert.equal(await focused(), 'goals:edit', '« Enregistrer » de l’objectif');
    // Ville : le compagnon accueilli, l'invitation disparaît.
    await view('ville');
    await enter(button('#companionInvite', 'Faire connaissance'));
    await sheetReady();
    await enter(page.locator('#sheet .companion-go'));
    assert.equal(await focused(), 'companion:open', '« Accueillir » le compagnon');
    // Le banc démoli depuis la liste des constructions : sa ligne disparaît, le focus va à la vue.
    await enter(page.locator('.city-list summary'));
    await enter(page.locator('#cityList').getByRole('button', { name: /^Banc/ }));
    await sheetReady();
    const demolish = button('#sheetBody', 'Démolir');
    await enter(demolish);
    await page.keyboard.press('Enter');   // « Confirmer la démolition », le même bouton
    assert.equal(await page.evaluate(() => __ville.state.city.tiles.length), 0);
    assert.equal(await focused(), 'view-ville', 'banc démoli');
    // Journal : le Carnet fermé par Échap.
    await view('journal');
    await enter(button('#carnetCard', 'Ouvrir le carnet'));
    await sheetReady();
    await page.keyboard.press('Escape');
    assert.equal(await focused(), 'carnet:open', 'Carnet fermé par Échap');
    // Activités : la 2e supprimée, le focus va à la 3e ; la dernière, à l'avant-dernière.
    await view('activites');
    await enter(page.locator('#actsGrid .act-del').nth(1));
    assert.equal(await focused(), 'act-del:' + acts[2], 'suppression de la 2e activité');
    const left = await activityIds();
    await enter(page.locator('#actsGrid .act-del').last());
    assert.equal(await focused(), 'act-del:' + left[left.length - 2], 'suppression de la dernière activité');
    // Journal : le 2e défi changé ; ses boutons « Changer » disparaissent, le focus va au nouveau défi.
    await view('journal');
    await enter(page.locator('#challengesCard .chal-row').nth(1).getByRole('button'));
    assert.equal(await page.evaluate(() => __ville.state.challenges.swapped), 1);
    assert.equal(await focused(), 'chal-swap:1', 'défi changé');
    // Journal › Carnet › Visites › la carte postale : la ville de Léa en grand ; Échap la ferme et rouvre le carnet sur la carte.
    await enter(button('#carnetCard', 'Ouvrir le carnet'));
    await sheetReady();
    await enter(page.locator('#sheetBody').getByRole('radio', { name: 'Visites', exact: true }));
    await enter(page.locator('#sheetBody .carnet-postcard').first());
    await page.locator('#cityBig').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#cityBig').waitFor({ state: 'hidden' });
    await page.waitForTimeout(100);   // le titre du carnet rouvert ne reprend pas le focus 30 ms plus tard
    assert.equal(await focused(), 'postcard:' + postcard, 'visite ouverte par une carte postale, fermée par Échap');
    // Sous les visiteurs et les fêtes, la carte est montrée : le carnet a défilé jusqu'à elle.
    assert.ok(await page.evaluate(() => {
      const r = document.activeElement.getBoundingClientRect(), view = document.querySelector('#sheetBody').getBoundingClientRect();
      return r.top >= view.top && r.bottom <= view.bottom;
    }), 'carte postale hors de vue dans le carnet rouvert');
    assert.deepEqual(await page.evaluate(() => [!document.querySelector('#sheet').hidden, document.querySelector('#sheetTitle').textContent,
      document.querySelector('#sheetBody [role="radio"][aria-checked="true"]').textContent]), [true, 'Carnet', 'Visites']);
    await page.keyboard.press('Escape');
    assert.equal(await focused(), 'carnet:open', 'Carnet rouvert, fermé par Échap');
    // « Mon objectif » s'ouvre et un nombre hors bornes part aussitôt, dans le même tour : le champ refusé garde le focus.
    await page.evaluate(() => {
      const open = document.querySelector('#goalsCard button');
      open.focus();
      open.click();
      document.querySelector('#goalMinutes').value = '2000';
      document.querySelector('#sheet button[type="submit"]').click();
    });
    await page.waitForTimeout(100);
    assert.equal(await focused(), 'goalMinutes', 'champ refusé dans les 30 ms qui suivent l’ouverture');
    // Garde : l'arrière-plan redessiné pendant que la fenêtre est ouverte, le focus reste dans la fenêtre.
    await page.evaluate(() => __ville.renderAll());
    assert.equal(await focused(), 'goalMinutes', 'rendu pendant une fenêtre ouverte');
    await page.keyboard.press('Escape');
    assert.equal(await focused(), 'goals:edit', '« Mon objectif » fermé par Échap');
    // Garde : la page défilée loin du bouton de l'objectif, un rendu de fond (la minute, un autre onglet, une séance ailleurs toutes les
    // 3 s) rend le focus à son remplaçant sans faire défiler la page.
    const away = await page.evaluate(() => {
      const main = document.querySelector('#main'), button = document.activeElement;
      main.scrollTop += button.getBoundingClientRect().bottom - main.getBoundingClientRect().top + 40;
      const r = button.getBoundingClientRect(), view = main.getBoundingClientRect();
      return { top: main.scrollTop, hidden: r.bottom <= view.top || r.top >= view.bottom };
    });
    assert.ok(away.top > 0 && away.hidden, 'bouton de l’objectif encore visible : ' + JSON.stringify(away));
    await page.evaluate(() => __ville.renderAll());
    assert.deepEqual([await page.evaluate(() => document.querySelector('#main').scrollTop), await focused()], [away.top, 'goals:edit'],
      'rendu de fond, la page défilée loin du focus');
    // Garde : quand rien n'a le focus, un rendu de fond (la minute, un autre onglet) ne le prend pas.
    await page.evaluate(() => { document.activeElement.blur(); __ville.renderAll(); });
    assert.equal(await focused(), 'BODY', 'rendu quand rien n’a le focus');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Focus : jamais perdu, au clavier';
}

// La Ville se redessine aussi en partie, hors de renderAll : au retour dans l'onglet, après l'écriture d'un autre onglet, au battement d'une
// séance menée ailleurs (toutes les 2 s), et quand on remet à plus tard le rappel de sauvegarde. La carte de l'objectif (« Choisir »), la liste
// des constructions, la carte du souhait et le rappel sont refaits : le focus restait sur body, pour de bon. Il revient au remplaçant de même
// clé, sinon à la vue. Une deuxième page du même navigateur joue l'autre onglet. La maison reçoit un souhait, et trois séances amènent le rappel.
async function villeFocusKeptOnPartialRenders(browser, baseURL) {
  const house = { id: 'm', item: 'maison', x: 3, y: 3, at: at('2026-10-01T09:00:00Z'), paid: 1e6 };
  const seed = town({ esprit: 30 }, [house], { createdAt: at('2026-05-04T09:00:00Z'), stats: { ok: 3, byCat: { esprit: 30 }, days: { '2026-10-16': 30 } },
    achievements: { ...FIRST_STEP, 'premiere-pierre': at('2026-10-01T09:00:00Z') } });
  const { context, page, errors } = await cityAt(browser, baseURL, seed, NOW);
  const other = await context.newPage();
  // La clé de l'élément focalisé, sinon son id ; BODY quand le focus est perdu.
  const holder = () => page.evaluate(() => {
    const el = document.activeElement;
    return !el || el === document.body ? 'BODY' : el.dataset.focusKey || el.id || el.tagName;
  });
  // Le focus posé sur l'élément de cette clé, puis un rendu partiel : il y est encore (ou sur son remplaçant).
  const keeps = async (key, render, label) => {
    await page.locator(`[data-focus-key="${key}"]`).first().focus();
    assert.equal(await holder(), key, label + ' : le focus n’a pas pu être posé');
    await render();
    await page.waitForTimeout(300);
    assert.equal(await holder(), key, label);
  };
  // Le battement d'une séance menée dans l'autre onglet.
  const beat = () => other.evaluate(() => localStorage.setItem('ville-bien-etre/v2:beat', JSON.stringify({ id: 'ailleurs', tab: 'autre', at: Date.now() })));
  try {
    await other.goto(baseURL);
    await other.waitForFunction(() => !!window.__ville);
    await page.waitForTimeout(300);   // ce que l'autre onglet écrit à son ouverture est passé ici
    // Retour dans l'onglet : la page passe en arrière-plan, puis revient.
    await keeps('goals:edit', async () => { await setVisibility(page, 'hidden'); await setVisibility(page, 'visible'); }, 'retour dans l’onglet');
    // Une envie ajoutée dans l'autre onglet.
    await keeps('goals:edit', async () => {
      await other.locator('[data-tab="tirage"]').click();
      await other.locator('#addWish [name="name"]').fill('Faire du pain');
      await other.locator('#addWish [name="name"]').press('Enter');
      await page.waitForFunction(() => __ville.state.wishes.some(entry => entry.name === 'Faire du pain'));
    }, 'envie ajoutée dans un autre onglet');
    await keeps('goals:edit', beat, 'battement d’une séance ailleurs');
    // La liste des constructions, la carte du souhait et le rappel de sauvegarde, refaits au battement.
    await page.locator('.city-list summary').click();
    await keeps('tile:m', beat, 'liste des constructions');
    await keeps('wish:skip', beat, 'carte du souhait');
    await keeps('backup:later', beat, 'rappel de sauvegarde');
    // « Plus tard » : le rappel disparaît, le focus va à la vue.
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#remind').isHidden(), true, 'rappel encore affiché après « Plus tard »');
    assert.equal(await holder(), 'view-ville', '« Plus tard » du rappel de sauvegarde');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Focus : gardé quand la Ville se redessine en partie';
}

// Après une suppression, « Annuler » reste jusqu'à l'action suivante (un autre message, un autre onglet, une fenêtre qui s'ouvre, une séance
// qui démarre), et l'annonce dit qu'on peut annuler. L'horloge de la page est simulée (sessionTown) : fastForward saute 10 s d'un coup, bien
// au-delà des 6 s d'autrefois. Une routine de deux activités qu'on ne supprime pas donne un « Lancer » qui démarre une séance sans passer par
// un onglet ni par une fenêtre.
async function undoLastsUntilNextAction(browser, baseURL) {
  const { context, page, errors } = await sessionTown(browser);
  await page.addInitScript(() => {
    const key = 'ville-bien-etre/v2', saved = JSON.parse(localStorage.getItem(key));
    saved.routines = [{ id: 'r1', name: 'Matin', activityIds: ['a-esprit', 'a-corps'] }];
    localStorage.setItem(key, JSON.stringify(saved));
  });
  const message = page.locator('#toast'), live = page.locator('#live');
  const ids = () => page.evaluate(() => __ville.state.activities.map(a => a.id));
  const remove = name => page.getByRole('button', { name: 'Supprimer ' + name, exact: true }).click();
  try {
    await page.goto(baseURL);
    await page.waitForFunction(() => !!window.__ville);
    await page.locator('[data-tab="activites"]').click();
    await page.locator('#editActs').click();
    const all = await ids();
    // Supprimée, puis 10 s plus tard : le message est encore là, et l'annonce dit qu'on peut annuler.
    await remove('Pratique crea');
    await page.clock.fastForward(10000);
    assert.equal(await message.isVisible(), true, 'suppression : le message est caché après 10 s');
    assert.match(await live.textContent(), /Tu peux annuler avec le bouton Annuler, en bas de l.écran/);
    // « Annuler » : l'activité revient, à sa place.
    await message.getByRole('button', { name: 'Annuler', exact: true }).click();
    assert.deepEqual(await ids(), all, 'activité non revenue à sa place');
    assert.equal(await message.isHidden(), true, 'message encore là après « Annuler »');
    // Supprimée de nouveau, puis un autre onglet : le message se ferme.
    await remove('Pratique crea');
    assert.equal(await message.isVisible(), true, 'deuxième suppression : pas de message');
    await page.locator('[data-tab="journal"]').click();
    assert.equal(await message.isHidden(), true, 'message encore là après un changement d’onglet');
    // Une fenêtre qui s'ouvre le ferme aussi.
    await page.locator('[data-tab="activites"]').click();
    await remove('Pratique foyer');
    assert.equal(await message.isVisible(), true, 'troisième suppression : pas de message');
    await page.locator('#settingsBtn').click();
    assert.equal(await message.isHidden(), true, 'message encore là après l’ouverture d’une fenêtre');
    await page.locator('#sheetClose').click();
    // Un autre message le remplace ; court, il se ferme seul : rien ne reste « gardé » de la suppression. Un onglet ou une fenêtre qui s'ouvre
    // ne ferme que le message gardé : celui-ci garde son minuteur (comme la fiche du visiteur qui se rouvre juste après « Un nouveau jour commence »).
    await remove('Pratique calme');
    await page.locator('#actName').fill('Lecture');
    await page.locator('#actName').press('Enter');
    await page.waitForFunction(() => /Activité ajoutée/.test(document.querySelector('#toast').textContent));
    assert.equal(await message.getByRole('button').count(), 0, 'le message court garde le bouton de la suppression');
    await page.evaluate(() => { document.querySelector('[data-tab="journal"]').click(); document.querySelector('#settingsBtn').click(); });
    assert.equal(await message.isVisible(), true, 'message court fermé par un onglet ou une fenêtre qui s’ouvre');
    await page.locator('#sheetClose').click();
    await page.clock.fastForward(3000);
    assert.equal(await message.isHidden(), true, 'message court encore là après 3 s');
    await page.locator('[data-tab="activites"]').click();
    // Une séance qui démarre (« Lancer » de la routine, au clavier) : le message ne reste pas sur son écran.
    await remove('Lecture');
    assert.equal(await message.isVisible(), true, 'quatrième suppression : pas de message');
    await page.locator('#routinesCard').getByRole('button', { name: 'Lancer', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.locator('#session').waitFor();
    assert.equal(await message.isHidden(), true, 'message resté sur l’écran de séance');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  // En anglais, la même annonce.
  {
    const en = await sessionTown(browser, { lang: 'en' });
    try {
      await en.page.goto(baseURL);
      await en.page.waitForFunction(() => !!window.__ville);
      await en.page.locator('[data-tab="activites"]').click();
      await en.page.locator('#editActs').click();
      await en.page.getByRole('button', { name: 'Delete Pratique crea', exact: true }).click();
      await en.page.clock.fastForward(10000);
      assert.equal(await en.page.locator('#toast').isVisible(), true, 'en anglais : le message est caché après 10 s');
      assert.match(await en.page.locator('#live').textContent(), /You can undo it with the Undo button at the bottom of the screen\./);
      assert.deepEqual(en.errors, []);
    } finally { await en.context.close(); }
  }
  return "Annuler : le temps qu'il faut";
}

// « Annuler » parle de la ville d'où l'élément a été supprimé. Une autre ville adoptée entre-temps (« Tout recommencer » dans un autre onglet,
// ici une deuxième page du même navigateur) ferme le message, et son bouton, même touché quand même, ne ramène rien de l'ancienne ville dans
// la nouvelle.
async function undoStaysInItsCity(browser, baseURL) {
  const activities = ['esprit', 'corps', 'crea'].map(cat => ({ id: 'a-' + cat, name: 'Pratique ' + cat, cat, min: 5, mode: 'free' }));
  const { context, page, errors } = await cityAt(browser, baseURL, town({ esprit: 5 }, [], { createdAt: at('2026-05-04T09:00:00Z'), activities, achievements: FIRST_STEP }), NOW);
  const other = await context.newPage();
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('ville-bien-etre/v2')));
  try {
    await page.locator('[data-tab="activites"]').click();
    await page.locator('#editActs').click();
    await page.getByRole('button', { name: 'Supprimer Pratique crea', exact: true }).click();
    assert.equal(await page.locator('#toast').isVisible(), true, 'pas de message après la suppression');
    // « Tout recommencer » dans l'autre onglet : une ville neuve, née à une autre date.
    await other.goto(baseURL);
    await other.waitForFunction(() => !!window.__ville);
    await other.locator('#settingsBtn').click();
    await other.getByRole('button', { name: 'Tout recommencer', exact: true }).click();
    await other.getByRole('button', { name: 'Confirmer : tout effacer', exact: true }).click();
    const fresh = await other.evaluate(() => __ville.state.createdAt);
    await page.waitForFunction(createdAt => __ville.state.createdAt === createdAt, fresh);
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#toast').isHidden(), true, 'le message « Annuler » de l’ancienne ville reste affiché');
    // Le bouton du message caché, touché tout de même : rien ne revient.
    const before = await stored();
    await page.evaluate(() => document.querySelector('#toast .toast-btn').click());
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => __ville.state.activities.some(entry => entry.id === 'a-crea')), false, 'l’activité de l’ancienne ville est revenue');
    const after = await stored();
    assert.equal(after.createdAt, fresh);
    assert.equal(after.activities.some(entry => entry.id === 'a-crea'), false, 'l’activité de l’ancienne ville est enregistrée dans la nouvelle');
    assert.equal(after.revision, before.revision, 'quelque chose a été enregistré');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Annuler : rien ne revient dans une autre ville';
}

// Un message avec bouton (ici « Ouvrir le carnet », au démarrage d'une ville d'avant la mise à jour) garde ses 6 s, mais ni la souris ni le
// focus ne le ferment : tant que l'un des deux y est, rien ne le ferme, et il repart pour 6 s quand ils l'ont quitté.
async function toastHeldByMouseAndFocus(browser, baseURL) {
  const open = async () => {
    const opened = await sessionTown(browser);
    await opened.page.goto(baseURL);
    await opened.page.waitForFunction(() => !!window.__ville);
    await opened.page.locator('#toast .toast-btn').waitFor();
    return opened;
  };
  // Le message est-il encore là après ces ms, sautées d'un coup ?
  const stillShown = async (page, ms) => { await page.clock.fastForward(ms); return page.locator('#toast').isVisible(); };
  // La souris seule : sur le message 10 s, puis ailleurs.
  {
    const { context, page, errors } = await open();
    try {
      await page.locator('#toast').hover();
      assert.equal(await stillShown(page, 10000), true, 'souris sur le message : fermé après 10 s');
      await page.mouse.move(0, 0);
      assert.equal(await stillShown(page, 3000), true, 'souris partie : fermé avant 6 s');
      assert.equal(await stillShown(page, 4000), false, 'souris partie : encore là après 7 s');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  // Le focus sur le bouton : la souris passe et repart, le focus le retient encore ; il part, et les 6 s repartent.
  {
    const { context, page, errors } = await open();
    try {
      const button = page.locator('#toast .toast-btn');
      await button.focus();
      assert.equal(await stillShown(page, 10000), true, 'focus sur le bouton : fermé après 10 s');
      await page.locator('#toast').hover();
      await page.mouse.move(0, 0);
      assert.equal(await stillShown(page, 10000), true, 'souris partie, focus resté : fermé');
      await button.blur();
      assert.equal(await stillShown(page, 3000), true, 'focus parti : fermé avant 6 s');
      assert.equal(await stillShown(page, 4000), false, 'focus parti : encore là après 7 s');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return 'Message avec bouton : ni la souris ni le focus ne le ferment';
}

// Le message gardé (« Annuler » après une suppression) est fixe au-dessus de la barre des onglets, et à 320 px il fait deux rangées (le texte,
// puis le bouton). La page ne lui laissait aucune place : le voisin qui prend le focus après une suppression, la fin de la liste et les champs
// du formulaire passaient dessous, et le défilement ne les en sortait pas. Après une suppression au clavier : le voisin n'est pas recouvert, la
// fin de la page défile au-dessus du message, et Tab, arrêt après arrêt, n'amène rien dessous jusqu'au bouton « Annuler » (dans WebKit sur Mac,
// Tab ne s'arrête pas aux boutons : ses arrêts sont les champs et le résumé du formulaire, et il sort de la page après eux). Un nom de 40 lettres
// sans espace donne le message le plus haut : il reste dans sa pilule, et la place laissée suit sa hauteur.
async function keptMessageCoversNothing(browser, baseURL) {
  const long = 'Abcdefghijklmnopqrstuvwxyz0123456789ABCD';
  const webkit = browser.browserType().name() === 'webkit';
  for (const [lang, remove] of [['fr', 'Supprimer '], ['en', 'Delete ']]) {
    const { context, page, errors } = await sessionTown(browser, { lang });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addInitScript(name => {
      const key = 'ville-bien-etre/v2', saved = JSON.parse(localStorage.getItem(key));
      saved.activities.push({ id: 'a-long', name, cat: 'crea', min: 5, mode: 'free' });
      localStorage.setItem(key, JSON.stringify(saved));
    }, long);
    // Le message est posé : son entrée (un déplacement de 12 px) est finie, on mesure sa vraie place.
    const settled = () => page.waitForFunction(() => document.querySelector('#toast').getAnimations().length === 0);
    const focusKey = () => page.evaluate(() => document.activeElement.dataset.focusKey || document.activeElement.id || document.activeElement.tagName);
    // Part de la surface de l'élément qui a le focus que le message recouvre, de 0 à 1 : ce qu'on en voit, dans la zone qui défile s'il en fait partie
    // (WebKit ne fait pas défiler le focus d'un champ de saisie : hors de la zone, il n'est pas sous le message, il est ailleurs).
    const covered = () => page.evaluate(() => {
      const message = document.querySelector('#toast').getBoundingClientRect(), el = document.activeElement, box = el.getBoundingClientRect();
      const view = document.querySelector('#main').contains(el) ? document.querySelector('#main').getBoundingClientRect() : { left: -1e9, right: 1e9, top: -1e9, bottom: 1e9 };
      const seen = { left: Math.max(box.left, view.left), right: Math.min(box.right, view.right), top: Math.max(box.top, view.top), bottom: Math.min(box.bottom, view.bottom) };
      const across = Math.min(seen.right, message.right) - Math.max(seen.left, message.left), down = Math.min(seen.bottom, message.bottom) - Math.max(seen.top, message.top);
      return Math.max(0, across) * Math.max(0, down) / (box.width * box.height);
    });
    // Le bas de la dernière carte de l'onglet (les routines), la page défilée jusqu'au bout, et le haut du message.
    const endOfPage = () => page.evaluate(() => {
      const main = document.querySelector('#main');
      main.scrollTop = main.scrollHeight;
      return { card: document.querySelector('#routinesCard').getBoundingClientRect().bottom, message: document.querySelector('#toast').getBoundingClientRect().top };
    });
    // La place mesurée par l'appli (--toast-room) contre la vraie : du haut du message à la barre des onglets, où #main finirait sans lui.
    const room = () => page.evaluate(() => ({ measured: parseFloat(document.body.style.getPropertyValue('--toast-room')),
      actual: document.querySelector('.tabbar').getBoundingClientRect().top - document.querySelector('#toast').getBoundingClientRect().top }));
    const roomRight = async label => { const found = await room(); assert.ok(Math.abs(found.measured - found.actual) <= 1, `${lang} : ${label} : la place mesurée est ${found.measured} px, la vraie ${found.actual} px`); };
    // Le remplissage et le scroll-padding du bas de #main, en px (« auto » : aucun), et la classe que le message gardé pose sur body.
    const padding = () => page.evaluate(() => { const style = getComputedStyle(document.querySelector('#main')); return [parseFloat(style.paddingBottom), parseFloat(style.scrollPaddingBottom) || 0, document.body.classList.contains('toast-kept')]; });
    // Où est le focus : son nom, si c'est le bouton du message, et si la page n'a plus le focus (Tab est sorti de ses arrêts).
    const where = () => page.evaluate(() => ({ name: document.activeElement.dataset.focusKey || document.activeElement.id || document.activeElement.tagName,
      undo: document.activeElement.classList.contains('toast-btn'), out: document.activeElement === document.body }));
    try {
      await page.goto(baseURL);
      await page.waitForFunction(() => !!window.__ville);
      await page.locator('[data-tab="activites"]').click();
      await page.locator('#editActs').click();
      const [bottom] = await padding();
      // La 3e activité supprimée au clavier : le focus va à la suppression de la suivante, sous le message si la page ne lui fait pas de place.
      await page.getByRole('button', { name: remove + 'Pratique calme', exact: true }).focus();
      await page.keyboard.press('Enter');
      await settled();
      assert.equal(await focusKey(), 'act-del:a-foyer', lang + ' : le focus ne va pas au voisin');
      const near = await covered();
      assert.equal(near, 0, `${lang} : le message recouvre ${Math.round(near * 100)} % du voisin qui a le focus`);
      await roomRight('message de deux rangées');
      // Tant que le message est là, #main a un remplissage et un scroll-padding en bas d'au moins sa place.
      const [kept, scrolled, flagged] = await padding(), taken = (await room()).actual;
      assert.ok(flagged && kept >= taken && scrolled >= taken, `${lang} : remplissage ${kept} px et scroll-padding ${scrolled} px pour un message de ${taken} px (classe : ${flagged})`);
      // Tab, arrêt après arrêt, jusqu'au bouton du message (le dernier arrêt de la page) ou jusqu'à la sortie de la page : aucun n'est sous lui.
      const under = [];
      let stops = 0, reached = false;
      for (let press = 0; press < 40; press++) {
        await page.keyboard.press('Tab');
        const now = await where();
        if (now.out) break;
        if (now.undo) { reached = true; break; }
        stops++;
        const share = await covered();
        if (share > 0) under.push(`${now.name} ${Math.round(share * 100)} %`);
      }
      assert.ok(stops >= (webkit ? 4 : 12), `${lang} : ${stops} arrêts de Tab seulement, le parcours est trop court`);
      assert.ok(webkit || reached, lang + " : Tab n'atteint pas le bouton du message");
      assert.deepEqual(under, [], `${lang} : des arrêts de Tab sous le message`);
      // La fin de la page défile au-dessus du message.
      const end = await endOfPage();
      assert.ok(end.card <= end.message, `${lang} : la dernière carte descend de ${Math.round(end.card - end.message)} px sous le message, la page défilée jusqu'au bout`);
      // Le plus long nom : le message, plus haut, reste dans sa pilule, et le voisin de la dernière activité n'est pas recouvert non plus.
      await page.getByRole('button', { name: remove + long, exact: true }).focus();
      await page.keyboard.press('Enter');
      await settled();
      const pill = await page.evaluate(() => {
        const message = document.querySelector('#toast'), box = message.getBoundingClientRect(), text = message.querySelector('span').getBoundingClientRect();
        return { spill: message.scrollWidth - message.clientWidth, left: text.left - box.left, right: box.right - text.right, height: box.height };
      });
      assert.ok(pill.spill <= 0 && pill.left >= 0 && pill.right >= 0, `${lang} : le nom de 40 lettres sort de la pilule (${JSON.stringify(pill)})`);
      await roomRight('message de 40 lettres');
      assert.equal(await focusKey(), 'act-del:a-crea', lang + ' : le focus ne va pas au voisin de la dernière activité');
      const tall = await covered();
      assert.equal(tall, 0, `${lang} : le message de 40 lettres recouvre ${Math.round(tall * 100)} % du voisin qui a le focus`);
      const far = await endOfPage();
      assert.ok(far.card <= far.message, `${lang} : le message de 40 lettres : la dernière carte descend de ${Math.round(far.card - far.message)} px dessous`);
      // Le message se replie autrement quand l'écran change de largeur, et la place suit : posé à 390 px (une rangée), il fait deux rangées à 320 px.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: remove + 'Pratique crea', exact: true }).focus();
      await page.keyboard.press('Enter');
      await settled();
      await page.setViewportSize({ width: 320, height: 568 });
      await page.waitForTimeout(100);
      const narrow = await endOfPage();
      assert.ok(narrow.card <= narrow.message, `${lang} : le message replié sur deux rangées : la dernière carte descend de ${Math.round(narrow.card - narrow.message)} px dessous`);
      await roomRight('message replié par le redimensionnement');
      // Le message parti (« Annuler »), ou remplacé par un message court, #main a retrouvé son remplissage, sans scroll-padding.
      await page.locator('#toast').getByRole('button').click();
      assert.deepEqual(await padding(), [bottom, 0, false], lang + ' : #main garde la place du message après « Annuler »');
      await page.getByRole('button', { name: remove + 'Pratique foyer', exact: true }).focus();
      await page.keyboard.press('Enter');
      await page.locator('#actName').fill('Lecture');
      await page.locator('#actName').press('Enter');
      assert.deepEqual(await padding(), [bottom, 0, false], lang + ' : #main garde la place du message quand un message court le remplace');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return 'Annuler : le message ne cache pas ce qui a le focus, même à 320 px';
}

// À 320 px, un nom long ne se coupe plus au milieu des mots, sur cinq à sept lignes, dans les 51 px laissés par un solde de 1,2 Md et 40 jours
// de série : les pastilles, groupées avec les Réglages, passent sous le nom. Un nom court reste, lui, sur la ligne des pastilles tant qu'il y
// tient (à 390 px) : seul un nom qui manque de place les fait passer dessous. Une ville de 40 jours de série finit hier (le 20 octobre).
async function headerFitsAt320(browser, baseURL) {
  const days = {};
  for (let back = 1; back <= 40; back++) days[new Date(at(NOW) - back * 864e5).toISOString().slice(0, 10)] = 10;
  for (const [lang, name, coins, series] of [['fr', 'Les Jardins de Montreux', '1,2' + NBSP + 'Md', '40' + NBSP + 'j'], ['en', 'Riverside Gardens Town', '1.2' + NBSP + 'B', '40' + NBSP + 'd']]) {
    const seed = town({ calme: 400 }, [], { coins: 1.2e9, personal: { name }, settings: { lang }, stats: { ok: 40, byCat: { calme: 400 }, days } });
    const { context, page, errors } = await cityAt(browser, baseURL, seed, NOW, { viewport: { width: 320, height: 568 } });
    try {
      // La largeur d'un « 0 » (l'unité ch) vient de la police : on mesure une fois qu'elle est chargée.
      await page.evaluate(async () => { await document.fonts.load('20px "Young Serif"', 'Les Jardins'); await document.fonts.ready; });
      assert.equal(await page.locator('.brand-name').innerText(), name);
      assert.equal(await page.locator('#balance').innerText(), coins);
      assert.equal(await page.locator('#streak').innerText(), series);
      const header = await page.evaluate(() => {
        const title = document.querySelector('.brand-name'), box = title.getBoundingClientRect(), text = title.firstChild, broken = [];
        // Un mot coupé occupe deux lignes : ses rectangles n'ont pas tous le même haut.
        for (let found, words = /\S+/g; (found = words.exec(text.textContent));) {
          const range = document.createRange();
          range.setStart(text, found.index);
          range.setEnd(text, found.index + found[0].length);
          if (new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size > 1) broken.push(found[0]);
        }
        const place = selector => { const rect = document.querySelector(selector).getBoundingClientRect(); return { left: rect.left, right: rect.right, middle: (rect.top + rect.bottom) / 2 }; };
        return { width: box.width, height: box.height, line: parseFloat(getComputedStyle(title).lineHeight), broken, scroll: document.documentElement.scrollWidth,
          screen: window.innerWidth, balance: place('#balanceChip'), streak: place('#streakChip'), settings: place('#settingsBtn') };
      });
      const label = `${lang} « ${name} »`;
      assert.ok(header.width >= 150, `${label} : le nom mesure ${Math.round(header.width)} px de large (150 px au moins attendus)`);
      assert.ok(header.line > 0 && header.height <= 2 * header.line, `${label} : le nom mesure ${Math.round(header.height)} px de haut, sur des lignes de ${header.line} px (2 lignes au plus)`);
      assert.deepEqual(header.broken, [], `${label} : des mots coupés au milieu`);
      assert.ok(header.scroll <= header.screen, `${label} : la page déborde (${header.scroll} px sur ${header.screen} px)`);
      // Les pastilles et les Réglages restent ensemble : sur une même ligne, de gauche à droite, dans l'écran.
      const { balance: chipCoins, streak: chipSeries, settings: gear } = header;
      assert.ok(Math.abs(chipCoins.middle - chipSeries.middle) <= 1 && Math.abs(chipSeries.middle - gear.middle) <= 1, `${label} : les pastilles et les Réglages ne sont pas sur une même ligne`);
      assert.ok(chipCoins.left >= 0 && chipCoins.right <= chipSeries.left && chipSeries.right <= gear.left && gear.right <= header.screen, `${label} : les pastilles et les Réglages sortent de l'écran ou se recouvrent`);
      // Un nom court (celui d'une ville neuve) et les mêmes pastilles : une seule ligne à 390 px.
      await page.setViewportSize({ width: 390, height: 844 });
      const short = lang === 'fr' ? 'Ma ville' : 'My town';
      await page.evaluate(text => { document.querySelector('.brand-name').textContent = text; }, short);
      const [titleMiddle, chipMiddle] = await page.evaluate(() => ['.brand-name', '#balanceChip'].map(selector => { const rect = document.querySelector(selector).getBoundingClientRect(); return (rect.top + rect.bottom) / 2; }));
      assert.ok(Math.abs(titleMiddle - chipMiddle) <= 1, `${lang} « ${short} » à 390 px : le nom passe seul sur sa ligne alors qu'il tient à côté des pastilles`);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return 'En-tête : un nom long tient à 320 px';
}

// Le contour de focus d'une puce de la barre des rubriques de la boutique est dessiné à 4 px de la puce (2 px de décalage, 2 px de trait). La
// barre défile : c'est un conteneur qui coupe ce qui dépasse, et 2 px de marge intérieure en coupaient le haut et le bas de chaque puce, et le
// côté de la première et de la dernière. On met le focus sur chaque puce, de la première à la dernière, après une touche : le contour ne se
// dessine qu'au clavier. (Tab n'atteint pas les boutons dans WebKit sur Mac ; « focus » après une touche donne le même contour partout.)
// Une puce à moitié visible au bord n'est pas ramenée par le focus (les navigateurs s'en passent dès que 32 px en sont visibles) : on ne
// regarde pas ses côtés, seulement ceux de la première puce (barre au début) et de la dernière (barre au bout).
async function shopFocusRingWhole(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, town({ esprit: 5 }), NOW);
  try {
    await page.locator('#buildBtn').click();
    await page.waitForFunction(() => document.activeElement === document.querySelector('#sheetTitle'));
    const chips = page.locator('.shop-nav .chip'), count = await chips.count();
    assert.ok(count >= 6, 'rubriques de la boutique : ' + count);
    assert.equal(await page.locator('.shop-nav').evaluate(bar => bar.scrollWidth > bar.clientWidth), true, 'la barre des rubriques ne défile pas : le test ne parcourrait rien');
    await page.keyboard.press('Tab');
    for (let index = 0; index < count; index++) {
      await chips.nth(index).focus();
      const ring = await page.evaluate(() => {
        const chip = document.activeElement, bar = chip.closest('.shop-nav').getBoundingClientRect(), box = chip.getBoundingClientRect(), style = getComputedStyle(chip);
        const out = parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth);
        return { name: chip.textContent, drawn: style.outlineStyle !== 'none', out, top: box.top - out - bar.top, bottom: bar.bottom - (box.bottom + out), left: box.left - out - bar.left, right: bar.right - (box.right + out) };
      });
      const name = ring.name;
      assert.deepEqual([ring.drawn, ring.out], [true, 4], `« ${name} » : le contour de focus n'est pas dessiné à 4 px de la puce`);
      // Ce qui reste dans la barre, au dixième de pixel près (le défilement n'est pas entier).
      const sides = [['top', 'en haut'], ['bottom', 'en bas'], ...(index === 0 ? [['left', 'à gauche']] : []), ...(index === count - 1 ? [['right', 'à droite']] : [])];
      for (const [side, where] of sides) assert.ok(ring[side] >= -0.1, `« ${name} » (puce ${index + 1} sur ${count}) : le contour de focus est coupé ${where} (${ring[side].toFixed(1)} px)`);
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Boutique : contour de focus entier';
}

// Les petites annonces : ce qu'un lecteur d'écran lit ou annonce, et le message d'un nom fait seulement d'espaces.
// Une série de 7 jours finie hier : des séances du 14 au 20 octobre, la page ouverte le 21 (NOW).
const dayBefore = back => new Date(at(NOW) - back * 864e5).toISOString().slice(0, 10);
const weekStreak = (extra = {}) => {
  const days = {};
  for (let back = 1; back <= 7; back++) days[dayBefore(back)] = 10;
  return town({ calme: 70 }, [], { stats: { ok: 7, byCat: { calme: 70 }, days }, ...extra });
};
// Le seul succès que mérite une ville de ces tests (une séance réussie), déjà noté : le démarrage ne le rattrape pas, et le message « Ta ville a
// déjà 1 succès » ne reste pas 6 s au bas de l'écran, par-dessus les boutons des fenêtres que le test touche.
const FIRST_STEP = { 'premier-pas': at('2026-10-16T09:00:00Z') };
// Le texte que lit un lecteur d'écran dans la pastille de série : la pastille sans ses nœuds aria-hidden, l'espace insécable remplacée par
// une espace.
const streakReading = async page => (await page.evaluate(() => {
  const copy = document.querySelector('#streakChip').cloneNode(true);
  for (const node of copy.querySelectorAll('[aria-hidden="true"]')) node.remove();
  return copy.textContent.trim();
})).replaceAll(NBSP, ' ');

// La pastille de série affiche « 7 j » ; un lecteur d'écran en lit une phrase entière, « 7 jours de série » : le texte affiché lui est caché
// (aria-hidden) et un texte réservé aux lecteurs d'écran le remplace, au singulier pour un seul jour et à jour à chaque rendu.
async function streakReadInFull(browser, baseURL) {
  for (const [lang, shown, seven, one] of [['fr', '7' + NBSP + 'j', '7 jours de série', '1 jour de série'], ['en', '7' + NBSP + 'd', '7-day streak', '1-day streak']]) {
    const { context, page, errors } = await cityAt(browser, baseURL, weekStreak({ settings: { lang } }), NOW);
    try {
      assert.equal(await page.locator('#streak').innerText(), shown, lang + ' : le texte affiché de la pastille a changé');
      assert.equal(await streakReading(page), seven, lang + ' : texte lu de la pastille pour une série de 7 jours');
      await page.evaluate(day => { __ville.state.stats.days = { [day]: 10 }; __ville.renderAll(); }, dayBefore(1));
      assert.equal(await streakReading(page), one, lang + ' : texte lu de la pastille pour une série d’un jour');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return 'Série : la pastille est lue en entier';
}

// Ajouter une étape dans l'éditeur de routine ne disait rien : la liste change sous le bouton « Ajouter », qui garde le focus. Chaque étape
// ajoutée est annoncée avec son numéro et son nom, tel qu'il s'affiche (l'exemple « Lecture » devient « Reading » en anglais).
async function routineStepAnnounced(browser, baseURL) {
  const activities = [['esprit', 'Pratique esprit'], ['corps', 'Pratique corps'], ['lecture', 'Lecture'], ['foyer', 'Pratique foyer']]
    .map(([id, name]) => ({ id: 'a-' + id, name, cat: id === 'lecture' ? 'esprit' : id, min: 5, mode: 'free' }));
  const routines = [{ id: 'r1', name: 'Matin', activityIds: ['a-esprit', 'a-corps'] }];
  for (const [lang, manage, edit, add, third, fourth] of [
    ['fr', 'Gérer', 'Modifier', 'Ajouter', /^Étape 3 ajoutée\s:\sLecture\.$/, /^Étape 4 ajoutée\s:\sPratique foyer\.$/],
    ['en', 'Manage', 'Edit', 'Add', /^Step 3 added: Reading\.$/, /^Step 4 added: Pratique foyer\.$/]]) {
    const { context, page, errors } = await cityAt(browser, baseURL, town({ esprit: 5 }, [], { settings: { lang }, activities, routines, achievements: FIRST_STEP }), NOW);
    // L'annonce arrive un instant après le geste (announce la diffère de 40 ms).
    const announced = async (pattern, label) => {
      try { await page.waitForFunction(source => new RegExp(source).test(document.querySelector('#live').textContent), pattern.source, { timeout: 5000 }); }
      catch (error) { assert.fail(`${lang} : ${label} n'est pas annoncée (la zone d'annonce dit « ${await page.locator('#live').textContent()} »)`); }
    };
    try {
      await page.locator('[data-tab="activites"]').click();
      await page.locator('#routinesCard').getByRole('button', { name: manage, exact: true }).click();
      await sheet(page).getByRole('button', { name: edit, exact: true }).click();
      await page.locator('#routineActivity').selectOption('a-lecture');
      await sheet(page).getByRole('button', { name: add, exact: true }).click();
      await announced(third, 'la 3e étape');
      await page.locator('#routineActivity').selectOption('a-foyer');
      await sheet(page).getByRole('button', { name: add, exact: true }).click();
      await announced(fourth, 'la 4e étape');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return 'Routine : chaque étape ajoutée est annoncée';
}

// La carte « Défis de la semaine » est construite une fois, au premier passage dans le Journal : son nom pour les lecteurs d'écran (c'est une
// région) restait dans la langue d'avant un changement de langue, alors que son titre suivait. Elle prend maintenant le nom de son titre.
async function challengesNameFollowsLanguage(browser, baseURL) {
  const { context, page, errors } = await cityAt(browser, baseURL, weekStreak(), NOW);
  const region = name => page.getByRole('region', { name, exact: true });
  try {
    await page.locator('[data-tab="journal"]').click();
    assert.equal(await region('Défis de la semaine').count(), 1, 'région des défis, en français');
    await page.locator('#settingsBtn').click();
    await page.locator('#settingsLang').getByRole('radio', { name: 'English', exact: true }).click();
    await page.locator('#sheetClose').click();
    assert.equal(await region('Weekly challenges').count(), 1, 'région des défis, après le passage en anglais');
    assert.equal(await region('Défis de la semaine').count(), 0, 'région des défis encore en français après le passage en anglais');
    // La pastille de série, redessinée avec l'en-tête, change de langue aussi.
    assert.equal(await streakReading(page), '7-day streak', 'pastille de série, après le passage en anglais');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Défis : le nom de la carte suit la langue';
}

// Un nom fait seulement d'espaces passe la validation du navigateur (le champ n'est pas vide) : le formulaire ne disait rien. Il vide maintenant
// le champ et affiche « Ce champ est à remplir. » dessous, comme pour un champ laissé vide ; rien n'est ajouté ni changé. Envie, obligation,
// activité (ajout et modification), routine et ville ; un vrai nom passe toujours.
async function blankNamesReported(browser, baseURL) {
  const activities = ['esprit', 'corps'].map(cat => ({ id: 'a-' + cat, name: 'Pratique ' + cat, cat, min: 5, mode: 'free' }));
  const routines = [{ id: 'r1', name: 'Matin', activityIds: ['a-esprit', 'a-corps'] }];
  const { context, page, errors } = await cityAt(browser, baseURL, town({ esprit: 5 }, [], { activities, routines, achievements: FIRST_STEP, personal: { name: 'Mon hameau' } }), NOW);
  // Tout ce que ces formulaires pourraient changer.
  const kept = () => page.evaluate(() => JSON.stringify(['activities', 'wishes', 'chores', 'routines', 'personal'].map(key => __ville.state[key])));
  // Des espaces seuls, puis l'envoi : le message sous le champ, le champ vide et au focus, rien d'enregistré.
  const refuse = async (label, field, scope, send) => {
    const before = await kept(), error = page.locator(scope + ' .field-error');
    await field.fill('   ');
    await send();
    try { await error.waitFor({ timeout: 5000 }); } catch (failure) { assert.fail(label + ' : aucun message « champ à remplir »'); }
    assert.equal(await error.innerText(), 'Ce champ est à remplir.', label);
    assert.equal(await field.inputValue(), '', label + " : le champ n'est pas vidé");
    assert.equal(await field.evaluate(el => el === document.activeElement), true, label + " : le champ n'a pas le focus");
    assert.equal(await kept(), before, label + ' : quelque chose a été enregistré');
  };
  const submit = () => page.locator('#sheetBody button[type="submit"]').click();
  try {
    // Envie et obligation, dans l'onglet Tirage ; un vrai nom passe ensuite, et le message s'efface dès qu'on tape.
    await page.locator('[data-tab="tirage"]').click();
    const wish = page.locator('#addWish [name="name"]'), chore = page.locator('#addChore [name="name"]');
    await refuse('envie', wish, '#addWish', () => wish.press('Enter'));
    await wish.fill('Faire du pain');
    assert.equal(await page.locator('#addWish .field-error').count(), 0, 'le message reste affiché quand on tape un vrai nom');
    await wish.press('Enter');
    assert.ok(await page.evaluate(() => __ville.state.wishes.some(entry => entry.name === 'Faire du pain')), 'un vrai nom, après le message, est refusé');
    await refuse('obligation', chore, '#addChore', () => chore.press('Enter'));
    // Activité : l'ajout, puis la modification d'une activité (en mode Modifier) ; la routine.
    await page.locator('[data-tab="activites"]').click();
    await page.locator('#editActs').click();
    const added = page.locator('#actName');
    await refuse("ajout d'une activité", added, '#addActForm', () => added.press('Enter'));
    await page.locator('#actsGrid .act').first().click();
    await refuse("modification d'une activité", page.locator('#editName'), '#sheetBody', submit);
    await page.locator('#sheetClose').click();
    await page.locator('#routinesCard').getByRole('button', { name: 'Gérer', exact: true }).click();
    await sheet(page).getByRole('button', { name: 'Modifier', exact: true }).click();
    await refuse('routine', page.locator('#routineName'), '#sheetBody', submit);
    await page.locator('#sheetClose').click();
    // Le nom de la ville.
    await page.locator('[data-tab="ville"]').click();
    await page.locator('#personalizeCity').click();
    await refuse('nom de la ville', page.locator('#cityName'), '#sheetBody', submit);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return "Noms faits d'espaces : le message « champ à remplir »";
}

const SCENARIOS = [endScreenWithoutCompanion, endScreenHiddenCompanion, screensWithoutTechText, lateTabReloadsWhenIdle, lateTabWaitsForWhatFollows,
  lateTabWaitsForTyping, lateTabReloadsWhenStartIsRefused, balanceRoundsDown, recapWithFullJournal, weekReviewWithFullJournal, ambienceClosedAtEnd,
  soundResumedOnReturn, imagesOwnCityUnderSky, recapFiguresReadable, zoomDrawsOncePerFrame, focusNeverLost, villeFocusKeptOnPartialRenders, undoLastsUntilNextAction, undoStaysInItsCity, toastHeldByMouseAndFocus,
  keptMessageCoversNothing, headerFitsAt320, shopFocusRingWhole, streakReadInFull, routineStepAnnounced, challengesNameFollowsLanguage, blankNamesReported];
async function runFiabilite(browser, baseURL) {
  const scenarios = [];
  for (const scenario of SCENARIOS) scenarios.push(await scenario(browser, baseURL));
  return { scenarios };
}

module.exports = { runFiabilite, SCENARIOS, assertNoTechText };
