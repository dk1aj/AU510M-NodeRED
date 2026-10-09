import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const version=JSON.parse(fs.readFileSync('agct-watcher-version.json','utf8'));
assert.deepEqual(version,{OLD_VERSION:'4.31',NEW_VERSION:'4.32'});
const flows=JSON.parse(fs.readFileSync('flows.json','utf8')),dashboard=JSON.parse(fs.readFileSync('flows/dashboard.json','utf8'));
const node=flows.find(item=>item.id==='9b1bcb4b21cd24ff'),mirror=dashboard.find(item=>item.id===node.id);
assert(node&&mirror);assert.equal(node.format,mirror.format);
const source=node.format,summary=source.match(/<div class="diag-live-summary">([\s\S]*?)<\/div>/)?.[1];assert(summary);
assert.equal((summary.match(/<article/g)||[]).length,5);assert(summary.includes(`paHealthSimulation.state.toLowerCase()`));assert(summary.includes(`paHealthSimulation.primaryReason }} · SIMULATION`));
assert(summary.includes('aria-label="Derived PA health display simulation"'));assert(!summary.includes('live.paHealth'));assert(!source.includes('PA_HEALTH_CHANGE'));
assert(source.includes('grid-template-columns:1.18fr .8fr 1fr .95fr .95fr;gap:6px'));
for(const tone of ['ok','warning','critical','unknown'])assert(source.includes('.diag-health-'+tone));
assert(source.includes('.diag-pa-health-card h2'));assert(source.includes('.diag-health-count'));
const script=source.match(/<script>([\s\S]*?)<\/script>/)?.[1];assert(script);assert(/^\s*export default\s*\{/.test(script));const options=vm.runInNewContext(`(${script.replace(/^\s*export default/,'')})`,{Date,Intl,AbortController,fetch:()=>Promise.reject(Error('offline'))});const view=options.data();assert.deepEqual(JSON.parse(JSON.stringify(view.paHealthSimulation)),{state:'WARNING',primaryReason:'SWR HIGH',additional:2});
assert(!source.includes('this.send('));assert.equal(flows.filter(item=>item.type==='flexradio-radio').length,2);assert.equal(flows.length,99);
console.log('PASS PA HEALTH Stage C: fixed browser-only WARNING/SWR HIGH/+2 simulation, visibly labelled, no timer/classifier/event/radio/SQLite path.');
