// Offline exports only; no runtime writes or API calls.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const read=n=>JSON.parse(fs.readFileSync(new URL(n,root),'utf8'));
const all=read('flows.json'),ids=new Map(all.map(n=>[n.id,n]));
const tab=all.find(n=>n.id==='b8dbc85ea6f35743'&&n.type==='tab');assert(tab);
const selected=new Set([tab.id,...all.filter(n=>n.z===tab.id).map(n=>n.id)]);
function refs(v){if(typeof v==='string'&&ids.has(v))return [v];if(Array.isArray(v))return v.flatMap(refs);return v&&typeof v==='object'?Object.values(v).flatMap(refs):[];}
for(const id of selected)for(const ref of refs(ids.get(id)))selected.add(ref);
const dashboard=structuredClone(all.filter(n=>selected.has(n.id)));
for(const n of dashboard)if(n.type==='tab')n.disabled=true;
for(const [name,data]of Object.entries({'flows/dashboard.json':dashboard,'flows/agct-watcher.json':read('examples/05-agct-watcher.json')})){
 const text=JSON.stringify(data,null,2)+'\n';assert(!JSON.stringify(data).includes('"credentials":'));
 if(process.argv.includes('--check'))assert.equal(fs.readFileSync(new URL(name,root),'utf8'),text,name+' is stale');else fs.writeFileSync(new URL(name,root),text);
}
console.log('Repository exports '+(process.argv.includes('--check')?'verified.':'written; runtime unchanged.'));
