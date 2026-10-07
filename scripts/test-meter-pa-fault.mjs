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
function display(connected=true){const input={payload:{section:'pa',online:true,timestamp:now,rows:[{topic:'TX-/1/FWDPWR',watts:37,seen:now},{topic:'TX-/2/REFPWR',watts:.4,seen:now},{topic:'TX-/3/SWR',value:1.23,raw:1.23,seen:now}],radioStatus:{connected,at:now,fields:{'TX/RX':'RX'}}}};const original=JSON.stringify(input);view.msg=project(input);opts.watch.msg.handler.call(view);assert.equal(JSON.stringify(input),original);assert.equal(view.msg.payload.forward.watts,37);assert.equal(view.msg.payload.reflected.watts,.4);assert.equal(view.msg.payload.swr.value,1.23);return view.paFaultStatus;}
assert.equal(display().value,'--');
run({topic:'interlock',payload:{state:'READY',reason:null}});assert.equal(display().value,'NEIN','explicit decoded empty reason is a cleared observation');
run({topic:'interlock',payload:{state:'READY',reason:'PA_FAULT'}});assert.equal(display().value,'JA');assert.equal(display().tone,'reported');assert.equal(display().state,'READY');
run({topic:'interlock',payload:{state:'TX_FAULT',reason:'PA_FAULT'}});assert.equal(display().tone,'fault');
run({topic:'interlock',payload:{state:'READY'}});assert.equal(display().value,'--','new state without reason must not carry old PA_FAULT');
run({topic:'interlock',payload:{reason:''}});assert.equal(display().value,'NEIN');assert.equal(display().tone,'clear');
run({topic:'interlock',payload:{state:'READY',reason:'PA_FAULT'}});now+=15001;run({topic:'interlock',payload:{state:'READY'}});assert.equal(display().value,'--','state-only traffic cannot refresh old reason');
run({topic:'interlock',payload:{state:'READY',reason:'PA_FAULT'}});assert.equal(display(false).value,'--');
run({topic:'connection/disconnected',payload:'disconnected'});assert.equal(display().value,'--');
run({topic:'interlock',payload:{state:'READY',reason:'PA_FAULT'}});run({topic:'connection/connected',payload:'connected'});assert.equal(display().value,'--','reconnect must clear previous session');
run({topic:'interlock',payload:{state:'READY',reason:42}});assert.equal(display().value,'--');
run({topic:'interlock',payload:{state:'READY',reason:'PA_FAULT'}});display();view.liveClock+=16000;assert.equal(view.paFaultStatus.value,'--','browser inactivity expires display without new messages');
assert(node('au510m_live_messages').wires[0].includes('au510m_live_state'));assert(node('au510m_live_messages').wires[0].includes(branch.id));assert.equal(branch.outputs,0);assert.deepEqual(branch.wires,[]);assert(!branch.func.includes('node.send'));
assert.match(node('au510m_power_swr_static_ui').format,/<foreignObject x="24" y="62" width="90" height="38"/);
console.log('PASS: PA_FAULT READY amber, fault red, explicit empty clear, unknown/stale/disconnect/reconnect, partial-state reset, no input mutation or radio commands; canonical power/SWR unchanged.');
