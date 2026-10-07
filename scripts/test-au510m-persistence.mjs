import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {Store}=require('../diagnostics/au510m-persistence-store.cjs');
const {Writer}=require('../diagnostics/au510m-persistence-client.cjs');
const {Capture}=require('../diagnostics/au510m-persistence.cjs');
const safe=require('../diagnostics/au510m-persistence-sanitize.cjs');
const {DiagnosticBuffer,DEFAULTS}=require('../diagnostics/au510m-stage1-core.cjs');
const base=fs.mkdtempSync(path.join(os.tmpdir(),'au510m-persistence-test-'));
let count=0;
const now=1800000000000;
function fixture(){const dir=path.join(base,String(++count));return {dbPath:path.join(dir,'test.sqlite'),exportDir:path.join(dir,'incidents'),now:()=>now};}
const meta=(id,t=now)=>safe.incident({incident_type:'TUNE_RX_OSCILLATION',trigger_ts:t,trigger_seq:10,pre_trigger_complete:true,pre_window_available_seconds:120},id);
const event=(seq,ts=now)=>safe.record({seq,ts_ms:ts,record_type:'INTERLOCK_STATE',new_value:'TX_FAULT',observation_confidence:'DIRECT'});
const health=(seq,ts=now)=>safe.record({seq,ts_ms:ts,record_type:'HEALTH'});
function test(name,fn){fn();console.log('PASS '+name);}
try {
 test('WAL, schema, pragmas, incidents/events/health, uniqueness, NULL and JSONL order',()=>{
  const f=fixture(),s=new Store(f);assert.equal(s.db.prepare('PRAGMA journal_mode').get().journal_mode,'wal');assert.equal(s.db.prepare('PRAGMA synchronous').get().synchronous,1);assert.equal(s.db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);assert.equal(s.db.prepare('PRAGMA busy_timeout').get().timeout,5000);
  const a=meta('AU510M-test');const e={...event(11),incident_id:a.incident_id},h={...health(12),incident_id:a.incident_id};s.write({incident:a,records:[h,e,e,h]});assert.equal(s.metrics().sqlite_state_event_count,1);assert.equal(s.metrics().sqlite_health_sample_count,1);
  assert.equal(s.db.prepare('SELECT FWDPWR_W,SWR FROM health_samples').get().SWR,null);assert.equal(s.db.prepare('SELECT precursor_fault FROM incidents').get().precursor_fault,null);
  a.post_capture_state='COMPLETE';a.post_trigger_complete=1;s.write({incident:a,complete:true});const lines=fs.readFileSync(s.filename(a.incident_id),'utf8').trim().split('\n').map(JSON.parse);assert.deepEqual(lines.map(r=>r.kind),['incident','event','health']);assert.equal(fs.statSync(f.dbPath).mode&0o777,0o600);s.close();
 });
 test('retention protects COLLECTING; incidents retained; per-incident dedup and overlapping windows',()=>{
  const s=new Store(fixture()),a=meta('AU510M-old'),b=meta('AU510M-collecting');a.post_capture_state='COMPLETE';
  for(const m of [a,b])s.write({incident:m,records:[{...event(1,now-31*86400000),incident_id:m.incident_id},{...event(2,now-3*86400000),incident_id:m.incident_id},{...health(3,now-3*86400000),incident_id:m.incident_id}]});
  s.retention();assert.equal(s.metrics().sqlite_incident_count,2);assert.equal(s.metrics().sqlite_state_event_count,3);assert.equal(s.metrics().sqlite_health_sample_count,1);s.close();
 });
 test('startup recovery marks COLLECTING INTERRUPTED and never complete',()=>{const f=fixture();let s=new Store(f);s.write({incident:meta('AU510M-interrupted')});s.close();s=new Store(f);const a=s.db.prepare('SELECT * FROM incidents').get();assert.equal(a.post_capture_state,'INTERRUPTED');assert.equal(a.post_trigger_complete,0);assert(fs.existsSync(s.filename(a.incident_id)));s.close();});
 test('positive sanitizer rejects nested metadata, private addresses, hosts, usernames, sessions and temporary paths',()=>{
  const dirty={seq:1,ts_ms:now,record_type:'CLIENT_SESSION',new_value:{client_handle:'secret',pid:12},raw_source:{journal_cursor:'secret'},client_handle:'secret',session_id:'secret',journal_cursor:'secret',pid:12,client_name:'private-host.local',command_origin:'192.168.1.1',old_state:'/tmp/private',state_reason:'user@host.local'};
  const r=safe.record(dirty);const json=JSON.stringify(r);for(const v of ['secret','192.168','private-host','/tmp/private','user@'])assert(!json.includes(v));assert.equal(r.event_value,null);assert.equal(r.command_origin,null);assert.equal(r.client_name,null);
  assert.equal(safe.record({seq:2,ts_ms:now,record_type:'COMMAND_REQUEST',command_origin:'FRSTACK',origin_confidence:'DIRECT'}).command_origin,'FRSTACK');
 });
 function captureFixture(){let t=0;const f=fixture(),s=new Store(f),metrics={sqlite_dropped_records:0},history=[];const writer={write:p=>{s.write(p);return Promise.resolve();},request:()=>Promise.resolve(),close:()=>Promise.resolve(s.close())};const cap=new Capture({history:ms=>history.filter(r=>now+t-r.ts_ms<=ms),writer,metrics,wall:()=>now+t,mono:()=>t,boundary:()=>({oldest_ts:history[0]?.ts_ms,oldest_age_seconds:t/1000})});let seq=0;
  const feed=(r,dt=0)=>{t+=dt;r={seq:++seq,ts_ms:now+t,...r};history.push(r);cap.consume(r);return r;};
  const cycle=()=>{feed({record_type:'DIAG_STATE_CHANGE',new_state:'TRANSMITTING',tune_value:1,tune_fresh:true},20);feed({record_type:'DIAG_STATE_CHANGE',new_state:'RETURN_TO_RX',tune_value:1,tune_fresh:true},100);feed({record_type:'DIAG_STATE_CHANGE',new_state:'RADIO_RX',tune_value:1,tune_fresh:true},20);};return {s,cap,feed,cycle,metrics,advance:dt=>{t+=dt;cap.tick();}};
 }
 test('full 120s PRE / POST transactions, retrigger extension, one export, no normal RX/TX/TUNE incident',()=>{
  const f=captureFixture();for(let i=0;i<125;i++)f.feed({record_type:'HEALTH'},1000);assert.equal(f.s.metrics().sqlite_incident_count,0);
  f.cycle();assert.equal(f.s.metrics().sqlite_incident_count,0);f.cycle();f.cycle();const c=[...f.cap.active.values()][0];assert.equal(c.row.pre_trigger_complete,1);assert.equal(c.row.window_start_ts,new Date(c.row.trigger_ts_ms-120000).toISOString());
  const deadline=c.deadline;f.cycle();assert(c.deadline>deadline);f.advance(119999);assert.equal(f.s.db.prepare('SELECT post_capture_state FROM incidents').get().post_capture_state,'COLLECTING');f.feed({record_type:'HEALTH'},1);assert.equal(f.s.db.prepare('SELECT post_trigger_complete FROM incidents').get().post_trigger_complete,1);assert.equal(fs.readdirSync(f.s.exportDir).length,1);assert(f.s.metrics().sqlite_health_sample_count>=120);f.s.close();
 });
 test('independent overlapping captures share records without cross-incident dedup',()=>{const f=captureFixture();const a=f.cap.open({trigger_ts:now,trigger_seq:0}),b=f.cap.open({trigger_ts:now,trigger_seq:0});f.feed({record_type:'HEALTH'},1000);f.advance(120000);assert.equal(f.s.metrics().sqlite_incident_count,2);assert.equal(f.s.metrics().sqlite_health_sample_count,2);assert.equal(fs.readdirSync(f.s.exportDir).length,2);f.s.close();});
 test('disconnect during capture preserves incomplete truth',()=>{const f=captureFixture();f.cap.open({trigger_ts:now,trigger_seq:0});f.feed({record_type:'RADIO_DISCONNECTED'},1000);f.advance(120000);const a=f.s.db.prepare('SELECT * FROM incidents').get();assert.equal(a.post_trigger_complete,0);assert.equal(a.post_capture_state,'INCOMPLETE');f.s.close();});
 test('immutable natural replay persists one incident, direct TX_FAULT precursor, first abnormal and NULL historic health',()=>{
  const manifest='docs/measurements/au510m-natural-oscillation-2026-10-07.json';const before=createHash('sha256').update(fs.readFileSync(manifest)).digest('hex');const raw=JSON.parse(fs.readFileSync(JSON.parse(fs.readFileSync(manifest)).fixture));let t=raw.records[0].ts_ms,seq=0;const s=new Store({...fixture(),now:()=>t});const writer={write:p=>{s.write(p);return Promise.resolve();},request:()=>Promise.resolve(),close:()=>Promise.resolve()};const cap=new Capture({history:ms=>raw.records.filter(r=>r.seq<=seq&&t-r.ts_ms<=ms),writer,wall:()=>t,mono:()=>t-raw.records[0].ts_ms,boundary:()=>({oldest_ts:raw.records[0].ts_ms,oldest_age_seconds:(t-raw.records[0].ts_ms)/1000,source_overflow:raw.omitted_record_types?.length?1:0})});
  for(const r of raw.records){t=r.ts_ms;seq=r.seq;cap.consume(r);}for(const c of [...cap.active.values()])cap.finish(c,'INTERRUPTED');
  assert.equal(s.metrics().sqlite_incident_count,1);const a=s.db.prepare('SELECT * FROM incidents').get();assert.equal(a.precursor_fault,'TX_FAULT');assert.equal(a.precursor_fault_seq,18185);assert.equal(a.precursor_fault_confidence,'DIRECT');assert.equal(a.first_abnormal_event,'RX_RETURN_WHILE_TUNE_ACTIVE');assert.equal(a.post_trigger_complete,0);assert.equal(a.pre_trigger_complete,0,'compact fixture omitted record classes; time coverage alone is insufficient');assert.equal(a.pre_window_available_seconds,120);assert.equal(a.precursor_fault_reason,null);assert(s.metrics().sqlite_state_event_count>0);assert(s.metrics().sqlite_health_sample_count>0);assert.equal(s.db.prepare('SELECT count(*) n FROM health_samples WHERE FWDPWR_W IS NOT NULL OR SWR IS NOT NULL').get().n,0);const out=fs.readFileSync(s.filename(a.incident_id),'utf8');assert(!/client_handle|session_id|journal_cursor|raw_source|process_id|run_id/.test(out));assert.equal(createHash('sha256').update(fs.readFileSync(manifest)).digest('hex'),before);s.close();
 });
 test('source overflow and input reversal cannot yield complete capture',()=>{
  const f=captureFixture();f.cap.open({trigger_ts:now,trigger_seq:0});f.feed({record_type:'HEALTH'},1000);f.cap.consume({record_type:'HEALTH',seq:0,ts_ms:now});f.advance(120000);assert.equal(f.s.db.prepare('SELECT post_trigger_complete FROM incidents').get().post_trigger_complete,0);f.s.close();
 });
 const f=fixture(),metrics={},writer=new Writer({...f,metrics});assert(await writer.started);await writer.write({incident:meta('AU510M-worker')});assert.equal(metrics.sqlite_incident_count,1);await writer.close();console.log('PASS real worker lifecycle and serialized SQLite writes');
 const failedMetrics={},bad=new Writer({dbPath:'/dev/null/not-a-db',exportDir:path.join(base,'bad'),metrics:failedMetrics});assert.equal(await bad.started,false);await assert.rejects(bad.write({incident:meta('AU510M-failed')}));await bad.close();assert.equal(failedMetrics.sqlite_status,'ERROR');console.log('PASS worker DB initialization failure degrades diagnostics only');
 const brokenMetrics={},broken=new Writer({...fixture(),metrics:brokenMetrics});assert(await broken.started);await broken.write({incident:meta('AU510M-before-failure')});await assert.rejects(broken.write({records:[{...event(1),incident_id:'AU510M-does-not-exist'}]}));assert.equal(brokenMetrics.sqlite_status,'ERROR');await assert.rejects(broken.write({incident:meta('AU510M-must-not-complete')}));await broken.close();console.log('PASS real SQLite transaction failure rejects later writes and degrades safely');
 let t=0;const d=new DiagnosticBuffer({version:'offline',wall:()=>now+t,mono:()=>t});let failedWrites=0;const c=new Capture({history:()=>d.records(),metrics:d.data.metrics,writer:{write:()=>{failedWrites++;return Promise.reject(Error('failure'));},close:()=>Promise.resolve()},wall:()=>now+t,mono:()=>t});const original=d.add;d.add=function(r,m){original.call(this,r,m);c.consume(r);};c.open({trigger_ts:now,trigger_seq:0});await Promise.resolve();d.connection(true);d.interlock({state:'READY'});t+=1000;d.tick({});assert(failedWrites>0);assert(d.count>0);assert(d.data.metrics.total_health_samples>0);assert.equal(d.config.maxRecords,12000);assert.equal(d.config.rxHz,1);assert.equal(d.config.txHz,5);assert.equal(DEFAULTS.retentionMs,240000);await c.close();console.log('PASS RAM continues after DB failure; ring and sampling unchanged');
 console.log('PASS persistent diagnostics acceptance');
} finally {fs.rmSync(base,{recursive:true,force:true});}
