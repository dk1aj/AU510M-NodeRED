import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const flows = JSON.parse(fs.readFileSync('flows.json'));
const projection = flows.find(node => node.id === 'au510m_meter_forward_only');
assert(projection);
assert(flows.find(node => node.id === 'au510m_live_bridge').wires[0].includes(projection.id));
assert.deepEqual(projection.wires, [['au510m_power_swr_static_ui']]);
const saved = new Map();
const context = {get:key=>saved.get(key),set:(key,value)=>saved.set(key,value)};
const project = new Function('msg', 'context', 'Date', projection.func);
const select = msg => project(msg, context, {now:()=>base});
const base = Date.now() + 60000;
const input = { payload: { section: 'pa', online: true, timestamp: base, rows: [
 { topic: 'TX-/1/FWDPWR', watts: 625, seen: base, raw: 57.9588 },
 { topic: 'TX-/2/REFPWR', watts: 99, seen: base }, { topic: 'TX-/3/SWR', value: 4, raw: 4, seen: base }
], radioStatus: { connected: true, at: base, fields: { 'TX/RX': 'TX', Frequency: 'TEST' } } } };
const original = structuredClone(input);
const result = select(input);
assert.deepEqual(input, original, 'Existing RADIO/PA message must not mutate');
assert.deepEqual(Object.keys(result.payload).sort(), ['activeRange', 'forward', 'online', 'radio', 'swr', 'timestamp']);
assert.deepEqual(result.payload.forward, { watts: 625, seen: base });
assert.deepEqual(result.payload.swr, { value: 4, seen: base, available: true });
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
assert.equal(state.forwardBoxText, '--');
update(result.payload);
assert.equal(state.forwardWatts, 625);
assert.equal(state.forwardWattsText, '625');
assert.equal(state.activeRange,2000);
assert.equal(state.forwardWattsToAngle(state.forwardWatts),state.calibratedAngle(625,2000));
assert.equal(state.forwardWattsToAngle(2500),50,'Only angle clamps');
assert.equal(result.payload.forward.watts, 625);
for (const preset of state.testPresets) {
 state.selectTestPreset(preset.key);
 assert.equal(state.forwardWatts, 625, 'TEST controls cannot override live forward power');
 assert.equal(state.testReflected, preset.reflected);
 assert.equal(state.liveSwrText, '4.00', 'Synthetic REF cannot influence visible live SWR');
 assert(!Object.hasOwn(preset, 'forward'));
}
assert.equal(state.testSwr, state.calculatedSwr(625, state.testReflected));
for (const value of [null, undefined, NaN, Infinity, 'invalid', '1.47']) {
 update({ ...result.payload, swr: { value, seen: base, available: true } });
 assert.equal(state.liveSwrText, '--');
}
for (const swr of [{value:1.47,seen:base-16000,available:true},{value:1.47,seen:base+1,available:true},{value:1.47,seen:base,available:false}]) {
 update({...result.payload,swr}); assert.equal(state.liveSwrText,'--');
}
update(result.payload);
assert.equal(state.liveSwrText,'4.00');
const radioSource=flows.find(n=>n.id==='9ee3e94e3758b01f').format;
const radioOptions=vm.runInNewContext(radioSource.match(/<script>([\s\S]*?)<\/script>/)[1].replace('export default','(')+')');
const radioState={...radioOptions.data(),now:base,radioTxSince:base,msg:input};
for(const [key,fn] of Object.entries(radioOptions.methods))radioState[key]=fn.bind(radioState);
for(const [key,fn] of Object.entries(radioOptions.computed))Object.defineProperty(radioState,key,{get:()=>fn.call(radioState)});
for(const value of [1,1.12,1.47,2.03,4]) {
 input.payload.rows[2].value=value;input.payload.rows[2].raw=value;
 update(select(input).payload);
 assert.equal(state.liveSwr,value);
 assert.equal(Number(state.liveSwrText),Number(radioState.radioCardMeter('TX-/3/SWR')));
 assert.equal(Number(state.liveSwrText),Number(Number(radioState.reading(input.payload.rows[2])).toFixed(2)));
}
update(result.payload);
for (const value of [null, undefined, NaN, Infinity, 'invalid', '', '123', -1]) {
 update({ ...result.payload, forward: { watts: value, seen: base } });
 assert.equal(state.forwardWatts, null);
 assert.equal(state.forwardWattsText, '--');
 assert.equal(state.forwardBoxText, '--');
 assert.equal(state.forwardWattsToAngle(state.forwardWatts), 0);
 assert.equal(state.liveSwrText, '4.00', 'SWR is independent of forward power validity');
}
update({ ...result.payload, forward: { watts: 123.456, seen: base } });
assert.equal(state.forwardWatts, 123.456);
assert.equal(state.forwardWattsText, '123');
assert.equal(state.forwardBoxText, '123 W');
for (const [watts, text] of [[37.4, '37 W'], [123.6, '124 W'], [4.2, '4.2 W'], [7.8, '7.8 W'], [0, '0 W'], [1350, '1.35 kW']]) {
 update({ ...result.payload, forward: { watts, seen: base } });
 assert.equal(state.forwardWatts, watts);
 assert.equal(state.forwardBoxText, text);
}
update({ ...result.payload, radio: { ...result.payload.radio, rxTx: 'RX' } });
assert.equal(state.forwardWatts, 0, 'RX must clear stale TX watts immediately');
assert.equal(state.forwardWattsText, '0');
assert.equal(state.forwardTxSince, null);
assert.equal(state.liveSwrText, '--');
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
assert.match(source, /data-swr-source="LIVE"/);
assert(!/10\s*\*\*|Math\.pow|sub meter|REFPWR|TX-\//.test(source));
assert.match(source, /class="meter-top-value meter-forward-box/);
assert.match(source, /class="meter-top-value meter-swr-box/);
assert.match(source, /class="meter-live-value"[^\n]*>{{ forwardBoxText }}<\/text>/);
assert.match(source, /class="meter-swr-value"[^\n]*>{{ liveSwrText }}<\/text>/);
assert(!source.includes('<span>FWD:'));
assert(!/CALC TEST|CALCULATED TEST|{{\s*testSwr/.test(source));
console.log('PASS: canonical FWDPWR branch, immutable shared input, no REF leakage, independent canonical live SWR, truthful >600 W numeric value, RX reset, TX-cycle/stale/invalid safety and TEST isolation.');
