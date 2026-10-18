function strictContent(body) {
  body.append(
    h('p', {}, t('strict.intro')),
    h('ul', { class: 'info-list' },
      h('li', {}, icon('lock'), h('span', {}, h('strong', {}, t('wake.iphoneLabel')), t('strict.iphoneText'))),
      h('li', {}, icon('lock'), h('span', {}, h('strong', {}, t('wake.androidLabel')), t('strict.androidText'))),
      h('li', { class: 'warn' }, icon('alert'), h('span', {}, t('strict.warn')))),
    h('p', { class: 'note' }, t('strict.note', { grace: S.settings.grace })));
}
function openStrict() { openSheet(t('strict.title'), strictContent, { keep: true }); }

function syncText() {
  if (Store.localError) return t('sync.localError');
  if (Store.localWarning) return Store.localWarning;
  if (Store.status === 'connecting') return t('sync.connecting');
  if (Store.mode === 'cloud' && Store.status === 'ok') return t('sync.cloudOk');
  if (Store.status === 'retrying') return t('sync.retrying');
  if (Store.status === 'error') return t('sync.error');
  if (isStandalone()) return t('sync.standalone');
  return t('sync.browser');
}
function isStandalone() {
  try { return navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches; } catch (e) { return false; }
}
function renderSyncStatus() {
  const el = $('#syncStatus');
  if (el) el.textContent = frTypo(syncText());
}

function exportBackup() {
  const data = clone(S);
  data.active = null;
  const body = b64encode(JSON.stringify(data));
  return 'VBE2.' + body + '.' + hash53(BACKUP_SALT + body);
}
function readBackup(text) {
  const m = String(text || '').trim().match(/^VBE([12])\.([A-Za-z0-9_-]+)\.([0-9a-z]+)$/);
  if (!m) return { error: t('backup.notBackupText') };
  if (hash53(BACKUP_SALT + m[2]) !== m[3]) return { error: t('backup.tampered') };
  try {
    const raw = JSON.parse(b64decode(m[2]));
    if (!raw || raw.v !== Number(m[1])) return { error: t('backup.unreadable') };
    return { state: normalize(raw) };
  } catch (e) { return { error: t('backup.unreadable') }; }
}
function summary(st) {
  const last = st.history.length ? whenLabel(st.history[0].at) : t('backup.noSession');
  return t('backup.summary', { coins: fmt(st.coins), buildings: t('city.captionBuildings', { n: st.city.tiles.length }), sessions: t('backup.sessionsOk', { n: st.stats.ok }), last });
}
function restoreBackup(st) {
  if (S.active || run) { toast(t('backup.finishSessionFirst')); return; }
  const clock = S.clock;
  S = st;
  S.active = null;
  S.clock = { tz: clock.tz, maxSeen: Math.max(clock.maxSeen, st.clock.maxSeen), lastDay: maxDay(clock.lastDay, st.clock.lastDay) };
  Mode.state = null;
  closeSheet();
  refreshLang();
  const saved = commit({ flush: true });
  City.relayout();
  // Une sauvegarde d'avant la mise à jour reçoit ses succès d'un coup : ce message remplace le suivant.
  const caught = typeof catchUpCarnet === 'function' ? catchUpCarnet() : null;
  if (!caught || (!caught.achievements.length && !caught.sets.length)) toast(saved ? t('backup.restored') : t('backup.restoredNotSaved'));
}

/* Sauvegarde dans un fichier, et rappel quand la dernière date un peu (gardé par appareil). */
function lsNum(key) { try { return Number(localStorage.getItem(key)) || 0; } catch (e) { return 0; } }
function lsSet(key, v) { try { localStorage.setItem(key, String(v)); } catch (e) { /* ignore */ } }
function agoText(ts) {
  const k = dayOf(ts), now = today();
  if (k >= now) return t('backup.agoToday');
  if (k === shiftDay(now, -1)) return t('backup.agoYesterday');
  return t('backup.agoDays', { n: Math.round((keyToUTC(now) - keyToUTC(k)) / 86400000) });
}
function lastBackupText() {
  const at = lsNum(LS_BACKUP_AT);
  return at ? t('backup.lastExport', { ago: agoText(at) }) : t('backup.noExport');
}
function markBackup() {
  lsSet(LS_BACKUP_AT, Date.now());
  lsSet(LS_REMIND, 0);
  const line = $('#backupLast');
  if (line) line.textContent = frTypo(lastBackupText());
  if (currentTab === 'ville') renderVille();
}
// Rappel si la ville a changé depuis la dernière sauvegarde et que celle-ci a plus de 14 jours.
function backupDue() {
  if (Store.mode === 'cloud' || S.stats.ok < 3 || Date.now() < lsNum(LS_REMIND)) return false;
  const at = lsNum(LS_BACKUP_AT);
  return S.updatedAt > at && Date.now() - at > BACKUP_EVERY;
}
function renderRemind() {
  const rm = $('#remind');
  rm.replaceChildren();
  rm.hidden = !backupDue();
  if (rm.hidden) return;
  const at = lsNum(LS_BACKUP_AT);
  rm.append(icon('shield'), h('div', { class: 'remind-main' },
    h('p', {}, h('strong', {}, t('backup.remindTitle'))),
    h('p', { class: 'note' }, at ? t('backup.remindLast', { ago: agoText(at) }) : t('backup.remindNone')),
    h('div', { class: 'remind-actions' },
      h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => saveBackupFile() }, icon('download'), t('backup.save')),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { lsSet(LS_REMIND, Date.now() + 7 * 86400000); renderVille(); } }, t('common.later')))));
}
function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
// Sur iPhone : feuille de partage (« Enregistrer dans Fichiers »…). Ailleurs : téléchargement.
async function shareOrDownload(text, filename, mime) {
  if (isIOS() && typeof File === 'function') {
    try {
      const file = new File([text], filename, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return 'shared';
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = h('a', { href: url, download: filename, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'downloaded';
}
async function saveBackupFile() {
  const result = await shareOrDownload(exportBackup(), 'ville-du-bien-etre-' + today() + '.txt', 'text/plain');
  if (result === 'cancelled') return;
  markBackup();
  toast(result === 'shared' ? t('backup.shared') : t('backup.downloaded'));
}

// Remet toute l'interface dans la langue de la ville : réglage, sauvegarde restaurée, autre onglet.
function refreshLang() {
  setLang(S.settings.lang);
  applyStaticText();
  fillSelects();
  enhanceActivityForms(true);
  // Construits une seule fois : ils reviennent au prochain rendu, dans la nouvelle langue.
  for (const id of ['#drawFilters', '#goalsCard', '#routinesCard', '#carnetCard']) { const el = $(id); if (el) el.remove(); }
  storageStatusSignature = '';
}
function changeLang(pref) {
  if (!['auto', ...langs()].includes(pref)) return;
  S.settings.lang = pref;
  commit({ silent: true });
  refreshLang();
  renderAll();
  openSettings();
  setTimeout(() => { const radio = $('#settingsLang [aria-checked="true"]'); if (radio) radio.focus({ preventScroll: true }); }, 40);
}

/* Réglages : une fonction par section, assemblées dans l'ordre de la conception. */
function settingsBlock(id, ...kids) { return h('div', { class: 'settings-section', id }, ...kids); }
function settingsStart() {
  return settingsBlock('settingsStart', h('div', { class: 'setting' },
    h('button', { class: 'btn btn-secondary btn-block', type: 'button', onclick: openHelp }, icon('info'), t('settings.helpButton')),
    h('p', { class: 'note', id: 'pwaStatus', role: 'status' }, pwaText()),
    h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => {
      if (window.VillePWA) window.VillePWA.check().then(() => { renderPwaStatus(); toast(t('pwa.checked')); }, () => toast(t('pwa.checkFailed')));
    } }, t('pwa.checkButton'))));
}
function settingsLang() {
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('settings.lang') });
  // Les noms des langues gardent leur propre langue, pour la lecture vocale.
  for (const [v, label] of langChoices()) seg.append(h('button', { type: 'button', role: 'radio', lang: v === 'auto' ? null : v, 'aria-checked': String(S.settings.lang === v), onclick: () => { if (S.settings.lang !== v) changeLang(v); } }, label));
  return settingsBlock('settingsLang', h('div', { class: 'setting' },
    h('span', { class: 'section-title' }, t('settings.lang')), h('p', { class: 'note' }, t('settings.langNote')), seg));
}
function settingsSessions() {
  const graceSeg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('settings.grace') });
  for (const g of GRACE_CHOICES) graceSeg.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(S.settings.grace === g), onclick: () => { S.settings.grace = g; commit({ silent: true }); $$('button', graceSeg).forEach((b, i) => b.setAttribute('aria-checked', String(GRACE_CHOICES[i] === g))); } }, g + NB + 's'));
  const sw = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(S.settings.keepAwake), 'aria-label': t('settings.keepAwake'), onclick: () => { S.settings.keepAwake = !S.settings.keepAwake; sw.setAttribute('aria-checked', String(S.settings.keepAwake)); commit({ silent: true }); } });
  const soundSw = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(S.settings.sound), 'aria-label': t('settings.sound'), onclick: () => {
    S.settings.sound = !S.settings.sound;
    soundSw.setAttribute('aria-checked', String(S.settings.sound));
    commit({ silent: true });
    if (S.settings.sound) Chime.preview();   // pour l'entendre une fois
  } });
  // Type et volume : chaque choix fait entendre le son, pendant le geste.
  const soundSeg = (label, values, labels, key) => {
    const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    for (const v of values) seg.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(S.settings[key] === v), onclick: () => {
      S.settings[key] = v;
      commit({ silent: true });
      $$('button', seg).forEach((b, i) => b.setAttribute('aria-checked', String(values[i] === v)));
      Chime.preview();
    } }, labels[v]));
    return seg;
  };
  const typeSeg = soundSeg(t('settings.soundType'), SOUND_TYPES, { chime: t('settings.soundChime'), bowl: t('settings.soundBowl'), bells: t('settings.soundBells') }, 'soundType');
  const volumeSeg = soundSeg(t('settings.volume'), Object.keys(SOUND_GAIN), { soft: t('settings.volumeSoft'), normal: t('settings.volumeNormal'), loud: t('settings.volumeLoud') }, 'soundVolume');
  // Pas de vibreur (iPhone, ordinateur) : pas d'interrupteur.
  const vibrateSw = typeof navigator.vibrate === 'function' ? h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(S.settings.vibrate), 'aria-label': t('settings.vibrate'), onclick: () => {
    S.settings.vibrate = !S.settings.vibrate;
    vibrateSw.setAttribute('aria-checked', String(S.settings.vibrate));
    commit({ silent: true });
    if (S.settings.vibrate) { try { navigator.vibrate(160); } catch (e) { /* pas de vibreur */ } }
  } }) : null;
  return settingsBlock('settingsSessions',
    h('div', { class: 'setting' },
      h('span', { class: 'section-title' }, t('settings.grace')),
      h('p', { class: 'note' }, t('settings.graceNote')),
      graceSeg),
    h('div', { class: 'setting-row' }, h('span', { class: 'setting-label' }, t('settings.keepAwake')), sw),
    h('div', { class: 'setting' },
      h('div', { class: 'setting-row' }, h('span', { class: 'setting-label' }, t('settings.sound')), soundSw),
      h('p', { class: 'note' }, t('settings.soundNote')),
      h('span', { class: 'setting-label' }, t('settings.soundType')), typeSeg,
      h('span', { class: 'setting-label' }, t('settings.volume')), volumeSeg),
    vibrateSw ? h('div', { class: 'setting-row' }, h('span', { class: 'setting-label' }, t('settings.vibrate')), vibrateSw) : null);
}
// Série : repos par semaine, pause, masquage. Un changement ne redessine que cette section.
function settingsStreak(focus) {
  const redraw = target => { const next = settingsStreak(target); section.replaceWith(next); };
  const restSeg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('settings.restDays') });
  for (const n of [0, 1, 2]) restSeg.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(S.settings.restDays === n), onclick: () => {
    S.settings.restDays = n;
    commit();
    $$('button', restSeg).forEach((b, i) => b.setAttribute('aria-checked', String(i === n)));
  } }, String(n)));
  const pause = pauseActive();
  const pauseBtn = h('button', { class: 'btn btn-secondary', type: 'button', 'data-role': 'pause', onclick: () => {
    if (pause) endPause(); else startPause();
    commit();
    redraw('[data-role="pause"]');
  } }, icon(pause ? 'play' : 'pause'), pause ? t('settings.resume') : t('settings.pause'));
  const hideSw = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(S.settings.hideStreak), 'aria-label': t('settings.hideStreak'), onclick: () => {
    S.settings.hideStreak = !S.settings.hideStreak;
    hideSw.setAttribute('aria-checked', String(S.settings.hideStreak));
    commit();
  } });
  const section = settingsBlock('settingsStreak',
    h('div', { class: 'setting' },
      h('span', { class: 'section-title' }, t('settings.streakTitle')),
      h('span', { class: 'setting-label' }, t('settings.restDays')),
      h('p', { class: 'note' }, t('settings.restNote')),
      restSeg),
    h('div', { class: 'setting' },
      pause ? h('p', { class: 'note' }, t('streak.pausedSince', { date: dayLabel(pause.from) })) : h('p', { class: 'note' }, t('settings.pauseNote')),
      pauseBtn),
    h('div', { class: 'setting-row' }, h('span', { class: 'setting-label' }, t('settings.hideStreak')), hideSw));
  if (focus) setTimeout(() => { const el = $(focus, section); if (el) el.focus({ preventScroll: true }); }, 0);
  return section;
}
// Semaine et rappel : début de semaine (série et objectif), rappel quotidien ajouté à l'agenda.
function settingsWeek() {
  const starts = ['mon', 'sun'], labels = { mon: t('settings.weekMon'), sun: t('settings.weekSun') };
  const weekSeg = h('div', { class: 'seg seg-2', role: 'radiogroup', 'aria-label': t('settings.weekStart') });
  for (const v of starts) weekSeg.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(S.settings.weekStart === v), onclick: () => {
    S.settings.weekStart = v;
    commit();
    $$('button', weekSeg).forEach((b, i) => b.setAttribute('aria-checked', String(starts[i] === v)));
  } }, labels[v]));
  const time = h('input', { class: 'input', type: 'time', id: 'reminderTime', value: reminderTime(), required: true });
  const google = h('a', { class: 'btn btn-ghost', href: googleCalendarUrl(reminderTime(), new Date()), target: '_blank', rel: 'noopener' }, t('reminder.google'));
  const update = () => { if (isClockTime(time.value)) { setReminderTime(time.value); google.href = googleCalendarUrl(time.value, new Date()); } };
  time.addEventListener('input', update);
  time.addEventListener('change', update);
  const add = h('button', { class: 'btn btn-secondary', type: 'button', onclick: async () => {
    update();
    const result = await shareOrDownload(buildReminderIcs(reminderTime(), new Date()), 'ville-du-bien-etre-rappel.ics', 'text/calendar');
    if (result === 'downloaded') toast(t('reminder.downloaded'));
  } }, icon('download'), t('reminder.add'));
  return settingsBlock('settingsWeek',
    h('div', { class: 'setting' },
      h('span', { class: 'section-title' }, t('settings.weekTitle')),
      h('span', { class: 'setting-label' }, t('settings.weekStart')),
      weekSeg),
    h('div', { class: 'setting' },
      h('label', { class: 'setting-label', for: 'reminderTime' }, t('reminder.time')),
      time, add, google,
      h('p', { class: 'note' }, t('reminder.note'))));
}
function settingsTheme() {
  const themeSeg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('settings.theme') });
  const themeLabels = { auto: t('settings.themeAuto'), light: t('settings.themeLight'), dark: t('settings.themeDark') };
  for (const v of THEMES) themeSeg.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(S.settings.theme === v), onclick: () => { S.settings.theme = v; commit({ silent: true }); applyTheme(); $$('button', themeSeg).forEach((b, i) => b.setAttribute('aria-checked', String(THEMES[i] === v))); } }, themeLabels[v]));
  return settingsBlock('settingsTheme', h('div', { class: 'setting' },
    h('span', { class: 'section-title' }, t('settings.theme')),
    h('p', { class: 'note' }, t('settings.themeNote')),
    themeSeg));
}
function settingsStrict() {
  return settingsBlock('settingsStrict', h('div', { class: 'setting' }, h('span', { class: 'section-title' }, t('strict.title')), h('button', { class: 'btn btn-secondary', type: 'button', onclick: openStrict }, icon('lock'), t('strict.button'))));
}
function settingsBackup() {
  const exportArea = h('textarea', { class: 'textarea', id: 'exportArea', readonly: true, hidden: true, 'aria-label': t('backup.exportArea') });
  const importArea = h('textarea', { class: 'textarea', id: 'importArea', placeholder: t('backup.importPlaceholder'), 'aria-label': t('backup.importArea') });
  const preview = h('div', { class: 'restore-preview', hidden: true });
  const fail = msg => { preview.replaceChildren(h('p', { class: 'note warn-text', role: 'alert' }, msg)); preview.hidden = false; };
  const verify = () => {
    const res = readBackup(importArea.value);
    if (res.error) { fail(res.error); return; }
    preview.replaceChildren();
    preview.hidden = false;
    const replace = h('button', { class: 'btn btn-secondary', type: 'button' }, t('backup.replace'));
    twoStep(replace, t('backup.replace'), t('backup.replaceConfirm'), () => restoreBackup(res.state));
    preview.append(
      h('p', {}, h('strong', {}, t('backup.thisBackup')), summary(res.state)),
      h('p', {}, h('strong', {}, t('backup.currentCity')), summary(S)),
      replace);
  };
  const fileInput = h('input', { type: 'file', accept: '.txt,text/plain', hidden: true, tabindex: '-1', 'aria-hidden': 'true' });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    const clear = () => { fileInput.value = ''; };
    if (f.size > 4e6) { clear(); fail(t('backup.notBackupFile')); return; }
    f.text().then(text => { clear(); importArea.value = text.trim(); verify(); }, () => { clear(); fail(t('backup.fileUnreadable')); });
  });
  return settingsBlock('settingsBackup',
    h('div', { class: 'setting' },
      h('span', { class: 'section-title' }, t('backup.title')),
      h('p', { class: 'note', id: 'syncStatus', role: 'status' }, syncText()),
      h('p', { class: 'note', id: 'backupLast' }, lastBackupText()),
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => saveBackupFile() }, icon('download'), t('backup.saveFile')),
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => {
        const text = exportBackup();
        exportArea.value = text;
        exportArea.hidden = false;
        const done = () => { markBackup(); toast(t('backup.copied')); };
        const fallback = () => { exportArea.focus(); exportArea.select(); toast(t('backup.selectAndCopy')); };
        try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
      } }, icon('copy'), t('backup.copy')),
      exportArea),
    h('div', { class: 'setting' },
      h('span', { class: 'setting-label' }, t('backup.restoreTitle')),
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => fileInput.click() }, icon('upload'), t('backup.openFile')),
      fileInput,
      importArea,
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: verify }, t('backup.verify')),
      preview));
}
function settingsReset() {
  const reset = h('button', { class: 'btn btn-ghost', type: 'button' }, t('settings.reset'));
  twoStep(reset, t('settings.reset'), t('settings.resetConfirm'), () => {
    if (S.active || run) { toast(t('settings.resetFinishSession')); return; }
    const clock = S.clock;
    setLang('auto');   // une ville neuve suit la langue du téléphone, ses exemples aussi
    S = defaultState();
    S.clock = { tz: clock.tz, maxSeen: clock.maxSeen, lastDay: clock.lastDay };
    closeSheet();
    Mode.state = null;
    refreshLang();
    commit({ flush: true });
    City.relayout();
    toast(t('settings.resetDone'));
  });
  return settingsBlock('settingsReset', reset, h('p', { class: 'note' }, t('settings.rules')));
}
function openSettings() {
  openSheet(t('nav.settings'), body => {
    const sections = [settingsStart(), settingsLang(), settingsSessions(), settingsStreak(), settingsWeek(), settingsTheme(), settingsStrict(), settingsBackup(), settingsReset()];
    sections.forEach((section, i) => { if (i) body.append(h('hr', { class: 'divider' })); body.append(section); });
  });
}
