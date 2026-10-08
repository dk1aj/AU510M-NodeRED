'use strict';
const path=require('node:path');
const {Worker}=require('node:worker_threads');
const {ID}=require('./au510m-history-query.cjs');
class HistoryReader {
 constructor({dbPath=path.join(__dirname,'../data/au510m-diagnostics.sqlite'),now=Date.now}={}){
  this.now=now;this.pending=new Map();this.cache=new Map();this.serial=0;this.closed=false;this.revision=null;
  this.worker=new Worker(path.join(__dirname,'au510m-history-worker.cjs'),{workerData:{dbPath}});
  this.worker.on('message',({requestId,result})=>{const p=this.pending.get(requestId);if(!p)return;clearTimeout(p.timer);this.pending.delete(requestId);if(result.status==='READY'){this.cache.set(p.key,{result,at:this.now()});while(this.cache.size>6)this.cache.delete(this.cache.keys().next().value);}p.resolve(result);});
  this.worker.on('error',()=>this.fail());this.worker.on('exit',()=>this.fail());
 }
 fail(){this.closed=true;this.cache.clear();for(const p of this.pending.values()){clearTimeout(p.timer);p.resolve({status:'ERROR',message:'HISTORY UNAVAILABLE'});}this.pending.clear();}
 query(op,id=null,revision=null){
  if(op!=='list'&&op!=='detail'||op==='detail'&&(typeof id!=='string'||!ID.test(id)))return Promise.resolve({status:'INVALID'});
  if(this.closed)return Promise.resolve({status:'ERROR',message:'HISTORY UNAVAILABLE'});
  if(revision!==this.revision){this.cache.clear();this.revision=revision;}
  const key=op+':'+(id??'')+':'+String(revision),cached=this.cache.get(key);if(cached&&this.now()-cached.at<15000)return Promise.resolve(structuredClone(cached.result));
  const duplicate=[...this.pending.values()].find(p=>p.key===key);if(duplicate)return duplicate.promise.then(structuredClone);
  if(this.pending.size>=4)return Promise.resolve({status:'ERROR',message:'HISTORY UNAVAILABLE'});
  const requestId=++this.serial;let resolve;const promise=new Promise(r=>{resolve=r;});
  const timer=setTimeout(()=>{this.fail();this.worker.terminate().catch(()=>{});},3000);
  this.pending.set(requestId,{resolve,timer,key,promise});
  try{this.worker.postMessage({requestId,op,id});}catch{this.fail();}
  return promise.then(structuredClone);
 }
 async close(){this.fail();await this.worker.terminate();}
}
module.exports={HistoryReader};
