// Manual, presentation-only patch. Run without --deploy to validate locally.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
const require = createRequire(import.meta.url);
const { parse, compileTemplate } = require('@vue/compiler-sfc');
const marker = '/* RADIO frequency card: existing FWDPWR and SWR */';
const meterMethod = `    radioCardMeter(topic) {
      const payload = this.msg?.payload;
      const row = this.rows.find(item => item.topic === topic);
      if (!payload || payload.online !== true || !Number.isFinite(payload.timestamp) ||
          Math.abs(this.now - payload.timestamp) >= 10000 || !row || !row.seen ||
          this.now - row.seen < 0 || this.now - row.seen >= 15000 || row.raw === null) return '--';
      // Watts were already converted by the existing meter backend. Do not convert again.
      const value = topic === 'TX-/1/FWDPWR' ? row.watts : row.value;
      if (!Number.isFinite(value)) return '--';
      return topic === 'TX-/1/FWDPWR' ? Math.round(value) + ' W' : String(Number(value.toFixed(2)));
    },
`;
function patch(flows) {
    const result = structuredClone(flows);
    const node = result.find(n => n.id === '9ee3e94e3758b01f');
    if (!node || node.type !== 'ui-template') throw new Error('Missing RADIO template');
    if (node.format.includes(marker)) return result;
    const original = '<dl class="aurora-radio-frequency" id="aurora-panel-radio" aria-label="Frequency"><div><dt>Frequency</dt><dd>{{ radioReading(\'Frequency\') }}</dd></div></dl>';
    const replacement = `<dl class="aurora-radio-frequency" id="aurora-panel-radio" aria-label="Frequency, forward power and SWR"><div class="aurora-frequency-with-meters">
        <dt class="aurora-frequency-label">Frequency</dt><dd class="aurora-frequency-value">{{ radioReading('Frequency') }}</dd>
        <dt class="aurora-forward-label">FWDPWR</dt><dd class="aurora-radio-meter-value aurora-forward-value">{{ radioCardMeter('TX-/1/FWDPWR') }}</dd>
        <dt class="aurora-swr-label">SWR</dt><dd class="aurora-radio-meter-value aurora-swr-value">{{ radioCardMeter('TX-/3/SWR') }}</dd>
      </div></dl>`;
    if (!node.format.includes(original) || !node.format.includes('  methods: {')) throw new Error('Unexpected Frequency card; nothing changed');
    const before = parse(node.format).descriptor;
    const css = `
${marker}
.aurora-radio-page .aurora-radio-frequency>.aurora-frequency-with-meters{display:grid;grid-template-columns:minmax(0,1fr) 120px 100px;grid-template-rows:15px minmax(0,1fr);column-gap:16px;row-gap:0;align-items:end}
.aurora-radio-page .aurora-frequency-with-meters dt{grid-row:1;align-self:start}
.aurora-radio-page .aurora-frequency-with-meters dd{grid-row:2;min-width:0}
.aurora-radio-page .aurora-frequency-label,.aurora-radio-page .aurora-frequency-value{grid-column:1}
.aurora-radio-page .aurora-forward-label,.aurora-radio-page .aurora-forward-value{grid-column:2}
.aurora-radio-page .aurora-swr-label,.aurora-radio-page .aurora-swr-value{grid-column:3}
.aurora-radio-page .aurora-radio-frequency dd.aurora-radio-meter-value{font-size:28px;color:#edf5fc;padding-bottom:4px}
`;
    node.format = node.format.replace(original, replacement).replace('  methods: {', '  methods: {\n' + meterMethod).replace('</style>', css + '</style>');
    const {descriptor, errors} = parse(node.format);
    if (errors.length) throw new Error(String(errors));
    const compiled = compileTemplate({source:descriptor.template.content, filename:'radio.vue', id:node.id});
    if (compiled.errors.length) throw new Error(String(compiled.errors));
    if (descriptor.script.content !== before.script.content.replace('  methods: {','  methods: {\n'+meterMethod)) throw new Error('Unexpected existing logic change');
    const restored = structuredClone(result);
    restored.find(n=>n.id===node.id).format = flows.find(n=>n.id===node.id).format;
    if (!isDeepStrictEqual(restored,flows)) throw new Error('Unexpected backend or other node change');
    return result;
}

async function main() {
    if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--deploy')) throw new Error('Usage: node scripts/extend-radio-frequency.mjs [--deploy]');
    if (process.argv[2] !== '--deploy') {
        patch(JSON.parse(await readFile(new URL('../flows.json', import.meta.url), 'utf8')));
        console.log('Validated RADIO Frequency card. No files written; nothing deployed.');
        return;
    }
    const url = new URL('/flows', process.env.NODE_RED_URL || 'http://127.0.0.1:1880');
    const headers = { 'Node-RED-API-Version': 'v2', 'Content-Type': 'application/json' };
    const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('GET /flows: HTTP ' + response.status);
    const current = await response.json();
    if (!Array.isArray(current.flows) || typeof current.rev !== 'string') throw new Error('Expected versioned flow response');
    const updated = patch(current.flows);
    if (isDeepStrictEqual(updated, current.flows)) { console.log('Frequency card extension already applied. Nothing deployed.'); return; }
    const deployed = await fetch(url, {
        method: 'POST', headers: { ...headers, 'Node-RED-Deployment-Type': 'nodes' },
        body: JSON.stringify({ rev: current.rev, flows: updated }), redirect: 'error', signal: AbortSignal.timeout(15000)
    });
    if (!deployed.ok) throw new Error('POST /flows: HTTP ' + deployed.status + '; no automatic retry');
    console.log('Updated RADIO Frequency card only; existing FWDPWR watts and SWR reused.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
