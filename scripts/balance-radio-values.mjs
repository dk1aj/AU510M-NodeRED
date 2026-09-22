// Manual, presentation-only patch. Run without --deploy to validate locally.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
const require = createRequire(import.meta.url);
const { parse, compileTemplate } = require('@vue/compiler-sfc');
const marker = '/* RADIO balanced frequency, forward power and SWR */';
function patch(flows) {
    const result = structuredClone(flows);
    const node = result.find(n => n.id === '9ee3e94e3758b01f');
    if (!node || node.type !== 'ui-template') throw new Error('Missing RADIO template');
    if (node.format.includes(marker)) return result;
    const original = `.aurora-radio-page .aurora-radio-frequency>.aurora-frequency-with-meters{display:grid;grid-template-columns:minmax(0,1fr) 120px 100px;grid-template-rows:15px minmax(0,1fr);column-gap:16px;row-gap:0;align-items:end}`;
    const originalValues = '.aurora-radio-page .aurora-radio-frequency dd.aurora-radio-meter-value{font-size:28px;color:#edf5fc;padding-bottom:4px}';
    if (!node.format.includes(original) || !node.format.includes(originalValues)) throw new Error('Unexpected RADIO layout; nothing changed');
    const before = parse(node.format).descriptor;
    // Keep the 90px card and 800x480 frame. Asymmetric padding shifts the
    // reading block 8px right; the wider first column accommodates MHz.
    node.format = node.format.replace(original, `${marker}
.aurora-radio-page .aurora-radio-frequency>.aurora-frequency-with-meters{display:grid;grid-template-columns:minmax(0,390px) minmax(0,1fr) 128px;grid-template-rows:15px minmax(0,1fr);column-gap:12px;row-gap:0;align-items:end;padding-left:28px;padding-right:12px}`)
      .replace(originalValues, `.aurora-radio-page .aurora-radio-frequency .aurora-frequency-with-meters dd{font-size:48px;font-weight:700;line-height:1.1;color:#8ddfff;padding-bottom:0}
.aurora-radio-page .aurora-frequency-with-meters .aurora-forward-label,.aurora-radio-page .aurora-frequency-with-meters .aurora-forward-value{text-align:center}
.aurora-radio-page .aurora-frequency-with-meters .aurora-swr-label,.aurora-radio-page .aurora-frequency-with-meters .aurora-swr-value{text-align:right}`);
    const { descriptor, errors } = parse(node.format);
    if (errors.length) throw new Error(String(errors));
    const compiled = compileTemplate({ source: descriptor.template.content, filename: 'radio.vue', id: node.id });
    if (compiled.errors.length) throw new Error(String(compiled.errors));
    if (descriptor.script.content !== before.script.content || descriptor.template.content !== before.template.content) throw new Error('Unexpected logic or value binding change');
    const restored = structuredClone(result);
    restored.find(n => n.id === node.id).format = flows.find(n => n.id === node.id).format;
    if (!isDeepStrictEqual(restored, flows)) throw new Error('Unexpected backend or other node change');
    return result;
}

async function main() {
    if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--deploy')) throw new Error('Usage: node scripts/balance-radio-values.mjs [--deploy]');
    if (process.argv[2] !== '--deploy') {
        patch(JSON.parse(await readFile(new URL('../flows.json', import.meta.url), 'utf8')));
        console.log('Validated RADIO layout: equal 48px values; template bindings and scripts unchanged. Nothing deployed.');
        return;
    }
    const url = new URL('/flows', process.env.NODE_RED_URL || 'http://127.0.0.1:1880');
    const headers = { 'Node-RED-API-Version': 'v2', 'Content-Type': 'application/json' };
    const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('GET /flows: HTTP ' + response.status);
    const current = await response.json();
    if (!Array.isArray(current.flows) || typeof current.rev !== 'string') throw new Error('Expected versioned flow response');
    const updated = patch(current.flows);
    if (isDeepStrictEqual(updated, current.flows)) { console.log('RADIO layout already applied. Nothing deployed.'); return; }
    const deployed = await fetch(url, {
        method: 'POST', headers: { ...headers, 'Node-RED-Deployment-Type': 'nodes' },
        body: JSON.stringify({ rev: current.rev, flows: updated }), redirect: 'error', signal: AbortSignal.timeout(15000)
    });
    if (!deployed.ok) throw new Error('POST /flows: HTTP ' + deployed.status + '; no automatic retry');
    console.log('Updated RADIO layout only; live values and backend unchanged.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
