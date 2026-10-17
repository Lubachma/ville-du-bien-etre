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
  const st = streak(), tm = todayMinutes(), t = today();
  const todayCount = S.history.filter(e => e.ok && (e.day || dayOf(e.at)) === t).length;
  const kpi = (label, value, sub) => h('div', { class: 'kpi' }, h('span', { class: 'k-label' }, label), h('span', { class: 'k-value' }, value), sub ? h('span', { class: 'k-sub' }, sub) : null);
  $('#kpis').replaceChildren(
    kpi("Aujourd'hui", fmtEffort(todayEffortMinutes()), fmtMin(tm) + ' réussies · ' + plural(todayCount, 'session', 'sessions')),
    kpi('Série', plural(st, 'jour', 'jours'), st && !tm ? "Fais une session aujourd'hui pour la garder" : 'Bonus actuel +' + streakBonus(st) + NB + '%'),
    kpi('Temps effectué', fmtEffort(totalEffortMinutes()), 'Dont ' + fmtMin(totalMinutes()) + ' réussies' + (S.earned ? ' · ' + fmt(S.earned) + ' gagnés' : '')),
    kpi('Sessions', String(S.stats.ok), plural(S.stats.ko, 'interrompue', 'interrompues')));
  renderGoals();
  renderWeekChart();
  renderMeters();
  renderHistory();
}
function niceMax(v) { for (const c of [15, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720]) if (v <= c) return c; return Math.ceil(v / 60) * 60; }
function renderWeekChart() {
  const t = today();
  const days = [];
  for (let i = 6; i >= 0; i--) { const k = shiftDay(t, -i); days.push({ k, v: S.stats.days[k] || 0 }); }
  const max = Math.max(...days.map(x => x.v));
  const top = niceMax(Math.max(max, 1));
  const W = 320, H = 156, padL = 30, padR = 6, padT = 18, padB = 24, plotH = H - padT - padB;
  const band = (W - padL - padR) / 7, bw = Math.min(22, band * .52);
  const y = v => padT + plotH - (v / top) * plotH;
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Minutes par jour sur les 7 derniers jours, détail dans le tableau ci-dessous');
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
    el('text', { class: 't-axis' + (isToday ? ' today' : ''), x: cx, y: H - 6, 'text-anchor': 'middle' }, isToday ? 'auj.' : dayFmt('weekday').format(keyToUTC(dd.k)).replace('.', ''));
    const label = dayLabel(dd.k) + ' : ' + fmtMin(dd.v);
    const hit = el('rect', { class: 'hit', x: cx - band / 2, y: padT - 10, width: band, height: plotH + 10 + padB, 'aria-hidden': 'true' });
    const show = () => { readout.textContent = frTypo(label.charAt(0).toUpperCase() + label.slice(1)); bars.forEach((b, j) => b && b.classList.toggle('hot', j !== i)); };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('click', show);
    hit.addEventListener('pointerleave', () => bars.forEach(b => b && b.classList.remove('hot')));
  });
  readout.textContent = max > 0 ? 'Touche une barre pour voir le détail.' : 'Aucune session réussie cette semaine pour le moment.';
  $('#weekChart').replaceChildren(svg);
  const tbl = $('#weekTable');
  tbl.replaceChildren(h('tr', {}, h('th', { scope: 'col' }, 'Jour'), h('th', { scope: 'col' }, 'Minutes')));
  for (const dd of days.slice().reverse()) tbl.append(h('tr', {}, h('td', {}, dayLabel(dd.k)), h('td', {}, String(dd.v))));
}
function renderMeters() {
  const wrap = $('#meters');
  wrap.replaceChildren();
  for (const c of CAT_ORDER) {
    const have = S.stats.byCat[c] || 0;
    const next = Object.keys(ITEMS).filter(k => ITEMS[k].group === c && lockInfo(k)).sort((a, b) => ITEMS[a].need - ITEMS[b].need)[0];
    let pct = 100, note = 'Tous les bâtiments ' + CATS[c].de + ' sont débloqués.';
    if (next) {
      const need = ITEMS[next].need;
      pct = clamp(have / need * 100, 0, 100);
      note = need === 1 ? ITEMS[next].name + ' : après ta première session.' : ITEMS[next].name + ' à ' + fmtMin(need) + ' (encore ' + fmtMin(need - have) + ').';
    }
    wrap.append(h('div', { class: 'meter-row' },
      h('div', { class: 'meter-top' }, h('span', { class: 'name' }, catDot(c), CATS[c].name), h('span', { class: 'val' }, fmtMin(have))),
      h('div', { class: 'meter', vars: { '--c': catVar(c) }, role: 'progressbar', 'aria-label': 'Progression ' + CATS[c].de, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(pct)) }, h('span', { style: 'width:' + pct + '%' })),
      h('span', { class: 'meter-note' }, note)));
  }
}
function reasonText(e) {
  if (e.reason === 'away') return "app quittée" + (e.away ? ' ' + fmtAway(e.away * 1000) : '');
  if (e.reason === 'closed') return 'app fermée pendant la session';
  return 'abandonnée';
}
function renderHistory() {
  const ul = $('#history');
  ul.replaceChildren();
  if (!S.history.length) { ul.append(h('li', {}, h('span', { class: 'empty-state' }, 'Pas encore de session. Lance une activité pour remplir ton journal.'))); return; }
  for (const e of S.history.slice(0, 25)) {
    const src = e.source === 'wishes' ? ' · tirage (envie)' : e.source === 'chores' ? ' · tirage (obligation)' : e.source === 'routine' ? ' · routine' : '';
    const duration = e.ok ? e.min + NB + 'min' : typeof e.elapsedSec === 'number' ? fmtEffort(e.elapsedSec / 60) + ' sur ' + e.min + NB + 'min' : e.min + NB + 'min prévues · temps effectué non enregistré';
    ul.append(h('li', {},
      h('div', { class: 'h-main' },
        h('span', { class: 'h-title' }, catDot(e.cat), e.name),
        h('span', { class: 'h-sub' }, whenLabel(e.at) + ' · ' + duration + src + (e.ok ? '' : ' · ' + reasonText(e)))),
      e.ok ? h('span', { class: 'h-val' }, '+' + fmt(e.reward))
           : h('span', { class: 'h-val lost' }, icon('lost'), 'Interrompue')));
  }
}

/* =========================================================================
   Fenêtres : boutique, bâtiment, réglages, mode strict, sauvegarde
   ========================================================================= */
