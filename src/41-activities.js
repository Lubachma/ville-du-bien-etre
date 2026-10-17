/* ---------- Activités, modes et disponibilité ---------- */
const ACT_ENERGIES = [['low', 'Douce'], ['medium', 'Modérée'], ['high', 'Soutenue']];
const ACT_PLACES = [['any', 'Peu importe'], ['inside', 'À l’intérieur'], ['outside', 'À l’extérieur']];
const ACT_REPEATS = [['always', 'Toujours disponible'], ['once', 'Une seule fois'], ['daily', 'Chaque jour'], ['weekly', 'Tous les 7 jours']];
function activityOptions(choices, value) { return choices.map(([v, label]) => h('option', { value: v, selected: v === value ? true : null }, label)); }
function activityModeLabel(mode) { return mode === 'free' ? 'Activité libre' : 'Concentration'; }
function activityModeNote(mode) {
  return mode === 'free'
    ? 'Marche, sport, musique… le chrono continue avec l’écran verrouillé ou une autre app. Reviens ici pour retrouver la fin de la session.'
    : 'Garde l’app à l’écran. Après plus de ' + S.settings.grace + NB + 's d’absence, la session est interrompue ; le temps effectué reste dans le journal.';
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
    return next ? 'En attente · disponible ' + dayLabel(next) : 'Terminée · une seule fois';
  }
  const repeat = ACT_REPEATS.find(([value]) => value === it.repeat);
  return repeat && it.repeat !== 'always' ? 'Disponible · ' + repeat[1].toLowerCase() : '';
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
  it.completedAt = null;
  commit();
  toast('Remise à disposition.');
}
function activityFields(prefix, it = {}) {
  const select = (name, label, choices, value) => h('div', { class: 'field' },
    h('label', { for: prefix + name }, label),
    h('select', { class: 'select', id: prefix + name, name }, activityOptions(choices, value)));
  return h('div', { class: 'activity-fields' },
    select('mode', 'Mode', [['focus', 'Concentration'], ['free', 'Activité libre']], it.mode || 'focus'),
    select('repeat', 'Fréquence', ACT_REPEATS, it.repeat || 'always'),
    select('energy', 'Énergie nécessaire', ACT_ENERGIES, it.energy || 'medium'),
    select('place', 'Lieu', ACT_PLACES, it.place || 'any'));
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
function enhanceActivityForms() {
  for (const [id, repeat] of [['addActForm', 'always'], ['addWish', 'always'], ['addChore', 'once']]) {
    const form = $('#' + id);
    if (!form || $('.activity-fields', form)) continue;
    const fields = activityFields(id + '-', { repeat });
    const details = h('details', { class: 'activity-options' }, h('summary', {}, 'Mode, fréquence et contexte'), fields,
      h('p', { class: 'note' }, 'Le contexte aide le tirage à proposer une idée adaptée. Une tâche ponctuelle ou récurrente quitte le tirage après une session réussie.'));
    if (id === 'addActForm') form.insertBefore(details, $('button[type="submit"]', form));
    else form.append(details);
  }
}

let editingActs = false;
function renderActivities() {
  const grid = $('#actsGrid');
  grid.replaceChildren();
  $('#editActs').setAttribute('aria-pressed', String(editingActs));
  $('#editActs').lastChild.textContent = editingActs ? 'Terminé' : 'Modifier';
  $('#addActForm').hidden = !editingActs;
  $('#actsLede').textContent = frTypo(editingActs
    ? 'Touche une activité pour modifier son mode, sa durée ou sa fréquence.'
    : 'Choisis une activité et lance le chrono. Chaque minute terminée rapporte 1' + NB + 'M de pièces.');
  for (const a of S.activities) {
    const available = taskAvailable(a);
    const card = h('button', { class: 'act' + (!available ? ' task-waiting' : ''), type: 'button', vars: { '--c': catVar(a.cat) },
      'aria-label': editingActs || !available ? 'Modifier ' + a.name : null,
      onclick: () => { if (editingActs || !available) openEditSheet('activities', a.id); else openStartSheet(a); } },
      h('span', { class: 'act-name' }, a.name), catLabel(a.cat),
      h('span', { class: 'act-mode' }, activityModeLabel(a.mode)),
      h('span', { class: 'act-meta' }, a.min + NB + 'min · ' + fmt(a.min * RATE)),
      taskStatus(a) ? h('span', { class: 'task-status' }, taskStatus(a)) : null);
    if (editingActs) grid.append(h('div', { class: 'act-wrap' }, card,
      h('button', { class: 'act-del', type: 'button', 'aria-label': 'Supprimer ' + a.name, onclick: () => removeWithUndo('activities', a.id) }, icon('trash'))));
    else grid.append(card);
  }
  if (!S.activities.length) grid.append(h('p', { class: 'empty-state', style: 'grid-column:1/-1' }, 'Aucune activité. Touche « Modifier » pour en ajouter.'));
  if (typeof renderRoutines === 'function') renderRoutines();
}

function openStartSheet(act, options = {}) {
  let min = act.min, mode = act.mode === 'free' ? 'free' : 'focus';
  const durs = DURATIONS.includes(act.min) ? DURATIONS : [...DURATIONS, act.min].sort((a, b) => a - b);
  openSheet(act.name, body => {
    const chips = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Durée' });
    const modes = h('div', { class: 'chips mode-choices', role: 'radiogroup', 'aria-label': 'Mode de session' });
    const preview = h('p', { class: 'note' });
    const modeNote = h('p', { class: 'note', id: 'startModeNote', 'aria-live': 'polite' });
    const startBtn = h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'button', onclick: () => {
      const key = options.source && options.source !== 'direct' ? options.source : 'activities';
      const current = S[key] && S[key].find(item => item.id === act.id);
      if (current && !taskAvailable(current)) { closeSheet(); toast('Cette tâche est terminée ou en attente de sa prochaine échéance.'); return; }
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
      preview.textContent = frTypo('Gain à la fin : ' + fmt(r.total) + (r.streakPct ? ' (série de ' + r.streakDays + NB + 'jours : +' + r.streakPct + NB + '%)' : '') + '.');
      modeNote.textContent = frTypo(activityModeNote(mode));
      startBtn.lastChild.textContent = 'Commencer · ' + min + NB + 'min';
    }
    body.append(catLabel(act.cat),
      options.fixedDuration ? h('p', { class: 'sub' }, 'Durée du tirage : ' + min + NB + 'min. Le bonus du tirage est conservé.')
        : h('div', { class: 'field' }, h('span', { class: 'sub' }, 'Durée'), chips),
      h('div', { class: 'field' }, h('span', { class: 'sub' }, 'Mode de session'), modes), modeNote, preview, startBtn);
    update();
  });
}
// Le tirage déjà effectué garde ses valeurs, même après une modification de la liste.
function openEditSheet(key, id) {
  const it = S[key].find(x => x.id === id);
  if (!it) return;
  const title = key === 'activities' ? 'Modifier l’activité' : key === 'wishes' ? 'Modifier l’envie' : 'Modifier l’obligation';
  openSheet(title, body => {
    const name = h('input', { class: 'input', id: 'editName', maxlength: '40', value: it.name, autocomplete: 'off', required: true });
    const cat = h('select', { class: 'select', id: 'editCat' }, catOptions(it.cat));
    const min = h('select', { class: 'select', id: 'editMin' }, minOptions(it.min));
    const form = h('form', { class: 'add-form', onsubmit: e => {
      e.preventDefault();
      const cur = S[key].find(x => x.id === id);
      if (!cur) { closeSheet(); toast('Cet élément n’existe plus.'); return; }
      const nm = name.value.trim().slice(0, 40);
      if (!nm) { name.focus(); return; }
      cur.name = nm;
      if (isCat(cat.value)) cur.cat = cat.value;
      cur.min = int(Number(min.value), 1, 180, cur.min);
      Object.assign(cur, readActivityFields(form));
      delete cur.ex;
      closeSheet(); commit(); toast('Modifications enregistrées.');
    } },
      h('div', { class: 'field' }, h('label', { for: 'editName' }, 'Nom'), name),
      h('div', { class: 'row-2' },
        h('div', { class: 'field' }, h('label', { for: 'editCat' }, 'Domaine'), cat),
        h('div', { class: 'field' }, h('label', { for: 'editMin' }, 'Durée'), min)),
      activityFields('edit-', it),
      h('p', { class: 'note' }, 'Concentration garde l’app à l’écran. Activité libre continue écran verrouillé. La fréquence s’applique après une session réussie.'),
      h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'submit' }, icon('check'), 'Enregistrer'));
    if (!taskAvailable(it)) form.append(h('p', { class: 'task-status' }, taskStatus(it)),
      h('button', { class: 'btn btn-secondary btn-block', type: 'button', onclick: () => { closeSheet(); resetTask(key, id); } }, icon('reroll'), 'Remettre disponible'));
    body.append(form);
  });
}
