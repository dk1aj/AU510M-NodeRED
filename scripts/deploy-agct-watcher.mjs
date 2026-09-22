// Explicit operator deployment. --check is read-only; --deploy replaces only the watcher.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const source = new URL('../examples/05-agct-watcher.json', import.meta.url);
const base = 'http://127.0.0.1:1880';
const radio = '7fbf2bfc9badc7d3';
export function prepare(snapshot, incoming) {
    if (!snapshot || !Array.isArray(snapshot.flows) || typeof snapshot.rev !== 'string') throw Error('Invalid versioned flow response');
    const tabs = incoming.filter(n => n.type === 'tab');
    if (tabs.length !== 1 || tabs[0].id !== 'au510m_agct_watcher') throw Error('Unexpected watcher export');
    const tab = tabs[0], nodes = incoming.filter(n => n !== tab);
    const ids = new Set(incoming.map(n => n.id));
    if (ids.size !== incoming.length || nodes.some(n => n.z !== tab.id || !Array.isArray(n.wires) ||
        n.wires.flat().some(id => !ids.has(id)) || (n.radio && n.radio !== radio) || Object.hasOwn(n, 'credentials'))) throw Error('Invalid watcher nodes or references');
    const existing = snapshot.flows;
    if (!existing.some(n => n.id === radio && n.type === 'flexradio-radio')) throw Error('Required existing radio configuration missing');
    const candidates = existing.filter(n => n.type === 'tab' && (n.id === tab.id || [tab.label, 'EXPERIMENT - AU-510M Auto AGC-T Watcher (measurement only)'].includes(n.label)));
    if (candidates.length > 1) throw Error('Multiple watcher tabs found; stopped to avoid choosing the wrong instance');
    const old = candidates[0];
    const oldNodes = old ? existing.filter(n => n.z === old.id) : [];
    if (old && !oldNodes.some(n => n.type === 'function' && ['Watcher + separated configuration', 'Watcher + separated configuration (READ ONLY)'].includes(n.name))) throw Error('Existing tab does not match watcher identity');
    const routes = new Set(nodes.filter(n => n.type === 'http in').map(n => n.method + ' ' + n.url));
    if (existing.some(n => n.z !== old?.id && n.type === 'http in' && routes.has(n.method + ' ' + n.url))) throw Error('Watcher HTTP route is already used by another flow');
    const used = new Set(existing.map(n => n.id));
    function fresh() { let id; do { id = randomBytes(8).toString('hex'); } while (used.has(id)); used.add(id); return id; }
    const map = new Map([[tab.id, old?.id || fresh()]]);
    for (const n of nodes) {
        const legacy = {agct_core:'Watcher + separated configuration (READ ONLY)',agct_guard:'Hard read-only command whitelist',agct_request:'Existing FlexRadio: subscriptions only',agct_inject_3:'Calibrate (measurement only)',agct_note:'READ ONLY FALLBACK — no verified AGC-T write command'};
        const matches = oldNodes.filter(o => o.type === n.type && (o.name === n.name || o.name === legacy[n.id]));
        map.set(n.id, matches.length === 1 ? matches[0].id : fresh());
    }
    function remap(value) {
        if (typeof value === 'string') return map.get(value) ?? value;
        if (Array.isArray(value)) return value.map(remap);
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,remap(v)]));
        return value;
    }
    const replacement = remap(incoming);
    replacement.find(n => n.type === 'tab').disabled = false;
    const oldIds = new Set([old?.id, ...oldNodes.map(n => n.id)]);
    // Refuse to break any links from outside this standalone tab.
    const removed = new Set([...oldIds].filter(id => id && !replacement.some(n => n.id === id)));
    function references(v) { return typeof v === 'string' ? removed.has(v) : Array.isArray(v) ? v.some(references) : v && typeof v === 'object' ? Object.values(v).some(references) : false; }
    const untouched = existing.filter(n => !oldIds.has(n.id));
    if (untouched.some(references)) throw Error('External references to removed watcher nodes; stopped');
    return { old, oldNodes, replacement, final: [...untouched, ...replacement] };
}
async function api(path, method='GET', body) {
    const r = await fetch(base + path, {method, redirect:'error', signal:AbortSignal.timeout(15000),
        headers:{'Content-Type':'application/json','Node-RED-API-Version':'v2','Node-RED-Deployment-Type':'flows'},
        body:body === undefined ? undefined : JSON.stringify(body)});
    if (!r.ok) throw Error(method + ' ' + path + ': HTTP ' + r.status + '; no automatic retry');
    return r.json();
}
async function main() {
    const mode=process.argv[2];
    if (!['--check','--deploy'].includes(mode)) throw Error('Usage: node scripts/deploy-agct-watcher.mjs --check|--deploy');
    const incoming=JSON.parse(await readFile(source,'utf8'));
    const snapshot=await api('/flows');
    const plan=prepare(snapshot,incoming);
    console.log(plan.old ? `Watcher vorhanden: ${plan.old.id}, ${plan.old.disabled ? 'deaktiviert' : 'aktiv'}` : 'Kein Watcher vorhanden; wird neu angelegt.');
    console.log('Ziel: genau ein aktiver Watcher mit separater UI, Auto standardmaessig AUS.');
    if (mode==='--check') { console.log('Pruefung erfolgreich. Keine Aenderung.'); return; }
    if (plan.old) {
        const dir=new URL('../backups/agct-watcher/',import.meta.url);
        await mkdir(dir,{recursive:true});
        const path=new URL(Date.now()+'.json',dir);
        await writeFile(path,JSON.stringify([plan.old,...plan.oldNodes],null,2)+'\n',{flag:'wx',mode:0o600});
        console.log('Watcher-Sicherung: '+fileURLToPath(path));
    }
    let revision=snapshot.rev;
    if (plan.old && !plan.old.disabled) {
        const paused=snapshot.flows.map(n=>n.id===plan.old.id?{...n,disabled:true}:n);
        const response=await api('/flows','POST',{rev:revision,flows:paused});
        if (typeof response.rev !== 'string') throw Error('No revision after disabling; stopped');
        revision=response.rev;
        console.log('Bisherigen Watcher deaktiviert.');
    }
    // Revision prevents overwriting any concurrent editor deployment. Failure leaves the old tab disabled.
    await api('/flows','POST',{rev:revision,flows:plan.final});
    const after=await api('/flows');
    const actual=after.flows.find(n=>n.id===plan.replacement.find(n=>n.type==='tab').id);
    if (!actual || actual.disabled) throw Error('Watcher activation could not be confirmed; inspect editor');
    console.log('Watcher aktualisiert und aktiv. Andere Flows unveraendert.');
    const ui=await fetch(base+'/agct-watcher',{redirect:'error',signal:AbortSignal.timeout(5000)});
    if (!ui.ok) throw Error('Flow deployed, but UI check returned HTTP '+ui.status);
    console.log('UI HTTP 200: http://dietpi.fritz.box:1880/agct-watcher');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e=>{console.error(e.message);process.exitCode=1;});
