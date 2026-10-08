import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {IncidentDetector}=require('../diagnostics/au510m-incident-detector.cjs');
const evidencePath='docs/measurements/au510m-natural-oscillation-2026-10-07.json';
const fingerprint=()=>createHash('sha256').update(fs.readFileSync(evidencePath)).digest('hex');
const before=fingerprint();assert.equal(before,'6f35714df7e0ae2f4a1895664a6bf4a38dea5bcf6720fe36470a8951b23a3dde');
const manifest=JSON.parse(fs.readFileSync(evidencePath));
const fixture=JSON.parse(fs.readFileSync(manifest.fixture));
let mono=0,currentSeq=0,previous=-Infinity;const triggers=[];
function* history(ms){for(let i=fixture.records.length-1;i>=0;i--){const r=fixture.records[i];if(r.seq>currentSeq)continue;if(previous-r.ts_ms>ms)break;yield r;}}
const detector=new IncidentDetector({runId:fixture.run_id,mono:()=>mono,history,emit:r=>triggers.push(r)});
for(const r of fixture.records){assert(r.ts_ms>=previous);previous=r.ts_ms;currentSeq=r.seq;mono=r.ts_ms-fixture.records[0].ts_ms;const original=JSON.stringify(r);detector.consume(r);assert.equal(JSON.stringify(r),original);}
const incident=detector.data.active_incident??detector.data.last_incident;
assert.equal(triggers.length,1);assert.equal(triggers[0].incident_type,'TUNE_RX_OSCILLATION');assert.equal(triggers[0].cycle_count,3);assert.equal(triggers[0].duration_ms,792);
assert.equal(incident.cycle_count,38);assert.equal(incident.precursor_fault,'TX_FAULT');assert.equal(incident.precursor_fault_age_ms,5993);assert.equal(incident.precursor_fault_confidence,'DIRECT');assert.equal(incident.precursor_fault_reason,'UNKNOWN');assert.equal(incident.first_abnormal_event,'RX_RETURN_WHILE_TUNE_ACTIVE');assert.equal(incident.provenance.command_origin,'UNKNOWN');assert.equal(fingerprint(),before);
const result={replay_type:'OFFLINE_REPLAY_OF_IMMUTABLE_MANIFEST_AND_LINKED_REAL_FIXTURE',evidence_sha_before:before,evidence_sha_after:fingerprint(),time_basis:'RECORDED_NONDECREASING_WALL_CLOCK; ORIGINAL_MONOTONIC_TIMES_UNAVAILABLE',incident_count:triggers.length,trigger:triggers[0],trigger_seq:incident.trigger_seq,precursor_fault:incident.precursor_fault,precursor_fault_seq:incident.precursor_fault_seq,precursor_fault_age_ms:incident.precursor_fault_age_ms,precursor_fault_confidence:incident.precursor_fault_confidence,precursor_fault_reason:incident.precursor_fault_reason,precursor_cleared_seq:incident.precursor_fault_cleared_seq,first_abnormal_event:incident.first_abnormal_event,first_abnormal_seq:incident.first_abnormal_seq,cycles:incident.cycle_count,causal_client:'UNKNOWN',historical_health:'UNKNOWN; VALUES WERE NOT IN THE COMPACT CAPTURE',full_post_window:'NOT_CAPTURED'};
if(process.argv.includes('--report'))fs.writeFileSync('/tmp/au510m-stage3-final-v424/natural-replay.json',JSON.stringify(result,null,2));
console.log('PASS: natural evidence SHA preserved; 1 incident; 3 cycles/792 ms; TX_FAULT DIRECT/5993 ms/UNKNOWN reason; first RX_RETURN_WHILE_TUNE_ACTIVE; no causal client.');
