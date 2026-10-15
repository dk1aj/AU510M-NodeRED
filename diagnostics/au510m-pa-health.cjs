'use strict';

const TOPIC=Object.freeze({
 FWDPWR_W:'TX-/1/FWDPWR',REFPWR_W:'TX-/2/REFPWR',SWR:'TX-/3/SWR',
 PATEMP_C:'TX-/4/PATEMP',PAFETQ1TEMP_C:'RAD/8/PAFETQ1TEMP',PAFETQ2TEMP_C:'RAD/9/PAFETQ2TEMP',
 PACURRENT_A:'RAD/300/PACURRENT',PAEFF_PERCENT:'TX-/6/PAEFF',
 V13_8A:'RAD/334/+13.8A',V13_8B:'RAD/0/+13.8B',MAINFAN:'RAD/3/MAINFAN'
});
const THRESHOLDS=Object.freeze({
 provenance:'PROJECT_WARNING_THRESHOLD',enterMs:2000,recoverMs:3000,meaningfulForwardW:25,
 swr:{enter:2.0,clear:1.8},paTempC:{enter:75,clear:70},fetTempC:{enter:75,clear:70},
 fetDeltaC:{enter:15,clear:10},paCurrentA:{enter:20,clear:18},paEfficiencyPercent:{enter:40,clear:45},
 supplyV:{enter:11.5,clear:11.8},supplyDeltaV:{enter:1.0,clear:0.7}
});
// Single production activation gate. Candidate thresholds require baseline review.
const PA_HEALTH_CONFIG=Object.freeze({numericRulesEnabled:false});
const PRIORITY=Object.freeze(['PA_FAULT','PA_TEMP_HIGH','FET_TEMP_HIGH','FET_IMBALANCE','SWR_HIGH','SUPPLY_LOW','SUPPLY_IMBALANCE','PA_CURRENT_HIGH','PA_EFFICIENCY_LOW']);
const ALWAYS_REQUIRED=Object.freeze(['PATEMP_C','PAFETQ1TEMP_C','PAFETQ2TEMP_C','PACURRENT_A','PAEFF_PERCENT','V13_8A','V13_8B','MAINFAN']);
const TX_REQUIRED=Object.freeze(['FWDPWR_W','REFPWR_W','SWR']);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const view=(meters,key)=>{const sample=meters?.[TOPIC[key]];return sample?.quality==='FRESH'&&finite(sample.value)?sample.value:null;};
const cloneValues=v=>Object.fromEntries(Object.entries(v).filter(([,x])=>finite(x)).map(([k,x])=>[k,Number(x.toFixed(4))]));

class PaHealthClassifier {
 constructor({emit=()=>{}}={}){
  this.emit=emit;this.rules=new Map();this.availableSince=null;
  this.data={state:'UNKNOWN',primaryReason:'DATA STALE',activeReasons:['DATA_STALE'],additional:0,confidence:'UNKNOWN',
   sourceConfidence:'UNKNOWN',thresholdProvenance:THRESHOLDS.provenance,updatedAt:null,values:{},missing:[]};
 }
 resetRules(){this.rules.clear();this.availableSince=null;}
 signature(value=this.data){return JSON.stringify([value.state,value.primaryReason,value.activeReasons]);}
 publish(next,{now,sourceSeq=null,immediate=false}={}){
  const previous={...this.data,activeReasons:[...this.data.activeReasons],values:{...this.data.values},missing:[...this.data.missing]};
  next.additional=Math.max(0,next.activeReasons.length-1);next.thresholdProvenance=THRESHOLDS.provenance;next.updatedAt=now;next.sourceConfidence??='UNKNOWN';
  this.data=Object.assign(this.data,next);
  if(this.signature(previous)===this.signature(this.data))return false;
  this.emit({old_state:previous.state,new_state:this.data.state,state_confidence:this.data.confidence==='UNKNOWN'?'UNKNOWN':'DERIVED',
   state_reason:this.data.primaryReason,active_reasons:[...this.data.activeReasons],reason_values:cloneValues(this.data.values),
   threshold_provenance:THRESHOLDS.provenance,threshold_status:'CANDIDATE',source_confidence:this.data.sourceConfidence,source_event_seq:sourceSeq,derived_from_seq:sourceSeq,immediate});
  return true;
 }
 unknown(reason,now,sourceSeq,missing=[]){this.resetRules();return this.publish({state:'UNKNOWN',primaryReason:reason,activeReasons:[reason.replaceAll(' ','_')],confidence:'UNKNOWN',values:{},missing}, {now,sourceSeq});}
 rule(name,violation,clear,now){
  const state=this.rules.get(name)??{active:false,enterSince:null,clearSince:null};
  if(!state.active){
   state.clearSince=null;
   if(violation){state.enterSince??=now;if(now-state.enterSince>=THRESHOLDS.enterMs){state.active=true;state.enterSince=null;}}
   else state.enterSince=null;
  }else{
   state.enterSince=null;
   if(clear){state.clearSince??=now;if(now-state.clearSince>=THRESHOLDS.recoverMs){state.active=false;state.clearSince=null;}}
   else state.clearSince=null;
  }
  this.rules.set(name,state);return state.active;
 }
 consume({connected,paFault,txState,meters,now=Date.now(),sourceSeq=null}={}){
  if(connected!==true)return this.unknown('DATA STALE',now,sourceSeq);
  // paFault is the freshness-gated canonical reducer result, never raw Interlock.
  if(paFault?.value==='FAULT'){
   this.resetRules();return this.publish({state:'CRITICAL',primaryReason:'PA FAULT',activeReasons:['PA_FAULT'],confidence:'DERIVED',sourceConfidence:'DIRECT',values:{},missing:[]},{now,sourceSeq,immediate:true});
  }
  if(paFault?.value!=='READY')return this.unknown('FAULT SOURCE UNAVAILABLE',now,sourceSeq);
  if(!['RX','TX'].includes(txState))return this.unknown('STATE UNKNOWN',now,sourceSeq);
  if(!PA_HEALTH_CONFIG.numericRulesEnabled){
   this.resetRules();return this.publish({state:'UNKNOWN',primaryReason:'NUMERIC RULES PENDING',activeReasons:[],confidence:'DERIVED',values:{},missing:[]},{now,sourceSeq});
  }
  const required=[...ALWAYS_REQUIRED,...(txState==='TX'?TX_REQUIRED:[])];
  const missing=required.filter(key=>view(meters,key)===null);
  if(missing.length)return this.unknown('DATA STALE',now,sourceSeq,missing);
  this.availableSince??=now;
  if(now-this.availableSince<THRESHOLDS.recoverMs)return this.publish({state:'UNKNOWN',primaryReason:'DATA WARMUP',activeReasons:['DATA_WARMUP'],confidence:'UNKNOWN',values:{},missing:[]},{now,sourceSeq});

  const values=Object.fromEntries(Object.keys(TOPIC).map(key=>[key,view(meters,key)]));
  const maxFet=Math.max(values.PAFETQ1TEMP_C,values.PAFETQ2TEMP_C),fetDelta=Math.abs(values.PAFETQ1TEMP_C-values.PAFETQ2TEMP_C);
  const supplyMin=Math.min(values.V13_8A,values.V13_8B),supplyDelta=Math.abs(values.V13_8A-values.V13_8B);
  const meaningful=txState==='TX'&&values.FWDPWR_W>=THRESHOLDS.meaningfulForwardW;
  const checks={
   PA_TEMP_HIGH:[values.PATEMP_C>=THRESHOLDS.paTempC.enter,values.PATEMP_C<=THRESHOLDS.paTempC.clear],
   FET_TEMP_HIGH:[maxFet>=THRESHOLDS.fetTempC.enter,maxFet<=THRESHOLDS.fetTempC.clear],
   FET_IMBALANCE:[fetDelta>=THRESHOLDS.fetDeltaC.enter,fetDelta<=THRESHOLDS.fetDeltaC.clear],
   SWR_HIGH:[meaningful&&values.SWR>=THRESHOLDS.swr.enter,!meaningful||values.SWR<=THRESHOLDS.swr.clear],
   SUPPLY_LOW:[supplyMin<=THRESHOLDS.supplyV.enter,supplyMin>=THRESHOLDS.supplyV.clear],
   SUPPLY_IMBALANCE:[supplyDelta>=THRESHOLDS.supplyDeltaV.enter,supplyDelta<=THRESHOLDS.supplyDeltaV.clear],
   PA_CURRENT_HIGH:[values.PACURRENT_A>=THRESHOLDS.paCurrentA.enter,values.PACURRENT_A<=THRESHOLDS.paCurrentA.clear],
   PA_EFFICIENCY_LOW:[meaningful&&values.PAEFF_PERCENT<=THRESHOLDS.paEfficiencyPercent.enter,!meaningful||values.PAEFF_PERCENT>=THRESHOLDS.paEfficiencyPercent.clear]
  };
  const active=PRIORITY.filter(name=>name!=='PA_FAULT'&&this.rule(name,...checks[name],now));
  const reported={...values,FET_DELTA_C:fetDelta,SUPPLY_DELTA_V:supplyDelta};
  return this.publish(active.length?{state:'WARNING',primaryReason:active[0].replaceAll('_',' '),activeReasons:active,confidence:'DERIVED',values:reported,missing:[]}:
   {state:'OK',primaryReason:'NO ACTIVE WARNING',activeReasons:[],confidence:'DERIVED',values:reported,missing:[]},{now,sourceSeq});
 }
}

module.exports={PaHealthClassifier,PA_HEALTH_CONFIG,THRESHOLDS,TOPIC,PRIORITY,ALWAYS_REQUIRED,TX_REQUIRED};
