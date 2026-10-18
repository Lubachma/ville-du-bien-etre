const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/app.cjs');

const FILES = ['00-core.js', '05-i18n.js', '06-lang-fr.js', '07-lang-en.js', '10-state.js', '20-rules.js', '50-session.js'];
// Un contexte audio qui ne joue rien : assez pour que le son de fin programme ses notes.
const quietAudio = () => ({ currentTime: 0, state: 'running', destination: {}, resume: () => Promise.resolve(),
  createOscillator: () => ({ frequency: {}, connect() {}, start() {}, stop() {} }),
  createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }) });

test('le son de fin a le temps de s’éteindre avant la mise en veille du son', () => {
  const a = loadApp(FILES, { expose: ['Chime', 'SOUNDS'] });
  for (const type of Object.keys(a.SOUNDS)) {
    const delays = [];
    Object.assign(a.state.settings, { sound: true, vibrate: false, soundType: type });
    a.Chime.ctx = quietAudio();
    a.Chime.rest = delay => delays.push(delay);
    a.Chime.play();
    const def = a.SOUNDS[type], end = (Math.max(...def.notes.map(([dt]) => dt)) + def.decay) * 1000;
    assert.ok(delays[0] > end, `${type} : veille à ${delays[0]} ms, son jusqu’à ${end} ms`);
  }
});
