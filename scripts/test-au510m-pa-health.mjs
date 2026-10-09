import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const version=JSON.parse(fs.readFileSync('agct-watcher-version.json','utf8'));
assert.deepEqual(version,{OLD_VERSION:'4.31',NEW_VERSION:'4.32'});
const flows=JSON.parse(fs.readFileSync('flows.json','utf8')),dashboard=JSON.parse(fs.readFileSync('flows/dashboard.json','utf8'));
const node=flows.find(item=>item.id==='9b1bcb4b21cd24ff'),mirror=dashboard.find(item=>item.id===node.id);
assert(node&&mirror);assert.equal(node.format,mirror.format);
const source=node.format,summary=source.match(/<div class="diag-live-summary">([\s\S]*?)<\/div>/)?.[1];assert(summary);
assert.equal((summary.match(/<article/g)||[]).length,5);assert(summary.includes('<h2>PA HEALTH</h2><strong>UNKNOWN</strong><small>DERIVED · STAGE A</small>'));
assert(summary.includes('aria-label="Derived PA health stage A"'));assert(!summary.includes('live.paHealth'));assert(!source.includes('PA_HEALTH_CHANGE'));
assert(source.includes('grid-template-columns:1.18fr .8fr 1fr .95fr .95fr;gap:6px'));
const script=source.match(/<script>([\s\S]*?)<\/script>/)?.[1];assert(script);assert(/^\s*export default\s*\{/.test(script));vm.runInNewContext(`(${script.replace(/^\s*export default/,'')})`,{Date,Intl,AbortController,fetch:()=>Promise.reject(Error('offline'))});
assert(!source.includes('this.send('));assert.equal(flows.filter(item=>item.type==='flexradio-radio').length,2);assert.equal(flows.length,99);
console.log('PASS PA HEALTH Stage A: static derived UNKNOWN card only, five-card 800x480 summary layout, v4.31 -> v4.32, no classifier/event/radio/SQLite path.');
