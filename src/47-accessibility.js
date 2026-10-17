/* Interactions clavier communes aux composants radio et aux fenêtres. */
function syncRadioGroups() {
  for (const group of $$('[role="radiogroup"]')) {
    const radios = $$('[role="radio"]', group).filter(r => !r.disabled);
    const selected = radios.find(r => r.getAttribute('aria-checked') === 'true') || radios[0];
    for (const radio of radios) radio.tabIndex = radio === selected ? 0 : -1;
  }
}
function setupAccessibility() {
  syncRadioGroups();
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
