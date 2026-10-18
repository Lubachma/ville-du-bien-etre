/* Interactions clavier communes aux composants radio et aux fenêtres. */
function syncRadioGroups() {
  for (const group of $$('[role="radiogroup"]')) {
    const radios = $$('[role="radio"]', group).filter(r => !r.disabled);
    const selected = radios.find(r => r.getAttribute('aria-checked') === 'true') || radios[0];
    for (const radio of radios) radio.tabIndex = radio === selected ? 0 : -1;
  }
}
// Champ refusé à l'envoi d'un formulaire : un message traduit sous le champ, et le champ remis sous les yeux.
// Sur iPhone, la bulle du navigateur n'apparaît pas toujours (app installée, champ hors de l'écran) :
// « Enregistrer » semblait alors ne rien faire.
let fieldErrorSeq = 0;
function fieldErrorText(field) {
  const v = field.validity;
  if (v.valueMissing) return t('form.required');
  // Les bornes telles qu'on les tape, sans séparateur de milliers.
  if ((v.rangeUnderflow || v.rangeOverflow) && field.min && field.max) return t('form.range', { min: field.min, max: field.max });
  return t('form.check');
}
function showFieldError(field) {
  // Sous la rangée de deux champs s'il y en a une, pour que ses deux champs gardent la même hauteur.
  const place = field.closest('.row-2') || field.closest('.field') || field.closest('form');
  let note = place.querySelector('.field-error');
  if (!note) { note = h('p', { class: 'field-error', role: 'alert', id: 'field-error-' + ++fieldErrorSeq }); place.append(note); }
  note.textContent = frTypo(fieldErrorText(field));
  field.setAttribute('aria-invalid', 'true');
  field.setAttribute('aria-describedby', note.id);
  field.addEventListener('input', () => { note.remove(); field.removeAttribute('aria-invalid'); field.removeAttribute('aria-describedby'); }, { once: true });
}
function setupAccessibility() {
  syncRadioGroups();
  let focusing = false;
  document.addEventListener('invalid', e => {
    const field = e.target;
    if (!field.closest || !field.closest('form')) return;
    e.preventDefault();
    showFieldError(field);
    if (focusing) return;
    // Le premier champ refusé seulement : les autres reçoivent leur message sans voler le focus.
    focusing = true;
    queueMicrotask(() => { focusing = false; });
    field.scrollIntoView({ block: 'center' });
    field.focus({ preventScroll: true });
  }, true);
  new MutationObserver(syncRadioGroups).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-checked'] });
  document.addEventListener('keydown', e => {
    const radio = e.target.closest && e.target.closest('[role="radio"]');
    if (radio && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
      const group = radio.closest('[role="radiogroup"]');
      if (!group) return;
      const radios = $$('[role="radio"]', group).filter(r => !r.disabled);
      const index = radios.indexOf(radio), delta = ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 1;
      const next = radios[e.key === 'Home' ? 0 : e.key === 'End' ? radios.length - 1 : (index + delta + radios.length) % radios.length];
      if (next) { e.preventDefault(); next.click(); next.focus(); syncRadioGroups(); }
      return;
    }
    if (e.key !== 'Tab') return;
    const scope = !$('#sheet').hidden ? $('#sheet') : !$('#session').hidden ? $('#session') : null;
    if (!scope) return;
    const focusable = $$('button, input, select, textarea, a[href], [tabindex]', scope)
      .filter(el => !el.disabled && el.tabIndex >= 0 && !el.closest('[inert]') && el.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && (e.target === first || !focusable.includes(e.target))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (e.target === last || !scope.contains(e.target))) { e.preventDefault(); first.focus(); }
  });
}
