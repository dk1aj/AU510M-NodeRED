import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parse } = require('acorn');
const { parse: parseVue, compileTemplate } = require('@vue/compiler-sfc');
const source = fs.readFileSync('meter/power-swr-static-template.vue', 'utf8');
const { descriptor, errors } = parseVue(source);
assert.equal(errors.length, 0);
assert.equal(compileTemplate({ source: descriptor.template.content, filename: 'meter.vue', id: 'meter' }).errors.length, 0);
const ast = parse(descriptor.script.content, { ecmaVersion: 'latest', sourceType: 'module' });
assert.equal(ast.body.length, 1);
assert.equal(ast.body[0].type, 'ExportDefaultDeclaration');
assert.equal(ast.body[0].declaration.type, 'ObjectExpression');
const options = vm.runInNewContext(descriptor.script.content.replace('export default', '(') + ')');
const state = { ...options.data() };
for (const [name, fn] of Object.entries(options.methods)) state[name] = fn.bind(state);
for (const [name, fn] of Object.entries(options.computed)) Object.defineProperty(state, name, { get: () => fn.call(state) });
const geometry = state.meterGeometry;
assert.equal(geometry.FORWARD_FULL_SCALE_W, 600);
assert.equal(geometry.REFLECTED_FULL_SCALE_W, 120);
const close = (actual, expected, tolerance = 1e-7) => assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
for (const [q, angle] of geometry.calibration) {
 close(state.forwardWattsToAngle(q * 600), angle);
 close(state.reflectedWattsToAngle(q * 120), -angle);
}
for (const [method, max, sign] of [['forwardWattsToAngle', 600, 1], ['reflectedWattsToAngle', 120, -1]]) {
 close(state[method](0), 0); close(state[method](max), 50 * sign);
 close(state[method](-1), 0); close(state[method](max + 100), 50 * sign);
 close(state[method](NaN), 0); close(state[method](Infinity), 0);
}
// The old nonlinear ticks are normalized and rescaled, not replaced by a linear scale.
close(state.forwardWattsToAngle(120), 22.36067977);
for (const scale of state.meterScales) {
 const pivot = geometry.pivots[scale.side];
 for (const tick of scale.ticks) {
  const degrees = Math.atan2(tick.start.y - pivot.y, tick.start.x - pivot.x) * 180 / Math.PI;
  const expected = scale.side === 'forward' ? state.forwardWattsToAngle(tick.watts) - 180 : state.reflectedWattsToAngle(tick.watts);
  close(((degrees - expected + 540) % 360) - 180, 0);
  close(Math.hypot(tick.start.x - pivot.x, tick.start.y - pivot.y), geometry.outerRadius);
 }
 assert(scale.labels.some(label => label.watts === (scale.side === 'forward' ? 600 : 120)));
}
for (const pair of [[0, 0], [-1, 0], [10, -1], [10, 10], [10, 11], [NaN, 1], [10, Infinity]]) assert.equal(state.calculatedSwr(...pair), null);
close(state.calculatedSwr(100, 0), 1);
assert(state.calculatedSwr(100, 99.999) > 100000);
assert.equal(state.needleIntersection(0, 0), null);
assert.equal(state.needleIntersection(0, 1e-15), null);
assert.equal(state.needleIntersection(601, 1), null);
assert.equal(state.needleIntersection(100, 121), null);
function distanceToCurve(point, curve) {
 let distance = Infinity;
 for (let i = 1; i < curve.length; i++) {
  const a = curve[i - 1], b = curve[i], dx = b.x - a.x, dy = b.y - a.y;
  const denominator = dx * dx + dy * dy;
  const t = denominator ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / denominator)) : 0;
  distance = Math.min(distance, Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy));
 }
 return distance;
}
function verifyIntersection(forward, reflected, swr) {
 const point = state.needleIntersection(forward, reflected);
 assert(point);
 // Independent residual check against both original needle lines.
 for (const [side, power] of [['forward', forward], ['reflected', reflected]]) {
  const pivot = geometry.pivots[side], angle = (side === 'forward' ? state.forwardWattsToAngle(power) + 180 : state.reflectedWattsToAngle(power)) * Math.PI / 180;
  close((point.x - pivot.x) * Math.sin(angle) - (point.y - pivot.y) * Math.cos(angle), 0);
 }
 const curve = state.swrCurvePoints(swr);
 const distance = distanceToCurve(point, curve);
 assert(distance < .25, `SWR ${swr} curve mismatch: ${distance} SVG units`);
 assert(distanceToCurve({ x: point.x + 25, y: point.y }, curve) > .25, 'A large graphical mismatch must fail');
 return distance;
}
for (const swr of [...geometry.guideValues, Infinity]) {
 const curve = state.swrCurvePoints(swr);
 assert(curve.length > 100);
 assert(!/NaN|Infinity/.test(state.pointsToPath(curve)));
 const ratio = swr === Infinity ? 1 : ((swr - 1) / (swr + 1)) ** 2;
 for (const point of curve) {
  assert(point.forward > 0 && point.forward <= 600 && point.reflected <= 120);
  close(point.reflected / point.forward, ratio);
  assert(point.t >= 0 && point.t <= 378 && point.s >= 0 && point.s <= 378);
  if (swr !== Infinity) close(state.calculatedSwr(point.forward, point.reflected), swr);
  else assert(point.forward <= 120);
 }
 const max = Math.min(600, 120 / ratio);
 for (const fraction of [.12345, .33333, .56789, .91234, 1]) verifyIntersection(max * fraction, max * fraction * ratio, swr);
}
// Configurable reflected full scale must propagate through geometry.
geometry.REFLECTED_FULL_SCALE_W = 60;
close(state.reflectedWattsToAngle(60), -50);
assert(state.scaleLayout('reflected').labels.some(label => label.watts === 60));
assert(state.swrCurvePoints(Infinity).every(point => point.forward <= 60 && point.reflected <= 60));
geometry.REFLECTED_FULL_SCALE_W = 120;
// Physical Stage-C cases remain offline geometry tests after live Stage D.
for (const [forward, reflected, expected] of [[100,1,1.2222222222222223],[200,10,1.5760143110525873],[400,40,1.924950591148529],[600,120,2.618033988749895]]) {
 close(state.calculatedSwr(forward, reflected), expected);
 verifyIntersection(forward, reflected, expected);
}
assert(fs.existsSync('docs/cross-needle-meter.md'));
console.log('PASS: 600/120 W canonical calibration, ticks, SWR physics, ray intersection, generated guides, distance tolerance and invalid input safety.');
