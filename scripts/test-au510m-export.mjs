import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import vm from 'node:vm';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),S=require('../diagnostics/au510m-persistence-sanitize.cjs'),P=require('../diagnostics/au510m-export-policy.cjs');
const {Store}=require('../diagnostics/au510m-persistence-store.cjs'),{generate,cleanup,RETENTION}=require('../diagnostics/au510m-incident-export.cjs'),{ExportClient}=require('../diagnostics/au510m-export-client.cjs'),{IncidentDetector}=require('../diagnostics/au510m-incident-detector.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'au510m-export-test-')),dbPath=path.join(dir,'fixture.sqlite'),exportDir=path.join(dir,'exports');let store,client;
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function unpack(result){const zip=path.join(exportDir,result.filename);assert.match(execFileSync('unzip',['-t',zip],{encoding:'utf8'}),/No errors detected/);assert.deepEqual(execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).trim().split('\n'),['incident.json','events.jsonl','health.jsonl','README.txt']);const get=name=>execFileSync('unzip',['-p',zip,name],{encoding:'utf8'});return {incident:JSON.parse(get('incident.json')),events:get('events.jsonl').trim().split('\n').filter(Boolean).map(JSON.parse),health:get('health.jsonl').trim().split('\n').filter(Boolean).map(JSON.parse),readme:get('README.txt')};}
try{
 const fixture='diagnostics/fixtures/stage2-v423-natural-oscillation.json',original=hash(fixture),raw=JSON.parse(fs.readFileSync(fixture));let time=raw.records[0].ts_ms,seq=0;
 store=new Store({dbPath,exportDir:path.join(dir,'legacy'),now:()=>time});
 const detector=new IncidentDetector({mono:()=>time-raw.records[0].ts_ms,history:ms=>raw.records.filter(r=>r.seq<=seq&&time-r.ts_ms<=ms).reverse(),boundary:()=>({oldest_ts:raw.records[0].ts_ms,oldest_age_seconds:(time-raw.records[0].ts_ms)/1000,source_overflow:1})});
 for(const r of raw.records){time=r.ts_ms;seq=r.seq;detector.consume(r);}
 const natural=detector.data.active_incident??detector.data.last_incident;const incident={...S.incident(natural,'AU510M-natural-export'),post_capture_state:'INTERRUPTED',post_trigger_complete:0};
 const records=raw.records.map(S.record).filter(Boolean).map(r=>({...r,incident_id:incident.incident_id}));
 records.push({...S.record({ts_ms:time+20,seq:100000,record_type:'HEALTH',meters:Object.fromEntries(Object.values(S.HEALTH).map(topic=>[topic,{value:0,quality:'FRESH'}]))}),incident_id:incident.incident_id});
 records.push({...S.record({ts_ms:time+10,seq:99999,record_type:'HEALTH'}),incident_id:incident.incident_id});
 store.write({incident,records:records.reverse()});
 const empty=S.incident({trigger_ts:time,incident_type:'EMPTY_OFFLINE'},'AU510M-empty-export');store.write({incident:empty});
 const rowsBefore=Object.fromEntries(['incidents','state_events','health_samples'].map(t=>[t,JSON.stringify(store.db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all())]));
 const result=generate({dbPath,exportDir,id:incident.incident_id,version:'4.30'}),out=unpack(result);
 assert.equal(out.incident.incident_type,'TUNE_RX_OSCILLATION');assert.equal(out.incident.cycle_count,38);assert.equal(out.incident.precursor_fault,'TX_FAULT');assert.equal(out.incident.first_abnormal_event,'RX_RETURN_WHILE_TUNE_ACTIVE');assert.equal(out.incident.origin_confidence,'UNKNOWN');assert.equal(out.incident.command_origin,'UNKNOWN');assert.equal(out.incident.post_capture_state,'INTERRUPTED');assert.equal(out.incident.precursor_fault_confidence,'DIRECT');
 for(const a of [out.events,out.health])for(let i=1;i<a.length;i++)assert(a[i].ts_ms>a[i-1].ts_ms||a[i].ts_ms===a[i-1].ts_ms&&a[i].seq>=a[i-1].seq);
 assert.equal(out.health.at(-2).FWDPWR_W,null);assert.equal(out.health.at(-1).FWDPWR_W,0);assert.match(out.readme,/precursor event is not proof of causality/);assert.match(out.readme,/PRE PARTIAL \/ POST INTERRUPTED/);assert.match(out.readme,/v4\.30/);
 const poison={client_handle:'SECRET',session_id:'SECRET',journal_cursor:'SECRET',process_id:123,pid:321,socket_id:'SECRET',raw_source:{password:'SECRET'},token:'SECRET',credentials:'SECRET',private_key:'SECRET',mode:'/tmp/runtime-private',event_value:'http://private/token',client_name:'opaque-client-id',trigger_origin:'192.168.1.2',origin_confidence:'INVALID'};
 for(const fields of [P.incidentFields,P.eventFields,P.healthFields]){const safe=P.project({...poison},fields),json=JSON.stringify(safe);assert(!/SECRET|client_handle|session_id|journal_cursor|process_id|socket_id|runtime-private|opaque-client-id/.test(json));}
 assert(!/client_handle|session_id|journal_cursor|process_id|raw_source|run_id/.test(JSON.stringify(out)));
 for(const bad of ['../private','AU510M-../x','AU510M-x%2fsecret','AU510M-'+ 'a'.repeat(121),null,"' OR 1=1"]){assert.throws(()=>generate({dbPath,exportDir,id:bad,version:'4.30'}),/INVALID_INCIDENT_ID/);}
 assert.throws(()=>generate({dbPath,exportDir,id:'AU510M-absent',version:'4.30'}),/INCIDENT_NOT_FOUND/);
 const e=unpack(generate({dbPath,exportDir,id:empty.incident_id,version:'4.30'}));assert.deepEqual(e.events,[]);assert.deepEqual(e.health,[]);assert.equal(e.incident.frequency_hz,null);assert.equal(e.incident.tune_active_at_trigger,null);
 assert.throws(()=>generate({dbPath,exportDir,id:incident.incident_id,version:'4.30',limits:{rows:1,bytes:16*1024*1024}}),/EXPORT_TOO_LARGE/);
 assert.throws(()=>generate({dbPath,exportDir,id:empty.incident_id,version:'4.30',limits:{rows:50000,bytes:1000}}),/EXPORT_TOO_LARGE/);
 // Inject disk failure after temp creation; no incomplete ZIP may survive.
 const {Zip}=require('../diagnostics/au510m-export-zip.cjs'),write=Zip.prototype.write;
 try{Zip.prototype.write=function(){throw Error('OFFLINE_DISK_FAILURE');};assert.throws(()=>generate({dbPath,exportDir,id:empty.incident_id,version:'4.30'}),/OFFLINE_DISK_FAILURE/);}finally{Zip.prototype.write=write;}
 assert(!fs.readdirSync(exportDir).some(f=>f.endsWith('.tmp')),'Failed export left a temp file');
 for(const [t,v] of Object.entries(rowsBefore))assert.equal(JSON.stringify(store.db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()),v,'Export mutated SQLite');
 // Production opens readOnly; missing databases cannot be created.
 assert.throws(()=>generate({dbPath:path.join(dir,'missing.sqlite'),exportDir,id:empty.incident_id,version:'4.30'}));assert(!fs.existsSync(path.join(dir,'missing.sqlite')));
 const old=path.join(exportDir,result.filename);fs.utimesSync(old,new Date(Date.now()-RETENTION-1000),new Date(Date.now()-RETENTION-1000));
 const unrelated=path.join(exportDir,'keep.sqlite'),orphan=path.join(exportDir,'export-'+ 'a'.repeat(32)+'.zip.tmp');fs.writeFileSync(unrelated,'keep');fs.writeFileSync(orphan,'partial');fs.utimesSync(orphan,new Date(0),new Date(0));
 assert.equal(cleanup(exportDir),2);assert(!fs.existsSync(old));assert(fs.existsSync(unrelated));
 fs.writeFileSync(old,'expired offline ZIP');fs.utimesSync(old,new Date(0),new Date(0));fs.writeFileSync(orphan,'fresh orphan');
 client=new ExportClient({dbPath,exportDir,version:'4.30'});const r=await client.generate(incident.incident_id);assert.equal(r.status,'READY');assert(!fs.existsSync(old));assert(!fs.existsSync(orphan),'Startup left an orphan temp');assert.equal(client.timer._idleTimeout,6*3600000);unpack(r);assert.equal(client.metrics.total_exports,1);assert.equal(client.metrics.last_export_status,'READY');assert.equal(client.metrics.last_export_size_bytes,fs.statSync(path.join(exportDir,r.filename)).size);
 assert.equal((await client.generate('../')).status,'INVALID');assert.equal((await client.generate('AU510M-absent')).error,'INCIDENT_NOT_FOUND');assert.equal(client.metrics.last_export_status,'ERROR');
 const {Writable}=require('node:stream');
 async function download(id){const chunks=[];const res=new Writable({write(chunk,enc,cb){chunks.push(chunk);cb();}});res.headers={};res.status=n=>{res.code=n;return res;};res.set=h=>{Object.assign(res.headers,h);};res.json=obj=>{res.end(JSON.stringify(obj));};await client.download(id,res);return {res,body:Buffer.concat(chunks)};}
 let dl=await download(r.exportId);assert.equal(dl.res.code,200);assert.equal(dl.res.headers['Content-Type'],'application/zip');assert.equal(dl.body.length,r.sizeBytes);
 for(const bad of ['..','../x','%2e%2e%2f','%252e%252e','/tmp/private','C:\\private','x.zip',r.filename,r.exportId+'.zip'])assert.equal((await download(bad)).res.code,400);
 assert.equal((await download('f'.repeat(32))).res.code,404);
 const file=path.join(exportDir,r.filename);fs.unlinkSync(file);fs.symlinkSync(unrelated,file);assert.equal((await download(r.exportId)).res.code,404);fs.unlinkSync(file);
 assert.equal(hash(fixture),original,'Natural source evidence changed');
 const ignored=execFileSync('git',['check-ignore','data/exports/sample.zip','data/exports/export-test.zip.tmp','data/au510m-diagnostics.sqlite','data/au510m-diagnostics.sqlite-wal','data/au510m-diagnostics.sqlite-shm','data/evidence/local.json'],{encoding:'utf8'}).trim().split('\n');assert.equal(ignored.length,6);
 // UI: selected incident only, disabled empty/error/busy, feedback, download, stale selection and failure isolation.
 const source=JSON.parse(fs.readFileSync('flows.json')).find(n=>n.id==='9b1bcb4b21cd24ff').format;let fetchImpl,clicks=0;
 const options=vm.runInNewContext('('+source.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^\s*export default/,'')+')',{Date,Intl,AbortController,setTimeout,clearTimeout,fetch:(...a)=>fetchImpl(...a),document:{createElement:()=>({click:()=>clicks++,remove(){}}),body:{appendChild(){}}}});
 const view=options.data();for(const[k,v]of Object.entries(options.methods))view[k]=v.bind(view);for(const[k,v]of Object.entries(options.computed))Object.defineProperty(view,k,{get:()=>v.call(view)});
 assert.equal(view.canExport,false);await view.exportIncident();assert.equal(clicks,0);
 Object.assign(view,{historyState:'ready',detailState:'ready',historyRows:[{id:incident.incident_id}],selectedId:incident.incident_id,selectedDetail:{id:incident.incident_id}});assert.equal(view.canExport,true);
 fetchImpl=async(url,opts)=>{assert.equal(url,'/au510m-diag/incident/'+incident.incident_id+'/export');assert.equal(opts.method,'POST');assert.equal(view.exportStatus,'EXPORTING');assert.equal(view.canExport,false);return {ok:true,json:async()=>r};};await view.exportIncident();assert.equal(view.exportStatus,'READY');assert.equal(clicks,1);
 view.liveSnapshot={diagState:'RADIO_RX'};fetchImpl=async()=>{throw Error('failure');};await view.exportIncident();assert.equal(view.exportStatus,'EXPORT ERROR');assert.equal(view.liveSnapshot.diagState,'RADIO_RX');assert.equal(view.detailState,'ready');
 assert(source.includes(':disabled="!canExport"'));assert(!source.includes('this.send('));
 // Scope guard: existing non-DIAG nodes and canonical observer are byte-for-byte unchanged (except central release env).
 const before=JSON.parse(execFileSync('git',['show','HEAD:flows.json'],{encoding:'utf8'})),after=JSON.parse(fs.readFileSync('flows.json'));
 for(const n of before)if(!['9b1bcb4b21cd24ff','au510m_agct_watcher_tab'].includes(n.id)&&!n.env?.some(e=>e.name==='WATCHER_VERSION'))assert.deepEqual(after.find(x=>x.id===n.id),n,'Unrelated flow changed: '+n.id);
 console.log('PASS export: four valid ZIP entries/CRC, immutable natural 38-cycle fixture, chronological records, NULL/UNKNOWN/zero, strict allowlists, read-only selected SQL, empty/missing/oversize/failure cleanup, seven-day retention, ignored data, worker metrics, streamed capability downloads, traversal/symlink rejection, UI states/failure isolation and unchanged canonical paths.');
}finally{await client?.close();store?.close();fs.rmSync(dir,{recursive:true,force:true});}
