/* ---------- Journal ---------- */
function totalEffortMinutes() {
  const effort = S.stats.effort;
  return effort ? CAT_ORDER.reduce((sum, cat) => sum + (effort.byCat[cat] || 0), 0) : totalMinutes();
}
function todayEffortMinutes() { return S.stats.effort ? S.stats.effort.days[today()] || 0 : todayMinutes(); }
function fmtEffort(minutes) {
  const seconds = Math.max(0, Math.floor(minutes * 60));
  if (!seconds) return '0' + NB + 'min';
  return seconds < 60 ? seconds + NB + 's' : fmtMin(Math.floor(seconds / 60));
}

function renderJournal() {
  const st = streak(), tm = todayMinutes(), day = today();
  const todayCount = S.history.filter(e => e.ok && (e.day || dayOf(e.at)) === day).length;
  const kpi = (label, value, sub) => h('div', { class: 'kpi' }, h('span', { class: 'k-label' }, label), h('span', { class: 'k-value' }, value), sub ? h('span', { class: 'k-sub' }, sub) : null);
  $('#kpis').replaceChildren(
    kpi(t('journal.kpiToday'), fmtEffort(todayEffortMinutes()), t('journal.kpiTodaySub', { time: fmtMin(tm), n: todayCount })),
    streakKpi(kpi, st, tm, day),
    kpi(t('journal.kpiEffort'), fmtEffort(totalEffortMinutes()), S.earned ? t('journal.kpiEffortSubEarned', { time: fmtMin(totalMinutes()), coins: fmt(S.earned) }) : t('journal.kpiEffortSub', { time: fmtMin(totalMinutes()) })),
    kpi(t('journal.kpiSessions'), String(S.stats.ok), t('journal.kpiInterrupted', { n: S.stats.ko })));
  renderGoals();
  if (typeof renderChallengesCard === 'function') renderChallengesCard();
  renderCarnetCard();
  renderWeekChart();
  renderMeters();
  renderHistory();
}
// Carte « Série », ou « Jours actifs cette semaine » si la série est masquée. Aucun message de perte.
function streakKpi(kpi, st, tm, day) {
  if (S.settings.hideStreak) {
    const start = weekStartOf(day);
    const active = Array.from({ length: 7 }, (_, i) => shiftDay(start, i)).filter(d => d <= day && S.stats.days[d] > 0).length;
    return kpi(t('journal.kpiWeekActive'), String(active), null);
  }
  const pause = pauseActive(), rests = restDaysLeft();
  const sub = pause ? t('streak.pausedSince', { date: dayLabel(pause.from) })
    : !st ? t('journal.streakStart')
    : tm ? t('journal.kpiStreakBonus', { pct: streakBonus(st) })
    : t('journal.streakNext', { n: st + 1 }) + (rests ? ' · ' + t('journal.restsLeft', { n: rests }) : '');
  return kpi(t('journal.kpiStreak'), t('unit.days', { n: st }), sub);
}
function niceMax(v) { for (const c of [15, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720]) if (v <= c) return c; return Math.ceil(v / 60) * 60; }
function renderWeekChart() {
  const day = today();
  const days = [];
  for (let i = 6; i >= 0; i--) { const k = shiftDay(day, -i); days.push({ k, v: S.stats.days[k] || 0 }); }
  const max = Math.max(...days.map(x => x.v));
  const top = niceMax(Math.max(max, 1));
  const W = 320, H = 156, padL = 30, padR = 6, padT = 18, padB = 24, plotH = H - padT - padB;
  const band = (W - padL - padR) / 7, bw = Math.min(22, band * .52);
  const y = v => padT + plotH - (v / top) * plotH;
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', t('journal.chartLabel'));
  const el = (tag, attrs, text) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; svg.append(e); return e; };
  el('line', { class: 'grid', x1: padL, x2: W - padR, y1: y(top), y2: y(top) });
  el('line', { class: 'grid', x1: padL, x2: W - padR, y1: y(top / 2), y2: y(top / 2) });
  el('text', { class: 't-axis', x: padL - 6, y: y(top) + 4, 'text-anchor': 'end' }, dec1(top));
  el('text', { class: 't-axis', x: padL - 6, y: y(top / 2) + 4, 'text-anchor': 'end' }, dec1(top / 2));
  el('text', { class: 't-axis', x: padL - 6, y: y(0) + 4, 'text-anchor': 'end' }, '0');
  el('line', { class: 'base', x1: padL, x2: W - padR, y1: y(0), y2: y(0) });
  const readout = $('#chartReadout');
  const maxIdx = max > 0 ? days.findIndex(x => x.v === max) : -1;
  const bars = [];
  days.forEach((dd, i) => {
    const cx = padL + band * i + band / 2;
    const isToday = i === 6;
    if (dd.v > 0) {
      const yy = y(dd.v), hh = y(0) - yy, r = Math.min(4, hh, bw / 2), x0 = cx - bw / 2;
      bars[i] = el('path', { class: 'bar', d: 'M' + x0 + ',' + (yy + hh) + 'V' + (yy + r) + 'Q' + x0 + ',' + yy + ' ' + (x0 + r) + ',' + yy + 'H' + (x0 + bw - r) + 'Q' + (x0 + bw) + ',' + yy + ' ' + (x0 + bw) + ',' + (yy + r) + 'V' + (yy + hh) + 'Z' });
      if (isToday || i === maxIdx) el('text', { class: 't-val', x: cx, y: yy - 5, 'text-anchor': 'middle' }, String(dd.v));
    }
    el('text', { class: 't-axis' + (isToday ? ' today' : ''), x: cx, y: H - 6, 'text-anchor': 'middle' }, isToday ? t('journal.todayShort') : dayFmt('weekday').format(keyToUTC(dd.k)).replace('.', ''));
    const label = t('journal.barLabel', { day: dayLabel(dd.k), time: fmtMin(dd.v) });
    const hit = el('rect', { class: 'hit', x: cx - band / 2, y: padT - 10, width: band, height: plotH + 10 + padB, 'aria-hidden': 'true' });
    const show = () => { readout.textContent = frTypo(label.charAt(0).toUpperCase() + label.slice(1)); bars.forEach((b, j) => b && b.classList.toggle('hot', j !== i)); };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('click', show);
    hit.addEventListener('pointerleave', () => bars.forEach(b => b && b.classList.remove('hot')));
  });
  readout.textContent = max > 0 ? t('journal.chartHint') : t('journal.chartEmpty');
  $('#weekChart').replaceChildren(svg);
  const tbl = $('#weekTable');
  tbl.replaceChildren(h('tr', {}, h('th', { scope: 'col' }, t('journal.colDay')), h('th', { scope: 'col' }, t('journal.colMinutes'))));
  for (const dd of days.slice().reverse()) tbl.append(h('tr', {}, h('td', {}, dayLabel(dd.k)), h('td', {}, String(dd.v))));
}
function renderMeters() {
  const wrap = $('#meters');
  wrap.replaceChildren();
  for (const c of CAT_ORDER) {
    const have = S.stats.byCat[c] || 0;
    const next = Object.keys(ITEMS).filter(k => ITEMS[k].group === c && lockInfo(k)).sort((a, b) => ITEMS[a].need - ITEMS[b].need)[0];
    let pct = 100, note = t('journal.allUnlockedCat', { cat: catName(c), of: catOf(c) });
    if (next) {
      const need = ITEMS[next].need;
      pct = clamp(have / need * 100, 0, 100);
      note = need === 1 ? t('journal.meterFirst', { item: itemName(next) }) : t('journal.meterNext', { item: itemName(next), time: fmtMin(need), left: fmtMin(need - have) });
    }
    wrap.append(h('div', { class: 'meter-row' },
      h('div', { class: 'meter-top' }, h('span', { class: 'name' }, catDot(c), catName(c)), h('span', { class: 'val' }, fmtMin(have))),
      h('div', { class: 'meter', vars: { '--c': catVar(c) }, role: 'progressbar', 'aria-label': t('journal.meterLabel', { cat: catName(c), of: catOf(c) }), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(pct)) }, h('span', { style: 'width:' + pct + '%' })),
      h('span', { class: 'meter-note' }, note)));
  }
}
function reasonText(e) {
  if (e.reason === 'away') return e.away ? t('journal.reasonAwayFor', { time: fmtAway(e.away * 1000) }) : t('journal.reasonAway');
  if (e.reason === 'closed') return t('journal.reasonClosed');
  return t('journal.reasonAbandoned');
}
function renderHistory() {
  const ul = $('#history');
  ul.replaceChildren();
  if (!S.history.length) { ul.append(h('li', {}, h('span', { class: 'empty-state' }, t('journal.historyEmpty')))); return; }
  for (const e of S.history.slice(0, 25)) {
    const src = e.source === 'wishes' ? ' · ' + t('journal.srcWish') : e.source === 'chores' ? ' · ' + t('journal.srcChore') : e.source === 'routine' ? ' · ' + t('journal.srcRoutine') : '';
    const duration = e.ok ? e.min + NB + 'min' : typeof e.elapsedSec === 'number' ? t('journal.durationOf', { done: fmtEffort(e.elapsedSec / 60), min: e.min }) : t('journal.durationUnknown', { min: e.min });
    ul.append(h('li', {},
      h('div', { class: 'h-main' },
        h('span', { class: 'h-title' }, catDot(e.cat), displayName(e.name)),
        h('span', { class: 'h-sub' }, whenLabel(e.at) + ' · ' + duration + src + (e.ok ? '' : ' · ' + reasonText(e)))),
      e.ok ? h('span', { class: 'h-val' }, '+' + fmt(e.reward))
           : h('span', { class: 'h-val lost' }, icon('lost'), t('journal.interrupted'))));
  }
}

/* =========================================================================
   Fenêtres : boutique, bâtiment, réglages, mode strict, sauvegarde
   ========================================================================= */
