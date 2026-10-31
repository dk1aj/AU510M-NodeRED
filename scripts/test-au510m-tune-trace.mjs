import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const {DiagnosticBuffer}=require('../diagnostics/au510m-stage1-core.cjs');
const {IncidentDetector}=require('../diagnostics/au510m-incident-detector.cjs');
const {observe}=require('../diagnostics/au510m-command-observer.cjs');
const {Radio}=require('flexradio-js/Radio');
const {Store}=require('../diagnostics/au510m-persistence-store.cjs');
const S=require('../diagnostics/au510m-persistence-sanitize.cjs');
const {generate,exportClock}=require('../diagnostics/au510m-incident-export.cjs');
const {ExportClient}=require('../diagnostics/au510m-export-client.cjs');
let time=1793454765387;
const core=new DiagnosticBuffer({version:'4.35',wall:()=>time,mono:()=>time});
const radio=new EventEmitter(),owner=new EventEmitter();
Object.assign(radio,{nextRequestSequenceNumber:1,requests:{},client_handle:'0x12345678',_sendRequest:Radio.prototype._sendRequest,_receiveMessage:Radio.prototype._receiveMessage,connection:{localAddress:'127.0.0.1',localPort:45000,write:line=>{
 assert(core.records().some(r=>r.record_type==='COMMAND_REQUEST'&&line.includes(r.new_value)),'Request was not traced before write');wire.push(line);
}}});
const wire=[];owner.radio=radio;owner.send=function(msg,cb){return this.radio._sendRequest(msg.payload,cb);};
const originalReceive=radio._receiveMessage;
const observer=observe({owner,core,sourceFor:()=>({command_source_node_id:'au510m_live_state'})});
radio.on('status',m=>{if(m.topic==='transmit')core.tune(m.payload.tune,m.client,{decoded:m,wire:observer.statusEvidence()});});
const tx=state=>{time+=5;core.interlock({state:state==='TX'?'TRANSMITTING':'READY'});core.canonical({connected:true,fields:{'TX/RX':state,Frequency:'14.074 MHz',Mode:'DIGU','Active slice':'A'}});};
const tune=value=>{time+=5;radio._receiveMessage(`S12345678|transmit tune=${value}`);};
core.connection(true);tx('RX');tune(0);
// 1: normal on/off, repeated identical status is not a new event; unmodified wire evidence.
owner.send({payload:'transmit tune 1'});tune(1);const on=core.records().findLast(r=>r.record_type==='TUNE_CANDIDATE');
assert.equal(on.diagnostic_metadata.event_type,'TUNE_STATE_CHANGE');assert.equal(on.diagnostic_metadata.previous_tune_state,0);assert.equal(on.diagnostic_metadata.tune_state,1);
assert.equal(on.diagnostic_metadata.command_origin,'UNKNOWN');assert.equal(on.diagnostic_metadata.client_program,'UNKNOWN');
assert.equal(on.diagnostic_metadata.last_tune_command_source,'NODE_RED');assert.equal(on.diagnostic_metadata.last_tune_command_node_id,'au510m_live_state');
assert.equal(on.diagnostic_metadata.last_known_client,'0x12345678');assert.equal(on.diagnostic_metadata.command_link_confidence,'UNKNOWN');
assert.equal(on.raw_evidence.wire,'S12345678|transmit tune=1');assert.equal(on.raw_evidence.decoded.payload.tune,1);
const count=core.records().filter(r=>r.record_type==='TUNE_CANDIDATE').length;tune(1);assert.equal(core.records().filter(r=>r.record_type==='TUNE_CANDIDATE').length,count);tune(0);
// 2-4: real reducer paths, completed TUNE -> TX -> RX cycles and reactivation.
let fed=0;const detector=new IncidentDetector({mono:()=>time,history:ms=>core.records().filter(r=>r.seq<=fed&&time-r.ts_ms<=ms).reverse()});
const feed=()=>{for(const r of core.records().filter(r=>r.seq>fed)){fed=r.seq;detector.consume(r);}};
feed();
for(let i=0;i<4;i++){owner.send({payload:'transmit tune 1'});tune(1);tx('TX');tune(0);tx('RX');feed();}
const incident=detector.data.active_incident??detector.data.last_incident;
assert(incident,'Oscillation detection lost');assert.equal(incident.incident_type,'TUNE_RX_OSCILLATION');assert.equal(incident.first_abnormal_event,'TUNE_REACTIVATED_AFTER_RX');
assert.equal(incident.diagnostic_metadata.event_type,'TUNE_REACTIVATED_AFTER_RX');assert.equal(incident.diagnostic_metadata.last_tune_command,'transmit tune 1');assert.equal(incident.provenance.command_origin,'UNKNOWN');assert(incident.cycle_count>=3);
const request=core.records().findLast(r=>r.record_type==='COMMAND_REQUEST');assert.equal(request.diagnostic_metadata.source_ip,'127.0.0.1');assert.equal(request.diagnostic_metadata.source_port,45000);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'au510m-tune-trace-'));let store,client;
try{
 const dbPath=path.join(dir,'history.sqlite'),exportDir=path.join(dir,'exports');
 store=new Store({dbPath,exportDir:path.join(dir,'legacy'),now:()=>time});
 const row={...S.incident(incident,'AU510M-trace-test'),post_capture_state:'COMPLETE',post_trigger_complete:1};
 store.write({incident:row,records:core.records().map(S.record).filter(Boolean).map(r=>({...r,incident_id:row.incident_id})),complete:true});
 const stored=store.db.prepare("SELECT * FROM state_events WHERE record_type='TUNE_CANDIDATE' AND tune_value=1 ORDER BY seq LIMIT 1").get();
 assert.equal(JSON.parse(stored.diagnostic_metadata).last_tune_command_source,'NODE_RED');assert.equal(JSON.parse(stored.raw_evidence).wire,on.raw_evidence.wire);
 assert(fs.readFileSync(store.filename(row.incident_id),'utf8').includes(on.raw_evidence.wire));
 // 5-6: same incident twice + different incident at exactly the same export millisecond.
 const args={dbPath,exportDir,version:'4.35',exportTime:1793454765387};
 const a=generate({...args,id:row.incident_id}),b=generate({...args,id:row.incident_id});
 const second={...row,incident_id:'AU510M-trace-second'};store.write({incident:second});const c=generate({...args,id:second.incident_id});
 assert.equal(new Set([a.filename,b.filename,c.filename]).size,3);
 assert.match(a.filename,/^AU510M-\d{8}-\d{6}-387-TUNE_RX_OSCILLATION-[a-f0-9]{32}\.zip$/);
 const zip=path.join(exportDir,a.filename),get=name=>execFileSync('unzip',['-p',zip,name],{encoding:'utf8'});
 const metadata=JSON.parse(get('incident.json'));assert.equal(metadata.export_timestamp,exportClock(args.exportTime).timestamp);assert.equal(metadata.zip_filename,a.filename);assert.equal(metadata.incident_timestamp,row.trigger_ts);assert.notEqual(Date.parse(metadata.incident_timestamp),args.exportTime);
 for(const k of ['incident_id','incident_type','incident_timestamp','export_timestamp','zip_filename','radio','frequency','mode','trigger','pre_capture_complete','post_capture_complete','dropped_records','diagnostic_version'])assert(Object.hasOwn(metadata,k),k);
 const exported=get('events.jsonl').trim().split('\n').map(JSON.parse).find(r=>r.seq===on.seq);assert.deepEqual(exported.raw_evidence,on.raw_evidence);assert.deepEqual(exported.diagnostic_metadata,on.diagnostic_metadata);
 // A forced random-ID collision must fail without changing the existing ZIP bytes.
 const previous=fs.readFileSync(zip),collisionModule={exports:{}};
 const localRequire=createRequire(new URL('../diagnostics/au510m-incident-export.cjs',import.meta.url));
 vm.runInThisContext('(function(require,module){'+fs.readFileSync('diagnostics/au510m-incident-export.cjs','utf8')+'})')(name=>name==='node:crypto'?{randomBytes:()=>Buffer.from(a.exportId,'hex')}:localRequire(name),collisionModule);
 assert.throws(()=>collisionModule.exports.generate({...args,id:row.incident_id}),/EEXIST/);
 assert.deepEqual(fs.readFileSync(zip),previous);assert(!fs.readdirSync(exportDir).some(f=>f.endsWith('.tmp')));
 const pending=path.join(exportDir,`export-${a.exportId}.zip.tmp`);fs.writeFileSync(pending,'existing export in progress');assert.throws(()=>collisionModule.exports.generate({...args,id:row.incident_id}),/EEXIST/);assert.equal(fs.readFileSync(pending,'utf8'),'existing export in progress');fs.unlinkSync(pending);
 // Worker captures actual export-start clock, logs once and preserves HTTP attachment name.
 const logs=[],start=Date.now();client=new ExportClient({dbPath,exportDir,version:'4.35',log:r=>logs.push(r)});const out=await client.generate(row.incident_id);
 assert.equal(out.status,'READY');assert(Date.parse(out.export_timestamp)>=start&&Date.parse(out.export_timestamp)<=Date.now());assert.equal(logs.length,1);assert.equal(logs[0].event_type,'EXPORT_CREATED');assert.equal(logs[0].zip_path,path.join(exportDir,out.filename));
 const {Writable}=require('node:stream'),res=new Writable({write(_c,_e,cb){cb();}});res.status=n=>{assert.equal(n,200);return res;};res.set=h=>assert.equal(h['Content-Disposition'],`attachment; filename="${out.filename}"`);await client.download(out.exportId,res);
 // Exact local timestamp includes DST offset, never incident UTC or an implicit browser clock.
 const berlin=execFileSync(process.execPath,['-e',"console.log(require(process.argv[1]).exportClock(1793454765387).timestamp)",path.resolve('diagnostics/au510m-incident-export.cjs')],{encoding:'utf8',env:{...process.env,TZ:'Europe/Berlin'}}).trim();assert.equal(berlin,'2026-10-31T14:52:45.387+01:00');
 const summer=execFileSync(process.execPath,['-e',"console.log(require(process.argv[1]).exportClock(Date.parse('2026-07-01T12:00:00Z')).timestamp)",path.resolve('diagnostics/au510m-incident-export.cjs')],{encoding:'utf8',env:{...process.env,TZ:'Europe/Berlin'}}).trim();assert.equal(summer,'2026-07-01T14:00:00.000+02:00');
}finally{await client?.close();store?.close();fs.rmSync(dir,{recursive:true,force:true});}
core.connection(false);core.connection(true);tune(1);assert.equal(core.records().findLast(r=>r.record_type==='TUNE_CANDIDATE').diagnostic_metadata.last_tune_command,'UNKNOWN');
observer.close();assert.equal(radio._receiveMessage,originalReceive);assert.equal(observer.statusEvidence(),null);
console.log('PASS TUNE tracing cases 1-6: on/off, TX/RX, exact reactivation evidence, repeated cycles, SQLite/JSONL/ZIP raw evidence, UNKNOWN causality, unique same-ms exports, collision no-overwrite, local/DST timestamps, EXPORT_CREATED, HTTP filename and epoch reset.');
