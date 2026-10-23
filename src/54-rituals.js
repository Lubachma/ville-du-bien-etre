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
  // Construite une fois, mais redessinée à chaque rendu : son nom est celui de son titre, qui suit la langue.
  if (!card) card = h('section', { id: 'challengesCard', class: 'card feature-card', 'aria-labelledby': 'challengesTitle' });
  // Juste sous l'objectif de la semaine, même si la carte du carnet s'y glisse ensuite.
  const anchor = $('#goalsCard') || $('#kpis');
  if (card.previousElementSibling !== anchor) anchor.after(card);
  const week = challengeWeek(), swapped = S.challenges && S.challenges.week === week && S.challenges.swapped >= 0;
  const rows = weekChallenges(week).map((ch, i) => {
    const p = challengeProgress(ch, week), done = p.done || !!S.gifts[challengeKey(ch, week)], text = challengeText(ch);
    const value = ch.id === 'long' ? t('chal.minutes', { have: p.have, need: p.need }) : p.have + ' / ' + p.need;
    // Les boutons « Changer » disparaissent au premier changement : le nouveau défi prend la clé du sien, et le focus.
    const turned = swapped && S.challenges.swapped === i;
    return h('li', { class: 'chal-row' + (done ? ' done' : ''), tabindex: turned ? '-1' : null, 'data-focus-key': turned ? 'chal-swap:' + i : null },
      h('span', { class: 'chal-text' }, text),
      h('span', { class: 'chal-state' }, done ? t('chal.relieved') : value + ' · ' + t('chal.reward', { coins: fmt(GIFTS.challenge) })),
      swapped || done ? null : h('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-focus-key': 'chal-swap:' + i, 'aria-label': t('chal.swapLabel', { text }),
        onclick: () => { if (swapChallenge(i)) commit(); } }, t('chal.swap')));
  });
  card.replaceChildren(h('h3', { id: 'challengesTitle' }, t('chal.title')), h('p', { class: 'note' }, t('chal.note')), h('ul', { class: 'chal-list' }, ...rows));
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
// Les beaux moments d'une période, sans rien qui manque ni qui baisse. Une partie que le journal ne peut pas dire (null) ne s'affiche pas.
function reviewMoments(r) {
  return [
    r.longest && t('review.longest', { name: displayName(r.longest.name), min: r.longest.min }),
    r.favorite && t('review.favorite', { cat: catName(r.favorite) }),
    r.built && t('review.built', { n: r.built }),
    r.visitors && t('review.visitors', { n: r.visitors }),
    r.festivals && t('review.festivals', { n: r.festivals }),
    r.challenges && t('review.challenges', { n: r.challenges }),
    r.moods && r.moods.good && t('review.mood', { n: r.moods.good, good: r.moods.good, total: r.moods.total }),   // jamais « 0 séance »
  ].filter(Boolean);
}
// Le chemin fait vers l'objectif de la semaine, sur ce qui n'est pas encore atteint : les minutes, puis les jours actifs.
function goalPath(goal) {
  const parts = [];
  if (goal.minutes < goal.targetMinutes) parts.push(t('review.goalMinutes', { minutes: fmtMin(goal.minutes), target: fmtMin(goal.targetMinutes) }));
  if (goal.activeDays < goal.targetDays) parts.push(t('review.goalDays', { n: goal.activeDays, days: goal.activeDays, target: goal.targetDays }));
  return t('review.goalSoFar', { path: parts.join(' · ') });
}
// Fenêtre « Ta semaine » : la semaine passée en chiffres et beaux moments, puis les défis et l'objectif de la semaine qui commence.
function openWeekReview(week) {
  const r = weekReview(week);
  openSheet(t('review.title'), body => {
    body.append(h('p', { class: 'sub' }, t('review.range', { from: reviewDay(r.from), to: reviewDay(r.to) })), h('p', { class: 'review-headline' }, t('review.' + r.headline)));
    if (r.minutes > 0) {
      const moments = [...reviewMoments(r), r.goal.done ? t('review.goalDone') : goalPath(r.goal),
        r.gain > 0 && t('review.gain', { time: fmtMin(r.gain) })].filter(Boolean);
      const figures = [reviewFigure(t('review.minutes'), fmtEffort(r.minutes)), reviewFigure(t('review.days'), String(r.activeDays))];
      if (r.sessions != null) figures.push(reviewFigure(t('review.sessions'), String(r.sessions)));
      body.append(h('div', { class: 'review-figures', vars: { '--n': figures.length } }, ...figures), reviewCats(r.cats),
        h('ul', { class: 'review-moments' }, ...moments.map(text => h('li', {}, text))));
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
// l'image à partager. L'humeur reste à l'écran, et seulement pour un mois : le journal ne garde pas toutes les séances d'une année. Le nombre
// de séances, la plus longue et l'humeur ne s'affichent que si le journal couvre tout le mois (sinon null) ; le temps de pratique, les jours
// actifs et les domaines viennent des statistiques et sont toujours là.
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
      month && r.moods && r.moods.good && t('review.mood', { n: r.moods.good, good: r.moods.good, total: r.moods.total }),
    ])].filter(Boolean));
    const city = recapList([r.built && t('review.built', { n: r.built }), r.sets && t('recap.sets', { n: r.sets }),
      r.visitors && t('review.visitors', { n: r.visitors }), r.festivals && t('review.festivals', { n: r.festivals })]);
    if (city) body.append(h('section', { class: 'recap-part' }, h('h3', { class: 'section-title' }, t('recap.city')), city));
    let sharing = false;
    body.append(h('div', { class: 'review-actions' },
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: async () => {
        if (sharing) return;   // une image à la fois
        sharing = true;
        try { await shareRecapImage(r); } finally { sharing = false; }
      } }, icon('share'), t('recap.share')),
      // La sauvegarde de Réglages → Sauvegarde, à portée de main juste après un beau moment : un fichier (la feuille de partage sur iPhone), qui compte comme
      // une sauvegarde. La feuille reste ouverte et ce bouton n'est pas redessiné (markBackup ne refait que la Ville, dessous) : le focus n'a rien à retrouver.
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => saveBackupFile() }, icon('download'), t('recap.backup')),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: closeSheet }, t('common.close'))));
  }, { keep: true });   // une lecture, comme le bilan de la semaine
}
// Image du récapitulatif, 1080 × 1350 : la période, le nom de la ville, la ville sous le ciel du moment, trois chiffres (temps de
// pratique, jours actifs, éléments posés) et le domaine favori. Jamais l'humeur.
async function recapCanvas(r) {
  const W = 1080, H = 1350, M = 72, out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d'), ink = cssVar('--ink') || '#20332a', muted = cssVar('--muted') || '#536459';
  const serif = size => '400 ' + size + 'px "Young Serif", Georgia, serif', sans = (weight, size) => weight + ' ' + size + 'px Figtree, system-ui, sans-serif';
  if (document.fonts && document.fonts.load) await Promise.all([serif(84), sans(700, 64), sans(600, 40)].map(font => document.fonts.load(font))).catch(() => {});
  // La ville au milieu, dans un cadre de 936 × 620, sous son ciel : ses étoiles, la nuit, sont placées sur elle. Les textes posés
  // sur le ciel prennent l'encre qui s'y lit, à leur hauteur.
  const source = City.snapshot(), scale = Math.min((W - M * 2) / source.width, 620 / source.height), dw = source.width * scale, dh = source.height * scale;
  const area = { x: (W - dw) / 2, y: 260 + (620 - dh) / 2, w: dw, h: dh }, sky = paintImageSky(ctx, W, H, area), skyInk = y => imageInk(sky, y / H);
  ctx.fillStyle = skyInk(158).ink; ctx.font = serif(84);
  ctx.fillText(frTypo(recapTitle(r.kind, r.key)), M, 158, W - M * 2);
  ctx.fillStyle = skyInk(222).muted; ctx.font = sans(600, 40);
  ctx.fillText(frTypo(cityName()), M, 222, W - M * 2);
  ctx.drawImage(source, area.x, area.y, dw, dh);
  const figures = [[fmtEffort(r.minutes), t('recap.imageMinutes')], [String(r.activeDays), t('recap.imageDays')], [String(r.built), t('recap.imageBuilt')]];
  const cw = (W - M * 2 - 48) / 3;
  ctx.textAlign = 'center';
  // Les encadrés laissent à peine voir le ciel (.95) : leurs libellés (--muted) gardent au moins 4,5:1 sous tous les ciels, dans les deux
  // thèmes (4,8:1 au pire, en thème sombre sous un ciel de jour ; à .82, ils tombaient à 3,2:1).
  figures.forEach(([value, label], i) => {
    const x = M + i * (cw + 24);
    ctx.globalAlpha = .95; ctx.fillStyle = cssVar('--surface') || '#fafbf6';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, 910, cw, 190, 28); else ctx.rect(x, 910, cw, 190);
    ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = ink; ctx.font = sans(700, 64); ctx.fillText(frTypo(value), x + cw / 2, 1003, cw - 32);
    ctx.fillStyle = muted; ctx.font = sans(600, 28); ctx.fillText(frTypo(label), x + cw / 2, 1058, cw - 32);
  });
  ctx.textAlign = 'left';
  if (r.favorite) {
    ctx.fillStyle = cssVar('--cat-' + r.favorite) || ink;
    ctx.beginPath(); ctx.arc(M + 14, 1180, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = skyInk(1194).ink; ctx.font = sans(600, 40);
    ctx.fillText(frTypo(t('recap.imageFavorite', { cat: catName(r.favorite) })), M + 44, 1194, W - M * 2 - 44);
  }
  // Le pied dit aussi où trouver l'app : le nom, puis son adresse, sur une seule ligne.
  ctx.fillStyle = skyInk(1292).muted; ctx.font = sans(600, 28);
  ctx.fillText(frTypo(t('recap.imageFooter', { address: appAddress() })), M, 1292, W - M * 2);
  return out;
}
// Partage de l'image : par le partage du téléphone s'il accepte les fichiers, sinon par un téléchargement. Partage annulé :
// rien d'autre.
async function shareRecapImage(r) {
  try {
    const out = await recapCanvas(r), blob = await new Promise(resolve => out.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('toBlob');
    const filename = (r.kind === 'year' ? 'mon-annee-' : 'mon-mois-') + r.key + '.png';
    if (typeof File === 'function' && navigator.canShare && navigator.share) {
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file] }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
      }
    }
    const url = URL.createObjectURL(blob), link = h('a', { href: url, download: filename, hidden: true });
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast(t('recap.imageSaved'));
    return 'downloaded';
  } catch (e) { toast(t('recap.imageFailed')); return 'failed'; }
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
  if (!box) box = h('div', { id: 'ritualCards', class: 'ritual-cards' });
  // Toujours en haut, juste sous les chiffres : les cartes créées ensuite (objectif, carnet) se glissent aussi sous les chiffres.
  if (box.previousElementSibling !== $('#kpis')) $('#kpis').after(box);
  const day = today(), born = dayOf(S.createdAt), week = weekStartOf(day), last = shiftDay(week, -7), month = monthKey(day), year = day.slice(0, 4);
  const lastMonth = monthKey(shiftDay(month + '-01', -1)), lastYear = String(Number(year) - 1), cards = [];
  if (born < week) cards.push(ritualCard(t('review.card'), t('review.range', { from: reviewDay(last), to: reviewDay(shiftDay(last, 6)) }), () => openWeekReview(last), t('review.again')));
  if (born < month + '-01' && periodActive('month', lastMonth)) cards.push(ritualCard(t('recap.cardMonth'), monthTitle(lastMonth), () => openRecap('month', lastMonth), t('recap.open')));
  if (month.endsWith('-01') && born < year + '-01-01' && periodActive('year', lastYear)) cards.push(ritualCard(t('recap.cardYear'), lastYear, () => openRecap('year', lastYear), t('recap.open')));
  box.replaceChildren(...cards);
  box.hidden = !cards.length;
}
