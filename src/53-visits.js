/* =========================================================================
   Visites : le visiteur du jour, sa fiche et son cadeau.
   ========================================================================= */
// Un nom au milieu d'une phrase : « Le hérisson » devient « le hérisson ».
function lowerFirst(text) { return text ? text.charAt(0).toLocaleLowerCase(locale()) + text.slice(1) : text; }
// Rencontre du jour : une seule par jour ; la première se remarque.
function meetVisitor(id, day) {
  const v = S.visits[id];
  if (v && v.last === day) return { first: false };
  S.visits[id] = v ? { first: v.first, count: v.count + 1, last: day } : { first: nowTs(), count: 1, last: day };
  return { first: !v };
}
// Cadeau du visiteur : une fois par jour, et seulement pour aujourd'hui (l'horloge reculée n'en donne pas d'autre).
function claimVisitGift(day) {
  const key = 'visit:' + day;
  if (day !== today() || S.gifts[key]) return false;
  S.gifts[key] = nowTs();
  S.coins = clamp(S.coins + GIFTS.visit, 0, COINS_MAX);
  return true;
}
// Fiche du visiteur du jour : la rencontre, une phrase du jour, le nombre de rencontres et le cadeau.
function openVisitor() {
  const amb = ambientAt(), v = amb.visitor;
  if (!v) return;
  const { first } = meetVisitor(v.id, amb.day), name = t('visitor.' + v.id + '.name');
  commit({ silent: true });
  openSheet(name, body => {
    const cv = h('canvas', { 'aria-hidden': 'true', style: 'width:96px;height:96px' });
    City.visitorThumb(cv, v.id, 96);
    const line = t('visitor.' + v.id + '.line' + (1 + Math.floor(chance(amb.day + ':line') * 3)));
    const gift = S.gifts['visit:' + amb.day]
      ? h('p', { class: 'note' }, t('visit.giftDone'))
      : h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: () => {
        if (!claimVisitGift(amb.day)) return;
        closeSheet(); commit(); bump();
        toast(t('visit.thanks', { coins: fmt(GIFTS.visit) }));
      } }, icon('sparkle'), t('visit.gift', { coins: fmt(GIFTS.visit) }));
    body.append(h('div', { class: 'bsheet' }, cv, h('div', { class: 'bsheet-text' }, h('p', {}, line), h('span', { class: 'note' }, t('visit.count', { n: S.visits[v.id].count })))), gift);
  });
  if (first) {
    const lead = t('visit.new', { name: lowerFirst(name) });
    if (typeof celebrate === 'function') celebrate(noticeProgress(), lead); else toast(lead);
  }
}
// Fêtes du jour, à la première ouverture : un cadeau par fête et par an, et un seul message pour toutes.
// « Bonne {name} » ne va pas au Nouvel An : il a son propre vœu.
function greetFestivals(day) {
  const fresh = festivalsOn(day).filter(f => !S.gifts[f.key]);
  if (!fresh.length) return [];
  for (const f of fresh) {
    S.gifts[f.key] = nowTs();
    S.coins = clamp(S.coins + giftAmount(f.key), 0, COINS_MAX);
  }
  const lead = fresh.map(f => {
    const coins = fmt(giftAmount(f.key));
    if (f.id === 'anniversaire') return t('fest.birthday', { n: f.age, coins });
    if (f.id === 'nouvel-an') return t('fest.newYear', { coins });
    return t('fest.greet', { name: t('fest.' + f.id + '.name'), coins });
  }).join(' · ');
  commit();
  if (typeof celebrate === 'function') celebrate(noticeProgress(), lead); else toast(lead);
  return fresh.map(f => f.key);
}
