'use strict';
const path=require('node:path');
const {Worker}=require('node:worker_threads');
class Writer {
 constructor({dbPath,exportDir,metrics={},maxQueuedRecords=24000,workerFactory=(file,opts)=>new Worker(file,opts)}={}){this.metrics=metrics;this.queue=[];this.weight=0;this.max=maxQueuedRecords;this.serial=0;this.ready=false;this.failed=false;this.closing=false;this.closed=false;this.inflight=null;
  Object.assign(metrics,{sqlite_status:'STARTING',sqlite_last_error:null,sqlite_last_write_ts:null,sqlite_incident_count:0,sqlite_state_event_count:0,sqlite_health_sample_count:0,sqlite_db_size_bytes:0,sqlite_dropped_records:0,sqlite_queue_records:0,sqlite_queue_peak_records:0,sqlite_max_write_latency_ms:0});
  this.started=new Promise(resolve=>this.resolveStart=resolve);
  try{this.worker=workerFactory(path.join(__dirname,'au510m-persistence-worker.cjs'),{workerData:{dbPath,exportDir}});this.worker.on('message',m=>this.message(m));this.worker.on('error',()=>this.fail('SQLITE_WORKER_FAILED'));this.worker.on('exit',c=>{if(!this.closed)this.fail('SQLITE_WORKER_EXIT');});}catch{this.fail('SQLITE_WORKER_START_FAILED');}
 }
 message(m){if(Object.hasOwn(m,'ready')){if(!m.ready){this.fail(m.error);return;}this.ready=true;Object.assign(this.metrics,m.metrics);this.resolveStart(true);this.pump();return;}
  if(!this.inflight||m.id!==this.inflight.id)return;
  const item=this.inflight;this.inflight=null;this.weight-=item.weight;this.metrics.sqlite_queue_records=this.weight;
  if(m.ok){if(m.result){Object.assign(this.metrics,m.result);this.metrics.sqlite_max_write_latency_ms=Math.max(this.metrics.sqlite_max_write_latency_ms,m.result.write_latency_ms??0);}item.resolve(m.result);}
  else{this.metrics.sqlite_status='ERROR';this.metrics.sqlite_last_error=m.error;this.metrics.sqlite_dropped_records+=item.weight;item.reject(Error(m.error));this.fail(m.error);return;}
  this.pump();
 }
 fail(code){this.failed=true;this.metrics.sqlite_status='ERROR';this.metrics.sqlite_last_error=code;this.resolveStart(false);for(const x of [...this.queue,...(this.inflight?[this.inflight]:[])]){this.metrics.sqlite_dropped_records+=x.weight;x.reject(Error(code));}this.queue=[];this.inflight=null;this.weight=0;this.metrics.sqlite_queue_records=0;}
 request(op,payload){return new Promise((resolve,reject)=>{const weight=1+(payload?.records?.length??0);if(this.failed||this.closed||this.closing&&op!=='close'){this.metrics.sqlite_dropped_records+=weight;reject(Error('SQLITE_UNAVAILABLE'));return;}
  if(this.weight+weight>this.max){this.metrics.sqlite_dropped_records+=weight;this.metrics.sqlite_last_error='SQLITE_QUEUE_OVERFLOW';reject(Error('SQLITE_QUEUE_OVERFLOW'));return;}
  this.queue.push({id:++this.serial,op,payload:payload?structuredClone(payload):payload,weight,resolve,reject});this.weight+=weight;this.metrics.sqlite_queue_records=this.weight;this.metrics.sqlite_queue_peak_records=Math.max(this.weight,this.metrics.sqlite_queue_peak_records);this.pump();});}
 pump(){if(!this.ready||this.failed||this.inflight||!this.queue.length)return;this.inflight=this.queue.shift();try{const {id,op,payload}=this.inflight;this.worker.postMessage({id,op,payload});}catch{this.fail('SQLITE_WORKER_SEND_FAILED');}}
 write(payload){return this.request('write',payload);}
 async close(){if(this.closed||this.closing)return;this.closing=true;if(this.failed){this.closed=true;await this.worker?.terminate();return;}try{await this.request('close');this.closed=true;this.metrics.sqlite_status='STOPPED';}finally{this.closed=true;await this.worker?.terminate();}}
}
module.exports={Writer};
