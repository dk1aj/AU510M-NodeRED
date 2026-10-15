// Read-only Node-RED context and HTTP checks; never sends widget/control events.
import fs from 'node:fs';
import C from '../diagnostics/au510m-command-policy.cjs';
const base='http://127.0.0.1:1880';
async function get(key){const r=await fetch(base+'/context/node/au510m_diag_stage1/'+key);if(!r.ok)throw Error('CONTEXT_READ_FAILED');const body=await r.json();return body.format==='string'?body.msg:JSON.parse(body.msg);}
const metrics=await get('au510mDiag.metrics'),head=await get('au510mDiag.ringBuffer.head'),count=await get('au510mDiag.ringBuffer.count'),version=await get('au510mDiag.version');
const indices=Array.from({length:Math.min(count,220)},(_,i)=>(head+count-1-i+12000)%12000),records=[];
for(let i=0;i<indices.length;i+=8){const batch=await Promise.all(indices.slice(i,i+8).map(n=>get(`au510mDiag.ringBuffer.records[${n}].record`)));records.push(...batch.filter(r=>r&&typeof r==='object'));}
const last=Math.max(...records.map(r=>r.ts_ms)),commands=records.filter(r=>['COMMAND_REQUEST','ACK_RESPONSE'].includes(r.record_type)&&r.ts_ms>=last-60000).sort((a,b)=>a.seq-b.seq).map(r=>({seq:r.seq,ts_ms:r.ts_ms,record_type:r.record_type,source:r.source,...C.project(r.command_text_safe!==undefined?r:{...r,...C.command(r.new_value)}),derived_from_seq:r.derived_from_seq??null}));
const widgetBefore=await get('au510mDiag.runtime.widgets');
await new Promise(resolve=>setTimeout(resolve,8000));
const widgetAfter=await get('au510mDiag.runtime.widgets');
const widgets=Object.fromEntries(Object.keys(widgetAfter).map(id=>[id,{messages:widgetAfter[id]- (widgetBefore[id]??0)}]));
const response=await fetch(base+'/dashboard/au510m');const pageHttp=response.status;await response.text();
const status=await(await fetch(base+'/agct-watcher/status')).json();
const result={checked_at_utc:new Date().toISOString(),version,metrics:{logger_status:metrics.logger_status,connection_status:metrics.connection_status,current_tx_rx:metrics.current_tx_rx,active_slice:metrics.active_slice,errors:metrics.errors,command_observer_errors:metrics.command_observer_errors??0,sqlite_status:metrics.sqlite_status,sqlite_dropped_records:metrics.sqlite_dropped_records,persistence_active_captures:metrics.persistence_active_captures},window:{last_ms:last,duration_ms:60000,records_inspected:records.length},commands,dashboard:{pageHttp,widgets,verification:'LIVE_NODE_DELIVERY_AND_HTTP',rendering:'NOT_CHECKED_NO_BROWSER_AVAILABLE'},watcher:{uiVersion:status.uiVersion,rxTx:status.rxTx,activeSlice:status.activeSlice,frequencyMHz:status.frequencyMHz,state:status.state,reason:status.reason,level_fresh:Date.now()-status.meters?.LEVEL?.at<5000}};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,commands:commands.reduce((a,r)=>{const k=r.record_type+':'+r.source+':'+(r.command_text_safe??r.command_name);a[k]=(a[k]??0)+1;return a;},{})},null,2));
