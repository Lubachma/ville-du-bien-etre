/* =========================================================================
   Carnet : succès, collection et ensembles, avec leurs compteurs dans le Journal.
   ========================================================================= */
const CARNET_TABS = [['achievements', 'carnet.tabAchievements'], ['collection', 'carnet.tabCollection'], ['sets', 'carnet.tabSets']];
function carnetCounts() {
  return {
    achievements: { have: Object.keys(S.achievements || {}).length, total: ACHIEVEMENTS.length },
    collection: collectionCount(),
    sets: { have: Object.keys(S.sets || {}).length, total: SETS.length },
  };
}
// Dernière ouverture du carnet sur cet appareil.
function carnetSeen() { try { return Number(localStorage.getItem(LS_CARNET_SEEN)) || 0; } catch (e) { return 0; } }
function markCarnetSeen() { try { localStorage.setItem(LS_CARNET_SEEN, String(Date.now())); } catch (e) { /* pas de stockage */ } }
// Repère « Nouveau » : un succès ou un ensemble obtenu depuis la dernière ouverture.
function hasNewInCarnet(seen = carnetSeen()) {
  return [S.achievements, S.sets].some(dates => Object.values(dates || {}).some(at => at > seen));
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
    row('carnet.tabAchievements', counts.achievements), row('carnet.tabCollection', counts.collection), row('carnet.tabSets', counts.sets));
}

function openCarnet(tab = 'achievements') {
  markCarnetSeen();
  openSheet(t('carnet.title'), body => {
    const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('carnet.title') }), panel = h('div', { class: 'carnet-panel' });
    const show = name => {
      $$('button', seg).forEach((button, i) => button.setAttribute('aria-checked', String(CARNET_TABS[i][0] === name)));
      panel.replaceChildren(name === 'collection' ? carnetCollection() : name === 'sets' ? carnetSets() : carnetAchievements());
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

// Un seul message pour ce qui vient d'être obtenu : un texte d'ouverture éventuel, les ensembles, puis les succès.
function celebrate({ achievements = [], sets = [] } = {}, lead = '') {
  if (!achievements.length && !sets.length) { if (lead) toast(lead); return; }
  const parts = [lead, ...sets.map(id => t('set.discovered', { name: setName(id) }))];
  if (achievements.length === 1) parts.push(t('ach.toastOne', { name: achName(achievements[0]) }));
  else if (achievements.length > 1) parts.push(t('ach.toastMany', { n: achievements.length }));
  toast(parts.filter(Boolean).join(' · '), { label: t('carnet.open'), run: () => openCarnet(sets.length ? 'sets' : 'achievements') });
}
// Après une pose, un déplacement, un agrandissement ou une étape : ce qui vient d'être obtenu, sans rien afficher.
function noticeProgress() {
  const sets = discoverSets();
  return { sets, achievements: checkAchievements() };
}
// Ville d'avant la mise à jour ou sauvegarde restaurée : tout ce qui était déjà mérité, en un seul message.
function catchUpCarnet() {
  const now = Date.now(), sets = discoverSets(now), achievements = checkAchievements(now, { retro: true });
  if (!sets.length && !achievements.length) return { achievements, sets };
  commit({ silent: true });
  const text = t('carnet.catchUp', { n: achievements.length }) + (sets.length ? ' ' + t('carnet.catchUpSets', { n: sets.length }) : '');
  toast(text, { label: t('carnet.open'), run: () => openCarnet() });
  return { achievements, sets };
}
