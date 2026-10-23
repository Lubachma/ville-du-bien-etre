const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { town, signBackup } = require('./content-browser.cjs');
const { cityAt } = require('./ambient-browser.cjs');
const { filledWeek, leaCode, sessionTown } = require('./rituals-browser.cjs');

// Étape 8, les premiers pas : la carte « Bienvenue » d'une ville sans séance, puis (tâches suivantes) la première respiration, l'abri,
// le collage depuis Safari et la visite d'un ami. Chaque scénario est une fonction à part, qu'on peut lancer seule.
const NOW = '2026-10-21T10:00:00Z';
// L'espace insécable (U+00A0) : « 2 minutes » en porte une, pour qu'une ligne ne finisse pas sur le chiffre.
const NB = String.fromCharCode(160);
// Le WebKit de Playwright se présente comme un Safari de Mac : pour qu'isIOS() soit vrai, il faut ce user-agent.
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

// Une ville vraiment neuve (aucune amorce), l'horloge simulée au mercredi 21 octobre 2026. « options » va au contexte
// (userAgent: IPHONE_UA, locale…). baseURL est utilisée telle quelle : le groupe reçoit celle qui finit par #debug.
async function freshTown(browser, baseURL, options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Zurich', ...options });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date(NOW) });
  await page.addInitScript(() => { window.__VILLE_DEBUG__ = true; });
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__ville);
  return { context, page, errors };
}

// Attend que la séance tourne : la mise en garde « écran allumé » suit la demande au navigateur, parfois un peu plus tard.
// La mise en garde de la séance d'avant reste dans la fenêtre fermée : seule celle d'une fenêtre ouverte compte.
async function confirmStart(page) {
  await page.waitForFunction(() => window.__ville.activeState() === 'mine' || !!document.querySelector('#sheet:not([hidden]) #wakeAck'));
  const warning = page.getByRole('button', { name: "C'est réglé, commencer", exact: true });
  if (await warning.isVisible()) await warning.click();
  await page.waitForFunction(() => window.__ville.activeState() === 'mine');
}
const result = page => page.locator('#sessResult');
const backToCity = page => result(page).getByRole('button', { name: 'Retour à la ville', exact: true }).click();

// La page, la carte et chacun de ses boutons tiennent dans la largeur, et le texte d'un bouton reste dans le bouton.
async function assertWelcomeFits(page, width, where) {
  const found = await page.evaluate(() => {
    const card = document.querySelector('#welcomeCard');
    const boxes = [card, ...card.querySelectorAll('button')].filter(el => el.getClientRects().length).map(el => {
      const box = el.getBoundingClientRect();
      return { name: el.id || el.textContent.trim(), left: Math.round(box.left), right: Math.round(box.right), inner: el.scrollWidth - el.clientWidth };
    });
    return { page: document.documentElement.scrollWidth, boxes };
  });
  assert.ok(found.page <= width, `${where} : la page déborde (${found.page} px pour ${width})`);
  assert.ok(found.boxes.length >= 4, `${where} : la carte, ses boutons et la croix sont affichés`);
  for (const box of found.boxes) {
    assert.ok(box.left >= 0 && box.right <= width, `${where} : « ${box.name} » sort de l'écran (${box.left} à ${box.right} pour ${width})`);
    assert.ok(box.inner <= 1, `${where} : le texte de « ${box.name} » déborde de son bouton (${box.inner} px)`);
  }
}

// « 2 » reste avec « minutes » : à 320 px le libellé passe sur deux lignes, et l'espace insécable empêche d'en finir une sur le chiffre.
async function assertTwoWithMinutes(page, where) {
  const found = await page.evaluate(() => {
    const node = document.querySelector('#welcomeStart').firstChild;   // le texte du bouton : un seul nœud, posé par applyStaticText
    const text = node.textContent, two = text.search(/\d/);
    const top = index => { const range = document.createRange(); range.setStart(node, index); range.setEnd(node, index + 1); return Math.round(range.getBoundingClientRect().top); };
    return { text, two: top(two), minutes: top(two + 2) };
  });
  assert.equal(found.two, found.minutes, `${where} : « 2 » finit une ligne, loin de « minutes » (${JSON.stringify(found.text)})`);
}

// La carte « Bienvenue » : pour une ville neuve, en premier dans la Ville ; pour une ville qui a déjà des séances comptées (même avec
// un historique vide, comme les villes amorcées et les vieilles sauvegardes), jamais.
async function welcomeForNewTown(browser, baseURL) {
  {
    const { context, page, errors } = await freshTown(browser, baseURL);
    try {
      const card = page.locator('#welcomeCard');
      assert.equal(await card.isVisible(), true);
      assert.equal(await page.locator('#welcomeTitle').innerText(), 'Bienvenue dans ta ville');
      assert.equal(await page.locator('#welcomePaste').isHidden(), true);
      // Une région nommée par son titre (un h3 : la Ville n'a pas de h2), la première carte de la Ville.
      assert.deepEqual(await card.evaluate(el => ({ tag: el.tagName, label: el.getAttribute('aria-labelledby'), title: document.getElementById('welcomeTitle').tagName,
        first: el.parentElement.id === 'view-ville' && el.parentElement.firstElementChild === el })), { tag: 'SECTION', label: 'welcomeTitle', title: 'H3', first: true });
      assert.deepEqual(await card.locator('ol li').allInnerTexts(), ['Lance un chrono pour une vraie activité.', 'Chaque minute terminée te rapporte des pièces.', 'Construis ta ville avec tes pièces.']);
      assert.equal(await page.locator('#welcomeStart').innerText(), `Commencer par 2${NB}minutes de calme`);
      assert.equal(await page.locator('#welcomeChoose').innerText(), 'Choisir une activité');
      assert.equal(await page.locator('#welcomeClose').getAttribute('aria-label'), 'Fermer l’accueil');
      assert.equal(await page.locator('#welcomeLangs').getAttribute('role'), 'group');
      assert.equal(await page.locator('#welcomeLangs').getAttribute('aria-label'), 'Langue de l’app');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  {
    // Une séance comptée mais aucune ligne d'historique : ce n'est pas une ville neuve.
    const { context, page, errors } = await cityAt(browser, baseURL, town({}, []), NOW);
    try {
      assert.equal(await page.evaluate(() => __ville.state.stats.ok + __ville.state.stats.ko), 1);
      assert.equal(await page.evaluate(() => __ville.state.history.length), 0);
      assert.equal(await page.locator('#welcomeCard').isHidden(), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return "Accueil : la carte Bienvenue d'une ville neuve, absente d'une ville qui a des séances comptées";
}

// La croix ferme l'accueil pour de bon sur cet appareil (le focus va à « Lancer une activité »), jusqu'à « Tout recommencer ».
async function welcomeCloseStays(browser, baseURL) {
  const { context, page, errors } = await freshTown(browser, baseURL);
  try {
    assert.equal(await page.locator('#welcomeCard').isVisible(), true);
    await page.locator('#welcomeClose').click();
    assert.equal(await page.locator('#welcomeCard').isHidden(), true);
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'ctaStart');
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    assert.equal(await page.locator('#welcomeCard').isHidden(), true);
    // Une ville neuve de nouveau : « Tout recommencer » (deux clics) rend l'accueil.
    const startOver = async () => {
      await page.locator('#settingsBtn').click();
      await page.getByRole('button', { name: 'Tout recommencer', exact: true }).click();
      await page.getByRole('button', { name: 'Confirmer : tout effacer', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('#welcomeCard').hidden);
    };
    await startOver();
    assert.equal(await page.locator('#welcomeCard').isVisible(), true);
    assert.equal(await page.locator('#sheet').isHidden(), true);
    // Sans recharger : fermée de nouveau, puis « Tout recommencer » la rend encore (la page oublie sa fermeture, comme l'appareil).
    await page.locator('#welcomeClose').click();
    assert.equal(await page.locator('#welcomeCard').isHidden(), true);
    await startOver();
    assert.equal(await page.locator('#welcomeCard').isVisible(), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Accueil : fermé pour de bon, il revient avec « Tout recommencer »';
}

// Le stockage refuse d'écrire « fermé » : la croix cache quand même la carte pour la page, même quand la Ville est redessinée.
// Rien n'est rangé, donc un rechargement la rend.
async function welcomeCloseWithoutStorage(browser, baseURL) {
  const { context, page, errors } = await freshTown(browser, baseURL);
  try {
    await page.evaluate(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === 'ville-bien-etre/v1:welcome-closed') throw new DOMException('Quota exceeded', 'QuotaExceededError');
        return set.call(this, name, value);
      };
    });
    await page.locator('#welcomeClose').click();
    assert.equal(await page.locator('#welcomeCard').isHidden(), true);
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'ctaStart');
    await page.evaluate(() => __ville.renderAll());
    assert.equal(await page.locator('#welcomeCard').isHidden(), true);
    await page.locator('[data-tab="activites"]').click();
    await page.locator('[data-tab="ville"]').click();
    assert.equal(await page.locator('#welcomeCard').isHidden(), true);
    assert.equal(await page.evaluate(() => localStorage.getItem('ville-bien-etre/v1:welcome-closed')), null);
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    assert.equal(await page.locator('#welcomeCard').isVisible(), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return "Accueil : la croix tient pour la page quand le stockage refuse d'écrire";
}

// Le lien de langue de la carte change la langue de toute l'interface sans ouvrir les Réglages, et le focus reste sur le lien qui reste
// (l'autre langue). Rien ne déborde à 320 px, en anglais comme en français.
async function welcomeLanguage(browser, baseURL) {
  const { context, page, errors } = await freshTown(browser, baseURL);
  try {
    const langs = page.locator('#welcomeLangs');
    // Un lien par langue connue autre que la langue affichée, écrit dans sa propre langue.
    assert.deepEqual(await langs.getByRole('button').evaluateAll(buttons => buttons.map(button => [button.textContent, button.getAttribute('lang')])), [['English', 'en']]);
    await langs.getByRole('button', { name: 'English', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert.equal(await page.locator('#welcomeTitle').innerText(), 'Welcome to your town');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    assert.equal(await page.locator('#sheet').isHidden(), true);
    assert.equal(await page.evaluate(() => __ville.state.settings.lang), 'en');
    const focusOn = () => page.evaluate(() => { const el = document.activeElement; return { text: el.textContent, inLangs: !!el.closest('#welcomeLangs'), lang: el.getAttribute('lang') }; });
    assert.deepEqual(await focusOn(), { text: 'Français', inLangs: true, lang: 'fr' });
    assert.deepEqual(await langs.getByRole('button').evaluateAll(buttons => buttons.map(button => button.textContent)), ['Français']);
    assert.equal(await langs.getAttribute('aria-label'), 'App language');
    assert.equal(await page.locator('#welcomeStart').innerText(), `Start with 2${NB}minutes of calm`);
    // Le choix est rangé dans la ville : un rechargement garde l'anglais.
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    assert.equal(await page.locator('#welcomeTitle').innerText(), 'Welcome to your town');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');

    await page.setViewportSize({ width: 320, height: 568 });
    await assertWelcomeFits(page, 320, 'en anglais à 320 px');
    await assertTwoWithMinutes(page, 'en anglais à 320 px');
    // … et de retour en français, par le lien qui est resté.
    await langs.getByRole('button', { name: 'Français', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.lang === 'fr');
    assert.equal(await page.locator('#welcomeTitle').innerText(), 'Bienvenue dans ta ville');
    assert.equal(await page.locator('#sheet').isHidden(), true);
    assert.equal(await page.evaluate(() => __ville.state.settings.lang), 'fr');
    assert.deepEqual(await focusOn(), { text: 'English', inLangs: true, lang: 'en' });
    await assertWelcomeFits(page, 320, 'en français à 320 px');
    await assertTwoWithMinutes(page, 'en français à 320 px');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return "Accueil : changer de langue depuis la carte, sans Réglages, le focus sur l'autre langue, rien ne déborde à 320 px";
}

// Le lien de langue ferme aussi le message en cours : un message ne reste jamais dans l'ancienne langue. Le message de l'exemple ne
// dépend pas de ce que la ville annonce à sa première ouverture : « Nouvelle ville créée. », après « Tout recommencer » (l'accueil revient).
async function welcomeLanguageClosesToast(browser, baseURL) {
  const { context, page, errors } = await freshTown(browser, baseURL);
  try {
    await page.locator('#settingsBtn').click();
    await page.getByRole('button', { name: 'Tout recommencer', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmer : tout effacer', exact: true }).click();
    const toast = page.locator('#toast');
    await toast.getByText('Nouvelle ville créée.').waitFor();
    assert.equal(await page.locator('#welcomeCard').isVisible(), true);
    await page.locator('#welcomeLangs').getByRole('button', { name: 'English', exact: true }).click();
    assert.equal(await toast.isHidden(), true);
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Accueil : le lien de langue ferme le message en cours';
}

// « Choisir une activité » mène à la liste des activités (le focus sur son titre) ; l'accueil, lui, reste tant qu'aucune séance n'est faite.
async function welcomeChoose(browser, baseURL) {
  const { context, page, errors } = await freshTown(browser, baseURL);
  try {
    await page.locator('#welcomeChoose').click();
    assert.equal(await page.locator('#view-activites').isVisible(), true);
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('#view-activites h2')), true);
    await page.locator('[data-tab="ville"]').click();
    assert.equal(await page.locator('#welcomeCard').isVisible(), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Accueil : « Choisir une activité » mène aux Activités, au titre';
}

// « Commencer par 2 minutes de calme » lance la séance (Calme, Concentration) ; après la première séance, réussie ou interrompue, l'accueil
// ne revient plus.
async function welcomeGoneAfterFirstSession(browser, baseURL) {
  {
    const { context, page, errors } = await freshTown(browser, baseURL);
    try {
      await page.locator('#welcomeStart').click();
      await confirmStart(page);
      assert.deepEqual(await page.evaluate(() => { const { name, min, cat, mode } = __ville.state.active; return { name, min, cat, mode }; }),
        { name: 'Respirer', min: 2, cat: 'calme', mode: 'focus' });
      // La séance tourne mais n'est pas encore comptée : la Ville, redessinée derrière elle, n'a déjà plus d'accueil.
      assert.equal(await page.evaluate(() => __ville.state.stats.ok + __ville.state.stats.ko), 0);
      await page.evaluate(() => __ville.renderAll());
      assert.equal(await page.locator('#welcomeCard').isHidden(), true);
      await page.clock.runFor('02:03');
      await result(page).waitFor();
      assert.equal(await result(page).locator('.res-title').innerText(), 'Session réussie');
      await backToCity(page);
      assert.equal(await page.locator('#welcomeCard').isHidden(), true);
      await page.reload();
      await page.waitForFunction(() => !!window.__ville);
      assert.equal(await page.locator('#welcomeCard').isHidden(), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  {
    // La première séance interrompue (le temps saute au-delà de la tolérance) compte aussi : l'accueil ne revient pas.
    const { context, page, errors } = await freshTown(browser, baseURL);
    try {
      await page.locator('#welcomeStart').click();
      await confirmStart(page);
      await page.clock.fastForward('02:02');
      await result(page).waitFor();
      assert.equal(await result(page).locator('.res-title').innerText(), 'Session interrompue');
      await backToCity(page);
      assert.equal(await page.locator('#welcomeCard').isHidden(), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return "Accueil : la séance de 2 minutes de calme, puis plus d'accueil (réussie ou interrompue)";
}

// La respiration guidée de la première séance est celle de la séance (S.active.breathing) : jamais le réglage de la personne. Ce que le
// bouton, la séance, le stockage, le réglage et le dessin en disent à cet instant (null : pas de champ).
const breathing = page => page.evaluate(() => {
  const saved = JSON.parse(localStorage.getItem('ville-bien-etre/v2')).active;
  return { pressed: document.querySelector('#breathBtn').getAttribute('aria-pressed'), session: __ville.state.active ? __ville.state.active.breathing ?? null : null,
    saved: saved ? saved.breathing ?? null : null, setting: __ville.state.settings.breathing, moving: document.querySelector('.ring-wrap').classList.contains('breathing') };
});

// « Commencer par 2 minutes de calme » respire : le bouton de respiration est enfoncé et le dessin bouge, sans que le réglage de la personne
// change. Un rechargement en Concentration met fin à la séance (quitter la page est une sortie) : la personne arrive sur « Session
// interrompue », et « Recommencer » relance la même séance avec le même choix de respiration, allumée ou éteinte pour cette séance. Le
// bouton ne change que la séance. Après les deux minutes : le Jardin zen et le succès « Premier pas », 17 M (5 de départ, 10 de l'étoile,
// 2 gagnés), le réglage toujours éteint.
async function firstCalmBreathes(browser, baseURL) {
  const { context, page, errors } = await freshTown(browser, baseURL);
  try {
    const button = page.locator('#breathBtn');
    const on = { pressed: 'true', session: true, saved: true, setting: false, moving: true };
    const off = { pressed: 'false', session: false, saved: false, setting: false, moving: false };
    // Recharger la page met fin à la séance de Concentration ; « Recommencer » en lance une autre, au même choix de respiration.
    const reloadAndRestart = async () => {
      await page.reload();
      await page.waitForFunction(() => !!window.__ville);
      await result(page).waitFor();
      assert.equal(await result(page).locator('.res-title').innerText(), 'Session interrompue');
      assert.equal(await page.evaluate(() => __ville.state.settings.breathing), false);
      await result(page).getByRole('button', { name: 'Recommencer', exact: true }).click();
      await confirmStart(page);
      assert.equal(await button.isVisible(), true);
    };
    // L'écran allumé n'est pas disponible ici (comme souvent sur iPhone) : la mise en garde s'ouvre avant la séance, qui part ensuite en
    // respirant. Après chaque rechargement, le navigateur est rendu à lui-même (confirmStart accepte la mise en garde si elle s'ouvre).
    await page.evaluate(() => Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true }));
    await page.locator('#welcomeStart').click();
    await page.locator('#sheet #wakeAck').waitFor();
    await page.getByRole('button', { name: "C'est réglé, commencer", exact: true }).click();
    await page.waitForFunction(() => window.__ville.activeState() === 'mine');
    assert.equal(await button.isVisible(), true);
    assert.deepEqual(await breathing(page), on);

    // Rechargée, la séance recommence en respirant.
    await reloadAndRestart();
    assert.deepEqual(await breathing(page), on);

    // Le bouton éteint la respiration de la séance, la rallume, et l'éteint : le réglage de la personne reste éteint.
    await button.click();
    assert.deepEqual(await breathing(page), off);
    await button.click();
    assert.deepEqual(await breathing(page), on);
    await button.click();
    assert.deepEqual(await breathing(page), off);

    // Éteinte pour cette séance, elle reste éteinte au « Recommencer » qui suit un rechargement, et se rallume d'un clic.
    await reloadAndRestart();
    assert.deepEqual(await breathing(page), off);
    await button.click();
    assert.deepEqual(await breathing(page), on);

    await page.clock.runFor('02:03');
    await result(page).locator('.res-title', { hasText: 'Session réussie' }).waitFor();
    assert.match(await result(page).innerText(), /Jardin zen/);
    assert.match(await result(page).innerText(), /Premier pas/);
    await backToCity(page);
    // 17 M : 5 de départ, 10 de l'étoile, 2 gagnés. Un défi de la semaine que cette séance relève rapporte 5 M de plus, et la graine de la
    // ville (donc l'instant où elle a été créée, qui change d'une ouverture à l'autre) décide des défis : « Une séance en Concentration »
    // tombe environ une fois sur quatre. Les défis payés sont comptés à part, et plus rien d'autre ne doit s'ajouter aux 17 M.
    const earned = await page.evaluate(() => ({ coins: __ville.state.coins, reward: __ville.state.history[0].reward,
      challenges: Object.keys(__ville.state.gifts).filter(key => key.startsWith('chal:')).length }));
    assert.equal(earned.reward, 2e6);
    assert.equal(earned.coins, 17e6 + earned.challenges * 5e6);
    assert.equal(await page.locator('#nextCard').isVisible(), true);
    assert.match(await page.locator('#nextCard').innerText(), /Jardin zen \(8\sM\)/);
    assert.equal(await page.evaluate(() => __ville.state.settings.breathing), false);
    assert.equal(await page.evaluate(() => __ville.state.active), null);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Première séance : elle respire, le bouton ne change que la séance, le réglage reste éteint, 17 M et le Jardin zen à la fin';
}

// Une séance reprise après un rechargement (une Activité libre : la Concentration, elle, ne reprend pas) lit sa respiration dans la séance
// enregistrée. Le choix de la séance l'emporte sur le réglage, « oui » comme « non » ; sans choix de la séance, le réglage décide et le
// bouton le change, comme avant.
async function resumedSessionKeepsBreathing(browser, baseURL) {
  const cases = [
    { own: true, setting: false, start: { pressed: 'true', session: true, saved: true, setting: false, moving: true }, click: { pressed: 'false', session: false, saved: false, setting: false, moving: false } },
    { own: false, setting: true, start: { pressed: 'false', session: false, saved: false, setting: true, moving: false }, click: { pressed: 'true', session: true, saved: true, setting: true, moving: true } },
    { own: null, setting: true, start: { pressed: 'true', session: null, saved: null, setting: true, moving: true }, click: { pressed: 'false', session: null, saved: null, setting: false, moving: false } },
  ];
  for (const { own, setting, start, click } of cases) {
    const { context, page, errors } = await freshTown(browser, baseURL);
    try {
      // La ville telle qu'elle est, avec une séance libre commencée il y a 30 s, posée avant le chargement qui suit.
      const seed = await page.evaluate(({ own, setting }) => {
        const state = JSON.parse(JSON.stringify(__ville.state)), now = Date.now();
        state.settings.breathing = setting;
        state.active = { id: 'reprise', name: 'Respirer', cat: 'calme', min: 2, mode: 'free', source: 'direct', startedAt: now - 30000, checkpointAt: now - 30000, elapsedSec: 30 };
        if (own !== null) state.active.breathing = own;
        return state;
      }, { own, setting });
      await page.addInitScript(state => {
        try {
          if (sessionStorage.getItem('seeded')) return;
          sessionStorage.setItem('seeded', '1');
          localStorage.setItem('ville-bien-etre/v2', JSON.stringify(state));
        } catch (e) { /* stockage indisponible : le test échouera plus loin */ }
      }, seed);
      await page.reload();
      await page.waitForFunction(() => window.__ville && window.__ville.activeState() === 'mine');
      assert.equal(await page.locator('#breathBtn').isVisible(), true);
      assert.deepEqual(await breathing(page), start, `séance reprise avec breathing ${own} et réglage ${setting}`);
      await page.locator('#breathBtn').click();
      assert.deepEqual(await breathing(page), click, `après un clic, breathing ${own} et réglage ${setting}`);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return 'Respiration : une séance reprise après un rechargement relit son choix, qui l\'emporte sur le réglage';
}

// La première ouverture est calme : l'étoile que la ville de départ mérite déjà est versée sans message (ni dans le message affiché, ni
// dans l'annonce faite aux lecteurs d'écran), et rien n'invite à dépenser. Le souhait du jour vient le lendemain de la première séance
// réussie, pas avant. L'aide dit qu'on peut commencer ici, sans rien installer.
async function quietFirstOpen(browser, baseURL) {
  const { context, page, errors } = await freshTown(browser, baseURL);
  try {
    // Pendant 1,5 s, le message affiché ne parle jamais d'étoile (celui d'avant disait « Nouvelle étoile d'harmonie » pendant près de 3 s).
    const seen = [];
    for (let i = 0; i < 15; i++) { seen.push(await page.locator('#toast').textContent()); await page.waitForTimeout(100); }
    assert.deepEqual(seen.filter(text => /étoile/i.test(text)), []);
    assert.doesNotMatch(await page.locator('#live').textContent(), /étoile/i);
    // L'étoile est bien versée (5 M de départ et 10 M), l'en-tête montre le solde versé (il est dessiné avant le tic qui verse l'étoile :
    // l'enregistrement du tic doit le redessiner), et le tout est enregistré sans attendre un rechargement.
    assert.deepEqual(await page.evaluate(() => [__ville.state.coins, !!__ville.state.gifts['star:verdure']]), [15e6, true]);
    assert.match(await page.locator('#balance').textContent(), /^15\sM$/);
    assert.deepEqual(await page.evaluate(() => { const saved = JSON.parse(localStorage.getItem('ville-bien-etre/v2')); return [saved.coins, !!saved.gifts['star:verdure']]; }), [15e6, true]);
    // Aucun souhait du jour : ni tiré, ni carte.
    assert.equal(await page.evaluate(() => __ville.state.townWish), null);
    const wish = page.locator('#townWishCard');
    assert.equal(await wish.count() === 0 || await wish.isHidden(), true);

    // L'aide : on peut commencer ici ; sur iPhone, on copie sa ville vers l'app installée, puis on la colle à sa première ouverture.
    await page.locator('#settingsBtn').click();
    await page.getByRole('button', { name: /^Bien démarrer et installer/ }).click();
    const help = await page.locator('#sheetBody').innerText();
    assert.match(help, /Tu peux commencer ici, sans rien installer\./);
    assert.match(help, /Sur iPhone, installe l.app quand tu veux\s: copie ta ville avec\s«\sCopier ma ville\s», puis colle-la à la première ouverture de l.app\./);
    assert.doesNotMatch(help, /avant de commencer/);
    await page.locator('#sheetClose').click();

    // Le jour de la première séance réussie, le souhait n'est toujours pas là : il vient le lendemain.
    await page.locator('#welcomeStart').click();
    await confirmStart(page);
    await page.clock.runFor('02:03');
    await result(page).locator('.res-title', { hasText: 'Session réussie' }).waitFor();
    await backToCity(page);
    assert.equal(await page.evaluate(() => __ville.state.stats.ok), 1);
    assert.equal(await page.evaluate(() => __ville.state.townWish), null);
    assert.equal(await wish.count() === 0 || await wish.isHidden(), true);
    await page.clock.fastForward('24:00:00');
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    assert.equal(await page.evaluate(() => __ville.state.townWish.day), '2026-10-22');
    assert.equal(await page.locator('#townWishCard').isVisible(), true);
    assert.match(await page.locator('#townWishCard').innerText(), /Souhait du jour[\s\S]*Maison[\s\S]*J'aimerais un banc juste à côté\./);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return "Première ouverture calme : l'étoile versée sans message, pas de souhait avant le lendemain de la première séance, l'aide dit de commencer ici";
}

// L'abri : la carte « Garde ta ville à l’abri ». Un faux presse-papiers, posé avant le chargement de la page : writeText range le texte
// dans window.__copied et répond, ou refuse quand window.__clipboardFails est vrai ; readText (le collage de la ville dans l'app installée)
// répond window.__clip, ou refuse quand window.__clipRefused est vrai, et note dans window.__readInClick s'il est appelé pendant le clic
// même (window.event est alors le clic : Safari ne laisse lire le presse-papiers que dans le geste de la personne). Le vrai presse-papiers
// demande un accord que le test ne donne pas.
const fakeClipboard = () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    writeText(text) {
      if (window.__clipboardFails) return Promise.reject(new DOMException('Écriture refusée', 'NotAllowedError'));
      window.__copied = text;
      return Promise.resolve();
    },
    readText() {
      window.__readInClick = !!window.event && window.event.type === 'click';
      if (window.__clipRefused) return Promise.reject(new DOMException('Lecture refusée', 'NotAllowedError'));
      return Promise.resolve(window.__clip ?? '');
    },
  } });
};
// Une ville amorcée qui a une séance comptée (town() : stats.ok 1 et historique vide), vue d'un iPhone au faux presse-papiers. cityAt ouvre la
// page elle-même : les scripts d'initialisation du contexte (le faux presse-papiers, et pour l'app installée navigator.standalone) sont
// posés ensuite, et la page est rechargée ; la ville reste celle qu'elle a rangée.
async function shelterTown(browser, baseURL, { standalone = false, insecure = false, seed = town({}, []), ...options } = {}) {
  const found = await cityAt(browser, baseURL, seed, NOW, { userAgent: IPHONE_UA, ...options });
  await found.context.addInitScript(fakeClipboard);
  if (standalone) await found.context.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true, configurable: true }));
  if (insecure) await found.context.addInitScript(() => Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true }));
  await found.page.reload();
  await found.page.waitForFunction(() => !!window.__ville);
  return found;
}
// Le navigateur propose d'installer l'app (Android, Chrome) : l'événement beforeinstallprompt, avec son invite et le choix que fera la
// personne (« accepted » ou « dismissed »). Vrai si l'app l'a empêché d'ouvrir la bannière du navigateur (preventDefault).
const propose = (page, outcome) => page.evaluate(outcome => {
  window.installCalls = 0;
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = () => { window.installCalls++; return Promise.resolve(); };
  event.userChoice = Promise.resolve({ outcome });
  return !window.dispatchEvent(event);
}, outcome);
const shelterTexts = async card => (await card.locator('.install-main p').allInnerTexts()).map(text => text.replaceAll(NB, ' '));
const backupAt = page => page.evaluate(() => Number(localStorage.getItem('ville-bien-etre/v1:backup-at')) || 0);
const focusedKey = page => page.evaluate(() => document.activeElement && (document.activeElement.dataset.focusKey || document.activeElement.id));

// La page, la carte et chacun de ses éléments tiennent dans la largeur, et le texte d'un bouton reste dans le bouton.
async function assertShelterFits(page, width, where) {
  const found = await page.evaluate(() => {
    const card = document.querySelector('#installCard');
    const boxes = [card, ...card.querySelectorAll('img, h3, p, button')].filter(el => el.getClientRects().length).map(el => {
      const box = el.getBoundingClientRect();
      return { name: el.id || el.dataset.act || el.tagName, left: Math.round(box.left), right: Math.round(box.right), inner: el.scrollWidth - el.clientWidth };
    });
    return { page: document.documentElement.scrollWidth, boxes };
  });
  assert.ok(found.page <= width, `${where} : la page déborde (${found.page} px pour ${width})`);
  assert.ok(found.boxes.length >= 5, `${where} : la carte, son titre, son texte et ses boutons sont affichés`);
  for (const box of found.boxes) {
    assert.ok(box.left >= 0 && box.right <= width, `${where} : « ${box.name} » sort de l'écran (${box.left} à ${box.right} pour ${width})`);
    assert.ok(box.inner <= 1, `${where} : le contenu de « ${box.name} » déborde (${box.inner} px)`);
  }
}

// La carte ne vient pas avant la première séance, ni pendant elle, et vient quand elle est comptée. Sur iPhone elle dit pourquoi garder sa
// ville à l'abri (le navigateur peut effacer un site resté sept jours sans visite), comment ajouter l'app à l'écran d'accueil, et qu'il faut
// ensuite copier la ville ici ; « Copier ma ville » copie une vraie sauvegarde, qui compte comme une sauvegarde, et le dit.
async function shelterAfterFirstSession(browser, baseURL) {
  {
    // Une ville neuve : ni au chargement, ni pendant la première séance ; elle vient quand la séance est comptée.
    const { context, page, errors } = await freshTown(browser, baseURL, { userAgent: IPHONE_UA });
    try {
      const card = page.locator('#installCard');
      assert.equal(await card.isHidden(), true);
      await page.locator('#welcomeStart').click();
      await confirmStart(page);
      await page.evaluate(() => __ville.renderAll());
      assert.equal(await card.isHidden(), true);
      await page.clock.runFor('02:03');
      await result(page).locator('.res-title', { hasText: 'Session réussie' }).waitFor();
      await backToCity(page);
      assert.equal(await card.isVisible(), true);
      assert.equal(await page.locator('#installTitle').innerText(), 'Garde ta ville à l’abri');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  {
    // Une séance comptée et un historique vide (ville amorcée, vieille sauvegarde) : la ville a vécu une séance, la carte est là.
    const { context, page, errors } = await shelterTown(browser, baseURL);
    try {
      const card = page.locator('#installCard');
      assert.equal(await page.evaluate(() => __ville.state.history.length), 0);
      assert.equal(await card.isVisible(), true);
      // Une région nommée par son titre (un h3), juste après l'accueil (caché ici), première de la Ville avec lui.
      assert.deepEqual(await card.evaluate(el => ({ tag: el.tagName, role: el.getAttribute('role'), label: el.getAttribute('aria-labelledby'),
        title: document.getElementById('installTitle').tagName, before: el.previousElementSibling.id, parent: el.parentElement.id })),
      { tag: 'DIV', role: 'region', label: 'installTitle', title: 'H3', before: 'welcomeCard', parent: 'view-ville' });
      assert.equal(await page.locator('#installTitle').innerText(), 'Garde ta ville à l’abri');
      assert.deepEqual(await shelterTexts(card), [
        'Sur iPhone, le navigateur peut effacer un site resté sept jours sans visite, mais pas une app ajoutée à l’écran d’accueil.',
        'Dans Safari, ouvre Partager, puis « Sur l’écran d’accueil » et « Ajouter ».',
        'Puis copie ta ville ici et colle-la à la première ouverture de l’app.',
      ]);
      assert.match(await card.innerText(), /sept jours/);
      // Pas de bouton « Installer » sur iPhone : « Copier ma ville », puis « Ne plus afficher ».
      assert.deepEqual(await card.locator('button').evaluateAll(buttons => buttons.map(button => [button.dataset.act, button.dataset.focusKey, button.textContent, button.className])), [
        ['copy', 'install:copy', 'Copier ma ville', 'btn btn-primary btn-sm'],
        ['hide', 'install:hide', 'Ne plus afficher', 'btn btn-ghost btn-sm'],
      ]);
      assert.equal(await card.locator('[data-act="install"]').count(), 0);
      assert.deepEqual(await card.locator('img').evaluateAll(images => images.map(img => [img.getAttribute('src'), img.getAttribute('alt'), img.width, img.height])), [['icons/icon-192.png', '', 48, 48]]);
      assert.equal(await card.locator('img').isVisible(), true, "à 390 px, l'icône est là");
      // Elle cède sa place au texte sous 380 px (375 px est un iPhone courant) et revient à 380 px.
      for (const [width, shown] of [[375, false], [379, false], [380, true], [390, true]]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(await card.locator('img').isVisible(), shown, `l'icône à ${width} px`);
      }
      // Redessinée avec la Ville, la carte garde le focus d'un de ses boutons ; et quand le navigateur envoie une proposition d'installation
      // (sans effet ici, mais elle redessine la carte), au clavier sur « Ne plus afficher », le focus n'est pas perdu non plus.
      await card.locator('[data-act="hide"]').focus();
      await page.evaluate(() => __ville.renderAll());
      assert.equal(await focusedKey(page), 'install:hide');
      await propose(page, 'dismissed');
      assert.equal(await focusedKey(page), 'install:hide');

      // « Copier ma ville » : le texte d'une vraie sauvegarde, sans séance en cours, compté comme une sauvegarde, et le message le dit.
      assert.equal(await backupAt(page), 0);
      await card.locator('[data-act="copy"]').click();
      await page.locator('#toast').filter({ hasText: 'Ville copiée' }).waitFor();
      assert.match(await page.locator('#toast').innerText(), /^Ville copiée\s: colle-la à la première ouverture de l’app\.$/);
      const copied = await page.evaluate(() => window.__copied);
      assert.match(copied, /^VBE2\.[A-Za-z0-9_-]+\.[0-9a-z]+$/);
      const saved = JSON.parse(Buffer.from(copied.split('.')[1], 'base64url').toString('utf8'));
      assert.deepEqual([saved.v, saved.stats.ok, saved.active], [2, 1, null]);
      const now = await page.evaluate(() => Date.now());
      assert.ok(Math.abs(now - await backupAt(page)) < 60000, 'la copie est datée de maintenant');
      // La carte reste (la ville n'est pas encore dans l'app), le focus revient au bouton, même quand le navigateur ne le donne pas au clic.
      assert.equal(await card.isVisible(), true);
      assert.equal(await focusedKey(page), 'install:copy');

      // « Tout recommencer » : une ville neuve n'a pas de séance, l'accueil revient et la carte repart.
      await page.locator('#settingsBtn').click();
      await page.getByRole('button', { name: 'Tout recommencer', exact: true }).click();
      await page.getByRole('button', { name: 'Confirmer : tout effacer', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('#welcomeCard').hidden);
      assert.equal(await card.isHidden(), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  for (const lang of ['fr', 'en']) {
    // Sur le plus petit téléphone (320 × 568), la carte est compacte : l'icône cède sa place au texte (sous 380 px), et les deux boutons se voient
    // en entier sans défiler, leur bas au-dessus de la barre des onglets.
    const { context, page, errors } = await shelterTown(browser, baseURL, { seed: town({}, [], { settings: { lang } }), viewport: { width: 320, height: 568 } });
    try {
      const where = `à 320 × 568 en ${lang}`;
      const found = await page.evaluate(() => {
        const card = document.querySelector('#installCard'), bottom = act => Math.round(card.querySelector(`[data-act="${act}"]`).getBoundingClientRect().bottom);
        return { scrolled: document.querySelector('#main').scrollTop, icon: card.querySelector('img').getClientRects().length > 0, copy: bottom('copy'), hide: bottom('hide'),
          tabbar: Math.round(document.querySelector('.tabbar').getBoundingClientRect().top) };
      });
      assert.equal(found.scrolled, 0, `${where} : la page n'est pas défilée`);
      assert.equal(found.icon, false, `${where} : l'icône prend la place du texte`);
      assert.ok(found.copy <= found.tabbar, `${where} : « Copier ma ville » finit à ${found.copy} px, sous la barre des onglets (${found.tabbar} px)`);
      assert.ok(found.hide <= found.tabbar, `${where} : « Ne plus afficher » finit à ${found.hide} px, sous la barre des onglets (${found.tabbar} px)`);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return "Abri : la carte vient après la première séance, dit pourquoi sur iPhone, tient sans défiler à 320 px, et « Copier ma ville » copie une vraie sauvegarde";
}

// Dans l'app installée, la carte n'a plus rien à proposer : jamais, même pour une ville qui a des séances (la même ville, dans le navigateur,
// la voit). Elle ne vient pas non plus hors d'un contexte sûr (ni HTTPS ni localhost), où l'app ne peut pas s'installer.
async function shelterNeverInstalled(browser, baseURL) {
  {
    const { context, page, errors } = await shelterTown(browser, baseURL);
    try {
      assert.notEqual(await page.evaluate(() => navigator.standalone), true);
      assert.equal(await page.evaluate(() => window.isSecureContext), true);
      assert.equal(await page.locator('#installCard').isVisible(), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  {
    const { context, page, errors } = await shelterTown(browser, baseURL, { standalone: true });
    try {
      assert.equal(await page.evaluate(() => navigator.standalone), true);
      assert.equal(await page.evaluate(() => __ville.state.stats.ok), 1);
      assert.equal(await page.locator('#installCard').isHidden(), true);
      await page.evaluate(() => __ville.renderAll());
      assert.equal(await page.locator('#installCard').isHidden(), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  {
    const { context, page, errors } = await shelterTown(browser, baseURL, { insecure: true });
    try {
      assert.equal(await page.evaluate(() => window.isSecureContext), false);
      assert.equal(await page.locator('#installCard').isHidden(), true);
      await page.evaluate(() => __ville.renderAll());
      assert.equal(await page.locator('#installCard').isHidden(), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return "Abri : jamais dans l'app installée, ni hors d'un contexte sûr";
}

// « Ne plus afficher » cache la carte pour de bon sur cet appareil (le focus va à « Lancer une activité ») : un rechargement ne la rend pas.
// Si le stockage refuse d'écrire, elle est cachée pour la page quand même, et un rechargement la rend.
async function shelterHideForGood(browser, baseURL) {
  {
    const { context, page, errors } = await shelterTown(browser, baseURL);
    try {
      assert.equal(await page.locator('#installCard').isVisible(), true);
      await page.locator('#installCard [data-act="hide"]').click();
      assert.equal(await page.locator('#installCard').isHidden(), true);
      assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'ctaStart');
      assert.equal(await page.evaluate(() => localStorage.getItem('ville-bien-etre/v1:install-hint')), '1');
      await page.evaluate(() => __ville.renderAll());
      assert.equal(await page.locator('#installCard').isHidden(), true);
      await page.reload();
      await page.waitForFunction(() => !!window.__ville);
      assert.equal(await page.locator('#installCard').isHidden(), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  {
    const { context, page, errors } = await shelterTown(browser, baseURL);
    try {
      await page.evaluate(() => {
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function (name, value) {
          if (name === 'ville-bien-etre/v1:install-hint') throw new DOMException('Quota exceeded', 'QuotaExceededError');
          return set.call(this, name, value);
        };
      });
      await page.locator('#installCard [data-act="hide"]').click();
      assert.equal(await page.locator('#installCard').isHidden(), true);
      assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'ctaStart');
      await page.evaluate(() => __ville.renderAll());
      assert.equal(await page.locator('#installCard').isHidden(), true);
      assert.equal(await page.evaluate(() => localStorage.getItem('ville-bien-etre/v1:install-hint')), null);
      await page.reload();
      await page.waitForFunction(() => !!window.__ville);
      assert.equal(await page.locator('#installCard').isVisible(), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return "Abri : « Ne plus afficher » cache la carte pour de bon, et pour la page quand le stockage refuse d'écrire";
}

// Un presse-papiers qui refuse : rien n'est copié ni compté comme une sauvegarde, le message reste (il ne s'efface pas seul) avec un bouton
// qui ouvre les Réglages sur la section Sauvegarde, amenée à l'écran, le focus sur son titre.
async function shelterCopyRefused(browser, baseURL) {
  const { context, page, errors } = await shelterTown(browser, baseURL);
  try {
    const sectionInView = () => page.evaluate(() => {
      const body = document.querySelector('#sheetBody').getBoundingClientRect(), title = document.querySelector('#settingsBackup .section-title').getBoundingClientRect();
      return title.top >= body.top && title.bottom <= body.bottom;
    });
    // Ouverts à la main, les Réglages ne montrent pas la section Sauvegarde : elle est plus bas.
    await page.locator('#settingsBtn').click();
    await page.locator('#settingsBackup').waitFor();
    assert.equal(await sectionInView(), false);
    await page.locator('#sheetClose').click();
    assert.equal(await page.locator('#sheet').isHidden(), true);

    await page.evaluate(() => { window.__clipboardFails = true; });
    await page.locator('#installCard [data-act="copy"]').click();
    const toast = page.locator('#toast'), open = toast.getByRole('button', { name: 'Aller à la sauvegarde', exact: true });
    await open.waitFor();
    assert.match(await toast.innerText(), /^La copie n’a pas marché\.\sTu peux copier ta ville dans Réglages → Sauvegarde\./);
    assert.equal(await page.evaluate(() => document.body.classList.contains('toast-kept')), true, 'le message reste');
    assert.equal(await page.evaluate(() => window.__copied ?? null), null, "rien n'a été copié");
    assert.equal(await backupAt(page), 0, 'une copie refusée ne compte pas comme une sauvegarde');
    assert.equal(await page.locator('#sheet').isHidden(), true, "aucune feuille ne s'ouvre d'elle-même");
    assert.equal(await page.locator('#installCard').isVisible(), true);
    assert.equal(await focusedKey(page), 'install:copy');

    await open.click();
    await page.locator('#sheet').waitFor();
    assert.equal(await page.locator('#settingsBackup').isVisible(), true);
    assert.equal(await sectionInView(), true);
    assert.equal(await toast.isHidden(), true);
    // Le titre de la section a le focus, et la feuille ne le lui reprend pas (elle donne le sien à son titre, 30 ms plus tard).
    await page.waitForTimeout(150);
    assert.deepEqual(await page.evaluate(() => ({ text: document.activeElement.textContent, inBackup: !!document.activeElement.closest('#settingsBackup') })), { text: 'Sauvegarde', inBackup: true });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  {
    // Sans presse-papiers du tout (navigator.clipboard absent) : le même message, rien n'est compté.
    const { context, page, errors } = await shelterTown(browser, baseURL);
    try {
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }));
      await page.locator('#installCard [data-act="copy"]').click();
      const toast = page.locator('#toast');
      await toast.getByRole('button', { name: 'Aller à la sauvegarde', exact: true }).waitFor();
      assert.match(await toast.innerText(), /^La copie n’a pas marché\./);
      assert.equal(await backupAt(page), 0);
      assert.equal(await page.locator('#sheet').isHidden(), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return "Abri : une copie refusée, ou sans presse-papiers, laisse le message, qui mène aux Réglages, section Sauvegarde";
}

// Android : le navigateur propose d'installer l'app. La carte attend la première séance, puis montre « Installer » ; le clic lance l'invite du
// navigateur une seule fois et laisse l'aide ; accepter, ou l'événement « appinstalled », la fait disparaître ; sur un ordinateur (pointeur
// précis), la proposition ne la fait jamais venir.
async function shelterAndroid(browser, baseURL) {
  {
    const { context, page, errors } = await cityAt(browser, baseURL, town({}, []), NOW);
    try {
      const card = page.locator('#installCard');
      assert.equal(await card.isHidden(), true);
      assert.equal(await propose(page, 'dismissed'), true, 'la bannière du navigateur est empêchée');
      assert.equal(await card.isVisible(), true);
      assert.equal(await page.locator('#installTitle').innerText(), 'Garde ta ville à l’abri');
      assert.deepEqual(await shelterTexts(card), ['Installée, l’app s’ouvre depuis ton écran d’accueil et garde ta ville sur ce téléphone.']);
      assert.deepEqual(await card.locator('button').evaluateAll(buttons => buttons.map(button => [button.dataset.act, button.dataset.focusKey, button.textContent])), [
        ['install', 'install:install', 'Installer'],
        ['hide', 'install:hide', 'Ne plus afficher'],
      ]);
      assert.equal(await card.locator('.install-help').count(), 0);
      // Le navigateur peut envoyer sa proposition deux fois : la carte est redessinée sous un focus au clavier, qui reste sur son bouton.
      await card.locator('[data-act="install"]').focus();
      await propose(page, 'dismissed');
      assert.equal(await focusedKey(page), 'install:install');
      await card.locator('[data-act="install"]').click();
      assert.equal(await card.locator('[data-act="install"]').count(), 0);
      assert.match(await card.locator('.install-help').innerText(), /menu de ton navigateur/);
      assert.equal(await page.evaluate(() => window.installCalls), 1);
      assert.equal(await focusedKey(page), 'install:hide');
      // Redessinée, la carte garde son aide et ne rend pas le bouton.
      await page.evaluate(() => __ville.renderAll());
      assert.equal(await card.locator('[data-act="install"]').count(), 0);
      assert.equal(await card.locator('.install-help').count(), 1);
      // Après un refus, Chrome renvoie sa proposition : la carte est redessinée, le focus qu'elle avait reste sur son bouton, « Installer »
      // revient et l'aide (le menu du navigateur) reste, comme avant.
      await propose(page, 'accepted');
      assert.equal(await focusedKey(page), 'install:hide');
      assert.equal(await card.locator('[data-act="install"]').isVisible(), true);
      assert.equal(await card.locator('.install-help').count(), 1);
      assert.deepEqual(await card.locator('button').evaluateAll(buttons => buttons.map(button => button.dataset.act)), ['install', 'hide']);
      await card.locator('[data-act="install"]').click();
      await card.waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => window.installCalls), 1);
      assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'ctaStart');
      assert.equal(await page.evaluate(() => localStorage.getItem('ville-bien-etre/v1:install-hint')), null);
      await page.evaluate(() => __ville.renderAll());
      assert.equal(await card.isHidden(), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  {
    // « appinstalled » (l'app a été installée par le menu du navigateur) : la carte part.
    const { context, page, errors } = await cityAt(browser, baseURL, town({}, []), NOW);
    try {
      await propose(page, 'dismissed');
      assert.equal(await page.locator('#installCard').isVisible(), true);
      await page.locator('#installCard [data-act="hide"]').focus();
      await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
      assert.equal(await page.locator('#installCard').isHidden(), true);
      assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'ctaStart');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  {
    // Un ordinateur : la proposition est gardée mais la carte, faite pour un téléphone, ne vient pas.
    const { context, page, errors } = await cityAt(browser, baseURL, town({}, []), NOW, { isMobile: false, hasTouch: false });
    try {
      assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), false);
      assert.equal(await propose(page, 'dismissed'), true);
      await page.evaluate(() => __ville.renderAll());
      assert.equal(await page.locator('#installCard').isHidden(), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return "Abri : sur Android, « Installer » lance l'invite une seule fois, accepter ou « appinstalled » ferme la carte, jamais sur un ordinateur";
}

// À 320 px, rien ne déborde, en français et en anglais, pour l'iPhone (trois paragraphes et « Copier ma ville ») comme pour Android
// (« Installer », puis l'aide).
async function shelterFits320(browser, baseURL) {
  const viewport = { width: 320, height: 568 };
  const TEXTS = {
    fr: { title: 'Garde ta ville à l’abri', ios: /sept jours/, prompt: /Installée, l’app s’ouvre/, copy: 'Copier ma ville' },
    en: { title: 'Keep your town safe', ios: /left seven days without a visit/, prompt: /Once installed, the app opens from your home screen/, copy: 'Copy my town' },
  };
  for (const lang of ['fr', 'en']) {
    const seed = town({}, [], { settings: { lang } }), texts = TEXTS[lang];
    {
      const { context, page, errors } = await shelterTown(browser, baseURL, { seed, viewport });
      try {
        assert.equal(await page.locator('#installTitle').innerText(), texts.title);
        assert.match(await page.locator('#installCard').innerText(), texts.ios);
        assert.equal(await page.locator('#installCard [data-act="copy"]').innerText(), texts.copy);
        await assertShelterFits(page, 320, `iPhone en ${lang} à 320 px`);
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
    {
      const { context, page, errors } = await cityAt(browser, baseURL, seed, NOW, { viewport });
      try {
        await propose(page, 'dismissed');
        assert.equal(await page.locator('#installTitle').innerText(), texts.title);
        assert.match(await page.locator('#installCard').innerText(), texts.prompt);
        await assertShelterFits(page, 320, `Android en ${lang} à 320 px`);
        await page.locator('#installCard [data-act="install"]').click();
        assert.equal(await page.locator('#installCard .install-help').isVisible(), true);
        await assertShelterFits(page, 320, `Android avec l'aide, en ${lang} à 320 px`);
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  }
  return 'Abri : à 320 px, rien ne déborde, en français et en anglais';
}

// Coller ma ville : l'app installée sur iPhone a son propre stockage, séparé de celui de Safari. Sa ville est neuve (15 M) ; « J’avais commencé
// dans Safari : coller ma ville » y reprend la sauvegarde que « Copier ma ville » a mise dans le presse-papiers.
// installedTown : comme shelterTown, freshTown ouvre la page elle-même, puis le contexte reçoit le faux presse-papiers et, pour l'app installée,
// navigator.standalone, et la page est rechargée ; la ville reste celle qu'elle a rangée. iphone: false, standalone: false : un autre
// navigateur, ou Safari lui-même.
async function installedTown(browser, baseURL, { standalone = true, iphone = true, ...options } = {}) {
  const found = await freshTown(browser, baseURL, { ...(iphone && { userAgent: IPHONE_UA }), ...options });
  await found.context.addInitScript(fakeClipboard);
  if (standalone) await found.context.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true, configurable: true }));
  await found.page.reload();
  await found.page.waitForFunction(() => !!window.__ville);
  return found;
}
// Une sauvegarde signée comme celle de « Copier ma ville » : 42 M et trois séances réussies. Son premier succès est déjà inscrit, comme dans une
// vraie sauvegarde : sans cela la reprendre le rattraperait, et le message parlerait des succès au lieu de la restauration.
const SAFARI_DAY = Date.parse('2026-10-16T10:00:00Z');
const safariBackup = (lang = 'fr') => signBackup(town({}, [], { settings: { lang }, coins: 42e6, stats: { ok: 3, byCat: {}, days: { '2026-10-16': 30 } },
  achievements: { 'premier-pas': SAFARI_DAY } }));
const plain = text => text.replace(/\s+/g, ' ');
// Le texte tel qu'un courriel ou une messagerie le rend : précédé d'un saut de ligne, coupé en lignes de 60 caractères, suivi d'un autre saut de
// ligne. readBackup ignore tous les blancs, et l'empreinte vérifie que rien d'autre n'a changé.
const wrapped = text => '\n' + text.match(/.{1,60}/g).join('\n') + '\n';
const activeId = page => page.evaluate(() => document.activeElement && document.activeElement.id);
const clipboardHolds = (page, clip, refused = false) => page.evaluate(({ clip, refused }) => { window.__clip = clip; window.__clipRefused = refused; }, { clip, refused });

// Le bouton lit le presse-papiers pendant le clic et ouvre la feuille « Reprendre ma ville », qui montre la ville trouvée (un texte précédé d'un saut
// de ligne et coupé en lignes s'ouvre de même). « Annuler » et Échap la ferment sans rien changer, le focus revient au bouton (Safari ne le donne pas
// au bouton cliqué). « Reprendre cette ville » remplace la ville neuve en un geste : la ville est enregistrée et compte comme une sauvegarde faite sur
// cet appareil, l'accueil disparaît et le focus passe à « Lancer une activité » ; une ville de Safari sans séance laisse l'accueil, et le focus passe
// quand même. Le texte que « Copier ma ville » a copié dans Safari est celui que l'app installée reprend.
async function pasteFromSafari(browser, baseURL) {
  {
    const { context, page, errors } = await installedTown(browser, baseURL);
    try {
      const card = page.locator('#welcomeCard'), paste = page.locator('#welcomePaste'), sheet = page.locator('#sheet');
      assert.deepEqual(await page.evaluate(() => [navigator.standalone, __ville.state.coins, __ville.state.stats.ok]), [true, 15e6, 0]);
      assert.equal(await backupAt(page), 0, "aucune sauvegarde n'a été faite depuis cet appareil");
      assert.equal(await card.isVisible(), true);
      assert.equal(await paste.isVisible(), true);
      assert.equal(plain(await paste.innerText()), 'J’avais commencé dans Safari : coller ma ville');
      await clipboardHolds(page, safariBackup());

      // La feuille montre la ville trouvée, avec ses deux boutons ; le presse-papiers a été lu pendant le clic.
      await paste.click();
      await sheet.waitFor();
      assert.equal(await page.evaluate(() => window.__readInClick), true, 'le presse-papiers est lu pendant le clic, pas après');
      assert.equal(await page.locator('#sheetTitle').innerText(), 'Reprendre ma ville');
      const found = await page.locator('#sheetBody').evaluate(body => {
        const plain = text => text.replace(/\s+/g, ' ');
        return { lines: [...body.querySelectorAll(':scope > p')].map(p => plain(p.textContent)), bold: [...body.querySelectorAll(':scope > p > strong')].map(el => plain(el.textContent)),
          actions: [...body.querySelectorAll(':scope > div.review-actions > button')].map(button => [button.textContent, button.className]) };
      });
      assert.equal(found.lines[0], 'Ville trouvée dans le presse-papiers :');
      assert.equal(found.lines.length, 2);
      assert.equal(found.bold.length, 1);
      assert.equal(found.lines[1], found.bold[0]);
      assert.match(found.bold[0], /^42 M · .+ · 3 sessions réussies · /);
      assert.deepEqual(found.actions, [['Reprendre cette ville', 'btn btn-primary'], ['Annuler', 'btn btn-ghost']]);

      // « Annuler » : la feuille se ferme, la ville est inchangée, le focus revient au bouton. Échap fait de même.
      await sheet.getByRole('button', { name: 'Annuler', exact: true }).click();
      await sheet.waitFor({ state: 'hidden' });
      assert.equal(await activeId(page), 'welcomePaste');
      assert.equal(await page.evaluate(() => __ville.state.coins), 15e6);
      assert.equal(await card.isVisible(), true);
      await paste.click();
      await sheet.waitFor();
      await page.keyboard.press('Escape');
      await sheet.waitFor({ state: 'hidden' });
      assert.equal(await activeId(page), 'welcomePaste');
      assert.equal(await page.evaluate(() => __ville.state.coins), 15e6);

      // Collé après un courriel : précédé d'un saut de ligne et coupé en lignes, le texte est lu de même (l'empreinte vérifie qu'il est entier).
      await clipboardHolds(page, wrapped(safariBackup()));
      await paste.click();
      await sheet.waitFor();
      assert.match(plain(await page.locator('#sheetBody strong').innerText()), /^42 M · .+ · 3 sessions réussies · /);
      await sheet.getByRole('button', { name: 'Annuler', exact: true }).click();
      await sheet.waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => __ville.state.coins), 15e6);
      await clipboardHolds(page, safariBackup());

      // « Reprendre cette ville » : la ville de Safari remplace la ville neuve, enregistrée, sans accueil, le focus sur « Lancer une activité ».
      await paste.click();
      await sheet.waitFor();
      await sheet.getByRole('button', { name: 'Reprendre cette ville', exact: true }).click();
      await sheet.waitFor({ state: 'hidden' });
      assert.deepEqual(await page.evaluate(() => [__ville.state.coins, __ville.state.stats.ok, __ville.state.active]), [42e6, 3, null]);
      assert.equal(await card.isHidden(), true);
      assert.equal(plain(await page.locator('#toast').innerText()), 'Sauvegarde restaurée et enregistrée.');
      assert.equal(await activeId(page), 'ctaStart');
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ville-bien-etre/v2')).coins), 42e6);
      assert.match(await page.locator('#balance').textContent(), /^42\sM$/);
      // La ville reprise égale une sauvegarde que la personne détient : elle compte comme faite sur cet appareil, et le rappel de sauvegarde (trois
      // séances, aucun export fait ici) ne vient pas tout de suite. La Ville, redessinée pour cela, laisse le focus sur « Lancer une activité ».
      assert.ok(Math.abs(await page.evaluate(() => Date.now()) - await backupAt(page)) < 60000, 'la reprise est datée de maintenant');
      assert.equal(await page.locator('#remind').isHidden(), true);
      assert.equal(await activeId(page), 'ctaStart');
      await page.reload();
      await page.waitForFunction(() => !!window.__ville);
      assert.deepEqual(await page.evaluate(() => [__ville.state.coins, __ville.state.stats.ok]), [42e6, 3]);
      assert.equal(await card.isHidden(), true);
      assert.equal(await page.locator('#remind').isHidden(), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  {
    // Une ville de Safari sans aucune séance (la personne n'avait fait que l'ouvrir) : la reprise la remplace, mais l'accueil reste, et son bouton
    // avec ; le focus passe quand même à « Lancer une activité », sans erreur.
    const { context, page, errors } = await installedTown(browser, baseURL);
    try {
      await clipboardHolds(page, signBackup(town({}, [], { coins: 7e6, stats: { ok: 0, byCat: {}, days: {} } })));
      await page.locator('#welcomePaste').click();
      await page.locator('#sheet').waitFor();
      assert.match(plain(await page.locator('#sheetBody strong').innerText()), /^7 M · .+ · 0 session réussie · /);
      await page.locator('#sheet').getByRole('button', { name: 'Reprendre cette ville', exact: true }).click();
      await page.locator('#sheet').waitFor({ state: 'hidden' });
      assert.deepEqual(await page.evaluate(() => [__ville.state.coins, __ville.state.stats.ok + __ville.state.stats.ko]), [7e6, 0]);
      assert.equal(plain(await page.locator('#toast').innerText()), 'Sauvegarde restaurée et enregistrée.');
      assert.equal(await page.locator('#welcomeCard').isVisible(), true);
      assert.equal(await page.locator('#welcomePaste').isVisible(), true);
      assert.equal(await activeId(page), 'ctaStart');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  {
    // De bout en bout : le texte que « Copier ma ville » copie dans Safari (la carte d'installation) est repris tel quel par l'app installée.
    const safari = await shelterTown(browser, baseURL);
    let copied;
    try {
      await safari.page.locator('#installCard [data-act="copy"]').click();
      await safari.page.locator('#toast').filter({ hasText: 'Ville copiée' }).waitFor();
      copied = await safari.page.evaluate(() => window.__copied);
      assert.match(copied, /^VBE2\./);
      assert.deepEqual(safari.errors, []);
    } finally { await safari.context.close(); }
    const { context, page, errors } = await installedTown(browser, baseURL);
    try {
      await clipboardHolds(page, copied);
      await page.locator('#welcomePaste').click();
      await page.locator('#sheet').waitFor();
      assert.match(plain(await page.locator('#sheetBody strong').innerText()), /^3 Md · 0 construction · 1 session réussie · /);
      await page.locator('#sheet').getByRole('button', { name: 'Reprendre cette ville', exact: true }).click();
      await page.locator('#sheet').waitFor({ state: 'hidden' });
      assert.deepEqual(await page.evaluate(() => [__ville.state.coins, __ville.state.stats.ok]), [3e9, 1]);
      assert.equal(await page.locator('#welcomeCard').isHidden(), true);
      assert.equal(await activeId(page), 'ctaStart');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return "Coller ma ville : la feuille montre la ville de Safari, « Annuler » la laisse, « Reprendre cette ville » la reprend en un geste (enregistrée, sans accueil, focus sur « Lancer une activité »)";
}

// Rien à reprendre, ou rien de lisible : presse-papiers vide, autre texte, refusé, absent, sauvegarde coupée, abîmée ou dont la version ne va pas. Un
// message doux qui reste, avec la porte de Réglages → Sauvegarde ; la ville n'a pas changé et aucune feuille ne s'est ouverte.
async function pasteNothing(browser, baseURL) {
  const { context, page, errors } = await installedTown(browser, baseURL);
  try {
    const toast = page.locator('#toast'), open = toast.getByRole('button', { name: 'Aller à la sauvegarde', exact: true });
    const NONE = 'Pas de ville dans le presse-papiers. Copie-la d’abord dans Safari, ou colle-la dans Réglages → Sauvegarde.';
    const whole = safariBackup(), middle = Math.floor(whole.length / 2);
    // Un caractère du milieu change (en restant dans l'alphabet d'une sauvegarde) : l'empreinte ne va plus.
    const damaged = whole.slice(0, middle) + (whole[middle] === 'A' ? 'B' : 'A') + whole.slice(middle + 1);
    const cases = [
      ['un presse-papiers vide', { clip: '' }, NONE],
      ['un autre texte', { clip: 'https://example.org/une-page' }, NONE],
      ['un presse-papiers refusé', { refused: true }, NONE],
      ['une sauvegarde abîmée', { clip: damaged }, 'Cette sauvegarde a été modifiée ou abîmée : impossible de la restaurer.'],
      ['une sauvegarde coupée', { clip: whole.slice(0, 80) }, "Ce texte n'est pas une sauvegarde de la Ville du bien-être."],
      // « VBE1. » (l'ancienne version) passe la porte comme « VBE2. » : c'est la lecture qui dit ce qui ne va pas. La signature ne couvre que le
      // corps, elle est bonne ; mais la ville écrite dedans est de la version 2, pas 1.
      ['un texte en VBE1. dont la version ne va pas', { clip: 'VBE1.' + whole.slice(5) }, "Cette sauvegarde n'est pas lisible."],
      ['un navigateur sans presse-papiers', { missing: true }, NONE],
    ];
    for (const [label, { clip = '', refused = false, missing = false }, message] of cases) {
      if (missing) await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }));
      else await clipboardHolds(page, clip, refused);
      await page.locator('#welcomePaste').click();
      await open.waitFor();
      assert.equal(plain(await toast.locator('span').innerText()), message, label);
      assert.equal(await page.evaluate(() => document.body.classList.contains('toast-kept')), true, `${label} : le message reste`);
      assert.equal(await page.locator('#sheet').isHidden(), true, `${label} : aucune feuille ne s'ouvre`);
      assert.deepEqual(await page.evaluate(() => [__ville.state.coins, __ville.state.stats.ok]), [15e6, 0], `${label} : la ville n'a pas changé`);
      assert.equal(await page.locator('#welcomeCard').isVisible(), true, `${label} : l'accueil reste`);
      // Changer d'onglet ferme le message qui reste : le cas suivant en voit un neuf.
      await page.locator('[data-tab="activites"]').click();
      assert.equal(await toast.isHidden(), true);
      await page.locator('[data-tab="ville"]').click();
    }
    // Le bouton du message mène aux Réglages, à la section Sauvegarde (le message se ferme). Le navigateur est sans presse-papiers ici : même message.
    await page.locator('#welcomePaste').click();
    await open.click();
    await page.locator('#sheet').waitFor();
    assert.equal(await toast.isHidden(), true);
    assert.equal(await page.locator('#settingsBackup').isVisible(), true);
    await page.waitForTimeout(150);
    assert.deepEqual(await page.evaluate(() => ({ text: document.activeElement.textContent, inBackup: !!document.activeElement.closest('#settingsBackup') })), { text: 'Sauvegarde', inBackup: true });
    assert.equal(await page.evaluate(() => __ville.state.coins), 15e6);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return "Coller ma ville : vide, autre texte, refusé, absent, coupé ou abîmé, un message doux mène à Réglages → Sauvegarde, rien n'est remplacé ni ouvert";
}

// Le bouton n'existe que dans l'app installée sur iPhone, où la ville de Safari n'est pas : ni dans Safari lui-même (iPhone, hors de l'app), ni dans
// une app installée ailleurs (Android, ordinateur : le stockage y est celui du navigateur), ni dans un navigateur ordinaire. L'accueil, lui, est là
// partout. Le premier cas, l'app installée sur iPhone, est la preuve que le bouton peut se montrer : sans elle, un bouton toujours caché passerait.
async function pasteHiddenOutsideApp(browser, baseURL) {
  const cases = [
    ['dans l’app installée sur iPhone', {}, { iphone: true, standalone: true }, false],
    ['dans Safari, hors de l’app installée', { standalone: false }, { iphone: true, standalone: false }, true],
    ['dans une app installée qui n’est pas sur iPhone', { iphone: false }, { iphone: false, standalone: true }, true],
    ['dans un navigateur ordinaire', { iphone: false, standalone: false }, { iphone: false, standalone: false }, true],
  ];
  for (const [where, options, expected, hidden] of cases) {
    const { context, page, errors } = await installedTown(browser, baseURL, options);
    try {
      const paste = page.locator('#welcomePaste');
      assert.deepEqual(await page.evaluate(() => ({ iphone: /iPhone/.test(navigator.userAgent), standalone: navigator.standalone === true })), expected, `${where} : le décor`);
      assert.equal(await page.locator('#welcomeCard').isVisible(), true, `${where} : l'accueil est là`);
      assert.equal(await paste.evaluate(el => el.hidden), hidden, `${where} : le bouton ${hidden ? 'est caché' : 'se montre'}`);
      assert.equal(await paste.isHidden(), hidden);
      // Redessinée avec la Ville, la carte garde le même avis.
      await page.evaluate(() => __ville.renderAll());
      assert.equal(await paste.isHidden(), hidden, `${where} : après un dessin`);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return "Coller ma ville : le bouton se montre dans l'app installée sur iPhone, et reste caché dans Safari, dans une app installée hors iPhone et dans un navigateur ordinaire";
}

// Chaque élément affiché de ces sélecteurs tient dans la largeur et son contenu dans lui-même ; la page ne défile pas de côté.
async function assertFits(page, selectors, width, where) {
  const found = await page.evaluate(selectors => {
    const boxes = selectors.flatMap(selector => [...document.querySelectorAll(selector)]).filter(el => el.getClientRects().length).map(el => {
      const box = el.getBoundingClientRect();
      return { name: el.id || el.className || el.tagName, left: Math.round(box.left), right: Math.round(box.right), inner: el.scrollWidth - el.clientWidth };
    });
    return { page: document.documentElement.scrollWidth, boxes };
  }, selectors);
  assert.ok(found.page <= width, `${where} : la page déborde (${found.page} px pour ${width})`);
  assert.ok(found.boxes.length >= selectors.length, `${where} : les éléments sont affichés (${found.boxes.length})`);
  for (const box of found.boxes) {
    assert.ok(box.left >= 0 && box.right <= width, `${where} : « ${box.name} » sort de l'écran (${box.left} à ${box.right} pour ${width})`);
    assert.ok(box.inner <= 1, `${where} : le contenu de « ${box.name} » déborde (${box.inner} px)`);
  }
}

// À 320 px, en français et en anglais, rien ne déborde : l'accueil avec son bouton « coller ma ville », la feuille et le message doux.
async function pasteFits320(browser, baseURL) {
  const TEXTS = {
    fr: { locale: 'fr-FR', paste: /^J’avais commencé dans Safari/, title: 'Reprendre ma ville', cancel: 'Annuler', restore: 'Reprendre cette ville',
      none: /^Pas de ville dans le presse-papiers\./, open: 'Aller à la sauvegarde', restored: 'Sauvegarde restaurée et enregistrée.' },
    en: { locale: 'en-US', paste: /^I started in Safari/, title: 'Bring back my town', cancel: 'Cancel', restore: 'Bring back this town',
      none: /^No town on the clipboard\./, open: 'Go to Backup', restored: 'Backup restored and saved.' },
  };
  for (const lang of ['fr', 'en']) {
    const texts = TEXTS[lang], where = `en ${lang} à 320 px`;
    const { context, page, errors } = await installedTown(browser, baseURL, { viewport: { width: 320, height: 568 }, locale: texts.locale });
    try {
      const sheet = page.locator('#sheet'), toast = page.locator('#toast');
      assert.equal(await page.evaluate(() => document.documentElement.lang), lang);
      assert.match(plain(await page.locator('#welcomePaste').innerText()), texts.paste);
      await assertWelcomeFits(page, 320, `l'accueil ${where}`);
      // La feuille, puis « Annuler ».
      await clipboardHolds(page, safariBackup(lang));
      await page.locator('#welcomePaste').click();
      await sheet.waitFor();
      assert.equal(await page.locator('#sheetTitle').innerText(), texts.title);
      await assertFits(page, ['#sheet', '#sheetBody p', '#sheetBody button'], 320, `la feuille ${where}`);
      await sheet.getByRole('button', { name: texts.cancel, exact: true }).click();
      await sheet.waitFor({ state: 'hidden' });
      assert.equal(await activeId(page), 'welcomePaste');
      // Le message doux, avec son bouton.
      await clipboardHolds(page, '');
      await page.locator('#welcomePaste').click();
      await toast.getByRole('button', { name: texts.open, exact: true }).waitFor();
      assert.match(plain(await toast.locator('span').innerText()), texts.none);
      await assertFits(page, ['#toast', '#toast span', '#toast button'], 320, `le message ${where}`);
      // Reprise : le message de la restauration, dans la langue de la ville reprise (la même ici).
      await clipboardHolds(page, safariBackup(lang));
      await page.locator('#welcomePaste').click();
      await sheet.waitFor();
      await sheet.getByRole('button', { name: texts.restore, exact: true }).click();
      await sheet.waitFor({ state: 'hidden' });
      assert.equal(plain(await toast.innerText()), texts.restored);
      assert.equal(await page.evaluate(() => document.documentElement.lang), lang);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return 'Coller ma ville : à 320 px, rien ne déborde, en français et en anglais';
}

// Une ville reprise d'une sauvegarde égale une sauvegarde que la personne détient : elle compte comme faite sur cet appareil, comme « Copier ma ville »,
// et le rappel de sauvegarde n'est pas dû tout de suite. C'est restoreBackup qui le fait, pour le collage dans l'app installée (voir pasteFromSafari)
// comme pour Réglages → Sauvegarde, ici : coller le texte, vérifier, remplacer en deux gestes.
async function restoreCountsAsBackup(browser, baseURL) {
  const { context, page, errors } = await freshTown(browser, baseURL);
  try {
    assert.equal(await backupAt(page), 0, "aucune sauvegarde n'a été faite depuis cet appareil");
    await page.locator('#settingsBtn').click();
    await page.locator('#importArea').fill(safariBackup());
    await page.getByRole('button', { name: 'Vérifier la sauvegarde', exact: true }).click();
    await page.getByRole('button', { name: 'Remplacer ma ville par cette sauvegarde', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmer le remplacement', exact: true }).click();
    await page.locator('#sheet').waitFor({ state: 'hidden' });
    assert.deepEqual(await page.evaluate(() => [__ville.state.coins, __ville.state.stats.ok]), [42e6, 3]);
    assert.equal(plain(await page.locator('#toast').innerText()), 'Sauvegarde restaurée et enregistrée.');
    assert.ok(Math.abs(await page.evaluate(() => Date.now()) - await backupAt(page)) < 60000, 'la restauration est datée de maintenant');
    assert.equal(await page.locator('#remind').isHidden(), true);
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    assert.deepEqual(await page.evaluate(() => [__ville.state.coins, __ville.state.stats.ok]), [42e6, 3]);
    assert.equal(await page.locator('#remind').isHidden(), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Restauration : une ville reprise depuis Réglages compte comme une sauvegarde faite sur cet appareil, sans rappel tout de suite';
}

// Les récapitulatifs du mois et de l'année portent « Sauvegarder ma ville », entre « Partager l'image » et « Fermer » : la sauvegarde est à portée de
// main juste après un beau moment. Le clic fait la sauvegarde de Réglages → Sauvegarde : un téléchargement (la feuille de partage sur iPhone), le message
// qui le dit, la date de la dernière sauvegarde, et le rappel de sauvegarde qui disparaît ; la feuille reste ouverte. Le récapitulatif d'octobre 2026
// s'ouvre de lui-même le 2 novembre, celui de 2026 le 4 janvier 2027 (filledWeek : une ville née en mai, des séances en octobre, jamais sauvegardée).
const RECAP = { month: { day: '2026-11-02T09:00:00Z', title: 'Octobre 2026', file: 'ville-du-bien-etre-2026-11-02.txt' },
  year: { day: '2027-01-04T09:00:00Z', title: '2026', file: 'ville-du-bien-etre-2027-01-04.txt' } };
async function recapTown(browser, baseURL, { kind = 'month', lang = 'fr', iphone = false, viewport = { width: 390, height: 844 } } = {}) {
  const seed = { ...filledWeek(), settings: { lang }, updatedAt: Date.parse('2026-10-31T10:00:00Z'),
    rituals: { week: '9999-12-31', month: kind === 'month' ? '' : '9999-12', year: kind === 'year' ? '' : '9999' } };
  const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, locale: lang === 'en' ? 'en-US' : 'fr-FR', timezoneId: 'Europe/Zurich',
    ...(iphone && { userAgent: IPHONE_UA }) });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(new Date(RECAP[kind].day));
  await page.addInitScript(state => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('ville-bien-etre/v2', JSON.stringify(state));
  }, seed);
  // Sur iPhone le bouton ouvre la feuille de partage : un faux navigator.share garde ce qu'on lui donne.
  if (iphone) await page.addInitScript(() => { navigator.canShare = () => true; navigator.share = async data => { window.__shared = data; }; });
  await page.goto(baseURL);
  await page.waitForFunction(() => !!window.__ville);
  await page.locator('#sheet').waitFor();
  return { context, page, errors };
}
async function recapBackupButton(browser, baseURL) {
  const chromium = browser.browserType().name() === 'chromium';
  const FR = ["Partager l'image", 'Sauvegarder ma ville', 'Fermer'], EN = ['Share the picture', 'Back up my town', 'Close'];
  const actions = page => page.locator('#sheetBody .review-actions button');
  const save = page => page.locator('#sheetBody').getByRole('button', { name: 'Sauvegarder ma ville', exact: true });
  // Le message, lu à l'instant où il apparaît (il disparaît seul au bout de quelques secondes) : son texte entier.
  const toasted = async (page, text) => plain(await (await page.waitForFunction(text => {
    const toast = document.querySelector('#toast');
    return !toast.hidden && toast.textContent.includes(text) && toast.textContent;
  }, text)).jsonValue());
  {
    // Le mois : le bouton à sa place, puis son clic.
    const { context, page, errors } = await recapTown(browser, baseURL);
    try {
      assert.equal(await page.locator('#sheetTitle').innerText(), RECAP.month.title);
      assert.deepEqual(await actions(page).allInnerTexts(), FR);
      // Une ville qui a des séances, jamais sauvegardée depuis cet appareil : le rappel est affiché sous la feuille.
      assert.equal(await backupAt(page), 0);
      assert.equal(await page.locator('#remind').isVisible(), true);
      if (chromium) {
        const [download] = await Promise.all([page.waitForEvent('download'), save(page).click()]);
        assert.equal(download.suggestedFilename(), RECAP.month.file);
        assert.match(await fs.readFile(await download.path(), 'utf8'), /^VBE2\.[\w-]+\.[0-9a-z]+$/, 'le fichier est une sauvegarde');
      } else await save(page).click();
      assert.equal(await toasted(page, 'Téléchargement demandé'), 'Téléchargement demandé. Conserve le fichier de sauvegarde.');
      // Comme toute sauvegarde : sa date est rangée, et le rappel disparaît. La feuille reste ouverte, avec ses trois gestes.
      assert.ok(await backupAt(page) > 0, 'la date de la sauvegarde est rangée');
      assert.equal(await page.locator('#remind').isHidden(), true, 'le rappel de sauvegarde disparaît');
      assert.equal(await page.locator('#sheet').isVisible(), true);
      assert.deepEqual(await actions(page).allInnerTexts(), FR);
      // Chromium donne le focus au bouton cliqué, et la Ville qui se redessine sous la feuille ne le lui retire pas (WebKit ne focalise pas un bouton cliqué).
      if (chromium) assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Sauvegarder ma ville');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  {
    // Sur iPhone : la feuille de partage reçoit un fichier texte daté, qui est une sauvegarde ; elle compte aussi.
    const { context, page, errors } = await recapTown(browser, baseURL, { iphone: true });
    try {
      assert.equal(await page.locator('#remind').isVisible(), true);
      await save(page).click();
      await page.waitForFunction(() => !!window.__shared);
      const shared = await page.evaluate(async () => { const [file] = window.__shared.files; return { count: window.__shared.files.length, name: file.name, type: file.type, text: await file.text() }; });
      assert.deepEqual([shared.count, shared.name, shared.type], [1, RECAP.month.file, 'text/plain']);
      assert.match(shared.text, /^VBE2\.[\w-]+\.[0-9a-z]+$/, 'le fichier est une sauvegarde');
      assert.equal(await toasted(page, 'Partage terminé'), 'Partage terminé. Vérifie que tu as conservé la sauvegarde.');
      assert.ok(await backupAt(page) > 0);
      assert.equal(await page.locator('#remind').isHidden(), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  {
    // L'année : le même bouton, le même geste.
    const { context, page, errors } = await recapTown(browser, baseURL, { kind: 'year' });
    try {
      assert.equal(await page.locator('#sheetTitle').innerText(), RECAP.year.title);
      assert.match(await page.locator('#sheetBody').innerText(), /Ton année en un coup d'œil/);
      assert.deepEqual(await actions(page).allInnerTexts(), FR);
      await save(page).click();
      await toasted(page, 'Téléchargement demandé');
      assert.ok(await backupAt(page) > 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  // À 320 px, en français et en anglais, les trois gestes tiennent dans la feuille.
  for (const [lang, labels] of [['fr', FR], ['en', EN]]) {
    const { context, page, errors } = await recapTown(browser, baseURL, { lang, viewport: { width: 320, height: 568 } });
    try {
      assert.equal(await page.evaluate(() => document.documentElement.lang), lang);
      assert.deepEqual(await actions(page).allInnerTexts(), labels);
      await assertFits(page, ['#sheet', '#sheetBody .review-actions button'], 320, `le récapitulatif en ${lang} à 320 px`);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return "Récapitulatifs : « Sauvegarder ma ville » entre « Partager l'image » et « Fermer », une vraie sauvegarde comptée (téléchargement, ou feuille de partage sur iPhone), tient à 320 px";
}

// Le lien d'un ami, ouvert par un nouveau venu. Quelqu'un qui n'a encore rien lancé reçoit le lien de la ville de Léa (leaCode : six éléments, un
// terrain de 7×7) : la visite s'ouvre en grand au démarrage. Sous le nom et la taille, une ligne dit ce qu'est ce jeu ; la barre offre « Faire
// grandir ma ville » (le bouton principal, qui ferme la visite), garde « Garder la carte postale » en second et cache « Partager ma ville en
// retour » (rien à partager encore). Que la visite se ferme par ce bouton, la croix, Échap ou le geste retour, le focus va au bouton principal
// de l'accueil, ou à « Lancer une activité » si l'accueil a été fermé. Une ville qui a des séances voit la visite de toujours.
const FRIEND = {
  fr: { meta: '6 éléments · terrain 7×7', pitch: 'Cette ville grandit avec de vrais moments : lire, bouger, respirer, ranger, créer.',
    grow: 'Faire grandir ma ville', keep: 'Garder la carte postale', share: 'Partager ma ville en retour' },
  en: { meta: '6 items · 7×7 land', pitch: 'This town grows with real moments: reading, moving, breathing, tidying, creating.',
    grow: 'Grow my own town', keep: 'Keep the postcard', share: 'Share my town back' },
};
const FRIEND_SIZE = 7;
// Les lignes de la tête de la visite (classe, texte) et les boutons de sa barre (affiché ou non, couleur, texte), tels que la page les montre.
const visitHeadLines = page => page.locator('#cityVisitHead p').evaluateAll(lines => lines.map(line => [line.className, line.textContent.replace(/\s+/g, ' ')]));
const visitBarButtons = page => page.locator('#cityVisitBar button').evaluateAll(buttons => buttons.map(button => ({ id: button.id,
  shown: button.getClientRects().length > 0, text: button.textContent.replace(/\s+/g, ' ').trim(),
  tone: button.classList.contains('btn-primary') ? 'primary' : button.classList.contains('btn-secondary') ? 'secondary' : '' })));
// Pour un nouveau venu : le nom, la taille, puis la ligne ; « Faire grandir ma ville » en principal, « Garder la carte postale » en second, et
// plus de « Partager ma ville en retour ». Pour une ville qui a des séances, la visite de toujours : ni ligne, ni « Faire grandir ma ville ».
const newcomerHead = lang => [['visit-name', 'Léa'], ['visit-meta', FRIEND[lang].meta], ['visit-meta visit-pitch', FRIEND[lang].pitch]];
const ordinaryHead = lang => newcomerHead(lang).slice(0, 2);
const newcomerBar = lang => [{ id: 'visitGrow', shown: true, text: FRIEND[lang].grow, tone: 'primary' }, { id: 'visitKeep', shown: true, text: FRIEND[lang].keep, tone: 'secondary' },
  { id: 'visitShare', shown: false, text: FRIEND[lang].share, tone: 'secondary' }];
const ordinaryBar = lang => [{ id: 'visitGrow', shown: false, text: FRIEND[lang].grow, tone: 'primary' }, { id: 'visitKeep', shown: true, text: FRIEND[lang].keep, tone: 'primary' },
  { id: 'visitShare', shown: true, text: FRIEND[lang].share, tone: 'secondary' }];
// Pour sa propre ville, nouveau venu ou non : la barre de toujours, sans carte postale à garder (on ne garde pas sa propre ville).
const ownBar = lang => [{ id: 'visitGrow', shown: false, text: FRIEND[lang].grow, tone: 'primary' }, { id: 'visitKeep', shown: false, text: FRIEND[lang].keep, tone: 'primary' },
  { id: 'visitShare', shown: true, text: FRIEND[lang].share, tone: 'secondary' }];
// L'élément est entièrement dans la zone qui défile (#main, entre l'en-tête et la barre d'onglets) : la personne le voit.
const inView = (page, selector) => page.evaluate(selector => {
  const box = document.querySelector(selector).getBoundingClientRect(), area = document.querySelector('#main').getBoundingClientRect();
  return box.top >= area.top && box.bottom <= area.bottom;
}, selector);

// Une ville neuve ouverte sur le lien d'un ami (le fragment #ville=…, comme dans un message) : la visite s'ouvre au démarrage. Contrairement à
// freshTown, la page se charge sur le lien. closedWelcome : l'accueil a déjà été fermé sur cet appareil (LS_WELCOME), ce que la page doit savoir
// avant son chargement. lang : la langue du navigateur, que la ville suit.
async function friendTown(browser, baseURL, code, { lang = 'fr', closedWelcome = false, ...options } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: lang === 'en' ? 'en-US' : 'fr-FR',
    timezoneId: 'Europe/Zurich', ...options });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date(NOW) });
  await page.addInitScript(closed => {
    window.__VILLE_DEBUG__ = true;
    if (closed) localStorage.setItem('ville-bien-etre/v1:welcome-closed', '1');
  }, closedWelcome);
  await page.goto(baseURL.replace(/#.*$/, '') + '#ville=' + code);
  await page.waitForFunction(() => !!window.__ville);
  await page.locator('#cityBig').waitFor();
  return { context, page, errors };
}
// Un lien reçu quand l'app est déjà ouverte : la Ville est défilée jusqu'en bas (son accueil est alors hors de vue, sous la visite) et rien n'a le
// focus (le point de départ d'un lien ouvert au démarrage) ; la visite s'ouvre.
async function receiveFriendLink(page, code) {
  await page.evaluate(() => { document.querySelector('#main').scrollTop = 1e5; document.activeElement.blur(); });
  await page.evaluate(code => { location.hash = '#ville=' + code; }, code);
  await page.locator('#cityBig').waitFor();
}
// La ville de l'ami tient entre la tête et la barre, dans la largeur, sans que l'une couvre l'autre ; et mesurée de nouveau (la vue redimensionnée),
// elle reste où elle est : la mise en page avait déjà vu la tête (avec sa ligne) et la barre telles qu'elles sont. Pour une visite ouverte une fois
// l'app démarrée : au démarrage, l'observateur de taille de la Ville refait la mise en page à l'image suivante, et corrigerait une mesure trop tôt.
async function assertVisitLayout(page, width, where) {
  const measure = () => page.evaluate(size => {
    const head = document.querySelector('#cityVisitHead').getBoundingClientRect(), bar = document.querySelector('#cityVisitBar').getBoundingClientRect();
    const cell = (x, y) => __ville.City.cellPoint(x, y), tw = 2 * (cell(1, 0)[0] - cell(0, 0)[0]);
    return { headBottom: head.bottom, barTop: bar.top, top: cell(0, 0)[1] - tw / 4, bottom: cell(size - 1, size - 1)[1] + tw / 4,
      left: cell(0, size - 1)[0] - tw / 2, right: cell(size - 1, 0)[0] + tw / 2 };
  }, FRIEND_SIZE);
  const found = await measure();
  assert.ok(found.headBottom <= found.barTop, `${where} : la tête couvre la barre (${found.headBottom} contre ${found.barTop})`);
  assert.ok(found.top >= found.headBottom, `${where} : la ville passe sous la tête (${found.top} contre ${found.headBottom})`);
  assert.ok(found.bottom <= found.barTop, `${where} : la ville passe sous la barre (${found.bottom} contre ${found.barTop})`);
  assert.ok(found.left >= 0 && found.right <= width, `${where} : la ville sort de l'écran (${found.left} à ${found.right} pour ${width})`);
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  assert.deepEqual(await measure(), found, `${where} : la ville bouge quand la vue est mesurée de nouveau`);
}

// Le bouton principal : « Faire grandir ma ville » ferme la visite et amène le focus sur « Commencer par 2 minutes de calme ». Le fragment du lien
// a disparu de l'adresse : un rechargement ne rouvre pas la visite.
async function friendLinkForNewcomer(browser, baseURL) {
  const code = await leaCode(browser, baseURL);
  const { context, page, errors } = await friendTown(browser, baseURL, code);
  try {
    // Une ville sans séance, dont l'accueil attend sous la visite ; l'adresse n'a plus son fragment.
    assert.equal(await page.evaluate(() => __ville.state.stats.ok + __ville.state.stats.ko), 0);
    assert.equal(await page.evaluate(() => !document.querySelector('#welcomeCard').hidden), true);
    assert.equal(await page.evaluate(() => location.hash), '');
    assert.equal(await page.evaluate(() => __ville.City.bigState().visit), true);
    // La tête : le nom, la taille, puis la ligne qui dit ce qu'est ce jeu.
    assert.deepEqual(await visitHeadLines(page), newcomerHead('fr'));
    assert.match(plain(await page.locator('#cityVisitHead').innerText()), /^Léa 6 éléments · terrain 7×7 Cette ville grandit avec de vrais moments/);
    // La barre : « Faire grandir ma ville » d'abord et en principal, « Garder la carte postale » en second, rien pour partager en retour.
    assert.deepEqual(await visitBarButtons(page), newcomerBar('fr'));
    assert.equal(await page.locator('#visitGrow').isVisible(), true);
    assert.equal(await page.locator('#visitShare').isHidden(), true);
    assert.match(await page.locator('#visitKeep').getAttribute('class'), /\bbtn-secondary\b/);
    await page.locator('#visitGrow').click();
    await page.locator('#cityBig').waitFor({ state: 'hidden' });
    // Le bouton ferme comme la croix, par l'historique (history.back, puis popstate) : l'entrée que la vue en grand a posée ne reste pas derrière.
    assert.equal(await page.evaluate(() => !!(history.state && history.state.cityBig)), false);
    assert.equal(await page.evaluate(() => location.hash), '');
    assert.equal(await activeId(page), 'welcomeStart');
    assert.equal(await page.locator('#welcomeCard').isVisible(), true);
    assert.deepEqual(await page.evaluate(() => Object.keys(__ville.state.postcards || {})), [], 'rien n’est gardé');
    // Un rechargement ne rouvre pas la visite.
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    assert.equal(await page.locator('#cityBig').isHidden(), true);
    assert.deepEqual(await page.evaluate(() => [location.hash, __ville.City.bigState().visit]), ['', false]);
    assert.equal(await page.locator('#welcomeCard').isVisible(), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Lien d’un ami, nouveau venu : une ligne sous le nom, « Faire grandir ma ville » en principal, rien à partager en retour ; le bouton ferme la visite et mène à l’accueil';
}

// Échap, la croix et le geste retour mènent aussi à l'accueil, et non à la vue « en grand » de la Ville, où le focus va d'ordinaire. Un lien
// reçu quand l'app est déjà ouverte se comporte de même (rien n'a le focus au départ, comme pour un lien ouvert au démarrage).
async function friendLinkEscape(browser, baseURL) {
  const code = await leaCode(browser, baseURL);
  const { context, page, errors } = await friendTown(browser, baseURL, code);
  try {
    await page.keyboard.press('Escape');
    await page.locator('#cityBig').waitFor({ state: 'hidden' });
    assert.equal(await activeId(page), 'welcomeStart');
    assert.equal(await page.evaluate(() => location.hash), '');
    for (const [how, close] of [['la croix', () => page.locator('#cityBigClose').click()], ['le geste retour', () => page.goBack()], ['Échap', () => page.keyboard.press('Escape')]]) {
      await receiveFriendLink(page, code);
      assert.equal(await inView(page, '#welcomeStart'), false, `${how} : l'accueil est hors de vue, sous la visite`);
      assert.deepEqual(await visitHeadLines(page), newcomerHead('fr'), `${how} : la visite d'un nouveau venu`);
      await assertVisitLayout(page, 390, `la visite rouverte avant ${how}`);
      await close();
      await page.locator('#cityBig').waitFor({ state: 'hidden' });
      assert.equal(await activeId(page), 'welcomeStart', `visite fermée par ${how}`);
      assert.equal(await inView(page, '#welcomeStart'), true, `visite fermée par ${how} : le focus amène le bouton en vue`);
      assert.equal(await page.evaluate(() => location.hash), '', how);
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Lien d’un ami, nouveau venu : Échap, la croix et le geste retour mènent à l’accueil';
}

// L'accueil a été fermé sur cet appareil avant le chargement : la visite est la même, et le focus va à « Lancer une activité ».
async function friendLinkWelcomeClosed(browser, baseURL) {
  const code = await leaCode(browser, baseURL);
  const { context, page, errors } = await friendTown(browser, baseURL, code, { closedWelcome: true });
  try {
    assert.equal(await page.evaluate(() => __ville.state.stats.ok + __ville.state.stats.ko), 0);
    assert.equal(await page.evaluate(() => document.querySelector('#welcomeCard').hidden), true, "l'accueil est fermé");
    assert.deepEqual(await visitHeadLines(page), newcomerHead('fr'));
    assert.deepEqual(await visitBarButtons(page), newcomerBar('fr'));
    await page.locator('#visitGrow').click();
    await page.locator('#cityBig').waitFor({ state: 'hidden' });
    assert.equal(await activeId(page), 'ctaStart');
    assert.equal(await page.evaluate(() => location.hash), '');
    assert.equal(await page.locator('#welcomeCard').isHidden(), true);
    // Échap, pour un lien reçu ensuite : de même.
    await receiveFriendLink(page, code);
    await page.keyboard.press('Escape');
    await page.locator('#cityBig').waitFor({ state: 'hidden' });
    assert.equal(await activeId(page), 'ctaStart');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Lien d’un ami, nouveau venu, accueil fermé : le focus va à « Lancer une activité »';
}

// Une ville qui a des séances (amorcée par sessionTown : une séance comptée, un historique vide) voit la visite de toujours : le nom et la
// taille sans autre ligne, « Garder la carte postale » en principal, « Partager ma ville en retour », pas de « Faire grandir ma ville ». Fermée,
// elle laisse le focus où il allait (la vue « en grand » de la Ville). Les tests de visite de rituals-browser.cjs, ancrés sur la tête, passent
// toujours.
async function friendLinkUnchanged(browser, baseURL) {
  const code = await leaCode(browser, baseURL);
  const { context, page, errors } = await sessionTown(browser);
  try {
    await page.goto(baseURL.replace(/#.*$/, '') + '#ville=' + code);
    await page.waitForFunction(() => !!window.__ville);
    await page.locator('#cityBig').waitFor();
    assert.deepEqual(await page.evaluate(() => [__ville.state.stats.ok + __ville.state.stats.ko, __ville.state.history.length]), [1, 0]);
    assert.deepEqual(await visitHeadLines(page), ordinaryHead('fr'));
    assert.match(await page.locator('#cityVisitHead').innerText(), /^Léa\s+6 éléments · terrain 7×7$/);
    assert.deepEqual(await visitBarButtons(page), ordinaryBar('fr'));
    assert.equal(await page.locator('#visitGrow').isHidden(), true);
    assert.equal(await page.locator('#visitShare').isVisible(), true);
    assert.match(await page.locator('#visitKeep').getAttribute('class'), /\bbtn-primary\b/);
    await page.locator('#cityBigClose').click();
    await page.locator('#cityBig').waitFor({ state: 'hidden' });
    assert.equal(await activeId(page), 'cityExpand');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Lien d’un ami, ville avec des séances : la visite de toujours, sans ligne ni « Faire grandir ma ville »';
}

// La barre est refaite à chaque ouverture : un nouveau venu qui fait sa première séance (le chemin que « Faire grandir ma ville » ouvre) et
// reçoit ensuite un lien trouve la visite de toujours, sans ligne, sans « Faire grandir ma ville », et sans crochet de focus resté de la visite d'avant.
async function friendLinkAfterFirstSession(browser, baseURL) {
  const code = await leaCode(browser, baseURL);
  const { context, page, errors } = await friendTown(browser, baseURL, code);
  try {
    assert.deepEqual(await visitBarButtons(page), newcomerBar('fr'));
    await page.locator('#visitGrow').click();
    await page.locator('#cityBig').waitFor({ state: 'hidden' });
    await page.locator('#welcomeStart').click();
    await confirmStart(page);
    await page.clock.runFor('02:03');
    await result(page).waitFor();
    await backToCity(page);
    assert.equal(await page.evaluate(() => __ville.state.stats.ok + __ville.state.stats.ko), 1);
    await receiveFriendLink(page, code);
    assert.deepEqual(await visitHeadLines(page), ordinaryHead('fr'));
    assert.deepEqual(await visitBarButtons(page), ordinaryBar('fr'));
    await page.locator('#cityBigClose').click();
    await page.locator('#cityBig').waitFor({ state: 'hidden' });
    assert.equal(await activeId(page), 'cityExpand');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Lien d’un ami : après la première séance, la visite redevient celle de toujours';
}

// Le nouveau venu garde la carte postale de Léa (« Gardée » : une carte postale n'est pas une séance). Ouverte depuis le carnet, la visite
// est toujours la sienne (ligne, « Faire grandir ma ville »), mais sa fermeture rouvre le carnet sur la carte : le retour que la carte
// demande passe avant celui du nouveau venu.
async function friendLinkCarnetBack(browser, baseURL) {
  const code = await leaCode(browser, baseURL);
  const { context, page, errors } = await friendTown(browser, baseURL, code);
  try {
    await page.locator('#visitKeep').click();
    await page.locator('#toast').getByText('Carte postale gardée dans ton carnet').waitFor();
    assert.equal(await page.locator('#visitKeep').innerText(), 'Gardée');
    assert.equal(await page.evaluate(() => __ville.state.stats.ok + __ville.state.stats.ko), 0);
    await page.locator('#cityBigClose').click();
    await page.locator('#cityBig').waitFor({ state: 'hidden' });
    assert.equal(await activeId(page), 'welcomeStart');
    const card = await page.evaluate(() => Object.keys(__ville.state.postcards)[0]);
    await page.locator('[data-tab="journal"]').click();
    await page.locator('#carnetCard').getByRole('button', { name: 'Ouvrir le carnet', exact: true }).click();
    await page.locator('#sheetBody').getByRole('radio', { name: 'Visites', exact: true }).click();
    await page.locator('#sheetBody .carnet-postcard').first().click();
    await page.locator('#cityBig').waitFor();
    assert.deepEqual(await visitHeadLines(page), newcomerHead('fr'));
    assert.deepEqual(await visitBarButtons(page), newcomerBar('fr'));
    // « Gardée » est redevenu « Garder la carte postale » avant la mise en page, qui mesure la barre (une ligne de boutons avec le mot court, deux
    // avec le libellé entier) : la ville ne bouge pas quand la vue est mesurée de nouveau.
    await assertVisitLayout(page, 390, 'la visite rouverte depuis le carnet');
    await page.keyboard.press('Escape');
    await page.locator('#cityBig').waitFor({ state: 'hidden' });
    await page.locator('#sheet').waitFor();
    await page.waitForTimeout(100);   // le titre du carnet rouvert ne reprend pas le focus 30 ms plus tard
    assert.equal(await page.evaluate(() => document.activeElement.dataset.focusKey), 'postcard:' + card);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Lien d’un ami, nouveau venu : une visite ouverte depuis le carnet rouvre le carnet, sur la carte postale';
}

// À 320 px, en français et en anglais, la tête (avec sa ligne, qui passe sur plusieurs lignes), la barre et la ville tiennent à l'écran.
async function friendLinkFits320(browser, baseURL) {
  const code = await leaCode(browser, baseURL);
  for (const lang of ['fr', 'en']) {
    const where = `en ${lang} à 320 px`;
    const { context, page, errors } = await friendTown(browser, baseURL, code, { lang, viewport: { width: 320, height: 568 } });
    try {
      assert.equal(await page.evaluate(() => document.documentElement.lang), lang);
      assert.deepEqual(await visitHeadLines(page), newcomerHead(lang));
      assert.deepEqual(await visitBarButtons(page), newcomerBar(lang));
      await assertFits(page, ['#cityVisitHead', '#cityVisitHead p', '#cityVisitBar button'], 320, `la visite ${where}`);
      await page.locator('#visitGrow').click();
      await page.locator('#cityBig').waitFor({ state: 'hidden' });
      assert.equal(await activeId(page), 'welcomeStart');
      // Un lien reçu ensuite : la visite s'ouvre déjà bien mise en page.
      await receiveFriendLink(page, code);
      await assertFits(page, ['#cityVisitHead', '#cityVisitHead p', '#cityVisitBar button'], 320, `la visite rouverte ${where}`);
      await assertVisitLayout(page, 320, `la visite rouverte ${where}`);
      await page.keyboard.press('Escape');
      await page.locator('#cityBig').waitFor({ state: 'hidden' });
      assert.equal(await activeId(page), 'welcomeStart');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return 'Lien d’un ami, nouveau venu : à 320 px, rien ne déborde, en français et en anglais';
}

// Un nouveau venu qui a partagé sa ville et ouvre son propre lien (celui qu'il envoie, et qu'il peut coller dans « Visiter une ville amie ») voit sa
// ville comme ses amis la voient : la visite de toujours pour une ville à soi. Rien de ce qui parle à quelqu'un qui découvre la ville d'un ami : pas
// la ligne qui dit ce qu'est ce jeu, pas de « Faire grandir ma ville » (c'est la sienne), pas de retour à l'accueil : le focus va où il allait.
async function friendLinkOwnTown(browser, baseURL) {
  const { context, page, errors } = await freshTown(browser, baseURL);
  try {
    assert.equal(await page.evaluate(() => __ville.state.stats.ok + __ville.state.stats.ko), 0);
    // Partager sa ville lui donne son identifiant de partage : le lien le porte, et la visite y reconnaît sa propre ville (la ville de départ a six éléments).
    const own = await page.evaluate(() => __ville.share.encode());
    assert.match(await page.evaluate(() => __ville.state.shareId), /^[0-9a-f]{12}$/);
    const ownHead = [['visit-name', 'Ma ville'], ['visit-meta', '6 éléments · terrain 7×7'], ['visit-meta', 'Ta ville, telle que tes amis la voient']];
    await receiveFriendLink(page, own);
    assert.deepEqual(await visitHeadLines(page), ownHead);
    assert.deepEqual(await visitBarButtons(page), ownBar('fr'));
    assert.equal(await page.locator('#visitGrow').isHidden(), true);
    await page.keyboard.press('Escape');
    await page.locator('#cityBig').waitFor({ state: 'hidden' });
    assert.equal(await activeId(page), 'cityExpand');
    // Comme dans l'app : « Partager ma ville » donne le lien, que « Visiter une ville amie » reçoit collé.
    await page.locator('#shareCity').click();
    const link = await page.locator('#shareLinkField').inputValue();
    await page.locator('#visitLinkField').fill(link);
    await page.locator('#sheetBody').getByRole('button', { name: 'Visiter', exact: true }).click();
    await page.locator('#cityBig').waitFor();
    assert.deepEqual(await visitHeadLines(page), ownHead);
    assert.deepEqual(await visitBarButtons(page), ownBar('fr'));
    await page.locator('#cityBigClose').click();
    await page.locator('#cityBig').waitFor({ state: 'hidden' });
    for (const first of ['welcomeStart', 'ctaStart']) assert.notEqual(await activeId(page), first, 'la visite de sa propre ville ne mène pas au premier pas');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return 'Lien d’un ami : un nouveau venu qui ouvre son propre lien voit sa ville comme ses amis la voient, sans la ligne ni « Faire grandir ma ville »';
}

// Les deux images qu'on partage disent où trouver l'app. Le pied du récapitulatif tient en une ligne, « Ville du bien-être · » et l'adresse ; celui de l'image
// de la ville passe à deux lignes, le temps pris pour soi puis l'adresse, dans la même police et la même encre. L'adresse est celle de la page, sans protocole
// ni barre finale (ici elle porte le port du serveur de test, que la page seule connaît). Le titre reste le premier texte de chaque image, et l'adresse ne
// touche rien : tout texte reste dans l'image sans en chevaucher un autre ni la ville, et le canevas n'a pas à resserrer le pied ou l'adresse (un texte plus large
// que sa place est comprimé). L'adresse publique, plus longue que celle des tests, tient elle aussi dans le pied du récapitulatif.
const PUBLIC_ADDRESS = 'lubachma.github.io/ville-du-bien-etre';
// Installé dans la page : note chaque texte écrit et chaque image posée sur un canevas, de quoi savoir où va chaque ligne d'une image.
function spyOnCanvas() {
  const fillText = CanvasRenderingContext2D.prototype.fillText, drawImage = CanvasRenderingContext2D.prototype.drawImage;
  window.__drawn = [];
  CanvasRenderingContext2D.prototype.fillText = function (text, x, y, max) {
    window.__drawn.push({ canvas: this.canvas, text, x, y, max, font: this.font, ink: this.fillStyle, align: this.textAlign, baseline: this.textBaseline, width: this.measureText(text).width });
    return fillText.apply(this, arguments);
  };
  CanvasRenderingContext2D.prototype.drawImage = function (image, ...place) {
    window.__drawn.push({ canvas: this.canvas, picture: place });
    return drawImage.apply(this, arguments);
  };
}
// Le rectangle d'un texte sur son image : sa largeur (resserrée à sa place s'il est plus large), sa hauteur selon sa ligne de base.
const textRect = c => {
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(c.font)[1]), width = Math.min(c.width, c.max || Infinity), left = c.align === 'center' ? c.x - width / 2 : c.x;
  const [top, bottom] = c.baseline === 'middle' ? [c.y - size / 2, c.y + size / 2] : [c.y - size * .8, c.y + size * .25];
  return { name: c.text, left, right: left + width, top, bottom, size };
};
// Tout ce qui est posé sur l'image (textes et ville) reste dedans, et rien n'en touche un autre.
function assertNothingTouches(drawn, [width, height], where) {
  const rects = drawn.map(c => c.picture ? { name: 'la ville', left: c.picture[0], top: c.picture[1], right: c.picture[0] + c.picture[2], bottom: c.picture[1] + c.picture[3] } : textRect(c));
  for (const r of rects) assert.ok(r.left >= 0 && r.right <= width && r.top >= 0 && r.bottom <= height, `${where} : « ${r.name} » sort de l'image (${JSON.stringify(r)} pour ${width}×${height})`);
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      assert.ok(!(a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom), `${where} : « ${a.name} » touche « ${b.name} »`);
    }
  }
}
async function imagesShowAddress(browser, baseURL) {
  const TEXTS = { fr: { title: 'Octobre 2026', city: 'Ma ville', care: / pour prendre soin de moi$/ }, en: { title: 'October 2026', city: 'My town', care: / of self-care$/ } };
  for (const lang of ['fr', 'en']) {
    const texts = TEXTS[lang], where = lang === 'fr' ? 'en français' : 'en anglais';
    const { context, page, errors } = await recapTown(browser, baseURL, { lang });
    try {
      // L'adresse attendue, calculée dans la page : l'hôte et le chemin, sans barre finale.
      const address = await page.evaluate(() => (location.host + location.pathname).replace(/\/+$/, ''));
      assert.match(address, /^127\.0\.0\.1:\d+\/ville-du-bien-etre$/);
      await page.evaluate(spyOnCanvas);
      // Le récapitulatif du mois, sans partage du téléphone (comme la planche) : l'image est téléchargée.
      await page.evaluate(() => { navigator.canShare = () => false; window.__drawn.length = 0; });
      assert.equal(await page.locator('#sheetTitle').innerText(), texts.title);
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#sheetBody').getByRole('button', { name: lang === 'fr' ? "Partager l'image" : 'Share the picture', exact: true }).click()]);
      assert.equal(download.suggestedFilename(), 'mon-mois-2026-10.png');
      const recap = await page.evaluate(() => window.__drawn.filter(c => c.canvas.width === 1080 && c.canvas.height === 1350).map(({ canvas, ...rest }) => rest));
      const recapTexts = recap.filter(c => 'text' in c), footer = recapTexts.filter(c => c.text.includes(address));
      assert.equal(recapTexts[0].text, texts.title, `récapitulatif ${where} : le titre reste le premier texte`);
      assert.deepEqual(footer.map(c => c.text), ['Ville du bien-être · ' + address], `récapitulatif ${where} : une seule ligne de pied, avec l'adresse`);
      assert.notEqual(footer[0].ink, recapTexts[0].ink, `récapitulatif ${where} : le pied est en encre douce, comme le titre est en encre pleine`);
      assert.ok(footer[0].width <= footer[0].max, `récapitulatif ${where} : le pied est comprimé (${footer[0].width} px pour ${footer[0].max})`);
      const publicWidth = await page.evaluate(([font, text]) => { const ctx = document.createElement('canvas').getContext('2d'); ctx.font = font; return ctx.measureText(text).width; },
        [footer[0].font, 'Ville du bien-être · ' + PUBLIC_ADDRESS]);
      assert.ok(publicWidth <= footer[0].max, `récapitulatif ${where} : le pied avec l'adresse publique serait comprimé (${publicWidth} px pour ${footer[0].max})`);
      assertNothingTouches(recap, [1080, 1350], `récapitulatif ${where}`);
      // L'image de la ville : le pied de toujours, puis l'adresse sur une seconde ligne.
      const image = await page.evaluate(async () => {
        window.__drawn.length = 0;
        const out = await __ville.png.canvas();
        return { size: [out.width, out.height], drawn: window.__drawn.filter(c => c.canvas === out).map(({ canvas, ...rest }) => rest) };
      });
      const cityTexts = image.drawn.filter(c => 'text' in c), at = cityTexts.findIndex(c => c.text === address);
      assert.equal(cityTexts[0].text, texts.city, `image de la ville ${where} : le titre reste le premier texte`);
      assert.ok(at > 0, `image de la ville ${where} : l'adresse est écrite après le titre (${JSON.stringify(cityTexts.map(c => c.text))})`);
      const line = cityTexts[at - 1], last = cityTexts[at], picture = image.drawn.find(c => c.picture).picture;
      assert.match(line.text, /^Ville du bien-être · /, `image de la ville ${where} : la ligne du dessus est le pied de toujours`);
      assert.match(line.text, texts.care);
      assert.equal(at, cityTexts.length - 1, `image de la ville ${where} : l'adresse est la dernière ligne`);
      assert.equal(last.font, line.font, `image de la ville ${where} : même police`);
      assert.equal(last.ink, line.ink, `image de la ville ${where} : même encre`);
      assert.notEqual(line.ink, cityTexts[0].ink, `image de la ville ${where} : le pied est en encre douce, comme le titre est en encre pleine`);
      assert.equal(last.x, line.x, `image de la ville ${where} : alignées`);
      const [upper, lower] = [textRect(line), textRect(last)];
      assert.ok(upper.top >= picture[1] + picture[3] + upper.size * .5, `image de la ville ${where} : le pied respire sous la ville`);
      assert.ok(lower.top - upper.bottom >= upper.size * .5, `image de la ville ${where} : les deux lignes respirent`);
      assert.ok(image.size[1] - lower.bottom >= lower.size * .5, `image de la ville ${where} : l'adresse respire au-dessus du bas de l'image`);
      assert.ok(line.width <= line.max && last.width <= last.max, `image de la ville ${where} : le pied n'est pas comprimé`);
      assertNothingTouches(image.drawn, image.size, `image de la ville ${where}`);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return "Images partagées : l'adresse de l'app dans le pied du récapitulatif (une ligne) et de l'image de la ville (une seconde ligne), après le titre, sans rien toucher";
}

const SCENARIOS = [welcomeForNewTown, welcomeCloseStays, welcomeCloseWithoutStorage, welcomeLanguage, welcomeLanguageClosesToast, welcomeChoose,
  welcomeGoneAfterFirstSession, firstCalmBreathes, resumedSessionKeepsBreathing, quietFirstOpen,
  shelterAfterFirstSession, shelterNeverInstalled, shelterHideForGood, shelterCopyRefused, shelterAndroid, shelterFits320,
  pasteFromSafari, pasteNothing, pasteHiddenOutsideApp, pasteFits320, restoreCountsAsBackup, recapBackupButton,
  friendLinkForNewcomer, friendLinkEscape, friendLinkWelcomeClosed, friendLinkUnchanged, friendLinkAfterFirstSession, friendLinkCarnetBack, friendLinkFits320,
  friendLinkOwnTown, imagesShowAddress];
async function runPremiersPas(browser, baseURL) {
  const scenarios = [];
  for (const scenario of SCENARIOS) scenarios.push(await scenario(browser, baseURL));
  return { scenarios };
}

module.exports = { runPremiersPas, SCENARIOS, IPHONE_UA, freshTown };
