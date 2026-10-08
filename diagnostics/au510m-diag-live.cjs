'use strict';
// Read-only projection. State, health validity and incident detection remain with their owners.
const vm=require('node:vm');
const {HEALTH,text}=require('./au510m-persistence-sanitize.cjs');
const LABELS={FWDPWR_W:['PWR','W'],REFPWR_W:['REF','W'],SWR:['SWR',''],PATEMP_C:['PA TEMP','°C'],PAFETQ1TEMP_C:['FET1','°C'],PAFETQ2TEMP_C:['FET2','°C'],PACURRENT_A:['PA CURRENT','A'],PAEFF_PERCENT:['PA EFF','%'],V13_8A:['13.8A','V'],V13_8B:['13.8B','V'],MAINFAN:['FAN','RPM']};
const finite=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const safe=v=>text(v)??null;
const fresh=(at,now,limit)=>finite(at)!==null&&at>0&&now>=at&&now-at<limit;
function createProjector(meterTemplate){
 // Invoke the existing trusted METER computed property unchanged; never duplicate its reducer.
 // Only component options are evaluated: no data(), lifecycle or other methods are called.
 const script=meterTemplate.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 if(!script||!/^\s*export default\s*\{/.test(script))throw Error('CANONICAL_METER_OPTIONS_UNAVAILABLE');
 const options=vm.runInNewContext('('+script.replace(/^\s*export default/,'')+')',{}, {timeout:1000});
 const canonicalFault=options.computed.paFaultStatus,canonicalFresh=options.methods.freshForwardTimestamp;
 if(typeof canonicalFault!=='function'||typeof canonicalFresh!=='function')throw Error('CANONICAL_FAULT_UNAVAILABLE');
 return function project({data,paFault,meters,radio,now=Date.now()}={}){
  const d=data??{},m=d.metrics??{},s=d.latestState??{},t=d.tuneCandidate??{};
  const connected=d.connectionState==='CONNECTED';
  const available=connected&&fresh(m.last_health_ms,now,d.config?.meterFreshMs??15000)&&m.logger_status==='RUNNING';
  const payload={serverNow:now,paFault,online:meters?.online,timestamp:meters?.timestamp,radio:{connected:radio?.connected,at:radio?.at}};
  const view={msg:{payload},serverReceivedAt:now,liveClock:now,freshForwardTimestamp:canonicalFresh};
  const fault=canonicalFault.call(view);
  const reason=available&&paFault?.state===s.interlock_state&&fresh(paFault.reasonSeen,now,15000)?safe(paFault.reason):null;
  const active=finite(m.persistence_active_captures);
  return {kind:'au510m-diag-live',serverNow:now,available,
   connection:connected?(available?'CONNECTED':'STALE'):safe(d.connectionState)??'UNKNOWN',
   diagState:available?safe(d.stateMachine?.diag_state)??'UNKNOWN':'UNKNOWN',
   diagConfidence:available?safe(d.stateMachine?.diag_state_confidence)??'UNKNOWN':'UNKNOWN',
   diagReason:available?safe(d.stateMachine?.diag_state_reason):null,
   paFault:available?fault.value:'UNKNOWN',paFaultTone:available?fault.tone:'unknown',
   tune:available&&t.tune_fresh===true&&(t.tune_value===0||t.tune_value===1)?t.tune_value:null,
   tuneFresh:available&&t.tune_fresh===true,tuneAgeMs:finite(t.tune_age_ms),
   interlock:available?safe(s.interlock_state):null,interlockReason:reason,
   slice:available?safe(s.active_slice):null,frequency:available?safe(s.frequency):null,mode:available?safe(s.mode):null,
   incident:{state:active===null?'UNKNOWN':active>0?'COLLECTING':'NO ACTIVE CAPTURE',type:active>0?safe(m.last_incident_type):null,activeCaptures:active},
   sqlite:{lastWrite:finite(m.sqlite_last_write_ts),state:safe(m.sqlite_status)??'UNKNOWN',queue:finite(m.sqlite_queue_records),dropped:finite(m.sqlite_dropped_records)},
   ring:{state:safe(m.logger_status)??'UNKNOWN',count:finite(m.record_count),max:finite(d.config?.maxRecords),span:finite(m.ring_span_seconds),limitDrops:finite(m.dropped_by_limit),memoryDrops:finite(m.dropped_by_memory),sourceOverflow:finite(m.source_overflow),errors:finite(m.errors)},
   health:Object.entries(HEALTH).map(([key,topic])=>{const sample=d.latestHealth?.[topic];return {key,label:LABELS[key][0],unit:LABELS[key][1],value:available&&(!['FWDPWR_W','REFPWR_W','SWR'].includes(key)||s.tx_state==='TX')&&sample?.quality==='FRESH'&&fresh(sample.seen,now,d.config?.meterFreshMs??15000)?finite(sample.value):null};})};
 };
}
module.exports={createProjector};
