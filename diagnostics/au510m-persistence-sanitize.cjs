'use strict';
// Positive field lists shared by SQLite and JSONL. Never serialize source objects wholesale.
const HEALTH={FWDPWR_W:'TX-/1/FWDPWR',REFPWR_W:'TX-/2/REFPWR',SWR:'TX-/3/SWR',PATEMP_C:'TX-/4/PATEMP',PAFETQ1TEMP_C:'RAD/8/PAFETQ1TEMP',PAFETQ2TEMP_C:'RAD/9/PAFETQ2TEMP',PACURRENT_A:'RAD/300/PACURRENT',PAEFF_PERCENT:'TX-/6/PAEFF',V13_8A:'RAD/334/+13.8A',V13_8B:'RAD/0/+13.8B',MAINFAN:'RAD/3/MAINFAN'};
const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const integer=v=>Number.isSafeInteger(v)?v:null;
const bit=v=>v===true||v===1?1:v===false||v===0?0:null;
function text(v){if(typeof v!=='string'||v==='UNKNOWN'||v==='--'||v.length>256)return null;
 if(/(?:file:|https?:|\/(?:tmp|root|home|mnt)\/|\b(?:fc|fd)[0-9a-f]{2}:|fe80:|\b\d{1,3}(?:\.\d{1,3}){3}\b|\b0x[0-9a-f]+\b|[0-9a-f]{8}-[0-9a-f-]{27,}|[0-9a-f]{24,}|(?:^|\s)(?:\/|[a-z]:\\)|[\w.-]+\.(?:local|lan|box|com|net|org)\b|@|[\r\n\x00])/i.test(v))return null;
 return v;
}
const confidence=v=>['DIRECT','CORRELATED','INFERRED','UNKNOWN'].includes(v)?v:'UNKNOWN';
const stateConfidence=v=>['DIRECT','DERIVED','UNKNOWN'].includes(v)?v:'UNKNOWN';
const iso=v=>number(v)!==null&&Number.isFinite(new Date(v).getTime())?new Date(v).toISOString():null;
function frequency(r){if(number(r.frequency_hz)!==null)return r.frequency_hz;const m=typeof r.frequency==='string'?/^([0-9]+(?:\.[0-9]+)?) MHz$/.exec(r.frequency):null;return m?Number(m[1])*1e6:null;}
function common(r){return {ts:iso(r.ts_ms),ts_ms:integer(r.ts_ms),seq:integer(r.seq),frequency_hz:frequency(r),mode:text(r.mode),active_slice:text(r.active_slice),interlock_state:text(r.interlock_state),interlock_reason:text(r.interlock_reason),tune_value:r.tune_value===0||r.tune_value===1?r.tune_value:null,tune_fresh:bit(r.tune_fresh)};}
function record(r){if(!r||!Number.isSafeInteger(r.seq)||!Number.isSafeInteger(r.ts_ms))return null;
 const c=common(r);if(r.record_type==='HEALTH')return {kind:'health',...c,...Object.fromEntries(Object.entries(HEALTH).map(([k,t])=>[k,r.meters?.[t]?.quality==='FRESH'?number(r.meters[t].value):null]))};
 const scalar=v=>typeof v==='string'?(/^[A-Z][A-Z0-9_ ,:.-]*$/.test(v)?text(v):null):typeof v==='number'?String(number(v)??''):typeof v==='boolean'?String(v):null;
 const client=['SmartSDR','AetherSDR','FRStack','N1MM+','WSJT-X','Maestro','SmartControl','Node-RED','Stream Deck'].includes(r.client_name)?r.client_name:null;
 return {kind:'event',...c,record_type:text(r.record_type),old_state:text(r.old_state),new_state:text(r.new_state),state_confidence:stateConfidence(r.state_confidence??r.observation_confidence),state_reason:text(r.state_reason),source_event_seq:integer(r.source_event_seq),derived_from_seq:integer(r.derived_from_seq),tx_state:text(r.tx_state),event_name:text(r.field),event_value:scalar(r.new_value),origin_confidence:confidence(r.origin_confidence),trigger_origin:text(r.trigger_origin),command_origin:text(r.command_origin),client_name:client,source:text(r.source)};
}
function incident(a,id){const p=a.provenance??{};return {incident_id:id,incident_type:text(a.incident_type),trigger_ts:iso(a.trigger_ts),trigger_ts_ms:integer(a.trigger_ts),trigger_seq:integer(a.trigger_seq),window_start_ts:iso(a.trigger_ts-120000),window_end_ts:iso(a.trigger_ts+120000),cycle_count:integer(a.cycle_count),duration_ms:number(a.duration_ms),first_cycle_seq:integer(a.first_cycle_seq),last_cycle_seq:integer(a.last_cycle_seq),first_abnormal_event:text(a.first_abnormal_event),first_abnormal_seq:integer(a.first_abnormal_seq),precursor_fault:text(a.precursor_fault),precursor_fault_ts:iso(a.precursor_fault_ts),precursor_fault_seq:integer(a.precursor_fault_seq),precursor_fault_age_ms:number(a.precursor_fault_age_ms),precursor_fault_source:text(a.precursor_fault_source?.source_node),precursor_fault_reason:text(a.precursor_fault_reason),precursor_fault_confidence:confidence(a.precursor_fault_confidence),frequency_hz:frequency(a),mode:text(a.mode),active_slice:text(a.active_slice),tune_active_at_trigger:bit(a.tune_active_at_trigger),tune_fresh_at_trigger:bit(a.tune_fresh_at_trigger),trigger_origin:text(p.trigger_origin),command_origin:text(p.command_origin),origin_confidence:confidence(p.origin_confidence),post_capture_state:'COLLECTING',pre_trigger_complete:bit(a.pre_trigger_complete),post_trigger_complete:0,created_at:iso(a.trigger_ts),completed_at:null,pre_window_available_seconds:number(a.pre_window_available_seconds),dropped_records:0,incomplete_reason:null};}
module.exports={HEALTH,number,integer,bit,text,iso,record,incident};
