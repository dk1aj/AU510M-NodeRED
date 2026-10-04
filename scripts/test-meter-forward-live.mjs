import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { reactive, computed, watch, effectScope } = createRequire(import.meta.url)('vue');
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
assert.deepEqual(Object.keys(result.payload).sort(), ['activeRange', 'forward', 'online', 'radio', 'reflected', 'serverNow', 'swr', 'timestamp']);
assert.deepEqual(result.payload.reflected, { watts: 99, seen: base });
assert.deepEqual(result.payload.forward, { watts: 625, seen: base });
assert.deepEqual(result.payload.swr, { value: 4, seen: base, available: true });
assert.deepEqual(result.payload.radio, { connected: true, at: base, rxTx: 'TX' });
assert(!/raw|SWR|REFPWR|Frequency/.test(JSON.stringify(result)));
assert.equal(select({ payload: null }), null);
assert.equal(select({ payload: { section: 'tx', rows: [] } }), null);
const source = fs.readFileSync('meter/power-swr-static-template.vue', 'utf8');
let browserNow = base;
const options = vm.runInNewContext(source.match(/<script>([\s\S]*?)<\/script>/)[1].replace('export default', '(') + ')', { Date: { now: () => browserNow } });
const state = { ...options.data(), liveClock: base };
for (const [key, fn] of Object.entries(options.methods)) state[key] = fn.bind(state);
for (const [key, fn] of Object.entries(options.computed)) Object.defineProperty(state, key, { get: () => fn.call(state) });
function update(payload, at = state.liveClock) {
 const before = state.forwardState;
 browserNow = at;
 state.liveClock = at;
 state.msg = { payload: { ...payload, serverNow: at } };
 options.watch.msg.handler.call(state);
 const after = state.forwardState;
 if (before !== after) options.watch.forwardState.handler.call(state, after);
}
assert.equal(state.forwardSource, 'LIVE');
assert.equal(state.reflectedSource, 'LIVE');
assert.equal(state.forwardWatts, null);
assert.equal(state.forwardWattsText, '--');
assert.equal(state.forwardBoxText, '--');
assert.equal(state.liveSwrText, '', 'Unavailable SWR starts blank');
update(result.payload);
assert.equal(state.forwardWatts, 625);
assert.equal(state.forwardWattsText, '625');
assert.equal(state.activeRange,2000);
assert.equal(state.forwardWattsToAngle(state.forwardWatts),state.calibratedAngle(625,2000));
assert.equal(state.forwardWattsToAngle(2500),state.meterGeometry.sweep,'Only angle clamps');
assert.equal(result.payload.forward.watts, 625);
update({...result.payload,forward:{watts:2500,seen:base}});
assert.equal(state.forwardWatts,2500);
assert.equal(state.forwardBoxText,'2.5 kW');
assert.equal(state.forwardWattsToAngle(state.forwardWatts),state.meterGeometry.sweep);
update(result.payload);
assert.equal(state.reflectedWatts, 99);
assert.equal(state.reflectedWattsText, '99 W');
assert.equal(state.liveSwrText, '4.00');
for (const value of [null, undefined, NaN, Infinity, 'invalid', '1.47']) {
 update({ ...result.payload, swr: { value, seen: base, available: true } });
 assert.equal(state.liveSwrText, '');
}
for (const swr of [{value:1.47,seen:base-16000,available:true},{value:1.47,seen:base+1,available:true},{value:1.47,seen:base,available:false}]) {
 update({...result.payload,swr}); assert.equal(state.liveSwrText,'');
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
assert.equal(state.liveSwrText, '');
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
assert.match(source, /data-ref-source="LIVE"/);
assert.match(source, /data-swr-source="LIVE"/);
assert(!/10\s*\*\*|Math\.pow|sub meter|REFPWR|TX-\//.test(source));
assert.match(source, /class="meter-top-value meter-forward-box/);
assert.match(source, /class="meter-top-value meter-swr-box/);
assert.match(source, /class="meter-live-value"[^\n]*>{{ forwardBoxText }}<\/text>/);
assert.match(source, /class="meter-swr-value"[^\n]*>{{ liveSwrText }}<\/text>/);
assert(!source.includes('<span>FWD:'));
assert(!/CALC TEST|CALCULATED TEST|{{\s*testSwr/.test(source));
// REF uses canonical Watts without deriving power from SWR or FWDPWR.
update(result.payload, base);
assert.equal(state.reflectedWatts, 99);
assert.equal(state.reflectedWattsToAngle(state.reflectedWatts), -state.calibratedAngle(99, 400));
for (const value of [null, undefined, NaN, Infinity, 'invalid', '123', -1]) {
 update({ ...result.payload, reflected: { watts: value, seen: base } }, base);
 assert.equal(state.reflectedWatts, null);
 assert.equal(state.reflectedWattsText, '--');
 assert.equal(Math.abs(state.reflectedWattsToAngle(state.reflectedWatts)), 0);
 assert.equal(state.liveSwrText, '4.00');
 assert.equal(state.forwardWatts, 625);
}
update({ ...result.payload, forward: { watts: null, seen: base }, swr: { value: null, seen: base, available: false } }, base);
assert.equal(state.reflectedWatts, 99, 'REF validity is independent of FWD/SWR');
assert.equal(state.liveSwrText, '', 'Live SWR never falls back to calculated SWR');
for (const seen of [base - 16000, base + 1, null]) {
 update({ ...result.payload, reflected: { watts: 12, seen } }, base);
 assert.equal(state.reflectedWatts, null);
}
for (const range of [20, 200, 2000]) {
 const watts = range * .1;
 update({ ...result.payload, activeRange: range, reflected: { watts, seen: base } }, base);
 assert.equal(state.reflectedWatts, watts);
 assert.equal(state.reflectedWattsToAngle(watts), -state.calibratedAngle(.5, 1));
}
update({ ...result.payload, reflected: { watts: 501.234, seen: base } }, base);
assert.equal(state.reflectedWatts, 501.234);
assert.equal(state.reflectedWattsText, '501.23 W');
assert.equal(state.reflectedWattsToAngle(state.reflectedWatts), -state.meterGeometry.sweep);
update({ ...result.payload, radio: { ...result.payload.radio, rxTx: 'RX' } }, base);
assert.equal(state.reflectedWatts, 0);
assert.equal(Math.abs(state.reflectedWattsToAngle(state.reflectedWatts)), 0);
assert.equal(state.reflectedWattsText, '0 W');
update({ ...result.payload, timestamp: base + 100, radio: { ...result.payload.radio, at: base + 100 } }, base + 100);
assert.equal(state.reflectedWatts, null, 'New TX interval rejects previous TX REF samples');
update({ ...result.payload, timestamp: base + 200, reflected: { watts: 2.5, seen: base + 200 }, radio: { ...result.payload.radio, at: base + 200 } }, base + 200);
assert.equal(state.reflectedWatts, 2.5);
state.liveClock = base + 11000;
assert.equal(state.reflectedWatts, null, 'Clock expiry resets REF without a new message');
for (const overrides of [{online: false}, {radio: {...result.payload.radio, connected: false}}, {radio: {...result.payload.radio, rxTx: 'UNKNOWN'}}]) {
 update({ ...result.payload, ...overrides }, base);
 assert.equal(state.reflectedWatts, null);
 assert.equal(Math.abs(state.reflectedWattsToAngle(state.reflectedWatts)), 0);
}
assert(!/testReflected|testPresets|selectTestPreset/.test(source), 'Live REF cannot use synthetic presets');
const changedNodes = flows.filter(n => ['au510m_meter_forward_only', 'au510m_power_swr_static_ui'].includes(n.id));
assert(!/10\s*\*\*|Math\.pow|sub meter/.test(JSON.stringify(changedNodes)), 'Reuse existing Watt conversion/subscriptions');
console.log('PASS: canonical FWDPWR/REFPWR branch, immutable input, independent live SWR, shared range/geometry, truthful over-range numbers, RX reset and TX-cycle/stale/invalid safety for both needles.');

// Exercise real Vue synchronous watchers with browser clocks ahead/behind the server.
// Fresh TX samples must never turn into "--" merely because the two clocks differ.
for (const offset of [-60000, -250, 0, 250, 60000]) {
 let clientNow = base + offset;
 const component = vm.runInNewContext(source.match(/<script>([\s\S]*?)<\/script>/)[1].replace('export default', '(') + ')', { Date: { now: () => clientNow } });
 const scope = effectScope();
 scope.run(() => {
  const view = reactive({ ...component.data(), msg: null });
  for (const [key, fn] of Object.entries(component.methods)) view[key] = fn.bind(view);
  for (const [key, fn] of Object.entries(component.computed)) {
   const value = computed(() => fn.call(view));
   Object.defineProperty(view, key, { get: () => value.value });
  }
  for (const [key, config] of Object.entries(component.watch)) watch(() => view[key], config.handler.bind(view), { immediate: config.immediate, flush: config.flush });
  const received = (payload, serverNow) => {
   clientNow = serverNow + offset + 25;
   view.msg = { payload: { ...payload, serverNow } };
  };
  let latest;
  for (let i = 0; i < 80; i++) {
   const at = base + i * 125;
   latest = { ...result.payload, timestamp: at, radio: { connected: true, rxTx: 'TX', at: at - 30 }, forward: { watts: 50 + i, seen: at - 20 }, reflected: { watts: 2, seen: at - 20 }, swr: { value: 1.47, available: true, seen: at - 20 } };
   received(latest, at);
   assert.equal(view.forwardState, 'TX', `TX state must remain stable at clock offset ${offset}`);
   assert.equal(view.forwardWatts, 50 + i, 'Changing real Watt samples remain truthful');
   assert.notEqual(view.forwardBoxText, '--', 'Fresh TX must not blink');
   assert.equal(view.reflectedWatts, 2);
   assert.equal(view.liveSwrText, '1.47');
   if (i % 8 === 0) view.liveClock = clientNow;
   assert.equal(view.forwardWatts, 50 + i, 'Expiry timer must not invalidate fresh TX');
   assert.equal(view.forwardTxSince, base - 30, 'Clock differences must not restart the TX interval');
  }
  // Retained values still expire when dashboard messages cease.
  clientNow += 11000;
  view.liveClock = clientNow;
  assert.equal(view.forwardState, 'UNKNOWN');
  assert.equal(view.forwardBoxText, '--');
  received({ ...latest, radio: { connected: true, rxTx: 'RX', at: base + 21000 }, timestamp: base + 21000 }, base + 21000);
  assert.equal(view.forwardWatts, 0);
  assert.equal(view.reflectedWatts, 0);
  assert.equal(view.liveSwrText, '');
  const txAt = base + 22000;
  received({ ...latest, timestamp: txAt, radio: { connected: true, rxTx: 'TX', at: txAt } }, txAt);
  assert.equal(view.forwardWatts, null, 'New TX cannot reuse preceding TX samples');
  received({ ...latest, timestamp: txAt + 125, radio: { connected: true, rxTx: 'TX', at: txAt + 125 }, forward: { watts: 73, seen: txAt + 120 } }, txAt + 125);
  assert.equal(view.forwardWatts, 73);
  received({ ...latest, timestamp: txAt + 125, radio: { connected: true, rxTx: 'TX', at: txAt + 125 }, forward: { watts: 73, seen: txAt + 126 } }, txAt + 125);
  assert.equal(view.forwardWatts, null, 'Genuinely future server samples stay invalid');
 });
 scope.stop();
}
console.log('PASS: real Vue watcher sequence, five browser clock offsets, 400 fresh TX updates without false blanks, timer ticks, truthful changing Watts, RX reset, TX-cycle isolation and genuine expiry/future rejection.');
