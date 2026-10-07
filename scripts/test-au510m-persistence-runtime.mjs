import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {DiagnosticBuffer}=require('../diagnostics/au510m-stage1-core.cjs');
const {attach}=require('../diagnostics/au510m-persistence.cjs');
const {Store}=require('../diagnostics/au510m-persistence-store.cjs');
const {Writer}=require('../diagnostics/au510m-persistence-client.cjs');
const safe=require('../diagnostics/au510m-persistence-sanitize.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'au510m-worker-test-'));
try{
 let t=0;const options={version:'OFFLINE',wall:()=>1800000000000+t,mono:()=>t};const core=new DiagnosticBuffer(options),control=new DiagnosticBuffer(options);const original=core.add;
 const handle=attach(core,{dbPath:path.join(dir,'normal.sqlite'),exportDir:path.join(dir,'normal-exports'),onError:()=>assert.fail('Unexpected storage error')});
 const both=fn=>{fn(core);fn(control);};
 const canon=(tx,state)=>both(d=>{d.interlock({state});d.canonical({connected:true,fields:{'TX/RX':tx,Frequency:'14.074 MHz',Mode:'DIGU','Active slice':'A'}},state);});
 const step=ms=>{t+=ms;both(d=>d.tick({}));handle.tick();};
 canon('RX','READY');step(1000);
 for(const tune of [false,true]){if(tune)both(d=>d.tune(1));canon('UNKNOWN','PTT_REQUESTED');step(20);canon('TX','TRANSMITTING');for(let i=0;i<15;i++)step(200);if(tune)both(d=>d.tune(0));canon('UNKNOWN','UNKEY_REQUESTED');canon('RX','READY');step(6000);}
 assert.equal(core.data.metrics.total_incidents,0);assert.equal(core.count,control.count);
 assert.deepEqual(core.records().slice(2),control.records().slice(2),'persistence adds no ring records and changes no state/health semantics');
 await handle.close();assert.equal(core.add,original);
 const s=new Store({dbPath:path.join(dir,'normal.sqlite'),exportDir:path.join(dir,'normal-exports')});assert.equal(s.metrics().sqlite_incident_count,0);s.close();
 console.log('PASS real RAM-owner/worker attachment, normal RX/TX/TUNE, exact unchanged source records, clean detach');
 const m={},w=new Writer({dbPath:path.join(dir,'load.sqlite'),exportDir:path.join(dir,'load-exports'),metrics:m});assert(await w.started);
 const incident=safe.incident({trigger_ts:1800000000000,trigger_seq:1,incident_type:'OFFLINE_BENCHMARK'},'AU510M-offline-benchmark');
 const rows=Array.from({length:5000},(_,i)=>({...safe.record({record_type:i%2?'HEALTH':'INTERLOCK_STATE',seq:i+1,ts_ms:1800000000000+i}),incident_id:incident.incident_id}));
 let heartbeat=false;setTimeout(()=>heartbeat=true,0);const start=performance.now();await w.write({incident,records:rows});const elapsed=performance.now()-start;assert(heartbeat,'main event loop remained responsive during worker write');assert.equal(m.sqlite_state_event_count,2500);assert.equal(m.sqlite_health_sample_count,2500);
 console.log(JSON.stringify({offline_benchmark_records:5000,end_to_end_ms:Math.round(elapsed),worker_write_ms:Math.round(m.write_latency_ms),records_per_second:Math.round(5000/elapsed*1000),db_bytes:m.sqlite_db_size_bytes,event_loop_responsive:true}));await w.close();
 const overMetrics={},over=new Writer({dbPath:path.join(dir,'bound.sqlite'),exportDir:path.join(dir,'bound-exports'),metrics:overMetrics,maxQueuedRecords:2});await assert.rejects(over.write({records:rows.slice(0,3)}),/OVERFLOW/);assert.equal(overMetrics.sqlite_queue_records,0);assert.equal(overMetrics.sqlite_dropped_records,4);await over.started;await over.close();console.log('PASS bounded queue reports lost records without unbounded worker backlog');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
