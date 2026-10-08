'use strict';
const {parentPort,workerData}=require('node:worker_threads');
const {DatabaseSync}=require('node:sqlite');
const {read}=require('./au510m-history-query.cjs');
parentPort.on('message',({requestId,op,id})=>{
 let db;
 try{db=new DatabaseSync(workerData.dbPath,{readOnly:true});parentPort.postMessage({requestId,result:read(db,op,id)});}
 catch{parentPort.postMessage({requestId,result:{status:'ERROR',message:'HISTORY UNAVAILABLE'}});}
 finally{db?.close();}
});
