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
