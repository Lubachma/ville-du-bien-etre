/* =========================================================================
   Vie de la ville : ce qui se dessine par-dessus les éléments (fumée, faisceau…).
   Uniquement des dessins, avec le peintre de makePainter ; t est le temps en secondes.
   ========================================================================= */
// Haut des cheminées : position sur la case et hauteur (en largeurs de case).
const CHIMNEYS = { maison: [.64, .4, .58], boulangerie: [.35, .35, .48] };
// Trois bouffées qui montent, s'élargissent et s'effacent au-dessus de la cheminée.
function drawSmoke(g, x, y, t, chimney = CHIMNEYS.maison) {
  const [u, v, z] = chimney, [sx, sy] = g.P(x + u, y + v, g.tw * z);
  for (let i = 0; i < 3; i++) {
    const k = (t * .35 + i / 3) % 1;
    g.ctx.globalAlpha = .5 * (1 - k);
    g.circle(sx + g.tw * .08 * k, sy - g.tw * (.06 + .4 * k), g.tw * (.035 + .05 * k), g.c('#eef0f2', .55));
  }
  g.ctx.globalAlpha = 1;
}
// Faisceau du phare la nuit : un pinceau de lumière qui tourne autour de la lanterne.
function drawBeam(g, x, y, t) {
  const [lx, ly] = g.P(x + .5, y + .5, g.tw * .94), a = t * .8, len = g.tw * 1.1, spread = .18;
  const end = d => [lx + Math.cos(a + d) * len, ly + Math.sin(a + d) * len * .5], far = end(0);
  const light = g.ctx.createLinearGradient(lx, ly, far[0], far[1]);
  light.addColorStop(0, 'rgba(255,240,180,.55)');
  light.addColorStop(1, 'rgba(255,240,180,0)');
  g.poly([[lx, ly], end(-spread), end(spread)], light);
}
