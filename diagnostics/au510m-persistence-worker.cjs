'use strict';
const {parentPort,workerData}=require('node:worker_threads');
const {Store}=require('./au510m-persistence-store.cjs');
const code=e=>/^[A-Z0-9_]+$/.test(e?.code??'')?e.code:'SQLITE_OPERATION_FAILED';
let store;
try{store=new Store(workerData);parentPort.postMessage({ready:true,metrics:store.metrics()});}catch(e){parentPort.postMessage({ready:false,error:code(e)});}
parentPort.on('message',async m=>{try{if(!store)throw Error('UNAVAILABLE');let result;
 if(m.op==='write')result=store.write(m.payload);
 else if(m.op==='retention'){store.retention();result=store.metrics();}
 else if(m.op==='metrics')result=store.metrics();
 else if(m.op==='close'){store.close();parentPort.postMessage({id:m.id,ok:true});parentPort.close();return;}
 else throw Error('INVALID_OPERATION');
 parentPort.postMessage({id:m.id,ok:true,result});
 }catch(e){parentPort.postMessage({id:m.id,ok:false,error:code(e)});}});
