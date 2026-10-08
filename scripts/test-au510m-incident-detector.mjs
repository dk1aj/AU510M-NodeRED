import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {DiagnosticBuffer,TOPICS,DEFAULTS}=require('../diagnostics/au510m-stage1-core.cjs');
const {IncidentDetector,MAX_CYCLES}=require('../diagnostics/au510m-incident-detector.cjs');
const results=[];
function test(name,expected,fn){fn();results.push({name,expected,actual:expected,result:'PASS'});console.log(`PASS ${name}: expected=${expected}; actual=${expected}`);}
function fixture(){
 let now=0;const debug=[],rows={};const d=new DiagnosticBuffer({version:'SYNTHETIC_STAGE3_TEST',wall:()=>1800000000000+now,mono:()=>now,debug:r=>debug.push(r)});
 const canon=(tx,lock)=>{d.interlock({state:lock});d.canonical({connected:true,fields:{'TX/RX':tx,Frequency:'14.074 MHz',Mode:'DIGU','Active slice':'A'}},lock);};
 d.canonical({connected:true,fields:{'TX/RX':'RX',Frequency:'14.074 MHz',Mode:'DIGU','Active slice':'A'}},'READY');d.tune(0);
 const step=(ms=100)=>{now+=ms;d.tick(rows);};
 const start=(tune=false)=>{if(tune)d.tune(1);canon('UNKNOWN','PTT_REQUESTED');step(20);canon('TX','TRANSMITTING');};
 const finish=(off=false)=>{step(100);if(off)d.tune(0);canon('UNKNOWN','UNKEY_REQUESTED');canon('RX','READY');step(20);};
 const cycle=(tune=false,off=false)=>{start(tune);finish(off);step(100);};
 const incident=()=>d.data.incidentDetector.active_incident??d.data.incidentDetector.last_incident;
 const noIncident=()=>assert.equal(d.data.metrics.total_incidents,0);
 return {d,rows,debug,step,canon,start,finish,cycle,incident,noIncident,now:()=>now};
}
test('NORMAL_RX','NO INCIDENT',()=>{const f=fixture();for(let i=0;i<60;i++)f.step(1000);f.noIncident();assert.equal(f.d.data.metrics.total_health_samples,60);});
test('NORMAL_TX','NO INCIDENT; ONE CYCLE',()=>{const f=fixture();f.cycle();f.noIncident();assert.equal(f.d.data.incidentDetector.candidate_cycle_count,1);});
test('NORMAL_TUNE','NO INCIDENT; ONE CYCLE',()=>{const f=fixture();f.cycle(true);f.d.tune(0);f.noIncident();assert.equal(f.d.data.incidentDetector.candidate_cycle_count,1);});
test('TWO_FAST_CYCLES','NO INCIDENT',()=>{const f=fixture();f.cycle(true);f.cycle();f.noIncident();});
test('THREE_FAST_TX_NO_TUNE','NO INCIDENT',()=>{const f=fixture();for(let i=0;i<3;i++)f.cycle();f.noIncident();});
test('THREE_FAST_TUNE_RX_OSCILLATION','ONE TUNE_RX_OSCILLATION',()=>{
 const f=fixture();f.cycle(true);f.cycle();f.cycle();const a=f.incident();assert.equal(a.incident_type,'TUNE_RX_OSCILLATION');assert.equal(a.cycle_count,3);assert.equal(a.first_abnormal_event,'RX_RETURN_WHILE_TUNE_ACTIVE');assert.equal(a.first_abnormal_seq,a.cycles[0].end_seq);assert.equal(a.tune_active_during_rx,true);assert.equal(a.pre_trigger_complete,false);assert.equal(a.post_capture_state,'COLLECTING');
 assert.equal(f.debug.filter(r=>r.record_type==='INCIDENT_TRIGGER').length,1);
 const records=f.d.records();assert(records.some(r=>r.seq===a.trigger_seq));assert(records.some(r=>r.seq===a.first_abnormal_seq));
 for(const c of a.cycles){assert(records.some(r=>r.seq===c.start_seq&&r.record_type==='DIAG_STATE_CHANGE'));assert(records.some(r=>r.seq===c.transmit_seq&&r.new_state==='TRANSMITTING'));}
});
test('THREE_SLOW_CYCLES','NO INCIDENT',()=>{const f=fixture();for(let i=0;i<3;i++){f.cycle(true);f.step(3000);}f.noIncident();});
test('TUNE_ACTIVE_DURING_RX','ACTIVE TUNE PRESERVED; ONE INCIDENT',()=>{const f=fixture();f.cycle(true);assert.equal(f.d.data.stateMachine.diag_state,'RADIO_RX');assert.equal(f.d.data.tuneCandidate.tune_value,1);f.cycle();f.cycle();assert(f.incident().cycles.every(c=>c.tune_value_at_rx_return===1&&c.tune_fresh_at_rx_return));});
test('TUNE_REACTIVATION','ONE INCIDENT; REACTIVATION EVIDENCE',()=>{
 const f=fixture();for(let i=0;i<3;i++)f.cycle(true,true);const a=f.incident();assert.equal(a.tune_reactivated,true);assert.equal(a.tune_active_during_rx,false);assert.equal(a.first_abnormal_event,'TUNE_REACTIVATED_AFTER_RX');assert(a.first_abnormal_seq<a.trigger_seq);assert.equal(a.cycles[0].tune_reactivated_before_next_cycle,true);assert.equal(a.cycles[0].tune_value_at_rx_return,0);
});
test('DISCONNECT_DURING_CANDIDATE','CANDIDATES CLEARED; NO INCIDENT',()=>{const f=fixture();f.cycle(true);f.cycle();f.d.connection(false);assert.equal(f.d.data.incidentDetector.candidate_cycle_count,0);assert.equal(f.d.incidentDetector.cycle,null);f.noIncident();});
test('RESTART_DURING_POST_CAPTURE','INCOMPLETE; NEW RUN EMPTY',()=>{
 const f=fixture();f.cycle(true);f.cycle();f.cycle();const a=f.incident();f.d.close();assert.equal(a.post_trigger_complete,false);assert.equal(a.post_capture_state,'INCOMPLETE');assert.equal(a.post_incomplete_reason,'LOGGER_STOP_OR_RUNTIME_REDEPLOY');assert.equal(f.d.data.metrics.incident_detector_status,'STOPPED');const g=fixture();assert.notEqual(g.d.data.run_id,f.d.data.run_id);g.noIncident();assert.equal(g.incident(),null);
});
test('DISCONNECT_DURING_POST_CAPTURE','INCOMPLETE',()=>{const f=fixture();f.cycle(true);f.cycle();f.cycle();f.d.connection(false);assert.equal(f.incident().post_capture_state,'INCOMPLETE');});
test('POST_120_SECONDS_AND_DEDUP','ONE DEBUG; QUIET SEPARATE; ORIGINAL DEADLINE',()=>{
 const f=fixture();f.cycle(true);f.cycle();f.cycle();const a=f.incident(),deadline=a._deadline_mono;f.cycle();assert.equal(a.cycle_count,4);assert.equal(a._deadline_mono,deadline);assert.equal(f.d.data.metrics.total_incidents,1);assert.equal(f.debug.filter(r=>r.record_type==='INCIDENT_TRIGGER').length,1);
 f.step(5000);assert.equal(a.oscillation_status,'QUIET');assert.equal(a.post_capture_state,'COLLECTING');f.step(deadline-f.now()-1);assert.equal(a.post_capture_state,'COLLECTING');f.step(1);f.d.health({});assert.equal(a.post_capture_state,'COMPLETE');assert.equal(a.post_trigger_complete,true);assert.equal(f.d.data.incidentDetector.active_incident,null);assert.equal(f.d.data.incidentDetector.last_incident,a);
});
test('PRE_120_REFERENCE_AND_TRIGGER_HEALTH','COMPLETE REFERENCE; ONE SNAPSHOT',()=>{
 const f=fixture();for(let i=0;i<125;i++)f.step(1000);
 const rows=Object.fromEntries(TOPICS.map((t,i)=>[t,{seen:1800000000000+f.now(),value:i,watts:i/10,unit:'TEST'}]));Object.assign(f.rows,rows);f.d.health(rows);f.cycle(true);f.cycle();f.cycle();const a=f.incident();assert.equal(a.pre_trigger_complete,true);assert.equal(a.pre_window_available_seconds,120);assert.equal(a.pre_trigger_to_ts-a.pre_trigger_from_ts,120000);assert.equal(Object.keys(a.trigger_health.meters).length,11);assert.equal(a.trigger_health.meters['TX-/1/FWDPWR'].value,0);assert(a.trigger_health.source_health_seq<a.trigger_seq);assert(!Object.hasOwn(a,'records'));assert.equal(a.provenance.command_origin,'UNKNOWN');assert.equal(a.provenance.trigger_origin,'UNKNOWN');assert.equal(a.provenance.client_ip,null);
 const snapshot=JSON.stringify(a.trigger_health);f.d.health({});assert.equal(JSON.stringify(a.trigger_health),snapshot);
});
test('PRE_GAPS','INCOMPLETE NOT FABRICATED',()=>{const f=fixture();for(let i=0;i<125;i++)f.step(1000);f.d.data.metrics.dropped_by_limit=1;f.cycle(true);f.cycle();f.cycle();assert.equal(f.incident().pre_trigger_complete,false);});
test('STARTUP_NO_HEALTH_SNAPSHOT','11 EXPLICIT UNKNOWN METERS',()=>{const f=fixture();f.start(true);f.finish();f.start();f.finish();f.start();f.finish();const a=f.incident();assert.equal(Object.keys(a.trigger_health.meters).length,11);assert.equal(a.trigger_health.meters['RAD/3/MAINFAN'].value,null);});
test('INPUT_ORDER_DURING_POST','INCOMPLETE NOT FALSE COMPLETE',()=>{const f=fixture();f.cycle(true);f.cycle();f.cycle();f.d.incidentDetector.consume({seq:1,record_type:'HEALTH',ts_ms:0});assert.equal(f.incident().post_capture_state,'INCOMPLETE');assert.equal(f.incident().post_incomplete_reason,'INPUT_ORDER_VIOLATION');});
test('STALE_UNKNOWN_TUNE','NO INCIDENT',()=>{const f=fixture();f.d.tune(1);f.step(15000);for(let i=0;i<3;i++)f.cycle();f.noIncident();});
test('CANCELLED_TUNE_AND_DUPLICATE_RX','NO COMPLETED CYCLE',()=>{const f=fixture();for(let i=0;i<4;i++){f.d.tune(1);f.d.tune(0);}f.noIncident();assert.equal(f.d.data.incidentDetector.candidate_cycle_count,0);});
test('SLOW_FIRST_CYCLE','NO INCIDENT WITH START OUTSIDE WINDOW',()=>{const f=fixture();f.start(true);f.step(5100);f.finish();f.cycle();f.cycle();f.noIncident();});
test('ACTIVATION_DURING_TX_IS_NOT_REACTIVATION','NO INCIDENT',()=>{const f=fixture();f.cycle(true,true);for(let i=0;i<2;i++){f.start();f.d.tune(1);f.finish(true);}f.noIncident();});
test('FIVE_SECOND_BOUNDARY','INCLUSIVE AT 5000 MS',()=>{
 let mono=0,seq=0;const d=new IncidentDetector({runId:'test',mono:()=>mono});
 const event=(state,time)=>{mono=time;d.consume({seq:++seq,ts_ms:time,record_type:'DIAG_STATE_CHANGE',new_state:state,tune_value:1,tune_fresh:true});};
 for(const [s,e]of [[0,100],[2000,2100],[4900,5000]]){event('TRANSMITTING',s);event('RETURN_TO_RX',e);event('RADIO_RX',e);}
 assert.equal(d.data.incident_counter,1);
});
test('BOUNDED_METADATA_UNDER_STRESS','256 MAX; OVERFLOW EXPLICIT',()=>{
 const f=fixture();for(let i=0;i<125;i++)f.step(1000);f.cycle(true);f.cycle();f.cycle();
 // Pure producer-shaped states, maximal synthetic density (not radio stimulation).
 const detector=f.d.incidentDetector;let seq=f.d.data.seq;
 for(let i=0;i<600;i++)for(const state of ['TRANSMITTING','RETURN_TO_RX','RADIO_RX'])detector.consume({seq:++seq,ts_ms:1800000000000+f.now(),record_type:'DIAG_STATE_CHANGE',new_state:state,tune_value:1,tune_fresh:true});
 assert(detector.data.recent_cycles.length<=MAX_CYCLES);assert(detector.data.active_incident.cycles.length<=MAX_CYCLES);assert(detector.data.detector_metrics.candidate_overflow>0);assert(detector.data.active_incident.cycle_metadata_dropped>0);assert.equal(detector.data.incident_counter,1);
 assert.equal(DEFAULTS.retentionMs,240000);assert.equal(DEFAULTS.maxRecords,12000);assert.equal(DEFAULTS.rxHz,1);assert.equal(DEFAULTS.txHz,5);
});
test('REAL_V423_NATURAL_OSCILLATION_REPLAY','ONE INCIDENT; 3 CYCLES/792 MS; 38 TOTAL',()=>{
 const saved=JSON.parse(fs.readFileSync('diagnostics/fixtures/stage2-v423-natural-oscillation.json'));let mono=0,previous=0,currentSeq=0;const emitted=[];
 const detector=new IncidentDetector({runId:saved.run_id,mono:()=>mono,history:()=>saved.records.filter(r=>r.seq<=currentSeq).reverse(),emit:r=>emitted.push(r)});
 for(const r of saved.records){currentSeq=r.seq;assert(r.ts_ms>=previous);previous=r.ts_ms;mono=r.ts_ms-saved.records[0].ts_ms;const before=JSON.stringify(r);detector.consume(r);assert.equal(JSON.stringify(r),before);}
 assert.equal(emitted.length,1);assert.equal(emitted[0].trigger_seq,18264);assert.equal(emitted[0].cycle_count,3);assert.equal(emitted[0].duration_ms,792);
 const incident=detector.data.active_incident;assert.equal(incident.cycle_count,38);assert.equal(incident.first_abnormal_seq,18227);assert.equal(incident.precursor_fault,'TX_FAULT');assert.equal(incident.precursor_fault_seq,18185);assert.equal(incident.precursor_fault_age_ms,5993);assert.equal(incident.precursor_fault_confidence,'DIRECT');assert.equal(incident.precursor_fault_reason,'UNKNOWN');assert.equal(incident.precursor_fault_active_at_trigger,false);assert.equal(incident.precursor_fault_cleared_seq,18202);assert.equal(incident.first_abnormal_event,'RX_RETURN_WHILE_TUNE_ACTIVE');assert.equal(incident.tune_active_during_rx,true);assert.equal(incident.tune_reactivated,true);assert.equal(incident.provenance.command_origin,'UNKNOWN');
 assert(saved.records.some(r=>r.seq===18185&&r.record_type==='INTERLOCK_STATE'&&r.new_value==='TX_FAULT'));assert.equal(incident.post_trigger_complete,false);
});
test('PRECURSOR_REASON_CLEARANCE_AND_FIRST_ABNORMAL','FAULT CONTEXT DISTINCT; REASON LINKED',()=>{
 const f=fixture();f.d.interlock({state:'TX_FAULT',reason:'SYNTHETIC_OFFLINE_REASON'});const fault=f.d.records().find(r=>r.record_type==='INTERLOCK_STATE'&&r.new_value==='TX_FAULT');f.canon('RX','READY');f.cycle(true);f.cycle();f.cycle();const a=f.incident();assert.equal(a.precursor_fault_seq,fault.seq);assert.equal(a.precursor_fault_confidence,'DIRECT');assert.equal(a.precursor_fault_reason,'SYNTHETIC_OFFLINE_REASON');assert(a.precursor_fault_reason_seq>fault.seq);assert.equal(a.precursor_fault_active_at_trigger,false);assert.equal(a.first_abnormal_event,'RX_RETURN_WHILE_TUNE_ACTIVE');assert(a.first_abnormal_seq>a.precursor_fault_seq);
});
test('PRECURSOR_RESET_ON_DISCONNECT','OLD EPOCH NOT ATTRIBUTED',()=>{
 const f=fixture();f.d.interlock({state:'TX_FAULT'});f.d.connection(false);f.canon('RX','READY');f.d.tune(0);f.cycle(true);f.cycle();f.cycle();assert.equal(f.incident().precursor_fault,'UNKNOWN');assert.equal(f.incident().precursor_fault_seq,null);
});
test('PRECURSOR_DERIVED_OR_UNKNOWN_SOURCE','NO DIRECT PROMOTION',()=>{
 let now=0,seq=0;const d=new IncidentDetector({runId:'SYNTHETIC',mono:()=>now});
 d.consume({record_type:'INTERLOCK_STATE',source:'UNKNOWN_SOURCE',field:'state',new_value:'TX_FAULT',seq:++seq,ts_ms:0});
 d.consume({record_type:'INTERLOCK_STATE',new_value:'READY',seq:++seq,ts_ms:1});
 for(let i=0;i<3;i++)for(const state of ['TRANSMITTING','RETURN_TO_RX','RADIO_RX']){now++;d.consume({record_type:'DIAG_STATE_CHANGE',new_state:state,seq:++seq,ts_ms:now,tune_value:1,tune_fresh:true});}
 assert.equal(d.data.active_incident.precursor_fault_confidence,'UNKNOWN');assert.equal(d.data.active_incident.provenance.command_origin,'UNKNOWN');
});
test('PRECURSOR_OUTSIDE_10S','OLD FAULT EXCLUDED',()=>{
 const f=fixture();f.d.interlock({state:'TX_FAULT'});f.canon('RX','READY');f.step(10001);f.cycle(true);f.cycle();f.cycle();assert.equal(f.incident().precursor_fault,'UNKNOWN');assert.equal(f.incident().precursor_fault_seq,null);
});
test('PRECURSOR_CONFIGURABLE_BOUNDED_LOOKBACK','5S EXCLUDES; 10S INCLUDES; INVALID REJECTED',()=>{
 const saved=JSON.parse(fs.readFileSync('diagnostics/fixtures/stage2-v423-natural-oscillation.json'));
 for(const ms of [5000,10000]){let now=0,currentSeq=0;const d=new IncidentDetector({runId:saved.run_id,mono:()=>now,precursorLookbackMs:ms,history:()=>saved.records.filter(r=>r.seq<=currentSeq).reverse()});for(const r of saved.records){currentSeq=r.seq;now=r.ts_ms-saved.records[0].ts_ms;d.consume(r);}assert.equal(d.data.active_incident.precursor_fault,ms===10000?'TX_FAULT':'UNKNOWN');}
 assert.throws(()=>new IncidentDetector({precursorLookbackMs:0}));assert.throws(()=>new IncidentDetector({precursorLookbackMs:240001}));
});
test('PRECURSOR_EXPLICIT_DERIVED_NOT_DIRECT','DERIVED SOURCE EXCLUDED',()=>{
 const f=fixture();f.d.append('INTERLOCK_STATE','au510m_live_state','state',null,'TX_FAULT',{observation_confidence:'DERIVED'});f.canon('RX','READY');f.cycle(true);f.cycle();f.cycle();assert.equal(f.incident().precursor_fault,'UNKNOWN');assert.equal(f.incident().precursor_fault_confidence,'UNKNOWN');
});
if(process.argv.includes('--report'))fs.writeFileSync('/tmp/au510m-stage3-final-v424/offline-results.json',JSON.stringify(results,null,2));
console.log(`PASS: ${results.length} deterministic Stage-3 cases; state machine and radio inputs untouched.`);
