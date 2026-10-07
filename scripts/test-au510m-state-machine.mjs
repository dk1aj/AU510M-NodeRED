import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {DiagnosticStateMachine}=require('../diagnostics/au510m-state-machine.cjs');
const {DiagnosticBuffer,DEFAULTS}=require('../diagnostics/au510m-stage1-core.cjs');
function fixture(){
 const output=[],metrics={};const sm=new DiagnosticStateMachine({metrics,emit:r=>output.push(r)});let seq=0,lockSeq=null;
 const event=(type,extra={})=>{const r={record_type:type,seq:++seq,ts_ms:1800000000000+seq,source:'SYNTHETIC_OFFLINE_TEST',tx_state:sm.tx,tune_value:sm.tuneValue,tune_fresh:sm.tuneFresh,...extra};sm.consume(r);return r;};
 const lock=(value,baseline=false)=>{const r=event(baseline?'INTERLOCK_BASELINE':'INTERLOCK_STATE',{new_value:value});lockSeq=r.seq;return r;};
 const tx=value=>event('TX_RX',{new_value:value,tx_state:value,derivation:'DERIVED_FROM_INTERLOCK',derived_from_seq:lockSeq});
 const tune=value=>event('TUNE_CANDIDATE',{old_value:sm.tuneValue,new_value:value,tune_value:value,tune_fresh:true});
 const rx=()=>{event('LOGGER_START');event('RADIO_CONNECTED');lock('READY',true);tx('RX');tune(0);};
 const states=()=>output.map(r=>r.new_state);return {sm,metrics,output,event,lock,tx,tune,rx,states};
}
// A/B: deterministic startup, fresh RX, and repeated snapshots without chatter.
{
 const f=fixture();f.event('LOGGER_START');assert.equal(f.sm.data.diag_state,'UNKNOWN');
 f.event('RADIO_CONNECTED');assert.equal(f.sm.data.diag_state,'UNKNOWN');f.lock('READY');f.tx('RX');
 assert.equal(f.sm.data.diag_state,'RADIO_RX');const count=f.output.length;
 for(let i=0;i<100;i++)f.event('HEALTH');assert.equal(f.output.length,count);
 assert.equal(f.output.at(-1).state_confidence,'DERIVED');
}
// C: both request precursors are directly observed, never interpolated.
{
 const f=fixture();f.rx();const first=f.output.length;f.lock('PTT_REQUESTED');f.tx('UNKNOWN');f.lock('TRANSMITTING');f.tx('TX');f.lock('UNKEY_REQUESTED');f.tx('UNKNOWN');f.lock('READY');f.tx('RX');
 assert.deepEqual(f.states().slice(first),['TX_REQUESTED','TRANSMITTING','UNKEY_REQUESTED','RETURN_TO_RX','RADIO_RX']);
 assert.equal(f.output.find(r=>r.new_state==='TX_REQUESTED').state_confidence,'DIRECT');
 assert.equal(f.output.find(r=>r.new_state==='TRANSMITTING').state_confidence,'DERIVED');
 const g=fixture();g.rx();const n=g.output.length;g.lock('TRANSMITTING');g.tx('TX');g.lock('READY');g.tx('RX');
 assert.deepEqual(g.states().slice(n),['TRANSMITTING','RETURN_TO_RX','RADIO_RX'],'Missing precursor is skipped, not fabricated');
}
// D/E: tune signal is independent of TX; both radio event orders are valid.
for(const tuneOffBeforeRx of [true,false]){
 const f=fixture();f.rx();const n=f.output.length;f.tune(1);f.lock('PTT_REQUESTED');f.tx('UNKNOWN');f.lock('TRANSMITTING');f.tx('TX');
 if(tuneOffBeforeRx)f.tune(0);
 f.lock('UNKEY_REQUESTED');f.tx('UNKNOWN');f.lock('READY');f.tx('RX');
 if(!tuneOffBeforeRx){assert.equal(f.sm.data.diagnostic_tune_signal,'TUNE_ACTIVE');assert.equal(f.sm.data.diag_state,'RADIO_RX');f.event('HEALTH');f.tune(1);assert.equal(f.sm.data.diag_state,'RADIO_RX');f.tune(0);}
 assert.deepEqual(f.states().slice(n),['TUNE_REQUESTED','TX_REQUESTED','TRANSMITTING','UNKEY_REQUESTED','RETURN_TO_RX','RADIO_RX']);
 assert(f.output.every(r=>r.origin_confidence==='UNKNOWN'));
}
// Tune cancellation before TX does not fabricate transmission.
{const f=fixture();f.rx();const n=f.output.length;f.tune(1);f.tune(0);assert.deepEqual(f.states().slice(n),['TUNE_REQUESTED','RETURN_TO_RX','RADIO_RX']);}
// F: block and material reason changes. READY with tx_allowed=false is not a block.
{
 const f=fixture();f.rx();f.event('INTERLOCK_FIELD',{field:'tx_allowed',new_value:0});assert.equal(f.sm.data.diag_state,'RADIO_RX');
 f.lock('NOT_READY');assert.equal(f.sm.data.diag_state,'INTERLOCK_BLOCKED');f.event('INTERLOCK_FIELD',{field:'reason',new_value:'RCA_TXREQ'});assert.equal(f.output.at(-1).interlock_reason,'RCA_TXREQ');
 const n=f.output.length;f.event('INTERLOCK_FIELD',{field:'reason',new_value:'RCA_TXREQ'});assert.equal(f.output.length,n);
 f.lock('READY');f.tx('RX');assert.equal(f.sm.data.diag_state,'RADIO_RX');assert.equal(f.output.at(-1).interlock_reason,null);
 for(const fault of ['TX_FAULT','TIMEOUT','STUCK_INPUT']){f.lock(fault);assert.equal(f.sm.data.diag_state,'FAULT');assert.equal(f.output.at(-1).state_confidence,'DIRECT');f.lock('READY');f.tx('RX');}
 f.lock('UNRECOGNIZED_FIRMWARE_STATE');assert.equal(f.sm.data.diag_state,'UNKNOWN');
}
// G: history survives disconnect; reconnection cannot reuse cached TX/tune.
{
 const f=fixture();f.rx();f.tune(1);f.event('RADIO_DISCONNECTED');assert.equal(f.sm.data.diag_state,'UNKNOWN');assert.equal(f.sm.data.diagnostic_tune_signal,'TUNE_UNKNOWN');
 f.event('RADIO_CONNECTED');f.event('HEALTH',{tx_state:'TX',tune_value:1,tune_fresh:true});assert.equal(f.sm.data.diag_state,'UNKNOWN');
 f.lock('READY');f.tx('RX');assert.equal(f.sm.data.diag_state,'RADIO_RX');assert.equal(f.sm.data.diagnostic_tune_signal,'TUNE_UNKNOWN');
}
// H: stale tune is unknown, but independent known RX or TX can remain known.
{
 const f=fixture();f.rx();f.tune(1);f.event('TUNE_STALE',{new_value:'UNKNOWN',tune_value:'UNKNOWN',tune_fresh:false});assert.equal(f.sm.data.diagnostic_tune_signal,'TUNE_UNKNOWN');assert.equal(f.sm.data.diag_state,'RADIO_RX');
 f.lock('TRANSMITTING');f.tx('TX');f.tune(1);f.event('TUNE_STALE',{tune_value:'UNKNOWN',tune_fresh:false});assert.equal(f.sm.data.diag_state,'TRANSMITTING');
}
// Missing canonical result cannot leave a previous logical phase held indefinitely.
{ const f=fixture();f.rx();f.lock('TRANSMITTING');f.event('HEALTH');assert.equal(f.sm.data.diag_state,'UNKNOWN'); }
// Inconsistency and provenance: unknown evidence, never ordinary-transition faults.
{
 const f=fixture();f.rx();f.lock('TRANSMITTING');f.tx('RX');assert.equal(f.sm.data.diag_state,'UNKNOWN');
 f.lock('READY');f.tx('TX');assert.equal(f.sm.data.diag_state,'UNKNOWN');
 f.event('TX_RX',{new_value:'TX',derivation:'DERIVED_FROM_INTERLOCK',derived_from_seq:-1});assert.equal(f.sm.data.diag_state,'UNKNOWN');
 f.event('DIAGNOSTIC_ERROR');assert.equal(f.sm.data.diag_state,'FAULT');assert.equal(f.output.at(-1).fault_scope,'DIAGNOSTIC');
 const g=fixture();g.rx();g.sm.consume({record_type:'TX_RX',seq:1,ts_ms:1});assert.equal(g.sm.data.diag_state,'FAULT');
}
// Replay actual Stage-1 source records after an explicitly synthetic baseline.
{
 const saved=JSON.parse(fs.readFileSync('diagnostics/fixtures/stage1-v422-tune.json'));
 const f=fixture();f.rx();const n=f.output.length;
 for(const r of saved.records){const before=JSON.stringify(r);f.sm.consume(r);assert.equal(JSON.stringify(r),before);}
 assert.deepEqual(f.states().slice(n),['TUNE_REQUESTED','TX_REQUESTED','TRANSMITTING','UNKEY_REQUESTED','RETURN_TO_RX','RADIO_RX']);
 assert.equal(f.sm.data.diagnostic_tune_signal,'TUNE_INACTIVE');
 for(const r of f.output.slice(n)){assert(saved.records.some(s=>s.seq===r.source_event_seq));assert.equal(r.derived_from_seq,r.source_event_seq);}
}
// Integrated reducer uses the one existing ring, preserves order and rates.
{
 let now=0;const d=new DiagnosticBuffer({version:'test',wall:()=>1800000000000+now,mono:()=>now});
 d.canonical({connected:true,fields:{'TX/RX':'RX'}},'READY');d.tune(0);const baseline=d.data.metrics.state_transition_count;
 for(now=50;now<=60000;now+=50)d.tick({});assert.equal(d.data.metrics.total_health_samples,60);assert.equal(d.data.metrics.state_transition_count,baseline);
 d.tune(1);assert.equal(d.rate(),5);d.interlock({state:'TRANSMITTING'});d.canonical({connected:true,fields:{'TX/RX':'TX'}},'TRANSMITTING');
 const h=d.data.metrics.total_health_samples;for(let i=0;i<100;i++){now+=50;d.tick({});}assert.equal(d.data.metrics.total_health_samples-h,25);
 d.connection(false);assert.equal(d.data.stateMachine.diag_state,'UNKNOWN');assert.equal(d.rate(),1);
 const rows=d.records();assert(rows.some(r=>r.record_type==='DIAG_STATE_CHANGE'));assert(rows.every((r,i)=>!i||r.seq>rows[i-1].seq));
 for(const r of rows.filter(r=>r.record_type==='DIAG_STATE_CHANGE')){assert(rows.some(s=>s.seq===r.source_event_seq));assert(['DIRECT','DERIVED','UNKNOWN'].includes(r.state_confidence));assert.equal(r.command_origin,'UNKNOWN');assert.equal(r.trigger_origin,'UNKNOWN');}
 assert.equal(DEFAULTS.maxRecords,12000);assert.equal(DEFAULTS.retentionMs,240000);assert.equal(DEFAULTS.memoryBudgetBytes,50*1024*1024);
 assert.equal(d.slots,d.data.ringBuffer.records);assert(!Object.hasOwn(d.stateMachine,'records'));
}
console.log('PASS: Stage-2 startup/RX/TX/TUNE, real v4.22 replay, explicit request precursors, return with active tune, block/fault limits, disconnect/stale/contradiction, no chatter/origin guessing, one ordered bounded ring, unchanged 1/5Hz.');
