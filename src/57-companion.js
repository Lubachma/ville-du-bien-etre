/* =========================================================================
   Compagnon (interface) : l'invitation, le choix de l'animal et du nom.
   ========================================================================= */
// Carte « Un compagnon pour ta ville », juste sous les outils de la ville (avant le souhait du jour) : les trois visages, une phrase,
// « Faire connaissance » et « Pas maintenant ». Cachée sans invitation ; elle ne revient pas d'elle-même après un refus.
function renderCompanionInvite() {
  const tools = $('.city-tools');
  if (!tools) return;
  let card = $('#companionInvite');
  if (!card) {
    card = h('section', { id: 'companionInvite', class: 'card companion-invite', 'aria-labelledby': 'companionInviteTitle' });
    const wish = $('#townWishCard');
    if (wish) wish.before(card); else tools.after(card);
  }
  const shown = typeof companionInvite === 'function' && companionInvite();
  card.hidden = !shown;
  if (!shown) { card.replaceChildren(); return; }
  const faces = COMPANION_SPECIES.map(species => { const cv = h('canvas'); paintCompanion(cv, { species, pose: 'idle', face: true }, 40); return cv; });
  card.replaceChildren(h('h3', { id: 'companionInviteTitle' }, t('companion.inviteTitle')),
    h('div', { class: 'companion-invite-main' }, h('div', { class: 'companion-faces', 'aria-hidden': 'true' }, ...faces), h('p', {}, t('companion.inviteLine'))),
    h('div', { class: 'wish-actions' },
      h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => openCompanionChoice() }, t('companion.meet')),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => {
        S.companionLater = nowTs();
        commit();
        $('#personalizeCity').focus({ preventScroll: true });   // la carte disparaît : le focus reste sous la ville
      } }, t('companion.later'))));
}

// Fenêtre « Ton compagnon » : trois animaux à choisir, un nom (la suggestion de l'animal tant qu'on n'a rien tapé), et le bouton
// « Accueillir Pompon » qui suit le nom. En modification (edit), le même choix, prérempli, et « Enregistrer ».
function openCompanionChoice({ edit = false } = {}) {
  const c = edit ? S.companion : null;
  if (edit && !c) return;
  let species = c ? c.species : COMPANION_SPECIES[0], typed = !!(c && c.name);
  openSheet(t('companion.choiceTitle'), body => {
    const input = h('input', { class: 'input', id: 'companionName', type: 'text', maxlength: String(COMPANION_NAME_MAX), autocomplete: 'off', spellcheck: 'false' });
    input.value = c && c.name ? c.name : t('companion.suggest.' + species);
    const group = h('div', { class: 'companion-choice', role: 'radiogroup', 'aria-label': t('companion.animal') });
    const go = h('button', { class: 'btn btn-primary btn-block companion-go', type: 'button' });
    // Le nom qui sera gardé : celui tapé, nettoyé ; rien de tapé (ou vidé), le nom suggéré, enregistré '' pour suivre la langue.
    const kept = () => (typed ? cleanCompanionName(input.value) : '');
    const shownName = () => kept() || t('companion.suggest.' + species);
    const sync = () => { go.textContent = frTypo(edit ? t('common.save') : t('companion.welcomeButton', { name: shownName() })); };
    const pick = next => {
      species = next;
      $$('button', group).forEach((b, i) => b.setAttribute('aria-checked', String(COMPANION_SPECIES[i] === next)));
      if (!typed) input.value = t('companion.suggest.' + next);
      sync();
    };
    for (const s of COMPANION_SPECIES) {
      const cv = h('canvas', { 'aria-hidden': 'true' });
      paintCompanion(cv, { species: s, pose: 'idle', wear: c ? c.wear : '' }, 72);
      group.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(s === species), onclick: () => pick(s) }, cv, h('span', {}, t('companion.species.' + s))));
    }
    input.addEventListener('input', () => { typed = input.value.trim() !== ''; sync(); });
    go.addEventListener('click', () => {
      const name = kept();
      closeSheet();
      if (edit) {
        editCompanion(species, name);
        commit();
        toast(t('companion.saved'));
        return;
      }
      adoptCompanion(species, name);
      const fresh = progressNow();
      commit();
      cheer(fresh, t('companion.welcome', { name: companionName() }));
    });
    sync();
    body.append(h('p', { class: 'note' }, t('companion.choiceNote')), group,
      h('div', { class: 'field' }, h('label', { for: 'companionName' }, t('companion.nameLabel')), input), go);
  });
}
