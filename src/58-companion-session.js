/* =========================================================================
   Compagnon (séance) : il fait l'activité avec toi dans l'anneau, puis se réjouit sur l'écran de fin.
   ========================================================================= */
let sessCompanion = { timer: 0, shown: false, pose: '', animated: false };
// Le compagnon dans l'anneau, sous le minuteur, dans le geste du domaine de la séance : une image toutes les 400 ms si la ville peut
// s'animer, sinon une seule. Rien sans compagnon affiché.
function renderSessionCompanion(a) {
  stopSessionCompanion();
  const cv = $('#sessCompanion'), c = S.companion, shown = !!c && S.settings.companionShown !== false;
  if (!cv) return;
  cv.hidden = !shown;
  sessCompanion = { timer: 0, shown, pose: shown ? companionPose(a.cat) : '', animated: false };
  if (!shown) return;
  const look = { species: c.species, wear: c.wear, pose: sessCompanion.pose }, paint = () => paintCompanion(cv, look, 112, { t: performance.now() / 1000 });
  paint();
  if (S.settings.ambient === false || reducedMotion()) return;
  sessCompanion.animated = true;
  sessCompanion.timer = setInterval(() => { if (document.visibilityState === 'visible') paint(); }, 400);
}
function stopSessionCompanion() { clearInterval(sessCompanion.timer); sessCompanion.timer = 0; }
function sessionCompanionState() { return { shown: sessCompanion.shown, pose: sessCompanion.pose, animated: sessCompanion.animated }; }

// Écran de fin d'une séance réussie : le compagnon qui se réjouit, le temps passé ensemble, le mot du jour à la première séance du
// jour, et un niveau gagné (le plus haut, s'il y en a plusieurs) avec son accessoire et « Lui mettre ». Rien sans compagnon affiché.
function companionResult(gain, firstToday) {
  const c = S.companion;
  if (!c || !gain || S.settings.companionShown === false) return null;
  const cv = h('canvas', { class: 'res-companion', 'aria-hidden': 'true' }), cheer = wear => paintCompanion(cv, { species: c.species, wear, pose: 'cheer' }, 96, { t: .3 });
  cheer(c.wear);
  const lines = [h('p', { class: 'res-companion-time' }, t('companion.together', { min: Math.round(gain.gained) }))];
  if (firstToday) lines.push(h('p', { class: 'companion-word' }, t('companion.quote', { word: companionWord() })));
  if (gain.after > gain.before) {
    const wear = COMPANION_WEAR[gain.after - 2];
    const put = h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => {
      if (!wearCompanion(wear)) return;
      commit({ silent: true });
      cheer(wear);
      put.textContent = frTypo(t('companion.wornDone'));
      put.disabled = true;
    } }, t('companion.wearIt'));
    lines.push(h('p', { class: 'res-companion-level' }, t('companion.levelUp', { level: gain.after, name: companionName(), thing: t('companion.wearThing.' + wear) })), put);
  }
  return h('div', { class: 'res-companion-block' }, cv, h('div', { class: 'res-companion-text' }, ...lines));
}
// Écran d'une séance interrompue : le compagnon, simplement assis, sans un mot de plus.
function companionFail() {
  const c = S.companion;
  if (!c || S.settings.companionShown === false) return null;
  const cv = h('canvas', { class: 'res-companion', 'aria-hidden': 'true' });
  paintCompanion(cv, { species: c.species, wear: c.wear, pose: 'idle' }, 96);
  return cv;
}

// Respiration guidée, seulement dans les séances Calme : « Respirer avec Pompon » (ou « Respiration guidée » sans compagnon visible).
// Allumée, elle alterne toutes les 5 s « Inspire » et « Expire » sous le minuteur ; le compagnon (ou un disque léger) grandit à
// l'inspiration. Le choix revient aux séances Calme suivantes.
let breath = { timer: 0, phase: '' };
function renderBreathing(a) {
  stopBreathing();
  const btn = $('#breathBtn');
  if (!btn) return;
  btn.hidden = a.cat !== 'calme';
  if (btn.hidden) return;
  const pet = !!S.companion && S.settings.companionShown !== false;
  btn.lastChild.textContent = frTypo(pet ? t('breath.with', { name: companionName() }) : t('breath.guided'));
  btn.setAttribute('aria-pressed', String(S.settings.breathing === true));
  btn.onclick = () => setBreathing(S.settings.breathing !== true);
  $('#breathDisc').hidden = pet;
  if (S.settings.breathing === true) startBreathing();
}
function setBreathing(on) {
  S.settings.breathing = on;
  commit({ silent: true });
  $('#breathBtn').setAttribute('aria-pressed', String(on));
  if (on) startBreathing(); else stopBreathing();
}
function startBreathing() {
  stopBreathing();
  const wrap = $('.ring-wrap'), word = $('#breathWord');
  const step = phase => {
    breath.phase = phase;
    wrap.classList.toggle('inhale', phase === 'in');
    wrap.classList.toggle('exhale', phase === 'out');
    word.textContent = frTypo(t(phase === 'in' ? 'breath.in' : 'breath.out'));
    word.classList.remove('fresh'); void word.offsetWidth; word.classList.add('fresh');   // le mot apparaît en fondu
  };
  wrap.classList.add('breathing');
  word.hidden = false;
  $('#timerSub').hidden = true;
  void wrap.offsetWidth;   // la taille de départ d'abord : l'inspiration grandit en douceur
  step('in');
  breath.timer = setInterval(() => step(breath.phase === 'in' ? 'out' : 'in'), BREATH_MS);
}
function stopBreathing() {
  clearInterval(breath.timer);
  breath = { timer: 0, phase: '' };
  const wrap = $('.ring-wrap'), word = $('#breathWord'), sub = $('#timerSub');
  if (wrap) wrap.classList.remove('breathing', 'inhale', 'exhale');
  if (word) word.hidden = true;
  if (sub) sub.hidden = false;
}
