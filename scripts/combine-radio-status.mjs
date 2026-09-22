// Manual, presentation-only patch. Run without --deploy to validate locally.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
const require = createRequire(import.meta.url);
const { parse, compileTemplate } = require('@vue/compiler-sfc');
const marker = '/* RADIO combined RIT XIT DAX cards */';
function patch(flows) {
    const result = structuredClone(flows);
    const node = result.find(n => n.id === '9ee3e94e3758b01f');
    if (!node || node.type !== 'ui-template') throw new Error('Missing RADIO template');
    if (node.format.includes(marker)) return result;
    const before = parse(node.format).descriptor;
    for (const [label, detail] of [['RIT','offset'], ['XIT','offset'], ['DAX','channel']]) {
        const stateCard = `<div><dt>${label} on</dt><dd>{{ radioReading('${label} on') }}</dd></div>`;
        const detailCard = `<div><dt>${label} ${detail}</dt><dd>{{ radioReading('${label} ${detail}') }}</dd></div>`;
        if (!node.format.includes(stateCard) || !node.format.includes(detailCard)) throw new Error('Missing original cards: ' + label);
        const second = label === 'DAX'
            ? `<span v-if="radioReading('DAX channel') !== '0'" class="aurora-paired-detail">{{ radioReading('DAX channel') === '--' ? '--' : 'CH ' + radioReading('DAX channel') }}</span>`
            : `<span class="aurora-paired-detail">{{ radioReading('${label} offset') }}</span>`;
        node.format = node.format.replace(stateCard, `<div class="aurora-paired-status"><dt>${label}</dt><dd><span>{{ radioReading('${label} on') }}</span>${second}</dd></div>`)
            .replace(detailCard, '');
    }
    const css = `
${marker}
/* The twelve other details retain their positions. Three wider paired cards fill the last row. */
.aurora-radio-page .aurora-radio-secondary>.aurora-paired-status{grid-column:span 2}
.aurora-radio-page .aurora-radio-secondary>.aurora-paired-status dd{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.aurora-radio-page .aurora-paired-status .aurora-paired-detail{font-size:16px;color:#bacee0;font-weight:400}
`;
    node.format = node.format.replace('</style>', css + '</style>');
    const {descriptor, errors} = parse(node.format);
    if (errors.length) throw new Error(String(errors));
    const compiled = compileTemplate({source:descriptor.template.content, filename:'radio.vue', id:node.id});
    if (compiled.errors.length) throw new Error(String(compiled.errors));
    if (descriptor.script.content !== before.script.content) throw new Error('Existing logic changed');
    const restored = structuredClone(result);
    restored.find(n=>n.id===node.id).format = flows.find(n=>n.id===node.id).format;
    if (!isDeepStrictEqual(restored,flows)) throw new Error('Unexpected backend or other node change');
    return result;
}

async function main() {
    if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--deploy')) throw new Error('Usage: node scripts/combine-radio-status.mjs [--deploy]');
    if (process.argv[2] !== '--deploy') {
        patch(JSON.parse(await readFile(new URL('../flows.json', import.meta.url), 'utf8')));
        console.log('Validated combined RIT, XIT and DAX cards. No files written; nothing deployed.');
        return;
    }
    const url = new URL('/flows', process.env.NODE_RED_URL || 'http://127.0.0.1:1880');
    const headers = { 'Node-RED-API-Version': 'v2', 'Content-Type': 'application/json' };
    const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('GET /flows: HTTP ' + response.status);
    const current = await response.json();
    if (!Array.isArray(current.flows) || typeof current.rev !== 'string') throw new Error('Expected versioned flow response');
    const updated = patch(current.flows);
    if (isDeepStrictEqual(updated, current.flows)) { console.log('Combined status cards already applied. Nothing deployed.'); return; }
    const deployed = await fetch(url, {
        method: 'POST', headers: { ...headers, 'Node-RED-Deployment-Type': 'nodes' },
        body: JSON.stringify({ rev: current.rev, flows: updated }), redirect: 'error', signal: AbortSignal.timeout(15000)
    });
    if (!deployed.ok) throw new Error('POST /flows: HTTP ' + deployed.status + '; no automatic retry');
    console.log('Combined RADIO RIT, XIT and DAX cards; existing live bindings preserved.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
