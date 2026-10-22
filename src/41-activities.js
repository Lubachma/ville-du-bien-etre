/* ---------- Activités, modes et disponibilité ---------- */
// Choix proposés, [valeur, libellé] dans la langue affichée.
// Un choix : sa valeur, son libellé, et sa forme dans une phrase (le dictionnaire la donne : en allemand, les noms gardent leur majuscule).
const choiceOf = (value, key) => [value, t(key), t(key + '.inline')];
const actEnergies = () => [choiceOf('low', 'act.energyLow'), choiceOf('medium', 'act.energyMedium'), choiceOf('high', 'act.energyHigh')];
const actPlaces = () => [choiceOf('any', 'act.placeAny'), choiceOf('inside', 'act.placeInside'), choiceOf('outside', 'act.placeOutside')];
const actRepeats = () => [choiceOf('always', 'act.repeatAlways'), choiceOf('once', 'act.repeatOnce'), choiceOf('daily', 'act.repeatDaily'), choiceOf('weekly', 'act.repeatWeekly')];
function activityOptions(choices, value) { return choices.map(([v, label]) => h('option', { value: v, selected: v === value ? true : null }, label)); }
function activityModeLabel(mode) { return mode === 'free' ? t('act.modeFree') : t('act.modeFocus'); }
function activityModeNote(mode) {
  return mode === 'free' ? t('act.modeFreeNote') : t('act.modeFocusNote', { grace: S.settings.grace });
}
function taskNextDay(it) {
  if (!it.completedAt || !['daily', 'weekly'].includes(it.repeat)) return null;
  return shiftDay(dayOf(it.completedAt), it.repeat === 'weekly' ? 7 : 1);
}
function taskAvailable(it, at = nowTs()) {
  if (!it.completedAt || !it.repeat || it.repeat === 'always') return true;
  if (it.repeat === 'once') return false;
  const next = taskNextDay(it);
  return !next || dayOf(at) >= next;
}
function taskStatus(it) {
  if (!taskAvailable(it)) {
    const next = taskNextDay(it);
    return next ? t('act.statusWaiting', { day: dayLabel(next) }) : t('act.statusDoneOnce');
  }
  const repeat = actRepeats().find(([value]) => value === it.repeat);
  return repeat && it.repeat !== 'always' ? t('act.statusRepeat', { repeat: repeat[2] }) : '';
}
// Appelée uniquement à la réussite d’une session, avant le commit de la récompense.
function completeTask(a) {
  const key = a.source === 'direct' ? 'activities' : a.source;
  if (!['activities', 'wishes', 'chores'].includes(key)) return;
  const id = a.sourceId || (a.draw && a.draw.id);
  const it = S[key].find(item => item.id === id);
  if (it) {
    const now = nowTs();
    // Une activité libre peut être rouverte le lendemain de sa fin : sa
    // fréquence repart de l’échéance réelle, pas de la réouverture de l’app.
    it.completedAt = a.mode === 'free' && validTs(a.startedAt) && validTs(a.deadline)
      ? Math.max(a.startedAt, Math.min(now, a.deadline)) : now;
  }
}
function resetTask(key, id) {
  const it = S[key].find(item => item.id === id);
  if (!it) return;
  it.completedAt = 0;   // même valeur que normalize() pour « jamais terminée »
  commit();
  toast(t('act.resetDone'));
}
function activityFields(prefix, it = {}) {
  const select = (name, label, choices, value) => h('div', { class: 'field' },
    h('label', { for: prefix + name }, label),
    h('select', { class: 'select', id: prefix + name, name }, activityOptions(choices, value)));
  return h('div', { class: 'activity-fields' },
    select('mode', t('act.mode'), [['focus', t('act.modeFocus')], ['free', t('act.modeFree')]], it.mode || 'focus'),
    select('repeat', t('act.repeat'), actRepeats(), it.repeat || 'always'),
    select('energy', t('act.energy'), actEnergies(), it.energy || 'medium'),
    select('place', t('act.place'), actPlaces(), it.place || 'any'));
}
function readActivityFields(form, defaults = {}) {
  const choice = (name, allowed, fallback) => {
    const field = form.elements.namedItem(name);
    const value = field ? field.value : defaults[name];
    return allowed.includes(value) ? value : fallback;
  };
  return {
    mode: choice('mode', ['focus', 'free'], 'focus'),
    energy: choice('energy', ['low', 'medium', 'high'], 'medium'),
    place: choice('place', ['any', 'inside', 'outside'], 'any'),
    repeat: choice('repeat', ['always', 'once', 'daily', 'weekly'], 'always'),
  };
}
// force : la langue a changé, on reconstruit les blocs en gardant les choix en cours.
function enhanceActivityForms(force) {
  for (const [id, repeat] of [['addActForm', 'always'], ['addWish', 'always'], ['addChore', 'once']]) {
    const form = $('#' + id);
    if (!form) continue;
    const old = $('.activity-options', form);
    if (old && !force) continue;
    const fields = activityFields(id + '-', old ? readActivityFields(form, { repeat }) : { repeat });
    const details = h('details', { class: 'activity-options', open: old && old.open ? true : null }, h('summary', {}, t('act.optionsSummary')), fields,
      h('p', { class: 'note' }, t('act.optionsNote')));
    if (old) old.replaceWith(details);
    else if (id === 'addActForm') form.insertBefore(details, $('button[type="submit"]', form));
    else form.append(details);
  }
}

let editingActs = false;
function renderActivities() {
  const grid = $('#actsGrid');
  grid.replaceChildren();
  $('#editActs').setAttribute('aria-pressed', String(editingActs));
  $('#editActs').lastChild.textContent = editingActs ? t('act.doneEditing') : t('act.edit');
  $('#addActForm').hidden = !editingActs;
  $('#actsLede').textContent = frTypo(editingActs ? t('act.ledeEditing') : t('act.lede'));
  for (const a of S.activities) {
    const available = taskAvailable(a);
    // En mode Modifier, la carte est le bouton de modification de l'activité.
    const card = h('button', { class: 'act' + (!available ? ' task-waiting' : ''), type: 'button', vars: { '--c': catVar(a.cat) },
      'data-focus-key': (editingActs ? 'act-edit:' : 'act:') + a.id,
      'aria-label': editingActs || !available ? t('act.editNamed', { name: displayName(a.name) }) : null,
      onclick: () => { if (editingActs || !available) openEditSheet('activities', a.id); else openStartSheet(a); } },
      h('span', { class: 'act-name' }, displayName(a.name)), catLabel(a.cat),
      h('span', { class: 'act-mode' }, activityModeLabel(a.mode)),
      h('span', { class: 'act-meta' }, a.min + NB + 'min · ' + fmt(a.min * RATE)),
      taskStatus(a) ? h('span', { class: 'task-status' }, taskStatus(a)) : null);
    if (editingActs) grid.append(h('div', { class: 'act-wrap' }, card,
      h('button', { class: 'act-del', type: 'button', 'data-focus-key': 'act-del:' + a.id, 'aria-label': t('act.deleteNamed', { name: displayName(a.name) }), onclick: () => removeWithUndo('activities', a.id) }, icon('trash'))));
    else grid.append(card);
  }
  if (!S.activities.length) grid.append(h('p', { class: 'empty-state', style: 'grid-column:1/-1' }, t('act.empty', { button: t('act.edit') })));
  if (typeof renderRoutines === 'function') renderRoutines();
}

function openStartSheet(act, options = {}) {
  let min = act.min, mode = act.mode === 'free' ? 'free' : 'focus';
  const durs = DURATIONS.includes(act.min) ? DURATIONS : [...DURATIONS, act.min].sort((a, b) => a - b);
  openSheet(displayName(act.name), body => {
    const chips = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': t('act.duration') });
    const modes = h('div', { class: 'chips mode-choices', role: 'radiogroup', 'aria-label': t('act.sessionMode') });
    const preview = h('p', { class: 'note' });
    const modeNote = h('p', { class: 'note', id: 'startModeNote', 'aria-live': 'polite' });
    const startBtn = h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'button', onclick: () => {
      const key = options.source && options.source !== 'direct' ? options.source : 'activities';
      const current = S[key] && S[key].find(item => item.id === act.id);
      if (current && !taskAvailable(current)) { closeSheet(); toast(t('act.taskUnavailable')); return; }
      closeSheet();
      beginSession(Object.assign({}, options, { name: act.name, cat: act.cat, min, mode, source: options.source || 'direct', sourceId: act.id }));
    } }, icon('play'), h('span', {}, ''));
    for (const d of durs) chips.append(h('button', { class: 'chip', type: 'button', role: 'radio', 'aria-checked': String(d === min), tabindex: d === min ? '0' : '-1', onclick: () => { min = d; update(); } }, d + NB + 'min'));
    for (const m of ['focus', 'free']) modes.append(h('button', { class: 'chip', type: 'button', role: 'radio', 'data-mode': m,
      'aria-checked': String(m === mode), 'aria-describedby': 'startModeNote', tabindex: m === mode ? '0' : '-1', onclick: () => { mode = m; update(); } }, activityModeLabel(m)));
    function update() {
      $$('.chip', chips).forEach((c, i) => { c.setAttribute('aria-checked', String(durs[i] === min)); c.tabIndex = durs[i] === min ? 0 : -1; });
      $$('.chip', modes).forEach(c => { c.setAttribute('aria-checked', String(c.dataset.mode === mode)); c.tabIndex = c.dataset.mode === mode ? 0 : -1; });
      const r = rewardFor(min, options.drawPct || 0);
      preview.textContent = frTypo(r.streakPct && S.settings.hideStreak ? t('act.gainPreviewConsistency', { coins: fmt(r.total), pct: r.streakPct })
        : r.streakPct ? t('act.gainPreviewStreak', { coins: fmt(r.total), days: r.streakDays, pct: r.streakPct })
        : r.returnPct ? t('act.gainPreviewReturn', { coins: fmt(r.total), welcome: t('result.welcomeBack'), pct: r.returnPct })
        : t('act.gainPreview', { coins: fmt(r.total) }));
      modeNote.textContent = frTypo(activityModeNote(mode));
      startBtn.lastChild.textContent = t('act.startButton', { min });
    }
    body.append(catLabel(act.cat),
      options.fixedDuration ? h('p', { class: 'sub' }, t('act.drawDuration', { min }))
        : h('div', { class: 'field' }, h('span', { class: 'sub' }, t('act.duration')), chips),
      h('div', { class: 'field' }, h('span', { class: 'sub' }, t('act.sessionMode')), modes), modeNote, preview, startBtn);
    update();
  });
}
// Le tirage déjà effectué garde ses valeurs, même après une modification de la liste.
function openEditSheet(key, id) {
  const it = S[key].find(x => x.id === id);
  if (!it) return;
  const title = key === 'activities' ? t('act.editActivity') : key === 'wishes' ? t('act.editWish') : t('act.editChore');
  openSheet(title, body => {
    const name = h('input', { class: 'input', id: 'editName', maxlength: '40', value: displayName(it.name), autocomplete: 'off', required: true });
    const cat = h('select', { class: 'select', id: 'editCat' }, catOptions(it.cat));
    const min = h('select', { class: 'select', id: 'editMin' }, minOptions(it.min));
    const form = h('form', { class: 'add-form', onsubmit: e => {
      e.preventDefault();
      const cur = S[key].find(x => x.id === id);
      if (!cur) { closeSheet(); toast(t('act.gone')); return; }
      const nm = name.value.trim().slice(0, 40);
      if (!nm) { name.focus(); return; }
      cur.name = nm;
      if (isCat(cat.value)) cur.cat = cat.value;
      cur.min = int(Number(min.value), 1, 180, cur.min);
      Object.assign(cur, readActivityFields(form));
      delete cur.ex;
      closeSheet(); commit(); toast(t('act.saved'));
    } },
      h('div', { class: 'field' }, h('label', { for: 'editName' }, t('act.name')), name),
      h('div', { class: 'row-2' },
        h('div', { class: 'field' }, h('label', { for: 'editCat' }, t('act.domain')), cat),
        h('div', { class: 'field' }, h('label', { for: 'editMin' }, t('act.duration')), min)),
      activityFields('edit-', it),
      h('p', { class: 'note' }, t('act.editNote')),
      h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'submit' }, icon('check'), t('common.save')));
    if (!taskAvailable(it)) form.append(h('p', { class: 'task-status' }, taskStatus(it)),
      h('button', { class: 'btn btn-secondary btn-block', type: 'button', onclick: () => { closeSheet(); resetTask(key, id); } }, icon('reroll'), t('act.makeAvailable')));
    body.append(form);
  });
}
