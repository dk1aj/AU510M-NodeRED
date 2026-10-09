'use strict';
// Export projection extends the central persistence sanitizer; source objects are never serialized.
const S=require('./au510m-persistence-sanitize.cjs');
const {ID}=require('./au510m-history-query.cjs');
const EXPORT_ID=/^[a-f0-9]{32}$/;
const FILE=/^AU510M-\d{8}-\d{6}-[A-Z][A-Z0-9_]{0,63}-[a-f0-9]{32}\.zip$/;
const incidentFields='incident_id incident_type trigger_ts trigger_ts_ms trigger_seq cycle_count duration_ms frequency_hz mode active_slice precursor_fault precursor_fault_ts precursor_fault_age_ms precursor_fault_confidence first_abnormal_event first_abnormal_seq tune_active_at_trigger tune_fresh_at_trigger pre_trigger_complete post_trigger_complete post_capture_state completed_at pre_window_available_seconds dropped_records incomplete_reason trigger_origin command_origin origin_confidence'.split(' ');
const common='ts ts_ms seq frequency_hz mode active_slice interlock_state interlock_reason tune_value tune_fresh'.split(' ');
const eventFields=[...common,...'record_type old_state new_state state_confidence state_reason tx_state event_name event_value origin_confidence trigger_origin command_origin client_name'.split(' ')];
const healthFields=[...common,...Object.keys(S.HEALTH)];
const ints=new Set('ts_ms seq trigger_ts_ms trigger_seq cycle_count first_abnormal_seq dropped_records'.split(' '));
const nums=new Set(['duration_ms','frequency_hz','precursor_fault_age_ms','pre_window_available_seconds',...Object.keys(S.HEALTH)]);
const bits=new Set('tune_value tune_fresh tune_active_at_trigger tune_fresh_at_trigger pre_trigger_complete post_trigger_complete'.split(' '));
const times=new Set('ts trigger_ts precursor_fault_ts completed_at'.split(' '));
const clients=new Set(['SmartSDR','AetherSDR','FRStack','N1MM+','WSJT-X','Maestro','SmartControl','Node-RED','Stream Deck']);
function project(row,fields){return Object.fromEntries(fields.map(k=>{
 const v=row[k];let value;
 if(k==='incident_id')value=typeof v==='string'&&ID.test(v)?v:null;
 else if(k.endsWith('confidence'))value=(k==='state_confidence'?['DIRECT','DERIVED','UNKNOWN']:['DIRECT','CORRELATED','INFERRED','UNKNOWN']).includes(v)?v:'UNKNOWN';
 else if(ints.has(k))value=S.integer(v);
 else if(nums.has(k))value=S.number(v);
 else if(bits.has(k))value=S.bit(v);
 else if(times.has(k))value=typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
 else if(k==='client_name')value=clients.has(v)?v:null;
 else if(['trigger_origin','command_origin'].includes(k))value=typeof v==='string'&&/^[A-Z][A-Z0-9_+ -]{0,63}$/.test(v)?S.text(v)??'UNKNOWN':'UNKNOWN';
 else value=S.text(v);
 return [k,value];
}));}
module.exports={ID,EXPORT_ID,FILE,incidentFields,eventFields,healthFields,project};
