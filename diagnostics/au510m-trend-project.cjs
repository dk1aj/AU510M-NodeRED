'use strict';

const WINDOW_MS=240000,MAX_POINTS=480,BUCKETS=MAX_POINTS/4;
const METRICS=Object.freeze({FWDPWR_W:{topic:'TX-/1/FWDPWR',label:'FWDPWR',unit:'W'}});
const finite=value=>typeof value==='number'&&Number.isFinite(value)?value:null;

function ringRecords(data){
 const ring=data?.ringBuffer,slots=ring?.records;
 if(!Array.isArray(slots)||!Number.isSafeInteger(ring.head)||!Number.isSafeInteger(ring.count)||ring.count<0||ring.count>slots.length)return [];
 const out=[];
 for(let i=0;i<ring.count;i++){
  const record=slots[(ring.head+i)%slots.length]?.record;
  if(record&&record.record_type==='HEALTH'&&Number.isSafeInteger(record.ts_ms))out.push(record);
 }
 return out;
}

function reduce(points,now){
 if(points.length<=MAX_POINTS)return points.map(point=>({ageMs:Math.max(0,now-point.ts_ms),value:point.value}));
 const width=WINDOW_MS/BUCKETS,buckets=new Map();
 for(const point of points){
  const index=Math.min(BUCKETS-1,Math.max(0,Math.floor((point.ts_ms-(now-WINDOW_MS))/width)));
  const bucket=buckets.get(index)??[];bucket.push(point);buckets.set(index,bucket);
 }
 const selected=[];
 for(const bucket of buckets.values()){
  const candidates=[bucket[0],bucket.reduce((a,b)=>b.value<a.value?b:a),bucket.reduce((a,b)=>b.value>a.value?b:a),bucket.at(-1)];
  const unique=new Map(candidates.map(point=>[point.ts_ms+':'+point.seq,point]));
  selected.push(...[...unique.values()].sort((a,b)=>a.ts_ms-b.ts_ms||a.seq-b.seq));
 }
 return selected.sort((a,b)=>a.ts_ms-b.ts_ms||a.seq-b.seq).map(point=>({ageMs:Math.max(0,now-point.ts_ms),value:point.value}));
}

function context(data){
 if(data?.connectionState!=='CONNECTED')return 'DISCONNECTED';
 const tune=data?.tuneCandidate;
 if(tune?.tune_fresh===true&&tune.tune_value===1)return 'TUNE';
 return ['RX','TX'].includes(data?.latestState?.tx_state)?data.latestState.tx_state:'UNKNOWN';
}

function project(data,{now=Date.now(),keys=['FWDPWR_W']}={}){
 const start=now-WINDOW_MS,currentContext=context(data),records=ringRecords(data).filter(record=>record.ts_ms>=start&&record.ts_ms<=now);
 const series=[];
 for(const key of keys){
  const metric=METRICS[key];if(!metric)continue;
  const raw=[];
  for(const record of records){
   const sample=record.meters?.[metric.topic],value=finite(sample?.value);
   if(sample?.quality==='FRESH'&&value!==null)raw.push({ts_ms:record.ts_ms,seq:Number.isSafeInteger(record.seq)?record.seq:0,value});
  }
  const latest=raw.at(-1),fresh=data?.connectionState==='CONNECTED'&&['TX','TUNE'].includes(currentContext)&&latest&&now-latest.ts_ms>=0&&now-latest.ts_ms<(data?.config?.meterFreshMs??15000);
  series.push({key,label:metric.label,unit:metric.unit,points:reduce(raw,now),current:fresh?latest.value:null,min:raw.length?Math.min(...raw.map(point=>point.value)):null,max:raw.length?Math.max(...raw.map(point=>point.value)):null,rawCount:raw.length});
 }
 return {kind:'au510m-diag-trend',stage:'D',generatedAt:now,windowMs:WINDOW_MS,maxPointsPerSeries:MAX_POINTS,context:currentContext,connection:data?.connectionState==='CONNECTED'?'CONNECTED':'DISCONNECTED',series};
}

module.exports={WINDOW_MS,MAX_POINTS,METRICS,ringRecords,reduce,project};
