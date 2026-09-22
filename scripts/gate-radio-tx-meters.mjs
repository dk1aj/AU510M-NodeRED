// Manual, presentation-only patch. Run without --deploy to validate locally.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
const require = createRequire(import.meta.url);
const { parse, compileTemplate } = require('@vue/compiler-sfc');
const marker = '// RADIO FWDPWR/SWR interlock display gate';
function patch(flows) {
    const result = structuredClone(flows);
    const node = result.find(n => n.id === '9ee3e94e3758b01f');
    if (!node || node.type !== 'ui-template') throw new Error('Missing RADIO template');
    if (node.format.includes(marker)) return result;
    const before = parse(node.format).descriptor;
    for (const expected of ['radioCardMeter(topic) {', '  computed: {', 'now: Date.now(), timer: null,']) {
        if (!node.format.includes(expected)) throw new Error('Unexpected RADIO template');
    }
    if (/\n  watch:/.test(node.format)) throw new Error('Existing watchers require review');
    node.format = node.format
        .replace('now: Date.now(), timer: null,', 'now: Date.now(), timer: null, radioTxSince: null,')
        .replace('  computed: {', `  ${marker}
  watch: {
    radioMeterTransmitting: {
      immediate: true,
      flush: 'sync',
      handler(tx) {
        // Reject previous RX/TX-cycle samples when a new TX interval begins.
        this.radioTxSince = tx ? this.msg.payload.radioStatus.at : null;
      }
    }
  },
  computed: {
    radioMeterTransmitting() { return this.radioReading('TX/RX') === 'TX'; },`)
        .replace('    radioCardMeter(topic) {', `    radioCardMeter(topic) {
      if (!this.radioMeterTransmitting) return topic === 'TX-/1/FWDPWR' ? '0 W' : '--';`)
        .replace("      // Watts were already converted", "      if (!Number.isFinite(this.radioTxSince) || row.seen < this.radioTxSince) return '--';\n      // Watts were already converted");
    const {descriptor, errors} = parse(node.format);
    if (errors.length) throw new Error(String(errors));
    const compiled = compileTemplate({source:descriptor.template.content, filename:'radio.vue', id:node.id});
    if (compiled.errors.length) throw new Error(String(compiled.errors));
    if (descriptor.template.content !== before.template.content || !isDeepStrictEqual(descriptor.styles,before.styles)) {
        // Style source positions move with script length; compare contents only.
        if (descriptor.template.content !== before.template.content || !isDeepStrictEqual(descriptor.styles.map(s=>s.content),before.styles.map(s=>s.content))) throw new Error('Layout changed');
    }
    const restored = structuredClone(result);
    restored.find(n=>n.id===node.id).format = flows.find(n=>n.id===node.id).format;
    if (!isDeepStrictEqual(restored,flows)) throw new Error('Unexpected backend or other node change');
    return result;
}

async function main() {
    if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--deploy')) throw new Error('Usage: node scripts/gate-radio-tx-meters.mjs [--deploy]');
    if (process.argv[2] !== '--deploy') {
        patch(JSON.parse(await readFile(new URL('../flows.json', import.meta.url), 'utf8')));
        console.log('Validated RADIO interlock display gate. No files written; nothing deployed.');
        return;
    }
    const url = new URL('/flows', process.env.NODE_RED_URL || 'http://127.0.0.1:1880');
    const headers = { 'Node-RED-API-Version': 'v2', 'Content-Type': 'application/json' };
    const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('GET /flows: HTTP ' + response.status);
    const current = await response.json();
    if (!Array.isArray(current.flows) || typeof current.rev !== 'string') throw new Error('Expected versioned flow response');
    const updated = patch(current.flows);
    if (isDeepStrictEqual(updated, current.flows)) { console.log('RADIO TX gate already applied. Nothing deployed.'); return; }
    const deployed = await fetch(url, {
        method: 'POST', headers: { ...headers, 'Node-RED-Deployment-Type': 'nodes' },
        body: JSON.stringify({ rev: current.rev, flows: updated }), redirect: 'error', signal: AbortSignal.timeout(15000)
    });
    if (!deployed.ok) throw new Error('POST /flows: HTTP ' + deployed.status + '; no automatic retry');
    console.log('Applied RADIO-only FWDPWR/SWR TX gating; subscriptions and layout unchanged.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
