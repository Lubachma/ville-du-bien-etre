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
  let deferred = null, card = null;
  function installHelp() {
    if (!card) return;
    const button = card.querySelector('[data-act="install"]');
    if (button) button.hidden = true;
    let help = card.querySelector('.install-help');
    if (!help) { help = document.createElement('p'); help.className = 'note install-help'; card.querySelector('.install-main').append(help); }
    help.textContent = 'Tu peux aussi utiliser le menu de ton navigateur → Installer l’application ou Ajouter à l’écran d’accueil. L’app reste utilisable ici.';
  }
  function show(kind) {
    if (standalone || hidden()) return;
    if (card) {
      if (kind === 'prompt') { const button = card.querySelector('[data-act="install"]'); if (button) button.hidden = false; }
      return;
    }
    const view = document.getElementById('view-ville');
    if (!view) return;
    card = document.createElement('div');
    card.className = 'card install-card'; card.id = 'installCard';
    card.setAttribute('role', 'region'); card.setAttribute('aria-labelledby', 'installTitle');
    card.innerHTML = '<img src="icons/icon-192.png" alt="" width="48" height="48"><div class="install-main">'
      + '<h3 id="installTitle">Ta ville sur ton téléphone</h3>'
      + (kind === 'ios'
        ? '<p>Dans Safari, ouvre Partager, puis « Sur l’écran d’accueil » et « Ajouter ».</p>'
        : '<p>Installe l’app pour la retrouver sur ton écran d’accueil.</p>')
      + '<p class="note">Ta ville est personnelle et reste sur cet appareil. Pour la transférer : Réglages → Sauvegarde.</p>'
      + '<div class="install-actions">'
      + (kind === 'prompt' ? '<button class="btn btn-primary btn-sm" type="button" data-act="install">Installer</button>' : '')
      + '<button class="btn btn-ghost btn-sm" type="button" data-act="hide">Ne plus afficher</button></div></div>';
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
})();
