'use strict';
// Synchronous SQLite implementation runs exclusively inside the writer worker in production.
const fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {HEALTH}=require('./au510m-persistence-sanitize.cjs');
const INCIDENT=`incident_id TEXT PRIMARY KEY,incident_type TEXT,trigger_ts TEXT,trigger_ts_ms INTEGER,trigger_seq INTEGER,window_start_ts TEXT,window_end_ts TEXT,cycle_count INTEGER,duration_ms INTEGER,first_cycle_seq INTEGER,last_cycle_seq INTEGER,first_abnormal_event TEXT,first_abnormal_seq INTEGER,precursor_fault TEXT,precursor_fault_ts TEXT,precursor_fault_seq INTEGER,precursor_fault_age_ms INTEGER,precursor_fault_source TEXT,precursor_fault_reason TEXT,precursor_fault_confidence TEXT,frequency_hz REAL,mode TEXT,active_slice TEXT,tune_active_at_trigger INTEGER,tune_fresh_at_trigger INTEGER,trigger_origin TEXT,command_origin TEXT,origin_confidence TEXT,post_capture_state TEXT,pre_trigger_complete INTEGER,post_trigger_complete INTEGER,created_at TEXT,completed_at TEXT,pre_window_available_seconds REAL,dropped_records INTEGER,incomplete_reason TEXT`;
const COMMON='ts TEXT,ts_ms INTEGER,seq INTEGER,frequency_hz REAL,mode TEXT,active_slice TEXT,interlock_state TEXT,interlock_reason TEXT,tune_value INTEGER,tune_fresh INTEGER';
class Store {
 constructor({dbPath,exportDir,now=Date.now}){this.dbPath=dbPath;this.exportDir=exportDir;this.now=now;this.lastWrite=null;
  fs.mkdirSync(path.dirname(dbPath),{recursive:true,mode:0o700});fs.mkdirSync(exportDir,{recursive:true,mode:0o700});
  if(!fs.existsSync(dbPath))fs.closeSync(fs.openSync(dbPath,'wx',0o600));
  this.db=new DatabaseSync(dbPath);fs.chmodSync(dbPath,0o600);
  this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  if(this.db.prepare('PRAGMA journal_mode').get().journal_mode!=='wal')throw Error('WAL_REQUIRED');
  this.db.exec(`CREATE TABLE IF NOT EXISTS incidents(${INCIDENT});
   CREATE TABLE IF NOT EXISTS state_events(id INTEGER PRIMARY KEY AUTOINCREMENT,incident_id TEXT NOT NULL,${COMMON},record_type TEXT NOT NULL,old_state TEXT,new_state TEXT,state_confidence TEXT,state_reason TEXT,source_event_seq INTEGER,derived_from_seq INTEGER,tx_state TEXT,event_name TEXT,event_value TEXT,origin_confidence TEXT,trigger_origin TEXT,command_origin TEXT,client_name TEXT,source TEXT,FOREIGN KEY(incident_id) REFERENCES incidents(incident_id),UNIQUE(incident_id,seq,record_type));
   CREATE TABLE IF NOT EXISTS health_samples(id INTEGER PRIMARY KEY AUTOINCREMENT,incident_id TEXT NOT NULL,${COMMON},${Object.keys(HEALTH).map(k=>k+' REAL').join(',')},FOREIGN KEY(incident_id) REFERENCES incidents(incident_id),UNIQUE(incident_id,seq));
   CREATE TABLE IF NOT EXISTS logger_meta(key TEXT PRIMARY KEY,value TEXT);
   INSERT OR IGNORE INTO logger_meta VALUES('schema_version','1');
   CREATE INDEX IF NOT EXISTS state_events_incident ON state_events(incident_id);CREATE INDEX IF NOT EXISTS state_events_time ON state_events(ts_ms);CREATE INDEX IF NOT EXISTS state_events_seq ON state_events(seq);
   CREATE INDEX IF NOT EXISTS health_samples_incident ON health_samples(incident_id);CREATE INDEX IF NOT EXISTS health_samples_time ON health_samples(ts_ms);CREATE INDEX IF NOT EXISTS health_samples_seq ON health_samples(seq);`);
  this.columns={};this.inserts={};for(const table of ['incidents','state_events','health_samples']){const cols=this.db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name).filter(c=>c!=='id');this.columns[table]=cols;const onConflict=table==='incidents'?'ON CONFLICT(incident_id) DO UPDATE SET '+cols.filter(c=>c!=='incident_id').map(c=>`${c}=excluded.${c}`).join(','):'ON CONFLICT DO NOTHING';this.inserts[table]=this.db.prepare(`INSERT INTO ${table}(${cols.join(',')}) VALUES(${cols.map(()=>'?').join(',')}) ${onConflict}`);}
  this.db.prepare("UPDATE incidents SET post_capture_state='INTERRUPTED',post_trigger_complete=0,incomplete_reason='RUNTIME_RESTART',completed_at=? WHERE post_capture_state='COLLECTING'").run(new Date(now()).toISOString());
  for(const suffix of ['-wal','-shm'])if(fs.existsSync(dbPath+suffix))fs.chmodSync(dbPath+suffix,0o600);
  // Recover an export that failed after its database completion transaction.
  for(const r of this.db.prepare("SELECT incident_id FROM incidents WHERE post_capture_state IN('COMPLETE','INCOMPLETE','INTERRUPTED')").all())if(!fs.existsSync(this.filename(r.incident_id)))this.export(r.incident_id);
  this.retention();
 }
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{fn();this.db.exec('COMMIT');this.lastWrite=Date.now();}catch(e){this.db.exec('ROLLBACK');throw e;}}
 insert(table,row){this.inserts[table].run(...this.columns[table].map(c=>row[c]??null));}
 write({incident,records=[],complete=false}){const started=performance.now();this.transaction(()=>{if(incident)this.insert('incidents',incident);for(const r of records){if(!['event','health'].includes(r.kind))continue;this.insert(r.kind==='health'?'health_samples':'state_events',r);}});if(complete&&['COMPLETE','INCOMPLETE','INTERRUPTED'].includes(incident.post_capture_state))this.export(incident.incident_id);return {...this.metrics(),write_latency_ms:performance.now()-started};}
 filename(id){if(!/^AU510M-[a-zA-Z0-9-]+$/.test(id))throw Error('INVALID_INCIDENT_ID');return path.join(this.exportDir,id+'.jsonl');}
 export(id){const incident=this.db.prepare('SELECT * FROM incidents WHERE incident_id=?').get(id);if(!incident||!['COMPLETE','INCOMPLETE','INTERRUPTED'].includes(incident.post_capture_state))return;
  const file=this.filename(id),tmp=file+'.tmp';const fd=fs.openSync(tmp,'w',0o600);try{fs.writeSync(fd,JSON.stringify({kind:'incident',...incident})+'\n');
   // Incremental ordered merge avoids a full 240-second export copy in memory.
   const events=this.db.prepare('SELECT * FROM state_events WHERE incident_id=? ORDER BY ts_ms,seq').iterate(id)[Symbol.iterator]();const health=this.db.prepare('SELECT * FROM health_samples WHERE incident_id=? ORDER BY ts_ms,seq').iterate(id)[Symbol.iterator]();let e=events.next(),h=health.next();while(!e.done||!h.done){const useEvent=h.done||!e.done&&(e.value.ts_ms<h.value.ts_ms||e.value.ts_ms===h.value.ts_ms&&e.value.seq<=h.value.seq);const value=useEvent?e.value:h.value;const {id:rowId,...safe}=value;fs.writeSync(fd,JSON.stringify({kind:useEvent?'event':'health',...safe})+'\n');if(useEvent)e=events.next();else h=health.next();}
  }finally{fs.closeSync(fd);}fs.renameSync(tmp,file);
 }
 retention(){const n=this.now();this.transaction(()=>{this.db.prepare("DELETE FROM health_samples WHERE ts_ms<? AND incident_id IN(SELECT incident_id FROM incidents WHERE post_capture_state!='COLLECTING')").run(n-48*3600000);this.db.prepare("DELETE FROM state_events WHERE ts_ms<? AND incident_id IN(SELECT incident_id FROM incidents WHERE post_capture_state!='COLLECTING')").run(n-30*86400000);});}
 metrics(){const counts={};for(const [k,t]of [['incident','incidents'],['state_event','state_events'],['health_sample','health_samples']])counts['sqlite_'+k+'_count']=this.db.prepare(`SELECT count(*) n FROM ${t}`).get().n;return {sqlite_status:'READY',sqlite_last_error:null,sqlite_last_write_ts:this.lastWrite,sqlite_db_size_bytes:['','-wal','-shm'].reduce((sum,s)=>sum+(fs.existsSync(this.dbPath+s)?fs.statSync(this.dbPath+s).size:0),0),...counts};}
 close(){this.db.close();}
}
module.exports={Store};
