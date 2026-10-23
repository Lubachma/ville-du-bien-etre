/* Disponibilité hors connexion et mises à jour, sans serveur applicatif. Hors de la fermeture de l'app : elle ne voit pas la ville. La carte
   d'installation, qui en a besoin (elle attend la première séance), est dans 59-first-steps.js. */
(() => {
  'use strict';
  const standalone = navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const secure = location.protocol === 'https:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
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
    if (secure && navigator.storage && navigator.storage.persist && !/firefox/i.test(navigator.userAgent || '')) {
      navigator.storage.persisted().then(p => p || navigator.storage.persist()).catch(() => {});
    }
  } catch { /* La sauvegarde exportée reste le filet de sécurité. */ }
})();
