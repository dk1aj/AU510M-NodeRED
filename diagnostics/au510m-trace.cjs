'use strict';
// Additive evidence envelope. A last command is context, never proof of causality.
const FIELDS='event_type timestamp tune_state previous_tune_state radio_state interlock_state frequency mode slice client_handle client_id client_name client_program source_ip source_port command raw_command command_family command_name command_source_node_id command_source_node_name source_node_id source_node_name command_origin trigger_origin origin_confidence status_client_handle_role last_tune_command_timestamp last_tune_command last_tune_command_source last_tune_command_node_id last_tune_command_node_name last_known_client last_tune_command_seq last_tune_command_run_id last_tune_command_epoch command_link_confidence command_link_availability'.split(' ');
function metadata(value){
 if(typeof value==='string'){try{value=JSON.parse(value);}catch{return null;}}
 if(!value||typeof value!=='object'||!['TUNE_STATE_CHANGE','COMMAND_REQUEST','TUNE_REACTIVATED_AFTER_RX'].includes(value.event_type))return null;
 return Object.fromEntries(FIELDS.map(k=>[k,typeof value[k]==='number'&&Number.isFinite(value[k])||typeof value[k]==='string'&&value[k].length<=512?value[k]:'UNKNOWN']));
}
function evidence(value){
 if(typeof value==='string'){try{value=JSON.parse(value);}catch{return null;}}
 if(!value||value.kind!=='OBSERVED_FLEX_RECORD')return null;
 // Snapshot exactly, separately from compacted legacy raw_source. Never rewrite the input.
 const json=JSON.stringify(value);
 return json.length<=16384?JSON.parse(json):{kind:'OBSERVED_FLEX_RECORD',availability:'OMITTED_SIZE_LIMIT',original_size:json.length};
}
function columns(r){const m=metadata(r.diagnostic_metadata),raw=m?evidence(r.raw_evidence):null;return {diagnostic_metadata:m?JSON.stringify(m):null,raw_evidence:raw?JSON.stringify(raw):null};}
module.exports={FIELDS,metadata,evidence,columns};
