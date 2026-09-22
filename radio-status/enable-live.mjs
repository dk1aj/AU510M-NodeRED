import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const update = require('./live-state.cjs');
const { parse, compileTemplate, compileScript } = require('@vue/compiler-sfc');
export function patch(flows) {
    const f = structuredClone(flows);
    const view = f.find(n => n.id === '9ee3e94e3758b01f');
    const backend = f.find(n => n.id === '2702052aa13cacd0');
    if (!view?.format.includes('aurora-radio-page') || !backend) throw new Error('Existing RADIO tab required');
    const prefix = 'au510m_live_';
    if (f.some(n => n.id.startsWith(prefix))) throw new Error('Live status nodes already exist; review before updating');
    const radio = '7fbf2bfc9badc7d3', z = view.z;
    const nodes = [];
    const add = (key, type, props) => nodes.push({ id: prefix + key, type, z, x: 500, y: 600 + nodes.length * 45, wires: [], ...props });
    const fn = (key, func, wires) => add(key, 'function', { name: key, func, outputs: wires.length, timeout: 0, noerr: 0, initialize: '', finalize: '', libs: [], wires });
    const state = prefix + 'state', bridge = prefix + 'bridge', request = prefix + 'request';
    add('messages', 'flexradio-message', { name: 'AU-510M slice / interlock status only', radio, client: 'all', topic: '^(slice/[0-9]+|interlock|connection/.*)$', topic_type: 're', wires: [[state]] });
    add('connection', 'status', { name: 'Status freshness / reconnect', scope: [prefix + 'messages'], wires: [[state]] });
    // Passive listener: reuses already subscribed meter traffic; never subscribes a new meter.
    add('level', 'flexradio-meter', { name: 'Existing SLC LEVEL stream, active slice selected in cache', radio, topic: '^SLC/[0-9]+/LEVEL$', topic_type: 're', output_mode: 'context', wires: [[state]] });
    add('tick', 'inject', { name: 'Status snapshot / expiry', props: [{p:'topic',vt:'str'}, {p:'payload'}], topic: '__radio_tick', payloadType: 'date', repeat: '1', crontab: '', once: true, onceDelay: 1, wires: [[state]] });
    fn('state', `${update.toString()}\nconst r = update(context.get('radio'), msg, Date.now());\ncontext.set('radio', r.state);\nreturn [{topic:'__radio_status',payload:r.snapshot}, r.commands.length ? r.commands : null];`, [[bridge], [request]]);
    add('request', 'flexradio-request', { name: 'Read-only sub slice all / sub tx all', radio, wires: [[state, prefix + 'debug']] });
    add('debug', 'debug', { name: 'Radio status subscription responses', active: false, tosidebar: true, console: false, tostatus: false, complete: 'true', targetType: 'full' });
    fn('bridge', `if (msg.topic === '__radio_status') context.set('radio', msg.payload);\nelse context.set('meters', msg.payload);\nconst meters = context.get('meters');\nif (!meters) return null;\nreturn {payload:{...meters,radioStatus:context.get('radio') || null}};`, [[view.id]]);
    if (!isDeepStrictEqual(backend.wires[1], [view.id])) throw new Error('Unexpected PA snapshot wiring');
    backend.wires[1] = [bridge];
    const before = parse(view.format).descriptor;
    let count = 0;
    // Change bindings only, not the existing elements, CSS, layout or navigation.
    view.format = view.format.replace(/<div title="[^"]*no verified AU-510M source received"><dt>([^<]+)<\/dt><dd>--<\/dd><\/div>/g, (_, label) => {
        count++;
        return `<div><dt>${label}</dt><dd>{{ radioReading('${label}') }}</dd></div>`;
    });
    if (count !== 23) throw new Error('Expected exactly 23 unmapped RADIO fields, got ' + count);
    view.format = view.format.replace('  methods: {', `  methods: {\n    radioReading(label) {\n      const r = this.msg?.payload?.radioStatus;\n      return r && r.connected && Number.isFinite(r.at) && Math.abs(this.now - r.at) < 10000 ? (r.fields?.[label] ?? '--') : '--';\n    },`);
    const { descriptor, errors } = parse(view.format);
    if (errors.length) throw new Error(String(errors));
    const compiled = compileTemplate({source:descriptor.template.content, filename:'radio.vue', id:view.id});
    if (compiled.errors.length) throw new Error(String(compiled.errors));
    compileScript(descriptor, {id:view.id});
    if (!isDeepStrictEqual(before.styles.map(s=>s.content), descriptor.styles.map(s=>s.content))) throw new Error('CSS changed');
    const restored = structuredClone(f);
    restored.find(n=>n.id===view.id).format = flows.find(n=>n.id===view.id).format;
    restored.find(n=>n.id===backend.id).wires = flows.find(n=>n.id===backend.id).wires;
    if (!isDeepStrictEqual(restored, flows)) throw new Error('Unexpected existing-node change');
    return [...f, ...nodes];
}
async function main() {
    if (process.argv[2] && process.argv[2] !== '--deploy') throw new Error('Usage: node radio-status/enable-live.mjs [--deploy]');
    if (!process.argv[2]) { patch(JSON.parse(await readFile(new URL('../flows.json', import.meta.url), 'utf8'))); console.log('Validated live status patch; nothing deployed.'); return; }
    const url = new URL('/flows', process.env.NODE_RED_URL || 'http://127.0.0.1:1880');
    const headers = {'Node-RED-API-Version':'v2','Content-Type':'application/json'};
    const response = await fetch(url, {headers,redirect:'error',signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error('GET /flows: HTTP '+response.status);
    const current = await response.json();
    if (!Array.isArray(current.flows) || typeof current.rev !== 'string') throw new Error('Expected versioned flows');
    const updated = patch(current.flows);
    const sent = await fetch(url, {method:'POST',headers:{...headers,'Node-RED-Deployment-Type':'nodes'},body:JSON.stringify({rev:current.rev,flows:updated}),redirect:'error',signal:AbortSignal.timeout(15000)});
    if (!sent.ok) throw new Error('POST /flows: HTTP '+sent.status+'; no automatic retry');
    console.log('Live RADIO bindings deployed. Verify subscription acknowledgements and actual radio telemetry.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e=>{console.error(e.message);process.exitCode=1;});
