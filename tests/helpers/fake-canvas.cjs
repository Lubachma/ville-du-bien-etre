// Contexte 2D factice : enregistre, en coordonnées d'écran, les points de chaque tracé et de chaque rectangle.
function fakeContext() {
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [], points = [];
  const at = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const mul = (a, b, c, d, e, f) => {
    m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]];
  };
  const add = (x, y) => { points.push(at(x, y)); };
  const corners = (x, y, rx, ry) => { add(x - rx, y - ry); add(x + rx, y - ry); add(x - rx, y + ry); add(x + rx, y + ry); };
  const gradient = () => ({ addColorStop() {} });
  return {
    points,
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', globalAlpha: 1, shadowColor: '', shadowBlur: 0,
    globalCompositeOperation: 'source-over', font: '', textAlign: 'start', textBaseline: 'alphabetic',
    save() { stack.push(m); },
    restore() { m = stack.pop() || m; },
    translate(x, y) { mul(1, 0, 0, 1, x, y); },
    scale(x, y) { mul(x, 0, 0, y, 0, 0); },
    rotate(a) { mul(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0); },
    transform(a, b, c, d, e, f) { mul(a, b, c, d, e, f); },
    setTransform(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) { m = [a, b, c, d, e, f]; },
    resetTransform() { m = [1, 0, 0, 1, 0, 0]; },
    beginPath() {}, closePath() {}, fill() {}, stroke() {}, clip() {}, setLineDash() {}, fillText() {}, strokeText() {}, drawImage() {}, clearRect() {},
    moveTo: add,
    lineTo: add,
    quadraticCurveTo(cx, cy, x, y) { add(cx, cy); add(x, y); },
    bezierCurveTo(ax, ay, bx, by, x, y) { add(ax, ay); add(bx, by); add(x, y); },
    arc(x, y, r) { corners(x, y, r, r); },
    arcTo(x1, y1, x2, y2) { add(x1, y1); add(x2, y2); },
    ellipse(x, y, rx, ry, rot = 0) { if (rot) { const r = Math.max(rx, ry); corners(x, y, r, r); } else corners(x, y, rx, ry); },
    rect(x, y, w, h) { add(x, y); add(x + w, y + h); },
    fillRect(x, y, w, h) { add(x, y); add(x + w, y + h); },
    strokeRect(x, y, w, h) { add(x, y); add(x + w, y + h); },
    createLinearGradient: gradient,
    createRadialGradient: gradient,
  };
}
module.exports = { fakeContext };
