const assert = require('node:assert/strict');
const { town } = require('./content-browser.cjs');
const { cityAt } = require('./ambient-browser.cjs');

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
      assert.equal(await page.locator('#welcomeClose').getAttribute('aria-label'), "Fermer l'accueil");
      assert.equal(await page.locator('#welcomeLangs').getAttribute('role'), 'group');
      assert.equal(await page.locator('#welcomeLangs').getAttribute('aria-label'), "Langue de l'app");
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

const SCENARIOS = [welcomeForNewTown, welcomeCloseStays, welcomeCloseWithoutStorage, welcomeLanguage, welcomeLanguageClosesToast, welcomeChoose,
  welcomeGoneAfterFirstSession, firstCalmBreathes, resumedSessionKeepsBreathing, quietFirstOpen];
async function runPremiersPas(browser, baseURL) {
  const scenarios = [];
  for (const scenario of SCENARIOS) scenarios.push(await scenario(browser, baseURL));
  return { scenarios };
}

module.exports = { runPremiersPas, SCENARIOS, IPHONE_UA, freshTown };
