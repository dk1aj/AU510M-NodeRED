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
const modelForward = value => state.calibratedAngle(value,geometry.FORWARD_MODEL_MAX);
const modelReflected = value => -state.calibratedAngle(value,state.reflectedModelMax);
assert.equal(geometry.FORWARD_MODEL_MAX, 1);
assert.equal(state.reflectedModelMax,.2);
assert.equal(geometry.FORWARD_PRINTED_MAX,20);
assert.equal(geometry.REFLECTED_PRINTED_MAX,4);
assert.equal(JSON.stringify(state.scaleLayout('reflected').labels.map(label => label.printed)),JSON.stringify([0,.2,.4,.6,.8,1,1.2,1.6,2,3.6,4]));
assert(!Object.hasOwn(geometry,'REFLECTED_TEST_FULL_SCALE_W'));
const close = (actual, expected, tolerance = 1e-7) => assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
for (const [q, angle] of geometry.calibration) {
 close(modelForward(q), angle * geometry.sweep / 50);
 close(modelReflected(q * .2), -angle * geometry.sweep / 50);
}
for (const [method, max, sign] of [[modelForward, 1, 1], [modelReflected, .2, -1]]) {
 close(method(0), 0); close(method(max), geometry.sweep * sign);
 close(method(-1), 0); close(method(max + 100), geometry.sweep * sign);
 close(method(NaN), 0); close(method(Infinity), 0);
}
// Preserve the nonlinear normalized calibration; rescale its angular sweep.
close(modelForward(.2), 22.36067977 * geometry.sweep / 50);
for (const scale of state.meterScales) {
 const pivot = geometry.pivots[scale.side];
 for (const tick of scale.ticks) {
  const degrees = Math.atan2(tick.start.y - pivot.y, tick.start.x - pivot.x) * 180 / Math.PI;
  const expected = scale.side === 'forward' ? modelForward(tick.watts) + geometry.zeroTilt - 180 : modelReflected(tick.watts) - geometry.zeroTilt;
  close(((degrees - expected + 540) % 360) - 180, 0);
  close(Math.hypot(tick.start.x - pivot.x, tick.start.y - pivot.y), geometry.outerRadius);
 }
 assert(scale.labels.some(label => label.watts === (scale.side === 'forward' ? 1 : .2)));
}
for (const pair of [[0, 0], [-1, 0], [10, -1], [10, 10], [10, 11], [NaN, 1], [10, Infinity]]) assert.equal(state.calculatedSwr(...pair), null);
close(state.calculatedSwr(100, 0), 1);
assert(state.calculatedSwr(100, 99.999) > 100000);
// At zero both tilted rays meet behind the covered SWR bar, not in the usable field.
assert(state.needleIntersection(0, 0).y > geometry.face.bottom);

assert.equal(state.needleIntersection(1.001, .001), null);
assert.equal(state.needleIntersection(.1, .201), null);
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
  const pivot = geometry.pivots[side], angle = (side === 'forward' ? modelForward(power) + geometry.zeroTilt + 180 : modelReflected(power) - geometry.zeroTilt) * Math.PI / 180;
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
  assert(point.forward > 0 && point.forward <= 1 && point.reflected <= .2);
  close(point.reflected / point.forward, ratio);
  assert(point.t >= 0 && point.t <= geometry.needleLength && point.s >= 0 && point.s <= geometry.needleLength);
  if (swr !== Infinity) close(state.calculatedSwr(point.forward, point.reflected), swr);
  else assert(point.forward <= .2);
 }
 const max = Math.min(1, .2 / ratio);
 let checked = 0;
 for (const fraction of [.12345, .33333, .56789, .91234, 1]) {
  const point = state.needleIntersection(max * fraction, max * fraction * ratio);
  if (point && point.y >= geometry.swrFieldTop && point.y <= geometry.face.bottom) {
   verifyIntersection(max * fraction, max * fraction * ratio, swr); checked++;
  }
 }
 assert(checked >= 2, `SWR ${swr} must have independently verified usable intersections`);
}
// Configurable reflected full scale must propagate through geometry.
geometry.REFLECTED_PRINTED_MAX = 2;
close(modelReflected(.1), -geometry.sweep);
assert(state.scaleLayout('reflected').labels.some(label => label.watts === .1));
assert(state.swrCurvePoints(Infinity).every(point => point.forward <= .1 && point.reflected <= .1));
geometry.REFLECTED_PRINTED_MAX = 4;
// Physical SWR examples use the same active-range normalization for both needles.
for (const range of [20,200,2000]) {
 state.msg={payload:{activeRange:range}};
 close(state.reflectedFullScaleWatts,range*4/20);
 const forward=range, reflected=forward*((3-1)/(3+1))**2;
 close(reflected,range/4); close(state.calculatedSwr(forward,reflected),3);
 close(state.reflectedWattsToAngle(reflected),-geometry.sweep); // Real over-range, angle only clamps.
 const pf=range*.3,pr=pf/4;
 verifyIntersection(pf/range,pr/range,3);
 close(state.reflectedWattsToAngle(pr),modelReflected(pr/range));
 for (const preset of state.testPresets) {
  state.selectTestPreset(preset.key);
  close(state.testReflected,preset.fraction*range*4/20);
  close(state.reflectedWattsToAngle(state.testReflected),-state.calibratedAngle(preset.fraction,1));
 }
}
assert(fs.existsSync('docs/cross-needle-meter.md'));
for(const range of [20,200,2000]) {state.msg={payload:{activeRange:range}}; close(state.forwardWattsToAngle(range/2),state.calibratedAngle(.5,1)); assert.equal(state.activeRangeText,range===2000?'2 kW':range+' W');}
console.log('PASS: normalized canonical calibration, ticks, SWR physics, ray intersection, generated guides, distance tolerance and invalid input safety.');

// Reference reconstruction: common upper crossing, concealed pivots, readable fixed scale.
assert(geometry.pivots.forward.x > geometry.pivots.reflected.x);
assert(geometry.pivots.forward.y > geometry.face.bottom);
assert(geometry.pivots.reflected.y > geometry.face.bottom);
for (const side of ['forward','reflected']) {
 const max = side === 'forward' ? geometry.FORWARD_MODEL_MAX : state.reflectedModelMax;
 for (let i=0; i<=300; i++) {
  const tip = state.scalePoint(side,max*i/300,geometry.needleLength);
  assert(tip.x > geometry.face.left && tip.x < geometry.face.right && tip.y > geometry.face.top && tip.y < geometry.face.bottom);
 }
}
const a = state.scalePoint('forward',.554,geometry.outerRadius);
const b = state.scalePoint('reflected',.554*.2,geometry.outerRadius);
assert(Math.abs(a.x-b.x)<5 && a.y<100 && b.y<100, 'Printed scales must cross in the upper central field');
const referenceScales = JSON.stringify(state.meterScales), referenceGuides = JSON.stringify(state.swrGuides);
for (const theme of ['classic-warm','dark-room-uplight','graphite-dark']) {
 state.selectedTheme = theme;
 for (const range of [20,200,2000]) {
  state.msg={payload:{activeRange:range}};
  assert.equal(JSON.stringify(state.meterScales),referenceScales);
  assert.equal(JSON.stringify(state.swrGuides),referenceGuides);
 }
}
console.log('PASS: reference proportions, upper scale crossing, concealed pivots, full-sweep needle bounds and identical fixed geometry across themes/ranges.');
