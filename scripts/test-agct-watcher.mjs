// Offline state-machine tests. Synthetic meters never reach a radio.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {prepare} from './deploy-agct-watcher.mjs';
const flow=JSON.parse(await readFile(new URL('../examples/05-agct-watcher.json',import.meta.url)));
const get=id=>flow.find(n=>n.id===id);
const ids=new Set(flow.map(n=>n.id));assert.equal(ids.size,flow.length);assert(flow[0].disabled);
for(const n of flow.slice(1)){assert.equal(n.z,flow[0].id);for(const id of n.wires.flat())assert(ids.has(id));if(n.radio)assert.equal(n.radio,'7fbf2bfc9badc7d3');}
const html=get('agct_ui_html').template;new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
for(const [key,value] of Object.entries({scan_start:100,coarse_step:10,fine_step:2,settle_time_ms:300,measurement_time_ms:700,minimum_samples:5,knee_threshold_db:2.0,level_stability_db:2.0}))assert.equal(Number(get('agct_core').func.match(new RegExp(key+':([0-9.]+)'))?.[1]),value,key);
assert(html.includes('AGC-T 100'));assert(html.includes('AGC-T AUTO COMPLETE'));
function harness(){
 let now=100000;const state=new Map(),shared=new Map(),guardState=new Map(),writes=[],events=[];
 const sandbox={env:{get:()=>flow[0].env.find(e=>e.name==='WATCHER_VERSION').value},Date:{now:()=>now},msg:null,context:null,flow:{get:k=>shared.get(k),set:(k,v)=>shared.set(k,v)},node:{status(){},error(){}}};vm.createContext(sandbox);
 const core=new vm.Script('(function(){'+get('agct_core').func+'})()'),guard=new vm.Script('(function(){'+get('agct_guard').func+'})()');
 function send(topic,payload,extra={}){sandbox.msg={topic,payload,...extra};sandbox.context={get:k=>state.get(k),set:(k,v)=>state.set(k,v)};const result=core.runInContext(sandbox);events.push(...(result[0]||[]));for(const cmd of result[1]||[]){sandbox.msg=cmd;sandbox.context={get:k=>guardState.get(k),set:(k,v)=>guardState.set(k,v)};const allowed=guard.runInContext(sandbox);if(allowed?._agctWrite)writes.push(allowed);}return state.get('watcher');}
 function samples(agc=-20,level=-115,n=12,source='AGC+'){for(let i=0;i<n;i++){now+=100;if(i%5===0)send('interlock',{state:'RECEIVE'});send('SLC/7/LEVEL',{unit:'dBm',value:typeof level==='function'?level(i):level});send('SLC/7/'+source,{unit:'dBm',value:typeof agc==='function'?agc(i):agc});}}
 function boot(){send('settings/load',JSON.stringify({quietMHzByBand:{20:14.05},scanStart:50}));send('slice/7',{active:1,in_use:1,band:20,RF_frequency:14.05,agc_threshold:60,agc_mode:'med',mode:'USB'});samples();}
 function start(){send('control/auto',true);send('control/calibrate');send('clock');}
 function ack(){const w=writes.at(-1);assert(w);send('', '',{...w,request:w.payload,status_code:0});send('slice/7',{agc_threshold:+w.payload.split('=').at(-1)});}
 return {send,samples,boot,start,ack,writes,events,state:()=>state.get('watcher'),advance:ms=>now+=ms,shared};
}
{
 const h=harness();h.boot();h.start();assert.equal(h.writes.at(-1).payload,'slice s 7 agc_threshold=100');assert.equal(h.state().run.initial,60);
 h.ack();h.samples();assert.equal(h.state().trace[0].threshold,100);assert.equal(h.writes.at(-1).payload,'slice s 7 agc_threshold=90');
 for(const value of [90,80,70,60,50]){h.ack();h.samples();assert.equal(h.writes.at(-1).payload,`slice s 7 agc_threshold=${value-10}`);}
 h.ack();h.samples(-23);assert.equal(h.state().run.bracket.stable,50);assert.equal(h.state().run.bracket.falling,40);assert.equal(h.writes.at(-1).payload,'slice s 7 agc_threshold=48');
 h.ack();h.samples(-20);assert.equal(h.writes.at(-1).payload,'slice s 7 agc_threshold=46');h.ack();h.samples(-23);
 assert.equal(h.state().knee,46);assert.equal(h.writes.at(-1).payload,'slice s 7 agc_threshold=45');h.ack();assert.equal(h.state().state,'DONE');
 assert.deepEqual(Array.from(h.state().trace,x=>x.threshold),[100,90,80,70,60,50,40,48,46]);assert.equal(h.state().trace.length,9);assert(h.state().run.finished>=h.state().run.started);
 assert.equal(h.events.at(-1).payload.scan.measurements,9);assert.equal(h.events.at(-1).payload.scan.recommendedStart,100);
 h.send('connection/disconnected','disconnected');assert.equal(h.state().restore,null);h.send('slice/7',{active:1,in_use:1,band:20,RF_frequency:14.05,agc_threshold:45,agc_mode:'med',mode:'USB'});h.samples();h.send('control/calibrate');h.send('clock');assert.equal(h.state().run.initial,45);assert.equal(h.writes.at(-1).payload,'slice s 7 agc_threshold=100');
}
for(const stop of [{topic:'interlock',payload:{state:'TRANSMITTING'}},{topic:'slice/7',payload:{RF_frequency:14.06}},{topic:'slice/7',payload:{mode:'CW'}},{topic:'slice/7',payload:'removed'}]){
 const h=harness();h.boot();h.start();h.ack();h.samples();h.ack();const count=h.writes.length;h.send(stop.topic,stop.payload);assert.equal(h.state().state,'ERROR');assert(h.writes.length===count||h.writes.at(-1).payload==='slice s 7 agc_threshold=60');
}
{
 const h=harness();h.boot();h.send('',{21:{src:'SLC',num:7,nam:'LEVEL',unit:'dBm'},25:{src:'SLC',num:7,nam:'AGC',unit:'dBm',desc:'Signal strength after AGC'}},{request:'meter list',_agctReadEpoch:0,status_code:0});
 h.samples(-20,-115,12,'AGC');assert.equal(h.state().agcMeterBySlice['7'],'AGC');assert.equal(h.state().meters['7']['AGC+'].value,-20);
 h.start();assert.equal(h.writes.at(-1).payload,'slice s 7 agc_threshold=100');h.ack();h.samples(-20,-115,12,'AGC');assert.equal(h.state().trace[0].threshold,100);
}
{
 const h=harness();h.boot();h.start();h.ack();h.samples();h.ack();const count=h.writes.length;h.send('slice/8',{active:1,in_use:1,band:20,RF_frequency:14.05,agc_threshold:55,agc_mode:'med',mode:'USB'});
 assert.equal(h.state().state,'ERROR');assert.equal(h.state().active,null);assert.equal(h.state().restore.slice,'7');assert.equal(h.writes.length,count);
}
{
 const h=harness();h.boot();h.start();h.ack();h.samples();h.ack();h.send('interlock',{state:'TRANSMITTING'});const count=h.writes.length;h.send('clock');assert.equal(h.writes.length,count);h.send('interlock',{state:'RECEIVE'});assert.equal(h.writes.length,count);h.send('slice/7',{agc_threshold:90});assert.equal(h.writes.at(-1).payload,'slice s 7 agc_threshold=60');h.ack();assert.equal(h.state().restore,null);
}
{
 const h=harness();h.boot();h.start();h.ack();h.samples();h.ack();h.samples(-20,i=>i%2?-115:-110);assert.equal(h.state().state,'ERROR');assert.match(h.state().reason,/UNSTABLE LEVEL/);
}
{
 const h=harness();h.boot();h.start();h.advance(3100);h.send('clock');assert.equal(h.state().state,'ERROR');assert.match(h.state().reason,/STALE/);
}
{
 const h=harness();h.boot();h.start();const w=h.writes.at(-1);h.send('', '',{...w,request:w.payload,status_code:1});assert.equal(h.state().state,'ERROR');assert.match(h.state().reason,/COMMAND REJECTED/);
}
{
 const h=harness();h.boot();h.send('control/settings',{band:'20',quietMHz:null,scanStart:50});assert.equal(h.state().settings.quietMHzByBand['20'],14.05);
}
const config={id:'7fbf2bfc9badc7d3',type:'flexradio-radio'},other={id:'other',type:'tab'};const first=prepare({rev:'1',flows:[config,other]},flow);const next=prepare({rev:'2',flows:first.final},flow);assert.deepEqual(next.final.slice(0,2),[config,other]);assert.equal(next.final.length,first.final.length);
console.log('PASS: 100 start, 10/2 scan, immediate knee stop, measured trace, TX/frequency/mode/slice abort, deferred restoration, AGC-only inventory, unstable/stale meters, rejection, settings and stable deploy IDs. No radio requests.');
