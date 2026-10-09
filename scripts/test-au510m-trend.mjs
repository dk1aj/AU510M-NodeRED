import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {project,MAX_POINTS,WINDOW_MS}=require('../diagnostics/au510m-trend-project.cjs');
const now=1800000240000,slots=new Array(12000),head=11700,count=12000;
for(let i=0;i<count;i++){
  const ts=now-WINDOW_MS+20+i*20,health=i%10===0,index=i/10;
  const value=index===555?987:index===1199?12:Math.max(0,80*Math.sin(index/35));
  const record=health?{record_type:'HEALTH',ts_ms:ts,seq:i+1,meters:{'TX-/1/FWDPWR':{quality:'FRESH',value}}}:{record_type:'CANONICAL_STATE',ts_ms:ts,seq:i+1};
  slots[(head+i)%slots.length]={mono_ms:i*20,bytes:128,record};
}
const data={connectionState:'CONNECTED',config:{retentionMs:WINDOW_MS,maxRecords:12000,meterFreshMs:15000},latestState:{tx_state:'TX'},tuneCandidate:{tune_fresh:true,tune_value:0},ringBuffer:{records:slots,head,count}};
const before=JSON.stringify(data),payload=project(data,{now});
assert.equal(JSON.stringify(data),before,'Projection mutated canonical ring');
assert.equal(payload.kind,'au510m-diag-trend');assert.equal(payload.stage,'D');assert.equal(payload.context,'TX');assert.equal(payload.connection,'CONNECTED');
assert.equal(payload.series.length,1);assert.equal(payload.series[0].key,'FWDPWR_W');assert.equal(payload.series[0].rawCount,1200);assert(payload.series[0].points.length<=MAX_POINTS);assert.equal(payload.series[0].max,987);assert(payload.series[0].points.some(point=>point.value===987),'Peak-preserving buckets hid power peak');
assert(payload.series[0].points.every((point,index,array)=>point.ageMs>=0&&point.ageMs<=WINDOW_MS&&(!index||point.ageMs<=array[index-1].ageMs)),'Points not chronological/window bounded');
assert.equal(payload.series[0].current,12);assert(!JSON.stringify(payload).includes('REFPWR'));assert(!JSON.stringify(payload).includes('SWR'));
const stale=project(data,{now:now+16000});assert.equal(stale.series[0].current,null);assert(stale.series[0].points.length>0,'Stale current erased history');
data.connectionState='DISCONNECTED';const disconnected=project(data,{now});assert.equal(disconnected.context,'DISCONNECTED');assert.equal(disconnected.series[0].current,null);assert(disconnected.series[0].points.length>0,'Disconnect erased history');data.connectionState='CONNECTED';
const tune=structuredClone(data);tune.tuneCandidate={tune_fresh:true,tune_value:1};assert.equal(project(tune,{now}).context,'TUNE');
const rx=structuredClone(data);rx.latestState.tx_state='RX';for(const slot of rx.ringBuffer.records)if(slot?.record?.record_type==='HEALTH')slot.record.meters['TX-/1/FWDPWR'].quality='RX_NOT_TX_MEASUREMENT';assert.equal(project(rx,{now}).series[0].points.length,0);
const rxAfterTx=structuredClone(data);rxAfterTx.latestState.tx_state='RX';const retained=project(rxAfterTx,{now});assert(retained.series[0].points.length>0);assert.equal(retained.series[0].current,null,'RX exposed retained TX power as current');

const flows=JSON.parse(fs.readFileSync('flows.json','utf8'));
const source=flows.find(node=>node.id==='9b1bcb4b21cd24ff')?.format;
assert(source,'DIAG widget missing');assert(source.includes(`selectDiagView('trend')`));assert(source.includes('LIVE FWDPWR ONLY'));assert(!source.includes('SIMULATION'));assert(!source.includes('trendSimulation'));
for(const label of ['POWER','SWR','TEMP','PA','CURRENT','EFF','SUPPLY','FAN','-4m','NOW'])assert(source.includes(label),`Missing label ${label}`);
assert.equal(flows.filter(node=>node.type==='flexradio-radio').length,2,'Trend added a radio connection');
const tick=flows.find(node=>node.id==='au510m_diag_live_tick'),node=flows.find(node=>node.id==='au510m_diag_trend_project');
assert.equal(tick.wires[0].filter(id=>id==='au510m_diag_trend_project').length,1);assert.deepEqual(node.wires,[['9b1bcb4b21cd24ff']]);assert(node.name.includes('FWDPWR only'));

const script=source.match(/<script>([\s\S]*?)<\/script>/)?.[1];assert(script);
const options=vm.runInNewContext(`(${script.replace(/^\s*export default/,'')})`,{Date,Intl,AbortController,fetch:()=>{throw Error('Trend UI must not fetch');}});
const view=options.data();for(const[name,method]of Object.entries(options.methods))view[name]=method.bind(view);
for(const name of ['trendUnit','trendSeries','trendScale'])Object.defineProperty(view,name,{get:()=>options.computed[name].call(view)});
assert.equal(view.diagView,'live');view.selectDiagView('trend');assert.equal(view.diagView,'trend');
options.watch.msg.handler.call(view,{payload});assert.equal(view.trendSnapshot,payload);
assert.equal(view.trendSeries.length,1);assert.equal(options.computed.trendContextLabel.call(view),'TX');assert.equal(options.computed.trendStageLabel.call(view),'LIVE FWDPWR ONLY');
const stats=options.computed.trendStats.call(view);assert.equal(stats.find(item=>item.label==='FWD MAX').value,987);assert.equal(stats.find(item=>item.label==='REF MAX').value,null);
assert(view.trendPath(view.trendSeries[0].points).startsWith('M'));assert.equal(JSON.stringify(view.trendValue(1250,'W')),JSON.stringify({value:'1.25',unit:'kW'}));assert.equal(JSON.stringify(view.trendValue(null,'W')),JSON.stringify({value:'--',unit:'W'}));
view.selectTrendGroup('swr');assert.equal(view.trendSeries.length,0);assert(options.computed.trendStats.call(view).every(item=>item.value===null));assert.equal(options.computed.trendStageLabel.call(view),'PENDING STAGE E');
assert(!source.includes('this.send('));
console.log('PASS TREND Stage D: one canonical FWDPWR HEALTH projection, 240 s/480-point peak-preserving bound, stale/disconnect history, no simulation/radio/SQLite path and browser snapshot replacement.');
