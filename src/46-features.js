/* =========================================================================
   Objectifs souples, routines et personnalisation
   ========================================================================= */
function goalWeek(day = today()) {
  const start = weekStartOf(day);
  return { start, end: shiftDay(start, 6), days: Array.from({ length: 7 }, (_, i) => shiftDay(start, i)) };
}
function goalProgress(state = S, day = today()) {
  const week = goalWeek(day), goal = state.goals || { minutes: 60, days: 3, cat: 'all', building: '' };
  const stats = state.stats.effort || state.stats;
  let minutes = 0, days = 0;
  for (const key of week.days) {
    let value;
    if (goal.cat === 'all') value = stats.days[key] || 0;
    else if (stats.dailyCats && own(stats.dailyCats, key)) value = stats.dailyCats[key][goal.cat] || 0;
    else value = state.history.filter(e => e.cat === goal.cat && (e.day || dayOf(e.at)) === key).reduce((sum, e) => sum + (e.ok ? e.min : (e.elapsedSec || 0) / 60), 0);
    minutes += value;
    if (value >= 1) days++;
  }
  return { ...week, minutes, activeDays: days, goal, done: minutes >= goal.minutes && days >= goal.days };
}
function featureMeter(label, value, target) {
  const pct = Math.round(clamp(value / target * 100, 0, 100));
  return h('div', { class: 'goal-meter' },
    h('div', { class: 'feature-between' }, h('span', {}, label), h('strong', {}, dec1(value) + ' / ' + target)),
    h('div', { class: 'meter', vars: { '--c': 'var(--accent)' }, role: 'progressbar', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': String(target), 'aria-valuenow': String(Math.min(value, target)), 'aria-valuetext': t('goal.valueOf', { value: dec1(value), target }) }, h('span', { style: 'width:' + pct + '%' })));
}
function renderGoals() {
  const parent = $('#view-journal');
  if (!parent) return;
  let card = $('#goalsCard');
  if (!card) { card = h('section', { id: 'goalsCard', class: 'card feature-card', 'aria-label': t('goal.cardLabel') }); $('#kpis').after(card); }
  const p = goalProgress(), g = p.goal;
  const range = dayFmt('short').format(keyToUTC(p.start)) + ' – ' + dayFmt('short').format(keyToUTC(p.end));
  card.replaceChildren(
    h('div', { class: 'feature-between' }, h('h3', {}, p.done ? t('goal.reached') : t('goal.title')),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-focus-key': 'goals:edit', onclick: openGoals }, t('common.edit'))),
    h('p', { class: 'sub' }, range + ' · ' + (g.cat === 'all' ? t('goal.allDomains') : catName(g.cat))),
    featureMeter(t('goal.minutesDone'), p.minutes, g.minutes), featureMeter(t('goal.activeDays'), p.activeDays, g.days),
    h('p', { class: 'note' }, p.done ? t('goal.doneNote') : t('goal.note')));
  if (g.building && ITEMS[g.building]) {
    const lock = lockInfo(g.building), site = isWonder(g.building) ? wonderTile(g.building) : null;
    const params = { item: h('strong', {}, itemName(g.building)), time: lock ? fmtMin(lock.need - lock.have) : '', cat: lock && lock.cat ? catName(lock.cat) : '', of: lock && lock.cat ? catOf(lock.cat) : '', g: itemGender(g.building) };
    card.append(h('p', { class: 'feature-target' }, icon('build'), h('span', {}, site ? wonderGoal(site, params) : !lock ? tParts('goal.buildingUnlocked', params) : lock.cat ? tParts('goal.buildingLeftCat', params) : tParts('goal.buildingLeftTotal', params))));
  }
}
// Merveille choisie dont le chantier a commencé : l'étape qui vient, ou l'inauguration faite.
function wonderGoal(tile, params) {
  const next = wonderNext(tile);
  if (!next) return tParts('goal.wonderDone', params);
  return tParts(next.ready ? 'goal.wonderStageReady' : 'goal.wonderStageLeft', { ...params, stage: next.stage, time: fmtMin(next.need - next.have) });
}
function openGoals() {
  const initial = S.goals || { minutes: 60, days: 3, cat: 'all', building: '' };
  openSheet(t('goal.sheetTitle'), body => {
    const minutes = h('input', { class: 'input', id: 'goalMinutes', type: 'number', min: '5', max: '1260', step: '1', value: initial.minutes, required: true, inputmode: 'numeric' });
    const days = h('select', { class: 'select', id: 'goalDays' }, Array.from({ length: 7 }, (_, i) => h('option', { value: i + 1, selected: i + 1 === initial.days }, t('unit.days', { n: i + 1 }))));
    const cat = h('select', { class: 'select', id: 'goalCat' }, h('option', { value: 'all', selected: initial.cat === 'all' }, t('goal.allDomains')), catOptions(initial.cat));
    const building = h('select', { class: 'select', id: 'goalBuilding' }, h('option', { value: '', selected: !initial.building }, t('goal.letCityGuide')), Object.keys(ITEMS).filter(k => ITEMS[k].group !== 'decor').map(k => h('option', { value: k, selected: k === initial.building }, lockInfo(k) ? itemName(k) : t('goal.itemUnlocked', { item: itemName(k) }))));
    body.append(h('p', {}, S.settings.weekStart === 'sun' ? t('goal.introSun') : t('goal.intro')),
      h('form', { class: 'add-form', onsubmit: e => {
        e.preventDefault();
        S.goals = { minutes: int(Number(minutes.value), 5, 1260, 60), days: int(Number(days.value), 1, 7, 3), cat: isCat(cat.value) ? cat.value : 'all', building: isItem(building.value) ? building.value : '' };
        closeSheet(); commit(); toast(t('goal.saved'));
      } },
      h('div', { class: 'row-2' }, h('div', { class: 'field' }, h('label', { for: 'goalMinutes' }, t('goal.minutesPerWeek')), minutes), h('div', { class: 'field' }, h('label', { for: 'goalDays' }, t('goal.activeDays')), days)),
      h('div', { class: 'field' }, h('label', { for: 'goalCat' }, t('goal.domain')), cat),
      h('div', { class: 'field' }, h('label', { for: 'goalBuilding' }, t('goal.building')), building),
      h('p', { class: 'note' }, t('goal.buildingNote')),
      h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'submit' }, icon('check'), t('common.save'))));
  });
}

/* Une routine conserve les activités choisies dans l’ordre. Au lancement, on fige
   leurs valeurs pour que la suite reste cohérente si une activité est modifiée. */
function routineSteps(routine, state = S) {
  return routine.activityIds.map(id => state.activities.find(a => a.id === id) || null);
}
function routineSummary(routine, state = S) {
  const steps = routineSteps(routine, state);
  return { steps, missing: steps.some(a => !a), scheduled: steps.some(a => a && a.repeat && a.repeat !== 'always'), minutes: steps.reduce((sum, a) => sum + (a ? a.min : 0), 0) };
}
function makeRoutineRun(routine, state = S) {
  const detail = routineSummary(routine, state);
  if (detail.missing || detail.scheduled || detail.steps.length < 2 || detail.steps.length > 6) return null;
  return {
    id: uid(), routineId: routine.id, name: routine.name,
    steps: detail.steps.map(a => ({ activityId: a.id, name: a.name, cat: a.cat, min: a.min, mode: a.mode === 'free' ? 'free' : 'focus' })),
    next: 0, completed: 0, minutes: 0, reward: 0, startedAt: Date.now(), finishedAt: 0, status: 'paused',
  };
}
function routineIsActive(progress = S.routineRun) { return !!(progress && S.active && S.active.routineRunId === progress.id); }
function renderRoutines() {
  const parent = $('#view-activites');
  if (!parent) return;
  let card = $('#routinesCard');
  if (!card) { card = h('section', { id: 'routinesCard', class: 'card feature-card', 'aria-label': t('routine.title') }); parent.append(card); }
  // « Gérer », et « Créer ma première routine » qui lui laisse la place une fois la routine enregistrée : même clé.
  card.replaceChildren(h('div', { class: 'feature-between' }, h('h3', {}, t('routine.title')), h('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-focus-key': 'routines:manage', onclick: openRoutines }, t('routine.manage'))));
  const progress = S.routineRun;
  if (progress) card.append(routineProgressCard(progress));
  const routines = S.routines || [];
  if (!routines.length) {
    card.append(h('p', { class: 'sub' }, t('routine.emptyIntro')),
      h('button', { class: 'btn btn-secondary', type: 'button', 'data-focus-key': 'routines:manage', onclick: () => openRoutineEditor() }, icon('plus'), t('routine.createFirst')));
    return;
  }
  const list = h('ul', { class: 'routine-list' });
  for (const routine of routines) {
    const d = routineSummary(routine);
    const btn = h('button', { class: 'btn btn-secondary btn-sm', type: 'button', 'data-focus-key': 'routine:' + routine.id, disabled: d.missing || d.scheduled || !!S.active, onclick: () => launchRoutine(routine.id) }, icon('play'), t('routine.launch'));
    list.append(h('li', {}, h('div', { class: 'routine-main' }, h('strong', {}, routine.name), h('p', { class: 'note' }, d.missing ? t('routine.missing') : d.scheduled ? t('routine.scheduled') : t('routine.summary', { n: routine.activityIds.length, time: fmtMin(d.minutes) }))), btn));
  }
  card.append(list);
}
function routineProgressCard(progress) {
  const done = progress.status === 'done', active = routineIsActive(progress);
  const next = progress.steps[progress.next];
  const box = h('div', { class: 'routine-progress' },
    h('strong', {}, done ? t('routine.progressDone', { name: progress.name }) : t('routine.progressSteps', { name: progress.name, done: progress.completed, total: progress.steps.length })),
    h('p', { class: 'note' }, done ? t('routine.doneSummary', { time: fmtMin(progress.minutes), coins: fmt(progress.reward) }) : active ? t('routine.stepRunning') : next ? t('routine.pausedNext', { name: displayName(next.name) }) : t('routine.paused')));
  if (!done && !active) box.append(h('button', { class: 'btn btn-primary btn-sm', type: 'button', disabled: !!S.active, onclick: () => continueRoutine(progress.id) }, icon('play'), progress.completed ? t('routine.resume') : t('routine.start')));
  if (!active) {
    const stop = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, done ? t('routine.closeSummary') : t('routine.endHere'));
    const finish = () => { if (S.routineRun && S.routineRun.id === progress.id && !routineIsActive()) { S.routineRun = null; closeSheet(); commit(); } };
    if (done) stop.addEventListener('click', finish); else twoStep(stop, t('routine.endHere'), t('routine.endConfirm'), finish);
    box.append(stop);
  }
  return box;
}
function openRoutines() {
  openSheet(t('routine.title'), body => {
    body.append(h('p', {}, t('routine.sheetIntro')));
    if (S.routineRun) body.append(routineProgressCard(S.routineRun));
    for (const routine of S.routines || []) {
      const d = routineSummary(routine);
      body.append(h('div', { class: 'routine-edit-row' },
        h('div', { class: 'routine-main' }, h('strong', {}, routine.name), h('p', { class: 'note' }, d.steps.map(a => a ? displayName(a.name) : t('routine.deletedActivity')).join(' → '))),
        h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => openRoutineEditor(routine.id) }, t('common.edit'))));
    }
    body.append(h('button', { class: 'btn btn-primary', type: 'button', disabled: (S.routines || []).length >= 20, onclick: () => openRoutineEditor() }, icon('plus'), t('routine.create')));
    if ((S.routines || []).length >= 20) body.append(h('p', { class: 'note' }, t('routine.limitReached', { max: 20 })));
  });
}
function openRoutineEditor(id) {
  const current = id ? (S.routines || []).find(r => r.id === id) : null;
  if (id && !current) return;
  let selected = current ? [...current.activityIds] : [];
  openSheet(current ? t('routine.editTitle') : t('routine.newTitle'), body => {
    const name = h('input', { class: 'input', id: 'routineName', maxlength: '40', value: current ? current.name : '', required: true, placeholder: t('routine.namePlaceholder') });
    const choices = h('select', { class: 'select', id: 'routineActivity', 'aria-label': t('routine.activityToAdd') }, S.activities.filter(a => !a.repeat || a.repeat === 'always').map(a => h('option', { value: a.id }, displayName(a.name) + ' · ' + a.min + NB + 'min')));
    const steps = h('ol', { class: 'routine-steps', 'aria-label': t('routine.stepsLabel') });
    const error = h('p', { class: 'note', role: 'status' });
    const add = h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => {
      const chosen = S.activities.find(a => a.id === choices.value && (!a.repeat || a.repeat === 'always'));
      if (selected.length >= 6 || !chosen) return;
      selected.push(chosen.id);
      drawSteps();
      // La liste change sous le bouton, qui garde le focus : l'étape ajoutée est annoncée.
      announce(t('routine.stepAdded', { n: selected.length, name: displayName(chosen.name) }));
    } }, icon('plus'), t('routine.add'));
    const total = h('p', { class: 'note' });
    function drawSteps() {
      steps.replaceChildren();
      selected.forEach((activityId, i) => {
        const a = S.activities.find(x => x.id === activityId);
        const label = a ? displayName(a.name) : t('routine.deletedActivity');
        const up = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', disabled: i === 0, 'aria-label': t('routine.moveUp', { n: i + 1, name: label }), onclick: () => { [selected[i - 1], selected[i]] = [selected[i], selected[i - 1]]; drawSteps(); const target = steps.children[i - 1].querySelector('button'); (target.disabled ? steps.children[i - 1].querySelectorAll('button')[1] : target).focus(); } }, '↑');
        const down = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', disabled: i === selected.length - 1, 'aria-label': t('routine.moveDown', { n: i + 1, name: label }), onclick: () => { [selected[i], selected[i + 1]] = [selected[i + 1], selected[i]]; drawSteps(); const target = steps.children[i + 1].querySelectorAll('button')[1]; (target.disabled ? steps.children[i + 1].querySelector('button') : target).focus(); } }, '↓');
        const del = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'aria-label': t('routine.removeStep', { n: i + 1, name: label }), onclick: () => { selected.splice(i, 1); drawSteps(); add.focus(); } }, icon('trash'));
        steps.append(h('li', {}, h('span', { class: 'routine-step-name' }, (i + 1) + '. ' + label, a ? h('span', { class: 'note' }, a.min + NB + 'min · ' + activityModeLabel(a.mode)) : null), h('div', { class: 'routine-step-actions' }, up, down, del)));
      });
      add.disabled = selected.length >= 6 || !S.activities.some(a => !a.repeat || a.repeat === 'always');
      total.textContent = frTypo(t('routine.total', { n: selected.length, time: fmtMin(selected.reduce((sum, key) => sum + ((S.activities.find(a => a.id === key) || {}).min || 0), 0)) }));
      error.textContent = '';
    }
    body.append(h('form', { class: 'add-form', onsubmit: e => {
      e.preventDefault();
      const title = name.value.trim().slice(0, 40);
      if (!title) { rejectBlank(name); return; }
      if (selected.length < 2 || selected.length > 6) { error.textContent = t('routine.errorCount'); return; }
      if (selected.some(key => !S.activities.some(a => a.id === key && (!a.repeat || a.repeat === 'always')))) { error.textContent = t('routine.errorInvalid'); return; }
      S.routines = S.routines || [];
      const existing = id && S.routines.find(r => r.id === id);
      if (id && !existing) { toast(t('routine.deletedElsewhere')); closeSheet(); return; }
      if (existing) { existing.name = title; existing.activityIds = [...selected]; }
      else { if (S.routines.length >= 20) { error.textContent = t('routine.errorLimit', { max: 20 }); return; } S.routines.push({ id: uid(), name: title, activityIds: [...selected] }); }
      closeSheet(); commit(); toast(t('routine.saved'));
    } }, h('div', { class: 'field' }, h('label', { for: 'routineName' }, t('act.name')), name),
      h('div', { class: 'field' }, h('label', { for: 'routineActivity' }, t('routine.addStep')), h('div', { class: 'routine-add' }, choices, add)),
      steps, total, h('p', { class: 'note' }, t('routine.editorNote')), error,
      h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'submit' }, icon('check'), t('routine.saveButton'))));
    if (!S.activities.length) body.append(h('p', { class: 'note' }, t('routine.noActivities')));
    if (current) {
      const remove = h('button', { class: 'btn btn-ghost', type: 'button' }, t('routine.delete'));
      twoStep(remove, t('routine.delete'), t('routine.deleteConfirm'), () => { S.routines = S.routines.filter(r => r.id !== id); closeSheet(); commit(); toast(t('routine.deleted')); });
      body.append(remove);
    }
    drawSteps();
  });
}
function launchRoutine(id) {
  Store.pullLocal();
  if (S.active) { toast(t('routine.finishCurrent')); return; }
  const routine = (S.routines || []).find(r => r.id === id);
  if (!routine) return;
  const next = makeRoutineRun(routine);
  if (!next) { toast(t('routine.cannotLaunch')); return; }
  const start = () => {
    Store.pullLocal();
    if (S.active) { toast(t('routine.sessionRunning')); return; }
    S.routineRun = next; closeSheet(); commit({ flush: true }); continueRoutine(next.id);
  };
  if (S.routineRun && S.routineRun.status !== 'done') {
    openSheet(t('routine.replaceTitle'), body => body.append(
      h('p', {}, t('routine.replaceText', { old: S.routineRun.name, new: routine.name })),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: start }, t('routine.startNew')), h('button', { class: 'btn btn-secondary', type: 'button', onclick: closeSheet }, t('routine.keepPaused'))));
  } else start();
}
function continueRoutine(id) {
  if (S.active) { toast(t('routine.finishCurrent')); return; }
  const progress = S.routineRun;
  if (!progress || progress.id !== id || progress.status === 'done') { toast(t('routine.alreadyDone')); return; }
  const step = progress.steps[progress.next];
  if (!step) return;
  closeSheet();
  if (!$('#session').hidden) closeSession();
  beginSession({ ...step, source: 'routine', routineRunId: progress.id, routineStep: progress.next });
}
function onRoutineSessionComplete(a, total) {
  const progress = S.routineRun;
  if (!progress || a.routineRunId !== progress.id || a.routineStep !== progress.next || progress.status === 'done') return false;
  progress.next += 1;
  progress.completed += 1;
  progress.minutes += a.min;
  progress.reward = clamp(progress.reward + total, 0, COINS_MAX);
  if (progress.next >= progress.steps.length) { progress.status = 'done'; progress.finishedAt = Date.now(); }
  return true;
}
function renderRoutineResult(res, a) {
  if (!a.routineRunId) return;
  const progress = S.routineRun;
  if (!progress || progress.id !== a.routineRunId) return;
  const done = progress.status === 'done', next = progress.steps[progress.next];
  const box = h('div', { class: 'routine-result' }, h('h3', {}, done ? t('routine.resultDone') : t('routine.resultStep', { name: progress.name, done: progress.completed, total: progress.steps.length })),
    h('p', {}, t('routine.doneSummary', { time: fmtMin(progress.minutes), coins: fmt(progress.reward) })));
  if (done) box.append(h('p', { class: 'note' }, t('routine.resultDoneNote')));
  else if (next) box.append(h('p', { class: 'note' }, t('routine.resultNext', { name: displayName(next.name), min: next.min })),
    h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: () => continueRoutine(progress.id) }, icon('play'), t('routine.nextStep')),
    h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { closeSession(); go('activites'); } }, t('routine.later')));
  const actions = $('.res-actions', res);
  if (actions) actions.before(box); else res.append(box);
}

/* Les niveaux récompensent la pratique après le déblocage. Les décors n’ont
   pas de niveau ; les seuils n’ajoutent ni dépense ni obligation quotidienne. */
function buildingLevelInfo(key, state = S) {
  const it = ITEMS[key];
  if (!it || it.group === 'decor' || it.wonder) return { level: 0, have: 0, thresholds: [] };
  const have = it.needTotal ? CAT_ORDER.reduce((sum, cat) => sum + (state.stats.byCat[cat] || 0), 0) : state.stats.byCat[it.group] || 0;
  const baseline = it.needTotal || (it.need > 1 ? it.need : 0);
  const thresholds = [baseline + 120, baseline + 360];
  return { level: have >= thresholds[1] ? 3 : have >= thresholds[0] ? 2 : 1, have, thresholds };
}
function buildingLevel(key) { return buildingLevelInfo(key).level; }
function buildingLevelText(key) {
  const info = buildingLevelInfo(key), it = ITEMS[key];
  if (!info.level) return '';
  const labels = [t('level.name1'), t('level.name2'), t('level.name3')];
  const params = { level: info.level, name: labels[info.level - 1], next: info.level + 1, time: fmtMin(info.thresholds[info.level - 1] || 0), cat: it.needTotal ? '' : catName(it.group), of: it.needTotal ? '' : catOf(it.group) };
  return info.level >= 3 ? t('level.max', params) : it.needTotal ? t('level.nextTotal', params) : t('level.nextCat', params);
}
function openCityPersonalization() {
  openSheet(t('city.personalTitle'), body => {
    const name = h('input', { class: 'input', id: 'cityName', maxlength: '40', value: cityName(), required: true });
    body.append(h('form', { class: 'add-form', onsubmit: e => { e.preventDefault(); const title = cleanName(name.value, 40); if (!title) { rejectBlank(name); return; } S.personal = { ...(S.personal || {}), name: title }; closeSheet(); commit(); toast(t('city.renamed')); } },
      h('div', { class: 'field' }, h('label', { for: 'cityName' }, t('city.nameLabel')), name), h('button', { class: 'btn btn-primary', type: 'submit' }, icon('check'), t('city.saveName'))),
      h('hr', { class: 'divider' }), h('h3', { class: 'section-title' }, t('city.growsTitle')),
      h('p', {}, t('city.growsText')),
      h('p', { class: 'note' }, t('city.growsNote')),
      h('button', { class: 'btn btn-secondary btn-block', type: 'button', onclick: exportCityImage }, icon('download'), t('city.saveImage')));
  });
}
// Image de sa ville, au moins 1 200 pixels de large : son nom, sa ville (jamais celle d'une visite) sous le ciel du moment, puis un pied
// de deux lignes, le temps pris pour soi et l'adresse de l'app.
async function cityImageCanvas() {
  const source = typeof City.snapshot === 'function' ? City.snapshot() : $('#city');
  const width = Math.max(1200, source.width), ratio = width / source.width, margin = Math.round(width * .05), head = Math.round(width * .12), foot = Math.round(width * .095);
  const cityH = Math.round(source.height * ratio);
  const out = document.createElement('canvas');
  out.width = width; out.height = cityH + head + foot;
  const ctx = out.getContext('2d');
  // Le dessin de la ville est transparent : on remet son ciel, et ses étoiles la nuit.
  const sky = paintImageSky(ctx, width, out.height, { x: 0, y: head, w: width, h: cityH });
  const titleFont = '400 ' + Math.round(width * .036) + 'px "Young Serif", Georgia, serif';
  const footFont = '600 ' + Math.round(width * .019) + 'px Figtree, system-ui, sans-serif';
  if (document.fonts && document.fonts.load) await Promise.all([document.fonts.load(titleFont), document.fonts.load(footFont)]).catch(() => {});
  ctx.fillStyle = imageInk(sky, head * .55 / out.height).ink; ctx.textBaseline = 'middle'; ctx.font = titleFont;
  ctx.fillText(frTypo(cityName()), margin, head * .55, width - margin * 2);
  ctx.drawImage(source, 0, head, width, cityH);
  // Les deux lignes du pied, de part et d'autre du milieu du pied, dans la même police et la même encre.
  const mid = out.height - foot * .5, gap = Math.round(width * .03);
  ctx.fillStyle = imageInk(sky, 1 - foot * .5 / out.height).muted; ctx.font = footFont;
  ctx.fillText(frTypo(t('png.footer', { time: fmtEffort(totalEffortMinutes()) })), margin, mid - gap / 2, width - margin * 2);
  ctx.fillText(appAddress(), margin, mid + gap / 2, width - margin * 2);
  return out;
}
// « Enregistrer une image de ma ville » : par le partage de l'iPhone s'il accepte les fichiers, sinon par un téléchargement.
async function exportCityImage() {
  try {
    const out = await cityImageCanvas(), blob = await new Promise(resolve => out.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('toBlob');
    const filename = 'ma-ville-' + today() + '.png';
    if (isIOS() && typeof File === 'function') {
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    }
    const url = URL.createObjectURL(blob), link = h('a', { href: url, download: filename, hidden: true });
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); toast(t('png.downloaded'));
  } catch (e) { toast(t('png.failed')); }
}
