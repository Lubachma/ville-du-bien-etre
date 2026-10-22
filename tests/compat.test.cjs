const test = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { storage, lockManager, stateApp } = require('./helpers/state-vm.cjs');

const KEY = 'ville-bien-etre/v2';
const EXPOSE = ['unknownParts', 'graftUnknown', 'normalize'];
const copy = v => JSON.parse(JSON.stringify(v));
const stored = disk => JSON.parse(disk.getItem(KEY));
const NOW = Date.parse('2026-10-17T12:00:00Z');   // horloge murale de stateApp

// Un « document du futur » : l'état par défaut, plus ce qu'une version plus récente aurait écrit et que celle-ci ne connaît pas.
// La case « tx » porte un élément inconnu ici (« serre » existe déjà dans cette version : elle serait gardée).
function future(a) {
  const doc = copy(a.defaultState());
  doc.journalNotes = [{ id: 'n1', text: 'merci' }];
  doc.settings.onboarded = true;
  doc.settings.extra = { a: 1 };
  doc.achievements['nouveau-succes'] = 1.8e12;
  doc.gifts['quest:2026-10-21'] = 1.8e12;
  doc.city.tiles.push({ id: 'tx', item: 'eolienne', x: 6, y: 6, at: 1.8e12, paid: 1e6 });
  doc.activities[0].anchor = 'après le café';
  doc.history = [{ id: 'h1', name: 'Lecture', cat: 'esprit', min: 10, ok: true, reward: 1e6, at: Date.parse('2026-10-16T08:00:00Z'), source: 'direct', mode: 'focus',
    elapsedSec: 600, routineRunId: '', routineStep: 0, returnPct: 0, day: '2026-10-16', note: 'bien' }];
  doc.companion = { species: 'renard', name: 'Roux', since: 1.8e12, minutes: 300, wear: '' };
  return doc;
}
// Toutes les parties inconnues de `doc` sont dans `out`, à l'identique.
function assertKept(out, doc) {
  assert.deepEqual(out.journalNotes, doc.journalNotes);
  assert.equal(out.settings.onboarded, true);
  assert.deepEqual(out.settings.extra, { a: 1 });
  assert.equal(out.achievements['nouveau-succes'], 1.8e12);
  assert.equal(out.gifts['quest:2026-10-21'], 1.8e12);
  assert.deepEqual(out.city.tiles.find(t => t.id === 'tx'), doc.city.tiles.find(t => t.id === 'tx'));
  assert.equal(out.activities.find(x => x.id === doc.activities[0].id).anchor, 'après le café');
  assert.equal(out.history.find(e => e.id === 'h1').note, 'bien');
  assert.deepEqual(out.companion, doc.companion);
}
// Un onglet ouvert sur un stockage qui contient `doc` (un objet, ou le texte tel quel).
function opened(doc, options) {
  const disk = storage();
  disk.setItem(KEY, typeof doc === 'string' ? doc : JSON.stringify(doc));
  const a = stateApp(disk, undefined, options);
  a.init();
  return { disk, a };
}

test('compat : un onglet en retard ne perd rien de ce qu\'il ne connaît pas', () => {
  const doc = future(stateApp());
  const { disk, a } = opened(doc);
  a.api.state.personal.name = 'Lumière';
  assert.equal(a.commit({ silent: true }), true);
  const out = stored(disk);
  assert.equal(out.personal.name, 'Lumière');
  assertKept(out, doc);
  // Rien de tout cela n'entre dans l'état en mémoire.
  const S = a.api.state;
  assert.equal('journalNotes' in S, false);
  assert.equal('nouveau-succes' in S.achievements, false);
  assert.equal(S.city.tiles.some(t => t.id === 'tx'), false);
  assert.equal('onboarded' in S.settings, false);
  assert.equal('quest:2026-10-21' in S.gifts, false);
  assert.equal('anchor' in S.activities[0], false);
  assert.equal('note' in S.history[0], false);
  assert.equal(S.companion, null);
});

test('compat : une valeur posée par cette version l\'emporte', () => {
  const doc = future(stateApp());
  doc.settings.sound = 'fort';
  const { disk, a } = opened(doc);
  assert.equal(a.api.state.settings.sound, true);
  a.api.state.settings.sound = false;
  a.commit({ silent: true });
  let out = stored(disk);
  assert.equal(out.settings.sound, false);
  assert.equal(out.settings.onboarded, true);
  // Un compagnon choisi ici remplace celui que cette version ne connaît pas.
  a.api.state.companion = { species: 'ourson', name: 'Nounours', since: NOW, minutes: 0, wear: '' };
  a.commit({ silent: true });
  out = stored(disk);
  assert.equal(out.companion.species, 'ourson');
  assert.equal(out.settings.onboarded, true);
});

test('compat : rien n\'est repris pour une autre ville, ni après une restauration ou une remise à zéro', () => {
  const doc = future(stateApp());
  const other = opened(doc), city = copy(other.a.defaultState());
  city.createdAt = doc.createdAt - 86400000;
  other.a.api.state = city;
  assert.equal(other.a.commit({ silent: true }), true);
  let out = stored(other.disk);
  assert.equal(out.createdAt, city.createdAt);
  assert.equal('journalNotes' in out, false);
  assert.equal('onboarded' in out.settings, false);
  assert.equal(out.companion, null);

  const same = opened(doc);
  assert.equal(same.a.commit({ silent: true, replace: true }), true);
  out = stored(same.disk);
  assert.equal(out.createdAt, doc.createdAt);
  assert.equal('journalNotes' in out, false);
  assert.equal('nouveau-succes' in out.achievements, false);
  assert.equal(out.city.tiles.some(t => t.id === 'tx'), false);
  assert.equal(out.companion, null);
  // L'écriture suivante n'a plus rien à reprendre.
  same.a.commit({ silent: true });
  assert.equal('journalNotes' in stored(same.disk), false);
});

// Une ville d'un an : 150 entrées de journal, une grille 11 × 11 pleine, les 48 succès, et une année de jours comptés.
function yearCity(a) {
  const doc = copy(a.defaultState()), day = i => new Date(NOW - i * 86400000).toISOString().slice(0, 10);
  const items = ['arbre', 'fleurs', 'chemin', 'banc', 'lampadaire', 'etang', 'maison', 'boulangerie'];
  doc.city = { size: 11, tiles: [] };
  for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) doc.city.tiles.push({ id: 't' + x + '-' + y, item: items[(x + y) % items.length], x, y, at: 1.75e12 + (y * 11 + x) * 6e7, paid: 1e6 });
  doc.history = Array.from({ length: 150 }, (_, i) => ({ id: 'h' + i, name: 'Lecture', cat: a.CAT_ORDER[i % 5], min: 25, ok: i % 9 !== 0, reward: i % 9 ? 2e6 : 0,
    at: NOW - i * 2 * 86400000, source: 'direct', mode: 'focus', elapsedSec: i % 9 ? 1500 : 300, routineRunId: '', routineStep: 0, returnPct: 0, day: day(i * 2), mood: 1 + i % 5 }));
  doc.achievements = Object.fromEntries(a.ACHIEVEMENTS.map((x, i) => [x.id, 1.75e12 + i * 1e8]));
  for (let i = 0; i < 365; i++) {
    doc.stats.days[day(i)] = 30;
    doc.stats.dailyCats[day(i)] = { esprit: 20, corps: 10 };
    doc.stats.effort.days[day(i)] = 32;
    doc.stats.effort.dailyCats[day(i)] = { esprit: 21, corps: 11 };
  }
  return copy(a.normalize(doc));
}

test('compat : coût d\'une ville d\'un an', () => {
  const probe = stateApp(undefined, undefined, { expose: [...EXPOSE, 'ACHIEVEMENTS', 'CAT_ORDER'] }), doc = yearCity(probe);
  assert.equal(doc.history.length, 150);
  assert.equal(doc.city.tiles.length, 121);
  assert.equal(Object.keys(doc.achievements).length, 48);
  const parsed = JSON.parse(JSON.stringify(doc)), times = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    probe.unknownParts(parsed, probe.normalize(parsed));
    times.push(performance.now() - start);
  }
  times.sort((p, q) => p - q);
  assert.ok(times[2] < 30, 'médiane ' + times[2].toFixed(1) + ' ms');

  // Le cas courant n'a aucune partie inconnue : rien à remettre, donc aucune copie de l'état.
  const { a } = opened(doc, { expose: EXPOSE });
  let grafts = 0;
  const graft = a.context.graftUnknown;
  a.context.graftUnknown = (...args) => { grafts++; return graft(...args); };
  assert.equal(a.commit({ silent: true }), true);
  // Relire le texte qu'on vient d'écrire ne recalcule rien.
  const runs = a.Store.unknownRuns;
  assert.ok(runs >= 1);
  assert.equal(a.Store.saveLocal(), true);
  assert.equal(a.Store.unknownRuns, runs);
  assert.equal(grafts, 0);
});

test('compat : lecture, fusion entre onglets, écriture et nouvelle lecture ne perdent rien', () => {
  const doc = future(stateApp()), disk = storage();
  disk.setItem(KEY, JSON.stringify(doc));
  const a = stateApp(disk), b = stateApp(disk);
  a.init(); b.init();
  a.api.state.personal.name = 'Lumière';
  a.commit({ silent: true });
  // B n'a pas encore vu l'écriture de A : sa propre écriture fusionne.
  b.api.state.settings.sound = false;
  b.commit({ silent: true });
  const c = stateApp(disk);
  c.init();
  c.api.state.goals.minutes = 90;
  c.commit({ silent: true });
  const out = stored(disk);
  assert.equal(out.personal.name, 'Lumière');
  assert.equal(out.settings.sound, false);
  assert.equal(out.goals.minutes, 90);
  assertKept(out, doc);
});

test('compat : une séance remplacée ou terminée ici ne revient pas, ni ses champs inconnus', () => {
  // Une séance que cette version ne sait pas lire (domaine inconnu) : gardée tant que rien ne la remplace ici.
  const doc = future(stateApp());
  doc.active = { id: 'xs', name: 'Atelier', cat: 'social', min: 25, startedAt: NOW - 60000, mode: 'focus' };
  const one = opened(doc);
  assert.equal(one.a.api.state.active, null);
  one.a.commit({ silent: true });
  assert.equal(stored(one.disk).active.id, 'xs');
  one.a.api.state.active = { id: 'mine', name: 'Lecture', cat: 'esprit', min: 10, startedAt: NOW, mode: 'focus' };
  one.a.commit({ silent: true });
  assert.equal(stored(one.disk).active.id, 'mine');
  one.a.api.state.active = null;
  one.a.commit({ silent: true });
  assert.equal(stored(one.disk).active, null);
  assert.deepEqual(stored(one.disk).journalNotes, doc.journalNotes);

  // Les champs inconnus d'une séance terminée ne passent pas à la suivante.
  const next = future(stateApp());
  next.active = { id: 'x1', name: 'Lecture', cat: 'esprit', min: 10, startedAt: NOW - 60000, mode: 'focus', pausedMs: 5000 };
  const two = opened(next);
  two.a.commit({ silent: true });
  assert.equal(stored(two.disk).active.pausedMs, 5000);
  two.a.api.state.active = null;
  two.a.commit({ silent: true });
  two.a.api.state.active = { id: 'y1', name: 'Sport', cat: 'corps', min: 20, startedAt: NOW, mode: 'free' };
  two.a.commit({ silent: true });
  assert.equal(stored(two.disk).active.id, 'y1');
  assert.equal('pausedMs' in stored(two.disk).active, false);
});

test('compat : une partie inconnue ne passe qu\'au même objet (même id ou même jour)', () => {
  const steps = [{ activityId: 'a', name: 'Lecture', cat: 'esprit', min: 10, mode: 'focus' }, { activityId: 'b', name: 'Sport', cat: 'corps', min: 10, mode: 'free' }];
  const run = (id, more = {}) => ({ id, routineId: '', name: 'Matin', steps, next: 0, minutes: 0, reward: 0, startedAt: NOW - 60000, finishedAt: 0, ...more });
  const doc = future(stateApp());
  doc.routineRun = run('r1', { tempo: 'lent' });
  doc.townWish = { day: '2026-10-16', tile: doc.city.tiles[0].id, item: 'fleurs', note: 'merci' };
  // La même routine (même id) et le même souhait (même jour), changés ici : leurs champs inconnus restent.
  const same = opened(doc);
  same.a.api.state.routineRun.next = 1;
  same.a.api.state.townWish.skipped = true;
  same.a.commit({ silent: true });
  let out = stored(same.disk);
  assert.equal(out.routineRun.next, 1);
  assert.equal(out.routineRun.tempo, 'lent');
  assert.equal(out.townWish.skipped, true);
  assert.equal(out.townWish.note, 'merci');
  // Une autre routine (autre id) et le souhait du lendemain (autre jour) les remplacent directement : rien n'y passe, que les
  // parties inconnues viennent du texte que cet onglet vient d'écrire ou du document enregistré.
  for (const tab of [same, opened(doc)]) {
    tab.a.api.state.routineRun = run('r2');
    tab.a.api.state.townWish = { day: '2026-10-17', tile: doc.city.tiles[0].id, item: 'banc' };
    tab.a.commit({ silent: true });
    out = stored(tab.disk);
    assert.equal(out.routineRun.id, 'r2');
    assert.equal('tempo' in out.routineRun, false);
    assert.equal(out.townWish.day, '2026-10-17');
    assert.equal('note' in out.townWish, false);
    assertKept(out, doc);
  }
  // Un id ou un jour que cette version ne connaît pas n'est pas une identité : elle ne le pose jamais, rien ne serait gardé.
  const later = future(stateApp());
  later.settings.day = '2026-10-16';
  const tab = opened(later);
  tab.a.commit({ silent: true });
  out = stored(tab.disk);
  assert.equal(out.settings.day, '2026-10-16');
  assert.equal(out.settings.onboarded, true);
});

test('compat : un id invalide ou répété, ou une liste sans id, ne fait pas grandir les listes', () => {
  const doc = future(stateApp());
  // Un id invalide, et une copie de la première activité (même id) : normalize() leur donne un autre id. Les champs inconnus
  // viennent de la première occurrence, celle que normalize() garde sous son id.
  doc.activities.push({ id: 'pas un id !', name: 'Yoga', cat: 'calme', min: 15 }, { ...doc.activities[0], name: 'Copie', anchor: 'autre' });
  doc.routineRun = { id: 'rr', routineId: '', name: 'Matin', next: 0, minutes: 0, reward: 0, startedAt: NOW - 60000, finishedAt: 0,
    steps: [{ id: 's1', activityId: 'a', name: 'Lecture', cat: 'esprit', min: 10, mode: 'focus' }, { id: 's2', activityId: 'b', name: 'Sport', cat: 'corps', min: 10, mode: 'free' }] };
  const disk = storage();
  disk.setItem(KEY, JSON.stringify(doc));
  for (let i = 0; i < 3; i++) {
    const tab = stateApp(disk);
    tab.init();
    tab.api.state.goals.minutes = 60 + i;
    tab.commit({ silent: true });
  }
  const out = stored(disk);
  assert.equal(out.activities.length, doc.activities.length);
  assert.equal(out.activities.filter(x => x.name === 'Yoga').length, 1);
  assert.equal(out.routineRun.steps.length, 2);
  assert.equal(out.city.tiles.filter(t => t.id === 'tx').length, 1);
  assertKept(out, doc);
});

test('compat : les parties inconnues ne vont que dans les places vides', () => {
  const a = stateApp(undefined, undefined, { expose: EXPOSE });
  const raw = { a: 1, gone: { x: 1 }, kept: { x: 2 }, obj: { y: 1, z: 2 }, list: [{ id: 'k', v: 1, w: 9 }, { id: 'u', v: 2 }, { id: 'v', v: 3 }] };
  const known = { gone: null, kept: null, obj: { y: 1 }, list: [{ id: 'k', v: 1 }] };
  const patch = a.unknownParts(raw, known);
  // Ici, `kept` a reçu une valeur, `obj.y` a changé, et un élément d'id « v » existe déjà.
  const target = { gone: null, kept: { mine: true }, obj: { y: 5 }, list: [{ id: 'k', v: 1 }, { id: 'v', v: 30 }] };
  const put = a.graftUnknown(target, patch);
  assert.deepEqual(target, { a: 1, gone: { x: 1 }, kept: { mine: true }, obj: { y: 5, z: 2 }, list: [{ id: 'k', v: 1, w: 9 }, { id: 'v', v: 30 }, { id: 'u', v: 2 }] });
  // Ce qui a été remis, sans ce que cette version a gardé : ce sont les parties inconnues du texte écrit.
  assert.deepEqual(Object.keys(put).sort(), ['a', 'gone', 'list', 'obj']);
  assert.deepEqual(Array.from(put.list.extra, x => x.id), ['u']);
  assert.equal(a.graftUnknown({ gone: { mine: true } }, { gone: patch.gone }), undefined);
});

test('compat : la clé __proto__ est toujours ignorée', () => {
  const doc = future(stateApp());
  const json = JSON.stringify(doc).replace(/^\{/, '{"__proto__":{"polluted":true},').replace('"settings":{', '"settings":{"__proto__":{"grace":20},');
  const { disk, a } = opened(json, { expose: EXPOSE });
  const parsed = JSON.parse(json), patch = a.unknownParts(parsed, a.normalize(parsed));
  // Le patch garde son prototype d'origine, sans rien de la clé __proto__.
  assert.equal(Object.getPrototypeOf(Object.getPrototypeOf(patch)), null);
  assert.equal('polluted' in patch, false);
  a.commit({ silent: true });
  assert.equal(disk.getItem(KEY).includes('__proto__'), false);
  assert.equal(({}).polluted, undefined);
  assert.equal(a.api.state.settings.grace, 10);
  assertKept(stored(disk), doc);
});

test('fusion : une écriture refusée ne compte pas deux fois', () => {
  // Une ville à 100 M, avec un compagnon de 100 min, ouverte dans deux onglets.
  const disk = storage(), a = stateApp(disk), b = stateApp(disk);
  a.init();
  a.api.state.coins = 100e6;
  a.api.state.companion = { species: 'lapin', name: '', since: NOW - 20 * 86400000, minutes: 100, wear: '' };
  a.commit({ silent: true });
  b.init();
  // A achète une case à 15 M et passe 30 min avec son compagnon.
  a.api.state.coins -= 15e6;
  a.api.state.city.tiles.push({ id: 'boul', item: 'boulangerie', x: 0, y: 0, at: NOW, paid: 15e6 });
  a.api.state.companion.minutes += 30;
  assert.equal(a.commit({ silent: true }), true);
  // B n'a pas vu l'écriture de A : il achète une case à 2 M, fusionne avec la version de A, mais son écriture est refusée.
  b.api.state.coins -= 2e6;
  b.api.state.city.tiles.push({ id: 'banc', item: 'banc', x: 6, y: 6, at: NOW, paid: 2e6 });
  disk.fail = true;
  assert.equal(b.commit({ silent: true }), false);
  // L'écriture suivante réussit, sans compter une seconde fois l'achat et la complicité de A.
  disk.fail = false;
  assert.equal(b.commit({ silent: true }), true);
  const out = stored(disk);
  assert.equal(out.coins, 83e6);
  assert.equal(out.companion.minutes, 130);
  assert.deepEqual(out.city.tiles.filter(t => t.paid).map(t => t.id).sort(), ['banc', 'boul']);
});

test('fusion : une remise à zéro faite ailleurs l\'emporte', () => {
  // La ville V : terrain 11, une carte postale, des visiteurs rencontrés et un compagnon, ouverte dans trois onglets.
  const v = copy(stateApp().defaultState()), disk = storage();
  v.createdAt = Date.parse('2025-03-01T09:00:00Z');
  v.city = { size: 11, tiles: v.city.tiles.map(t => ({ ...t, x: t.x + 2, y: t.y + 2 })) };
  v.postcards = { a1b2c3d4e5f6: { code: 'AQcAAAAAAAAAAA', name: 'Amis', size: 7, count: 0, at: Date.parse('2026-09-01T10:00:00Z') } };
  v.visits = { chat: { first: Date.parse('2026-05-01T10:00:00Z'), count: 9, last: '2026-10-16' } };
  v.companion = { species: 'ourson', name: 'Nounours', since: Date.parse('2026-06-01T10:00:00Z'), minutes: 1900, wear: 'cape' };
  disk.setItem(KEY, JSON.stringify(v));
  const a = stateApp(disk), b = stateApp(disk), c = stateApp(disk);
  a.init(); b.init(); c.init();
  // B et C changent chacun quelque chose, mais leurs écritures sont refusées : ces changements ne sont pas encore écrits.
  b.api.state.settings.sound = false;
  c.api.state.personal.name = 'Ancienne ville';
  disk.fail = true;
  assert.equal(b.commit({ silent: true }), false);
  assert.equal(c.commit({ silent: true }), false);
  disk.fail = false;
  // A fait « Tout recommencer » (voir settingsReset) : une ville neuve, écrite telle quelle.
  a.advance(60000);
  a.api.state = a.defaultState();
  assert.equal(a.commit({ silent: true, replace: true }), true);
  const text = disk.getItem(KEY), fresh = JSON.parse(text);
  const assertFresh = s => {
    assert.equal(s.city.size, 7);
    assert.deepEqual(Object.keys(s.postcards), []);
    assert.deepEqual(Object.keys(s.visits), []);
    assert.equal(s.companion, null);
    assert.equal(s.createdAt, fresh.createdAt);
    assert.equal(s.revision, fresh.revision);
  };
  // B reçoit l'écriture de A : la ville neuve l'emporte entière, sans fusion ni écriture.
  b.Store.pullLocal();
  assertFresh(b.api.state);
  assert.equal(b.api.state.settings.sound, true);
  assert.equal(disk.getItem(KEY), text);
  // C écrit à nouveau avant d'avoir vu l'écriture de A : rien n'est écrit, la ville neuve l'emporte aussi, et l'alerte
  // d'écriture impossible s'efface, puisque plus rien n'attend d'être écrit.
  assert.notEqual(c.Store.localError, '');
  c.api.state.goals.minutes = 90;
  assert.equal(c.commit({ silent: true }), true);
  assert.equal(disk.getItem(KEY), text);
  assertFresh(c.api.state);
  assert.equal(c.api.state.personal.name, '');
  assert.equal(c.api.state.goals.minutes, 60);
  assert.equal(c.Store.localError, '');
  // La ville neuve est désormais leur base : un changement suivant s'y écrit.
  b.api.state.personal.name = 'Nouveau départ';
  assert.equal(b.commit({ silent: true }), true);
  const out = stored(disk);
  assert.equal(out.personal.name, 'Nouveau départ');
  assert.equal(out.createdAt, fresh.createdAt);
  assert.equal(out.companion, null);
});

test('fusion : deux onglets neufs gardent la fusion actuelle', () => {
  // Deux onglets ouverts sur un stockage vide, à une milliseconde d'écart : deux villes jamais écrites (lsAt === -1), nées
  // chacune à son heure.
  const disk = storage(), a = stateApp(disk), b = stateApp(disk);
  a.init();
  b.advance(1);
  b.init();
  assert.equal(a.Store.lsAt, -1);
  assert.equal(b.Store.lsAt, -1);
  assert.notEqual(b.api.state.createdAt, a.api.state.createdAt);
  assert.equal(a.commit({ silent: true }), true);
  // B ajoute une envie sans avoir vu l'écriture de A : sa ville jamais écrite n'est pas remplacée, elle se fond dans celle de A.
  b.api.state.wishes.push({ id: 'envie-b', name: 'Peindre', cat: 'crea', min: 20 });
  assert.equal(b.commit({ silent: true }), true);
  const out = stored(disk);
  assert.equal(out.createdAt, a.api.state.createdAt);
  assert.deepEqual(out.city.tiles.map(t => t.id), Array.from(a.api.state.city.tiles, t => t.id));
  assert.ok(out.wishes.some(w => w.id === 'envie-b'));
});

test('fusion : un document sans date de création valide n\'est pas une ville remplacée', () => {
  // normalize() donne l'heure de la lecture à un document sans date de création valide (ville préparée, horloge fausse à sa
  // création) : elle change d'une lecture à l'autre. Ce n'est pas une autre ville, et sa première écriture lui donne une date.
  for (const createdAt of [undefined, 1e9]) {
    const seed = { ...copy(stateApp().defaultState()), createdAt };
    // Une écriture, une seconde après l'ouverture : elle a lieu, puis la suivante aussi.
    const one = opened(seed);
    one.a.advance(1000);
    one.a.api.state.personal.name = 'Lumière';
    assert.equal(one.a.commit({ silent: true }), true);
    assert.equal(stored(one.disk).personal.name, 'Lumière');
    assert.equal(stored(one.disk).createdAt, one.a.api.state.createdAt);
    one.a.advance(1000);
    one.a.api.state.goals.minutes = 90;
    assert.equal(one.a.commit({ silent: true }), true);
    assert.equal(stored(one.disk).goals.minutes, 90);
    // Une relecture avec un changement pas encore écrit (écriture refusée) : il reste, et s'écrit.
    const two = opened(seed);
    two.a.api.state.personal.name = 'Lumière';
    two.disk.fail = true;
    assert.equal(two.a.commit({ silent: true }), false);
    two.disk.fail = false;
    two.a.advance(1000);
    two.a.Store.pullLocal();
    assert.equal(two.a.api.state.personal.name, 'Lumière');
    assert.equal(stored(two.disk).personal.name, 'Lumière');
  }
});

// Deux onglets sur la même ville. A tient une séance libre de 30 min ; B est au repos. afterReplace() travaille au tour de
// minuterie qui suit une relecture : settle() le laisse passer.
const settle = () => new Promise(resolve => setTimeout(resolve, 10));
async function sessionTabs(seed) {
  const disk = storage(), locks = lockManager(), a = stateApp(disk, locks), b = stateApp(disk, locks);
  if (seed) disk.setItem(KEY, JSON.stringify(seed));
  a.init();
  a.commit({ silent: true });
  b.init();
  await a.startSession({ name: 'Marche', cat: 'corps', min: 30, mode: 'free' });
  // B a déjà vu le départ de la séance : seuls les points de reprise suivent.
  b.Store.pullLocal();
  await settle();
  // Un point de reprise de A, 5 s plus tard (le temps de la séance avance avec l'horloge), que B relit aussitôt.
  const beat = () => {
    a.advance(5000);
    b.advance(5000);
    a.api.run.elapsed += 5000;
    a.persistRun(true);
    b.Store.pullLocal();
  };
  return { disk, locks, a, b, beat, checkpoint: async () => { beat(); await settle(); } };
}
// Dans cet onglet : une fenêtre ouverte (le bouchon closeSheet compte les fermetures), une pose en cours (Mode.state) et une case
// choisie (Selection.id).
function showing(tab) {
  const shown = { closed: 0, placement: { kind: 'place' }, tile: 'case-1' };
  tab.context.closeSheet = () => { shown.closed++; };
  tab.context.sheetKeepOnSync = false;
  tab.context.document.querySelector('#sheet').hidden = false;
  tab.context.Mode.state = shown.placement;
  tab.context.Selection.id = shown.tile;
  return shown;
}
const stillShowing = (tab, shown, label) => {
  assert.equal(shown.closed, 0, label);
  assert.equal(tab.context.Mode.state, shown.placement, label);
  assert.equal(tab.context.Selection.id, shown.tile, label);
};
const cleared = (tab, shown, label) => {
  assert.equal(shown.closed, 1, label);
  assert.equal(tab.context.Mode.state, null, label);
  assert.equal(tab.context.Selection.id, null, label);
};

test('onglets : un point de reprise ne ferme pas la fenêtre de l\'autre onglet', async () => {
  const { a, b, checkpoint } = await sessionTabs();
  const shown = showing(b), seen = [];
  for (let i = 0; i < 6; i++) {
    await checkpoint();
    seen.push([b.api.state.active.elapsedSec, b.api.state.active.checkpointAt]);
  }
  // La fenêtre reste ouverte, la pose et la case choisie aussi.
  assert.equal(shown.closed, 0);
  assert.equal(b.context.Mode.state, shown.placement);
  assert.equal(b.context.Selection.id, shown.tile);
  // Et B suit pourtant la séance : le temps et le point de reprise de A, à chaque fois.
  assert.deepEqual(seen, [5, 10, 15, 20, 25, 30].map((sec, i) => [sec, NOW + (i + 1) * 5000]));
  assert.equal(b.api.state.active.id, a.api.state.active.id);
  assert.equal(b.activeState(), 'elsewhere');
});

test('onglets : un autre changement ferme encore la fenêtre et annule la pose, avec ou sans point de reprise', async () => {
  const changes = {
    'un réglage': s => { s.settings.sound = false; },
    'une envie': s => { s.wishes.push({ id: 'envie-a', name: 'Peindre', cat: 'crea', min: 20 }); },
    'des pièces': s => { s.coins += 1e6; },
    'un objectif': s => { s.goals.minutes = 90; },
  };
  for (const [name, change] of Object.entries(changes)) {
    // Le changement part avec le point de reprise de A.
    const one = await sessionTabs(), withBeat = showing(one.b);
    change(one.a.api.state);
    await one.checkpoint();
    cleared(one.b, withBeat, name);
    // Il n'y a plus rien de spécial ensuite : le point de reprise suivant, seul, laisse de nouveau tout en place.
    const again = showing(one.b);
    await one.checkpoint();
    stillShowing(one.b, again, name + ', puis un point de reprise');
    // Le changement part seul, sans nouveau point de reprise.
    const two = await sessionTabs(), alone = showing(two.b);
    change(two.a.api.state);
    two.a.commit({ silent: true });
    two.b.Store.pullLocal();
    await settle();
    cleared(two.b, alone, name + ', seul');
  }
});

test('onglets : la fin de la séance ferme encore la fenêtre et annule la pose', async () => {
  const { a, b, checkpoint } = await sessionTabs();
  const shown = showing(b);
  await checkpoint();
  stillShowing(b, shown, 'en cours');
  await a.failSession('abandon', 0);
  b.Store.pullLocal();
  await settle();
  assert.equal(b.api.state.active, null);
  assert.equal(b.api.state.history.length, 1);
  cleared(b, shown, 'fin');
});

test('onglets : un point de reprise et un vrai changement du même tour ferment la fenêtre, dans les deux ordres', async () => {
  for (const order of ['reprise puis changement', 'changement puis reprise']) {
    const { a, b, beat } = await sessionTabs();
    const shown = showing(b), change = () => { a.api.state.settings.sound = false; a.advance(1000); b.advance(1000); a.persistRun(true); b.Store.pullLocal(); };
    if (order === 'reprise puis changement') { beat(); change(); } else { change(); beat(); }
    // Rien n'a encore été refait : une seule fermeture, à la fin du tour.
    assert.equal(shown.closed, 0, order);
    await settle();
    cleared(b, shown, order);
  }
});

test('onglets : un point de reprise fusionné avec un changement pas encore écrit laisse aussi la fenêtre', async () => {
  const { disk, b, checkpoint } = await sessionTabs();
  const shown = showing(b);
  // B a un changement que le stockage a refusé : sa version n'est pas celle de sa base, la relecture fusionne.
  b.api.state.settings.sound = false;
  disk.fail = true;
  assert.equal(b.commit({ silent: true }), false);
  disk.fail = false;
  await checkpoint();
  stillShowing(b, shown, 'fusion');
  assert.equal(b.api.state.settings.sound, false);
  assert.equal(b.api.state.active.elapsedSec, 5);
  assert.equal(stored(disk).settings.sound, false);
  assert.equal(stored(disk).active.elapsedSec, 5);
});

test('onglets : le point de reprise qui suit un changement fait ici ne ferme pas non plus la fenêtre', async () => {
  const { b, checkpoint } = await sessionTabs();
  const shown = showing(b);
  // Une activité ajoutée telle que l\'interface la pose (sans ses champs par défaut), écrite aussitôt : l\'onglet A la fusionne à son
  // point de reprise suivant, et B relit sa propre activité sous sa forme complète.
  b.api.state.activities.push({ id: 'yoga', name: 'Yoga', cat: 'calme', min: 15 });
  assert.equal(b.commit({ silent: true }), true);
  await checkpoint();
  stillShowing(b, shown, 'après un ajout');
  assert.deepEqual(copy(b.api.state.activities.find(x => x.id === 'yoga')), { id: 'yoga', name: 'Yoga', cat: 'calme', min: 15, mode: 'focus', energy: 'medium', place: 'any', repeat: 'always', completedAt: 0 });
  assert.equal(b.api.state.active.elapsedSec, 5);
});

test('onglets : le point de reprise reste léger avec les parties inconnues d\'une version plus récente', async () => {
  const doc = future(stateApp());
  const { disk, b, checkpoint } = await sessionTabs(doc);
  const shown = showing(b);
  for (let i = 0; i < 3; i++) await checkpoint();
  stillShowing(b, shown, 'parties inconnues');
  assert.equal(b.api.state.active.elapsedSec, 15);
  // Et chaque point de reprise écrit les parties inconnues avec le reste.
  assertKept(stored(disk), doc);
});

test('onglets : une ville remplacée ailleurs ferme encore la fenêtre et annule la pose', async () => {
  const disk = storage(), a = stateApp(disk), b = stateApp(disk);
  a.init();
  a.commit({ silent: true });
  b.init();
  const shown = showing(b);
  // A fait « Tout recommencer » : une ville neuve, écrite telle quelle. B l\'adopte entière.
  a.advance(60000);
  b.advance(60000);
  a.api.state = a.defaultState();
  assert.equal(a.commit({ silent: true, replace: true }), true);
  b.Store.pullLocal();
  assert.equal(b.api.state.createdAt, a.api.state.createdAt);
  await settle();
  cleared(b, shown, 'ville remplacée');
});

test('onglets : une ville jugée remplacée n\'est jamais légère, même si seule la séance y diffère', async () => {
  const { b, checkpoint } = await sessionTabs();
  const shown = showing(b);
  // La base de B garde une autre date de création que sa ville : pour lui, le document relu est celui d\'une autre ville.
  b.Store.lsBase.createdAt -= 1000;
  await checkpoint();
  cleared(b, shown, 'ville remplacée');
  assert.equal(b.api.state.active.elapsedSec, 5);
});

test('onglets : un propriétaire changé ailleurs arrête toujours le chrono d\'ici, sans fermer la fenêtre', async () => {
  const { disk, a } = await sessionTabs();
  const shown = showing(a);
  assert.ok(a.api.run);
  // Un autre onglet reprend la séance, et il bat : seuls le propriétaire, le point de reprise et la révision changent.
  const doc = stored(disk);
  doc.active.owner = 'onglet-c';
  doc.active.checkpointAt += 1000;
  doc.updatedAt += 1000;
  doc.revision = 'rev-c';
  disk.setItem(KEY, JSON.stringify(doc));
  disk.setItem(KEY + ':beat', JSON.stringify({ id: doc.active.id, tab: 'onglet-c', at: NOW }));
  a.Store.pullLocal();
  // Le chrono d\'ici s\'arrête sans attendre le tour de minuterie.
  assert.equal(a.api.run, null);
  await settle();
  stillShowing(a, shown, 'propriétaire');
  assert.equal(a.api.state.active.owner, 'onglet-c');
});

test('onglets : la reprise d\'une séance libre par un troisième onglet laisse aussi la fenêtre', async () => {
  const { disk, locks, a, b, checkpoint } = await sessionTabs();
  const shown = showing(b);
  await checkpoint();
  // L\'onglet A se ferme ; plus de 15 s après son dernier point de reprise, un onglet C reprend la séance (voir checkActive).
  a.endRun();
  disk.removeItem(KEY + ':beat');
  const c = stateApp(disk, locks);
  c.setNow(new Date(NOW + 5000 + 20000).toISOString());
  b.advance(20000);
  c.init();
  c.checkActive();
  await settle();
  await settle();
  assert.equal(stored(disk).active.owner, c.Store.tab);
  b.Store.pullLocal();
  await settle();
  assert.equal(b.api.state.active.owner, c.Store.tab);
  stillShowing(b, shown, 'reprise');
});

test('onglets : onlySessionMoved ne voit que le point de reprise, le propriétaire et la révision', () => {
  const { onlySessionMoved, normalize, defaultState } = stateApp(undefined, undefined, { expose: ['onlySessionMoved'] });
  const doc = copy(defaultState());
  doc.active = { id: 's1', name: 'Marche', cat: 'corps', min: 30, mode: 'free', owner: 'onglet-a', startedAt: NOW, elapsedSec: 0, checkpointAt: NOW };
  const started = copy(normalize(doc)), idle = copy(started);
  idle.active = null;
  const moved = (from, change) => { const s = copy(from); change(s); return s; };
  // Ce que le point de reprise d\'une séance écrit : la date et la révision de l\'état, le temps, le point de reprise, le propriétaire.
  const sessionOnly = {
    'une copie': () => {},
    'la date et la révision': s => { s.updatedAt += 5000; s.revision = 'autre-révision'; },
    'le temps écoulé': s => { s.active.elapsedSec = 12; },
    'le point de reprise': s => { s.active.checkpointAt += 5000; },
    'le propriétaire': s => { s.active.owner = 'onglet-b'; },
    'un propriétaire absent': s => { s.active.owner = ''; },
    'tout à la fois': s => { s.updatedAt += 1; s.revision = 'r'; s.active.elapsedSec = 30; s.active.checkpointAt += 30000; s.active.owner = 'onglet-c'; },
  };
  for (const [name, change] of Object.entries(sessionOnly)) {
    const after = moved(started, change), before = copy(started), later = copy(after);
    assert.equal(onlySessionMoved(started, after), true, name);
    assert.equal(onlySessionMoved(after, started), true, name + ', à l\'envers');
    // Les deux états sont laissés tels quels.
    assert.deepEqual(started, before, name);
    assert.deepEqual(after, later, name);
  }
  assert.equal(onlySessionMoved(idle, moved(idle, s => { s.updatedAt += 1; s.revision = 'r'; })), true, 'sans séance');
  // Tout le reste compte, y compris le départ ou la fin de la séance, ou une autre séance.
  const anythingElse = {
    'la fin de la séance': s => { s.active = null; },
    'une autre séance': s => { s.active.id = 's2'; },
    'la durée de la séance': s => { s.active.min = 25; },
    'le départ de la séance': s => { s.active.startedAt += 1; },
    'un réglage': s => { s.settings.sound = false; },
    'des pièces': s => { s.coins += 1; },
    'une séance du journal': s => { s.history.push({ id: 'h1', name: 'Lecture' }); },
    'une case de la ville': s => { s.city.tiles.pop(); },
    'les statistiques': s => { s.stats.ok += 1; },
    'une autre ville': s => { s.createdAt += 1; },
    'une clé de plus': s => { s.nouveau = 1; },
  };
  for (const [name, change] of Object.entries(anythingElse)) {
    const after = moved(started, change);
    assert.equal(onlySessionMoved(started, after), false, name);
    assert.equal(onlySessionMoved(after, started), false, name + ', à l\'envers');
    // Avec le point de reprise en plus, c\'est pareil.
    after.updatedAt += 1;
    if (after.active) after.active.checkpointAt += 1;
    assert.equal(onlySessionMoved(started, after), false, name + ' et un point de reprise');
  }
  assert.equal(onlySessionMoved(idle, started), false, 'le départ de la séance');
  assert.equal(onlySessionMoved(started, idle), false, 'la fin de la séance');
});
