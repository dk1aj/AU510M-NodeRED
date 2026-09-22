// Manual, presentation-only patch. Run without --deploy to validate locally.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
const require = createRequire(import.meta.url);
const { parse, compileTemplate } = require('@vue/compiler-sfc');
const ids = ['9ee3e94e3758b01f', '961ffe09d3da81ac', '80108e5a65682ca7', '9b1bcb4b21cd24ff'];
const marker = '/* AU-510M card text placement */';
const css = `
${marker}
/* Reserve a separate bottom row: age text never shares the value's row. */
.aurora-kiosk .aurora-meter-grid .aurora-cell{display:grid;grid-template-rows:auto minmax(0,1fr) auto}
.aurora-kiosk .aurora-meter-grid .aurora-cell-heading{flex-direction:row;align-items:flex-start;justify-content:space-between}
.aurora-kiosk .aurora-meter-grid .aurora-value{flex-direction:row;align-items:baseline;justify-content:flex-start;align-self:center;justify-self:start;margin:0;gap:3px}
.aurora-kiosk .aurora-meter-grid .aurora-detail{align-self:end;min-width:0}
.aurora-kiosk .aurora-meter-grid .aurora-detail:has(.aurora-sample-age){text-align:right}
.aurora-kiosk .aurora-meter-grid .aurora-sample-age{display:block;text-align:right;overflow-wrap:anywhere}
/* Fit the three text rows inside the existing short PA cards, without resizing. */
.aurora-kiosk .aurora-grid-pa .aurora-cell:not(.aurora-priority){padding-top:3px;padding-bottom:4px}
`;

function patch(flows) {
    const result = structuredClone(flows);
    for (const id of ids) {
        const node = result.find(n => n.id === id);
        if (!node || node.type !== 'ui-template') throw new Error('Missing meter template: ' + id);
        if (node.format.includes(marker)) continue;
        const old = '<span v-else>{{ row.seen ? age(row) : \'Waiting for sample\' }}</span>';
        if (!node.format.includes(old) || !node.format.includes('</style>')) throw new Error('Unexpected template: ' + id);
        const before = parse(node.format).descriptor;
        node.format = node.format.replace(old, old.replace('<span ', '<span class="aurora-sample-age" '))
            .replace('</style>', css + '</style>');
        const { descriptor, errors } = parse(node.format);
        if (errors.length) throw new Error(String(errors));
        const compiled = compileTemplate({ source: descriptor.template.content, filename: id + '.vue', id });
        if (compiled.errors.length) throw new Error(String(compiled.errors));
        if (descriptor.script.content !== before.script.content) throw new Error('Unexpected logic change');
        if (!node.format.includes('width:800px;height:480px')) throw new Error('Unexpected viewport');
    }
    // Nothing except the four template format strings may change.
    const restored = structuredClone(result);
    for (const id of ids) restored.find(n => n.id === id).format = flows.find(n => n.id === id).format;
    if (!isDeepStrictEqual(restored, flows)) throw new Error('Unexpected non-template change');
    return result;
}

async function main() {
    if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--deploy')) throw new Error('Usage: node scripts/fix-meter-card-placement.mjs [--deploy]');
    if (process.argv[2] !== '--deploy') {
        patch(JSON.parse(await readFile(new URL('../flows.json', import.meta.url), 'utf8')));
        console.log('Validated all four templates. No files written; nothing deployed.');
        return;
    }
    const url = new URL('/flows', process.env.NODE_RED_URL || 'http://127.0.0.1:1880');
    const headers = { 'Node-RED-API-Version': 'v2', 'Content-Type': 'application/json' };
    const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('GET /flows: HTTP ' + response.status);
    const current = await response.json();
    if (!Array.isArray(current.flows) || typeof current.rev !== 'string') throw new Error('Expected versioned flow response');
    const updated = patch(current.flows);
    if (isDeepStrictEqual(updated, current.flows)) { console.log('Placement fix already applied. Nothing deployed.'); return; }
    const deployed = await fetch(url, {
        method: 'POST', headers: { ...headers, 'Node-RED-Deployment-Type': 'nodes' },
        body: JSON.stringify({ rev: current.rev, flows: updated }), redirect: 'error', signal: AbortSignal.timeout(15000)
    });
    if (!deployed.ok) throw new Error('POST /flows: HTTP ' + deployed.status + '; no automatic retry');
    console.log('Applied card text placement to all four tabs.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
