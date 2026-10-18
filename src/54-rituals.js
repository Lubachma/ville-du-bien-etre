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

// La carte des moments difficiles, rangée par « Merci » pour 7 jours sur cet appareil.
const MOOD_SUPPORT_PAUSE = 7 * 864e5;
function moodSupportPaused() {
  try { const at = Number(localStorage.getItem(LS_MOOD_CARD)); return at > 0 && Date.now() - at < MOOD_SUPPORT_PAUSE; } catch (e) { return false; }
}
// Journal, après la progression par domaine : la carte douce des moments difficiles, puis « Ce qui te fait du bien »
// (une phrase pour le domaine en tête s'il a au moins une bonne humeur, et une barre par domaine). Aucune note globale.
function renderMoodCards() {
  const anchor = $('#meters') && $('#meters').closest('.card');
  if (!anchor) return;
  for (const id of ['moodSupport', 'moodCard']) { const old = document.getElementById(id); if (old) old.remove(); }
  const cards = [];
  if (moodDifficult() && !moodSupportPaused()) {
    const card = h('section', { id: 'moodSupport', class: 'card mood-support' }, h('p', {}, t('mood.support')),
      h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => {
        try { localStorage.setItem(LS_MOOD_CARD, String(Date.now())); } catch (e) { /* stockage indisponible : rangée jusqu'au prochain affichage */ }
        const next = card.nextElementSibling;
        card.remove();
        if (next) { next.tabIndex = -1; next.focus({ preventScroll: true }); }
      } }, t('mood.thanks')));
    cards.push(card);
  }
  const insights = moodInsights();
  if (insights && insights.rows.length) {
    const top = insights.top;
    cards.push(h('section', { id: 'moodCard', class: 'card' }, h('h3', {}, t('mood.cardTitle')),
      top.good ? h('p', { class: 'mood-top' }, t('mood.top', { cat: catName(top.cat), good: top.good, total: top.total, n: top.good })) : null,
      h('p', { class: 'sub' }, t('mood.cardNote')),
      h('div', { class: 'meters' }, ...insights.rows.map(row => h('div', { class: 'meter-row' },
        h('div', { class: 'meter-top' }, h('span', { class: 'name' }, catDot(row.cat), catName(row.cat)), h('span', { class: 'val' }, t('mood.row', { good: row.good, total: row.total }))),
        h('div', { class: 'meter', vars: { '--c': catVar(row.cat) }, 'aria-hidden': 'true' }, h('span', { style: 'width:' + Math.round(row.good / row.total * 100) + '%' })))))));
  }
  anchor.after(...cards);
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
  else openRecap(due.kind, due.key);
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
// Le nom d'un mois avec son année et une majuscule : « Octobre 2026 ». Sans « de » ni « d' », pour ne pas dépendre de l'élision.
function monthTitle(key) {
  const [year, month] = key.split('-').map(Number);
  const text = new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
  return text.charAt(0).toLocaleUpperCase(locale()) + text.slice(1);
}
const recapTitle = (kind, key) => (kind === 'year' ? key : monthTitle(key));
// Une liste de beaux moments, ou rien s'il n'y en a pas.
const recapList = items => (items.some(Boolean) ? h('ul', { class: 'review-moments' }, ...items.filter(Boolean).map(text => h('li', {}, text))) : null);
// Fenêtre du récapitulatif d'un mois ou d'une année : les chiffres, les domaines en barres, les beaux moments, la ville, puis
// l'image à partager. L'humeur reste à l'écran, et seulement pour un mois : le journal ne garde pas toutes les séances d'une année.
function openRecap(kind, key) {
  const r = recapSummary(kind, key), month = kind === 'month';
  openSheet(recapTitle(kind, key), body => {
    const figures = [reviewFigure(t('review.minutes'), fmtEffort(r.minutes)), reviewFigure(t('review.days'), String(r.activeDays))];
    if (r.sessions != null) figures.push(reviewFigure(t('review.sessions'), String(r.sessions)));
    body.append(h('p', { class: 'sub' }, t(month ? 'recap.leadMonth' : 'recap.leadYear')), h('div', { class: 'review-figures', vars: { '--n': figures.length } }, ...figures));
    if (r.cats.length) {
      const sum = r.cats.reduce((total, cat) => total + r.byCat[cat], 0) || 1;
      body.append(h('section', { class: 'recap-part' }, h('h3', { class: 'section-title' }, t('recap.cats')), h('p', {}, t('review.favorite', { cat: catName(r.favorite) })),
        h('div', { class: 'meters' }, ...r.cats.map(cat => h('div', { class: 'meter-row' },
          h('div', { class: 'meter-top' }, h('span', { class: 'name' }, catDot(cat), catName(cat)), h('span', { class: 'val' }, fmtMin(r.byCat[cat]))),
          h('div', { class: 'meter', vars: { '--c': catVar(cat) }, 'aria-hidden': 'true' }, h('span', { style: 'width:' + Math.round(r.byCat[cat] / sum * 100) + '%' })))))));
    }
    body.append(...[recapList([
      r.bestDay && t('recap.bestDay', { day: dayFmt('long').format(keyToUTC(r.bestDay.day)), time: fmtMin(r.bestDay.minutes) }),
      r.longest && t('review.longest', { name: displayName(r.longest.name), min: r.longest.min }),
      r.challenges && t('review.challenges', { n: r.challenges }),
      r.achievements && t('recap.achievements', { n: r.achievements }),
      month && r.moods.total && t('review.mood', { n: r.moods.good, good: r.moods.good, total: r.moods.total }),
    ])].filter(Boolean));
    const city = recapList([r.built && t('review.built', { n: r.built }), r.sets && t('recap.sets', { n: r.sets }),
      r.visitors && t('review.visitors', { n: r.visitors }), r.festivals && t('review.festivals', { n: r.festivals })]);
    if (city) body.append(h('section', { class: 'recap-part' }, h('h3', { class: 'section-title' }, t('recap.city')), city));
    body.append(h('div', { class: 'review-actions' },
      typeof shareRecapImage === 'function' ? h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => shareRecapImage(kind, key) }, icon('upload'), t('recap.share')) : null,
      h('button', { class: 'btn btn-primary', type: 'button', onclick: closeSheet }, t('common.close'))));
  }, { keep: true });   // une lecture, comme le bilan de la semaine
}
// Carte d'un bilan ou d'un récapitulatif en haut du Journal, pour le (re)voir.
const ritualCard = (title, sub, open, label) => h('section', { class: 'card ritual-card' },
  h('div', { class: 'feature-between' }, h('h3', {}, title), h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: open }, label)),
  h('p', { class: 'sub' }, sub));
// En haut du Journal : la semaine dernière, toute la semaine (si la ville existait déjà) ; le mois passé, tout le mois suivant ;
// l'année passée, en janvier. Un mois ou une année seulement s'ils ont eu du temps de pratique. Le réglage des bilans coupé,
// les cartes restent.
function renderRitualCards() {
  if (!$('#view-journal')) return;
  let box = $('#ritualCards');
  if (!box) { box = h('div', { id: 'ritualCards', class: 'ritual-cards' }); $('#kpis').after(box); }
  const day = today(), born = dayOf(S.createdAt), week = weekStartOf(day), last = shiftDay(week, -7), month = monthKey(day), year = day.slice(0, 4);
  const lastMonth = monthKey(shiftDay(month + '-01', -1)), lastYear = String(Number(year) - 1), cards = [];
  if (born < week) cards.push(ritualCard(t('review.card'), t('review.range', { from: reviewDay(last), to: reviewDay(shiftDay(last, 6)) }), () => openWeekReview(last), t('review.again')));
  if (born < month + '-01' && periodActive('month', lastMonth)) cards.push(ritualCard(t('recap.cardMonth'), monthTitle(lastMonth), () => openRecap('month', lastMonth), t('recap.open')));
  if (month.endsWith('-01') && born < year + '-01-01' && periodActive('year', lastYear)) cards.push(ritualCard(t('recap.cardYear'), lastYear, () => openRecap('year', lastYear), t('recap.open')));
  box.replaceChildren(...cards);
  box.hidden = !cards.length;
}
