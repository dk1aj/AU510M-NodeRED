import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {isDeepStrictEqual} from 'node:util';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const averageDisplay=require('./average-display.cjs');
const {parse,compileTemplate,compileScript}=require('@vue/compiler-sfc');
const ids=['9ee3e94e3758b01f','961ffe09d3da81ac','80108e5a65682ca7','9b1bcb4b21cd24ff'];
const avgId='au510m_display_average';
export function patch(flows) {
 const f=structuredClone(flows);
 if(f.some(n=>n.id===avgId)) throw new Error('Averaging already installed; review before updating');
 const find=id=>{const n=f.find(n=>n.id===id);if(!n)throw new Error('Required node missing: '+id);return n;};
 const meter=find('7330e8695476df43'), backend=find('2702052aa13cacd0'), state=find('au510m_live_state');
 if(!isDeepStrictEqual(backend.wires.slice(1,5),[['au510m_live_bridge'],[ids[1]],[ids[2]],[ids[3]]]) || !isDeepStrictEqual(state.wires[0],['au510m_live_bridge'])) throw new Error('Unexpected display wiring');
 // Branch the actual raw sample stream; preserve its original destination and payloads.
 meter.wires[0].push(avgId);
 for(let i=1;i<=4;i++) backend.wires[i]=[avgId];
 state.wires[0]=[avgId];
 const send="return [{topic:'__radio_status',payload:r.snapshot}, r.commands.length ? r.commands : null];";
 if(!state.func.includes(send))throw new Error('Unexpected status snapshot');
 state.func=state.func.replace(send, `// Display source identity only; existing active-slice logic and status fields remain unchanged.
const selected = Object.entries(r.state.slices).filter(([,s]) => s.active === 1 || s.active === '1');
r.snapshot.activeSliceId = selected.length === 1 ? selected[0][0] : null;
${send}`);
 for(const id of ids){
  const view=find(id),before=parse(view.format).descriptor;
  view.format=view.format.replace('  methods: {', `  methods: {
    displayTxActive() {
      const r = this.msg?.payload?.radioStatus;
      return this.msg?.payload?.displayTx === true && r?.connected === true &&
        r.fields?.['TX/RX'] === 'TX' && Number.isFinite(r.at) && Math.abs(this.now - r.at) < 10000;
    },`);
  const reading=/    reading\(row\) \{[\s\S]*?\n    \},/;
  if(!reading.test(view.format))throw new Error('Missing display formatter');
  view.format=view.format.replace(reading,`    reading(row) {
      if (row.topic === 'TX-/1/FWDPWR' && !this.displayTxActive()) return '0';
      if (row.topic === 'TX-/3/SWR' && !this.displayTxActive()) return '--';
      if (row.label === 'PASTAT') return row.raw === null ? '—' : String(row.raw);
      const a = row.average;
      const value = row.power ? a?.watts : a?.value;
      if (!Number.isFinite(value)) return '--';
      if (row.label === 'FWDPWR') return String(Math.round(value));
      return String(Number(value.toFixed(2)));
    },`);
  const gauge="    gaugeValue(row) { return row.raw === null ? null : row.power ? row.watts : row.value; },";
  if(!view.format.includes(gauge))throw new Error('Unexpected gauge formatter');
  view.format=view.format.replace(gauge,`    gaugeValue(row) {
      if (row.topic === 'TX-/1/FWDPWR' && !this.displayTxActive()) return 0;
      if (row.topic === 'TX-/3/SWR' && !this.displayTxActive()) return null;
      return row.power ? row.average?.watts ?? null : row.average?.value ?? null;
    },`);
  view.format=view.format.replace("{{ row.raw === null ? '—' : String(row.raw) }} {{ row.radioUnit || 'dBm' }} raw", "{{ row.average ? Number(row.average.raw.toFixed(2)) : '--' }} {{ row.radioUnit || 'dBm' }} avg");
  const old='<strong>{{ reading(row) }}</strong>';
  if(!view.format.includes(old))throw new Error('Unexpected meter markup');
  view.format=view.format.replace(old,`<strong class="aurora-number-slot"><Transition name="aurora-number" :css="!['FWDPWR','SWR'].includes(row.label) || displayTxActive()"><span :key="reading(row)">{{ reading(row) }}</span></Transition></strong>`);
  if(id===ids[0]){
   const method=/    radioCardMeter\(topic\) \{[\s\S]*?\n    \},/;
   if(!method.test(view.format))throw new Error('Missing RADIO meter formatter');
   view.format=view.format.replace(method,`    radioCardMeter(topic) {
      if (!this.radioMeterTransmitting || !this.msg?.payload?.displayTx) return topic === 'TX-/1/FWDPWR' ? '0 W' : '--';
      const row = this.rows.find(r => r.topic === topic);
      if (!row) return '--';
      const text = this.reading(row);
      return text === '--' ? '--' : text + (topic === 'TX-/1/FWDPWR' ? ' W' : '');
    },`);
   for(const topic of ['TX-/1/FWDPWR','TX-/3/SWR']) {
    const text=`{{ radioCardMeter('${topic}') }}`;
    if(!view.format.includes(text))throw new Error('Missing RADIO power/SWR binding');
    view.format=view.format.replace(text,`<Transition name="aurora-number" :css="radioMeterTransmitting && !!msg?.payload?.displayTx"><span :key="radioCardMeter('${topic}')">${text}</span></Transition>`);
   }
   const level="{{ radioReading('S-meter') }}";
   view.format=view.format.replace(level,`<Transition name="aurora-number"><span :key="radioReading('S-meter')">${level}</span></Transition>`);
  }
  const css=`
/* Numeric text only: no card/background animation or layout resizing. */
.aurora-kiosk .aurora-number-slot,.aurora-radio-page dd{font-variant-numeric:tabular-nums}
.aurora-kiosk .aurora-number-enter-active{transition:opacity 250ms ease-out}
.aurora-kiosk .aurora-number-enter-from{opacity:.35}
.aurora-kiosk .aurora-number-leave-active{display:none}
@media(prefers-reduced-motion:reduce){.aurora-kiosk .aurora-number-enter-active{transition:none}}
`;
  view.format=view.format.replace('</style>',css+'</style>');
  const {descriptor,errors}=parse(view.format);
  if(errors.length)throw new Error(String(errors));
  const compiled=compileTemplate({source:descriptor.template.content,filename:id+'.vue',id});
  if(compiled.errors.length)throw new Error(String(compiled.errors));
  compileScript(descriptor,{id});
  if(!descriptor.styles[0].content.startsWith(before.styles[0].content.trimEnd()))throw new Error('Existing layout CSS changed');
 }
 const restored=structuredClone(f);
 for(const id of ids)restored.find(n=>n.id===id).format=flows.find(n=>n.id===id).format;
 for(const id of [meter.id,backend.id,state.id])restored[restored.findIndex(n=>n.id===id)]=structuredClone(flows.find(n=>n.id===id));
 if(!isDeepStrictEqual(restored,flows))throw new Error('Unexpected existing node change');
 f.push({id:avgId,type:'function',z:backend.z,name:'Display only: rolling 1-second arithmetic mean',func:`${averageDisplay.toString()}\nconst r=averageDisplay(context.get('display'),msg,Date.now());\ncontext.set('display',r.state);\nreturn r.output;`,outputs:4,timeout:0,noerr:0,initialize:'',finalize:'',libs:[],x:950,y:700,wires:ids.map(id=>[id])});
 return f;
}
async function main(){
 if(process.argv[2]&&process.argv[2]!=='--deploy')throw new Error('Usage: node radio-status/enable-averaging.mjs [--deploy]');
 if(!process.argv[2]){patch(JSON.parse(await readFile(new URL('../flows.json',import.meta.url),'utf8')));console.log('Averaging patch and four Vue templates validated. Nothing deployed.');return;}
 const url=new URL('/flows',process.env.NODE_RED_URL||'http://127.0.0.1:1880');
 const headers={'Node-RED-API-Version':'v2','Content-Type':'application/json'};
 const response=await fetch(url,{headers,redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('GET /flows: HTTP '+response.status);
 const current=await response.json();
 if(!Array.isArray(current.flows)||typeof current.rev!=='string')throw new Error('Expected versioned flows');
 const updated=patch(current.flows);
 const sent=await fetch(url,{method:'POST',headers:{...headers,'Node-RED-Deployment-Type':'nodes'},body:JSON.stringify({rev:current.rev,flows:updated}),redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!sent.ok)throw new Error('POST /flows: HTTP '+sent.status+'; no automatic retry');
 console.log('Display averaging deployed. Subscriptions, raw input and radio commands unchanged.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
