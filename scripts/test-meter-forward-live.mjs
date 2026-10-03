import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const flows = JSON.parse(fs.readFileSync('flows.json'));
const projection = flows.find(node => node.id === 'au510m_meter_forward_only');
assert(projection);
assert(flows.find(node => node.id === 'au510m_live_bridge').wires[0].includes(projection.id));
assert.deepEqual(projection.wires, [['au510m_power_swr_static_ui']]);
const select = new Function('msg', projection.func);
const base = Date.now() + 60000;
const input = { payload: { section: 'pa', online: true, timestamp: base, rows: [
 { topic: 'TX-/1/FWDPWR', watts: 625, seen: base, raw: 57.9588 },
 { topic: 'TX-/2/REFPWR', watts: 99, seen: base }, { topic: 'TX-/3/SWR', value: 4 }
], radioStatus: { connected: true, at: base, fields: { 'TX/RX': 'TX', Frequency: 'TEST' } } } };
const original = structuredClone(input);
const result = select(input);
assert.deepEqual(input, original, 'Existing RADIO/PA message must not mutate');
assert.deepEqual(Object.keys(result.payload).sort(), ['forward', 'online', 'radio', 'timestamp']);
assert.deepEqual(result.payload.forward, { watts: 625, seen: base });
assert.deepEqual(result.payload.radio, { connected: true, at: base, rxTx: 'TX' });
assert(!/raw|SWR|REFPWR|Frequency/.test(JSON.stringify(result)));
assert.equal(select({ payload: null }), null);
assert.equal(select({ payload: { section: 'tx', rows: [] } }), null);
const source = fs.readFileSync('meter/power-swr-static-template.vue', 'utf8');
const options = vm.runInNewContext(source.match(/<script>([\s\S]*?)<\/script>/)[1].replace('export default', '(') + ')');
const state = { ...options.data(), liveClock: base };
for (const [key, fn] of Object.entries(options.methods)) state[key] = fn.bind(state);
for (const [key, fn] of Object.entries(options.computed)) Object.defineProperty(state, key, { get: () => fn.call(state) });
function update(payload, at = state.liveClock) {
 const before = state.forwardState;
 state.liveClock = at;
 state.msg = { payload };
 const after = state.forwardState;
 if (before !== after) options.watch.forwardState.handler.call(state, after);
}
assert.equal(state.forwardSource, 'LIVE');
assert.equal(state.reflectedSource, 'TEST');
assert.equal(state.forwardWatts, null);
assert.equal(state.forwardWattsText, '--');
update(result.payload);
assert.equal(state.forwardWatts, 625);
assert.equal(state.forwardWattsText, '625');
assert.equal(state.forwardWattsToAngle(state.forwardWatts), 50, 'Only angle clamps');
assert.equal(result.payload.forward.watts, 625);
for (const preset of state.testPresets) {
 state.selectTestPreset(preset.key);
 assert.equal(state.forwardWatts, 625, 'TEST controls cannot override live forward power');
 assert.equal(state.testReflected, preset.reflected);
 assert(!Object.hasOwn(preset, 'forward'));
}
assert.equal(state.testSwr, state.calculatedSwr(625, state.testReflected));
for (const value of [null, undefined, NaN, Infinity, 'invalid', '', '123', -1]) {
 update({ ...result.payload, forward: { watts: value, seen: base } });
 assert.equal(state.forwardWatts, null);
 assert.equal(state.forwardWattsText, '--');
 assert.equal(state.forwardWattsToAngle(state.forwardWatts), 0);
 assert.equal(state.testSwrText, '--');
}
update({ ...result.payload, forward: { watts: 123.456, seen: base } });
assert.equal(state.forwardWatts, 123.456);
assert.equal(state.forwardWattsText, '123.456');
update({ ...result.payload, radio: { ...result.payload.radio, rxTx: 'RX' } });
assert.equal(state.forwardWatts, 0, 'RX must clear stale TX watts immediately');
assert.equal(state.forwardWattsText, '0');
assert.equal(state.forwardTxSince, null);
assert.equal(state.testSwrText, '--');
// A new TX interval cannot use samples retained from the preceding interval.
update({ ...result.payload, timestamp: base + 100, radio: { ...result.payload.radio, at: base + 100 } }, base + 100);
assert.equal(state.forwardWatts, null);
update({ ...result.payload, timestamp: base + 200, forward: { watts: 50, seen: base + 200 }, radio: { ...result.payload.radio, at: base + 200 } }, base + 200);
assert.equal(state.forwardWatts, 50);
// Clock expiry works without a new Node-RED message.
state.liveClock = base + 11000;
assert.equal(state.forwardWatts, null);
update({ ...result.payload, timestamp: base + 11000, forward: { watts: 50, seen: base - 5000 }, radio: { ...result.payload.radio, at: base + 11000 } }, base + 11000);
assert.equal(state.forwardWatts, null, 'Stale power is unavailable');
update({ ...result.payload, online: false });
assert.equal(state.forwardWatts, null);
update({ ...result.payload, radio: { ...result.payload.radio, connected: false } });
assert.equal(state.forwardWatts, null);
update({ ...result.payload, timestamp: base + 12000, radio: { ...result.payload.radio, at: base + 12000 } }, base + 11000);
assert.equal(state.forwardWatts, null, 'Future/uninitialized timestamp is unavailable');
assert.equal(state.forwardWattsToAngle(state.forwardWatts), 0);
assert.match(source, /setInterval\([^\n]+1000\)/);
assert.match(source, /clearInterval\(this.liveClockTimer\)/);
assert.match(source, /data-fwd-source="LIVE"/);
assert.match(source, /data-ref-source="TEST"/);
assert.match(source, /data-swr-source="CALCULATED TEST"/);
assert(!/10\s*\*\*|Math\.pow|sub meter|REFPWR|TX-\//.test(source));
console.log('PASS: canonical FWDPWR branch, immutable shared input, no REF/SWR leakage, truthful >600 W numeric value, RX reset, TX-cycle/stale/invalid safety and TEST isolation.');
