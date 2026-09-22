// Preparation only: never writes flows.json or contacts Node-RED/the radio.
const fs = require('node:fs');
const path = require('node:path');
const flows = JSON.parse(fs.readFileSync(path.join(__dirname, '../flows.json'), 'utf8'));
const ids = ['9ee3e94e3758b01f', '961ffe09d3da81ac', '80108e5a65682ca7'];
// These are display labels, NOT API field names. Await actual AU-510M evidence.
const labels = ['Frequency', 'Mode', 'Active slice', 'RX ant', 'TX ant', 'RX filter',
    'SPLIT', 'TX/RX', 'Lock', 'S-meter', 'Mute', 'Audio', 'NB', 'NR', 'ANF',
    'QSK', 'DSP', 'RIT on', 'RIT offset', 'XIT on', 'XIT offset', 'DAX on', 'DAX ch'];
const oldHeader = '<header class="aurora-heading"><h1>{{ title }}</h1><span>{{ freshCount }}/{{ rows.length }} live · {{ connection }}</span></header>';
const header = `<header class="aurora-heading aurora-heading-status">
        <div class="aurora-heading-title"><h1>{{ title }}</h1><small>{{ freshCount }}/{{ rows.length }} meters live</small></div>
        <dl class="aurora-radio-status" aria-label="Radio and slice status; awaiting verified radio data">
${labels.map(label => `          <div title="${label}: no verified AU-510M source received"><dt>${label}</dt><dd>--</dd></div>`).join('\n')}
        </dl>
      </header>`;
const css = `
/* Scoped so the unchanged EXT widget cannot override the status layout. */
.aurora-kiosk:has(.aurora-heading-status){grid-template-rows:42px 64px minmax(0,1fr) 16px}
.aurora-heading.aurora-heading-status{display:grid;grid-template-columns:155px minmax(0,1fr);gap:8px;align-items:center}
.aurora-heading-title h1{font-size:14px;letter-spacing:0;white-space:nowrap}
.aurora-heading-title small{display:block;font-size:10px;color:#bacee0;margin-top:5px}
.aurora-radio-status{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));grid-template-rows:repeat(4,14px);gap:2px 6px;margin:0;min-width:0}
.aurora-radio-status>div{display:flex;align-items:baseline;justify-content:space-between;gap:3px;min-width:0;white-space:nowrap}
.aurora-radio-status dt{font-size:10px;color:#bacee0;overflow:hidden;text-overflow:ellipsis}
.aurora-radio-status dd{font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;margin:0}
`;
const replacements = ids.map(id => {
    const before = flows.find(n => n.id === id);
    if (!before || before.type !== 'ui-template' || !before.format.includes(oldHeader)) throw new Error('Unexpected template: ' + id);
    const after = structuredClone(before);
    after.format = after.format.replace(oldHeader, header).replace('</style>', css + '</style>');
    return { before, after };
});
fs.writeFileSync(path.join(__dirname, 'status.patch.json'), JSON.stringify({
    description: 'Placeholders only; live mappings blocked pending actual AU-510M status capture.', replacements
}, null, 2) + '\n');
// Separate disabled experiment: passive existing-connection listener, no commands.
const tab = 'au510m_status_capture';
const diagnostics = [
    { id: tab, type: 'tab', label: 'DIAGNOSTICS - AU-510M actual status capture', disabled: true,
        info: 'Passive existing-connection listener only. Enable manually to inspect messages already received. No request nodes. Copy full topic/payload/client from Debug for source verification.' },
    { id: tab + '_input', type: 'flexradio-message', z: tab,
        name: 'Existing AU-510M connection - passive status', radio: '7fbf2bfc9badc7d3',
        client: 'all', topic: '#', topic_type: 'mqtt', x: 260, y: 100, wires: [[tab + '_debug']] },
    { id: tab + '_debug', type: 'debug', z: tab, name: 'ACTUAL radio topic / payload / client',
        active: true, tosidebar: true, console: false, tostatus: false, complete: 'true',
        targetType: 'full', x: 600, y: 100, wires: [] }
];
if (diagnostics.some(n => flows.some(f => f.id === n.id))) throw new Error('Capture IDs already exist');
fs.writeFileSync(path.join(__dirname, 'capture.flow.json'), JSON.stringify(diagnostics, null, 2) + '\n');
console.log('Prepared three template replacements and a separate disabled passive capture flow. Nothing deployed.');
