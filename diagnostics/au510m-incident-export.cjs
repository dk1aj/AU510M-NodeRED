'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomBytes}=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const P=require('./au510m-export-policy.cjs'),{Zip}=require('./au510m-export-zip.cjs');
const LIMITS={rows:50000,bytes:16*1024*1024};
const RETENTION=7*86400000;
function directory(dir){fs.mkdirSync(dir,{recursive:true,mode:0o700});if(!fs.lstatSync(dir).isDirectory()||fs.lstatSync(dir).isSymbolicLink())throw Error('EXPORT_DIRECTORY_UNAVAILABLE');}
function cleanup(dir,now=Date.now()){
 directory(dir);let removed=0;
 for(const file of fs.readdirSync(dir)){
  // Only this exporter owns these exact names. Never touch SQLite, legacy JSONL or unrelated files.
  const zip=P.FILE.test(file),tmp=/^export-[a-f0-9]{32}\.zip\.tmp$/.test(file);
  if(!zip&&!tmp)continue;const p=path.join(dir,file),s=fs.lstatSync(p);
  if(s.isFile()&&!s.isSymbolicLink()&&(zip?now-s.mtimeMs>RETENTION:true)){fs.unlinkSync(p);removed++;}
 }
 return removed;
}
function *lines(db,table,fields,id){for(const r of db.prepare(`SELECT ${fields.join(',')} FROM ${table} WHERE incident_id=? ORDER BY ts_ms,seq,id`).iterate(id))yield JSON.stringify(P.project(r,fields))+'\n';}
function exportClock(ms){
 const d=new Date(ms),pad=(n,w=2)=>String(n).padStart(w,'0');
 if(!Number.isFinite(d.getTime()))throw Error('EXPORT_TIME_INVALID');
 const day=`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`,time=`${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`,milli=pad(d.getMilliseconds(),3);
 const offset=-d.getTimezoneOffset(),zone=`${offset>=0?'+':'-'}${pad(Math.floor(Math.abs(offset)/60))}:${pad(Math.abs(offset)%60)}`;
 return {filenameTime:`${day}-${time}-${milli}`,timestamp:`${day.slice(0,4)}-${day.slice(4,6)}-${day.slice(6)}T${time.slice(0,2)}:${time.slice(2,4)}:${time.slice(4)}.${milli}${zone}`};
}
function generate({dbPath,exportDir,id,version,limits=LIMITS,exportTime=Date.now()}){
 if(typeof id!=='string'||!P.ID.test(id))throw Error('INVALID_INCIDENT_ID');
 if(!/^\d+\.\d+$/.test(version))throw Error('EXPORT_VERSION_UNAVAILABLE');
 directory(exportDir);let db,zip,tmp;
 try{
  db=new DatabaseSync(dbPath,{readOnly:true});
  // SELECT starts one stable read snapshot; no SQL write/DDL/PRAGMA, even for bookkeeping.
  const incidentIterator=db.prepare(`SELECT ${P.incidentFields.join(',')} FROM incidents WHERE incident_id=? LIMIT 1`).iterate(id);
  for(const row of incidentIterator){
   const counts={};let estimate=16384;
   for(const [table,fields] of [['state_events',P.eventFields],['health_samples',P.healthFields]]){
    const count=db.prepare(`SELECT count(*) n,coalesce(sum(${fields.map(k=>`coalesce(length(CAST(${k} AS TEXT)),4)`).join('+')}),0) bytes FROM ${table} WHERE incident_id=?`).get(id);
    counts[table]=count.n;estimate+=count.bytes*6+count.n*(fields.reduce((n,k)=>n+k.length+8,0)+2);
   }
   if(counts.state_events>limits.rows||counts.health_samples>limits.rows||estimate>limits.bytes)throw Error('EXPORT_TOO_LARGE');
   const incident=P.project(row,P.incidentFields),exportId=randomBytes(16).toString('hex');
   const clock=exportClock(exportTime),time=clock.filenameTime;
   const type=/^[A-Z][A-Z0-9_]{0,63}$/.test(incident.incident_type??'')?incident.incident_type:'UNKNOWN';
   const filename=`AU510M-${time}-${type}-${exportId}.zip`;
   if(!P.FILE.test(filename))throw Error('EXPORT_FILENAME_INVALID');
   const pending=path.join(exportDir,`export-${exportId}.zip.tmp`);zip=new Zip(pending,limits.bytes);tmp=pending;
   zip.entry('incident.json',[JSON.stringify({...incident,incident_timestamp:incident.trigger_ts,export_timestamp:clock.timestamp,zip_filename:filename,radio:'AU-510M',frequency:incident.frequency_hz,trigger:incident.first_abnormal_event,pre_capture_complete:incident.pre_trigger_complete,post_capture_complete:incident.post_trigger_complete,diagnostic_version:version,raw_evidence_availability:'ONLY_OBSERVED_RECORDS_NO_HISTORICAL_RECONSTRUCTION',export_version:version,event_row_count:counts.state_events,health_row_count:counts.health_samples,estimated_export_size_bytes:estimate},null,2)+'\n']);
   zip.entry('events.jsonl',lines(db,'state_events',P.eventFields,id));
   zip.entry('health.jsonl',lines(db,'health_samples',P.healthFields,id));
   const pre=incident.pre_trigger_complete===1?'COMPLETE':incident.pre_trigger_complete===0?'PARTIAL':'UNKNOWN';
   const post=incident.post_capture_state==='COMPLETE'&&incident.post_trigger_complete===1?'COMPLETE':incident.post_capture_state==='INTERRUPTED'?'INTERRUPTED':incident.post_capture_state==='COLLECTING'?'COLLECTING':incident.post_trigger_complete===0?'PARTIAL':'UNKNOWN';
   zip.entry('README.txt',[`AU-510M Diagnostic Incident Export\n\nIncident: ${type}\nTime: ${incident.trigger_ts??'UNKNOWN'} (UTC)\nCycles: ${incident.cycle_count??'UNKNOWN'}\nFrequency: ${incident.frequency_hz??'UNKNOWN'} Hz\nMode: ${incident.mode??'UNKNOWN'}\nPrecursor: ${incident.precursor_fault??'UNKNOWN'}\nFirst abnormal event: ${incident.first_abnormal_event??'UNKNOWN'}\nOrigin: ${incident.trigger_origin} / ${incident.command_origin} (${incident.origin_confidence})\n\nImportant: A precursor event is not proof of causality.\nCapture: PRE ${pre} / POST ${post}\nOnly currently retained records are included; missing health/history is not reconstructed.\nEvents: ${counts.state_events}; health samples: ${counts.health_samples}\nGenerated by: AU510M Node-RED diagnostic system v${version}\n`]);
   const size=zip.finish();fs.linkSync(tmp,path.join(exportDir,filename));fs.unlinkSync(tmp);tmp=null;
   return {status:'READY',exportId,filename,sizeBytes:size,export_timestamp:clock.timestamp,incident_type:type};
  }
  throw Error('INCIDENT_NOT_FOUND');
 }finally{zip?.close();if(tmp)fs.rmSync(tmp,{force:true});db?.close();}
}
module.exports={generate,cleanup,LIMITS,RETENTION,exportClock};
