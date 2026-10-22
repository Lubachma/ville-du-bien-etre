/* =========================================================================
   Visites : le visiteur du jour, sa fiche et son cadeau ; les fêtes, les saisons vues et la légende de la ville.
   ========================================================================= */
// Succès et ensembles tout juste obtenus, notés avant l'enregistrement ; sans le carnet (tests), rien.
const progressNow = () => (typeof noticeProgress === 'function' ? noticeProgress() : {});
// Un seul message : le texte d'ouverture, puis ce qui vient d'être obtenu.
function cheer(fresh, lead) { if (typeof celebrate === 'function') celebrate(fresh, lead); else if (lead) toast(lead); }
// Un nom au milieu d'une phrase : « Le hérisson » devient « le hérisson ».
function lowerFirst(text) { return text ? text.charAt(0).toLocaleLowerCase(locale()) + text.slice(1) : text; }
// Rencontre du jour : une seule par jour ; la première se remarque.
function meetVisitor(id, day) {
  const v = S.visits[id];
  if (v && v.last === day) return { first: false };
  S.visits[id] = v ? { first: v.first, count: v.count + 1, last: day } : { first: nowTs(), count: 1, last: day };
  return { first: !v };
}
// Cadeau du visiteur encore offert : seulement pour aujourd'hui, une fois par jour, et jamais pour un jour antérieur au dernier
// reçu (l'horloge reculée n'en donne pas d'autre).
function visitGiftOpen(day) { return day === today() && lastGiftDay('visit:') < day; }
function claimVisitGift(day) {
  if (!visitGiftOpen(day)) return false;
  S.gifts['visit:' + day] = nowTs();
  S.coins = clamp(S.coins + GIFTS.visit, 0, COINS_MAX);
  return true;
}
// Fiche du visiteur du jour : la rencontre, une phrase du jour, le nombre de rencontres et le cadeau.
function openVisitor() {
  const amb = ambientAt(), v = amb.visitor;
  if (!v) return;
  const { first } = meetVisitor(v.id, amb.day), name = t('visitor.' + v.id + '.name'), fresh = first ? progressNow() : null;
  commit({ silent: true });
  openSheet(name, body => {
    const cv = h('canvas', { 'aria-hidden': 'true', style: 'width:96px;height:96px' });
    City.visitorThumb(cv, v.id, 96);
    const line = t('visitor.' + v.id + '.line' + (1 + Math.floor(chance(amb.day + ':line') * 3)));
    // Le cadeau offert, ou « Cadeau reçu aujourd'hui. » s'il l'a vraiment été ; refusé (le cadeau d'un jour plus tardif a déjà été reçu,
    // l'heure avancée puis remise), rien.
    const gift = !visitGiftOpen(amb.day)
      ? S.gifts['visit:' + amb.day] ? h('p', { class: 'note' }, t('visit.giftDone')) : null
      : h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: () => {
        if (!claimVisitGift(amb.day)) {
          // Minuit est passé pendant que la fiche était ouverte, ou le cadeau a été reçu ailleurs : la fiche se refait pour aujourd'hui.
          const newDay = amb.day !== today();
          closeSheet();
          if (newDay) toast(t('visit.newDay'));
          openVisitor();
          return;
        }
        const progress = progressNow();
        closeSheet(); commit(); bump();
        cheer(progress, t('visit.thanks', { coins: fmt(GIFTS.visit) }));
      } }, icon('sparkle'), t('visit.gift', { coins: fmt(GIFTS.visit) }));
    // append() écrirait null en toutes lettres : sans cadeau à dire, rien n'est ajouté.
    body.append(h('div', { class: 'bsheet' }, cv, h('div', { class: 'bsheet-text' }, h('p', {}, line), h('span', { class: 'note' }, t('visit.count', { n: S.visits[v.id].count })))), ...[gift].filter(Boolean));
  });
  if (first) cheer(fresh, t('visit.new', { name: lowerFirst(name) }));
}
// La fête d'en face reçue ces jours-ci : changer d'hémisphère pendant une fête montre la même fête vue de l'autre côté,
// déjà fêtée et déjà offerte.
function mirrorGiftNear(fest, day) {
  const mirror = mirrorOf(fest.id), at = mirror && S.gifts['fest:' + mirror + ':' + fest.key.split(':')[2]];
  return !!at && dayOf(at) >= shiftDay(day, -3) && dayOf(at) <= day;
}
// Fêtes du jour, à la première ouverture : un cadeau par fête et par an, et un seul message pour toutes.
// « Bonne {name} » ne va pas au Nouvel An : il a son propre vœu.
function greetFestivals(day) {
  const fresh = festivalsOn(day).filter(f => !S.gifts[f.key] && !mirrorGiftNear(f, day));
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
  }).join(' · '), progress = progressNow();
  commit();
  cheer(progress, lead);
  return fresh.map(f => f.key);
}
// Saison du jour, notée la première fois que la ville la vit. Une seule saison nouvelle par jour : après un changement
// d'hémisphère, la saison d'en face compte dès le lendemain.
function noteSeason(day) {
  const season = seasonOf(day);
  if (S.seasons[season] || Object.values(S.seasons).some(at => dayOf(at) === day)) return false;
  S.seasons[season] = nowTs();
  return true;
}
// À chaque affichage de la Ville : la saison vue, le souhait du jour, les fêtes du jour, puis ce qui vient d'être obtenu (défis,
// souhait exaucé, étoiles, ensembles, succès). Un seul enregistrement : celui des fêtes quand il y en a, sinon un enregistrement
// visible s'il y a du nouveau (des pièces), sinon discret pour la saison ou le souhait tiré.
// Une ville sans séance ouvre en silence : les étoiles qu'elle mérite déjà au départ sont versées d'abord, sans message, un jour de fête
// aussi (sans cela, le message des fêtes les annoncerait). Ce versement est un changement à enregistrer. Une étoile gagnée ensuite en
// posant un bâtiment garde son message : c'est noticeProgress, après la pose, qui l'annonce. Sans le fichier de l'harmonie (tests), rien.
function liveTick(day = today()) {
  const quiet = isNewTown() && typeof claimStars === 'function' && claimStars().length > 0;
  const season = noteSeason(day), drawn = typeof drawTownWish === 'function' && drawTownWish(day);
  if (greetFestivals(day).length) return;
  const progress = progressNow(), news = typeof hasNews === 'function' && hasNews(progress);
  if (!season && !drawn && !news && !quiet) return;
  commit(news ? {} : { silent: true });
  cheer(progress, '');
}
// Début de la légende de la ville : moment, météo (et arc-en-ciel), visiteur de passage et fêtes du jour.
function ambientCaption(amb) {
  const parts = [t('life.moment.' + amb.moment.name), t('life.weather.' + amb.weather)];
  if (amb.rainbow) parts.push(t('life.rainbow'));
  if (amb.visitor) {
    const def = VISITORS.find(v => v.id === amb.visitor.id) || {};
    parts.push(t('visit.here', { name: t('visitor.' + amb.visitor.id + '.name'), n: def.plural ? 2 : 1 }));
  }
  for (const fest of amb.festivals || []) parts.push(t('fest.' + fest.id + '.name'));
  return parts.join(' · ');
}
