/* Installation mobile et disponibilité hors connexion, sans serveur applicatif. */
(() => {
  'use strict';
  const HINT_KEY = 'ville-bien-etre/v1:install-hint';
  const ua = navigator.userAgent || '';
  const standalone = navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const secure = location.protocol === 'https:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  document.documentElement.classList.toggle('standalone', standalone);
  let registration = null;
  const pwa = window.VillePWA = {
    state: secure && 'serviceWorker' in navigator ? 'loading' : 'unavailable',
    version: '', update: false, reloading: false, reloadAvailable: false,
    check: () => registration ? registration.update() : Promise.resolve(),
    activate() {
      if (this.reloading) return;
      if (this.reloadAvailable && !registration?.waiting) { this.reloading = true; location.reload(); return; }
      if (!registration || !registration.waiting) return;
      this.reloading = true;
      registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
    },
  };
  const notify = () => window.dispatchEvent(new CustomEvent('ville:pwa'));
  function readVersion(worker) {
    if (!worker || typeof MessageChannel !== 'function') return;
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); channel.port2.close(); }, 2500);
    channel.port1.onmessage = e => {
      clearTimeout(timer); pwa.version = String(e.data || '').slice(0, 32);
      channel.port1.close(); channel.port2.close(); notify();
    };
    worker.postMessage({ type: 'VERSION' }, [channel.port2]);
  }
  function observe(reg) {
    registration = reg;
    pwa.update = !!reg.waiting || pwa.reloadAvailable;
    notify();
    const watch = worker => {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') {
          pwa.update = pwa.reloadAvailable || !!reg.waiting && !!navigator.serviceWorker.controller;
          notify();
        } else if (worker.state === 'redundant' && !reg.active) { pwa.state = 'error'; notify(); }
      });
    };
    watch(reg.installing);
    reg.addEventListener('updatefound', () => watch(reg.installing));
  }
  if (secure && 'serviceWorker' in navigator) {
    let controllingWorker = navigator.serviceWorker.controller;
    const register = async () => {
      try {
        observe(await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }));
        const ready = await navigator.serviceWorker.ready;
        pwa.state = 'ready'; pwa.update = !!ready.waiting || pwa.reloadAvailable;
        readVersion(ready.active); notify();
      } catch { pwa.state = 'error'; notify(); }
    };
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (pwa.reloading) { location.reload(); return; }
      if (controllingWorker && controllingWorker !== navigator.serviceWorker.controller) {
        pwa.reloadAvailable = true; pwa.update = true;
      }
      controllingWorker = navigator.serviceWorker.controller;
      pwa.state = 'ready'; readVersion(navigator.serviceWorker.controller); notify();
    });
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }
  notify();
  try {
    if (secure && navigator.storage && navigator.storage.persist && !/firefox/i.test(ua)) {
      navigator.storage.persisted().then(p => p || navigator.storage.persist()).catch(() => {});
    }
  } catch { /* La sauvegarde exportée reste le filet de sécurité. */ }

  const hidden = () => { try { return localStorage.getItem(HINT_KEY) === '1'; } catch { return false; } };
  const hideForGood = () => { try { localStorage.setItem(HINT_KEY, '1'); } catch { /* pas de stockage */ } };
  // Textes de l'app (05-i18n.js) : la carte suit la langue affichée.
  const t = (key, params) => (window.VilleI18n ? window.VilleI18n.t(key, params) : key);
  const node = (tag, attrs, text) => {
    const el = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    if (text != null) el.textContent = text;
    return el;
  };
  let deferred = null, card = null, kind = '', installHidden = false, helpShown = false;
  // Bouton « Installer » masqué et aide affichée survivent à un changement de langue.
  function applyState() {
    const button = card.querySelector('[data-act="install"]');
    if (button) button.hidden = installHidden;
    let help = card.querySelector('.install-help');
    if (helpShown && !help) { help = node('p', { class: 'note install-help' }); card.querySelector('.install-main').append(help); }
    if (help) help.textContent = t('install.help');
  }
  function fill() {
    const actions = node('div', { class: 'install-actions' });
    if (kind === 'prompt') actions.append(node('button', { class: 'btn btn-primary btn-sm', type: 'button', 'data-act': 'install' }, t('install.install')));
    actions.append(node('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-act': 'hide' }, t('install.hide')));
    const main = node('div', { class: 'install-main' });
    main.append(node('h3', { id: 'installTitle' }, t('install.title')),
      node('p', {}, kind === 'ios' ? t('install.ios') : t('install.prompt')),
      node('p', { class: 'note' }, t('install.personal')), actions);
    card.replaceChildren(node('img', { src: 'icons/icon-192.png', alt: '', width: '48', height: '48' }), main);
    applyState();
  }
  function installHelp() {
    if (!card) return;
    installHidden = true; helpShown = true;
    applyState();
  }
  function show(variant) {
    if (standalone || hidden()) return;
    if (card) {
      if (variant === 'prompt') { installHidden = false; applyState(); }
      return;
    }
    const view = document.getElementById('view-ville');
    if (!view) return;
    kind = variant; installHidden = false; helpShown = false;
    card = document.createElement('div');
    card.className = 'card install-card'; card.id = 'installCard';
    card.setAttribute('role', 'region'); card.setAttribute('aria-labelledby', 'installTitle');
    fill();
    card.addEventListener('click', async e => {
      const button = e.target.closest('button[data-act]');
      if (!button) return;
      if (button.dataset.act === 'hide') { hideForGood(); remove(); return; }
      if (button.dataset.act !== 'install' || !deferred) return;
      const prompt = deferred; deferred = null;
      installHelp();
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice && choice.outcome === 'accepted') remove();
      } catch { installHelp(); }
    });
    view.prepend(card);
  }
  function remove() {
    if (!card) return;
    const focus = card.contains(document.activeElement);
    card.remove(); card = null;
    if (focus) document.getElementById('ctaStart')?.focus();
  }
  if (!standalone && secure) {
    if (ios) show('ios');
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault(); deferred = e;
      if (window.matchMedia('(pointer: coarse)').matches) show('prompt');
    });
    window.addEventListener('appinstalled', () => { deferred = null; remove(); });
  }
  window.addEventListener('ville:lang', () => { if (card) fill(); });
})();
