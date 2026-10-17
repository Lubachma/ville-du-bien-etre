function strictContent(body) {
  body.append(
    h('p', {}, "Une web app ne peut pas t'empêcher de quitter l'écran. Ton téléphone, si : active une fois ce réglage, puis lance-le au début d'une session."),
    h('ul', { class: 'info-list' },
      h('li', {}, icon('lock'), h('span', {}, h('strong', {}, 'iPhone : '), "Réglages → Accessibilité → Accès guidé. Dans ses options, règle aussi « Verrouillage auto » sur « Jamais ». Pendant une session, appuie trois fois sur le bouton latéral (ou sur le bouton principal) : l'iPhone reste bloqué sur l'app jusqu'à ton code.")),
      h('li', {}, icon('lock'), h('span', {}, h('strong', {}, 'Android : '), "Paramètres → Sécurité → Épinglage d'application (sur Samsung : « Épingler des fenêtres »). Épingle l'app depuis l'écran des apps récentes.")),
      h('li', { class: 'warn' }, icon('alert'), h('span', {}, "N'appuie pas une seule fois sur le bouton latéral : verrouiller l'écran compte comme une sortie et la session serait interrompue."))),
    h('p', { class: 'note' }, "Sans mode strict, l'app détecte quand même quand elle n'est plus à l'écran : au-delà de " + S.settings.grace + NB + 's, la session est interrompue.'));
}
function openStrict() { openSheet('Mode strict', strictContent, { keep: true }); }

function syncText() {
  if (Store.localError) return "Attention : les derniers changements ne sont pas enregistrés sur cet appareil. Exporte une sauvegarde avant de fermer l'app.";
  if (Store.localWarning) return Store.localWarning;
  if (Store.status === 'connecting') return 'Connexion à ton compte Claude…';
  if (Store.mode === 'cloud' && Store.status === 'ok') return 'Ta progression est enregistrée sur ton compte Claude (privée) et dans ce navigateur.';
  if (Store.status === 'retrying') return "L'enregistrement sur ton compte Claude échoue pour l'instant ; nouvel essai automatique. Ta progression reste dans ce navigateur.";
  if (Store.status === 'error') return "L'enregistrement sur ton compte Claude n'est pas possible. Ta progression reste dans ce navigateur : copie une sauvegarde de temps en temps.";
  if (isStandalone()) return "Ta progression est enregistrée sur ce téléphone, dans l'app installée. Copie une sauvegarde de temps en temps.";
  return 'Ta progression est enregistrée dans ce navigateur. Copie une sauvegarde de temps en temps.';
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
  if (!m) return { error: "Ce texte n'est pas une sauvegarde de la Ville du bien-être." };
  if (hash53(BACKUP_SALT + m[2]) !== m[3]) return { error: 'Cette sauvegarde a été modifiée ou abîmée : impossible de la restaurer.' };
  try {
    const raw = JSON.parse(b64decode(m[2]));
    if (!raw || raw.v !== Number(m[1])) return { error: "Cette sauvegarde n'est pas lisible." };
    return { state: normalize(raw) };
  } catch (e) { return { error: "Cette sauvegarde n'est pas lisible." }; }
}
function summary(st) {
  const last = st.history.length ? whenLabel(st.history[0].at) : 'aucune session';
  return fmt(st.coins) + ' · ' + plural(st.city.tiles.length, 'construction', 'constructions') + ' · ' + plural(st.stats.ok, 'session réussie', 'sessions réussies') + ' · dernière : ' + last;
}
function restoreBackup(st) {
  if (S.active || run) { toast('Termine la session en cours avant de restaurer une sauvegarde.'); return; }
  const clock = S.clock;
  S = st;
  S.active = null;
  S.clock = { tz: clock.tz, maxSeen: Math.max(clock.maxSeen, st.clock.maxSeen), lastDay: maxDay(clock.lastDay, st.clock.lastDay) };
  Mode.state = null;
  closeSheet();
  const saved = commit({ flush: true });
  City.relayout();
  toast(saved ? 'Sauvegarde restaurée et enregistrée.' : "Sauvegarde chargée, mais l'enregistrement sur cet appareil a échoué. Garde ton fichier de sauvegarde.");
}

/* Sauvegarde dans un fichier, et rappel quand la dernière date un peu (gardé par appareil). */
function lsNum(key) { try { return Number(localStorage.getItem(key)) || 0; } catch (e) { return 0; } }
function lsSet(key, v) { try { localStorage.setItem(key, String(v)); } catch (e) { /* ignore */ } }
function agoText(ts) {
  const k = dayOf(ts), t = today();
  if (k >= t) return "aujourd'hui";
  if (k === shiftDay(t, -1)) return 'hier';
  return 'il y a ' + plural(Math.round((keyToUTC(t) - keyToUTC(k)) / 86400000), 'jour', 'jours');
}
function lastBackupText() {
  const at = lsNum(LS_BACKUP_AT);
  return at ? 'Dernier export depuis cet appareil : ' + agoText(at) + '. Vérifie que tu as conservé le fichier ou le texte.' : 'Aucun export fait depuis cet appareil pour le moment.';
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
    h('p', {}, h('strong', {}, 'Pense à sauvegarder ta ville')),
    h('p', { class: 'note' }, (at ? 'Dernière sauvegarde : ' + agoText(at) + '. ' : "Aucune sauvegarde pour l'instant. ") + 'Tout reste sur cet appareil : une copie récente évite de tout perdre.'),
    h('div', { class: 'remind-actions' },
      h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => saveBackupFile() }, icon('download'), 'Sauvegarder'),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { lsSet(LS_REMIND, Date.now() + 7 * 86400000); renderVille(); } }, 'Plus tard'))));
}
function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
// Sur iPhone : feuille de partage (« Enregistrer dans Fichiers »). Ailleurs : téléchargement.
async function saveBackupFile() {
  const text = exportBackup(), name = 'ville-du-bien-etre-' + today() + '.txt';
  if (isIOS() && typeof File === 'function') {
    try {
      const file = new File([text], name, { type: 'text/plain' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        markBackup();
        toast('Partage terminé. Vérifie que tu as conservé la sauvegarde.');
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;   // partage annulé
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = h('a', { href: url, download: name, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  markBackup();
  toast('Téléchargement demandé. Conserve le fichier de sauvegarde.');
}

function openSettings() {
  openSheet('Réglages', body => {
    const graceSeg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Tolérance de sortie' });
    for (const g of GRACE_CHOICES) graceSeg.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(S.settings.grace === g), onclick: () => { S.settings.grace = g; commit({ silent: true }); $$('button', graceSeg).forEach((b, i) => b.setAttribute('aria-checked', String(GRACE_CHOICES[i] === g))); } }, g + NB + 's'));
    const sw = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(S.settings.keepAwake), 'aria-label': "Garder l'écran allumé pendant une session", onclick: () => { S.settings.keepAwake = !S.settings.keepAwake; sw.setAttribute('aria-checked', String(S.settings.keepAwake)); commit({ silent: true }); } });
    const soundSw = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(S.settings.sound), 'aria-label': "Sonner à la fin d'une session", onclick: () => {
      S.settings.sound = !S.settings.sound;
      soundSw.setAttribute('aria-checked', String(S.settings.sound));
      commit({ silent: true });
      if (S.settings.sound) { Chime.unlock(); Chime.play(); }   // pour l'entendre une fois
    } });
    const themeSeg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Apparence' });
    for (const [v, label] of THEMES) themeSeg.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(S.settings.theme === v), onclick: () => { S.settings.theme = v; commit({ silent: true }); applyTheme(); $$('button', themeSeg).forEach((b, i) => b.setAttribute('aria-checked', String(THEMES[i][0] === v))); } }, label));
    const exportArea = h('textarea', { class: 'textarea', id: 'exportArea', readonly: true, hidden: true, 'aria-label': 'Sauvegarde à copier' });
    const importArea = h('textarea', { class: 'textarea', id: 'importArea', placeholder: 'Ou colle ici une sauvegarde copiée plus tôt', 'aria-label': 'Sauvegarde à restaurer' });
    const preview = h('div', { class: 'restore-preview', hidden: true });
    const fail = msg => { preview.replaceChildren(h('p', { class: 'note warn-text', role: 'alert' }, msg)); preview.hidden = false; };
    const verify = () => {
      const res = readBackup(importArea.value);
      if (res.error) { fail(res.error); return; }
      preview.replaceChildren();
      preview.hidden = false;
      const go = h('button', { class: 'btn btn-secondary', type: 'button' }, 'Remplacer ma ville par cette sauvegarde');
      twoStep(go, 'Remplacer ma ville par cette sauvegarde', 'Confirmer le remplacement', () => restoreBackup(res.state));
      preview.append(
        h('p', {}, h('strong', {}, 'Cette sauvegarde : '), summary(res.state)),
        h('p', {}, h('strong', {}, 'Ta ville actuelle : '), summary(S)),
        go);
    };
    const fileInput = h('input', { type: 'file', accept: '.txt,text/plain', hidden: true, tabindex: '-1', 'aria-hidden': 'true' });
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      const clear = () => { fileInput.value = ''; };
      if (f.size > 4e6) { clear(); fail("Ce fichier n'est pas une sauvegarde de la Ville du bien-être."); return; }
      f.text().then(t => { clear(); importArea.value = t.trim(); verify(); }, () => { clear(); fail("Ce fichier n'a pas pu être lu."); });
    });
    const reset = h('button', { class: 'btn btn-ghost', type: 'button' }, 'Tout recommencer');
    twoStep(reset, 'Tout recommencer', 'Confirmer : tout effacer', () => {
      if (S.active || run) { toast('Termine la session en cours avant de recommencer.'); return; }
      const clock = S.clock;
      S = defaultState();
      S.clock = { tz: clock.tz, maxSeen: clock.maxSeen, lastDay: clock.lastDay };
      closeSheet();
      Mode.state = null;
      commit({ flush: true });
      City.relayout();
      toast('Nouvelle ville créée.');
    });
    body.append(
      h('div', { class: 'setting' },
        h('button', { class: 'btn btn-secondary btn-block', type: 'button', onclick: openHelp }, icon('info'), 'Bien démarrer et installer l’app'),
        h('p', { class: 'note', id: 'pwaStatus', role: 'status' }, pwaText()),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => {
          if (window.VillePWA) window.VillePWA.check().then(() => { renderPwaStatus(); toast('Recherche de mise à jour effectuée.'); }, () => toast('La recherche a échoué. Vérifie ta connexion.'));
        } }, 'Rechercher une mise à jour')),
      h('hr', { class: 'divider' }),
      h('div', { class: 'setting' },
        h('span', { class: 'section-title' }, 'Tolérance de sortie'),
        h('p', { class: 'note' }, "En mode Concentration uniquement : durée pendant laquelle l'app peut quitter l'écran sans que la session soit interrompue."),
        graceSeg),
      h('div', { class: 'setting-row' }, h('span', { class: 'setting-label' }, "Garder l'écran allumé pendant une session"), sw),
      h('div', { class: 'setting' },
        h('div', { class: 'setting-row' }, h('span', { class: 'setting-label' }, "Sonner à la fin d'une session"), soundSw),
        h('p', { class: 'note' }, 'Un carillon discret, qui suit le mode silencieux du téléphone.')),
      h('hr', { class: 'divider' }),
      h('div', { class: 'setting' },
        h('span', { class: 'section-title' }, 'Apparence'),
        h('p', { class: 'note' }, "Auto suit le réglage du téléphone. La nuit, les fenêtres de la ville s'allument."),
        themeSeg),
      h('hr', { class: 'divider' }),
      h('div', { class: 'setting' }, h('span', { class: 'section-title' }, 'Mode strict'), h('button', { class: 'btn btn-secondary', type: 'button', onclick: openStrict }, icon('lock'), "Bloquer le téléphone sur l'app")),
      h('hr', { class: 'divider' }),
      h('div', { class: 'setting' },
        h('span', { class: 'section-title' }, 'Sauvegarde'),
        h('p', { class: 'note', id: 'syncStatus', role: 'status' }, syncText()),
        h('p', { class: 'note', id: 'backupLast' }, lastBackupText()),
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => saveBackupFile() }, icon('download'), 'Enregistrer dans un fichier'),
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => {
          const text = exportBackup();
          exportArea.value = text;
          exportArea.hidden = false;
          const done = () => { markBackup(); toast('Sauvegarde copiée.'); };
          const fallback = () => { exportArea.focus(); exportArea.select(); toast('Sélectionne le texte et copie-le.'); };
          try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
        } }, icon('copy'), 'Copier ma sauvegarde'),
        exportArea),
      h('div', { class: 'setting' },
        h('span', { class: 'setting-label' }, 'Restaurer une sauvegarde'),
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => fileInput.click() }, icon('upload'), 'Ouvrir un fichier de sauvegarde'),
        fileInput,
        importArea,
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: verify }, 'Vérifier la sauvegarde'),
        preview),
      h('hr', { class: 'divider' }),
      reset,
      h('p', { class: 'note' }, 'Gains : 1' + NB + 'M par minute. Bonus : premier tirage accepté +20' + NB + '% (envie) ou +50' + NB + '% (obligation) à partir de 3 idées, divisé par deux à chaque relance ; série de jours +10' + NB + '% par jour (max +50' + NB + '%).'));
  });
}

