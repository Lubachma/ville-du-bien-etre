/* =========================================================================
   Objectifs souples, routines et personnalisation
   ========================================================================= */
function goalWeek(day = today()) {
  const weekday = new Date(keyToUTC(day)).getUTCDay();
  const start = shiftDay(day, -((weekday + 6) % 7));
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
    h('div', { class: 'meter', vars: { '--c': 'var(--accent)' }, role: 'progressbar', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': String(target), 'aria-valuenow': String(Math.min(value, target)), 'aria-valuetext': dec1(value) + ' sur ' + target }, h('span', { style: 'width:' + pct + '%' })));
}
function renderGoals() {
  const parent = $('#view-journal');
  if (!parent) return;
  let card = $('#goalsCard');
  if (!card) { card = h('section', { id: 'goalsCard', class: 'card feature-card', 'aria-label': 'Objectif hebdomadaire' }); $('#kpis').after(card); }
  const p = goalProgress(), g = p.goal;
  const range = dayFmt('short').format(keyToUTC(p.start)) + ' – ' + dayFmt('short').format(keyToUTC(p.end));
  card.replaceChildren(
    h('div', { class: 'feature-between' }, h('h3', {}, p.done ? 'Objectif atteint !' : 'Mon rythme de la semaine'),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: openGoals }, 'Modifier')),
    h('p', { class: 'sub' }, range + ' · ' + (g.cat === 'all' ? 'Tous les domaines' : catName(g.cat))),
    featureMeter('Minutes effectuées', p.minutes, g.minutes), featureMeter('Jours actifs', p.activeDays, g.days),
    h('p', { class: 'note' }, p.done ? 'Tu as atteint ton rythme. La suite est du bonus, à ton envie.' : 'Dès 1 minute effectuée, le jour compte. Choisis tes jours de repos : aucun jour imposé, aucune pénalité.'));
  if (g.building && ITEMS[g.building]) {
    const lock = lockInfo(g.building);
    card.append(h('p', { class: 'feature-target' }, icon('build'), h('span', {}, 'Mon bâtiment : ', h('strong', {}, itemName(g.building)), lock ? ' · encore ' + fmtMin(lock.need - lock.have) + (lock.cat ? ' ' + catOf(lock.cat) : ' au total') : ' · débloqué, à construire dans la boutique')));
  }
}
function openGoals() {
  const initial = S.goals || { minutes: 60, days: 3, cat: 'all', building: '' };
  openSheet('Mon objectif de la semaine', body => {
    const minutes = h('input', { class: 'input', id: 'goalMinutes', type: 'number', min: '5', max: '1260', step: '1', value: initial.minutes, required: true, inputmode: 'numeric' });
    const days = h('select', { class: 'select', id: 'goalDays' }, Array.from({ length: 7 }, (_, i) => h('option', { value: i + 1, selected: i + 1 === initial.days }, plural(i + 1, 'jour', 'jours'))));
    const cat = h('select', { class: 'select', id: 'goalCat' }, h('option', { value: 'all', selected: initial.cat === 'all' }, 'Tous les domaines'), catOptions(initial.cat));
    const building = h('select', { class: 'select', id: 'goalBuilding' }, h('option', { value: '', selected: !initial.building }, 'Laisser la ville me guider'), Object.keys(ITEMS).filter(k => ITEMS[k].group !== 'decor').map(k => h('option', { value: k, selected: k === initial.building }, itemName(k) + (lockInfo(k) ? '' : ' · débloqué'))));
    body.append(h('p', {}, 'Un cap du lundi au dimanche, à adapter à ta semaine. Chaque minute effectuée remplit cet objectif, même si tu interromps une session. Un jour actif compte dès 1 minute.'),
      h('form', { class: 'add-form', onsubmit: e => {
        e.preventDefault();
        S.goals = { minutes: int(Number(minutes.value), 5, 1260, 60), days: int(Number(days.value), 1, 7, 3), cat: isCat(cat.value) ? cat.value : 'all', building: isItem(building.value) ? building.value : '' };
        closeSheet(); commit(); toast('Ton rythme est enregistré.');
      } },
      h('div', { class: 'row-2' }, h('div', { class: 'field' }, h('label', { for: 'goalMinutes' }, 'Minutes par semaine'), minutes), h('div', { class: 'field' }, h('label', { for: 'goalDays' }, 'Jours actifs'), days)),
      h('div', { class: 'field' }, h('label', { for: 'goalCat' }, 'Domaine de l’objectif'), cat),
      h('div', { class: 'field' }, h('label', { for: 'goalBuilding' }, 'Bâtiment à viser'), building),
      h('p', { class: 'note' }, 'Le bâtiment suit tes minutes réussies dans son domaine, même si ton objectif hebdomadaire concerne un autre domaine. Les pièces restent nécessaires pour le construire.'),
      h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'submit' }, icon('check'), 'Enregistrer')));
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
  if (!card) { card = h('section', { id: 'routinesCard', class: 'card feature-card', 'aria-label': 'Mes routines' }); parent.append(card); }
  card.replaceChildren(h('div', { class: 'feature-between' }, h('h3', {}, 'Mes routines'), h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: openRoutines }, 'Gérer')));
  const progress = S.routineRun;
  if (progress) card.append(routineProgressCard(progress));
  const routines = S.routines || [];
  if (!routines.length) {
    card.append(h('p', { class: 'sub' }, 'Enchaîne 2 à 6 activités : respiration, lecture, étirements… À chaque étape, tu choisis quand continuer.'),
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => openRoutineEditor() }, icon('plus'), 'Créer ma première routine'));
    return;
  }
  const list = h('ul', { class: 'routine-list' });
  for (const routine of routines) {
    const d = routineSummary(routine);
    const btn = h('button', { class: 'btn btn-secondary btn-sm', type: 'button', disabled: d.missing || d.scheduled || !!S.active, onclick: () => launchRoutine(routine.id) }, icon('play'), 'Lancer');
    list.append(h('li', {}, h('div', { class: 'routine-main' }, h('strong', {}, routine.name), h('p', { class: 'note' }, d.missing ? 'Une activité a été supprimée : modifie cette routine.' : d.scheduled ? 'Une activité est devenue ponctuelle ou récurrente : modifie cette routine.' : routine.activityIds.length + ' étapes · ' + fmtMin(d.minutes))), btn));
  }
  card.append(list);
}
function routineProgressCard(progress) {
  const done = progress.status === 'done', active = routineIsActive(progress);
  const next = progress.steps[progress.next];
  const box = h('div', { class: 'routine-progress' },
    h('strong', {}, progress.name + (done ? ' · terminée' : ' · ' + progress.completed + '/' + progress.steps.length + ' étapes')),
    h('p', { class: 'note' }, done ? fmtMin(progress.minutes) + ' réalisées · ' + fmt(progress.reward) + ' gagnés' : active ? 'Une étape est en cours.' : 'En pause' + (next ? ' · prochaine étape : ' + next.name : '')));
  if (!done && !active) box.append(h('button', { class: 'btn btn-primary btn-sm', type: 'button', disabled: !!S.active, onclick: () => continueRoutine(progress.id) }, icon('play'), progress.completed ? 'Reprendre la routine' : 'Commencer la routine'));
  if (!active) {
    const stop = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, done ? 'Fermer le bilan' : 'Terminer ici');
    const finish = () => { if (S.routineRun && S.routineRun.id === progress.id && !routineIsActive()) { S.routineRun = null; closeSheet(); commit(); } };
    if (done) stop.addEventListener('click', finish); else twoStep(stop, 'Terminer ici', 'Confirmer la fin', finish);
    box.append(stop);
  }
  return box;
}
function openRoutines() {
  openSheet('Mes routines', body => {
    body.append(h('p', {}, 'Les étapes se suivent dans l’ordre choisi. Chaque activité garde son mode et sa durée. La pause entre deux étapes est libre.'));
    if (S.routineRun) body.append(routineProgressCard(S.routineRun));
    for (const routine of S.routines || []) {
      const d = routineSummary(routine);
      body.append(h('div', { class: 'routine-edit-row' },
        h('div', { class: 'routine-main' }, h('strong', {}, routine.name), h('p', { class: 'note' }, d.steps.map(a => a ? a.name : 'Activité supprimée').join(' → '))),
        h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => openRoutineEditor(routine.id) }, 'Modifier')));
    }
    body.append(h('button', { class: 'btn btn-primary', type: 'button', disabled: (S.routines || []).length >= 20, onclick: () => openRoutineEditor() }, icon('plus'), 'Créer une routine'));
    if ((S.routines || []).length >= 20) body.append(h('p', { class: 'note' }, 'Tu as atteint 20 routines. Tu peux modifier ou supprimer une routine existante.'));
  });
}
function openRoutineEditor(id) {
  const current = id ? (S.routines || []).find(r => r.id === id) : null;
  if (id && !current) return;
  let selected = current ? [...current.activityIds] : [];
  openSheet(current ? 'Modifier la routine' : 'Nouvelle routine', body => {
    const name = h('input', { class: 'input', id: 'routineName', maxlength: '40', value: current ? current.name : '', required: true, placeholder: 'Ex. Mon réveil en douceur' });
    const choices = h('select', { class: 'select', id: 'routineActivity', 'aria-label': 'Activité à ajouter' }, S.activities.filter(a => !a.repeat || a.repeat === 'always').map(a => h('option', { value: a.id }, a.name + ' · ' + a.min + NB + 'min')));
    const steps = h('ol', { class: 'routine-steps', 'aria-label': 'Étapes dans l’ordre' });
    const error = h('p', { class: 'note', role: 'status' });
    const add = h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { if (selected.length < 6 && S.activities.some(a => a.id === choices.value && (!a.repeat || a.repeat === 'always'))) { selected.push(choices.value); drawSteps(); } } }, icon('plus'), 'Ajouter');
    const total = h('p', { class: 'note' });
    function drawSteps() {
      steps.replaceChildren();
      selected.forEach((activityId, i) => {
        const a = S.activities.find(x => x.id === activityId);
        const label = a ? a.name : 'Activité supprimée';
        const up = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', disabled: i === 0, 'aria-label': 'Monter l’étape ' + (i + 1) + ' : ' + label, onclick: () => { [selected[i - 1], selected[i]] = [selected[i], selected[i - 1]]; drawSteps(); const target = steps.children[i - 1].querySelector('button'); (target.disabled ? steps.children[i - 1].querySelectorAll('button')[1] : target).focus(); } }, '↑');
        const down = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', disabled: i === selected.length - 1, 'aria-label': 'Descendre l’étape ' + (i + 1) + ' : ' + label, onclick: () => { [selected[i], selected[i + 1]] = [selected[i + 1], selected[i]]; drawSteps(); const target = steps.children[i + 1].querySelectorAll('button')[1]; (target.disabled ? steps.children[i + 1].querySelector('button') : target).focus(); } }, '↓');
        const del = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'aria-label': 'Retirer l’étape ' + (i + 1) + ' : ' + label, onclick: () => { selected.splice(i, 1); drawSteps(); add.focus(); } }, icon('trash'));
        steps.append(h('li', {}, h('span', { class: 'routine-step-name' }, (i + 1) + '. ' + label, a ? h('span', { class: 'note' }, a.min + NB + 'min · ' + (a.mode === 'free' ? 'Activité libre' : 'Concentration')) : null), h('div', { class: 'routine-step-actions' }, up, down, del)));
      });
      add.disabled = selected.length >= 6 || !S.activities.some(a => !a.repeat || a.repeat === 'always');
      total.textContent = frTypo(selected.length + '/6 étapes · ' + fmtMin(selected.reduce((sum, key) => sum + ((S.activities.find(a => a.id === key) || {}).min || 0), 0)));
      error.textContent = '';
    }
    body.append(h('form', { class: 'add-form', onsubmit: e => {
      e.preventDefault();
      const title = name.value.trim().slice(0, 40);
      if (!title) { name.focus(); return; }
      if (selected.length < 2 || selected.length > 6) { error.textContent = 'Choisis entre 2 et 6 étapes.'; return; }
      if (selected.some(key => !S.activities.some(a => a.id === key && (!a.repeat || a.repeat === 'always')))) { error.textContent = 'Retire les activités supprimées, ponctuelles ou récurrentes.'; return; }
      S.routines = S.routines || [];
      const existing = id && S.routines.find(r => r.id === id);
      if (id && !existing) { toast('Cette routine a été supprimée sur un autre écran.'); closeSheet(); return; }
      if (existing) { existing.name = title; existing.activityIds = [...selected]; }
      else { if (S.routines.length >= 20) { error.textContent = 'La limite de 20 routines est atteinte.'; return; } S.routines.push({ id: uid(), name: title, activityIds: [...selected] }); }
      closeSheet(); commit(); toast('Routine enregistrée.');
    } }, h('div', { class: 'field' }, h('label', { for: 'routineName' }, 'Nom'), name),
      h('div', { class: 'field' }, h('label', { for: 'routineActivity' }, 'Ajouter une étape'), h('div', { class: 'routine-add' }, choices, add)),
      steps, total, h('p', { class: 'note' }, 'Les routines utilisent les activités toujours disponibles, que tu peux répéter. Les tâches ponctuelles ou récurrentes se lancent séparément. Une routine commencée conserve ses étapes initiales.'), error,
      h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'submit' }, icon('check'), 'Enregistrer la routine')));
    if (!S.activities.length) body.append(h('p', { class: 'note' }, 'Ajoute d’abord tes activités dans l’onglet Activités.'));
    if (current) {
      const remove = h('button', { class: 'btn btn-ghost', type: 'button' }, 'Supprimer la routine');
      twoStep(remove, 'Supprimer la routine', 'Confirmer la suppression', () => { S.routines = S.routines.filter(r => r.id !== id); closeSheet(); commit(); toast('Routine supprimée.'); });
      body.append(remove);
    }
    drawSteps();
  });
}
function launchRoutine(id) {
  Store.pullLocal();
  if (S.active) { toast('Termine d’abord la session en cours.'); return; }
  const routine = (S.routines || []).find(r => r.id === id);
  if (!routine) return;
  const next = makeRoutineRun(routine);
  if (!next) { toast('Cette routine contient une activité supprimée ou planifiée. Modifie ses étapes.'); return; }
  const start = () => {
    Store.pullLocal();
    if (S.active) { toast('Une session est déjà en cours.'); return; }
    S.routineRun = next; closeSheet(); commit({ flush: true }); continueRoutine(next.id);
  };
  if (S.routineRun && S.routineRun.status !== 'done') {
    openSheet('Remplacer la routine en pause ?', body => body.append(
      h('p', {}, 'Les étapes déjà réussies de « ' + S.routineRun.name + ' » restent dans ton journal. La suite sera remplacée par « ' + routine.name + ' ».'),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: start }, 'Commencer la nouvelle routine'), h('button', { class: 'btn btn-secondary', type: 'button', onclick: closeSheet }, 'Garder la routine en pause')));
  } else start();
}
function continueRoutine(id) {
  if (S.active) { toast('Termine d’abord la session en cours.'); return; }
  const progress = S.routineRun;
  if (!progress || progress.id !== id || progress.status === 'done') { toast('Cette routine est déjà terminée ou a été remplacée.'); return; }
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
  const box = h('div', { class: 'routine-result' }, h('h3', {}, done ? 'Routine terminée !' : progress.name + ' · étape ' + progress.completed + '/' + progress.steps.length),
    h('p', {}, fmtMin(progress.minutes) + ' réalisées · ' + fmt(progress.reward) + ' gagnés'));
  if (done) box.append(h('p', { class: 'note' }, 'Toutes les étapes sont dans ton journal. Tu peux prendre le temps de profiter de ta ville.'));
  else if (next) box.append(h('p', { class: 'note' }, 'Fais une pause si tu le souhaites. À suivre : ' + next.name + ' · ' + next.min + NB + 'min.'),
    h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: () => continueRoutine(progress.id) }, icon('play'), 'Étape suivante'),
    h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { closeSession(); go('activites'); } }, 'Reprendre plus tard'));
  const actions = $('.res-actions', res);
  if (actions) actions.before(box); else res.append(box);
}

/* Les niveaux récompensent la pratique après le déblocage. Les décors n’ont
   pas de niveau ; les seuils n’ajoutent ni dépense ni obligation quotidienne. */
function buildingLevelInfo(key, state = S) {
  const it = ITEMS[key];
  if (!it || it.group === 'decor') return { level: 0, have: 0, thresholds: [] };
  const have = it.needTotal ? CAT_ORDER.reduce((sum, cat) => sum + (state.stats.byCat[cat] || 0), 0) : state.stats.byCat[it.group] || 0;
  const baseline = it.needTotal || (it.need > 1 ? it.need : 0);
  const thresholds = [baseline + 120, baseline + 360];
  return { level: have >= thresholds[1] ? 3 : have >= thresholds[0] ? 2 : 1, have, thresholds };
}
function buildingLevel(key) { return buildingLevelInfo(key).level; }
function buildingLevelText(key) {
  const info = buildingLevelInfo(key), it = ITEMS[key];
  if (!info.level) return '';
  const labels = ['Naissance', 'Épanouissement', 'Rayonnement'];
  return 'Niveau ' + info.level + ' · ' + labels[info.level - 1] + (info.level < 3 ? ' · niveau ' + (info.level + 1) + ' à ' + fmtMin(info.thresholds[info.level - 1]) + (it.needTotal ? ' au total' : ' ' + catOf(it.group)) : ' · niveau maximum');
}
function openCityPersonalization() {
  openSheet('Ma ville à moi', body => {
    const name = h('input', { class: 'input', id: 'cityName', maxlength: '40', value: cityName(), required: true });
    body.append(h('form', { class: 'add-form', onsubmit: e => { e.preventDefault(); const title = name.value.trim().slice(0, 40); if (!title) { name.focus(); return; } S.personal = { ...(S.personal || {}), name: title }; closeSheet(); commit(); toast('Ta ville a un nouveau nom.'); } },
      h('div', { class: 'field' }, h('label', { for: 'cityName' }, 'Nom de ma ville'), name), h('button', { class: 'btn btn-primary', type: 'submit' }, icon('check'), 'Enregistrer le nom')),
      h('hr', { class: 'divider' }), h('h3', { class: 'section-title' }, 'Une ville qui grandit avec toi'),
      h('p', {}, 'Les bâtiments gagnent des niveaux avec les minutes réussies dans leur domaine. Après leur seuil de déblocage, 2 heures de pratique mènent au niveau 2, puis 6 heures au niveau 3. Les décors restent libres.'),
      h('p', { class: 'note' }, 'Touche un bâtiment de ta ville pour voir son niveau et le prochain seuil. Les niveaux sont gratuits et restent acquis, même après des jours de repos.'),
      h('button', { class: 'btn btn-secondary btn-block', type: 'button', onclick: exportCityImage }, icon('download'), 'Enregistrer une image de ma ville'));
  });
}
async function exportCityImage() {
  try {
    const source = typeof City.snapshot === 'function' ? City.snapshot() : $('#city');
    const width = Math.max(1200, source.width), ratio = width / source.width, margin = Math.round(width * .05), head = Math.round(width * .12), foot = Math.round(width * .065);
    const cityH = Math.round(source.height * ratio);
    const out = document.createElement('canvas');
    out.width = width; out.height = cityH + head + foot;
    const ctx = out.getContext('2d');
    // Le dessin de la ville est transparent : on remet le ciel de l'app (et ses étoiles la nuit).
    const sky = ctx.createLinearGradient(0, 0, 0, out.height);
    sky.addColorStop(0, cssVar('--sky-top') || '#d3e8e0');
    sky.addColorStop(1, cssVar('--sky-bottom') || '#f3f6ec');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, out.width, out.height);
    if (cssVar('--night') === '1') {
      ctx.fillStyle = '#ffffff';
      for (const [x, y, r] of [[.12, .18, 1.2], [.28, .09, 1], [.47, .15, 1.4], [.63, .06, 1], [.78, .2, 1.3], [.9, .1, 1], [.08, .32, 1], [.94, .34, 1.1]]) {
        ctx.beginPath(); ctx.arc(x * width, head + y * cityH, r * width / 360, 0, Math.PI * 2); ctx.fill();
      }
    }
    const titleFont = '400 ' + Math.round(width * .036) + 'px "Young Serif", Georgia, serif';
    const footFont = '600 ' + Math.round(width * .019) + 'px Figtree, system-ui, sans-serif';
    if (document.fonts && document.fonts.load) await Promise.all([document.fonts.load(titleFont), document.fonts.load(footFont)]).catch(() => {});
    ctx.fillStyle = cssVar('--ink') || '#20332a'; ctx.textBaseline = 'middle'; ctx.font = titleFont;
    ctx.fillText(frTypo(cityName()), margin, head * .55, width - margin * 2);
    ctx.drawImage(source, 0, head, width, cityH);
    ctx.fillStyle = cssVar('--muted') || '#536459'; ctx.font = footFont;
    ctx.fillText(frTypo('Ville du bien-être · ' + fmtEffort(totalEffortMinutes()) + ' pour prendre soin de moi'), margin, out.height - foot * .5, width - margin * 2);
    const blob = await new Promise(resolve => out.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG indisponible');
    const filename = 'ma-ville-' + today() + '.png';
    if (isIOS() && typeof File === 'function') {
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    }
    const url = URL.createObjectURL(blob), link = h('a', { href: url, download: filename, hidden: true });
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); toast('Image de ta ville téléchargée.');
  } catch (e) { toast('Impossible de créer l’image pour le moment. Réessaie depuis la ville.'); }
}
