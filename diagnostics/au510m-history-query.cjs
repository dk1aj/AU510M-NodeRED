'use strict';
// All statements in this reader are SELECT-only; the database is opened read-only by its worker.
const {HEALTH,text,number,integer,bit}=require('./au510m-persistence-sanitize.cjs');
const {DEFAULTS}=require('./au510m-stage1-core.cjs');
const ID=/^AU510M-[A-Za-z0-9-]{1,120}$/;
const safe=v=>text(v)??null;
const label=v=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_+ /.-]{0,95}$/.test(v)?safe(v):null;
const timestamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
const CONFIDENCE=new Set(['DIRECT','CORRELATED','INFERRED','UNKNOWN']);
const capture=v=>['COMPLETE','INCOMPLETE','INTERRUPTED','COLLECTING'].includes(v)?v:'UNKNOWN';
const COLUMNS='incident_id,incident_type,trigger_ts,trigger_ts_ms,cycle_count,precursor_fault,post_capture_state';
const DETAIL=COLUMNS+',trigger_seq,duration_ms,first_abnormal_event,first_abnormal_seq,last_cycle_seq,precursor_fault_ts,precursor_fault_age_ms,frequency_hz,mode,active_slice,tune_active_at_trigger,tune_fresh_at_trigger,trigger_origin,command_origin,origin_confidence,pre_trigger_complete,post_trigger_complete,completed_at';
function summary(row){return {id:ID.test(row.incident_id)?row.incident_id:null,type:label(row.incident_type),time:timestamp(row.trigger_ts),timeMs:integer(row.trigger_ts_ms),cycles:integer(row.cycle_count),precursor:label(row.precursor_fault),capture:capture(row.post_capture_state)};}
function read(db,op,id){
 if(op==='list')return {status:'READY',incidents:db.prepare(`SELECT ${COLUMNS} FROM incidents ORDER BY trigger_ts_ms DESC,incident_id DESC LIMIT 5`).all().map(summary).filter(r=>r.id)};
 if(op!=='detail'||typeof id!=='string'||!ID.test(id))return {status:'INVALID'};
 const row=db.prepare(`SELECT ${DETAIL} FROM incidents WHERE incident_id=? LIMIT 1`).get(id);if(!row)return {status:'NOT_FOUND'};
 const points=db.prepare('SELECT seq,ts_ms FROM state_events WHERE incident_id=? AND seq IN (?,?) ORDER BY ts_ms,seq LIMIT 2').all(id,row.first_abnormal_seq??-1,row.last_cycle_seq??-1);
 const point=seq=>{const value=points.find(p=>p.seq===seq)?.ts_ms;return integer(value)===null?null:new Date(value).toISOString();};
 // The exact trigger snapshot is not persisted. Expose only an identified stored sample, never fill gaps.
 const sample=db.prepare(`SELECT ts_ms,seq,${Object.keys(HEALTH).join(',')} FROM health_samples WHERE incident_id=? AND seq<? AND ts_ms<=? ORDER BY ts_ms DESC,seq DESC LIMIT 1`).get(id,row.trigger_seq??-1,row.trigger_ts_ms??-1);
 const age=sample&&number(row.trigger_ts_ms)!==null?row.trigger_ts_ms-sample.ts_ms:null;
 const usable=age!==null&&age>=0&&age<DEFAULTS.meterFreshMs;
 const state=capture(row.post_capture_state),pre=bit(row.pre_trigger_complete),post=bit(row.post_trigger_complete);
 const terminalLabel=state==='COMPLETE'&&post===1?'CAPTURE COMPLETE':state==='INTERRUPTED'?'CAPTURE INTERRUPTED':state==='INCOMPLETE'||state==='COMPLETE'&&post===0?'CAPTURE INCOMPLETE':state==='COLLECTING'?'CAPTURE COLLECTING':'CAPTURE UNKNOWN';
 const result={...summary(row),durationMs:number(row.duration_ms),frequencyHz:number(row.frequency_hz),mode:label(row.mode),slice:label(row.active_slice),precursorAgeMs:number(row.precursor_fault_age_ms),firstAbnormal:label(row.first_abnormal_event),tuneActive:bit(row.tune_active_at_trigger),tuneFresh:bit(row.tune_fresh_at_trigger),triggerOrigin:label(row.trigger_origin)??'UNKNOWN',commandOrigin:label(row.command_origin)??'UNKNOWN',originConfidence:CONFIDENCE.has(row.origin_confidence)?row.origin_confidence:'UNKNOWN',preComplete:pre,postComplete:post,preState:pre===1?'COMPLETE':pre===0?'PARTIAL':'UNKNOWN',postState:state==='COMPLETE'&&post===0?'INCOMPLETE':state==='COMPLETE'&&post===null?'UNKNOWN':state,
  timeline:[{label:label(row.precursor_fault)??'PRECURSOR --',time:timestamp(row.precursor_fault_ts)},{label:label(row.first_abnormal_event)??'FIRST ABNORMAL --',time:point(row.first_abnormal_seq)},{label:'INCIDENT DETECTED',time:timestamp(row.trigger_ts)},{label:'LAST CYCLE',time:point(row.last_cycle_seq)},{label:terminalLabel,time:state==='COLLECTING'?null:timestamp(row.completed_at)}],
  health:{source:usable?'STORED_SAMPLE_BEFORE_TRIGGER':'UNAVAILABLE',time:usable?new Date(sample.ts_ms).toISOString():null,ageMs:usable?age:null,values:Object.fromEntries(Object.keys(HEALTH).map(key=>[key,usable?number(sample[key]):null]))}};
 return {status:'READY',incident:result};
}
module.exports={read,ID};
