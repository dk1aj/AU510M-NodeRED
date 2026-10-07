import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const flows=JSON.parse(fs.readFileSync('flows.json'));
const node=id=>flows.find(n=>n.id===id);
let now=1800000000000;
class Clock extends Date { static now(){return now;} }
const store=new Map(),globals={get:k=>store.get(k),set:(k,v)=>store.set(k,v)};
const branch=node('au510m_meter_pa_fault_status');
const run=msg=>{const original=JSON.stringify(msg);const r=vm.runInNewContext('(function(msg){'+branch.func+'})',{global:globals,Date:Clock})(msg);assert.equal(JSON.stringify(msg),original);assert.equal(r,null);return store.get('au510mMeterPaFaultStatus');};
const opts=vm.runInNewContext(node('au510m_power_swr_static_ui').format.match(/<script>([\s\S]*?)<\/script>/)[1].replace('export default','(')+')',{Date:Clock});
const view={...opts.data()};for(const[k,v]of Object.entries(opts.methods))view[k]=v.bind(view);for(const[k,v]of Object.entries(opts.computed))Object.defineProperty(view,k,{get:()=>v.call(view)});
const ctx=new Map();const project=vm.runInNewContext('(function(msg){'+node('au510m_meter_forward_only').func+'})',{Date:Clock,global:globals,context:{get:k=>ctx.get(k),set:(k,v)=>ctx.set(k,v)}});
function display(connected=true,watts=37){const input={payload:{section:'pa',online:true,timestamp:now,rows:[{topic:'TX-/1/FWDPWR',watts,seen:now},{topic:'TX-/2/REFPWR',watts:.4,seen:now},{topic:'TX-/3/SWR',value:1.23,raw:1.23,seen:now}],radioStatus:{connected,at:now,fields:{'TX/RX':'RX'}}}};const original=JSON.stringify(input);view.msg=project(input);opts.watch.msg.handler.call(view);assert.equal(JSON.stringify(input),original);assert.equal(view.msg.payload.forward.watts,watts);assert.equal(view.msg.payload.reflected.watts,.4);assert.equal(view.msg.payload.swr.value,1.23);return view.paFaultStatus;}
assert.equal(display().value,'UNKNOWN');
run({topic:'interlock',payload:{state:'READY'}});assert.equal(display().value,'READY');assert.equal(display().tone,'clear');
run({topic:'interlock',payload:{state:'READY',reason:'PA_FAULT'}});assert.equal(display().value,'READY','sticky reason does not prove current fault');
run({topic:'interlock',payload:{state:'TX_FAULT'}});assert.equal(display().value,'FAULT');assert.equal(display().tone,'fault');
run({topic:'interlock',payload:{reason:''}});assert.equal(display().value,'FAULT');
assert.equal(display(true,0).value,'FAULT','zero Watts do not clear fault');
run({topic:'transmit',payload:{tune:0}});assert.equal(display().value,'FAULT','TUNE and RX do not clear interlock fault');
run({topic:'interlock',payload:{state:'NOT_READY'}});assert.equal(display().value,'FAULT');
now+=15001;assert.equal(display().value,'UNKNOWN','stale fault becomes unknown, never green');
run({topic:'interlock',payload:{reason:''}});assert.equal(display().value,'UNKNOWN','reason-only traffic cannot refresh state');
run({topic:'interlock',payload:{state:'NOT_READY'}});assert.equal(display().value,'FAULT','fresh blocked state retains previous fault');
run({topic:'interlock',payload:{state:'READY'}});assert.equal(display().value,'READY');
const evidence=JSON.parse(fs.readFileSync('docs/measurements/meter-pa-fault-v4.26-evidence.json'));
const fixture=JSON.parse(fs.readFileSync('diagnostics/fixtures/stage2-v423-natural-oscillation.json'));
for(const [i,record]of evidence.diagnostic_records.entries()) {
  const original=fixture.records.find(r=>r.seq===record.seq);
  assert(original);
  for(const [key,value]of Object.entries(record)) assert.equal(value,original[key],'selected original field preserved');
  now=record.ts_ms;run({topic:'interlock',payload:{state:record.interlock_state}});
  assert.equal(display().value,['FAULT','FAULT','READY'][i]);
}
for(const [i,record]of evidence.journal_observations.entries()) {
  now=Date.parse(record.journal_ts_utc);
  const {state,reason}=record.payload;
  assert.equal(reason,'PA_FAULT');run({topic:'interlock',payload:{state,reason}});
  assert.equal(display().value,['FAULT','FAULT','READY'][i]);
}
assert.equal(display(false).value,'UNKNOWN');
run({topic:'connection/disconnected',payload:'disconnected'});assert.equal(display().value,'UNKNOWN');
run({topic:'connection/connected',payload:'connected'});assert.equal(display().value,'UNKNOWN');
run({topic:'interlock',payload:{reason:'PA_FAULT'}});assert.equal(display().value,'UNKNOWN','reconnect needs fresh state');
run({topic:'interlock',payload:{state:'NOT_READY'}});assert.equal(display().value,'UNKNOWN','startup blocked state proves no clearance');
run({topic:'interlock',payload:{state:'READY'}});assert.equal(display().value,'READY');
run({topic:'interlock',payload:{state:'UNSUPPORTED'}});assert.equal(display().value,'UNKNOWN');
run({topic:'interlock',payload:{state:'READY',reason:42}});assert.equal(display().value,'READY','reason validity does not determine state');
for(const state of ['TIMEOUT','STUCK_INPUT']){run({topic:'interlock',payload:{state}});assert.equal(display().value,'FAULT');}
run({topic:'interlock',payload:{state:'READY'}});display();view.liveClock+=16000;assert.equal(view.paFaultStatus.value,'UNKNOWN');
assert(!node('au510m_power_swr_static_ui').format.includes('pa-fault-reported'));
assert.match(node('au510m_power_swr_static_ui').format,/<b>\{\{ paFaultStatus.value \}\}<\/b>/);
assert(node('au510m_live_messages').wires[0].includes('au510m_live_state'));assert(node('au510m_live_messages').wires[0].includes(branch.id));assert.equal(branch.outputs,0);assert.deepEqual(branch.wires,[]);assert(!branch.func.includes('node.send'));
assert.match(node('au510m_power_swr_static_ui').format,/<foreignObject x="24" y="62" width="90" height="38"/);
console.log('PASS: READY green / FAULT red / UNKNOWN gray; actual fault clearance replay; stale, startup, disconnect/reconnect; canonical power/SWR unchanged.');
