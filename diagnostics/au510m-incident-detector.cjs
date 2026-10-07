'use strict';
// Stage 3: consume existing records only; no radio, timer or file access; bounded history lookup only at trigger.
const WINDOW_MS=5000,POST_MS=120000,MAX_CYCLES=256;
class IncidentDetector {
 constructor({runId,mono=()=>performance.now(),boundary=()=>({}),health=()=>({}),topics=[],history=()=>[],precursorLookbackMs=10000,emit=()=>{},metrics={}}={}){
  this.runId=runId;this.mono=mono;this.boundary=boundary;this.health=health;this.topics=topics;this.emit=emit;this.metrics=metrics;
  if(!Number.isFinite(precursorLookbackMs)||precursorLookbackMs<=0||precursorLookbackMs>240000)throw Error('Precursor lookback must be >0 and <=240000 ms');
  this.history=history;this.precursorLookbackMs=precursorLookbackMs;this.epochStartSeq=0;
  this.cycle=null;this.lastRx=null;this.lastSeq=0;
  this.data={config:{precursor_lookback_ms:precursorLookbackMs},recent_cycles:[],candidate_window_start:null,candidate_cycle_count:0,last_cycle_end_ms:null,
   active_incident:null,last_incident:null,incident_counter:0,detector_metrics:{candidate_overflow:0,cycle_rejections:0,input_order_errors:0}};
  Object.assign(metrics,{incident_detector_status:'RUNNING',candidate_cycle_count:0,active_incident_id:null,
   total_incidents:0,last_incident_ts:null,last_incident_type:null,last_incident_cycles:0,last_precursor_fault:'UNKNOWN'});
 }
 tune(r){return {value:r.tune_fresh===true&&(r.tune_value===0||r.tune_value===1)?r.tune_value:'UNKNOWN',fresh:r.tune_fresh===true&&(r.tune_value===0||r.tune_value===1)};}
 active(t){return t?.fresh===true&&t.value===1;}
 clearCandidates(){this.cycle=null;this.lastRx=null;this.data.recent_cycles.length=0;this.updateCandidates();}
 updateCandidates(){const d=this.data;d.candidate_cycle_count=d.recent_cycles.length;d.candidate_window_start=d.recent_cycles[0]?.start_ts??null;this.metrics.candidate_cycle_count=d.candidate_cycle_count;}
 prune(now){const a=this.data.recent_cycles;while(a.length&&now-a[0].start_mono>WINDOW_MS)a.shift();this.updateCandidates();}
 advance(now,wallTs){
  this.prune(now);const a=this.data.active_incident;if(!a)return;
  if(now-a._last_cycle_mono>=WINDOW_MS)a.oscillation_status='QUIET';
  if(now>=a._deadline_mono){a.post_capture_state='COMPLETE';a.post_trigger_complete=true;a.post_completion_observed_ts=wallTs;this.finish();}
 }
 finish(){const d=this.data,a=d.active_incident;if(!a)return;d.last_incident=a;d.active_incident=null;this.metrics.active_incident_id=null;}
 interrupt(reason,r){const a=this.data.active_incident;if(a){a.post_capture_state='INCOMPLETE';a.post_trigger_complete=false;a.post_incomplete_reason=reason;a.post_interruption_seq=r?.seq??null;this.finish();}this.clearCandidates();}
 close(){this.interrupt('LOGGER_STOP_OR_RUNTIME_REDEPLOY');this.metrics.incident_detector_status='STOPPED';}
 consume(r){
  if(!r||!Number.isSafeInteger(r.seq))return;
  const now=this.mono();
  if(r.seq<=this.lastSeq){this.data.detector_metrics.input_order_errors++;this.interrupt('INPUT_ORDER_VIOLATION',r);return;}
  this.lastSeq=r.seq;
  // Interrupt takes priority at the deadline; a disconnect never proves full coverage.
  if(['LOGGER_START','RADIO_DISCONNECTED','RADIO_CONNECTED'].includes(r.record_type)){
   this.interrupt(r.record_type,r);this.epochStartSeq=r.seq;this.advance(now,r.ts_ms);return;
  }
  this.advance(now,r.ts_ms);
  const tune=this.tune(r);
  if(r.record_type==='TUNE_CANDIDATE'){
   // A request/intent is not origin evidence. Require an observed fresh 0 -> 1
   // after an actual completed RX return; never treat UNKNOWN -> 1 as reactivation.
   if(this.lastRx&&!this.cycle&&r.seq>this.lastRx.end_seq&&r.old_value===0&&this.active(tune)){
    this.lastRx.tune_reactivated_before_next_cycle=true;this.lastRx.tune_reactivation_seq=r.seq;
    this.lastRx.tune_reactivation_ts=r.ts_ms;
   }
   if(this.lastRx&&!tune.fresh)this.lastRx.tune_reactivated_before_next_cycle='UNKNOWN';
   return;
  }
  if(r.record_type==='TUNE_STALE'||(r.record_type==='HEALTH'&&!tune.fresh)){
   if(this.lastRx&&this.lastRx.tune_reactivated_before_next_cycle!==true)this.lastRx.tune_reactivated_before_next_cycle='UNKNOWN';
  }
  if(r.record_type!=='DIAG_STATE_CHANGE')return;
  const state=r.new_state;
  if(['UNKNOWN','FAULT','INTERLOCK_BLOCKED'].includes(state)){this.clearCandidates();return;}
  if(['TUNE_REQUESTED','TX_REQUESTED','TRANSMITTING'].includes(state)){
   if(!this.cycle){
    this.cycle={start_seq:r.seq,start_ts:r.ts_ms,start_mono:now,transmitted:false,return_seen:false,
     tune_value_at_start:tune.value,tune_fresh_at_start:tune.fresh,
     preceding_cycle_seq:this.lastRx?.end_seq??null,
     tune_reactivated_from_previous:this.lastRx?.tune_reactivated_before_next_cycle??'UNKNOWN',
     preceding_reactivation_seq:this.lastRx?.tune_reactivation_seq??null,
     preceding_reactivation_ts:this.lastRx?.tune_reactivation_ts??null};
   }
   if(state==='TRANSMITTING'){this.cycle.transmitted=true;this.cycle.transmit_seq??=r.seq;}
  }
  if(['UNKEY_REQUESTED','RETURN_TO_RX'].includes(state)&&this.cycle)this.cycle.return_seen=true;
  if(state!=='RADIO_RX'||!this.cycle)return;
  const c=this.cycle;this.cycle=null;
  if(!c.transmitted||!c.return_seen){this.data.detector_metrics.cycle_rejections++;return;}
  Object.assign(c,{end_seq:r.seq,end_ts:r.ts_ms,end_mono:now,
   tune_value_at_rx_return:tune.value,tune_fresh_at_rx_return:tune.fresh,
   tune_active_during_rx:this.active(tune),tune_reactivated_before_next_cycle:tune.fresh?false:'UNKNOWN',
   tune_reactivation_seq:null});
  this.data.last_cycle_end_ms=r.ts_ms;this.lastRx=c;
  if(now-c.start_mono>WINDOW_MS){this.prune(now);return;}
  this.data.recent_cycles.push(c);
  if(this.data.recent_cycles.length>MAX_CYCLES){this.data.recent_cycles.shift();this.data.detector_metrics.candidate_overflow++;}
  this.prune(now);
  const cycles=this.data.recent_cycles;
  // All complete cycles, from first start to last RX return, fit in 5 seconds.
  const qualifying=cycles.length>=3&&(cycles.some(x=>x.tune_active_during_rx)||cycles.some(x=>x.tune_reactivated_from_previous===true&&cycles.some(p=>p.end_seq===x.preceding_cycle_seq)));
  const a=this.data.active_incident;
  if(a){
   if(qualifying){this.extend(a,c,r,now);}
   return;
  }
  if(qualifying)this.trigger(cycles,r,now);
 }
 precursor(first,r){
  // Two bounded reverse traversals of the existing ring only at a trigger.
  // No per-event scan, historical copy, extra fault buffer or indefinite cache.
  let f=null;
  for(const event of this.history(this.precursorLookbackMs)){
   if(event.seq<=this.epochStartSeq)break;
   const age=r.ts_ms-event.ts_ms;
   if(age<0||age>this.precursorLookbackMs||event.seq>=first.start_seq)continue;
   const direct=event.observation_confidence==='DIRECT'||(event.observation_confidence===undefined&&
    event.source==='au510m_live_state'&&event.field==='state');
   if(event.record_type==='INTERLOCK_STATE'&&direct&&['TX_FAULT','TIMEOUT','STUCK_INPUT'].includes(event.new_value)){f=event;break;}
  }
  if(!f)return {precursor_fault:'UNKNOWN',precursor_fault_ts:null,precursor_fault_seq:null,
   precursor_fault_age_ms:null,precursor_fault_source:null,precursor_fault_reason:'UNKNOWN',
   precursor_fault_confidence:'UNKNOWN',precursor_fault_observed_before_incident:'UNKNOWN',
   precursor_fault_active_at_trigger:'UNKNOWN',precursor_lookback_ms:this.precursorLookbackMs};
  let cleared=null,reason=null;
  for(const event of this.history(this.precursorLookbackMs)){
   if(event.seq<=f.seq)break;if(event.seq>r.seq)continue;
   if(event.record_type==='INTERLOCK_STATE'&&event.new_value!==f.new_value){
    cleared=event;if(reason&&reason.seq>=cleared.seq)reason=null;
   }
   if(event.record_type==='INTERLOCK_FIELD'&&event.field==='reason'&&event.interlock_state===f.new_value&&
    (!cleared||event.seq<cleared.seq)&&!reason)reason=event;
  }
  return {precursor_fault:f.new_value,precursor_fault_ts:f.ts_ms,precursor_fault_seq:f.seq,
   precursor_fault_age_ms:r.ts_ms-f.ts_ms,precursor_fault_source:{source_node:f.source??null,
    record_type:f.record_type,field:f.field??null,raw_source:f.raw_source??null,
    raw_source_availability:f.raw_source?'PRESERVED':'NOT_PRESERVED_IN_COMPACT_CAPTURE',
    confidence_basis:f.observation_confidence==='DIRECT'?'EXPLICIT_DIRECT_OBSERVATION':'STAGE1_DIRECT_INTERLOCK_EVENT_CONTRACT'},
   precursor_fault_reason:reason?.new_value??'UNKNOWN',precursor_fault_reason_seq:reason?.seq??null,
   precursor_fault_confidence:'DIRECT',precursor_fault_observed_before_incident:true,
   precursor_fault_active_at_trigger:!cleared,precursor_fault_cleared_ts:cleared?.ts_ms??null,
   precursor_fault_cleared_seq:cleared?.seq??null,precursor_lookback_ms:this.precursorLookbackMs,
   precursor_fault_scope:'DIRECT_EVENT_IN_BOUNDED_CURRENT_EPOCH_RING_LOOKBACK',precursor_context_not_causality:true};
 }
 compactCycle(c){return Object.fromEntries(Object.entries(c).filter(([k])=>!k.endsWith('_mono')&&k!=='transmitted'&&k!=='return_seen'));}
 abnormal(cycles){
  const evidence=[];
  for(const c of cycles){
   if(c.tune_active_during_rx)evidence.push({label:'RX_RETURN_WHILE_TUNE_ACTIVE',seq:c.end_seq,ts:c.end_ts});
   if(c.tune_reactivated_from_previous===true&&cycles.some(p=>p.end_seq===c.preceding_cycle_seq))evidence.push({label:'TUNE_REACTIVATED_AFTER_RX',seq:c.preceding_reactivation_seq,ts:c.preceding_reactivation_ts});
  }
  return evidence.sort((a,b)=>a.seq-b.seq)[0]??{label:'UNKNOWN',seq:null,ts:null};
 }
 snapshot(r){
  const meters={},current=this.health();for(const topic of this.topics){const v=current[topic]??{};meters[topic]={value:v.value??null,unit:v.unit??null,quality:v.quality??'UNKNOWN',seen:v.seen??null};}
  return {source_health_seq:this.boundary().latest_health_seq??null,meters,frequency:r.frequency??null,mode:r.mode??null,
   active_slice:r.active_slice??null,interlock_state:r.interlock_state??null,interlock_reason:r.interlock_reason??null,
   tune_value:this.tune(r).value,tune_fresh:this.tune(r).fresh};
 }
 trigger(cycles,r,now){
  const d=this.data,b=this.boundary(),first=cycles[0],bad=this.abnormal(cycles),t=this.tune(r);
  const available=Math.max(0,Math.min(120,(r.ts_ms-(b.oldest_ts??r.ts_ms))/1000,b.oldest_age_seconds??0));
  const gaps=(b.dropped_by_limit??0)+(b.dropped_by_memory??0)+(b.source_overflow??0)+(b.errors??0);
  const origin={trigger_origin:'UNKNOWN',command_origin:'UNKNOWN',origin_confidence:'UNKNOWN',
   trigger_origin_confidence:'UNKNOWN',command_origin_confidence:'UNKNOWN',client_identity_confidence:'UNKNOWN',
   client_name:null,client_handle:null,client_id:null,client_program:null,client_ip:null,intermediary:[],
   availability:'NO_EXPLICIT_COMMAND_TO_PATTERN_LINK',evidence:[]};
  const a={incident_type:'TUNE_RX_OSCILLATION',incident_id:`AU510M-${this.runId}-${++d.incident_counter}`,
   run_id:this.runId,trigger_ts:r.ts_ms,trigger_seq:r.seq,window_start_ts:first.start_ts,
   cycle_count:cycles.length,duration_ms:now-first.start_mono,frequency:r.frequency??null,mode:r.mode??null,
   active_slice:r.active_slice??null,tune_active_at_trigger:this.active(t),tune_fresh_at_trigger:t.fresh,
   first_cycle_seq:first.start_seq,last_cycle_seq:r.seq,first_abnormal_event:bad.label,first_abnormal_seq:bad.seq,
   first_abnormal_ts:bad.ts,provenance:origin,...this.precursor(first,r),
   pre_trigger_from_ts:r.ts_ms-120000,pre_trigger_to_ts:r.ts_ms,pre_trigger_complete:available>=120&&gaps===0,
   pre_window_available_seconds:available,pre_reference:{run_id:this.runId,oldest_seq:b.oldest_seq??null,
    newest_seq:b.newest_seq??r.seq,oldest_ts:b.oldest_ts??null,dropped_by_age:b.dropped_by_age??0,
    dropped_by_limit:b.dropped_by_limit??0,dropped_by_memory:b.dropped_by_memory??0,source_overflow:b.source_overflow??0,
    errors:b.errors??0,coverage_confidence:gaps===0?'OBSERVED_BOUNDARY':'INCOMPLETE_OR_UNKNOWN'},
   post_capture_state:'COLLECTING',post_trigger_complete:false,post_trigger_until_ts:r.ts_ms+POST_MS,
   post_semantics:'RAM_LIFECYCLE_ONLY_HISTORY_NOT_PINNED',oscillation_status:'ACTIVE',
   tune_active_during_rx:cycles.some(x=>x.tune_active_during_rx),
   tune_reactivated:cycles.some(x=>x.tune_reactivated_from_previous===true)?true:cycles.some(x=>x.tune_reactivated_before_next_cycle==='UNKNOWN')?'UNKNOWN':false,
   cycles:cycles.map(c=>this.compactCycle(c)),cycle_metadata_dropped:0,
   trigger_health:this.snapshot(r),_first_cycle_mono:first.start_mono,_last_cycle_mono:now,_deadline_mono:now+POST_MS};
  d.active_incident=a;
  Object.assign(this.metrics,{active_incident_id:a.incident_id,total_incidents:d.incident_counter,
   last_incident_ts:a.trigger_ts,last_incident_type:a.incident_type,last_incident_cycles:a.cycle_count,last_precursor_fault:a.precursor_fault});
  this.emit({label:'AU510M INCIDENT',record_type:'INCIDENT_TRIGGER',incident_id:a.incident_id,incident_type:a.incident_type,
   trigger_seq:r.seq,cycle_count:a.cycle_count,duration_ms:a.duration_ms,frequency:a.frequency,mode:a.mode,
   tune_active_during_rx:a.tune_active_during_rx,tune_reactivated:a.tune_reactivated,
   precursor_fault:a.precursor_fault,precursor_fault_age_ms:a.precursor_fault_age_ms,first_abnormal_event:a.first_abnormal_event,origin:'UNKNOWN',origin_confidence:'UNKNOWN'});
 }
 extend(a,c,r,now){
  if(c.end_seq<=a.last_cycle_seq)return;
  a.cycle_count++;a.last_cycle_seq=c.end_seq;a.duration_ms=now-a._first_cycle_mono;
  a._last_cycle_mono=now;a.oscillation_status='ACTIVE';
  a.tune_active_during_rx||=c.tune_active_during_rx;
  if(c.tune_reactivated_from_previous===true)a.tune_reactivated=true;
  a.cycles.push(this.compactCycle(c));if(a.cycles.length>MAX_CYCLES){a.cycles.shift();a.cycle_metadata_dropped++;}
  this.metrics.last_incident_cycles=a.cycle_count;
  // Stage-3 explicit requirement: original-trigger deadline, no retrigger extension.
 }
}
module.exports={IncidentDetector,WINDOW_MS,POST_MS,MAX_CYCLES};
