import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {parse}=require('acorn');
const {compile}=require('@vue/compiler-dom');
const flows=JSON.parse(fs.readFileSync('flows.json'));
const example=JSON.parse(fs.readFileSync('examples/05-agct-watcher.json'));
const versions=JSON.parse(fs.readFileSync('agct-watcher-version.json'));const version=versions.NEW_VERSION;const oldVersion=versions.OLD_VERSION;
for (const list of [flows,example]) {
 const core=list.find(n=>n.name==='Watcher + separated configuration');
 assert.equal(list.find(n=>n.id===core.z).env.find(e=>e.name==='WATCHER_VERSION').value,version);assert.equal(list.find(n=>n.id===core.z).env.find(e=>e.name==='WATCHER_OLD_VERSION').value,oldVersion);
 for(const n of list.filter(n=>n.type==='function')) new vm.Script('(async function(){'+n.func+'})');
}
for(const name of ['Watcher + separated configuration','Validate UI action; forward only watcher controls','Standalone German watcher UI']){
 const a=flows.find(n=>n.name===name),b=example.find(n=>n.name===name);
 assert.equal(a.func||a.template,b.func||b.template);
}
const ui=flows.find(n=>n.id==='9ee3e94e3758b01f').format;
const js=ui.match(/<script>([\s\S]*?)<\/script>/)[1];
const ast=parse(js,{ecmaVersion:'latest',sourceType:'module'});
function check(n){
 if(!n||typeof n!=='object')return;
 if(n.type==='ObjectExpression'){
 const keys=n.properties.filter(p=>p.type==='Property'&&!p.computed).map(p=>p.key.name||p.key.value);
 assert.equal(new Set(keys).size,keys.length,'Duplicate Vue options/methods');
 }
 for(const v of Object.values(n))if(Array.isArray(v))v.forEach(check);else if(v&&typeof v==='object')check(v);
}
check(ast);
compile(ui.slice(ui.indexOf('<template>')+10,ui.lastIndexOf('</template>')),{mode:'function'});
const opts=vm.runInNewContext(js.replace('export default','(')+')');
const ctx={...opts.data(),effectiveAgct:{at:Date.now(),uiVersion:version,state:'IDLE',meters:{'AGC+':{value:-20}},scan:{start:100},trace:[{threshold:98,'AGC+':{median:-21},LEVEL:{median:-110,spread:1}}]}};
for(const [name,fn] of Object.entries(opts.methods))ctx[name]=fn.bind(ctx);
for(const [name,fn] of Object.entries(opts.computed))if(name!=='effectiveAgct')Object.defineProperty(ctx,name,{get:()=>fn.call(ctx)});
assert.equal(ctx.agctField('scan.start'),100);
assert.equal(ctx.agctLast('AGC+'),'-21.0');
assert.equal(ctx.agctHeadline,'AGC-T STATUS');
assert.equal(ctx.agctAborted,false);
assert.match(ctx.agctTraceText,/-21.0/);
assert.equal(typeof ctx.refreshAgct,'function');
assert.equal(typeof ctx.agctAction,'function');
assert.match(opts.mounted.toString(),/this.refreshAgct/);
assert.match(opts.unmounted.toString(),/clearInterval\(this.agctTimer\)/);
const validate=new Function('msg','flow',flows.find(n=>n.name==='Validate UI action; forward only watcher controls').func);
const status={at:Date.now(),state:'IDLE',rxTx:'RX',activeSlice:'0',band:'40',settingsLoaded:true,settings:{quietMHzByBand:{40:7.074}},frequencyMHz:7.074,agcMode:'med',meters:Object.fromEntries(['LEVEL','AGC+'].map(k=>[k,{unit:'dBm',value:-20,at:Date.now()}]))};
const msg=()=>({payload:{action:'start100'},req:{headers:{host:'localhost:1880',origin:'http://localhost:1880','content-type':'application/json','x-agct-watcher':'1'}}});
assert.equal(validate(msg(),{get:()=>status})[1].statusCode,202);
status.state='SCAN_AGCT';assert.equal(validate(msg(),{get:()=>status})[1].statusCode,409);
status.state='IDLE';status.meters['AGC+'].at-=10000;assert.equal(validate(msg(),{get:()=>status})[1].statusCode,409);
console.log('PASS: Vue options, template compilation, live methods, AGC+ status rendering, start gate, busy/stale rejection, version and export consistency.');
// Navigation is shared by all four mounted widgets, including cross-page events.
for (const n of flows.filter(n=>n.type==='ui-template')) {
 const js=n.format.match(/<script>([\s\S]*?)<\/script>/)[1];
 check(parse(js,{ecmaVersion:'latest',sourceType:'module'}));
 const options=vm.runInNewContext(js.replace('export default','(')+')');
 assert.deepEqual(Array.from(options.data().tabs,t=>t.key),['radio','pa','tx','rx','external','agct']);
 assert(!n.format.includes('repeat(5,minmax(0,1fr)) 154px'));
 compile(n.format.slice(n.format.indexOf('<template>')+10,n.format.lastIndexOf('</template>')),{mode:'function'});
}
assert(ui.includes('class="agct-version-footer"'));
assert(ui.includes('Old: v{{ agctLive?.oldVersion'));assert(ui.includes('New: v{{ agctLive?.uiVersion'));assert(ui.includes('effectiveAgct?.abortReason'));assert(ui.includes('scan.requested'));assert(ui.includes('(requested '));
assert(ui.includes('Baseline AGC'));assert(ui.includes('AGC Median'));assert(!ui.includes('Baseline AGC+'));assert(!ui.includes('AGC+ Median'));assert(!ui.includes("agcMeterName || 'AGC'"));assert(ui.includes('scan.measurements'));assert(ui.includes('scan.scanTimeSeconds'));assert(ui.includes('Messung ab 100 starten'));
for(const label of ['AGC-T requested','AGC-T reported','LEVEL Median','LEVEL P10','LEVEL P90','LEVEL Spread','LEVEL MAD','Samples','Attempt','Restored AGC-T','AGC-T MEASURING','AGC-T ABORTED'])assert(ui.includes(label),label);
assert(!ui.includes('<small>AGC-T WATCHER'));
assert(ui.includes('grid-template-rows:42px 30px minmax(0,1fr) 24px'));
// Exercise the actual click handler: it must adopt fresh radio frequency,
// preserve sub-kHz precision, and wait for persisted status before success.
{
 let posts=[],saved=false,polls=0;
 const fresh={at:Date.now(),band:'40',frequencyMHz:7.064321,settingsLoaded:true,settings:{quietMHzByBand:{40:7.075}}};
 const fetch=async(path,options)=>{
  if(options?.method==='POST'){
   posts.push(JSON.parse(options.body));
   return {ok:true,json:async()=>({accepted:'settings'})};
  }
  polls++;
  if(posts.length && polls>=3)saved=true;
  return {ok:true,json:async()=>({...fresh,settingsError:posts.length&&!saved?'SETTINGS SAVING':null,
   settings:{quietMHzByBand:{40:saved?7.064321:7.075}}})};
 };
 const options=vm.runInNewContext(js.replace('export default','(')+')',{fetch,setTimeout:fn=>fn()});
 const state={...options.data(),agctLive:{...fresh,frequencyMHz:7.075}};
 for(const [name,fn]of Object.entries(options.methods))state[name]=fn.bind(state);
 await state.agctAction('settings');
 assert.equal(posts.length,1);
 assert.equal(posts[0].settings.quietMHz,7.064321);
 assert.equal(posts[0].settings.band,'40');
 assert(saved);
 assert.match(state.agctFeedback,/Mess-QRG gespeichert: 7\.064321/);
 assert.equal(state.agctBusy,false);
 // Unavailable live frequency must not fall back to an old field.
 fresh.frequencyMHz=null;
 await state.agctAction('settings');
 assert.equal(posts.length,1);
 assert.match(state.agctFeedback,/Keine aktuelle Radio-QRG/);
}
console.log('PASS: all tabs include AGC-T; fresh-QRG click, exact frequency, save acknowledgement and stale-input rejection.');
