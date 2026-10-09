import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const flows = JSON.parse(fs.readFileSync('flows.json', 'utf8'));
const source = flows.find(node => node.id === '9b1bcb4b21cd24ff')?.format;
assert(source, 'DIAG widget missing');
assert(source.includes(`selectDiagView('trend')`), 'TREND selector missing');
assert(source.includes('SIMULATION · RX · 240 s'), 'Stage C simulation label missing');
for (const label of ['POWER','SWR','TEMP','PA','CURRENT','EFF','SUPPLY','FAN','-4m','NOW']) assert(source.includes(label), `Missing static label ${label}`);
assert(!source.includes('au510m-diag/trend'), 'Stage C must not request trend data');

const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert(script, 'Vue script missing');
const options = vm.runInNewContext(`(${script.replace(/^\s*export default/, '')})`, {
  Date, Intl, AbortController, fetch: () => { throw new Error('Stage C must not fetch'); }
});
const view = options.data();
for (const [name, method] of Object.entries(options.methods)) view[name] = method.bind(view);
assert.equal(view.diagView, 'live');
view.selectDiagView('trend');
assert.equal(view.diagView, 'trend');
view.selectDiagView('invalid');
assert.equal(view.diagView, 'trend');
for (const group of ['power','swr','temp','pa']) { view.selectTrendGroup(group); assert.equal(view.trendGroup, group); }
view.selectTrendPa('supply'); assert.equal(view.trendPaMetric, 'supply');
assert.equal(options.computed.trendTitle.call(view), '13.8 V SUPPLY');
assert.equal(options.computed.trendUnit.call(view), 'V');
Object.defineProperty(view, 'trendUnit', { get: () => options.computed.trendUnit.call(view) });
Object.defineProperty(view, 'trendSimulationSeries', { get: () => options.computed.trendSimulationSeries.call(view) });
Object.defineProperty(view, 'trendScale', { get: () => options.computed.trendScale.call(view) });
assert.equal(options.computed.trendStats.call(view).length, 6);
assert.equal(options.computed.trendStats.call(view).find(item => item.label === '13.8A MIN').value, 13.1);
const path = view.trendPath(view.trendSimulationSeries[0].values);
assert.match(path, /^M58\.0 /); assert.match(path, /L658\.0 /); assert.equal(path.split('L').length, view.trendSimulationSeries[0].values.length);
view.selectTrendGroup('power');
assert.equal(options.computed.trendStats.call(view).find(item => item.label === 'FWD MAX').value, 240, 'Synthetic power peak hidden');
view.selectTrendGroup('invalid'); assert.equal(view.trendGroup, 'power');
assert(!source.includes('this.send('), 'DIAG UI must remain read-only');
console.log('PASS TREND Stage C: visible deterministic SIMULATION for every group, peaks/stats preserved, default LIVE and no runtime/radio action.');
