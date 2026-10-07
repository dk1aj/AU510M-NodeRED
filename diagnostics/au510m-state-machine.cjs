'use strict';
// A reducer of Stage-1 records only. No radio, timer, context or buffer access.
class DiagnosticStateMachine {
 constructor({emit=()=>{},metrics={}}={}){
  this.emit=emit;this.metrics=metrics;this.connected=false;this.tx='UNKNOWN';
  this.txValid=false;this.interlock=null;this.interlockReason=null;this.interlockSeq=null;
  this.tuneValue='UNKNOWN';this.tuneFresh=false;this.tunePending=false;this.returnPending=false;
  this.seriousError=false;this.lastSeq=0;
  this.data={diag_state:'UNKNOWN',diag_state_current:'UNKNOWN',diag_state_previous:null,
   diag_state_since_ms:null,diag_state_confidence:'UNKNOWN',diag_state_reason:null,
   diag_state_source_seq:null,diagnostic_tune_signal:'TUNE_UNKNOWN'};
  Object.assign(metrics,{current_diag_state:'UNKNOWN',previous_diag_state:null,state_since_ms:null,
   state_transition_count:0,unknown_state_count:0,last_state_change_ts:null,last_state_reason:null});
 }
 reset(){
  this.tx='UNKNOWN';this.txValid=false;this.interlock=null;this.interlockReason=null;
  this.interlockSeq=null;this.tuneValue='UNKNOWN';this.tuneFresh=false;
  this.tunePending=false;this.returnPending=false;this.seriousError=false;
 }
 change(state,confidence,reason,r){
  const d=this.data;if(d.diag_state_current===state&&d.diag_state_confidence===confidence&&d.diag_state_reason===reason)return;
  const previous=d.diag_state_current;const initial=d.diag_state_since_ms===null;
  const since=initial||previous!==state?r.ts_ms:d.diag_state_since_ms;
  Object.assign(d,{diag_state:state,diag_state_current:state,diag_state_previous:previous,
   diag_state_since_ms:since,diag_state_confidence:confidence,diag_state_reason:reason,diag_state_source_seq:r.seq});
  const m=this.metrics;m.current_diag_state=state;m.previous_diag_state=previous;
  m.state_since_ms=since;m.state_transition_count++;if(state==='UNKNOWN'&&(initial||previous!=='UNKNOWN'))m.unknown_state_count++;
  m.last_state_change_ts=r.ts_ms;m.last_state_reason=reason;
  this.emit({old_state:previous,new_state:state,state_confidence:confidence,state_reason:reason,
   source_event_seq:r.seq,derived_from_seq:r.seq,interlock_source_seq:this.interlockSeq,
   interlock_state:this.interlock,interlock_reason:this.interlockReason,
   tune_value:this.tuneValue,tune_fresh:this.tuneFresh,diagnostic_tune_signal:d.diagnostic_tune_signal,
   tx_state:r.tx_state??this.tx,frequency:r.frequency??null,mode:r.mode??null,active_slice:r.active_slice??null,
   origin_confidence:'UNKNOWN',raw_source:{kind:'stage1_record',record_type:r.record_type,source:r.source,seq:r.seq},
   fault_scope:state==='FAULT'?(this.seriousError?'DIAGNOSTIC':'RADIO'):null});
 }
 consume(r){
  if(!r||r.record_type==='DIAG_STATE_CHANGE')return;
  if(!Number.isSafeInteger(r.seq)||r.seq<=this.lastSeq){
   this.seriousError=true;this.change('FAULT','DERIVED','STAGE1_SOURCE_ORDER_VIOLATION',r);return;
  }
  this.lastSeq=r.seq;
  if(r.record_type==='LOGGER_START'){
   this.reset();this.connected=false;this.data.diagnostic_tune_signal='TUNE_UNKNOWN';
   this.change('UNKNOWN','UNKNOWN','LOGGER_START',r);return;
  }
  if(r.record_type==='RADIO_CONNECTED'||r.record_type==='RADIO_DISCONNECTED'){
   this.reset();this.connected=r.record_type==='RADIO_CONNECTED';this.data.diagnostic_tune_signal='TUNE_UNKNOWN';
   this.change('UNKNOWN','UNKNOWN',this.connected?'AWAIT_FRESH_CANONICAL':'RADIO_DISCONNECTED',r);return;
  }
  if(r.record_type==='DIAGNOSTIC_ERROR')this.seriousError=true;
  if(['INTERLOCK_STATE','INTERLOCK_BASELINE'].includes(r.record_type)){
   this.interlock=r.new_value;this.interlockReason=null;this.interlockSeq=r.seq;this.txValid=false;
  }
  if(r.record_type==='INTERLOCK_FIELD'&&r.field==='reason')this.interlockReason=r.new_value;
  if(r.record_type==='TX_RX'){
   this.tx=r.new_value;this.txValid=r.derivation==='DERIVED_FROM_INTERLOCK'&&r.derived_from_seq===this.interlockSeq;
  }
  if(['TUNE_CANDIDATE','TUNE_STALE'].includes(r.record_type)){
   const wasActive=this.tuneFresh&&this.tuneValue===1;
   this.tuneValue=r.tune_value;this.tuneFresh=r.tune_fresh===true;
   const active=this.tuneFresh&&this.tuneValue===1;
   if(active&&!wasActive)this.tunePending=true;
   if(!active)this.tunePending=false;
  }
  // Health preserves evidence context and exposes freshness, never supplies a
  // new interlock observation or a duplicate independently derived TX/RX path.
  if(r.record_type==='HEALTH'&&r.tune_fresh===false){this.tuneFresh=false;this.tuneValue='UNKNOWN';this.tunePending=false;}
  this.data.diagnostic_tune_signal=this.tuneFresh&&this.tuneValue===1?'TUNE_ACTIVE':
   this.tuneFresh&&this.tuneValue===0?'TUNE_INACTIVE':'TUNE_UNKNOWN';
  if(!['INTERLOCK_STATE','INTERLOCK_BASELINE','INTERLOCK_FIELD','TX_RX','TUNE_CANDIDATE','TUNE_STALE','DIAGNOSTIC_ERROR','HEALTH'].includes(r.record_type))return;
  if(!this.connected){this.change('UNKNOWN','UNKNOWN','RADIO_NOT_CONNECTED',r);return;}
  if(this.seriousError){this.change('FAULT','DERIVED','SERIOUS_DIAGNOSTIC_ERROR',r);return;}
  if(['TX_FAULT','TIMEOUT','STUCK_INPUT'].includes(this.interlock)){
   this.returnPending=false;this.change('FAULT','DIRECT','INTERLOCK_'+this.interlock,r);return;
  }
  if(this.interlock==='NOT_READY'){
   this.returnPending=false;this.change('INTERLOCK_BLOCKED','DIRECT','INTERLOCK_NOT_READY'+(this.interlockReason?':'+this.interlockReason:''),r);return;
  }
  if(this.interlock==='PTT_REQUESTED'){this.change('TX_REQUESTED','DIRECT','INTERLOCK_PTT_REQUESTED',r);return;}
  if(this.interlock==='UNKEY_REQUESTED'){
   this.returnPending=true;this.change('UNKEY_REQUESTED','DIRECT','INTERLOCK_UNKEY_REQUESTED',r);return;
  }
  if(r.record_type==='TX_RX'&&!this.txValid){
   this.change('UNKNOWN','UNKNOWN','UNLINKED_CANONICAL_TX_RX',r);return;
  }
  if(this.interlock==='TRANSMITTING'){
   if(this.txValid&&this.tx==='TX'){
    this.tunePending=false;this.returnPending=true;
    this.change('TRANSMITTING','DERIVED','DERIVED_FROM_INTERLOCK',r);
   }else if(this.txValid){this.change('UNKNOWN','UNKNOWN','CONTRADICTORY_TX_INTERLOCK',r);}
   if(!this.txValid&&r.record_type==='HEALTH')this.change('UNKNOWN','UNKNOWN','AWAIT_LINKED_CANONICAL_TX_RX',r);
   // Ordered partial update: await the linked canonical TX_RX record. Do not
   // invent a transient UNKNOWN between the direct precursor and its reducer.
   return;
  }
  if(!['READY','RECEIVE'].includes(this.interlock)){
   this.change('UNKNOWN','UNKNOWN','UNSUPPORTED_OR_MISSING_INTERLOCK',r);return;
  }
  if(!this.txValid){
   if(r.record_type==='HEALTH')this.change('UNKNOWN','UNKNOWN','AWAIT_LINKED_CANONICAL_TX_RX',r);
   return;
  } // Await the canonical result of this interlock update.
  if(this.tx!=='RX'){
   this.change('UNKNOWN','UNKNOWN',this.tx==='TX'?'CONTRADICTORY_TX_INTERLOCK':'CANONICAL_TX_RX_UNKNOWN',r);return;
  }
  if(this.returnPending){
   this.returnPending=false;this.tunePending=false;
   this.change('RETURN_TO_RX','DERIVED','CANONICAL_RX_AFTER_TX_OR_TUNE',r);
   // Zero timer: deterministic completion in the same source-event reduction.
   this.change('RADIO_RX','DERIVED','CANONICAL_RX',r);return;
  }
  if(this.tunePending&&this.tuneFresh&&this.tuneValue===1){
   this.change('TUNE_REQUESTED','DIRECT','FRESH_DIAGNOSTIC_TUNE_SIGNAL',r);return;
  }
  if(this.data.diag_state_current==='TUNE_REQUESTED'){
   if(this.tuneFresh&&this.tuneValue===0){
    this.change('RETURN_TO_RX','DERIVED','FRESH_TUNE_INACTIVE_WITH_CANONICAL_RX',r);
   }
   // Expired tune cannot retain TUNE_REQUESTED. Known canonical RX still stands.
  }
  this.change('RADIO_RX','DERIVED','CANONICAL_RX',r);
 }
}
module.exports={DiagnosticStateMachine};
