import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const C=require('../diagnostics/au510m-command-policy.cjs'),{DiagnosticBuffer}=require('../diagnostics/au510m-stage1-core.cjs');
const {observe}=require('../diagnostics/au510m-command-observer.cjs'),S=require('../diagnostics/au510m-persistence-sanitize.cjs'),P=require('../diagnostics/au510m-export-policy.cjs');
const {Store}=require('../diagnostics/au510m-persistence-store.cjs'),{generate}=require('../diagnostics/au510m-incident-export.cjs'),{Capture}=require('../diagnostics/au510m-persistence.cjs');
let clock=1791967537444;const core=new DiagnosticBuffer({version:'4.34',wall:()=>clock,mono:()=>clock});
const radio={nextRequestSequenceNumber:40,requests:new Map(),writes:[],_sendRequest(request,callback){const n=this.nextRequestSequenceNumber++;this.writes.push([n,request]);this.requests.set(n,callback);return 'original-return';}};
const original=radio._sendRequest,owner=new EventEmitter();owner.radio=radio;
owner.send=function(msg,callback){for(const raw of Array.isArray(msg.payload)?msg.payload:[msg.payload])this.radio._sendRequest(raw,callback);return 123;};
const originalSend=owner.send,known=new WeakMap();const observer=observe({owner,core,sourceFor:msg=>known.get(msg)});
const msg={_msgid:'SECRET_SESSION',payload:['sub tx all','sub radio all'],token:'SECRET_TOKEN'};
known.set(msg,{command_source_node_id:'07c61c6741eb8fad'});const before=JSON.stringify(msg);let callbacks=0;
assert.equal(owner.send(msg,()=>{callbacks++;}),123);assert.equal(JSON.stringify(msg),before);assert.deepEqual(radio.writes,[[40,'sub tx all'],[41,'sub radio all']]);
clock+=57;radio.requests.get(41)({sequence_number:41,response_code:0,payload:'SECRET_ACK'});clock+=10;radio.requests.get(40)({sequence_number:40,response_code:0});assert.equal(callbacks,2);
let req=core.records().filter(r=>r.record_type==='COMMAND_REQUEST'),acks=core.records().filter(r=>r.record_type==='ACK_RESPONSE');
assert.equal(req.length,2);assert.equal(req[0].command_text_safe,'sub tx all');assert.equal(req[0].command_source_node_id,'07c61c6741eb8fad');assert.equal(req[0].command_source_node_name,C.SOURCES['07c61c6741eb8fad']);assert.equal(acks[0].request_seq,req[1].seq);assert.equal(acks[0].ack_seq,41);assert.equal(acks[0].ack_latency_ms,57);assert.equal(acks[1].request_seq,req[0].seq);
owner.send({payload:'transmit tune 1'});req=core.records().filter(r=>r.record_type==='COMMAND_REQUEST');assert.equal(req.at(-1).command_source_node_id,'UNKNOWN');assert.equal(req.at(-1).command_text_safe,'transmit tune 1');
for(const raw of ['slice s 1 agc_threshold=SECRET','transmit tune 1 token=SECRET','profile load SECRET','client udpport 55677','client bind SECRET','meter list\nclient auth SECRET','info SECRET','X'.repeat(1000),{password:'SECRET'},['meter list','SECRET']]){
 owner.send({payload:[raw]});const r=core.records().at(-1);assert(!JSON.stringify(r).includes('SECRET'));assert(!JSON.stringify(r).includes('55677'));
}
const mismatched=core.commandRequest('meter list',{command_seq:99});core.commandAck({sequence_number:98,response_code:0},{request_seq:mismatched,command_seq:99});assert.equal(core.records().at(-1).request_seq,null);
// Identical protocol numbers after an epoch boundary must not link old requests.
core.connection(true);core.commandAck({sequence_number:99,response_code:0},{request_seq:mismatched,command_seq:99});assert.equal(core.records().at(-1).request_seq,null);
for(const id of ['constructor','__proto__','SECRET',null,{}])assert.deepEqual(C.source(id,'SECRET'),{command_source_node_id:'UNKNOWN',command_source_node_name:'UNKNOWN',command_source_module:'UNKNOWN'});
const forged={command_text_safe:'sub tx all',command_args_safe:'SECRET',command_source_node_id:'SECRET',command_source_node_name:'SECRET',command_source_module:'SECRET',command_seq:'SECRET',request_seq:'SECRET',ack_seq:'SECRET',ack_status:'SECRET',ack_latency_ms:'SECRET'};
assert(!JSON.stringify(C.project(forged)).includes('SECRET'));assert(!JSON.stringify(P.project(forged,P.eventFields)).includes('SECRET'));
const count=radio.writes.length;observer.close();assert.equal(radio._sendRequest,original);assert.equal(owner.send,originalSend);assert.equal(owner.listenerCount('connected'),0);owner.send({payload:'meter list'});assert.equal(radio.writes.length,count+1);
// Instrumentation failure must neither suppress nor duplicate a command or original callback.
const fail=observe({owner,core:{commandRequest(){throw Error('SECRET');},commandAck(){throw Error('SECRET');}}});const n=radio.nextRequestSequenceNumber;owner.send({payload:'meter list'},()=>callbacks++);radio.requests.get(n)({sequence_number:n,response_code:0});assert.equal(callbacks,3);fail.close();
// Execute the installed protocol encoder/write path with an in-memory socket.
const {Radio}=require('flexradio-js/Radio');
const real=Object.create(Radio.prototype);Object.assign(real,{nextRequestSequenceNumber:100,requests:{},connection:{write:line=>wire.push(line)}});
const wire=[],realOwner=new EventEmitter();realOwner.radio=real;realOwner.send=function(msg,cb){return this.radio.send(msg.payload,cb);};
const realOriginal=real._sendRequest;
const realObserver=observe({owner:realOwner,core});let originalReply;
realOwner.send({payload:'meter list'},r=>{originalReply=r;});
assert.deepEqual(wire,['C100|meter list\n']);
const reply={sequence_number:100,response_code:0,payload:{}};real.requests[100].callback(reply);assert.equal(originalReply,reply);
assert.equal(core.records().at(-1).ack_seq,100);assert.equal(core.records().at(-1).request_seq,core.records().findLast(r=>r.record_type==='COMMAND_REQUEST').seq);
realObserver.close();assert.equal(real._sendRequest,realOriginal);assert(!Object.hasOwn(real,'_sendRequest'));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'au510m-command-test-'));let store;
try{
 const dbPath=path.join(dir,'history.sqlite'),legacy=path.join(dir,'legacy');store=new Store({dbPath,exportDir:legacy,now:()=>clock});
 // Exercise actual incident capture path, not only its sanitizer.
 const writes=[],capture=new Capture({history:()=>core.records(),writer:{write:async payload=>{writes.push(payload);return {};},close:async()=>{}},wall:()=>clock,mono:()=>clock});
 const incident=S.incident({trigger_ts:clock,trigger_seq:core.data.seq,incident_type:'OFFLINE_COMMAND_TEST'},'AU510M-command-test');
 capture.open({trigger_ts:clock,trigger_seq:core.data.seq,incident_type:'OFFLINE_COMMAND_TEST'});
 assert(writes.some(w=>w.records?.some(r=>r.command_text_safe==='sub tx all')),'Incident capture keeps safe fields');
 const records=core.records().map(S.record).filter(Boolean).map(r=>({...r,incident_id:incident.incident_id}));
 store.write({incident:{...incident,post_capture_state:'COMPLETE',post_trigger_complete:1},records,complete:true});
 const persisted=store.db.prepare("SELECT * FROM state_events WHERE record_type='COMMAND_REQUEST' AND command_text_safe='sub tx all'").get();assert.equal(persisted.command_source_node_id,'07c61c6741eb8fad');
 const ack=store.db.prepare("SELECT * FROM state_events WHERE record_type='ACK_RESPONSE' AND ack_seq=41").get();assert.equal(ack.request_seq,req[1].seq);
 assert(fs.readFileSync(store.filename(incident.incident_id),'utf8').includes('sub tx all'));
 const out=generate({dbPath,exportDir:path.join(dir,'exports'),id:incident.incident_id,version:'4.34'});
 const text=execFileSync('unzip',['-p',path.join(dir,'exports',out.filename),'events.jsonl'],{encoding:'utf8'});assert(text.includes('sub tx all'));assert(text.includes('command_source_node_id'));assert(!/SECRET|55677|session_id|client_handle/.test(text));
 assert(!/SECRET|55677/.test(JSON.stringify(core.records())));
 // Migration: removing new columns simulates the original v1 table, then reopen.
 for(const field of C.FIELDS)store.db.exec(`ALTER TABLE state_events DROP COLUMN ${field}`);
 const oldRows=JSON.stringify(store.db.prepare('SELECT id,seq,event_value FROM state_events').all());store.close();store=new Store({dbPath,exportDir:legacy,now:()=>clock});assert.equal(JSON.stringify(store.db.prepare('SELECT id,seq,event_value FROM state_events').all()),oldRows);assert.equal(store.db.prepare('SELECT command_text_safe FROM state_events LIMIT 1').get().command_text_safe,null);
}finally{store?.close();fs.rmSync(dir,{recursive:true,force:true});}
console.log('PASS A-H: safe identity; strict redaction; direct endpoint/UNKNOWN source; exact out-of-order ACKs; ring/capture/SQLite/JSONL/ZIP; no secrets; additive legacy migration; unchanged commands/callbacks/returns; observer cleanup and failure isolation.');
