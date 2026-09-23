import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const root=path.resolve(new URL('../',import.meta.url).pathname);
const require=createRequire(import.meta.url);
const {parse,compileTemplate}=require('@vue/compiler-sfc');
const excluded=new Set(['node_modules','.git','.npm','.agents','.codex','backups','lib']);
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
 if(excluded.has(e.name)||e.name.startsWith('.config.')||e.name.startsWith('.flows')||e.name.startsWith('flows_cred')||e.name.startsWith('flows.json.bak')||e.name==='agct-watcher-settings.json'||e.name.startsWith('.env'))return [];
 const p=path.join(dir,e.name);return e.isDirectory()?files(p):e.isFile()?[p]:[];
});}
const list=files(root),production=JSON.parse(fs.readFileSync(path.join(root,'flows.json')));
const external=new Set(production.map(n=>n.id));
let json=0,functions=0,templates=0;
function visit(v,file){
 if(!v||typeof v!=='object')return;
 if(v.type==='function'&&typeof v.func==='string'){
  new vm.Script('(async function(msg,node,context,flow,global,env,RED){'+v.func+'})',{filename:file+':'+v.id});functions++;
 }
 if(v.type==='ui-template'&&typeof v.format==='string'){
  const {descriptor,errors}=parse(v.format);assert.equal(errors.length,0,file);
  if(descriptor.template)assert.equal(compileTemplate({source:descriptor.template.content,filename:file,id:v.id}).errors.length,0,file);
  if(descriptor.script)new vm.SourceTextModule(descriptor.script.content);templates++;
 }
 for(const item of Object.values(v))if(item&&typeof item==='object')visit(item,file);
}
for(const file of list.filter(p=>p.endsWith('.json'))){
 const data=JSON.parse(fs.readFileSync(file));json++;visit(data,file);
 if(Array.isArray(data)&&data.length&&data.every(n=>n&&typeof n.id==='string'&&typeof n.type==='string')){
  const ids=new Set(data.map(n=>n.id));assert.equal(ids.size,data.length,'Duplicate IDs: '+file);
  for(const n of data){
   for(const id of (n.wires||[]).flat())assert(ids.has(id),'Missing wire '+id+' in '+file);
   for(const key of ['z','g','radio','ui','page','theme','group'])if(n[key])assert(ids.has(n[key])||external.has(n[key]),'Unresolved '+key+' in '+file);
   assert(!Object.hasOwn(n,'credentials'),'Credential field: '+file);
  }
 }
}
// Literal local module/file references in current and archived scripts.
for(const file of list.filter(p=>/\.(?:js|mjs|cjs)$/.test(p))){
 const s=fs.readFileSync(file,'utf8');
 for(const m of s.matchAll(/(?:require\(|from\s+)["'](\.[^"']+)["']/g))createRequire(file).resolve(m[1]);
 for(const m of s.matchAll(/new URL\(['"](\.[^'"]+)['"],\s*import\.meta\.url\)/g))assert(fs.existsSync(new URL(m[1],'file://'+file)),'Missing URL reference in '+file);
}
const watcher=production.find(n=>n.name==='Watcher + separated configuration').func;
assert(watcher.includes("s.agcMeterBySlice[slice]=name"),'Dynamic AGC binding missing');
assert(!/s\.active\s*=\s*['"]0['"]/.test(watcher),'Hard-coded active slice');
assert(watcher.includes("['LEVEL','AGC+','AGC']"),'AGC-only inventory path missing');
console.log(`PASS: ${json} JSON files, ${functions} Function bodies, ${templates} Vue templates, flow and local module references.`);
