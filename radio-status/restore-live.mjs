import {readFile} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {parse,compileTemplate,compileScript}=require('@vue/compiler-sfc');
const patch=JSON.parse(await readFile(new URL('./restore-live.patch.json',import.meta.url),'utf8'));
function restore(flows){
 const result=structuredClone(flows);
 for(const {before,after} of patch.replacements){
  const matches=result.filter(n=>n.id===before.id);
  if(matches.length!==1)throw Error('Missing/duplicate node: '+before.id);
  const current=matches[0];
  if(isDeepStrictEqual(current,after))continue;
  if(!isDeepStrictEqual(current,before))throw Error('Node changed since review: '+before.id+'; nothing deployed');
  result[result.indexOf(current)]=structuredClone(after);
 }
 for(const n of result.filter(n=>n.type==='ui-template')){
  const {descriptor,errors}=parse(n.format);
  if(errors.length)throw Error(String(errors));
  const compiled=compileTemplate({source:descriptor.template.content,filename:n.id+'.vue',id:n.id});
  if(compiled.errors.length)throw Error(String(compiled.errors));
  compileScript(descriptor,{id:n.id});
 }
 const avg=result.find(n=>n.id==='au510m_display_average');
 if(!avg?.d || result.some(n=>(n.wires||[]).some(w=>w.includes(avg.id))))throw Error('Averaging not fully bypassed');
 return result;
}
async function main(){
 if(process.argv[2]&&process.argv[2]!=='--deploy')throw Error('Usage: node radio-status/restore-live.mjs [--deploy]');
 if(!process.argv[2]){restore(JSON.parse(await readFile(new URL('../flows.json',import.meta.url),'utf8')));console.log('Previous live path restored in validated patch; averaging disabled. Nothing deployed.');return;}
 const url=new URL('/flows',process.env.NODE_RED_URL||'http://127.0.0.1:1880');
 const headers={'Node-RED-API-Version':'v2','Content-Type':'application/json'};
 const response=await fetch(url,{headers,redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('GET /flows: HTTP '+response.status);
 const current=await response.json();
 if(!Array.isArray(current.flows)||typeof current.rev!=='string')throw Error('Expected versioned flows');
 const updated=restore(current.flows);
 if(isDeepStrictEqual(updated,current.flows)){console.log('Original live path already restored. Nothing deployed.');return;}
 const sent=await fetch(url,{method:'POST',headers:{...headers,'Node-RED-Deployment-Type':'nodes'},body:JSON.stringify({rev:current.rev,flows:updated}),redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!sent.ok)throw Error('POST /flows: HTTP '+sent.status+'; no automatic retry');
 console.log('Restored original live-data path and disabled averaging. Check live dashboard values; subscriptions and radio settings unchanged.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
