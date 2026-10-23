const assert = require('node:assert/strict');

// Mots français qui ne doivent apparaître nulle part quand la ville est en anglais.
const FRENCH = ['Lancer une activité', 'Je ne sais pas quoi faire', 'Réglages', 'Construire', 'Prochain déblocage', 'Envies',
  'Obligations', 'Tirage au sort', 'Sauvegarde', 'Langue', 'Personnaliser', 'Commencer'];

// Texte visible et attributs lus par les lecteurs d'écran, sur toute la page.
function pageText(page) {
  return page.evaluate(() => {
    const attrs = [...document.querySelectorAll('[aria-label], [placeholder], [title]')]
      .flatMap(el => ['aria-label', 'placeholder', 'title'].map(name => el.getAttribute(name) || ''));
    return [document.body.innerText, ...attrs].join('\n');
  });
}
async function assertEnglish(page, where) {
  const text = await pageText(page);
  const found = FRENCH.filter(word => text.includes(word));
  assert.deepEqual(found, [], 'texte français dans ' + where);
}
async function openSettings(page) {
  if (await page.locator('#sheet').isVisible()) await page.locator('#sheetClose').click();
  await page.locator('#settingsBtn').click();
  await page.locator('#settingsLang').waitFor();
}
async function chooseLang(page, label) {
  await openSettings(page);
  await page.locator('#settingsLang').getByRole('radio', { name: label, exact: true }).click();
  await page.waitForFunction(name => [...document.querySelectorAll('#settingsLang [role="radio"]')]
    .some(radio => radio.textContent === name && radio.getAttribute('aria-checked') === 'true'), label);
}

async function runI18n(browser, baseURL) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-US' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(baseURL);
    await page.waitForFunction(() => !!window.__ville);

    // Une ville neuve suit la langue du navigateur.
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    assert.equal(await page.locator('.brand-name').innerText(), 'My town');
    assert.equal(await page.evaluate(() => window.__ville.state.activities[0].name), 'Reading');
    for (const tab of ['ville', 'activites', 'tirage', 'journal']) {
      await page.locator(`[data-tab="${tab}"]`).click();
      await assertEnglish(page, 'la vue ' + tab);
    }
    await openSettings(page);
    await assertEnglish(page, 'les réglages');
    // Sections dans l'ordre de la conception.
    const sections = () => page.evaluate(() => ({
      ids: [...document.querySelectorAll('#sheetBody > .settings-section')].map(s => s.id),
      titles: [...document.querySelectorAll('#sheetBody .section-title')].map(s => s.textContent),
    }));
    const ORDER = ['settingsStart', 'settingsLang', 'settingsSessions', 'settingsStreak', 'settingsWeek', 'settingsRituals', 'settingsCompanion', 'settingsTheme',
      'settingsStrict', 'settingsBackup', 'settingsReset'];
    assert.deepEqual(await sections(), { ids: ORDER, titles: ['Language', 'Grace period', 'Streak', 'Week and reminder', 'Rituals', 'Companion', 'Appearance', 'Strict mode', 'Backup'] });
    await page.locator('#sheetClose').click();
    await page.locator('[data-tab="ville"]').click();
    await page.locator('#buildBtn').click();
    await assertEnglish(page, 'la boutique');
    await page.locator('#sheetClose').click();
    await page.locator('[data-tab="activites"]').click();
    await page.getByRole('button', { name: /^Reading/ }).click();
    await assertEnglish(page, 'le lancement d’une activité');
    await page.locator('#sheetClose').click();

    // Les textes anglais tiennent dans l'écran : réglages, boutique et lancement d'une activité ouverts.
    const launch = () => page.locator('[data-tab="activites"]').click().then(() => page.getByRole('button', { name: /^Reading/ }).click());
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
      for (const open of [() => openSettings(page), () => page.locator('[data-tab="ville"]').click().then(() => page.locator('#buildBtn').click()), launch]) {
        await open();
        const widths = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, inner: innerWidth,
          body: document.querySelector('#sheetBody').scrollWidth, client: document.querySelector('#sheetBody').clientWidth }));
        assert.ok(widths.doc <= widths.inner, `la page déborde à ${width} px`);
        assert.ok(widths.body <= widths.client + 1, `la fenêtre déborde à ${width} px`);
        await page.locator('#sheetClose').click();
      }
      // Le carnet tient lui aussi, sur ses quatre onglets.
      await page.locator('[data-tab="journal"]').click();
      await page.getByRole('button', { name: 'Open the notebook', exact: true }).click();
      for (const tab of ['Achievements', 'Collection', 'Sets', 'Visits']) {
        await page.locator('#sheetBody').getByRole('radio', { name: tab, exact: true }).click();
        const widths = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, inner: innerWidth,
          body: document.querySelector('#sheetBody').scrollWidth, client: document.querySelector('#sheetBody').clientWidth }));
        assert.ok(widths.doc <= widths.inner, `la page déborde à ${width} px (${tab})`);
        assert.ok(widths.body <= widths.client + 1, `le carnet déborde à ${width} px (${tab})`);
      }
      await assertEnglish(page, 'le carnet');
      await page.locator('#sheetClose').click();
    }
    await page.setViewportSize({ width: 390, height: 844 });

    // Carte « Garde ta ville à l'abri » en anglais, puis changement de langue en direct. Elle vient après la première séance : la ville en a une.
    await page.locator('[data-tab="ville"]').click();
    await page.evaluate(() => {
      __ville.state.stats.ok = 1;
      __ville.renderAll();
      const e = new Event('beforeinstallprompt', { cancelable: true });
      e.prompt = () => Promise.resolve();
      e.userChoice = Promise.resolve({ outcome: 'dismissed' });
      window.dispatchEvent(e);
    });
    assert.equal(await page.locator('#installTitle').innerText(), 'Keep your town safe');
    await chooseLang(page, 'Français');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'fr');
    assert.deepEqual(await sections(), { ids: ORDER, titles: ['Langue', 'Tolérance de sortie', 'Série', 'Semaine et rappel', 'Rituels', 'Compagnon', 'Apparence', 'Mode strict', 'Sauvegarde'] });
    assert.ok(await page.getByRole('button', { name: 'Lancer une activité', exact: true }).isVisible());
    assert.equal(await page.locator('#installTitle').innerText(), "Garde ta ville à l'abri");
    assert.equal(await page.locator('#addActForm .activity-options summary').textContent(), 'Mode, fréquence et contexte');
    await page.locator('#sheetClose').click();
    await page.locator('[data-tab="tirage"]').click();
    assert.ok(await page.getByText('Ce qui me convient maintenant', { exact: true }).isVisible());
    // « Tout recommencer » garde la langue choisie : la ville est neuve, elle reste lisible.
    await openSettings(page);
    await page.getByRole('button', { name: 'Tout recommencer', exact: true }).click();
    await page.getByRole('button', { name: /^Confirmer\s:\stout effacer/ }).click();
    await page.waitForFunction(() => window.__ville.state.history.length === 0 && !document.querySelector('#sheet:not([hidden])'));
    assert.equal(await page.evaluate(() => window.__ville.state.settings.lang), 'fr');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'fr');

    // La langue choisie reste après un rechargement ; « Automatique » suit le navigateur.
    await chooseLang(page, 'English');
    await page.reload();
    await page.waitForFunction(() => !!window.__ville);
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    assert.ok(await page.getByRole('button', { name: 'Start an activity', exact: true }).isVisible());
    await chooseLang(page, 'Automatic');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    assert.equal(await page.evaluate(() => window.__ville.state.settings.lang), 'auto');

    assert.deepEqual(errors, []);
    return { scenarios: ['Ville neuve en anglais, textes et largeurs', 'Changement de langue en direct, carte d’installation et rechargement'] };
  } finally { await context.close(); }
}
module.exports = { runI18n };
