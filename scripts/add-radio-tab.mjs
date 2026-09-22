// Manual, presentation-only patch. Run without --deploy to validate locally.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
const require = createRequire(import.meta.url);
const { parse, compileTemplate } = require('@vue/compiler-sfc');
const ids = ['9ee3e94e3758b01f', '961ffe09d3da81ac', '80108e5a65682ca7', '9b1bcb4b21cd24ff'];
const marker = '/* AU-510M dedicated RADIO tab */';
const css = `
${marker}
.aurora-kiosk .aurora-tabs{grid-template-columns:repeat(5,minmax(0,1fr)) 154px}
.aurora-radio-page.aurora-kiosk{grid-template-rows:42px 22px 90px 70px minmax(0,1fr) 16px}
.aurora-radio-page dl{margin:0;min-width:0;min-height:0;display:grid;gap:6px}
.aurora-radio-page dl>div{background:#1a2736;border:1px solid #35465a;border-radius:5px;padding:8px 12px;min-width:0;min-height:0;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between}
.aurora-radio-page dt{font-size:12px;color:#bacee0;line-height:15px}
.aurora-radio-page dd{margin:0;font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.aurora-radio-page .aurora-radio-frequency{grid-template-columns:1fr}
.aurora-radio-page .aurora-radio-frequency>div{background:#203348;border-color:#6395b9}
.aurora-radio-page .aurora-radio-frequency dd{font-size:48px;color:#8ddfff}
.aurora-radio-page .aurora-radio-primary{grid-template-columns:repeat(4,minmax(0,1fr))}
.aurora-radio-page .aurora-radio-primary dd{font-size:30px}
.aurora-radio-page .aurora-radio-secondary{grid-template-columns:repeat(6,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr))}
`;
const oldTabs = "tabs: [{ key: 'pa', label: 'PA' }";
const newTabs = "tabs: [{ key: 'radio', label: 'RADIO' }, { key: 'pa', label: 'PA' }";
const statusHeader = /<header class="aurora-heading aurora-heading-status">[\s\S]*?<\/header>/;
const simpleHeader = '<header class="aurora-heading"><h1>{{ title }}</h1><span>{{ freshCount }}/{{ rows.length }} live · {{ connection }}</span></header>';

function patch(flows) {
    const result = structuredClone(flows);
    const pa = result.find(n => n.id === ids[0]);
    if (!pa) throw new Error('Missing PA template');
    const applied = ids.map(id => result.find(n => n.id === id)?.format?.includes(marker));
    if (applied.every(Boolean)) return result;
    if (applied.some(Boolean)) throw new Error('Partially applied RADIO layout; review before proceeding');
    const header = pa.format.match(statusHeader)?.[0];
    if (!header) throw new Error('Missing existing status block; nothing changed');
    const fields = new Map([...header.matchAll(/<div\b[^>]*><dt>([^<]+)<\/dt><dd>([\s\S]*?)<\/dd><\/div>/g)]
        .map(match => [match[1], match[0]]));
    if (fields.size !== 23) throw new Error('Expected all 23 existing status fields');
    // Preserve existing dd content/bindings exactly. Never infer radio fields or state.
    const display = name => {
        const item = fields.get(name);
        if (!item) throw new Error('Missing status field: ' + name);
        const labels = { 'RX ant': 'RX antenna', 'TX ant': 'TX antenna', 'DAX ch': 'DAX channel' };
        return labels[name] ? item.replace('<dt>' + name + '</dt>', '<dt>' + labels[name] + '</dt>') : item;
    };
    const primary = ['Mode', 'TX/RX', 'Active slice', 'S-meter'];
    const secondary = ['RX ant', 'TX ant', 'RX filter', 'SPLIT', 'Lock', 'Mute', 'Audio', 'NB', 'NR', 'ANF', 'QSK', 'DSP', 'RIT on', 'RIT offset', 'XIT on', 'XIT offset', 'DAX on', 'DAX ch'];
    const nav = pa.format.match(/<nav\b[\s\S]*?<\/nav>/)?.[0];
    if (!nav) throw new Error('Missing existing navigation');
    const radio = `
    <section v-show="activeTab === 'radio'" class="aurora-kiosk aurora-radio-page" :data-active="activeTab === 'radio'" aria-label="Radio and slice status">
      ${nav.replaceAll('sectionKey', "'radio'")}
      <header class="aurora-heading"><h1>RADIO</h1><span>AU-510M · READ ONLY</span></header>
      <dl class="aurora-radio-frequency" id="aurora-panel-radio" aria-label="Frequency">${display('Frequency')}</dl>
      <dl class="aurora-radio-primary" aria-label="Primary radio status">${primary.map(display).join('\n')}</dl>
      <dl class="aurora-radio-secondary" aria-label="Radio and slice details">${secondary.map(display).join('\n')}</dl>
      <footer class="aurora-footer"><span>Radio / slice status</span><span>-- = unavailable</span></footer>
    </section>
`;
    for (const id of ids) {
        const node = result.find(n => n.id === id);
        if (!node || node.type !== 'ui-template') throw new Error('Missing template: ' + id);
        if (!node.format.includes(oldTabs)) throw new Error('Unexpected navigation: ' + id);
        const before = parse(node.format).descriptor;
        if (id !== ids[3]) {
            const currentHeader = node.format.match(statusHeader)?.[0];
            if (currentHeader !== header) throw new Error('Status blocks differ; refusing to discard distinct bindings');
            node.format = node.format.replace(statusHeader, simpleHeader);
        }
        node.format = node.format.replace(oldTabs, newTabs).replace("activeTab: 'pa'", "activeTab: 'radio'")
            .replace('</style>', css + '</style>');
        if (id === ids[0]) node.format = node.format.replace('<Teleport to="body">', '<Teleport to="body">' + radio);
        const { descriptor, errors } = parse(node.format);
        if (errors.length) throw new Error(String(errors));
        const compiled = compileTemplate({ source: descriptor.template.content, filename: id + '.vue', id });
        if (compiled.errors.length) throw new Error(String(compiled.errors));
        const expectedScript = before.script.content.replace(oldTabs, newTabs).replace("activeTab: 'pa'", "activeTab: 'radio'");
        if (descriptor.script.content !== expectedScript) throw new Error('Unexpected meter logic change');
        if (!node.format.includes('width:800px;height:480px')) throw new Error('Unexpected viewport');
        const oldCards = before.template.content.match(/<article\b[\s\S]*?<\/article>/g);
        const newCards = descriptor.template.content.match(/<article\b[\s\S]*?<\/article>/g);
        if (!isDeepStrictEqual(oldCards, newCards)) throw new Error('Meter cards changed');
    }
    // Existing node IDs, all wiring, subscriptions, mappings and conversions stay intact.
    const restored = structuredClone(result);
    for (const id of ids) restored.find(n => n.id === id).format = flows.find(n => n.id === id).format;
    if (!isDeepStrictEqual(restored, flows)) throw new Error('Unexpected non-template change');
    return result;
}

async function main() {
    if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--deploy')) throw new Error('Usage: node scripts/add-radio-tab.mjs [--deploy]');
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
    if (isDeepStrictEqual(updated, current.flows)) { console.log('RADIO tab already applied. Nothing deployed.'); return; }
    const deployed = await fetch(url, {
        method: 'POST', headers: { ...headers, 'Node-RED-Deployment-Type': 'nodes' },
        body: JSON.stringify({ rev: current.rev, flows: updated }), redirect: 'error', signal: AbortSignal.timeout(15000)
    });
    if (!deployed.ok) throw new Error('POST /flows: HTTP ' + deployed.status + '; no automatic retry');
    console.log('Applied RADIO / PA / TX / RX / EXT navigation and moved existing status fields to RADIO.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
