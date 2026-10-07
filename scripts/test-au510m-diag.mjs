import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {DiagnosticBuffer,TOPICS}=require('../diagnostics/au510m-stage1-core.cjs');
let time=0,wall=1800000000000;const debug=[];
const make=()=>new DiagnosticBuffer({version:'test',wall:()=>wall+time,mono:()=>time,debug:r=>debug.push(r)});
const core=make();assert.equal(core.records()[0].seq,1);assert.equal(core.records()[0].record_type,'LOGGER_START');assert.equal(core.data.tuneCandidate.tune_value,'UNKNOWN');assert.equal(core.data.latestState.tx_state,'UNKNOWN');
const snapshot=tx=>({connected:true,fields:{'TX/RX':tx,Frequency:'14.074 MHz',Mode:'DIGU','Active slice':'A'}});
core.canonical(snapshot('RX'),'READY');assert.equal(core.rate(),1);
const baseline=core.records().find(r=>r.record_type==='INTERLOCK_BASELINE');assert(baseline);
const rx=core.records().find(r=>r.record_type==='TX_RX');assert.equal(rx.derived_from_seq,baseline.seq);assert.equal(rx.derivation,'DERIVED_FROM_INTERLOCK');
const n=core.count;core.canonical(snapshot('RX'),'READY');assert.equal(core.count,n,'Unchanged status is not an event');
const rows=Object.fromEntries(TOPICS.map(topic=>[topic,{value:1,watts:12.3,seen:wall,unit:'dBm'}]));
for(time=50;time<=60000;time+=50)core.tick(rows);
assert.equal(core.data.metrics.total_health_samples,60);assert.equal(core.data.latestHealth['TX-/1/FWDPWR'].value,null,'Old sample expires rather than synthetic refresh');
time=61000;const input={state:'TRANSMITTING',reason:'NONE'};const inputBefore=structuredClone(input);core.interlock(input);core.canonical(snapshot('TX'),'TRANSMITTING');assert.deepEqual(input,inputBefore);
const inter=core.records().findLast(r=>r.record_type==='INTERLOCK_STATE'),tx=core.records().findLast(r=>r.record_type==='TX_RX');assert.equal(tx.derived_from_seq,inter.seq);assert.equal(inter.observation_confidence,'DIRECT');assert.equal(tx.command_origin,'UNKNOWN');
const prior=core.data.metrics.total_health_samples;for(time=61050;time<=63000;time+=50)core.tick(Object.fromEntries(TOPICS.map(topic=>[topic,{...rows[topic],seen:wall+time}])));
assert.equal(core.data.metrics.total_health_samples-prior,10);assert.equal(core.data.latestHealth['TX-/1/FWDPWR'].value,12.3);
core.interlock({state:'READY'});core.canonical(snapshot('RX'),'READY');assert(!Object.hasOwn(core.interlockFields,'reason'),'Old reason does not survive a new state without evidence');
core.tune(1,'0x1');assert.equal(core.rate(),5);assert.equal(core.data.tuneCandidate.tune_fresh,true);const ageStart=time;
time=ageStart+14999;core.tick({});assert.equal(core.data.tuneCandidate.tune_fresh,true);
time=ageStart+15000;core.tick({});assert.equal(core.data.tuneCandidate.tune_value,'UNKNOWN');assert.equal(core.rate(),1);
core.tune(1);const history=core.count;core.connection(false);assert(core.count>history);assert.equal(core.data.tuneCandidate.tune_fresh,false);assert.equal(core.data.latestState.tx_state,'UNKNOWN');assert.deepEqual(core.data.latestHealth,{});
core.connection(true);time+=1000;core.tick(rows);assert.equal(core.data.latestHealth['TX-/1/FWDPWR'].value,null,'Old connection-epoch meters cannot reappear');assert.equal(core.data.tuneCandidate.tune_value,'UNKNOWN');
core.request('request',{_msgid:'abc',payload:'meter list'});core.ack('request',{_msgid:'abc',status_code:0});const request=core.records().findLast(r=>r.record_type==='COMMAND_REQUEST'),ack=core.records().findLast(r=>r.record_type==='ACK_RESPONSE');assert.equal(ack.derived_from_seq,request.seq);assert.equal(request.command_origin,'NODE_RED');assert.equal(request.trigger_origin,'UNKNOWN');
assert(!Object.hasOwn(request,'meters'));assert(!debug.some(r=>r.record_type==='HEALTH'));
core.session('client/0x1/connected',{program:'AetherSDR',station:'station'},'recipient');const sessionCount=core.count;core.session('client/0x1/connected',{program:'AetherSDR',station:'station'},'recipient');assert.equal(core.count,sessionCount);assert.equal(core.records().at(-1).client_program,'AetherSDR');assert.equal(core.records().at(-1).command_origin,'UNKNOWN');
const fresh=make();assert.equal(fresh.count,2);assert.equal(fresh.records()[0].seq,1);assert.equal(fresh.data.tuneCandidate.tune_value,'UNKNOWN');assert.notEqual(core.data.run_id,fresh.data.run_id);
// Exercise actual fixed-capacity eviction independently of the extra memory guard.
for(let i=0;i<12020;i++)fresh.add({seq:i,record_type:'LIMIT_TEST'});
assert.equal(fresh.count,12000);assert.equal(fresh.data.metrics.dropped_by_limit,22);assert.equal(fresh.data.metrics.max_record_count_seen,12000);
time+=240000;fresh.expire();fresh.updateMetrics();assert.equal(fresh.data.metrics.dropped_by_age,0,'Exactly 240 s remains eligible');
time+=1;fresh.expire();fresh.updateMetrics();assert(fresh.data.metrics.dropped_by_age>=12000);assert(fresh.count<=2);assert.equal(fresh.slots.filter(Boolean).length,fresh.count);
const bounded=make();for(let i=0;i<1000;i++)bounded.append('BOUND','source','field',null,{long:'x'.repeat(10000)});assert(bounded.data.metrics.truncated_fields>=1000);assert(bounded.estimatedBytes<=bounded.config.memoryBudgetBytes);
const sequences=core.records().map(r=>r.seq);assert.equal(new Set(sequences).size,sequences.length);assert(sequences.every((n,i)=>!i||n>sequences[i-1]));
const {createHash}=await import('node:crypto');
const flows=JSON.parse(fs.readFileSync('flows.json')),contract=JSON.parse(fs.readFileSync('diagnostics/canonical-contract.json'));
const clean=n=>n.type==='tab'?({...n,env:(n.env||[]).filter(e=>!['WATCHER_VERSION','WATCHER_OLD_VERSION'].includes(e.name))}):n;
for(const [id,expected]of Object.entries(contract.nodes)){const current=flows.find(n=>n.id===id);assert(current);assert.equal(createHash('sha256').update(JSON.stringify(clean(current))).digest('hex'),expected,'Protected canonical node changed: '+id);}
assert.equal(flows.filter(n=>n.type==='flexradio-radio').length,contract.radio_configs);
assert(!flows.some(n=>n.type==='ui-page'&&n.path==='/diag'));
const mem=new DiagnosticBuffer({version:'test',wall:()=>wall+time,mono:()=>time,config:{memoryBudgetBytes:4096}});for(let i=0;i<100;i++)mem.add({x:'small'});assert(mem.data.metrics.dropped_by_memory>0);assert(mem.estimatedBytes<=4096);
console.log('PASS: passive original paths, one central version-only tab edit, deterministic startup, event dedup, 1/5Hz health, immutable canonical Watts, linked Interlock, Tune timeout, disconnect epochs, separate command/ACK provenance, 240s expiry, 12000 cap and bounded metadata.');

// Reused message ids in request fanout cannot identify one command.
{ const d=new DiagnosticBuffer({version:"test"}); d.request("source",{_msgid:"same",payload:"first"}); d.request("source",{_msgid:"same",payload:"second"}); d.ack("source",{_msgid:"same",status_code:0}); const r=d.records().at(-1); assert.equal(r.derived_from_seq,null); assert.equal(r.origin_confidence,"UNKNOWN"); }
