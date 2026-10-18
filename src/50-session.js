/* =========================================================================
   Session : chrono anti-triche
   L'app compte comme « à l'écran » si la page est visible, si elle a le focus (quand elle l'a eu)
   et si elle est affichée. L'absence se mesure depuis le dernier tic du chrono : un signal de
   sortie reçu en retard (iOS) ne réduit pas la durée d'absence.
   ========================================================================= */
let run = null;
let wakeLock = null;
let beginning = false;
const RING = 2 * Math.PI * 108;
const graceMs = () => S.settings.grace * 1000;

function readBeat() {
  try { return obj(JSON.parse(localStorage.getItem(LS_BEAT) || 'null')); } catch (e) { return {}; }
}
function writeBeat() {
  if (!run) return;
  const now = Date.now();
  if (now - run.beatAt < 2000) return;
  run.beatAt = now;
  try { localStorage.setItem(LS_BEAT, JSON.stringify({ id: run.id, tab: Store.tab, at: now })); } catch (e) { /* ignore */ }
}
function clearBeat() {
  try { const b = readBeat(); if (b.tab === Store.tab) localStorage.removeItem(LS_BEAT); } catch (e) { /* ignore */ }
}
// Toute mutation de session relit le stockage sous verrou. Le repli est une
// courte réservation confirmée après un tour d'événements, jamais un chrono concurrent.
const SESSION_LOCK = LS_KEY + ':session-lock';
async function withSessionLock(action) {
  const work = () => { Store.pullLocal(); return Store.migrationPending ? false : action(); };
  if (navigator.locks && typeof navigator.locks.request === 'function') {
    return navigator.locks.request(SESSION_LOCK, { mode: 'exclusive' }, work);
  }
  const token = Store.tab + '-' + uid();
  try {
    const old = obj(JSON.parse(localStorage.getItem(SESSION_LOCK) || 'null'));
    if (old.until > Date.now()) return false;
    localStorage.setItem(SESSION_LOCK, JSON.stringify({ token, until: Date.now() + 2000 }));
    await new Promise(resolve => setTimeout(resolve, 40));
    if (obj(JSON.parse(localStorage.getItem(SESSION_LOCK) || 'null')).token !== token) return false;
    return work();
  } catch (e) {
    Store.reportLocal('storage.needLock');
    return false;
  } finally {
    try { if (obj(JSON.parse(localStorage.getItem(SESSION_LOCK) || 'null')).token === token) localStorage.removeItem(SESSION_LOCK); } catch (e) { /* erreur déjà signalée */ }
  }
}
// 'none' | 'mine' | 'elsewhere' | 'stale' | 'resume' (activité libre fermée)
function activeState() {
  if (Store.migrationPending) return S.active ? 'elsewhere' : 'none';
  const a = S.active;
  if (!a) return 'none';
  if (run && run.id === a.id && (!a.owner || a.owner === Store.tab)) return 'mine';
  const beat = readBeat();
  const leaseMs = a.mode === 'free' ? 15000 : graceMs() + 3000;
  if (beat.id === a.id && beat.tab !== Store.tab && Date.now() - Math.max(beat.at || 0, a.checkpointAt || 0) < leaseMs) return 'elsewhere';
  if (!a.owner && a.dev === Store.device && Date.now() - Math.max(a.checkpointAt || 0, a.startedAt) < 15000) return 'elsewhere';
  if (a.dev && a.dev !== Store.device && Date.now() < a.startedAt + a.min * 60000 + 120000) return 'elsewhere';
  return a.mode === 'free' ? 'resume' : 'stale';
}
function settledState() {
  Store.pullLocal();
  return activeState();
}
let elsewhereTimer = 0, recoveringSession = false;
function checkActive() {
  if (Store.migrationPending) return;
  const st = settledState();
  dbg('checkActive ' + st);
  if ((st === 'stale' || st === 'resume') && !recoveringSession) {
    recoveringSession = true;
    withSessionLock(() => {
      const current = activeState();
      if (current === 'stale') failInterrupted();
      else if (current === 'resume') startSessionLocked(null, { elapsed: S.active.elapsedSec * 1000 });
    }).finally(() => { recoveringSession = false; });
  }
  clearInterval(elsewhereTimer);
  if (st === 'elsewhere') elsewhereTimer = setInterval(() => { checkActive(); renderAll(); }, 3000);
  if (currentTab === 'ville') renderVille();
  // Séance finie dans un autre onglet : la ville amie reçue entre-temps s'ouvre.
  if (typeof openPendingVisit === 'function') openPendingVisit();
}

/* Écran allumé : demandé au moment du tap, avant de lancer le chrono */
function wakeAcked() { try { return localStorage.getItem(LS_WAKE_ACK) === '1'; } catch (e) { return false; } }
function acquireWake() {
  if (!S.settings.keepAwake) return Promise.resolve('off');
  if (!navigator.wakeLock || typeof navigator.wakeLock.request !== 'function') return Promise.resolve('na');
  if (wakeLock && !wakeLock.released) return Promise.resolve('on');
  return navigator.wakeLock.request('screen').then(lock => {
    wakeLock = lock;
    lock.addEventListener('release', () => { if (run && !run.ended && run.awayAt == null && document.visibilityState === 'visible') setWake('na'); });
    return 'on';
  }, () => 'na');
}
function releaseWake() {
  const w = wakeLock;
  wakeLock = null;
  if (w && !w.released) { try { w.release(); } catch (e) { /* déjà libéré */ } }
}

/* Son de fin : préparé au moment du tap (sur iPhone, le son n'est permis qu'après un geste),
   joué quand le chrono arrive au bout, puis mis en veille jusqu'à la session suivante.
   Chaque son : notes [départ s, fréquence Hz], harmoniques [multiple, volume], durée d'extinction s. */
const SOUNDS = {
  chime: { notes: [[0, 784], [.38, 1047]], partials: [[1, .2], [2.76, .05], [5.4, .02]], decay: 1.9 },
  bowl: { notes: [[0, 220]], partials: [[1, .26], [2.71, .07], [5.2, .025]], decay: 4 },
  bells: { notes: [[0, 1319], [.16, 1568], [.32, 2093]], partials: [[1, .14], [3, .03]], decay: .6 },
};
const Chime = {
  ctx: null,
  idle: 0,
  // force : l'aperçu des Réglages joue même si le son de fin est coupé.
  unlock(force) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if ((!S.settings.sound && !force) || !AC) return;
    try {
      clearTimeout(this.idle);
      if (!this.ctx) this.ctx = new AC();
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      // Un échantillon muet joué pendant le geste débloque le son sur les iPhone plus anciens.
      const src = this.ctx.createBufferSource();
      src.buffer = this.ctx.createBuffer(1, 1, 22050);
      src.connect(this.ctx.destination);
      src.start(0);
    } catch (e) { this.ctx = null; }
  },
  // La vibration a son propre réglage : elle prévient même quand le son est coupé.
  play() {
    try { if (S.settings.vibrate && typeof navigator.vibrate === 'function') navigator.vibrate([160, 90, 160]); } catch (e) { /* pas de vibreur */ }
    if (!S.settings.sound) return;
    this.rest(this.sound() + 500);    // la veille attend la fin du son : le bol s'éteint en 4 s
  },
  // Aperçu dans les Réglages, pendant le geste : le son choisi, sans vibration.
  preview() {
    this.unlock(true);
    this.sound();
    this.rest(5000);
  },
  sound() {
    const c = this.ctx, def = SOUNDS[S.settings.soundType] || SOUNDS.chime, gain = SOUND_GAIN[S.settings.soundVolume] || 1;
    if (!c) return 0;
    try {
      if (c.state !== 'running') c.resume().catch(() => {});
      const t0 = c.currentTime + .05;
      for (const [dt, f] of def.notes) {
        for (const [k, vol] of def.partials) {
          const o = c.createOscillator(), g = c.createGain();
          o.frequency.value = f * k;
          g.gain.setValueAtTime(.0001, t0 + dt);
          g.gain.exponentialRampToValueAtTime(vol * gain, t0 + dt + .012);
          g.gain.exponentialRampToValueAtTime(.0001, t0 + dt + def.decay);
          o.connect(g);
          g.connect(c.destination);
          o.start(t0 + dt);
          o.stop(t0 + dt + def.decay + .1);
        }
      }
    } catch (e) { /* pas de son ici */ }
    // Durée du son, jusqu'à l'extinction de sa dernière note (ms).
    return Math.round((.15 + Math.max(...def.notes.map(([dt]) => dt)) + def.decay) * 1000);
  },
  // Pose dans la ville : un « plop » doux, puis une note qui monte quand on enchaîne les poses (gamme pentatonique).
  placeStep: 0,
  placeAt: 0,
  place(kind = 'build') {
    const building = kind === 'build' || kind === 'stage';
    try { if (S.settings.vibrate && (building || kind === 'inaugurate') && typeof navigator.vibrate === 'function') navigator.vibrate(15); } catch (e) { /* pas de vibreur */ }
    if (!S.settings.sound) return;
    if (building) {
      const now = Date.now();
      this.placeStep = now - this.placeAt < 20000 ? Math.min(this.placeStep + 1, PENTATONIC.length - 1) : 0;
      this.placeAt = now;
    }
    this.unlock();
    const c = this.ctx, gain = SOUND_GAIN[S.settings.soundVolume] || 1;
    if (!c) return;
    try {
      const t0 = c.currentTime + .02;
      const tone = (freq, start, dur, vol, endFreq) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, t0 + start);
        if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t0 + start + dur);
        g.gain.setValueAtTime(.0001, t0 + start);
        g.gain.exponentialRampToValueAtTime(vol * gain, t0 + start + .012);
        g.gain.exponentialRampToValueAtTime(.0001, t0 + start + dur);
        o.connect(g);
        g.connect(c.destination);
        o.start(t0 + start);
        o.stop(t0 + start + dur + .05);
      };
      if (building || kind === 'move') tone(330, 0, .14, .22, 150);
      if (building) tone(PENTATONIC[this.placeStep], .08, .5, .12);
      if (kind === 'inaugurate') [2, 4, 6].forEach((n, i) => tone(PENTATONIC[n], i * .12, .7, .12));
      if (kind === 'set') [5, 7].forEach((n, i) => tone(PENTATONIC[n], i * .1, .6, .1));
    } catch (e) { /* pas de son ici */ }
    this.rest(3000);
  },
  // Hors session, le son est mis en veille (batterie) ; le prochain tap le réveille.
  rest(delay) {
    clearTimeout(this.idle);
    this.idle = setTimeout(() => { if (this.ctx && !run && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }, delay || 0);
  },
};

async function beginSession(o) {
  if (run || beginning) return;
  const st = settledState();
  if (st === 'elsewhere' || st === 'resume') { toast(t('session.alreadyRunning')); checkActive(); return; }
  beginning = true;
  // Encore dans le geste : plus tard, le son serait refusé. Une ambiance choisie ouvre le son même si le son de fin est coupé.
  Chime.unlock(S.settings.ambience !== 'none');
  try {
    const wake = o.mode === 'free' ? 'free' : await acquireWake();
    if (wake !== 'on' && wake !== 'free' && !wakeAcked()) { openWakeWarning(o, wake); return; }
    await startSession(o);
  } finally {
    beginning = false;
  }
}
function openWakeWarning(o, wake) {
  openSheet(t('wake.title'), body => {
    const ack = h('input', { type: 'checkbox', id: 'wakeAck' });
    body.append(
      h('p', {}, wake === 'off' ? t('wake.offText') : t('wake.naText')),
      h('p', { class: 'section-title' }, t('wake.before')),
      h('ul', { class: 'info-list' },
        h('li', {}, icon('sun'), h('span', {}, h('strong', {}, t('wake.iphoneLabel')), t('wake.iphoneText'))),
        h('li', {}, icon('lock'), h('span', {}, h('strong', {}, t('wake.guidedLabel')), t('wake.guidedText'))),
        h('li', {}, icon('sun'), h('span', {}, h('strong', {}, t('wake.androidLabel')), t('wake.androidText')))),
      h('label', { class: 'check', for: 'wakeAck' }, ack, h('span', {}, t('wake.dontWarn'))),
      h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'button', onclick: () => {
        if (ack.checked) { try { localStorage.setItem(LS_WAKE_ACK, '1'); } catch (e) { /* ignore */ } }
        closeSheet();
        startSession(o);
      } }, icon('play'), t('wake.start')),
      h('button', { class: 'btn btn-ghost btn-block', type: 'button', onclick: closeSheet }, t('common.cancel')));
  }, { keep: true, onClose: () => Chime.rest(3000) });
}

async function startSession(o, resume) {
  if (run) return;
  const started = await withSessionLock(() => {
    const st = activeState();
    if (st === 'elsewhere' || st === 'mine' || (!resume && st === 'resume')) {
      toast(t('session.runningElsewhere')); return false;
    }
    if (st === 'stale' && !resume) failInterrupted(true);
    return startSessionLocked(o, resume);
  });
  if (!started && !run) { releaseWake(); Chime.rest(3000); }
}
function startSessionLocked(o, resume) {
  if (run) return false;
  closeSheet();
  if (!resume) {
    if (!o || !isCat(o.cat) || !str(o.name, 60)) return false;
    if (o.sourceId && ['direct', 'wishes', 'chores'].includes(o.source || 'direct') && typeof taskAvailable === 'function') {
      const key = o.source === 'wishes' || o.source === 'chores' ? o.source : 'activities';
      const source = S[key].find(item => item.id === o.sourceId);
      if (!source || !taskAvailable(source)) { toast(t('session.sourceGone')); return false; }
    }
    if (o.source === 'routine' && (!S.routineRun || S.routineRun.id !== o.routineRunId || S.routineRun.next !== o.routineStep || S.routineRun.status === 'done')) {
      toast(t('session.routineChanged')); return false;
    }
    const day = effectiveDay(), min = int(o.min, 1, 180, 10), now = Date.now();
    const r = rewardFor(min, o.drawPct || 0, day);
    S.active = cleanActive({
      id: uid(), name: o.name, cat: o.cat, min, source: o.source || 'direct', sourceId: o.sourceId || '', drawPct: o.drawPct || 0,
      mode: o.mode === 'free' ? 'free' : 'focus', owner: Store.tab, elapsedSec: 0, checkpointAt: now,
      startedAt: now, day, promised: r.total, streakPct: r.streakPct, streakDays: r.streakDays, returnPct: r.returnPct,
      dev: Store.device, draw: o.draw || null, drawRerolls: o.drawRerolls || 0,
      routineRunId: o.routineRunId || '', routineStep: o.routineStep || 0,
    });
  } else if (S.active) {
    S.active.owner = Store.tab;
    S.active.dev = Store.device;
    S.active.checkpointAt = Date.now();
  }
  const a = S.active;
  if (!a) return false;
  const expectedId = a.id;
  const saved = commit({ flush: true, silent: true });
  if (!saved || !S.active || S.active.id !== expectedId || S.active.owner !== Store.tab) {
    if (!saved && !resume && S.active && S.active.id === expectedId && S.active.owner === Store.tab) S.active = null;
    toast(t('session.cannotStart'));
    return false;
  }
  if (a.source === 'wishes' || a.source === 'chores') {
    S.draw = Object.assign({}, S.draw, { current: null, rerolls: 0 });
    commit({ silent: true });
  }
  const now = performance.now();
  run = {
    id: a.id, active: clone(a), totalMs: a.min * 60000, elapsed: a.mode === 'free' ? clamp(Date.now() - a.startedAt, 0, a.min * 60000) : resume ? num(resume.elapsed, 0, a.min * 60000, a.elapsedSec * 1000) : 0,
    lastNow: now, lastWall: Date.now(), awayAt: null, awayWall: 0, graceTimer: 0, interval: 0,
    exits: resume ? int(resume.exits, 0, 1e4, 0) : 0, ended: false, finishing: false, lastSec: -1, savedAt: Date.now(),
    focusSeen: document.hasFocus(), offscreen: false, beatAt: 0, io: null,
  };
  showRun(a);
  if (a.mode === 'free') setWake('free');
  else if (wakeLock && !wakeLock.released) setWake('on'); else requestWake();
  if (a.mode !== 'free' && 'IntersectionObserver' in window) {
    run.io = new IntersectionObserver(entries => {
      if (!run) return;
      run.offscreen = !entries[entries.length - 1].isIntersecting;
      updatePresence();
    });
    run.io.observe($('#sessRun'));
  }
  run.interval = setInterval(tick, 250);
  writeBeat();
  tick();
  if (typeof Ambience !== 'undefined' && run) Ambience.start();
  return true;
}
function persistRun(force = false) {
  if (!run || run.ended || !S.active || S.active.id !== run.id || S.active.owner !== Store.tab) return;
  const now = Date.now();
  if (!force && now - run.savedAt < 5000) return;
  run.savedAt = now;
  S.active.elapsedSec = Math.min(run.totalMs, run.elapsed) / 1000;
  S.active.checkpointAt = now;
  run.active = clone(S.active);
  commit({ silent: true });
}
function showRun(a) {
  const ses = $('#session');
  ses.style.setProperty('--c', catVar(a.cat));
  $('#sessCat').replaceChildren(catDot(a.cat), catName(a.cat));
  $('#sessName').textContent = frTypo(displayName(a.name));
  const bonus = $('#sessBonus');
  bonus.hidden = !a.drawPct;
  bonus.textContent = a.drawPct ? frTypo(t('session.drawBonus', { pct: a.drawPct })) : '';
  $('#timerSub').textContent = frTypo(t('session.gain', { coins: fmt(a.promised || rewardFor(a.min, a.drawPct).total) }));
  $('#graceRule').replaceChildren(icon('shield'), h('span', {}, a.mode === 'free' ? t('session.ruleFree') : t('session.ruleFocus', { grace: S.settings.grace })));
  $('#strictBtn').hidden = a.mode === 'free';   // bloquer le téléphone n'a de sens qu'en concentration
  if (typeof renderAmbienceButton === 'function') renderAmbienceButton();
  if (typeof renderSessionCompanion === 'function') renderSessionCompanion(a);
  $('#sessAlert').hidden = true;
  $('#ringFill').style.strokeDasharray = String(RING);
  $('#sessRun').hidden = false;
  $('#sessResult').hidden = true;
  ses.hidden = false;
  updateInert();
  ses.scrollTop = 0;
  renderTimer(true);
  setTimeout(() => $('#sessName').focus({ preventScroll: true }), 30);
}
function renderTimer(force) {
  if (!run) return;
  const rem = Math.max(0, run.totalMs - run.elapsed);
  const sec = Math.ceil(rem / 1000);
  if (sec !== run.lastSec || force) {
    run.lastSec = sec;
    $('#timer').textContent = pad2(Math.floor(sec / 60)) + ':' + pad2(sec % 60);
  }
  $('#ringFill').style.strokeDashoffset = String(RING * (1 - clamp(run.elapsed / run.totalMs, 0, 1)));
}
function present() {
  if (document.visibilityState === 'hidden') return false;
  if (run.focusSeen && !document.hasFocus()) return false;
  if (run.offscreen) return false;
  return true;
}
function updatePresence() {
  if (!run || run.ended) return;
  if (run.active.mode === 'free') { tick(); return; }
  if (!run.focusSeen && document.hasFocus()) run.focusSeen = true;
  if (present()) onReturn(); else onLeave();
}
function tick() {
  if (!run || run.ended || run.finishing) return;
  if (!S.active || S.active.id !== run.id || S.active.owner !== Store.tab) { endRun(); return; }
  if (run.active.mode === 'free') {
    run.elapsed = clamp(Date.now() - run.active.startedAt, 0, run.totalMs);
    writeBeat();
    fadeAmbienceNearEnd();
    if (run.elapsed >= run.totalMs) { completeSession(); return; }
    persistRun();
    renderTimer();
    return;
  }
  const now = performance.now(), wall = Date.now();
  if (!run.focusSeen && document.hasFocus()) run.focusSeen = true;
  if (!present()) {
    if (run.awayAt == null) onLeave();
    else { run.lastNow = now; run.lastWall = wall; }
    return;
  }
  if (run.awayAt != null) { onReturn(); return; }
  const dt = now - run.lastNow, gap = Math.max(dt, wall - run.lastWall);
  run.lastNow = now;
  run.lastWall = wall;
  if (gap > graceMs() + 2000) { failSession('away', gap); return; }
  run.elapsed += clamp(dt, 0, 2000);
  writeBeat();
  persistRun();
  if (!run) return;
  fadeAmbienceNearEnd();
  if (run.elapsed >= run.totalMs) { completeSession(); return; }
  renderTimer();
}
// À 1,5 s de la fin, l'ambiance s'éteint en douceur : le son de fin arrive ensuite, seul.
function fadeAmbienceNearEnd() {
  if (run.ambienceFaded || run.totalMs - run.elapsed > 1500 || typeof Ambience === 'undefined') return;
  run.ambienceFaded = true;
  Ambience.fadeOut(Math.max(.1, (run.totalMs - run.elapsed) / 1000));
}
function awayDuration() { return Math.max(performance.now() - run.awayAt, Date.now() - run.awayWall); }
function onLeave() {
  if (!run || run.ended || run.finishing || run.awayAt != null) return;
  if (run.active.mode === 'free') { tick(); persistRun(true); return; }
  dbg('onLeave: vis=' + document.visibilityState + ' focus=' + document.hasFocus() + ' off=' + run.offscreen);
  const now = performance.now(), wall = Date.now();
  const dt = now - run.lastNow, gap = Math.max(dt, wall - run.lastWall);
  if (gap > graceMs() + 2000) { failSession('away', gap); return; }
  if (gap <= 1000) {
    run.elapsed += clamp(dt, 0, 1000);
    run.awayAt = now;
    run.awayWall = wall;
  } else {
    run.awayAt = run.lastNow;
    run.awayWall = run.lastWall;
  }
  run.lastNow = now;
  run.lastWall = wall;
  run.exits += 1;
  clearTimeout(run.graceTimer);
  const left = Math.max(0, graceMs() - awayDuration());
  run.graceTimer = setTimeout(() => { if (run && !run.ended && run.awayAt != null) failSession('away', awayDuration()); }, left + 60);
  persistRun(true);
  Store.flush();
}
function onReturn() {
  if (!run || run.ended) return;
  if (run.active.mode === 'free') { tick(); return; }
  if (run.awayAt == null) return;
  clearTimeout(run.graceTimer);
  const away = awayDuration();
  run.awayAt = null;
  run.lastNow = performance.now();
  run.lastWall = Date.now();
  if (away > graceMs()) { failSession('away', away); return; }
  const al = $('#sessAlert');
  al.replaceChildren(icon('alert'), h('span', {}, t('session.awayAlert', { time: fmtAway(away), grace: S.settings.grace })));
  al.hidden = false;
  requestWake();
}
function endRun() {
  if (!run) return null;
  const r = run;
  r.ended = true;
  clearInterval(r.interval);
  clearTimeout(r.graceTimer);
  if (r.io) r.io.disconnect();
  releaseWake();
  // Fin, abandon, interruption ou séance finie ailleurs : l'ambiance s'arrête aussitôt (déjà éteinte si la séance est allée au bout).
  if (typeof Ambience !== 'undefined') Ambience.stop();
  if (typeof stopSessionCompanion === 'function') stopSessionCompanion();
  Chime.rest(3000);
  run = null;
  return r;
}
function pushHistory(e) {
  S.history.unshift(e);
  if (S.history.length > HISTORY_MAX) S.history.length = HISTORY_MAX;
}
// Un échec rend le tirage : on ne peut pas se refaire un tirage gratuit en abandonnant.
function restoreDraw(a) {
  if (a.draw) S.draw = Object.assign({}, S.draw, { current: clone(a.draw), rerolls: a.drawRerolls || 0 });
}
function addEffort(a, elapsedSec, day) {
  const minutes = elapsedSec / 60;
  if (!minutes) return;
  const stats = S.stats.effort;
  stats.byCat[a.cat] = (stats.byCat[a.cat] || 0) + minutes;
  stats.days[day] = (stats.days[day] || 0) + minutes;
  const cats = stats.dailyCats[day] || (stats.dailyCats[day] = {});
  cats[a.cat] = (cats[a.cat] || 0) + minutes;
}
function sessionHistory(a, ok, elapsedSec, extra = {}) {
  // Activité libre réussie, enregistrée au retour dans l'app : l'heure gardée est celle de sa vraie fin.
  const end = a.startedAt + a.min * 60000, at = ok && a.mode === 'free' && end < Date.now() ? end : Date.now();
  return Object.assign({ id: a.id, name: a.name, cat: a.cat, min: a.min, mode: a.mode, elapsedSec, ok, reward: 0, at, source: a.source, day: maxDay(a.day || effectiveDay(), S.clock.lastDay), routineRunId: a.routineRunId || '', routineStep: a.routineStep || 0, returnPct: a.returnPct || 0 }, extra);
}
async function failSession(reason, awayMs) {
  if (!run || run.finishing) return;
  run.finishing = true;
  const id = run.id;
  const result = await withSessionLock(() => {
    if (!run || run.id !== id || !S.active || S.active.id !== id || S.active.owner !== Store.tab) return true;
    const a = clone(S.active), elapsedSec = Math.floor(clamp(run.active.mode === 'free' ? Date.now() - a.startedAt : run.elapsed, 0, a.min * 60000) / 1000);
    endRun();
    if (S.history.some(e => e.id === id)) { S.active = null; commit({ silent: true }); return true; }
    const e = sessionHistory(a, false, elapsedSec, { reason, away: Math.round((awayMs || 0) / 1000) });
    pushHistory(e);
    addEffort(a, elapsedSec, e.day);
    if (typeof addCompanionMinutes === 'function') addCompanionMinutes(elapsedSec / 60);   // le temps fait ensemble compte aussi
    S.stats.ko += 1;
    S.active = null;
    restoreDraw(a);
    commit({ flush: true });
    clearBeat();
    showFail(a, reason, awayMs, elapsedSec * 1000);
    return true;
  });
  if (!result && run && run.id === id) run.finishing = false;
}
// Appelé uniquement sous le verrou de mutation des sessions.
function failInterrupted(silent) {
  const a = S.active;
  if (!a || a.mode === 'free' || activeState() !== 'stale') return;
  if (S.history.some(e => e.id === a.id)) {
    S.active = null;
    commit({ flush: true, silent: true });
    renderAll();
    return;
  }
  const elapsedSec = Math.floor(a.elapsedSec || 0), e = sessionHistory(a, false, elapsedSec, { reason: 'closed' });
  pushHistory(e);
  addEffort(a, elapsedSec, e.day);
  if (typeof addCompanionMinutes === 'function') addCompanionMinutes(elapsedSec / 60);
  S.stats.ko += 1;
  S.active = null;
  restoreDraw(a);
  commit({ flush: true, silent: true });
  if (silent) { renderAll(); return; }
  showFail(a, 'closed', 0, elapsedSec * 1000);
}
async function completeSession() {
  if (!run || run.finishing) return;
  run.finishing = true;
  const id = run.id;
  const result = await withSessionLock(() => {
    if (!run || run.id !== id || !S.active || S.active.id !== id || S.active.owner !== Store.tab) return true;
    const a = clone(S.active);
    endRun();
    if (S.history.some(e => e.id === a.id)) { S.active = null; commit({ silent: true }); return true; }
    const before = unlockedSet();
    const total = a.promised || rewardFor(a.min, a.drawPct, a.day).total;
    const day = maxDay(a.day || effectiveDay(), S.clock.lastDay);
    S.coins = clamp(S.coins + total, 0, COINS_MAX);
    S.earned = clamp(S.earned + total, 0, COINS_MAX);
    addEffort(a, a.min * 60, day);
    S.stats.byCat[a.cat] = (S.stats.byCat[a.cat] || 0) + a.min;
    S.stats.days[day] = (S.stats.days[day] || 0) + a.min;
    const cats = S.stats.dailyCats[day] || (S.stats.dailyCats[day] = {});
    cats[a.cat] = (cats[a.cat] || 0) + a.min;
    S.stats.ok += 1;
    S.clock.lastDay = maxDay(S.clock.lastDay, day);
    pushHistory(sessionHistory(a, true, a.min * 60, { reward: total, day }));
    S.active = null;
    if (typeof completeTask === 'function') completeTask(a);
    if (typeof onRoutineSessionComplete === 'function') onRoutineSessionComplete(a, total);
    // Compagnon : le temps de la séance, avant les succès (certains suivent la complicité) ; le mot du jour à la première du jour.
    const companion = typeof addCompanionMinutes === 'function' ? addCompanionMinutes(a.min) : null;
    const firstToday = S.history.filter(e => e.ok && e.day === day).length === 1;
    // Défis relevés par cette séance, puis succès (certains suivent les défis) : le bilan montre les deux, les succès avec leur
    // décor offert (qui n'apparaît donc pas une seconde fois en déblocage).
    const challenges = typeof claimChallenges === 'function' ? claimChallenges(day) : [];
    const earned = typeof checkAchievements === 'function' ? checkAchievements() : [];
    const gifts = earned.map(id => achievementDef(id).reward).filter(Boolean);
    const fresh = [...unlockedSet()].filter(x => !before.has(x) && !gifts.includes(x));
    commit({ flush: true });
    clearBeat();
    bump();
    Chime.play();
    showSuccess(a, total, fresh, earned, challenges, companion, firstToday);
    return true;
  });
  if (!result && run && run.id === id) run.finishing = false;
}
function abandon() { failSession('abandon', 0); }

function closeSession() {
  $('#session').hidden = true;
  updateInert();
  renderAll();
  const tab = $('.tab[aria-current="page"]');
  if (tab) tab.focus({ preventScroll: true });
  // Une ville amie reçue pendant la séance : elle s'ouvre maintenant, après ce que le bouton de l'écran de fin a lancé.
  if (typeof openPendingVisit === 'function') setTimeout(openPendingVisit, 0);
}
function showResult(build) {
  const res = $('#sessResult');
  res.replaceChildren();
  build(res);
  $('#sessRun').hidden = true;
  res.hidden = false;
  $('#session').hidden = false;
  updateInert();
  setTimeout(() => { const title = res.querySelector('.res-title'); if (title) title.focus({ preventScroll: true }); }, 30);
}
function showSuccess(a, total, fresh, earned = [], challenges = [], companion = null, firstToday = false) {
  showResult(res => {
    const burst = h('div', { class: 'burst', 'aria-hidden': 'true' });
    if (!reducedMotion()) {
      for (let i = 0; i < 14; i++) {
        const ang = i / 14 * Math.PI * 2, dist = 70 + rnd(i, 3) * 60;
        burst.append(h('i', { vars: { '--dx': Math.cos(ang) * dist + 'px', '--dy': Math.sin(ang) * dist * .8 + 'px' }, style: 'animation-delay:' + (i % 4) * 40 + 'ms' }));
      }
    }
    const lines = h('ul', { class: 'res-lines' },
      h('li', {}, h('span', {}, t('result.baseLine', { min: a.min })), h('span', {}, fmt(a.min * RATE))),
      a.drawPct ? h('li', {}, h('span', {}, t('result.drawBonus')), h('span', {}, t('unit.bonusPct', { pct: a.drawPct }))) : null,
      a.streakPct ? h('li', {}, h('span', {}, S.settings.hideStreak ? t('result.consistency') : t('result.streak', { n: a.streakDays })), h('span', {}, t('unit.bonusPct', { pct: a.streakPct }))) : null,
      a.returnPct ? h('li', {}, h('span', {}, t('result.welcomeBack')), h('span', {}, t('unit.bonusPct', { pct: a.returnPct }))) : null,
      h('li', {}, h('span', {}, t('result.newBalance')), h('span', {}, fmt(S.coins))));
    const unlocks = fresh.map(k => {
      const cv = h('canvas', { 'aria-hidden': 'true' });
      City.thumb(cv, k, 56);
      return h('div', { class: 'res-unlock' }, cv, h('span', {}, t('result.unlocked', { item: itemName(k) })));
    });
    res.append(
      h('div', { class: 'res-figure' }, burst, icon('coin'), '+' + fmt(total)),
      h('h2', { class: 'res-title', tabindex: '-1' }, t('result.success')),
      h('p', { class: 'sub' }, displayName(a.name) + ' · ' + a.min + NB + 'min'),
      lines, typeof companionResult === 'function' ? companionResult(companion, firstToday) : null, ...unlocks, ...earned.map(id => {
        const gift = achievementDef(id).reward;
        let pic = h('span', { class: 'ach-badge', 'aria-hidden': 'true' }, icon('sparkle'));
        if (gift) { pic = h('canvas', { 'aria-hidden': 'true' }); City.thumb(pic, gift, 56); }
        return h('div', { class: 'res-unlock' }, pic, h('span', {}, t('result.achievement', { name: achName(id) }) + (gift ? ' · ' + t('result.gift', { item: itemName(gift) }) : '')));
      }),
      ...challenges.map(ch => h('div', { class: 'res-unlock' }, h('span', { class: 'ach-badge', 'aria-hidden': 'true' }, icon('check')),
        h('span', {}, t('chal.done', { text: challengeText(ch), coins: fmt(GIFTS.challenge) })))),
      ...(S.settings.mood === false ? [] : [moodPicker(a.id)]),
      h('div', { class: 'res-actions' },
        h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: () => { closeSession(); go('ville'); openShop(); } }, icon('build'), t('city.build')),
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { closeSession(); go('ville'); } }, t('result.backToCity'))));
    if (typeof renderRoutineResult === 'function') renderRoutineResult(res, a, total);
  });
}
function showFail(a, reason, awayMs, elapsed) {
  const why = reason === 'away'
    ? (awayMs > graceMs() + 2000 ? t('result.awayFor', { time: fmtAway(awayMs) }) : t('result.awayMore', { grace: S.settings.grace }))
    : reason === 'closed' ? t('result.closed')
    : t('result.abandoned');
  const done = Math.floor((elapsed || 0) / 60000);
  $('#session').style.setProperty('--c', 'var(--danger)');
  showResult(res => {
    res.append(
      h('div', { class: 'res-fail' }, icon('lost', 'ic-big')),
      typeof companionFail === 'function' ? companionFail() : null,
      h('h2', { class: 'res-title', tabindex: '-1' }, t('result.interrupted')),
      h('p', { class: 'sub' }, done ? t('result.subDone', { name: displayName(a.name), min: a.min, n: done }) : displayName(a.name) + ' · ' + a.min + NB + 'min'),
      h('p', {}, why),
      h('p', { class: 'note' }, a.draw ? t('result.noCoinsDraw') : t('result.noCoins')),
      h('div', { class: 'res-actions' },
        h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: () => { closeSession(); if (a.draw && S.draw.current && S.draw.current.id === a.draw.id) acceptDraw(); else beginSession({ name: a.name, cat: a.cat, min: a.min, mode: a.mode, source: a.source, sourceId: a.sourceId, routineRunId: a.routineRunId, routineStep: a.routineStep }); } }, icon('reroll'), t('result.restart')),
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { closeSession(); go('ville'); } }, t('result.backToCity'))));
  });
}

function setWake(state) {
  const li = $('#wakeStatus');
  const msg = {
    free: ['sun', t('wake.statusFree')],
    on: ['sun', t('wake.statusOn')],
    off: ['alert', t('wake.statusOff')],
    checking: ['sun', t('wake.statusChecking')],
    na: ['alert', t('wake.statusNa')],
  }[state];
  li.className = state === 'na' || state === 'off' ? 'warn' : '';
  li.replaceChildren(icon(msg[0]), h('span', {}, msg[1]));
}
async function requestWake() {
  if (run && run.active.mode === 'free') { setWake('free'); return; }
  if (!S.settings.keepAwake) { setWake('off'); return; }
  setWake('checking');
  const res = await acquireWake();
  if (run) setWake(res);
}

