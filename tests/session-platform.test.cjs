const test = require('node:test');
const assert = require('node:assert/strict');
const { storage, lockManager, stateApp } = require('./helpers/state-vm.cjs');

// Les séances sur téléphone (B3, B4, B6) : l'écran reste allumé, le son revient après une interruption, l'anneau avance une fois par
// seconde. Les vraies fonctions de l'écran allumé et du chrono tournent ici (setWake, acquireWake, renderTimer), sur un faux DOM, un
// faux verrou d'écran (navigator.wakeLock) et un faux contexte audio, sur le modèle du banc d'essai de l'audit.
const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '50-session.js', '51-ambience.js'];
const EXPOSE = ['Chime', 'Ambience', 'beginSession', 'updatePresence'];
const flush = () => new Promise(resolve => setImmediate(resolve));
const settle = () => new Promise(resolve => setTimeout(resolve, 10));

// Un faux DOM : un élément par sélecteur, les écouteurs du document, le nombre d'écritures de chaque propriété de style, et chaque
// contenu affiché par replaceChildren (shown).
function fakeDocument() {
  const node = tag => {
    const el = { tagName: tag, nodeType: 1, hidden: true, className: '', textContent: '', children: [], writes: {}, shown: [],
      setAttribute() {}, addEventListener() {}, focus() {}, querySelector() { return null; },
      append(...kids) { el.children.push(...kids); }, replaceChildren(...kids) { el.children = kids; el.shown.push(textOf(el)); } };
    el.style = new Proxy({ setProperty() {} }, { set(style, key, value) { el.writes[key] = (el.writes[key] || 0) + 1; style[key] = value; return true; } });
    return el;
  };
  const elements = new Map(), listeners = {};
  return {
    visibilityState: 'visible', hasFocus: () => true,
    querySelector(sel) { if (!elements.has(sel)) elements.set(sel, node(sel)); return elements.get(sel); },
    querySelectorAll: () => [],
    createElement: node, createElementNS: (ns, tag) => node(tag), createTextNode: text => ({ nodeType: 3, textContent: String(text) }),
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter(f => f !== fn); },
    // Un geste : chaque écouteur de ce type, dans l'ordre d'inscription.
    dispatch(type) { for (const fn of [...(listeners[type] || [])]) fn({ type, target: this }); },
  };
}
const textOf = el => (el.nodeType === 3 ? el.textContent : el.textContent + el.children.map(textOf).join(''));
// Le statut « écran allumé » affiché sous le chrono.
const status = doc => textOf(doc.querySelector('#wakeStatus'));
const ON = /^Écran maintenu allumé pendant la session\.$/, NA = /^L'écran ne peut pas être maintenu allumé ici/;

// Faux verrou d'écran : chaque demande est notée avec l'heure du chrono, et son verrou rangé dans `locks`, dans l'ordre des demandes.
// « hold » retient les réponses jusqu'à grant(), « refuse » les refuse. Un verrou se relâche comme le vrai : released passe à vrai, puis
// l'événement « release ». held() compte les verrous accordés et pas relâchés.
function fakeWakeLock(now) {
  const wl = { asked: [], locks: [], waiting: [], hold: false, refuse: false };
  wl.request = () => {
    wl.asked.push(now());
    if (wl.refuse) return Promise.reject(new Error('NotAllowedError'));
    const l = { granted: false, released: false, listeners: [], addEventListener(type, fn) { if (type === 'release') l.listeners.push(fn); },
      release() { if (!l.released) { l.released = true; l.listeners.forEach(fn => fn()); } return Promise.resolve(); } };
    wl.locks.push(l);
    return new Promise(resolve => {
      const answer = () => { l.granted = true; resolve(l); };
      if (wl.hold) wl.waiting.push(answer); else answer();
    });
  };
  // Le navigateur répond enfin aux demandes retenues, dans l'ordre, ou la plus récente d'abord.
  wl.grant = ({ newestFirst = false } = {}) => (newestFirst ? wl.waiting.splice(0).reverse() : wl.waiting.splice(0)).forEach(answer => answer());
  wl.held = () => wl.locks.filter(l => l.granted && !l.released).length;
  return wl;
}

// Faux contexte audio. Son état se change à la main (set : l'événement statechange suit), et resume() ouvre le son ('ok'), le refuse
// ('fail') ou reste en attente ('wait'), selon audio.resume. audio.contexts liste les contextes créés, audio.resumes compte les relances.
function fakeAudio() {
  const audio = { contexts: [], resumes: 0, resume: 'ok' };
  const param = () => ({ value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = () => ({ connect: x => x, disconnect() {}, start() {}, stop() {}, gain: param(), frequency: param(), Q: param() });
  audio.AudioContext = class {
    constructor() { Object.assign(this, { state: 'suspended', currentTime: 0, sampleRate: 8000, destination: node(), onstatechange: null }); audio.contexts.push(this); }
    set(state) { this.state = state; if (this.onstatechange) this.onstatechange({ type: 'statechange' }); }
    resume() {
      audio.resumes++;
      if (audio.resume === 'fail') return Promise.reject(new Error('NotAllowedError'));
      if (audio.resume === 'wait') return new Promise(() => {});
      this.set('running');
      return Promise.resolve();
    }
    suspend() { this.set('suspended'); return Promise.resolve(); }
    createBuffer(channels, length) { return { duration: length / this.sampleRate, getChannelData: () => new Float32Array(length) }; }
    createBufferSource() { return node(); }
    createOscillator() { return node(); }
    createGain() { return node(); }
    createBiquadFilter() { return node(); }
    createWaveShaper() { return node(); }
  };
  return audio;
}

// Un onglet de séance, ouvert `later` ms après midi, avec ces réglages en plus. Ni setWake ni renderTimer ne sont bouchonnés.
function platform({ disk = storage(), locks = lockManager(), later = 0, settings = {} } = {}) {
  const a = stateApp(disk, locks, { files: FILES, expose: EXPOSE, real: ['setWake', 'renderTimer'] });
  const doc = fakeDocument(), audio = fakeAudio(), wl = fakeWakeLock(() => a.context.performance.now());
  a.context.document = doc;
  a.context.navigator.wakeLock = wl;
  a.context.window.AudioContext = audio.AudioContext;
  a.advance(later);
  a.init();
  Object.assign(a.api.state.settings, settings);
  a.commit({ silent: true });
  return { a, doc, audio, wl };
}
// Retour au premier plan : ce que fait l'écouteur « visibilitychange » de 60-boot.js pour la séance et pour le son. Ce fichier démarre
// l'app et ne se charge pas ici ; tests/fiabilite-browser.cjs passe par le vrai écouteur.
function showPage({ a, doc }) {
  doc.visibilityState = 'visible';
  a.updatePresence();
  a.context.resumeSound();
}
// Des tics du chrono, toutes les 250 ms, comme son minuteur.
async function tics(a, count) {
  for (let i = 0; i < count; i++) { a.advance(250); a.tick(); await flush(); }
}
// Écarts entre deux demandes de verrou, en ms.
const gaps = times => times.slice(1).map((at, i) => at - times[i]);

test("écran allumé : redemandé au tic si iOS l'a relâché", async () => {
  const { a, doc, wl } = platform();
  await a.beginSession({ name: 'Lecture', cat: 'esprit', min: 10, mode: 'focus' });
  assert.ok(a.api.run);
  assert.equal(wl.asked.length, 1);
  assert.match(status(doc), ON);
  // Une courte sortie que seul le tic remarque : iOS a relâché le verrou, et n'en redonne pas tout de suite. La page est visible, la
  // séance continue ; le statut dit la vérité.
  wl.refuse = true;
  wl.locks[0].release();
  assert.match(status(doc), NA);
  const shown = doc.querySelector('#wakeStatus').shown, since = shown.length;
  // 6 s, tic après tic : une nouvelle demande, une seule, 5 s au moins après la précédente. Refusée, elle ne fait pas clignoter le
  // statut (« Activation… » puis « indisponible » toutes les 5 s) : il reste « indisponible ».
  await tics(a, 24);
  assert.equal(wl.asked.length, 2);
  assert.ok(gaps(wl.asked).every(gap => gap >= 5000), JSON.stringify(gaps(wl.asked)));
  assert.deepEqual(shown.slice(since).filter(text => !NA.test(text)), []);
  assert.match(status(doc), NA);
  // iOS en redonne : le tic suivant permis le reprend, et le garde sans rien redemander.
  wl.refuse = false;
  await tics(a, 24);
  assert.equal(wl.asked.length, 3);
  assert.ok(gaps(wl.asked).every(gap => gap >= 5000), JSON.stringify(gaps(wl.asked)));
  assert.equal(wl.held(), 1);
  assert.match(status(doc), ON);
  // Plus de 5 s après, iOS le relâche encore, page visible : il est redemandé aussitôt, sans attendre le tic.
  await tics(a, 24);
  wl.locks[1].release();
  await flush();
  assert.equal(wl.asked.length, 4);
  assert.equal(wl.held(), 1);
  assert.match(status(doc), ON);
});

test('écran allumé : un verrou arrivé après la fin est relâché', async () => {
  const { a, doc, wl } = platform();
  // Le navigateur tarde à répondre, et la séance tourne déjà (comme après la mise en garde « écran allumé ») : sa demande attend.
  wl.hold = true;
  await a.startSession({ name: 'Lecture', cat: 'esprit', min: 10, mode: 'focus' });
  assert.ok(a.api.run);
  assert.equal(wl.asked.length, 1);
  await a.failSession('abandon', 0);
  assert.equal(a.api.run, null);
  // La réponse arrive après l'abandon : le verrou est relâché aussitôt, rien n'est tenu.
  wl.grant(); await flush();
  assert.equal(wl.locks.length, 1);
  assert.equal(wl.locks[0].released, true);
  assert.equal(wl.held(), 0);
  // Une autre séance a commencé entre-temps, et sa réponse arrive avant la vieille : la vieille est relâchée, la nouvelle séance garde
  // son verrou, et son statut reste juste.
  await a.startSession({ name: 'Lecture', cat: 'esprit', min: 10, mode: 'focus' });
  await a.failSession('abandon', 0);
  await a.startSession({ name: 'Sport', cat: 'corps', min: 10, mode: 'focus' });
  assert.equal(wl.asked.length, 3);
  wl.grant({ newestFirst: true }); await flush();
  assert.deepEqual(wl.locks.map(l => l.released), [true, true, false]);
  assert.equal(wl.held(), 1);
  assert.match(status(doc), ON);
});

test("écran allumé : deux réponses croisées ne laissent qu'un verrou, relâché à la fin", async () => {
  const { a, wl } = platform();
  await a.beginSession({ name: 'Lecture', cat: 'esprit', min: 10, mode: 'focus' });
  // iOS relâche le verrou, puis le navigateur tarde à répondre : au bout de 11 s, deux nouvelles demandes attendent.
  wl.hold = true;
  wl.locks[0].release();
  await tics(a, 44);
  assert.equal(wl.asked.length, 3);
  // Les deux réponses arrivent : un seul verrou est gardé, et la fin de la séance le relâche.
  wl.grant(); await flush();
  assert.equal(wl.held(), 1);
  await a.failSession('abandon', 0);
  assert.equal(wl.held(), 0);
});

test('son : relancé au retour, ou au premier toucher', async () => {
  const p = platform({ settings: { sound: true } }), { a, doc, audio } = p;
  await a.beginSession({ name: 'Marche', cat: 'corps', min: 30, mode: 'free' });
  const ctx = audio.contexts[0];
  assert.ok(a.api.run);
  assert.equal(ctx.state, 'running');
  assert.equal(audio.resumes, 1);
  // Un appel ou le verrouillage : la page passe en arrière-plan et iOS interrompt le son. Page cachée, rien n'est relancé.
  doc.visibilityState = 'hidden';
  a.updatePresence();
  ctx.set('interrupted');
  assert.equal(audio.resumes, 1);
  // Retour au premier plan : la relance est demandée. Ici, sans geste, le navigateur la refuse.
  audio.resume = 'fail';
  showPage(p);
  assert.equal(audio.resumes, 2);
  await settle();
  assert.equal(ctx.state, 'interrupted');
  // Le premier toucher rouvre le son, dès la fin du geste (un doigt n'ouvre pas le son dès pointerdown), et une seule fois.
  const forced = [], unlock = a.Chime.unlock;
  a.Chime.unlock = function (force) { forced.push(force); return unlock.call(this, force); };
  audio.resume = 'ok';
  doc.dispatch('pointerup');
  assert.deepEqual(forced, [true]);
  assert.equal(ctx.state, 'running');
  doc.dispatch('click'); doc.dispatch('pointerup');
  assert.deepEqual(forced, [true]);
  // Siri, page visible : l'état du son change, la relance est demandée aussitôt.
  ctx.set('interrupted');
  assert.equal(ctx.state, 'running');
  assert.equal(audio.resumes, 4);
  // Refusée encore, et la séance prend fin avant tout toucher : le toucher suivant ne rouvre plus rien, aucun son hors séance.
  audio.resume = 'fail';
  ctx.set('interrupted');
  assert.equal(audio.resumes, 5);
  await a.failSession('abandon', 0);
  doc.dispatch('pointerup');
  assert.deepEqual(forced, [true]);
});

test("ambiance : rouverte à la fin du toucher, pas seulement à pointerdown", async () => {
  const disk = storage(), locks = lockManager();
  const first = platform({ disk, locks, settings: { sound: false, ambience: 'rain' } });
  await first.a.beginSession({ name: 'Marche', cat: 'corps', min: 20, mode: 'free' });
  first.a.endRun(); disk.removeItem('ville-bien-etre/v2:beat');
  // L'app rouverte : la séance reprend, son ambiance attend un geste.
  const { a, doc, audio } = platform({ disk, locks, later: 5 * 60000 });
  a.checkActive(); await settle(); await settle();
  assert.ok(a.api.run, 'séance reprise');
  assert.equal(a.Ambience.kind, 'none');
  // Un doigt se pose : pendant pointerdown, le navigateur n'ouvre pas encore le son, sa réponse attend.
  audio.resume = 'wait';
  doc.dispatch('pointerdown');
  assert.equal(audio.contexts.length, 1);
  assert.equal(a.Ambience.kind, 'none');
  // Il se lève : le son s'ouvre, la pluie joue.
  audio.resume = 'ok';
  doc.dispatch('pointerup');
  assert.equal(audio.contexts[0].state, 'running');
  assert.equal(a.Ambience.kind, 'rain');
});

test("son de fin : préparé après réouverture d'une Activité libre", async () => {
  for (const sound of [true, false]) {
    const disk = storage(), locks = lockManager();
    const first = platform({ disk, locks, settings: { sound, ambience: 'none' } });
    await first.a.beginSession({ name: 'Marche', cat: 'corps', min: 20, mode: 'free' });
    assert.ok(first.a.api.run);
    // L'app est fermée (le battement de la séance effacé), puis rouverte 5 min plus tard : la séance reprend, le son pas encore.
    first.a.endRun(); disk.removeItem('ville-bien-etre/v2:beat');
    const { a, doc, audio } = platform({ disk, locks, later: 5 * 60000 });
    a.checkActive(); await settle(); await settle();
    assert.ok(a.api.run, 'séance reprise');
    assert.equal(audio.contexts.length, 0);
    // Un toucher : le son de fin est prêt (contexte créé et ouvert), même sans ambiance. Son de fin coupé : rien.
    doc.dispatch('pointerup');
    assert.equal(audio.contexts.length, sound ? 1 : 0, 'son de fin ' + (sound ? 'activé' : 'coupé'));
    if (sound) assert.equal(audio.contexts[0].state, 'running');
  }
});

test('ambiance : un toucher après son fondu de fin ne la relance pas', async () => {
  const { a, doc, audio } = platform({ settings: { sound: true, ambience: 'rain' } });
  await a.beginSession({ name: 'Marche', cat: 'corps', min: 5, mode: 'free' });
  const ctx = audio.contexts[0];
  assert.equal(a.Ambience.kind, 'rain');
  // Le son s'interrompt et sa relance est refusée : le prochain toucher le rouvrira.
  audio.resume = 'fail';
  ctx.set('interrupted');
  // 1 s avant la fin, la pluie s'est éteinte en douceur : le son de fin doit arriver seul.
  a.advance(5 * 60000 - 1000); a.tick();
  assert.equal(a.Ambience.kind, 'none');
  audio.resume = 'ok';
  doc.dispatch('pointerup');
  assert.equal(ctx.state, 'running', 'le son de fin ne peut pas jouer');
  assert.equal(a.Ambience.kind, 'none', 'la pluie est repartie juste avant le son de fin');
});

test('anneau : une mise à jour par seconde', async () => {
  const { a, doc } = platform();
  await a.beginSession({ name: 'Lecture', cat: 'esprit', min: 5, mode: 'focus' });
  const ring = doc.querySelector('#ringFill'), start = ring.writes.strokeDashoffset;
  assert.ok(start >= 1, "l'anneau est dessiné au départ");
  // 2 s en 8 tics : l'anneau n'avance qu'avec la seconde affichée.
  for (let i = 0; i < 8; i++) { a.advance(250); a.tick(); }
  assert.equal(ring.writes.strokeDashoffset - start, 2);
  assert.equal(doc.querySelector('#timer').textContent, '04:58');
  // Le rendu forcé (l'écran de séance qui s'affiche) le redessine toujours.
  a.context.renderTimer(true);
  assert.equal(ring.writes.strokeDashoffset - start, 3);
});
