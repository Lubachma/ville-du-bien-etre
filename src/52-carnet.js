/* =========================================================================
   Carnet : succès, collection, ensembles et visites, avec leurs compteurs dans le Journal.
   ========================================================================= */
const CARNET_TABS = [['achievements', 'carnet.tabAchievements'], ['collection', 'carnet.tabCollection'], ['sets', 'carnet.tabSets'], ['visits', 'carnet.tabVisits']];
function carnetCounts() {
  return {
    achievements: { have: Object.keys(S.achievements || {}).length, total: ACHIEVEMENTS.length },
    collection: collectionCount(),
    sets: { have: Object.keys(S.sets || {}).length, total: SETS.length },
    visits: { have: Object.keys(S.visits || {}).length, total: VISITORS.length },
  };
}
// Succès et ensembles obtenus, avec leur date : « a:id » pour un succès, « s:id » pour un ensemble.
function carnetObtained() {
  const all = {};
  for (const [id, at] of Object.entries(S.achievements || {})) all['a:' + id] = at;
  for (const [id, at] of Object.entries(S.sets || {})) all['s:' + id] = at;
  return all;
}
// Ce que le carnet montrait à sa dernière ouverture sur cet appareil.
function carnetSeen() {
  try { const seen = JSON.parse(localStorage.getItem(LS_CARNET_SEEN)); return seen && typeof seen === 'object' && !Array.isArray(seen) ? seen : {}; } catch (e) { return {}; }
}
function markCarnetSeen() { try { localStorage.setItem(LS_CARNET_SEEN, JSON.stringify(carnetObtained())); } catch (e) { /* pas de stockage */ } }
// Repère « Nouveau » : un succès ou un ensemble pas encore vu ici, ou obtenu de nouveau à une autre date
// (sauvegarde restaurée, ville recommencée). La date de l'appareil n'entre pas en jeu.
function hasNewInCarnet(seen = carnetSeen()) {
  return Object.entries(carnetObtained()).some(([key, at]) => seen[key] !== at);
}
const carnetDate = at => dayFmt('short').format(keyToUTC(dayOf(at)));

function renderCarnetCard() {
  if (!$('#view-journal')) return;
  let card = $('#carnetCard');
  if (!card) {
    card = h('section', { id: 'carnetCard', class: 'card feature-card', 'aria-label': t('carnet.cardLabel') });
    ($('#goalsCard') || $('#kpis')).after(card);
  }
  const counts = carnetCounts();
  const row = (key, n) => h('div', { class: 'feature-between' }, h('span', {}, t(key)), h('strong', {}, t('carnet.count', n)));
  card.replaceChildren(
    h('div', { class: 'feature-between' },
      h('h3', {}, t('carnet.title'), hasNewInCarnet() ? h('span', { class: 'badge-new' }, t('carnet.new')) : null),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => openCarnet() }, t('carnet.open'))),
    row('carnet.tabAchievements', counts.achievements), row('carnet.tabCollection', counts.collection), row('carnet.tabSets', counts.sets),
    row('carnet.tabVisits', counts.visits));
}

function openCarnet(tab = 'achievements') {
  markCarnetSeen();
  openSheet(t('carnet.title'), body => {
    const seg = h('div', { class: 'seg seg-4', role: 'radiogroup', 'aria-label': t('carnet.title') }), panel = h('div', { class: 'carnet-panel' });
    const show = name => {
      $$('button', seg).forEach((button, i) => button.setAttribute('aria-checked', String(CARNET_TABS[i][0] === name)));
      panel.replaceChildren(name === 'collection' ? carnetCollection() : name === 'sets' ? carnetSets() : name === 'visits' ? carnetVisits() : carnetAchievements());
    };
    for (const [name, key] of CARNET_TABS) seg.append(h('button', { type: 'button', role: 'radio', 'aria-checked': 'false', onclick: () => show(name) }, t(key)));
    body.append(seg, panel);
    show(tab);
  }, { onClose: () => renderCarnetCard() });
}
// Succès : ceux obtenus d'abord (les plus récents en tête), puis les autres avec leur condition et leur progression.
function carnetAchievements() {
  const got = S.achievements || {};
  const earned = ACHIEVEMENTS.filter(def => got[def.id]).sort((a, b) => got[b.id] - got[a.id]);
  const row = def => {
    const at = got[def.id], progress = at ? null : achievementProgress(def);
    const desc = def.id === 'sur-ta-lancee' && S.settings.hideStreak ? t('ach.sur-ta-lancee.descHidden') : t('ach.' + def.id + '.desc');
    const value = n => (progress.unit === 'min' ? fmtMin(n) : n);
    let gift = null;
    if (def.reward) { gift = h('canvas', { 'aria-hidden': 'true' }); City.thumb(gift, def.reward, 40, { silhouette: !at }); }
    return h('li', { class: 'carnet-row' + (at ? ' earned' : '') },
      h('span', { class: 'ach-badge', 'aria-hidden': 'true' }, icon(at ? 'sparkle' : 'lock')),
      h('div', { class: 'carnet-text' }, h('strong', {}, achName(def.id)), h('span', { class: 'note' }, desc),
        at ? h('span', { class: 'note' }, t('carnet.earnedOn', { date: carnetDate(at) })) : null,
        progress ? h('span', { class: 'note' }, t('carnet.progress', { have: value(progress.have), need: value(progress.need) })) : null,
        def.reward ? h('span', { class: 'note' }, t('carnet.gift', { item: itemName(def.reward) })) : null),
      gift);
  };
  return h('ul', { class: 'carnet-list' }, ...earned.map(row), ...ACHIEVEMENTS.filter(def => !got[def.id]).map(row));
}
// Collection : les 50 éléments, en couleur s'ils sont dévoilés, sinon en silhouette avec leur condition.
function carnetCollection() {
  const cells = [];
  for (const group of GROUPS) {
    for (const key of Object.keys(ITEMS).filter(k => ITEMS[k].group === group)) {
      const shown = isRevealed(key), lock = lockInfo(key), cv = h('canvas', { 'aria-hidden': 'true' });
      City.thumb(cv, key, 56, { silhouette: !shown });
      cells.push(h('li', { class: 'carnet-cell' + (lock ? ' locked' : '') }, cv,
        h('strong', {}, shown ? itemName(key) : t('carnet.mystery')), lock ? h('span', { class: 'note' }, lock.text) : null));
    }
  }
  return h('ul', { class: 'carnet-grid' }, ...cells);
}
// Ensembles : ceux découverts, puis ceux à découvrir, avec la silhouette de leurs trois éléments.
function carnetSets() {
  const got = S.sets || {};
  const pieces = (set, known) => h('div', { class: 'carnet-pieces' }, ...set.items.map(item => {
    const cv = h('canvas', { 'aria-hidden': 'true' });
    City.thumb(cv, item, 44, { silhouette: !known });
    return cv;
  }));
  const row = set => {
    const at = got[set.id];
    return h('li', { class: 'carnet-row carnet-set' + (at ? ' earned' : '') },
      h('div', { class: 'carnet-text' }, h('strong', {}, at ? setName(set.id) : t('set.unknown')),
        h('span', { class: 'note' }, at ? set.items.map(itemName).join(' · ') : t('set.hint')),
        at ? h('span', { class: 'note' }, t('set.foundOn', { date: carnetDate(at) })) : null),
      pieces(set, !!at));
  };
  return h('ul', { class: 'carnet-list' }, ...SETS.filter(set => got[set.id]).map(row), ...SETS.filter(set => !got[set.id]).map(row));
}
// Visites : les visiteurs rencontrés (du plus ancien au plus récent), puis les autres en silhouette avec un indice ;
// ensuite les six fêtes, avec les années où la ville les a vécues et leur prochain retour.
function carnetVisits() {
  const visits = S.visits || {}, day = today();
  const visitor = v => {
    const met = visits[v.id], cv = h('canvas', { 'aria-hidden': 'true' });
    City.visitorThumb(cv, v.id, 48, { silhouette: !met });
    return h('li', { class: 'carnet-row carnet-visitor' + (met ? ' earned' : '') }, cv,
      h('div', { class: 'carnet-text' }, h('strong', {}, met ? t('visitor.' + v.id + '.name') : t('carnet.visitorUnknown')),
        h('span', { class: 'note' }, met ? t('visit.count', { n: met.count }) : t('visitor.' + v.id + '.hint')),
        met ? h('span', { class: 'note' }, t('carnet.metSince', { date: carnetDate(met.first) })) : null));
  };
  const fest = f => {
    const years = Object.keys(S.gifts || {}).filter(key => key.startsWith('fest:' + f.id + ':')).map(key => key.split(':')[2]).sort();
    const next = nextFestival(f.id, day);
    return h('li', { class: 'carnet-row carnet-fest' + (years.length ? ' earned' : '') },
      h('span', { class: 'ach-badge', 'aria-hidden': 'true' }, icon(years.length ? 'sparkle' : 'sun')),
      h('div', { class: 'carnet-text' }, h('strong', {}, t('fest.' + f.id + '.name')),
        years.length ? h('span', { class: 'note' }, t('fest.lived', { years: years.join(', ') })) : null,
        next ? h('span', { class: 'note' }, t('fest.next', { date: dayFmt('long').format(keyToUTC(next)) })) : null));
  };
  const met = VISITORS.filter(v => visits[v.id]).sort((a, b) => visits[a.id].first - visits[b.id].first);
  return h('div', { class: 'carnet-visits' },
    h('h4', {}, t('carnet.visitorsHead')),
    h('ul', { class: 'carnet-list' }, ...met.map(visitor), ...VISITORS.filter(v => !visits[v.id]).map(visitor)),
    h('h4', {}, t('carnet.festsHead')),
    h('ul', { class: 'carnet-list' }, ...FESTIVALS.map(fest)));
}

// Un seul message pour ce qui vient d'être obtenu : un texte d'ouverture éventuel, les ensembles, puis les succès.
function celebrate({ achievements = [], sets = [] } = {}, lead = '') {
  // Au démarrage, le message de rattrapage en attente rejoint ce message-ci.
  const note = lead || achievements.length || sets.length ? takeCarnetNote() : '';
  if (!achievements.length && !sets.length) {
    if (note) toast([lead, note].filter(Boolean).join(' · '), { label: t('carnet.open'), run: () => openCarnet() });
    else if (lead) toast(lead);
    return;
  }
  if (sets.length) {
    // Étincelles sur les cases des ensembles découverts, et deux notes claires.
    const found = formedSets();
    City.sparkle(sets.flatMap(id => found.get(id) || []));
    Chime.place('set');
  }
  const parts = [lead, ...sets.map(id => t('set.discovered', { name: setName(id) }))];
  // Plusieurs succès : le message reste court, les lecteurs d'écran entendent le nom de chacun.
  const n = achievements.length, names = achievements.map(achName).join(', ');
  const shown = n === 1 ? t('ach.toastOne', { name: names }) : n > 1 ? t('ach.toastMany', { n }) : '';
  const line = last => [...parts, last, note].filter(Boolean).join(' · ');
  toast(line(shown), { label: t('carnet.open'), run: () => openCarnet(sets.length ? 'sets' : 'achievements') }, line(n > 1 ? t('ach.spokenMany', { n, names }) : shown));
}
// Après une pose, un déplacement, un agrandissement ou une étape : ce qui vient d'être obtenu, sans rien afficher.
function noticeProgress() {
  const sets = discoverSets();
  return { sets, achievements: checkAchievements() };
}
// Ville d'avant la mise à jour ou sauvegarde restaurée : tout ce qui était déjà mérité, en un seul message.
// Au démarrage (defer), le message attend : il rejoint le premier message de la ville (une fête), sinon flushCarnetNote l'affiche.
let carnetNote = '';
function catchUpCarnet({ defer = false } = {}) {
  const now = Date.now(), sets = discoverSets(now), achievements = checkAchievements(now, { retro: true });
  if (!sets.length && !achievements.length) return { achievements, sets };
  const text = t('carnet.catchUp', { n: achievements.length }) + (sets.length ? ' ' + t('carnet.catchUpSets', { n: sets.length }) : '');
  if (defer) { commit({ silent: true }); carnetNote = text; return { achievements, sets }; }
  commit();       // affiché tout de suite, même si le Journal est ouvert (restauration)
  toast(text, { label: t('carnet.open'), run: () => openCarnet() });
  return { achievements, sets };
}
function takeCarnetNote() { const note = carnetNote; carnetNote = ''; return note; }
function flushCarnetNote() { const note = takeCarnetNote(); if (note) toast(note, { label: t('carnet.open'), run: () => openCarnet() }); }
