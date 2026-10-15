// Offline, read-only replay. No radio or database access; no evidence rewriting.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const zip=process.argv[2],out=process.argv[3];
if(!zip||!out)throw Error('Usage: node scripts/analyze-au510m-command-incident.mjs incident.zip output-directory');
const hash=()=>createHash('sha256').update(fs.readFileSync(zip)).digest('hex'),before=hash();
const read=name=>execFileSync('unzip',['-p',path.resolve(zip),name],{encoding:'utf8',maxBuffer:16*1024*1024});
const incident=JSON.parse(read('incident.json')),events=read('events.jsonl').trim().split('\n').filter(Boolean).map(JSON.parse).sort((a,b)=>a.ts_ms-b.ts_ms||a.seq-b.seq);
const first=events.find(r=>r.seq===incident.first_abnormal_seq),trigger=incident.trigger_ts_ms;
const types=new Set(['COMMAND_REQUEST','ACK_RESPONSE','TUNE_CANDIDATE','TX_RX','INTERLOCK_STATE','INTERLOCK_FIELD']);
const requests=events.filter(r=>r.record_type==='COMMAND_REQUEST'),acks=events.filter(r=>r.record_type==='ACK_RESPONSE');
const groups=[];for(const r of requests){let g=groups.at(-1);if(!g||r.ts_ms-g.start>100){g={start:r.ts_ms,time:r.ts,count:0,seqs:[]};groups.push(g);}g.count++;g.seqs.push(r.seq);}
const windows={};fs.mkdirSync(out,{recursive:true});
for(const [name,anchor]of [['first-abnormal',first?.ts_ms],['detector-trigger',trigger]]){
 if(!Number.isSafeInteger(anchor))continue;
 const rows=events.filter(r=>types.has(r.record_type)&&Math.abs(r.ts_ms-anchor)<=5000);
 windows[name]={anchor:new Date(anchor).toISOString(),records:rows.length,requests:rows.filter(r=>r.record_type==='COMMAND_REQUEST').length,acks:rows.filter(r=>r.record_type==='ACK_RESPONSE').length};
 const header=['time_utc','relative_ms','seq','type','value','command','request_seq','ack_status','interlock','tx_rx','tune','derived_from_seq'];
 const table=rows.map(r=>[r.ts,r.ts_ms-anchor,r.seq,r.record_type,r.event_value??'',r.record_type==='COMMAND_REQUEST'?'UNKNOWN_COMMAND':'',r.record_type==='ACK_RESPONSE'?r.derived_from_seq??'':'',r.record_type==='ACK_RESPONSE'?r.event_value??'':'',r.interlock_state??'',r.tx_state??'',r.tune_value??'',r.derived_from_seq??'']);
 fs.writeFileSync(path.join(out,name+'.csv'),[header,...table].map(row=>row.map(v=>JSON.stringify(String(v))).join(',')).join('\n')+'\n');
}
const summary={evidence:path.basename(zip),sha256_before:before,sha256_after:hash(),incident,first_abnormal_time:first?.ts??null,command_requests:requests.length,acks:acks.length,successful_acks:acks.filter(r=>r.event_value==='0').length,linked_acks:acks.filter(r=>r.derived_from_seq!==null).length,command_identity:'UNKNOWN_COMMAND',windows,request_groups:groups.map((g,i)=>({...g,delta_ms:i?g.start-groups[i-1].start:null})),causality:'UNKNOWN; repository paths and timing do not identify historical commands or establish a causal source'};
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');if(before!==hash())throw Error('EVIDENCE_CHANGED');
console.log(JSON.stringify({requests:summary.command_requests,acks:summary.acks,successful_acks:summary.successful_acks,linked_acks:summary.linked_acks,first_abnormal:summary.first_abnormal_time,windows,sha256:before,groups:summary.request_groups},null,2));
