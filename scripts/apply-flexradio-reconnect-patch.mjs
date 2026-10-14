// Reapply exact, hash-verified 1.2.5 patches after npm install. No dependencies.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(new URL('../',import.meta.url).pathname);
const dir=path.join(root,'patches/flexradio-reconnect');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
const undo=process.argv.includes('--restore');
const check=process.argv.includes('--check');
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const [name,version] of Object.entries(manifest.upstream)){
 const installed=JSON.parse(fs.readFileSync(path.join(root,'node_modules',name,'package.json')));
 if(installed.version!==version)throw Error(`Refusing untested ${name} ${installed.version}; expected ${version}`);
}
// Preflight the entire set before touching any file, including mixed prior application.
for(const file of manifest.files){const digest=hash(path.join(root,file.path));if(![file.before,file.after].includes(digest))throw Error('Unrecognized source; no edits made: '+file.path);}
for(const file of manifest.files){
 const target=path.join(root,file.path),expected=undo?file.before:file.after;
 if(hash(target)===expected)continue;
 if(check)throw Error('Patch is not installed: '+file.path);
 const args=['--batch','--no-backup-if-mismatch','-p1',...(undo?['-R']:[]),'-i',path.join(dir,file.patch)];
 const result=spawnSync('patch',args,{cwd:root,encoding:'utf8'});
 if(result.status!==0)throw Error(`patch failed: ${result.stderr}\n${result.stdout}`);
 if(hash(target)!==expected)throw Error('Unexpected patched content: '+file.path);
}
console.log(`${manifest.revision}: ${undo?'upstream restored':'installed/verified'} (upstream 1.2.5)`);
