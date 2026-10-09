import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const flows = JSON.parse(fs.readFileSync('flows.json', 'utf8'));
const source = flows.find(node => node.id === '9b1bcb4b21cd24ff')?.format;
assert(source, 'DIAG widget missing');
assert(source.includes(`selectDiagView('trend')`), 'TREND selector missing');
assert(source.includes('STAGE A · EMPTY VIEW'), 'Stage A placeholder missing');
assert(!source.includes('au510m-diag/trend'), 'Stage A must not request trend data');

const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert(script, 'Vue script missing');
const options = vm.runInNewContext(`(${script.replace(/^\s*export default/, '')})`, {
  Date, Intl, AbortController, fetch: () => { throw new Error('Stage A must not fetch'); }
});
const view = options.data();
for (const [name, method] of Object.entries(options.methods)) view[name] = method.bind(view);
assert.equal(view.diagView, 'live');
view.selectDiagView('trend');
assert.equal(view.diagView, 'trend');
view.selectDiagView('invalid');
assert.equal(view.diagView, 'trend');
assert(!source.includes('this.send('), 'DIAG UI must remain read-only');
console.log('PASS TREND Stage A: internal selector, empty view, default LIVE and no data/radio action.');
