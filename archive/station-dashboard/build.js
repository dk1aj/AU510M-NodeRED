// Build a separate import artifact. Never writes production flows.json.
const fs = require('node:fs');
const path = require('node:path');
const update = require('./state');
const prefix = 'dk1aj_station_';
const id = s => prefix + s;
const nodes = [];
const radio = '7fbf2bfc9badc7d3';
function node(key, type, tab, props) {
    const n = { id: id(key), type, ...(tab ? { z: id(tab), x: 300, y: 100, wires: [] } : {}), ...props };
    nodes.push(n); return n;
}
function fn(key, tab, name, func, wires, x, y) {
    return node(key, 'function', tab, { name, func, outputs: wires.length, timeout: 0, noerr: 0, initialize: '', finalize: '', libs: [], wires: wires.map(w => w.map(id)), x, y });
}
function inject(key, tab, name, target, repeat = '') {
    node(key, 'inject', tab, { name, props: [{ p: 'payload' }, { p: 'topic', vt: 'str' }], payloadType: 'date', topic: 'station/tick', repeat, crontab: '', once: !!repeat, onceDelay: 0.5, wires: [[id(target)]], x: 160, y: repeat ? 340 : 100 });
}
node('dashboard', 'tab', null, { label: 'DK1AJ STATION — read only', disabled: true, info: 'Prepared, not deployed. See station-dashboard/README.md. Enable with diagnostics after review. Reuses existing radio and Dashboard base/theme.' });
node('diagnostics', 'tab', null, { label: 'DIAGNOSTICS — DK1AJ STATION', disabled: true, info: 'Manual read-only subscriptions and meter list. No radio-setting commands. Re-run Read telemetry after each radio reconnect.' });
node('page', 'ui-page', null, { name: 'DK1AJ STATION', ui: 'ff_au510m_base', path: '/dk1aj-station', icon: 'radio-tower', layout: 'grid', theme: 'ff_au510m_theme', order: 0, className: '', visible: true, disabled: false, breakpoints: [{ name: 'Default', px: 0, cols: 3 }, { name: 'Tablet', px: 576, cols: 6 }, { name: 'Desktop', px: 1024, cols: 12 }] });
node('group', 'ui-group', null, { name: 'Station', page: id('page'), width: 12, height: 1, order: 1, showTitle: false, className: '', visible: true, disabled: false, groupType: 'default' });
node('view', 'ui-template', 'dashboard', { name: 'Station values and read-only gauges', group: id('group'), page: '', ui: '', order: 1, width: 12, height: 0, head: '', format: fs.readFileSync(path.join(__dirname, 'dashboard.vue'), 'utf8'), storeOutMessages: true, passthru: false, resendOnRefresh: true, templateScope: 'local', className: '', x: 790, y: 220 });
node('messages', 'flexradio-message', 'dashboard', { name: 'Existing radio — status only', radio, client: 'all', topic: '#', topic_type: 'mqtt', wires: [[id('state'), id('raw_out')]], x: 170, y: 100 });
node('meters', 'flexradio-meter', 'dashboard', { name: 'Decoded meters with metadata', radio, topic: '#', topic_type: 'mqtt', output_mode: 'object', wires: [[id('state')]], x: 180, y: 180 });
node('connection', 'status', 'dashboard', { name: 'Existing integration connection', scope: [id('messages')], wires: [[id('state')]], x: 180, y: 260 });
inject('clock', 'dashboard', 'Refresh / expire readings (1 s)', 'state', '1');
fn('state', 'dashboard', 'Collect telemetry; never send commands', `${update.toString()}\nconst result = update(context.get('station'), msg, Date.now());\ncontext.set('station', result.state);\nreturn msg.topic === 'station/tick' ? { payload: result.snapshot } : null;`, [['view']], 510, 220);
node('metadata_in', 'link in', 'dashboard', { name: 'Meter inventory', links: [id('metadata_out')], wires: [[id('state')]], x: 355, y: 400 });
node('raw_out', 'link out', 'dashboard', { name: 'Status to diagnostics', mode: 'link', links: [id('raw_in')], x: 425, y: 60 });
node('raw_in', 'link in', 'diagnostics', { name: 'Raw status from dashboard', links: [id('raw_out')], wires: [[id('status_debug')]], x: 155, y: 400 });
node('status_debug', 'debug', 'diagnostics', { name: 'Actual radio status (enable to capture)', active: false, tosidebar: true, console: false, tostatus: false, complete: 'true', targetType: 'full', x: 420, y: 400 });
inject('read', 'diagnostics', 'Read telemetry (manual / after reconnect)', 'commands');
fn('commands', 'diagnostics', 'Fixed read-only requests', 'return [[{payload:"sub slice all"},{payload:"sub tx all"},{payload:"meter list"}]];', [['request']], 450, 100);
node('request', 'flexradio-request', 'diagnostics', { name: 'Existing radio — read-only requests', radio, wires: [[id('inventory'), id('responses')]], x: 780, y: 100 });
fn('inventory', 'diagnostics', 'Inspect list; subscribe discovered IDs', `if (msg.request !== 'meter list' || Number(msg.status_code) !== 0 || !msg.payload || typeof msg.payload !== 'object') return null;
const commands = Object.entries(msg.payload).filter(([id, m]) => /^\\d+$/.test(id) && m && (
    (['FWDPWR','REFPWR'].includes(String(m.nam).toUpperCase()) && ['dbm','watts'].includes(String(m.unit).toLowerCase())) ||
    (String(m.nam).toUpperCase() === 'SWR' && String(m.unit).toLowerCase() === 'swr') ||
    ['degc','degf'].includes(String(m.unit).toLowerCase())
)).map(([id]) => ({payload: 'sub meter ' + id}));
return [msg, commands];`, [['metadata_out'], ['request']], 470, 230);
node('metadata_out', 'link out', 'diagnostics', { name: 'Inventory to dashboard', mode: 'link', links: [id('metadata_in')], x: 755, y: 230 });
node('responses', 'debug', 'diagnostics', { name: 'Meter list / subscription responses', active: true, tosidebar: true, console: false, tostatus: false, complete: 'true', targetType: 'full', x: 1060, y: 160 });
node('errors', 'catch', 'diagnostics', { name: 'Read request errors', scope: [id('request')], uncaught: false, wires: [[id('responses')]], x: 800, y: 330 });
fs.writeFileSync(path.join(__dirname, 'dk1aj-station.flow.json'), JSON.stringify(nodes, null, 2) + '\n');
console.log(`Built ${nodes.length} nodes; both tabs disabled; production unchanged.`);
