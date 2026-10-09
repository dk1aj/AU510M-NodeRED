'use strict';
const {parentPort,workerData}=require('node:worker_threads');
const {generate,cleanup}=require('./au510m-incident-export.cjs');
const errors=new Set(['INVALID_INCIDENT_ID','INCIDENT_NOT_FOUND','EXPORT_TOO_LARGE','EXPORT_VERSION_UNAVAILABLE','EXPORT_DIRECTORY_UNAVAILABLE','EXPORT_FILENAME_INVALID']);
parentPort.on('message',({requestId,op,id})=>{
 try{const result=op==='cleanup'?{status:'READY',removed:cleanup(workerData.exportDir)}:generate({...workerData,id});parentPort.postMessage({requestId,result});}
 catch(e){parentPort.postMessage({requestId,result:{status:'ERROR',error:errors.has(e.message)?e.message:'EXPORT_UNAVAILABLE'}});}
});
