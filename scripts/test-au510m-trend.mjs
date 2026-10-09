import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {project,METRICS,MAX_POINTS,WINDOW_MS}=require('/mnt/dietpi_userdata/node-red/diagnostics/au510m-trend-project.cjs');
const now=1800000240000;
const keys=Object.keys(METRICS);
const txKeys=['FWDPWR_W','REFPWR_W','SWR'];

function value(key,index){
  const ordinary={FWDPWR_W:12,REFPWR_W:.5,SWR:1.2,PATEMP_C:45,PAFETQ1TEMP_C:47,PAFETQ2TEMP_C:48,PACURRENT_A:8,PAEFF_PERCENT:61,V13_8A:13.8,V13_8B:13.7,MAINFAN:1100}[key];
  const peaks={FWDPWR_W:[555,987],REFPWR_W:[444,91],SWR:[333,4.7],PATEMP_C:[777,88],PAFETQ1TEMP_C:[778,92],PAFETQ2TEMP_C:[779,94],PACURRENT_A:[666,52],PAEFF_PERCENT:[667,83],V13_8A:[668,12.4],V13_8B:[669,12.2],MAINFAN:[670,3600]};
  return index===peaks[key][0]?peaks[key][1]:ordinary;
}

function fixture({state='TX',connected=true,tune=0,missing=[]}={}){
  const slots=new Array(12000),head=11700,count=12000;
  for(let i=0;i<count;i++){
    const ts=now-WINDOW_MS+20+i*20,health=i%10===0,index=i/10;
    let record={record_type:'CANONICAL_STATE',ts_ms:ts,seq:i+1};
    if(health){
      const meters={};
      for(const key of keys)if(!missing.includes(key))meters[METRICS[key].topic]={quality:'FRESH',value:value(key,index)};
      record={record_type:'HEALTH',ts_ms:ts,seq:i+1,meters};
    }
    slots[(head+i)%slots.length]={mono_ms:i*20,bytes:256,record};
  }
  return {connectionState:connected?'CONNECTED':'DISCONNECTED',config:{retentionMs:WINDOW_MS,maxRecords:12000,meterFreshMs:15000},latestState:{tx_state:state},tuneCandidate:{tune_fresh:true,tune_value:tune},ringBuffer:{records:slots,head,count}};
}

const data=fixture(),before=JSON.stringify(data),payload=project(data,{now});
assert.equal(JSON.stringify(data),before,'Projection mutated canonical ring');
assert.equal(payload.kind,'au510m-diag-trend');assert.equal(payload.stage,'E');assert.equal(payload.context,'TX');assert.equal(payload.connection,'CONNECTED');
assert.deepEqual(payload.series.map(series=>series.key),keys);assert.equal(payload.series.length,11);
for(const series of payload.series){
  assert.equal(series.rawCount,1200,series.key+' raw count');assert(series.points.length<=MAX_POINTS,series.key+' point bound');
  assert(series.points.every((point,index,array)=>point.ageMs>=0&&point.ageMs<=WINDOW_MS&&(!index||point.ageMs<=array[index-1].ageMs)),series.key+' chronology/window');
}
const by=(result,key)=>result.series.find(series=>series.key===key);
for(const [key,peak] of [['FWDPWR_W',987],['REFPWR_W',91],['SWR',4.7],['PATEMP_C',88],['PAFETQ1TEMP_C',92],['PAFETQ2TEMP_C',94],['PACURRENT_A',52],['PAEFF_PERCENT',83],['MAINFAN',3600]]){
  assert.equal(by(payload,key).max,peak,key+' peak stat');assert(by(payload,key).points.some(point=>point.value===peak),key+' peak lost by reduction');
}
assert.equal(by(payload,'V13_8A').min,12.4);assert.equal(by(payload,'V13_8B').min,12.2);

const rx=fixture({state:'RX'});for(const slot of rx.ringBuffer.records)if(slot?.record?.record_type==='HEALTH')for(const key of txKeys)slot.record.meters[METRICS[key].topic].quality='RX_NOT_TX_MEASUREMENT';
const rxPayload=project(rx,{now});for(const key of txKeys){assert.equal(by(rxPayload,key).rawCount,0,key+' accepted RX sample');assert.equal(by(rxPayload,key).current,null);}assert.equal(by(rxPayload,'PATEMP_C').rawCount,1200);assert.equal(by(rxPayload,'PATEMP_C').current,45);

const rxAfterTx=fixture({state:'RX'}),retained=project(rxAfterTx,{now});
for(const key of txKeys){assert(by(retained,key).points.length>0,key+' lost retained TX history');assert.equal(by(retained,key).current,null,key+' exposed TX current in RX');}
assert.equal(by(retained,'MAINFAN').current,1100,'RX hid non-TX health current');

const tune=fixture({state:'RX',tune:1}),tunePayload=project(tune,{now});assert.equal(tunePayload.context,'TUNE');for(const key of txKeys)assert.notEqual(by(tunePayload,key).current,null,key+' hidden in TUNE');
const stale=project(data,{now:now+16000});for(const series of stale.series){assert.equal(series.current,null,series.key+' stale current');assert(series.points.length>0,series.key+' stale erased history');}
const disconnected=project(fixture({connected:false}),{now});assert.equal(disconnected.context,'DISCONNECTED');for(const series of disconnected.series){assert.equal(series.current,null);assert(series.points.length>0,'disconnect erased '+series.key);}
const reconnected=project(fixture(),{now});assert.equal(reconnected.context,'TX');for(const series of reconnected.series)assert.notEqual(series.current,null,'reconnect failed '+series.key);
const missing=project(fixture({missing:['PAFETQ2TEMP_C']}),{now});assert.equal(by(missing,'PAFETQ2TEMP_C').rawCount,0);assert.equal(by(missing,'PAFETQ2TEMP_C').current,null);assert.equal(by(missing,'PATEMP_C').rawCount,1200);
assert.equal(data.ringBuffer.count,12000,'Maximum-ring fixture incomplete');assert(payload.series.every(series=>series.points.length<=480));

const flows=JSON.parse(fs.readFileSync('/mnt/dietpi_userdata/node-red/flows.json','utf8'));
const dashboard=JSON.parse(fs.readFileSync('/mnt/dietpi_userdata/node-red/flows/dashboard.json','utf8'));
const source=flows.find(node=>node.id==='9b1bcb4b21cd24ff')?.format;
assert(source,'DIAG widget missing');assert(source.includes(`selectDiagView('trend')`));assert(source.includes('LIVE HEALTH RING'));assert(source.includes('STALE DELIVERY'));assert(!source.includes('SIMULATION'));assert(!source.includes('PENDING STAGE E'));assert(!source.includes('trendSimulation'));
for(const label of ['POWER','SWR','TEMP','PA','CURRENT','EFF','SUPPLY','FAN','-4m','NOW'])assert(source.includes(label),`Missing label ${label}`);
assert.equal(flows.filter(node=>node.type==='flexradio-radio').length,2,'Trend added a radio connection');
const tick=flows.find(node=>node.id==='au510m_diag_live_tick'),node=flows.find(node=>node.id==='au510m_diag_trend_project');
assert.equal(tick.wires[0].filter(id=>id==='au510m_diag_trend_project').length,1);assert.deepEqual(node.wires,[['9b1bcb4b21cd24ff']]);assert(node.name.includes('11 canonical metrics'));
assert.equal(dashboard.find(item=>item.id==='9b1bcb4b21cd24ff').format,source,'Dashboard export widget differs');

const script=source.match(/<script>([\s\S]*?)<\/script>/)?.[1];assert(script);assert(/^\s*export default\s*\{/.test(script));
const options=vm.runInNewContext(`(${script.replace(/^\s*export default/,'')})`,{Date,Intl,AbortController,fetch:()=>{throw Error('Trend UI must not fetch');}});
const view=options.data();for(const[name,method]of Object.entries(options.methods))view[name]=method.bind(view);
for(const name of ['trendTitle','trendUnit','trendSeries','trendScale','trendDeliveryFresh','trendContextLabel','trendStageLabel','trendWindowLabel'])Object.defineProperty(view,name,{get:()=>options.computed[name].call(view)});
assert.equal(view.diagView,'live');view.selectDiagView('trend');assert.equal(view.diagView,'trend');
options.watch.msg.handler.call(view,{payload});assert.equal(view.trendSnapshot,payload);assert.equal(view.trendSeries.length,2);assert.deepEqual(view.trendSeries.map(series=>series.key),['FWDPWR_W','REFPWR_W']);
assert.equal(options.computed.trendContextLabel.call(view),'TX');assert.equal(options.computed.trendStageLabel.call(view),'LIVE HEALTH RING');
let stats=options.computed.trendStats.call(view);assert.equal(stats.find(item=>item.label==='FWD MAX').value,987);assert.equal(stats.find(item=>item.label==='REF MAX').value,91);assert.equal(stats.find(item=>item.label==='FWD NOW').value,12);
assert(view.trendPath(view.trendSeries[0].points).startsWith('M'));assert.equal(JSON.stringify(view.trendValue(1250,'W')),JSON.stringify({value:'1.25',unit:'kW'}));assert.equal(JSON.stringify(view.trendValue(null,'W')),JSON.stringify({value:'--',unit:'W'}));

view.selectTrendGroup('swr');assert.deepEqual(view.trendSeries.map(series=>series.key),['SWR']);stats=options.computed.trendStats.call(view);assert.equal(stats.find(item=>item.label==='SWR MAX').value,4.7);assert.equal(view.trendScale[0],1);
view.selectTrendGroup('temp');assert.deepEqual(view.trendSeries.map(series=>series.key),['PATEMP_C','PAFETQ1TEMP_C','PAFETQ2TEMP_C']);assert.equal(options.computed.trendStats.call(view).find(item=>item.label==='FET2 MAX').value,94);
view.selectTrendGroup('pa');for(const [group,expected] of [['current',['PACURRENT_A']],['efficiency',['PAEFF_PERCENT']],['supply',['V13_8A','V13_8B']],['fan',['MAINFAN']]]){view.selectTrendPa(group);assert.deepEqual(view.trendSeries.map(series=>series.key),expected,group);assert(options.computed.trendStats.call(view).some(item=>item.value!==null),group+' empty stats');}

view.selectTrendGroup('power');view.trendReceivedAt=Date.now()-4000;view.now=Date.now();assert.equal(view.trendStageLabel,'STALE DELIVERY');stats=options.computed.trendStats.call(view);assert.equal(stats.find(item=>item.label==='FWD NOW').value,null,'Browser stale delivery exposed current');assert.equal(stats.find(item=>item.label==='FWD MAX').value,987,'Browser stale delivery erased history');
assert(!source.includes('this.send('));
console.log('PASS TREND Stage E: 11 canonical HEALTH series; RX/TX/RX, TUNE, bursts, reflected/SWR/temperature peaks, missing/stale/disconnect/reconnect, 12000-slot ring, 480-point peak preservation and browser stale handling.');
