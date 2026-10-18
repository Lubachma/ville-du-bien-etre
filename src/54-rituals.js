/* =========================================================================
   Rituels : défis de la semaine, bilans, récapitulatifs et humeur (interface).
   ========================================================================= */
// Texte d'un défi, avec sa cible de la semaine.
function challengeText(ch) { return t('chal.' + ch.id, { n: ch.n, cat: ch.cat ? catName(ch.cat) : '', m: ch.m }); }

// Carte « Défis de la semaine » du Journal, sous l'objectif de la semaine ; absente quand les défis sont coupés.
function renderChallengesCard() {
  if (!$('#view-journal')) return;
  let card = $('#challengesCard');
  if (S.settings.challenges === false) { if (card) card.remove(); return; }
  if (!card) {
    card = h('section', { id: 'challengesCard', class: 'card feature-card', 'aria-label': t('chal.title') });
    ($('#goalsCard') || $('#kpis')).after(card);
  }
  const week = challengeWeek(), swapped = S.challenges && S.challenges.week === week && S.challenges.swapped >= 0;
  const rows = weekChallenges(week).map((ch, i) => {
    const p = challengeProgress(ch, week), done = p.done || !!S.gifts[challengeKey(ch, week)], text = challengeText(ch);
    const value = ch.id === 'long' ? t('chal.minutes', { have: p.have, need: p.need }) : p.have + ' / ' + p.need;
    return h('li', { class: 'chal-row' + (done ? ' done' : '') },
      h('span', { class: 'chal-text' }, text),
      h('span', { class: 'chal-state' }, done ? t('chal.relieved') : value + ' · ' + t('chal.reward', { coins: fmt(GIFTS.challenge) })),
      swapped || done ? null : h('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'aria-label': t('chal.swapLabel', { text }),
        onclick: () => { if (swapChallenge(i)) commit(); } }, t('chal.swap')));
  });
  card.replaceChildren(h('h3', {}, t('chal.title')), h('p', { class: 'note' }, t('chal.note')), h('ul', { class: 'chal-list' }, ...rows));
}

// Humeur sur l'écran de fin : cinq visages, un toucher suffit et on peut changer d'avis. « Passer » retire la question ;
// une fois l'humeur choisie, son nom remplace « Passer ».
function moodPicker(entryId) {
  const entry = S.history.find(e => e.id === entryId);
  let chosen = (entry && entry.mood) || 0;
  const faces = h('div', { class: 'mood-faces', role: 'radiogroup', 'aria-labelledby': 'moodQuestion' }), foot = h('div', { class: 'mood-foot' });
  const box = h('section', { class: 'mood' }, h('p', { id: 'moodQuestion', class: 'mood-question' }, t('mood.question')), faces, foot);
  const skip = () => {
    let next = box.nextElementSibling;
    box.remove();
    while (next && !next.querySelector('button')) next = next.nextElementSibling;
    if (next) next.querySelector('button').focus({ preventScroll: true });
  };
  const update = () => {
    $$('.mood-face', faces).forEach((face, i) => face.setAttribute('aria-checked', String(i + 1 === chosen)));
    // Le nom du visage choisi, pour les yeux : les lecteurs d'écran l'ont déjà avec le bouton coché.
    foot.replaceChildren(chosen ? h('span', { class: 'mood-chosen', 'aria-hidden': 'true' }, t('mood.' + chosen))
      : h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: skip }, t('mood.skip')));
  };
  for (let n = 1; n <= 5; n++) {
    faces.append(h('button', { class: 'mood-face', type: 'button', role: 'radio', 'aria-label': t('mood.' + n),
      onclick: () => { if (!setMood(entryId, n)) return; chosen = n; commit({ silent: true }); update(); } }, icon('mood-' + n)));
  }
  update();
  return box;
}

// Bilan ou récapitulatif dû : il s'ouvre une seule fois, sur la Ville, quand aucune fenêtre ni séance n'est ouverte.
function maybeOpenRitual() {
  if (currentTab !== 'ville' || document.visibilityState !== 'visible' || !$('#sheet').hidden || !$('#cityBig').hidden) return false;
  if (S.active || (typeof run !== 'undefined' && run)) return false;
  const due = pendingRitual();
  if (!due) return false;
  markRitual(due.kind, due.key);
  commit({ silent: true });
  if (due.kind === 'week') openWeekReview(due.key);
  else if (typeof openRecap === 'function') openRecap(due.kind, due.key);
  return true;
}
const reviewDay = day => dayFmt('short').format(keyToUTC(day));
// Un chiffre du bilan, avec son nom.
const reviewFigure = (label, value) => h('div', { class: 'review-figure' }, h('strong', {}, value), h('span', {}, label));
// Les pastilles des domaines pratiqués.
const reviewCats = cats => h('div', { class: 'review-cats' }, ...cats.map(cat => h('span', { class: 'pill' }, h('i', { class: 'review-dot', vars: { '--c': 'var(--cat-' + cat + ')' } }), catName(cat))));
// Les beaux moments d'une période, sans rien qui manque ni qui baisse.
function reviewMoments(r) {
  return [
    r.longest && t('review.longest', { name: displayName(r.longest.name), min: r.longest.min }),
    r.favorite && t('review.favorite', { cat: catName(r.favorite) }),
    r.built && t('review.built', { n: r.built }),
    r.visitors && t('review.visitors', { n: r.visitors }),
    r.festivals && t('review.festivals', { n: r.festivals }),
    r.challenges && t('review.challenges', { n: r.challenges }),
    r.moods.total && t('review.mood', { n: r.moods.good, good: r.moods.good, total: r.moods.total }),
  ].filter(Boolean);
}
// Fenêtre « Ta semaine » : la semaine passée en chiffres et beaux moments, puis les défis et l'objectif de la semaine qui commence.
function openWeekReview(week) {
  const r = weekReview(week);
  openSheet(t('review.title'), body => {
    body.append(h('p', { class: 'sub' }, t('review.range', { from: reviewDay(r.from), to: reviewDay(r.to) })), h('p', { class: 'review-headline' }, t('review.' + r.headline)));
    if (r.minutes > 0) {
      const moments = [...reviewMoments(r), r.goal.done ? t('review.goalDone') : t('review.goalSoFar', { minutes: fmtMin(r.goal.minutes), target: fmtMin(r.goal.targetMinutes) }),
        r.gain > 0 && t('review.gain', { time: fmtMin(r.gain) })].filter(Boolean);
      body.append(h('div', { class: 'review-figures' }, reviewFigure(t('review.minutes'), fmtEffort(r.minutes)), reviewFigure(t('review.days'), String(r.activeDays)),
        reviewFigure(t('review.sessions'), String(r.sessions))), reviewCats(r.cats), h('ul', { class: 'review-moments' }, ...moments.map(text => h('li', {}, text))));
    }
    const next = h('section', { class: 'review-next' }, h('h3', { class: 'section-title' }, t('review.next')));
    if (S.settings.challenges !== false) {
      next.append(h('ul', { class: 'chal-list' }, ...weekChallenges().map(ch => h('li', { class: 'chal-row' },
        h('span', { class: 'chal-text' }, challengeText(ch)), h('span', { class: 'chal-state' }, t('chal.reward', { coins: fmt(GIFTS.challenge) }))))));
    }
    next.append(h('div', { class: 'review-actions' },
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => openGoals() }, t('review.goal')),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: closeSheet }, t('review.go'))));
    body.append(next);
  }, { keep: true });   // une lecture : une synchronisation au démarrage ne la referme pas
}
// Carte d'un bilan en haut du Journal, pour le revoir.
const ritualCard = (title, sub, open) => h('section', { class: 'card ritual-card' },
  h('div', { class: 'feature-between' }, h('h3', {}, title), h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: open }, t('review.again'))),
  h('p', { class: 'sub' }, sub));
// En haut du Journal : la semaine dernière, toute la semaine (si la ville existait déjà).
function renderRitualCards() {
  if (!$('#view-journal')) return;
  let box = $('#ritualCards');
  if (!box) { box = h('div', { id: 'ritualCards', class: 'ritual-cards' }); $('#kpis').after(box); }
  const week = weekStartOf(today()), last = shiftDay(week, -7), cards = [];
  if (dayOf(S.createdAt) < week) cards.push(ritualCard(t('review.card'), t('review.range', { from: reviewDay(last), to: reviewDay(shiftDay(last, 6)) }), () => openWeekReview(last)));
  box.replaceChildren(...cards);
  box.hidden = !cards.length;
}
