import fs from 'node:fs';
import assert from 'node:assert/strict';
const flow=JSON.parse(fs.readFileSync('flows.json'));
const node=flow.find(n=>n.id==='au510m_meter_forward_only');
const execute=new Function('msg','context','Date',node.func);
function run(initial, watts, mode='TX', overrides={}) {
 const now=Date.now(), store=new Map([['meterActiveRange',initial]]);
 const context={get:k=>store.get(k),set:(k,v)=>store.set(k,v)};
 const payload={section:'pa',online:true,timestamp:now,radioStatus:{connected:true,at:now,fields:{'TX/RX':mode}},rows:[{topic:'TX-/1/FWDPWR',watts,seen:now},{topic:'TX-/3/SWR',value:1.41,raw:1.41,seen:now}],...overrides};
 const original=structuredClone(payload), output=execute({payload},context,{now:()=>now});
 assert.deepEqual(payload,original);assert.equal(output.payload.forward.watts,watts??null);assert.equal(output.payload.swr.value,1.41);
 return {range:output.payload.activeRange,store,payload,context,now};
}
for(const [start,power,want]of [[20,0,20],[2000,0,2000],[20,10,20],[20,19,20],[20,20,20],[20,21,200],[20,100,200],[20,199,200],[200,200,200],[20,201,2000],[20,500,2000],[2000,170,2000],[2000,160,2000],[2000,159,200],[200,17,200],[200,16,200],[200,15,20],[2000,10,20]])assert.equal(run(start,power).range,want,`${start} at ${power}`);
for(const start of [20,200,2000]) {assert.equal(run(start,0,'RX').range,start);assert.equal(run(start,500,'RX').range,start);for(const invalid of [null,undefined,NaN,Infinity,-1,'500'])assert.equal(run(start,invalid).range,start);assert.equal(run(start,500,'TX',{online:false}).range,start);}
const initial=run(undefined,0,'RX');assert.equal(initial.range,20);
const a=run(20,500);assert.equal(a.range,2000);
a.payload.radioStatus.fields['TX/RX']='RX';assert.equal(execute({payload:a.payload},a.context,{now:()=>a.now}).payload.activeRange,2000);
a.payload.radioStatus.fields['TX/RX']='TX';a.payload.radioStatus.at=a.now+100;a.payload.timestamp=a.now+100;
assert.equal(execute({payload:a.payload},a.context,{now:()=>a.now+100}).payload.activeRange,2000,'Previous TX sample cannot switch new TX range');
a.payload.rows[0].seen=a.now+100;a.payload.rows[0].watts=5;
assert.equal(execute({payload:a.payload},a.context,{now:()=>a.now+100}).payload.activeRange,20);
a.payload.rows[0].watts=500;a.payload.rows[0].seen=a.now-16000;
assert.equal(execute({payload:a.payload},a.context,{now:()=>a.now+100}).payload.activeRange,20,'Stale power must hold range');
assert.equal(flow.filter(n=>/context\.set\('meterActiveRange'/.test(n.func||'')).length,1);
console.log('PASS: one central auto-range, exact boundary hysteresis, direct transitions, startup 20 W, RX/zero/invalid/stale retention and no power mutation.');
