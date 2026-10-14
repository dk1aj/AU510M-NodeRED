// Real patched config/transport code; fake sockets, fake time, no network.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const S='1726-1213-0511-5611';
function harness(mode='automatic'){
 const timers=new Set(),history=[],tcp=[],udp=[],discovery=new EventEmitter(),statuses=[];
 const later=fn=>{const t={fn};timers.add(t);history.push(t);return t;};
 const cancel=t=>timers.delete(t);
 class Socket extends EventEmitter{
  constructor(){super();this.destroyed=false;this.closed=false;this.writes=[];}
  destroy(){this.destroyed=true;this.emit('close');}
  close(){this.closed=true;this.emit('close');}
  address(){return {port:12345};}
  bind(){}
  write(s){this.writes.push(s);}
 }
 const fakeNet={isIP:require('node:net').isIP,connect:(port,host,cb)=>{const s=new Socket();Object.assign(s,{port,host,cb});tcp.push(s);return s;}};
 const fakeUdp={createSocket:()=>{const s=new Socket();udp.push(s);return s;}};
 const common={setTimeout:later,clearTimeout:cancel,console:{log(){},error(){}},Promise};
 const radioModule={exports:{}};
 vm.runInNewContext(fs.readFileSync('node_modules/flexradio-js/Radio.js','utf8'),{...common,module:radioModule,require:n=>n==='net'?fakeNet:n==='dgram'?fakeUdp:require(n)});
 discovery.start=()=>{};
 let Constructor;
 const cfgModule={exports:{}};
 vm.runInNewContext(fs.readFileSync('node_modules/node-red-contrib-flexradio/flexradio-radio.js','utf8'),{...common,module:cfgModule,__dirname:new URL('../node_modules/node-red-contrib-flexradio',import.meta.url).pathname,process:{env:{}},require:n=>n==='net'?fakeNet:n==='flexradio-js/Radio'?radioModule.exports:n==='flexradio-js/DiscoveryListener'?{discovery_listener:()=>discovery}:require(n)});
 cfgModule.exports({nodes:{createNode:n=>{const e=new EventEmitter();for(const k of ['on','emit','off','listenerCount','setMaxListeners'])n[k]=e[k].bind(e);n.id='test-owner';n.log=n.error=n.debug=()=>{};n.context=()=>({set:(k,v)=>statuses.push(v)});},registerType:(t,c)=>{Constructor=c;}},httpAdmin:{get(){}}});
 const owner=new Constructor({host_mode:mode,serial:S,timeout:15});
 const found=(ip='192.168.178.30',serial=S,port=4992)=>discovery.emit('discovery',{payload:{serial,ip,port,nickname:'DK1AJ',model:'AU-510M'}});
 const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
 const ready=async()=>{const s=tcp.at(-1);s.cb();const u=udp.at(-1);u.emit('listening');const r=owner.radio;for(const item of Object.values(r.requests)){if(item.request==='meter list')item.callback({payload:{}});if(item.request.startsWith('client udpport'))item.callback({payload:{}});}await flush();assert.equal(owner.connectionState(),'connected');return {s,u};};
 const finish=()=>{owner.emit('close',()=>{});assert.equal(timers.size,0,'timers leaked');assert(tcp.every(s=>s.destroyed),'TCP leaked');assert(udp.every(s=>s.closed),'UDP leaked');assert.equal(discovery.listenerCount('discovery'),0);for(const s of [...tcp,...udp])assert.equal(s.eventNames().length,0,'socket listeners leaked');};
 return {owner,found,ready,finish,tcp,udp,timers,history,flush,discovery};
}
{
 const h=harness();h.found('192.168.178.31','OTHER');assert.equal(h.tcp.length,0,'H');h.found();assert.equal(h.tcp[0].host,'192.168.178.30','A');const original=h.owner.radio;
 for(let i=0;i<10;i++)h.found();assert.equal(h.tcp.length,1,'B');
 const old=h.tcp[0],oldConnect=old.cb,oldData=old.listeners('data')[0],oldClose=old.listeners('close')[0],oldError=old.listeners('error')[0],oldTimeout=h.history[0];
 h.found('192.168.178.31');assert(old.destroyed,'C abort');assert.equal(h.tcp[1].host,'192.168.178.31');assert.equal(h.owner.radio,original,'single Radio object');
 oldConnect();oldData(Buffer.from('obsolete'));oldClose();oldError(Error('obsolete'));oldTimeout.fn();assert.equal(h.tcp.length,2,'D stale callbacks');assert.equal(h.owner.connectionState(),'connecting');
 h.found('192.168.178.32','OTHER');assert.equal(h.tcp.length,2,'I');h.owner.disconnect();assert.equal(h.owner.connectionState(),'disconnected','F');h.owner.disconnect();assert.equal(h.timers.size,0);
 h.owner.connect({host_mode:'manual',host:'192.168.178.32',port:4992});assert.equal(h.tcp.at(-1).host,'192.168.178.32','G');h.finish();
}
{
 const h=harness();h.found();h.tcp[0].emit('error',Error('failure'));assert(h.tcp[0].destroyed);const retry=h.history.at(-1);assert.equal(h.timers.size,1);
 h.found('192.168.178.31');assert.equal(h.tcp.length,2);retry.fn();assert.equal(h.tcp.length,2,'E stale retry');h.finish();
}
{
 const h=harness();h.found();const first=await h.ready();const oldListening=first.u.listeners('listening')[0],oldMessage=first.u.listeners('message')[0];
 const before=h.tcp.length;for(let i=0;i<10;i++)h.found();assert.equal(h.tcp.length,before,'connected dedup');
 h.found('192.168.178.31');assert.equal(h.tcp.length,before,'healthy socket retained');
 first.s.emit('close');const retry=h.history.at(-1);h.timers.delete(retry);retry.fn();assert.equal(h.tcp.at(-1).host,'192.168.178.31');assert(first.u.closed);
 oldListening();oldMessage(Buffer.from('obsolete'));assert.equal(h.owner.connectionState(),'connecting');h.finish();
}
{
 const h=harness();h.found();h.tcp[0].cb();const oldUdp=h.udp[0];oldUdp.emit('error',Error('bind failed'));await h.flush();assert.equal(h.owner.connectionState(),'disconnected');h.finish();
}
{
 const h=harness();h.found();const timeout=h.history[0];h.timers.delete(timeout);timeout.fn();assert.equal(h.owner.connectionState(),'disconnected','bounded setup timeout');h.finish();
}
{
 const h=harness();h.owner.emit('close',()=>{});h.owner.disconnect();assert.equal(h.timers.size,0,'close before discovery');assert.equal(h.discovery.listenerCount('discovery'),0);
}
console.log('PASS A–J: initial serial selection, duplicate suppression, address migration during CONNECTING, generation guards, old retries, public cancel/reconnect, wrong/multiple radios, one Radio object, idempotent TCP/UDP/timer/listener cleanup; healthy connection retention and bounded setup timeout. No network used.');
// Late UDP setup and Promise continuations cannot revive a cancelled generation.
{
 const h=harness();h.found();h.tcp[0].cb();const oldMeter=Object.values(h.owner.radio.requests).find(r=>r.request==='meter list').callback;
 const oldUdp=h.udp[0],listen=oldUdp.listeners('listening')[0];h.found('192.168.178.31');listen();oldMeter({payload:{obsolete:{}}});await h.flush();assert.equal(h.owner.connectionState(),'connecting');assert.equal(Object.keys(h.owner.radio.meters).length,0);h.finish();
}
{
 const h=harness();h.found();const {u}=await h.ready();u.emit('error',Error('UDP failed after handshake'));await h.flush();assert.equal(h.owner.connectionState(),'disconnected');h.finish();
}
{
 const h=harness();h.found();h.found('192.168.178.30',S,4993);assert.equal(h.tcp.length,2);assert.equal(h.tcp[1].port,4993);h.found('not-an-ip');h.found('192.168.178.31',S,0);assert.equal(h.tcp.length,2);h.finish();
}
console.log('PASS: late meter/setup callbacks, post-handshake UDP failure, port change and malformed endpoint rejection.');
// The shared discovery cache retains fresh entries and expires old entries.
{
 let now=0,expire;const socket=new EventEmitter();socket.bind=()=>socket.emit('listening');socket.close=()=>socket.emit('close');
 class ClockDate extends Date{constructor(){super(now);}}
 const mod={exports:{}};
 vm.runInNewContext(fs.readFileSync('node_modules/flexradio-js/DiscoveryListener.js','utf8'),{module:mod,Date:ClockDate,console:{log(){},error(){}},setInterval:fn=>{expire=fn;return 1;},clearInterval(){},require:n=>n==='dgram'?{createSocket:()=>socket}:n==='./flex'?{decode_realtime:d=>d}:require(n)});
 const listener=mod.exports.discovery_listener();socket.emit('message',{type:'discovery',payload:{serial:'expired'}});now=60000;socket.emit('message',{type:'discovery',payload:{serial:S}});now=61000;expire();assert(!listener.radios.expired);assert(listener.radios[S]);listener.stop();
}
console.log('PASS: shared discovery cache expires old entries and retains fresh entries.');
