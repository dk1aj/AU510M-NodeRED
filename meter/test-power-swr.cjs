const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const update = require('./power-swr-state.cjs');
const root = path.join(__dirname, '..');
const flows = JSON.parse(fs.readFileSync(path.join(root, 'flows.json')));
const get = id => flows.find(n => n.id === id);
const ui = get('au510m_power_swr_ui');
const processor = get('au510m_power_swr_state');
const tick = get('au510m_power_swr_tick');
const source = fs.readFileSync(path.join(__dirname, 'power-swr-state.cjs'), 'utf8');
const template = fs.readFileSync(path.join(__dirname, 'power-swr-template.vue'), 'utf8');
assert.equal(ui.format, template, 'The live SVG must match its source');
assert(processor.func.startsWith(source.replace('module.exports = updatePowerSWR;\n', '')));
assert.equal(tick.repeat, '0.1');
assert.deepEqual(get('7330e8695476df43').wires[0].slice(-1), [processor.id]);
assert.deepEqual(get('au510m_live_state').wires[0].slice(-1), [processor.id]);
assert.deepEqual(processor.wires, [[ui.id]]);
assert(!processor.func.includes('node.send('));
assert(!processor.func.includes('sub meter'));

const status = tx => ({ topic: '__radio_status', payload: { connected: true, fields: { 'TX/RX': tx ? 'TX' : 'RX' } } });
const meter = (topic, value, unit = 'dBm') => ({ topic, payload: { value, unit } });
const dbm = watts => 30 + 10 * Math.log10(watts);
let state, now = 1000;
const send = message => { const result = update(state, message, now); state = result.state; return result.snapshot; };
const sample = (forward, reflected, swr) => {
  send(meter('TX-/1/FWDPWR', dbm(forward)));
  send(meter('TX-/2/REFPWR', dbm(reflected)));
  send(meter('TX-/3/SWR', swr, 'SWR'));
};
const snap = () => send({ topic: '__power_swr_tick' });
assert.deepEqual(snap(), { at: now, tx: false, forwardWatts: 0, reflectedWatts: 0, swr: null });
send(status(true));
sample(10, 1, 1.2);
now += 100;
sample(100, 25, 2);
let s = snap();
assert(Math.abs(s.forwardWatts - 55) < 1e-8, 'Average the Watt samples, not dBm');
assert(Math.abs(s.reflectedWatts - 13) < 1e-8);
assert.equal(s.swr, 1.6, 'Use the live SWR meter directly');
send(meter('TX-/1/FWDPWR', 50, 'volts'));
assert(Math.abs(snap().forwardWatts - 55) < 1e-8, 'Reject power samples with the wrong unit');
send(status(false));
s = snap();
assert.deepEqual([s.tx, s.forwardWatts, s.reflectedWatts, s.swr], [false, 0, 0, null]);
send(status(true));
s = snap();
assert.deepEqual([s.forwardWatts, s.reflectedWatts, s.swr], [null, null, null], 'New TX starts empty');
sample(50, 10, 1.5);
s = snap();
assert(Math.abs(s.forwardWatts - 50) < 1e-8);
now += 600;
s = snap();
assert.deepEqual([s.forwardWatts, s.reflectedWatts, s.swr], [null, null, null], 'Old samples expire after 500 ms');
now += 3001;
assert.equal(snap().tx, false, 'Stale radio status returns needles to rest');

const script = template.match(/<script>([\s\S]*?)<\/script>/)[1].replace('export default', 'const component =');
const geometry = vm.runInNewContext(script + '\n;({component,forwardWattsToAngle,reflectedWattsToAngle,intersection,swrGuides})');
for (const value of [0, 50, 100, 250, 500]) {
  const angle = geometry.forwardWattsToAngle(value);
  assert(angle >= 0 && angle <= 50 && Number.isFinite(angle), 'Forward angle range');
}
for (const value of [0, 10, 25, 50, 100]) {
  const angle = geometry.reflectedWattsToAngle(value);
  assert(angle <= 0 && angle >= -50 && Number.isFinite(angle), 'Reflected angle range');
}
assert.equal(geometry.forwardWattsToAngle(600), geometry.forwardWattsToAngle(500));
assert.equal(geometry.reflectedWattsToAngle(125), geometry.reflectedWattsToAngle(100));
assert.equal(geometry.forwardWattsToAngle(-1), 0);
for (const swr of [1.0, 1.2, 1.5, 2.0, 3.0]) {
  const data = { tx: true, numeric: { swr } };
  assert.equal(geometry.component.computed.swrText.call(data), swr.toFixed(2), 'Radio SWR numeric mapping');
}
for (const swr of [1.2, 1.5, 2, 3, 8]) {
  const rho = (swr - 1) / (swr + 1);
  const forward = Math.min(250, 100 / (rho * rho));
  const reflected = forward * rho * rho;
  const crossing = geometry.intersection(forward, reflected);
  assert(crossing && crossing.x > 0 && crossing.y > 0, 'A constant-SWR guide is a needle intersection');
  assert(Math.abs((1 + Math.sqrt(reflected / forward)) / (1 - Math.sqrt(reflected / forward)) - swr) < 1e-10);
}
assert(geometry.swrGuides.every(g => g.path.startsWith('M') && !g.path.includes('NaN')));
for (const group of ['meter-background','forward-scale','reflected-scale','swr-guides','labels','forward-needle','reflected-needle','numeric-readout'])
  assert(template.includes(`id="${group}"`), group);
assert(template.includes('Old: v{{ oldVersion }} | New: v{{ newVersion }}'));
assert(template.includes("fetch('/agct-watcher/status'"));
assert(!/fetch\([^)]*,\s*\{[^}]*method:\s*'POST'/.test(template));
console.log('PASS: read-only paths, Watt-first smoothing, TX/RX clearing, stale data, 10 Hz output, angle clamps, SWR geometry, SVG groups and central version footer.');
