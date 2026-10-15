'use strict';
// Closed grammar: never retain an unrecognized argument, raw line, handle or token.
const SOURCES=Object.freeze({
 'aed8c933591fa103':'meter list', '6ac62913256d631c':'meter list',
 '2702052aa13cacd0':'35-meter inventory, subscriptions and display snapshots',
 au510m_live_state:'state',
 'a2e5d60332cdb49a':'AGC-T command gate: RX + live scan permit',
 '5c67eccefec66e09':'Watcher + separated configuration',
 cb517e1d426fa203:'FlexRadio Request','1938f24ff5eccb7f':'FlexRadio Request',
 '185977e7709d7d4d':'Only meter list / numeric sub meter',
 au510m_live_request:'Read-only sub slice all / sub tx all',
 '07c61c6741eb8fad':'Existing FlexRadio: subscriptions + guarded AGC-T'
});
const MODULES=new Set(['node-red-contrib-flexradio/flexradio-radio.js','flexradio-js/Radio.js']);
const FIELDS='command_family command_name command_args_safe command_text_safe command_source_node_id command_source_node_name command_source_module command_seq request_seq ack_seq ack_status ack_latency_ms'.split(' ');
const integer=v=>Number.isSafeInteger(v)&&v>=0?v:null;
function command(raw){
 const unknown={command_family:'UNKNOWN',command_name:'UNKNOWN_COMMAND',command_args_safe:null,command_text_safe:null};
 if(typeof raw!=='string'||raw.length>256||/[\r\n\x00-\x1f\x7f]/.test(raw))return unknown;
 let args=null,name=null,m;
 if(raw==='meter list'){name='list';args={};}
 else if((m=/^sub (client|slice|tx|pan|radio|meter) all$/.exec(raw))){name='subscribe';args={target:m[1],scope:'all'};}
 else if((m=/^sub meter ([0-9]{1,5})$/.exec(raw))){name='subscribe';args={target:'meter',meter_id:Number(m[1])};}
 else if((m=/^slice s ([0-9]{1,3}) agc_threshold=([0-9]{1,3})$/.exec(raw))&&Number(m[2])<=100){name='set_agc_threshold';args={slice_index:Number(m[1]),agc_threshold:Number(m[2])};}
 else if((m=/^transmit tune ([01])$/.exec(raw))){name='tune';args={enabled:Number(m[1])};}
 else if((m=/^client set (enforce_network_mtu|send_reduced_bw_dax)=([01])$/.exec(raw))){name='set';args={setting:m[1],enabled:Number(m[2])};}
 // UDP port is an opaque runtime identifier; record identity only.
 else if(/^client udpport [0-9]{1,5}$/.test(raw))return {command_family:'client',command_name:'udpport',command_args_safe:null,command_text_safe:null};
 if(name)return {command_family:raw.split(' ')[0],command_name:name,command_args_safe:JSON.stringify(args),command_text_safe:raw};
 const family=raw.split(' ')[0];return {...unknown,command_family:['meter','sub','slice','transmit','interlock','profile','info','client'].includes(family)?family:'UNKNOWN'};
}
function source(id,module){const known=typeof id==='string'&&Object.hasOwn(SOURCES,id);return {command_source_node_id:known?id:'UNKNOWN',command_source_node_name:known?SOURCES[id]:'UNKNOWN',command_source_module:MODULES.has(module)?module:'UNKNOWN'};}
// Re-validate at persistence and export boundaries, including data already in SQLite.
function project(r){
 const c=command(r.command_text_safe);
 if(!r.command_text_safe&&r.command_family==='client'&&r.command_name==='udpport'){c.command_family='client';c.command_name='udpport';}
 else if(!r.command_text_safe&&['meter','sub','slice','transmit','interlock','profile','info','client'].includes(r.command_family))c.command_family=r.command_family;
 return {...c,...source(r.command_source_node_id,r.command_source_module),command_seq:integer(r.command_seq),request_seq:integer(r.request_seq),ack_seq:integer(r.ack_seq),ack_status:integer(r.ack_status),ack_latency_ms:typeof r.ack_latency_ms==='number'&&Number.isFinite(r.ack_latency_ms)&&r.ack_latency_ms>=0?r.ack_latency_ms:null};
}
module.exports={command,source,project,FIELDS,SOURCES};
