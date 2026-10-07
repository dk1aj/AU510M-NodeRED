'use strict';
const path=require('node:path'),{randomUUID}=require('node:crypto');
const {IncidentDetector}=require('./au510m-incident-detector.cjs');
const {Writer}=require('./au510m-persistence-client.cjs');
const sanitize=require('./au510m-persistence-sanitize.cjs');
const PRE=120000,POST=120000,MAX_ACTIVE=32;
class Capture {
 constructor({history,metrics={},writer,wall=Date.now,mono=()=>performance.now(),boundary=()=>({}),health=()=>({}),topics=[],onError=()=>{}}){this.history=history;this.boundary=boundary;this.metrics=metrics;this.writer=writer;this.wall=wall;this.mono=mono;this.onError=onError;this.active=new Map();this.latestSeq=0;this.lastFlush=mono();this.nextRetention=wall()+6*3600000;this.failedSinceStart=false;this.loggedError=false;
  this.detector=new IncidentDetector({runId:'RAM_ONLY',mono,boundary,health,topics,metrics,history:ms=>history(ms).slice().reverse()});
  this.linked=null;this.linkSeq=null;this.lastCycle=null;metrics.persistence_active_captures=0;metrics.persistence_capture_overflow=0;
 }
 send(payload,capture){return this.writer.write(payload).catch(e=>{this.failedSinceStart=true;if(capture){capture.row.dropped_records+=(payload.records?.length??0);capture.lost=true;capture.row.incomplete_reason='PERSISTENCE_WRITE_FAILED';}if(!this.loggedError){this.loggedError=true;this.onError('AU510M persistence unavailable; RAM diagnostics continue');}});}
 open(a){if(this.active.size>=MAX_ACTIVE){this.metrics.persistence_capture_overflow++;return null;}
  const id='AU510M-'+new Date(a.trigger_ts).toISOString().replace(/[-:.TZ]/g,'')+'-'+randomUUID();const row=sanitize.incident(a,id);if(this.failedSinceStart)row.pre_trigger_complete=0;
  const c={row,start:a.trigger_ts-PRE,end:a.trigger_ts+POST,deadline:this.mono()+POST,batch:[],lost:false,epochInterrupted:false,baseline:{...this.boundary()}};this.active.set(id,c);const pre=this.history(PRE).filter(r=>r.ts_ms>=c.start&&r.ts_ms<=a.trigger_ts).map(r=>sanitize.record(r)).filter(Boolean).map(r=>({...r,incident_id:id}));
  this.send({incident:row,records:pre},c);this.metrics.persistence_active_captures=this.active.size;return c;
 }
 consume(r){if(r.seq<=this.latestSeq||r.ts_ms<(this.lastWall??-Infinity))for(const c of this.active.values()){c.lost=true;c.row.incomplete_reason='INPUT_ORDER_OR_CLOCK_GAP';}this.lastWall=r.ts_ms;this.latestSeq=r.seq;const previous=this.detector.data.active_incident;this.detector.consume(r);const a=this.detector.data.active_incident;
  if(a&&a!==previous){this.linked=this.open(a);this.linkSeq=a.trigger_seq;this.lastCycle=a.last_cycle_seq;}
  else if(a&&a.last_cycle_seq!==this.lastCycle&&this.linked&&this.active.has(this.linked.row.incident_id)){
   const c=this.linked;Object.assign(c.row,{cycle_count:a.cycle_count,last_cycle_seq:a.last_cycle_seq,duration_ms:a.duration_ms});c.end=r.ts_ms+POST;c.deadline=this.mono()+POST;c.row.window_end_ts=sanitize.iso(c.end);this.lastCycle=a.last_cycle_seq;
  }
  const safe=this.active.size?sanitize.record(r):null;
  for(const c of this.active.values()){
   const b=this.boundary();if(['dropped_by_limit','dropped_by_memory','source_overflow','errors'].some(k=>(b[k]??0)>(c.baseline[k]??0))){c.lost=true;c.row.incomplete_reason='SOURCE_RECORD_GAP';}
   if(r.seq!==c.row.trigger_seq&&r.ts_ms>=c.start&&r.ts_ms<=c.end&&safe)c.batch.push({...safe,incident_id:c.row.incident_id});
   if(['RADIO_DISCONNECTED','RADIO_CONNECTED','LOGGER_START'].includes(r.record_type)&&r.seq>c.row.trigger_seq){c.epochInterrupted=true;c.row.incomplete_reason='RADIO_CONTINUITY_INTERRUPTED';}
  }
  this.tick();
 }
 tick(){const m=this.mono();for(const c of [...this.active.values()]){
   if(m>=c.deadline){this.finish(c,c.lost||c.epochInterrupted||this.metrics.sqlite_dropped_records>0?'INCOMPLETE':'COMPLETE');continue;}
   if(c.batch.length>=200||m-this.lastFlush>=200)this.flush(c);
  }if(m-this.lastFlush>=200)this.lastFlush=m;
  if(this.wall()>=this.nextRetention){this.nextRetention=this.wall()+6*3600000;this.writer.request('retention').catch(()=>{this.metrics.sqlite_status='ERROR';this.metrics.sqlite_last_error='SQLITE_RETENTION_FAILED';this.onError('AU510M persistence retention failed');});}
 }
 flush(c){if(!c.batch.length)return Promise.resolve();const records=c.batch.splice(0);return this.send({incident:c.row,records},c);}
 finish(c,state){c.row.post_capture_state=state;c.row.post_trigger_complete=state==='COMPLETE'?1:0;c.row.completed_at=sanitize.iso(this.wall());const records=c.batch.splice(0);this.active.delete(c.row.incident_id);this.metrics.persistence_active_captures=this.active.size;
  // Serialized queue ensures all previous writes finish before the completion transaction/export.
  return this.send({incident:c.row,records,complete:true},c);
 }
 async close(){for(const c of [...this.active.values()]){c.row.incomplete_reason='RUNTIME_STOP_OR_REDEPLOY';await this.finish(c,'INTERRUPTED');}this.detector.close();await this.writer.close();}
}
function attach(core,{dbPath=path.join(__dirname,'../data/au510m-diagnostics.sqlite'),exportDir=path.join(__dirname,'../data/incidents'),onError=()=>{}}={}){
 const writer=new Writer({dbPath,exportDir,metrics:core.data.metrics});
 writer.started.then(ready=>{if(!ready)onError('AU510M SQLite unavailable; RAM diagnostics continue');});
 const history=ms=>{const earliest=core.wall()-ms;return core.records().filter(r=>r.ts_ms>=earliest);};
 const capture=new Capture({history,writer,metrics:core.data.metrics,wall:core.wall,mono:core.mono,boundary:()=>({...core.data.metrics,oldest_ts:core.count?core.slots[core.head].record.ts_ms:null,oldest_seq:core.count?core.slots[core.head].record.seq:null,newest_seq:core.data.seq}),health:()=>core.data.latestHealth,topics:require('./au510m-stage1-core.cjs').TOPICS,onError});
 const original=core.add;core.add=function(record,t){original.call(this,record,t);try{capture.consume(record);}catch{onError('AU510M persistence observer failed; RAM diagnostics continue');core.data.metrics.persistence_observer_errors=(core.data.metrics.persistence_observer_errors??0)+1;for(const c of capture.active.values()){c.lost=true;c.row.incomplete_reason='PERSISTENCE_OBSERVER_FAILED';}}};
 return {tick:()=>{try{capture.tick();}catch{onError('AU510M persistence timer failed; RAM diagnostics continue');}},close:()=>{core.add=original;return capture.close();}};
}
module.exports={Capture,attach,PRE,POST};
