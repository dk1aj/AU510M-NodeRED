'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {performance}=require('node:perf_hooks');
const nodes=require('@node-red/runtime/lib/nodes');
const hooks=require('@node-red/util').hooks;
const {DiagnosticBuffer}=require('./au510m-stage1-core.cjs');
const IDS=Object.freeze({owner:'7fbf2bfc9badc7d3',meter:'2702052aa13cacd0',state:'au510m_live_state',bridge:'au510m_live_bridge'});
const REQUESTS=new Set(['cb517e1d426fa203','1938f24ff5eccb7f','185977e7709d7d4d','au510m_live_request','07c61c6741eb8fad']);
function start({context,send=()=>{},status=()=>{},attachPersistence=null}){
 const owner=nodes.getNode(IDS.owner),meter=nodes.getNode(IDS.meter),canonical=nodes.getNode(IDS.state);
 if(!owner||!meter||!canonical)throw Error('Stage-1 canonical owners unavailable');
 const version=JSON.parse(fs.readFileSync(path.join(__dirname,'../agct-watcher-version.json'),'utf8')).NEW_VERSION;
 const label='au510mDiagStage1';const memoryBefore=process.memoryUsage();
 if(hooks.has('onReceive.'+label)||hooks.has('onSend.'+label))throw Error('Existing diagnostic instance not finalized');
 const core=new DiagnosticBuffer({version,mono:()=>performance.now(),debug:r=>send({topic:'au510m/diag/'+r.record_type,payload:r})});
 const persistence=attachPersistence?.(core);
 context.set('au510mDiag',core.data);let closed=false,ticks=0;
 const counters={widgets:{},canonical_messages:0,status_messages:0,original_owners:IDS,process_memory_start:memoryBefore,process_memory:memoryBefore};core.data.runtime=counters;
 function safely(fn){if(closed)return;try{fn();}catch(e){core.error(e.message);}}
 function receive(e){safely(()=>{
  const id=e.destination.id,m=e.msg;
  if(['9ee3e94e3758b01f','au510m_power_swr_static_ui','961ffe09d3da81ac','80108e5a65682ca7','9b1bcb4b21cd24ff'].includes(id))counters.widgets[id]=(counters.widgets[id]||0)+1;
  if(id===IDS.state&&m.topic==='interlock')core.interlock(m.payload,id,m.client);
  if(REQUESTS.has(id))core.request(id,m);
 });}
 function sending(events){safely(()=>{for(const e of events){
  if(REQUESTS.has(e.source.id)){core.ack(e.source.id,e.msg);continue;}
  if(e.source.id===IDS.state&&e.msg.topic==='__radio_status'){
   counters.canonical_messages++;core.canonical(e.msg.payload,canonical.context().get('radio')?.interlock??null);
  }
 }});}
 function radioStatus(m){safely(()=>{
  counters.status_messages++;
  if(m.topic==='transmit'&&m.payload&&Object.hasOwn(m.payload,'tune'))core.tune(m.payload.tune,m.client);
  else if(String(m.topic).startsWith('client/'))core.session(m.topic,m.payload,m.client);
  else if(String(m.topic).startsWith('slice/'))core.slice(m.topic,m.payload);
 });}
 function connected(){safely(()=>core.connection(true));}
 function disconnected(){safely(()=>core.connection(false));}
 function close(){if(closed)return;closed=true;clearInterval(timer);hooks.remove('*.'+label);owner.off('status',radioStatus);owner.off('connected',connected);owner.off('disconnected',disconnected);owner.off('connecting',disconnected);core.close();status({fill:'grey',shape:'ring',text:'diagnostic stopped'});return persistence?.close();}
 hooks.add('onReceive.'+label,receive);hooks.add('onSend.'+label,sending);
 owner.on('status',radioStatus);owner.on('connected',connected);owner.on('disconnected',disconnected);owner.on('connecting',disconnected);
 const timer=setInterval(()=>safely(()=>{
  core.tick(meter.context().get('meters')?.rows||{});persistence?.tick();
  if(++ticks%100===0){counters.process_memory=process.memoryUsage();core.data.metrics.process_heap_delta_bytes=counters.process_memory.heapUsed-memoryBefore.heapUsed;core.data.metrics.process_rss_delta_bytes=counters.process_memory.rss-memoryBefore.rss;}
  if(ticks%20===0)status({fill:core.data.metrics.errors?'red':core.data.connectionState==='CONNECTED'?'green':'yellow',shape:'dot',text:`${core.count}/12000 · ${core.rate()} Hz · ${core.data.tuneCandidate.tune_fresh?'TUNE '+core.data.tuneCandidate.tune_value:'TUNE ?'}`});
 }),50);
 return {close};
}
module.exports={start,IDS};
