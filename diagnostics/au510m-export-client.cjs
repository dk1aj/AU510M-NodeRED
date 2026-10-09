'use strict';
const fs=require('node:fs'),path=require('node:path'),{Worker}=require('node:worker_threads');
const {pipeline}=require('node:stream/promises');
const {ID,EXPORT_ID,FILE}=require('./au510m-export-policy.cjs');
class ExportClient {
 constructor({dbPath=path.join(__dirname,'../data/au510m-diagnostics.sqlite'),exportDir=path.join(__dirname,'../data/exports'),version}={}){
  this.exportDir=exportDir;this.pending=new Map();this.known=new Map();this.serial=0;this.closed=false;
  this.metrics={last_export_status:'IDLE',last_export_ts:null,last_export_filename:null,last_export_size_bytes:null,last_export_error:null,total_exports:0};
  this.worker=new Worker(path.join(__dirname,'au510m-export-worker.cjs'),{workerData:{dbPath,exportDir,version}});
  this.worker.on('message',({requestId,result})=>{const p=this.pending.get(requestId);if(!p)return;clearTimeout(p.timer);this.pending.delete(requestId);p.resolve(result);});
  this.worker.on('error',()=>this.fail());this.worker.on('exit',()=>this.fail());
  this.cleanup();this.timer=setInterval(()=>this.cleanup(),6*3600000);this.timer.unref();
 }
 fail(){this.closed=true;clearInterval(this.timer);for(const p of this.pending.values()){clearTimeout(p.timer);p.resolve({status:'ERROR',error:'EXPORT_UNAVAILABLE'});}this.pending.clear();}
 request(op,id){
  if(this.closed||this.pending.size>=2)return Promise.resolve({status:'ERROR',error:'EXPORT_BUSY_OR_UNAVAILABLE'});
  const requestId=++this.serial;return new Promise(resolve=>{
   const timer=setTimeout(()=>{this.fail();this.worker.terminate().catch(()=>{});},30000);
   this.pending.set(requestId,{resolve,timer});try{this.worker.postMessage({requestId,op,id});}catch{this.fail();}
  });
 }
 async cleanup(){const result=await this.request('cleanup');if(result.status!=='READY')this.metrics.last_export_error='EXPORT_RETENTION_UNAVAILABLE';for(const [id,f] of this.known)if(!fs.existsSync(path.join(this.exportDir,f)))this.known.delete(id);return result;}
 async generate(id){
  if(typeof id!=='string'||!ID.test(id))return {status:'INVALID',error:'INVALID_INCIDENT_ID'};
  if(this.busy)return {status:'ERROR',error:'EXPORT_BUSY'};this.busy=true;
  Object.assign(this.metrics,{last_export_status:'EXPORTING',last_export_ts:Date.now(),last_export_error:null});
  try{
   const r=await this.request('export',id);
   if(r.status==='READY'){
    this.known.set(r.exportId,r.filename);while(this.known.size>256)this.known.delete(this.known.keys().next().value);
    Object.assign(this.metrics,{last_export_status:'READY',last_export_filename:r.filename,last_export_size_bytes:r.sizeBytes,total_exports:this.metrics.total_exports+1});
    return {...r,downloadUrl:'/au510m-diag/export/'+r.exportId};
   }
   Object.assign(this.metrics,{last_export_status:'ERROR',last_export_error:r.error});return r;
  }finally{this.busy=false;}
 }
 async download(id,res){
  if(typeof id!=='string'||!EXPORT_ID.test(id)){res.status(400).json({status:'INVALID'});return;}
  const filename=this.known.get(id);if(!filename||!FILE.test(filename)){res.status(404).json({status:'NOT_FOUND'});return;}
  let handle;
  try{
   const target=path.join(this.exportDir,filename);
   if(fs.lstatSync(this.exportDir).isSymbolicLink())throw Error('INVALID_DIRECTORY');
   handle=await fs.promises.open(target,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
   const stat=await handle.stat();if(!stat.isFile()||stat.size>16*1024*1024||Date.now()-stat.mtimeMs>7*86400000)throw Error('INVALID_EXPORT');
   res.status(200);res.set({'Content-Type':'application/zip','Content-Disposition':`attachment; filename="${filename}"`,'Content-Length':String(stat.size),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
   await pipeline(handle.createReadStream({autoClose:false}),res);
  }catch{if(!res.headersSent)res.status(404).json({status:'NOT_FOUND'});else res.destroy();}
  finally{await handle?.close().catch(()=>{});}
 }
 async close(){this.fail();await this.worker.terminate();this.known.clear();}
}
module.exports={ExportClient};
