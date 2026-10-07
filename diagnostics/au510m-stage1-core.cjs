'use strict';
const {randomUUID}=require('node:crypto');
const TOPICS=Object.freeze(['TX-/1/FWDPWR','TX-/2/REFPWR','TX-/3/SWR','TX-/4/PATEMP','RAD/8/PAFETQ1TEMP','RAD/9/PAFETQ2TEMP','RAD/300/PACURRENT','TX-/6/PAEFF','RAD/334/+13.8A','RAD/0/+13.8B','RAD/3/MAINFAN']);
const DEFAULTS=Object.freeze({retentionMs:240000,maxRecords:12000,tuneFreshMs:15000,meterFreshMs:15000,rxHz:1,txHz:5,memoryBudgetBytes:50*1024*1024});
class DiagnosticBuffer {
 constructor({version,wall=Date.now,mono=()=>performance.now(),debug=()=>{},config={}}={}){
  this.wall=wall;this.mono=mono;this.debug=debug;this.config={...DEFAULTS,...config};
  if(this.config.maxRecords!==12000||this.config.retentionMs!==240000)throw Error('Stage-1 retention contract must remain 240 s / 12000');
  this.slots=new Array(this.config.maxRecords);this.head=0;this.count=0;this.estimatedBytes=0;this.stateEpoch=0;this.epochWall=wall();this.lastInterlockSeq=null;this.lastInterlockValue=null;this.txSince=null;this.lastHealthMono=mono();this.interlockFields={};this.slices=new Map();this.clients=new Map();this.pending=new Map();
  this.data={run_id:randomUUID(),version,seq:0,config:{...this.config},connectionState:'UNKNOWN',latestState:this.emptyState(),latestHealth:{},tuneCandidate:this.emptyTune(),ringBuffer:{records:this.slots,head:0,count:0},metrics:{logger_status:'RUNNING',connection_status:'UNKNOWN',record_count:0,oldest_age_seconds:0,max_record_count_seen:0,dropped_by_age:0,dropped_by_limit:0,dropped_by_memory:0,estimated_ring_bytes:0,total_events:0,total_health_samples:0,truncated_fields:0,source_overflow:0,pending_expired:0,errors:0,sample_rate_hz:1,current_tx_rx:'UNKNOWN',tune_value:'UNKNOWN',tune_fresh:false,last_event_timestamp:null,uptime_seconds:0,start_wall_ms:wall(),last_health_ms:null,ring_span_seconds:0},startup_mono:mono()};
  this.append('LOGGER_START','au510m_diag','runtime',null,version,{raw_source:{run_id:this.data.run_id,version}});
 }
 emptyState(){return {tx_state:'UNKNOWN',interlock_state:null,frequency:null,mode:null,active_slice:null};}
 emptyTune(){return {tune_value:'UNKNOWN',last_observed_value:null,tune_last_update_ms:null,tune_age_ms:null,tune_fresh:false,tune_source:'transmit.payload.tune',last_record_seq:null};}
 compact(v,depth=0){
  if(v===undefined||v===null)return null;
  if(typeof v==='number')return Number.isFinite(v)?v:null;
  if(typeof v==='boolean')return v;
  if(typeof v==='string'){if(v.length>256){this.data.metrics.truncated_fields++;return v.slice(0,256);}return v;}
  if(depth>=2){this.data.metrics.truncated_fields++;return '[TRUNCATED]';}
  if(Array.isArray(v)){if(v.length>16)this.data.metrics.truncated_fields++;return v.slice(0,16).map(x=>this.compact(x,depth+1));}
  if(typeof v==='object'){const entries=Object.entries(v);if(entries.length>16)this.data.metrics.truncated_fields++;return Object.fromEntries(entries.slice(0,16).map(([k,x])=>[String(k).slice(0,64),this.compact(x,depth+1)]));}
  return null;
 }
 append(record_type,source,field,old_value,new_value,extra={}){
  const t=this.mono(),w=this.wall(),s=this.data.latestState,c=this.data.tuneCandidate;
  const record={ts_wall:new Date(w).toISOString(),ts_ms:w,seq:++this.data.seq,record_type,source:this.compact(source),field:this.compact(field),old_value:this.compact(old_value),new_value:this.compact(new_value),...s,tune_value:c.tune_value,tune_fresh:c.tune_fresh,trigger_origin:'UNKNOWN',trigger_name:null,intermediary:[],command_origin:'UNKNOWN',command_name:null,client_name:null,client_handle:null,client_id:null,client_program:null,client_ip:null,origin_confidence:'UNKNOWN',derived_from_seq:null,raw_source:null,...extra};
  if(record.raw_source)record.raw_source=this.compact(record.raw_source);
  this.add(record,t);this.data.metrics.total_events++;this.data.metrics.last_event_timestamp=w;
  if(['LOGGER_START','RADIO_CONNECTED','RADIO_DISCONNECTED','INTERLOCK_STATE','TX_RX','TUNE_CANDIDATE','TUNE_STALE','SLICE_ADDED','SLICE_REMOVED','DIAGNOSTIC_ERROR'].includes(record_type))this.debug(record);
  return record.seq;
 }
 estimate(v){
  if(v===null||v===undefined)return 8;if(typeof v==='string')return 40+v.length*2;if(typeof v!=='object')return 16;
  if(Array.isArray(v))return 48+v.reduce((n,x)=>n+8+this.estimate(x),0);
  return 64+Object.entries(v).reduce((n,[k,x])=>n+24+k.length*2+this.estimate(x),0);
 }
 evict(metric){const slot=this.slots[this.head];this.estimatedBytes-=slot.bytes;this.slots[this.head]=undefined;this.head=(this.head+1)%this.slots.length;this.count--;this.data.metrics[metric]++;}
 add(record,t=this.mono()){
  this.expire(t);const bytes=this.estimate(record);
  while(this.count&&this.estimatedBytes+bytes>this.config.memoryBudgetBytes)this.evict('dropped_by_memory');
  if(this.count===this.slots.length)this.evict('dropped_by_limit');
  this.slots[(this.head+this.count)%this.slots.length]={mono_ms:t,bytes,record};this.count++;this.estimatedBytes+=bytes;
  this.data.metrics.max_record_count_seen=Math.max(this.data.metrics.max_record_count_seen,this.count);this.updateMetrics(t);
 }
 expire(t=this.mono()){
  while(this.count&&t-this.slots[this.head].mono_ms>this.config.retentionMs)this.evict('dropped_by_age');
 }
 updateMetrics(t=this.mono()){
  const m=this.data.metrics,c=this.data.tuneCandidate;
  m.record_count=this.count;m.estimated_ring_bytes=this.estimatedBytes;m.oldest_age_seconds=this.count?Math.max(0,(t-this.slots[this.head].mono_ms)/1000):0;
  m.ring_span_seconds=this.count>1?(this.slots[(this.head+this.count-1)%this.slots.length].mono_ms-this.slots[this.head].mono_ms)/1000:0;
  m.connection_status=this.data.connectionState;m.current_tx_rx=this.data.latestState.tx_state;m.active_slice=this.data.latestState.active_slice;m.sample_rate_hz=this.rate();m.tune_value=c.tune_value;m.tune_fresh=c.tune_fresh;m.uptime_seconds=(t-this.data.startup_mono)/1000;
  this.data.ringBuffer.head=this.head;this.data.ringBuffer.count=this.count;
 }
 records(){return Array.from({length:this.count},(_,i)=>this.slots[(this.head+i)%this.slots.length].record);}
 connection(connected,source='7fbf2bfc9badc7d3'){
  const next=connected?'CONNECTED':'DISCONNECTED';if(next===this.data.connectionState)return;
  const old=this.data.connectionState;this.data.connectionState=next;this.stateEpoch++;this.epochWall=this.wall();this.data.latestState=this.emptyState();this.data.latestHealth={};this.data.tuneCandidate=this.emptyTune();this.lastInterlockSeq=null;this.lastInterlockValue=null;this.interlockFields={};this.txSince=null;this.slices.clear();this.clients.clear();this.pending.clear();
  this.append(connected?'RADIO_CONNECTED':'RADIO_DISCONNECTED',source,'connection',old,next,{observation_confidence:'DIRECT',raw_source:{kind:'existing_radio_connection',epoch:this.stateEpoch}});
 }
 interlock(payload,source='au510m_live_state',client=null){
  if(this.data.connectionState!=='CONNECTED'||!payload||typeof payload!=='object')return null;
  if(Object.hasOwn(payload,'state')&&payload.state!==this.interlockFields.state){
   // Optional reason/source from a previous state are not an asserted current cause.
   for(const k of ['reason','source','tx_allowed'])if(!Object.hasOwn(payload,k))delete this.interlockFields[k];
  }
  for(const key of ['state','reason','source','tx_allowed'])if(Object.hasOwn(payload,key)){
   const value=this.compact(payload[key]),old=this.interlockFields[key]??null;
   if(JSON.stringify(old)!==JSON.stringify(value)){
    this.interlockFields[key]=value;if(key==='state')this.data.latestState.interlock_state=value;
    const seq=this.append(key==='state'?'INTERLOCK_STATE':'INTERLOCK_FIELD',source,key,old,value,{client_handle:typeof client==='string'?client:null,observation_confidence:'DIRECT',raw_source:{kind:'decoded_interlock',field:key,value}});
    if(key==='state'){this.lastInterlockSeq=seq;this.lastInterlockValue=value;}
   }
  }
  return this.lastInterlockSeq;
 }
 canonical(snapshot,interlockState=null){
  if(!snapshot||typeof snapshot.connected!=='boolean')return;
  this.connection(snapshot.connected,'au510m_live_state');if(!snapshot.connected)return;
  const fields=snapshot.fields||{},s=this.data.latestState;
  if(typeof interlockState==='string'&&(this.lastInterlockSeq===null||this.lastInterlockValue!==interlockState)){
   const old=s.interlock_state;s.interlock_state=interlockState;this.interlockFields.state=interlockState;
   this.lastInterlockSeq=this.append('INTERLOCK_BASELINE','au510m_live_state','state',old,interlockState,{observation_confidence:'DIRECT',raw_source:{kind:'canonical_context_baseline',source_freshness:'CURRENT_CANONICAL_CACHE_NOT_NEW_WIRE_EVENT'}});this.lastInterlockValue=interlockState;
  }
  for(const [key,label]of [['frequency','Frequency'],['mode','Mode'],['active_slice','Active slice'],['tx_state','TX/RX']]){
   const value=fields[label]===undefined||fields[label]==='--'?(key==='tx_state'?'UNKNOWN':null):fields[label];
   if(s[key]===value)continue;const old=s[key];s[key]=value;
   if(key==='tx_state')this.txSince=value==='TX'?this.wall():null;
   this.append(key==='tx_state'?'TX_RX':'CANONICAL_STATE','au510m_live_state',key,old,value,key==='tx_state'?{derivation:'DERIVED_FROM_INTERLOCK',derived_from_seq:this.lastInterlockSeq,raw_source:{kind:'canonical_normalized_tx_rx'}}:{raw_source:{kind:'canonical_processed_field',field:label}});
  }
  this.updateMetrics();
 }
 tune(value,client=null){
  if(this.data.connectionState!=='CONNECTED')return;
  const c=this.data.tuneCandidate,valid=value===0||value===1||value==='0'||value==='1',v=valid?Number(value):'UNKNOWN',old=c.tune_value,wasFresh=c.tune_fresh;
  c.tune_value=v;c.last_observed_value=valid?v:null;c.tune_last_update_ms=this.wall();c._mono=this.mono();c.tune_age_ms=0;c.tune_fresh=valid;
  if(old!==v||wasFresh!==valid)c.last_record_seq=this.append('TUNE_CANDIDATE','7fbf2bfc9badc7d3','transmit.tune',old,v,{observation_confidence:'DIRECT',client_handle:typeof client==='string'?client:null,raw_source:{kind:'decoded_radio_status',topic:'transmit',field:'tune',value:v},candidate_only:true});
  this.updateMetrics();
 }
 session(topic,payload,client){
  if(this.data.connectionState!=='CONNECTED')return;
  const match=/^client\/([^/]+)\/(connected|disconnected)$/.exec(topic);if(!match)return;
  const value={state:match[2],client_handle:match[1],client_id:payload?.client_id??null,client_program:payload?.program??null,client_name:payload?.station??null,client_ip:payload?.ip??null};
  const v=this.compact(value),old=this.clients.get(match[1])??null;if(JSON.stringify(old)===JSON.stringify(v))return;
  this.boundMap(this.clients,match[1],v);
  this.append('CLIENT_SESSION','7fbf2bfc9badc7d3',topic,old,v,{client_handle:v.client_handle,client_id:v.client_id,client_program:v.client_program,client_name:v.client_name,client_ip:v.client_ip,observation_confidence:'DIRECT',raw_source:{status_header_client:typeof client==='string'?client:null,kind:'decoded_client_status'}});
 }
 slice(topic,payload){
  if(this.data.connectionState!=='CONNECTED'||!/^slice\/\d+$/.test(topic))return;
  const removed=payload==='removed'||payload?.in_use===0||payload?.in_use==='0';const old=this.slices.get(topic)??null,next=removed?'REMOVED':'PRESENT';
  if(old===next)return;this.boundMap(this.slices,topic,next);this.append(removed?'SLICE_REMOVED':'SLICE_ADDED','7fbf2bfc9badc7d3',topic,old,next,{observation_confidence:'DIRECT',raw_source:{kind:'decoded_slice_membership'}});
 }
 boundMap(map,key,value){if(!map.has(key)&&map.size>=64){map.delete(map.keys().next().value);this.data.metrics.source_overflow++;}map.set(key,value);}
 request(source,msg){
  const seq=this.append('COMMAND_REQUEST',source,'request',null,msg.payload,{command_origin:'NODE_RED',command_name:this.compact(msg.payload),origin_confidence:'DIRECT',correlation_id:typeof msg._msgid==='string'?msg._msgid.slice(0,64):null,raw_source:{kind:'existing_local_request'}});
  if(typeof msg._msgid==='string'){if(this.pending.size>=256){this.pending.delete(this.pending.keys().next().value);this.data.metrics.source_overflow++;}const key=source+':'+msg._msgid.slice(0,64);this.pending.set(key,{seq:this.pending.has(key)?null:seq,at:this.mono()});}
 }
 ack(source,msg){
  const key=source+':'+String(msg._msgid??'').slice(0,64),p=this.pending.get(key);this.pending.delete(key);
  this.append('ACK_RESPONSE',source,'status_code',null,msg.status_code??null,{derived_from_seq:p?.seq??null,correlation_id:typeof msg._msgid==='string'?msg._msgid.slice(0,64):null,origin_confidence:p?.seq!=null?'CORRELATED':'UNKNOWN',raw_source:{kind:'existing_request_callback'}});
 }
 rate(){return this.data.connectionState==='CONNECTED'&&(this.data.latestState.tx_state==='TX'||(this.data.tuneCandidate.tune_fresh&&this.data.tuneCandidate.tune_value===1))?this.config.txHz:this.config.rxHz;}
 tick(rows={}){
  const now=this.mono(),c=this.data.tuneCandidate;
  if(c.tune_last_update_ms!==null)c.tune_age_ms=Math.max(0,now-c._mono);
  if(c.tune_fresh&&c.tune_age_ms>=this.config.tuneFreshMs){const old=c.tune_value;c.tune_value='UNKNOWN';c.tune_fresh=false;this.append('TUNE_STALE','au510m_diag','transmit.tune',old,'UNKNOWN',{derived_from_seq:c.last_record_seq,derivation:'CANDIDATE_FRESHNESS_EXPIRED',raw_source:{timeout_ms:this.config.tuneFreshMs},candidate_only:true});}
  for(const [key,p]of this.pending)if(now-p.at>=30000){this.pending.delete(key);this.data.metrics.pending_expired++;}
  this.expire(now);
  const interval=1000/this.rate();
  if(now-this.lastHealthMono>=interval){this.lastHealthMono=now;this.health(rows);}
  this.updateMetrics(now);
 }
 health(rows){
  const now=this.wall(),s=this.data.latestState,c=this.data.tuneCandidate,connected=this.data.connectionState==='CONNECTED';
  const meters={};for(const topic of TOPICS){
   const r=rows[topic],seen=r?.seen??0;const eligible=connected&&seen>=this.epochWall&&seen>0&&now-seen>=0&&now-seen<=this.config.meterFreshMs;
   const power=topic==='TX-/1/FWDPWR'||topic==='TX-/2/REFPWR',txOnly=power||topic==='TX-/3/SWR';
   const rawValue=power?r?.watts:r?.value,valid=eligible&&typeof rawValue==='number'&&Number.isFinite(rawValue);
   const quality=!connected?'DISCONNECTED':!eligible?'STALE_OR_UNAVAILABLE':!valid?'INVALID':txOnly&&s.tx_state!=='TX'?'RX_NOT_TX_MEASUREMENT':txOnly&&(!this.txSince||seen<this.txSince)?'PREVIOUS_TX_INTERVAL':'FRESH';
   meters[topic]={value:valid?rawValue:null,seen:eligible?seen:null,unit:power?'W':typeof r?.unit==='string'?r.unit.slice(0,16):null,quality};
  }
  this.data.latestHealth=meters;
  const record={ts_wall:new Date(now).toISOString(),ts_ms:now,seq:++this.data.seq,record_type:'HEALTH',source:'2702052aa13cacd0',...s,tune_value:c.tune_value,tune_fresh:c.tune_fresh,tune_age_ms:c.tune_age_ms,meters};
  this.add(record);this.data.metrics.total_health_samples++;this.data.metrics.last_health_ms=now;
 }
 error(message){this.data.metrics.errors++;this.data.metrics.logger_status='ERROR';this.append('DIAGNOSTIC_ERROR','au510m_diag','error',null,String(message).slice(0,256));}
 close(){this.data.metrics.logger_status='STOPPED';}
}
module.exports={DiagnosticBuffer,TOPICS,DEFAULTS};
