/* =========================================================================
   Ambiance : sons d'ambiance pendant les séances (pluie, vagues, feu de camp, vent, bruit doux), fabriqués par le navigateur à
   partir de bruit filtré, sans fichier. Ils passent par le contexte audio du son de fin (Chime), ouvert pendant un geste.
   ========================================================================= */
// Bruit en boucle de quelques secondes : blanc, rose ou brun, avec de courts éclats mêlés (gouttes, crépitements). La fin se
// fond dans le début : la boucle ne s'entend pas.
function noiseBuffer(ctx, seconds, color, bursts = 0) {
  const rate = ctx.sampleRate, n = Math.floor(rate * seconds), blend = Math.floor(rate * .25), raw = new Float32Array(n + blend);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < raw.length; i++) {
    const white = Math.random() * 2 - 1;
    if (color === 'pink') {
      b0 = .99765 * b0 + white * .099046; b1 = .963 * b1 + white * .2965164; b2 = .57 * b2 + white * 1.0526913;
      raw[i] = (b0 + b1 + b2 + white * .1848) * .11;
    } else if (color === 'brown') {
      last = (last + .02 * white) / 1.02;
      raw[i] = last * 3.5;
    } else raw[i] = color === 'white' ? white : 0;
  }
  // Éclats : un bruit bref qui s'éteint vite, à des places tirées au hasard.
  for (let k = 0; k < bursts * seconds; k++) {
    const at = Math.floor(Math.random() * n), len = 30 + Math.floor(Math.random() * 160), amp = .3 + Math.random() * .7;
    for (let j = 0; j < len && at + j < raw.length; j++) raw[at + j] += (Math.random() * 2 - 1) * amp * Math.exp(-6 * j / len);
  }
  const buffer = ctx.createBuffer(1, n, rate), data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = i < blend ? raw[i] * (i / blend) + raw[n + i] * (1 - i / blend) : raw[i];
  return buffer;
}
// Garde-fou en fin de chaîne : le son passe tel quel jusqu'à 0,6, puis ses crêtes s'arrondissent sans jamais atteindre 0,9,
// même au volume « fort » (le bruit est tiré au hasard : ses crêtes changent d'une boucle à l'autre).
const SOFT_LIMIT = (() => {
  const n = 1025, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1) * 2 - 1, a = Math.abs(x);
    curve[i] = a <= .6 ? x : Math.sign(x) * (.6 + .3 * Math.tanh((a - .6) / .3));
  }
  return curve;
})();
// Le graphe d'une ambiance, branché par l'appelant sur sa sortie : sources en boucle, filtres et lentes modulations, puis le
// garde-fou. gain : le volume choisi (SOUND_GAIN). Rien pour « Aucune ».
function buildAmbience(ctx, kind, gain = 1) {
  if (!AMBIENCES.includes(kind) || kind === 'none') return null;
  const out = ctx.createGain(), sources = [];
  out.gain.value = gain;
  const loop = (seconds, color, bursts) => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, seconds, color, bursts);
    src.loop = true;
    sources.push(src);
    return src;
  };
  const filter = (type, frequency, q = .7) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = frequency; f.Q.value = q; return f; };
  const level = value => { const g = ctx.createGain(); g.gain.value = value; return g; };
  // Une lente oscillation (fréquence en Hz) ajoutée à un réglage : la vague qui monte, le vent qui tourne.
  const swell = (param, rate, depth) => {
    const lfo = ctx.createOscillator(), amount = level(depth);
    lfo.frequency.value = rate;
    lfo.connect(amount); amount.connect(param);
    sources.push(lfo);
  };
  const chain = (...nodes) => { nodes.reduce((a, b) => { a.connect(b); return b; }); return nodes[nodes.length - 1]; };
  if (kind === 'rain') {
    chain(loop(6, 'pink'), filter('highpass', 400), filter('lowpass', 8000), level(.5), out);
    chain(loop(6, 'none', 70), filter('bandpass', 3200, .8), level(.18), out);
  } else if (kind === 'waves') {
    const body = level(.35);
    chain(loop(8, 'brown'), filter('lowpass', 700), body, out);
    swell(body.gain, .1, .28);
  } else if (kind === 'fire') {
    chain(loop(6, 'brown'), filter('lowpass', 500), level(.45), out);
    chain(loop(6, 'none', 5), filter('highpass', 1500), level(.35), out);
  } else if (kind === 'wind') {
    const band = filter('bandpass', 520, .9), body = level(.6);
    chain(loop(8, 'pink'), band, body, out);
    swell(band.frequency, .06, 240);
    swell(body.gain, .09, .25);
  } else if (kind === 'brown') {
    chain(loop(6, 'brown'), filter('lowpass', 1000), level(.5), out);
  }
  for (const src of sources) src.start();
  const limit = ctx.createWaveShaper();
  limit.curve = SOFT_LIMIT;
  out.connect(limit);
  return { output: limit, stop(when) { for (const src of sources) { try { src.stop(when); } catch (e) { /* déjà arrêtée */ } } } };
}
// L'ambiance qui joue : un graphe, son fondu, et son nom.
const Ambience = {
  kind: 'none', graph: null, fade: null, waiting: false, token: 0,
  // Joue fn quand le son est ouvert : aussitôt s'il l'est, sinon dès que le navigateur l'a repris (le son se met en veille quelques
  // secondes après chaque son). Une demande plus récente, ou un arrêt, annule celle qui attend. Sans contexte audio, rien.
  whenRunning(fn) {
    const c = Chime.ctx, token = ++this.token;
    if (!c) return false;
    const go = () => { if (token === this.token && c.state === 'running') fn(); };
    if (c.state === 'running') go(); else c.resume().then(go, () => {});
    return true;
  },
  // Démarre l'ambiance choisie, en fondu d'entrée de 3 s ; rien pour « Aucune ». Sans son ouvert (après un rechargement, le
  // navigateur attend un geste), elle démarre au premier toucher.
  start(kind = S.settings.ambience) {
    this.stop();
    if (kind === 'none') return;
    if (!this.whenRunning(() => { if (this.wanted()) this.play(kind, 3); }) || Chime.ctx.state !== 'running') this.waitForGesture();
  },
  // Une séance tourne ici, avec une ambiance choisie, et rien ne joue encore. Plus après son fondu de fin : le son de fin arrive seul.
  wanted() { return typeof run !== 'undefined' && !!run && !run.ambienceFaded && !this.graph && S.settings.ambience !== 'none'; },
  // Un doigt n'ouvre le son qu'à la fin du toucher (pointerup, click), pas dès pointerdown : chaque geste essaie, et l'écoute ne
  // s'arrête qu'une fois l'ambiance lancée, ou plus voulue.
  waitForGesture() {
    if (this.waiting) return;
    this.waiting = true;
    const types = ['pointerdown', 'pointerup', 'click', 'keydown'];
    const resume = () => {
      if (this.wanted()) {
        Chime.unlock(true);
        this.whenRunning(() => { if (this.wanted()) this.play(S.settings.ambience, 1); });
        if (this.wanted()) return;   // pas encore de son : le geste suivant réessaie
      }
      types.forEach(type => document.removeEventListener(type, resume, true));
      this.waiting = false;
    };
    types.forEach(type => document.addEventListener(type, resume, true));
  },
  play(kind, fadeIn) {
    const c = Chime.ctx;
    if (!c || c.state !== 'running') return false;
    let graph;
    try { graph = buildAmbience(c, kind, SOUND_GAIN[S.settings.ambienceVolume] || 1); } catch (e) { graph = null; }
    if (!graph) return false;
    const fade = c.createGain(), t0 = c.currentTime;
    fade.gain.setValueAtTime(.0001, t0);
    fade.gain.exponentialRampToValueAtTime(1, t0 + Math.max(.05, fadeIn));
    graph.output.connect(fade);
    fade.connect(c.destination);
    Object.assign(this, { kind, graph, fade });
    return true;
  },
  // S'éteint en douceur en « seconds », puis s'arrête.
  fadeOut(seconds) {
    this.token++;   // une ambiance qui attendait le son n'a plus lieu d'être
    const c = Chime.ctx, graph = this.graph, fade = this.fade;
    if (!graph || !c) return;
    const t0 = c.currentTime;
    try {
      fade.gain.cancelScheduledValues(t0);
      fade.gain.setValueAtTime(Math.max(.0001, fade.gain.value), t0);
      fade.gain.exponentialRampToValueAtTime(.0001, t0 + Math.max(.05, seconds));
    } catch (e) { /* contexte fermé */ }
    graph.stop(t0 + Math.max(.05, seconds) + .05);
    this.graph = null; this.fade = null; this.kind = 'none';
  },
  // Arrêt aussitôt (un fondu de 0,1 s, pour ne pas claquer).
  stop() { this.fadeOut(.1); },
  // Une autre ambiance, en fondu croisé court.
  switch(kind) {
    this.fadeOut(.3);
    this.whenRunning(() => this.play(kind, 1));
  },
  // Aperçu dans les réglages, pendant le geste : 3 s, puis un fondu de sortie ; le son est ensuite remis en veille.
  preview(kind) {
    Chime.unlock(true);
    this.stop();
    this.whenRunning(() => {
      if (!this.play(kind, .3)) return;
      const graph = this.graph;
      setTimeout(() => { if (this.graph === graph && !(typeof run !== 'undefined' && run)) this.fadeOut(.8); }, 2500);
      Chime.rest(5000);
    });
  },
  // Niveaux d'une ambiance rendue 4 s hors ligne, au volume donné (normal par défaut) : crête et moyenne quadratique.
  async measure(kind, volume = 'normal') {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, rate = 44100;
    if (!OAC || kind === 'none') return { peak: 0, rms: 0 };
    const off = new OAC(1, rate * 4, rate), graph = buildAmbience(off, kind, SOUND_GAIN[volume] || 1);
    if (!graph) return { peak: 0, rms: 0 };
    graph.output.connect(off.destination);
    const data = (await off.startRendering()).getChannelData(0);
    let peak = 0, sum = 0;
    for (const v of data) { peak = Math.max(peak, Math.abs(v)); sum += v * v; }
    return { peak, rms: Math.sqrt(sum / data.length) };
  },
};

const sessionRunning = () => typeof run !== 'undefined' && !!run && !run.ended;
// Le son d'une séance, interrompu (appel, Siri, verrouillage) : sa relance est demandée au retour au premier plan (60-boot.js), et quand
// son état change, page visible (Chime.unlock). Sans geste, le navigateur peut la refuser, ou la garder en attente sans jamais répondre
// (iOS, tant que dure l'interruption) : tant que le son n'est pas rouvert, le prochain toucher s'en charge.
function resumeSound() {
  const c = Chime.ctx;
  if (!c || !sessionRunning() || c.state === 'running') return;
  try { c.resume().catch(armSoundGesture); } catch (e) { /* refusé : le toucher s'en charge */ }
  if (c.state !== 'running') armSoundGesture();
}
// Repli au toucher, une seule fois : au prochain geste (fin du toucher, clic ou touche ; un doigt n'ouvre pas le son dès pointerdown), le
// son s'ouvre, puis l'ambiance repart si elle attend encore. Une séance finie entre-temps ne rouvre rien.
let soundGestureArmed = false;
function armSoundGesture() {
  if (soundGestureArmed) return;
  soundGestureArmed = true;
  const types = ['pointerup', 'click', 'keydown'];
  const unlock = () => {
    types.forEach(type => document.removeEventListener(type, unlock, true));
    soundGestureArmed = false;
    if (!sessionRunning()) return;
    Chime.unlock(true);
    if (Ambience.wanted()) Ambience.whenRunning(() => { if (Ambience.wanted()) Ambience.play(S.settings.ambience, 1); });
  };
  types.forEach(type => document.addEventListener(type, unlock, true));
}

// Bouton de l'écran de la séance : « Ambiance : Pluie ».
function renderAmbienceButton() {
  const btn = $('#ambienceBtn');
  if (btn) btn.lastChild.textContent = frTypo(t('ambience.button', { name: t('ambience.' + S.settings.ambience) }));
}
// La fenêtre « Ambiance » est ouverte : posé à son ouverture, retiré à sa fermeture (onClose).
let ambienceSheetOpen = false;
// Petite fenêtre de choix pendant la séance : le choix s'entend aussitôt et devient celui des prochaines séances. Hors séance, il est seulement
// enregistré : seul l'aperçu des réglages fait entendre une ambiance là, et il s'arrête de lui-même.
function openAmbienceSheet() {
  openSheet(t('ambience.title'), body => {
    const chips = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': t('ambience.title') });
    for (const kind of AMBIENCES) chips.append(h('button', { class: 'chip', type: 'button', role: 'radio', 'aria-checked': String(S.settings.ambience === kind), onclick: () => {
      S.settings.ambience = kind;
      commit({ silent: true });
      $$('.chip', chips).forEach((b, i) => b.setAttribute('aria-checked', String(AMBIENCES[i] === kind)));
      if (typeof run !== 'undefined' && run) {
        Chime.unlock(true);   // dans le geste : le son peut s'ouvrir
        if (kind === 'none') Ambience.stop(); else Ambience.switch(kind);
      }
      renderAmbienceButton();
    } }, t('ambience.' + kind)));
    body.append(chips, h('p', { class: 'note' }, t('ambience.note')));
  }, { onClose: () => { ambienceSheetOpen = false; } });
  ambienceSheetOpen = true;
}
// Ferme la fenêtre « Ambiance » si c'est elle qui est ouverte : la séance est finie, et ses choix n'ont plus lieu d'être.
function closeAmbienceSheet() {
  if (ambienceSheetOpen) closeSheet();
}
