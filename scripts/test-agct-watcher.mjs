// Offline software tests only. The VM uses explicit test doubles, never a radio connection.
// Artificial constant samples exercise state transitions; they are NOT calibration evidence.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {prepare} from './deploy-agct-watcher.mjs';
const flow=JSON.parse(await readFile(new URL('../examples/05-agct-watcher.json',import.meta.url),'utf8'));
const get=id=>flow.find(n=>n.id===id);
const ids=new Set(flow.map(n=>n.id));assert.equal(ids.size,flow.length);assert(flow[0].disabled);
for(const n of flow.slice(1)){assert.equal(n.z,flow[0].id);for(const id of n.wires.flat())assert(ids.has(id));if(n.radio)assert.equal(n.radio,'7fbf2bfc9badc7d3');}
const html=get('agct_ui_html').template;new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
for(const [,id]of html.matchAll(/el\('([^']+)'\)/g))assert(html.includes('id="'+id+'"'),id);
assert(new RegExp(get('agct_meters').topic).test('SLC/7/AGC+'));
assert(!new RegExp(get('agct_meters').topic).test('SLC/7/AGCanything'));
function harness(){
 let now=100000;
 const state=new Map(),shared=new Map(),sent=[],events=[],errors=[];
 const context={get:k=>state.get(k),set:(k,v)=>state.set(k,v)};
 const sharedFlow={get:k=>shared.get(k),set:(k,v)=>shared.set(k,v)};
 const guardState=new Map();
 const sandbox={Date:{now:()=>now},msg:null,context,flow:sharedFlow,node:{status(){},warn(){},error(e){errors.push(e);}}};
 vm.createContext(sandbox);
 const core=new vm.Script('(function(){'+get('agct_core').func+'})()');
 const guard=new vm.Script('(function(){'+get('agct_guard').func+'})()');
 function send(msg){sandbox.msg=msg;sandbox.context=context;const result=core.runInContext(sandbox);events.push(...(result[0]||[]));for(const command of result[1]||[]){sandbox.msg=command;sandbox.context={get:k=>guardState.get(k),set:(k,v)=>guardState.set(k,v)};const allowed=guard.runInContext(sandbox);if(allowed)sent.push(allowed);}return result;}
 const advance=ms=>{now+=ms;};
 function boot(quiet=14.05){send({topic:'settings/load',payload:JSON.stringify({quietMHzByBand:{'20':quiet},scanStart:null})});send({topic:'slice/7',payload:{in_use:1,active:1,band:20,RF_frequency:14.05,agc_threshold:60,agc_mode:'med',mode:'USB'}});send({topic:'interlock',payload:{state:'RECEIVE'}});}
 function samples(agc=-20,level=-115,duration=4200){for(let i=0;i<duration/100;i++){advance(100);if(i%10===0)send({topic:'interlock',payload:{state:'RECEIVE'}});send({topic:'SLC/7/LEVEL',payload:{value:level,unit:'dBm'}});send({topic:'SLC/7/AGC+',payload:{value:agc,unit:'dBm'}});}}
 function calibrate(){send({topic:'control/auto',payload:true});send({topic:'control/calibrate'});send({topic:'clock'});samples();}
 const writes=()=>sent.filter(m=>m._agctWrite);
 function ack(){const c=writes().at(-1);assert(c);send({...c,request:c.payload,status_code:0,payload:''});send({topic:'slice/7',payload:{agc_threshold:Number(c.payload.split('=').at(-1))}});}
 return {send,advance,boot,samples,calibrate,ack,writes,events,errors,shared,sandbox,guard,state:()=>state.get('watcher')};
}
{
 const h=harness();h.boot(null);h.calibrate();assert.equal(h.state().state,'ERROR');assert.match(h.state().reason,/NO QUIET/);assert.equal(h.writes().length,0);
 h.send({topic:'clock'});assert.equal(h.writes().length,0);
}
{
 const h=harness();h.boot();h.send({topic:'control/calibrate'});assert.equal(h.writes().length,0);assert.equal(h.state().state,'IDLE');
 h.calibrate();assert.equal(h.state().state,'SCAN_AGCT');assert.equal(h.writes()[0].payload,'slice s 7 agc_threshold=58');
 h.ack();h.samples(-20,-115,7000);assert.equal(h.writes().at(-1).payload,'slice s 7 agc_threshold=56');
 h.ack();h.samples(-22,-115,7000);assert(h.state().run.confirming);
 h.samples(-22,-115,4200);assert(['KNEE_FOUND','APPLY'].includes(h.state().state));
 h.send({topic:'clock'});assert.equal(h.state().state,'APPLY');assert.equal(h.writes().at(-1).payload,'slice s 7 agc_threshold=57');
 h.ack();assert.equal(h.state().state,'DONE');const count=h.writes().length;h.samples(-10,-80,7000);assert.equal(h.writes().length,count);assert.equal(h.state().state,'DONE');
 assert(h.events.some(e=>e.payload.state==='KNEE_FOUND'));
}
for(const stop of [{topic:'interlock',payload:{state:'TRANSMITTING'}},{topic:'control/auto',payload:false},{topic:'connection/disconnected',payload:'disconnected'},{topic:'slice/7',payload:'removed'},{topic:'slice/7',payload:{RF_frequency:14.06}},{topic:'slice/7',payload:{agc_threshold:99}}]){
 const h=harness();h.boot();h.calibrate();const count=h.writes().length;const oldPermit=h.shared.get('agctWritePermit');h.send(stop);assert(!h.shared.get('agctWritePermit'));h.send({topic:'clock'});assert.equal(h.writes().length,count);assert(['ERROR','IDLE'].includes(h.state().state));
}
{
 const h=harness();h.boot();h.calibrate();h.ack();h.samples(-22,-110,7000);assert.equal(h.state().state,'ERROR');assert.match(h.state().reason,/INPUT NOISE CHANGED/);
}
{
 const h=harness();h.boot();h.calibrate();h.advance(6000);h.send({topic:'clock'});assert.equal(h.state().state,'ERROR');assert.equal(h.writes().length,1);
}
{
 const h=harness();h.boot();h.calibrate();const c=h.writes()[0];h.send({...c,request:c.payload,status_code:1,payload:'bad field'});assert.equal(h.state().state,'ERROR');assert.match(h.state().reason,/COMMAND REJECTED/);
}
{
 const h=harness();h.boot();const result=h.send({topic:'control/settings',payload:{band:'20',quietMHz:null,scanStart:75}});assert.equal(h.state().settings.quietMHzByBand['20'],14.05);assert.equal(result[2].length,1);
 h.send({topic:'settings/saved',_settingsToken:result[2][0]._settingsToken});assert.equal(h.state().settings.quietMHzByBand['20'],null);assert.equal(h.state().settings.scanStart,75);assert.equal(h.writes().length,0);
}
{
 const config={id:'7fbf2bfc9badc7d3',type:'flexradio-radio'},other={id:'other',type:'tab',label:'OTHER'};
 const first=prepare({rev:'1',flows:[config,other]},flow);const next=prepare({rev:'2',flows:first.final},flow);assert.equal(first.replacement[0].id,next.replacement[0].id);assert.deepEqual(next.final.slice(0,2),[config,other]);assert.equal(next.final.length,first.final.length);
 const legacy=structuredClone(first.final);legacy.find(n=>n.id===first.replacement[0].id).label='EXPERIMENT - AU-510M Auto AGC-T Watcher (measurement only)';legacy.find(n=>n.name==='Watcher + separated configuration').name='Watcher + separated configuration (READ ONLY)';const upgraded=prepare({rev:'3',flows:legacy},flow);assert.equal(upgraded.old.id,first.replacement[0].id);assert.deepEqual(upgraded.replacement.map(n=>n.id),first.replacement.map(n=>n.id));
}
console.log('PASS: offline state-machine tests, knee confirmation and one-shot DONE, missing quiet frequency, TX/OFF/disconnect/removal/manual changes, stale data, command rejection, settings acknowledgement, stable deployment IDs and UI syntax. No radio requests.');
// HTTP validation never forwards arbitrary radio commands or cross-origin requests.
{
 const f=new Function('msg','flow',get('agct_ui_control').func);
 const status={at:Date.now(),state:'IDLE',auto:false,band:'20',settingsLoaded:true,settings:{quietMHzByBand:{'20':null}}};
 const ctx={get:()=>status};
 const request=(settings)=>({payload:{action:'settings',settings},req:{headers:{host:'dietpi.fritz.box:1880',origin:'http://dietpi.fritz.box:1880','content-type':'application/json','x-agct-watcher':'1'}}});
 const good=f(request({band:'20',quietMHz:14.05,scanStart:null}),ctx);assert.equal(good[0].topic,'control/settings');assert.equal(good[1].statusCode,202);
 assert.equal(f(request({band:'20',quietMHz:'14.05; mox 1',scanStart:null}),ctx)[0],null);
 const cross=request({band:'20',quietMHz:null,scanStart:null});cross.req.headers.origin='http://other.invalid';assert.equal(f(cross,ctx)[0],null);
 status.state='SCAN_AGCT';assert.equal(f(request({band:'20',quietMHz:null,scanStart:null}),ctx)[1].statusCode,409);
}
// Persistence is atomic and acknowledged only after rename. No actual files are written.
{
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const storage=new AsyncFunction('msg','fs','node',get('agct_settings_store').func);
 const calls=[];
 const fs={promises:{writeFile:async(...args)=>calls.push(['write',...args]),rename:async(...args)=>calls.push(['rename',...args]),readFile:async()=>'{"quietMHzByBand":{"20":null},"scanStart":null}'}};
 const response=await storage({topic:'settings/saved',payload:'{"quietMHzByBand":{"20":null},"scanStart":null}',_settingsToken:5},fs,{warn(){}});
 assert.equal(response.topic,'settings/saved');assert.equal(response._settingsToken,5);assert.equal(calls[0][0],'write');assert(calls[0][1].endsWith('.tmp'));assert.equal(calls[1][0],'rename');
 const loaded=await storage({topic:'settings/read'},fs,{warn(){}});assert.equal(loaded.topic,'settings/load');
 fs.promises.readFile=async()=>{throw Object.assign(Error('missing'),{code:'ENOENT'});};assert.equal((await storage({topic:'settings/read'},fs,{warn(){}})).topic,'settings/missing');
 fs.promises.rename=async()=>{throw Error('write failed');};assert.equal((await storage({topic:'settings/saved',payload:'{}'},fs,{warn(){}})).topic,'settings/error');
}
console.log('PASS: settings HTTP validation, cross-origin and in-scan rejection, atomic persistence and error handling.');
// Simplified guide: one-shot start does not require a separate Auto ON or RX-check click.
{
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 const source=script.slice(script.indexOf('function guideState('),script.indexOf('function controls('));
 const guide=vm.runInNewContext(source+'\nguideState');
 const now=100000;
 const s={at:now,state:'IDLE',activeSlice:'7',band:'20',frequencyMHz:14.05,agcMode:'med',auto:false,rxTx:'RX',settingsLoaded:true,
  settings:{quietMHzByBand:{'20':null}},meters:{LEVEL:{value:-115,unit:'dBm',at:now},'AGC+':{value:-20,unit:'dBm',at:now}}};
 assert(!guide(s,now,false).start);s.settings.quietMHzByBand['20']=14.05;assert(guide(s,now,false).start);
 assert(!guide(s,now,true).start);assert(!guide(s,now+6000,false).start);
 s.rxTx='TX';assert(!guide(s,now,false).start);s.rxTx='RX';
 s.frequencyMHz=14.06;assert(!guide(s,now,false).start);s.frequencyMHz=14.05;
 s.state='SCAN_AGCT';assert(!guide(s,now,false).start);assert(guide(s,now,false).stop);
 s.state='ERROR';assert(!guide(s,now,false).done);s.state='DONE';assert(guide(s,now,false).done);
}
// New start action explicitly starts at 100 and restores Auto OFF after its single run.
{
 const h=harness();h.boot();h.samples(-20,-115,100);assert.equal(h.state().auto,false);
 h.send({topic:'control/start100'});assert.equal(h.state().auto,true);assert(h.state().manual);
 h.send({topic:'clock'});h.samples();assert.equal(h.writes().at(-1).payload,'slice s 7 agc_threshold=100');
 h.ack();h.samples(-20,-115,7000);assert.equal(h.writes().at(-1).payload,'slice s 7 agc_threshold=98');
 h.ack();h.samples(-20,-115,7000);assert.equal(h.writes().at(-1).payload,'slice s 7 agc_threshold=96');
 h.ack();h.samples(-22,-115,7000);h.samples(-22,-115,4200);h.send({topic:'clock'});
 assert.equal(h.writes().at(-1).payload,'slice s 7 agc_threshold=97');h.ack();assert.equal(h.state().state,'DONE');assert.equal(h.state().auto,false);assert.equal(h.state().manual,null);
 const count=h.writes().length;h.samples(-10,-80,7000);assert.equal(h.writes().length,count);
}
{
 const h=harness();h.boot();h.samples(-20,-115,100);h.send({topic:'control/start100'});h.send({topic:'clock'});h.samples();
 h.send({topic:'interlock',payload:{state:'TRANSMITTING'}});assert.equal(h.state().state,'ERROR');assert.equal(h.state().auto,false);assert.equal(h.state().manual,null);
}
console.log('PASS: two-click guide, atomic start from 100, successful single apply, Auto state restoration and TX abort.');
