const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const update = require('./state');
const parser = require('flexradio-js/flex-parser');
let state;
let now = 100000;
const feed = msg => { const r = update(state, msg, now); state = r.state; return r.snapshot; };
const connect = () => feed({ topic: 'connection/tcp', payload: 'connected' });
assert.equal(feed({}).forward.text, 'N/A');
connect();
// Actual installed parser and its upstream capture format, NOT an Aurora capture.
feed(parser.parse('S692015FA|slice 0 RF_frequency=14.100000 mode=USB active=1'));
assert.equal(feed({}).frequency.text, '14.100000 MHz');
feed(parser.parse('S692015FA|slice 1 RF_frequency=7.100000 mode=LSB active=0'));
assert.equal(feed({}).mode.text, 'USB');
feed(parser.parse('S692015FA|slice 1 active=1'));
assert.equal(feed({}).frequency.text, 'N/A');
feed(parser.parse('S692015FA|slice 0 active=0'));
assert.equal(feed({}).frequency.text, '7.100000 MHz');
feed({ topic: 'slice/1', payload: 'removed' });
assert.equal(feed({}).frequency.text, '14.100000 MHz');
feed(parser.parse('S692015FA|transmit rfpower=10'));
feed(parser.parse('S692015FA|transmit band 1 rfpower=90'));
assert.equal(feed({}).set.value, 10);
feed(parser.parse('S692015FA|interlock state=TRANSMITTING'));
assert.equal(feed({}).rxTx.text, 'TX');
feed(parser.parse('S692015FA|interlock state=READY'));
assert.equal(feed({}).rxTx.text, 'RX');
feed(parser.parse('S692015FA|interlock state=PTT_REQUESTED'));
assert.match(feed({}).rxTx.text, /^N\/A/);
// Arbitrary test IDs prove no dependence on legacy capture IDs.
const inventory = { 701: { src: 'TX-', num: 1, nam: 'FWDPWR', unit: 'dBm' },
    812: { src: 'TX-', num: 2, nam: 'REFPWR', unit: 'Watts' },
    913: { src: 'TX-', num: 3, nam: 'SWR', unit: 'SWR' },
    999: { src: 'RAD', num: 1, nam: 'Temperature discovered at runtime', unit: 'degF' } };
feed({ request: 'meter list', status_code: 0, payload: inventory });
feed({ meter: 701, payload: { value: 50 } });
feed({ meter: 812, payload: { value: 2 } });
feed({ meter: 913, payload: { value: 1.2 } });
feed({ meter: 999, payload: { value: 104 } });
assert.equal(feed({}).forward.value, 100);
assert.equal(feed({}).reflected.value, 2);
assert.equal(feed({}).temperatures[0].value, 40);
feed({ meter: 701, payload: { value: '' } });
assert.equal(feed({}).forward.text, 'N/A');
feed({ meter: 701, payload: { value: 50 } });
now += 16000;
feed({ status: { fill: 'green', shape: 'dot' } });
assert.equal(feed({}).forward.text, 'N/A');
assert.equal(feed({}).frequency.text, '14.100000 MHz');
feed({ request: 'meter list', status_code: 0, payload: { ...inventory, 702: inventory[701] } });
assert.match(feed({}).forward.reason, /Multiple/);
feed({ topic: 'connection/tcp', payload: 'disconnected' });
assert.equal(feed({}).frequency.text, 'N/A');
assert.equal(feed({}).set.text, 'N/A');
connect();
assert.equal(feed({}).frequency.text, 'N/A');
now += 13000;
assert.match(feed({}).connection, /expired/);

const flow = JSON.parse(fs.readFileSync(path.join(__dirname, 'dk1aj-station.flow.json')));
const production = JSON.parse(fs.readFileSync(path.join(__dirname, '../flows.json')));
const ids = new Set(production.map(n => n.id));
for (const n of flow) { assert(!ids.has(n.id), 'ID collision: ' + n.id); ids.add(n.id); }
for (const n of flow) {
    for (const field of ['z', 'radio', 'ui', 'page', 'theme', 'group']) if (n[field]) assert(ids.has(n[field]), 'Unresolved ' + field);
    for (const dest of (n.wires || []).flat().concat(n.links || [], n.scope || [])) assert(ids.has(dest), 'Unresolved wire/link/status');
    if (n.type === 'function') new Function('msg', 'context', n.func);
}
assert(flow.filter(n => n.type === 'tab').every(n => n.disabled));
assert.equal(flow.filter(n => n.type === 'ui-page').length, 1);
const command = flow.find(n => n.id.endsWith('_commands'));
assert.deepEqual(new Function('msg', command.func)({ payload: 'transmit set rfpower=100', action: 'disconnect' })[0], [
    { payload: 'sub slice all' }, { payload: 'sub tx all' }, { payload: 'meter list' }
]);
const inventoryNode = flow.find(n => n.id.endsWith('_inventory'));
const route = new Function('msg', inventoryNode.func);
assert.deepEqual(route({ request: 'meter list', status_code: 0, payload: inventory })[1].map(m => m.payload), ['sub meter 701', 'sub meter 812', 'sub meter 913', 'sub meter 999']);
assert.equal(route({ request: 'meter list', status_code: 1, payload: inventory }), null);
assert.equal(route({ request: 'sub meter 701', status_code: 0, payload: {} }), null);
assert.equal(route({ request: 'meter list', status_code: 0, payload: { '1\ntransmit': inventory[701] } })[1].length, 0);
assert.equal(flow.find(n => n.type === 'ui-template').wires.length, 0);
for (const pkg of ['@flowfuse/node-red-dashboard', 'node-red-contrib-flexradio']) {
    const pkgPath = require.resolve(pkg + '/package.json');
    const meta = require(pkgPath);
    const registered = meta['node-red'].nodes;
    for (const n of flow.filter(n => n.type.startsWith(pkg.startsWith('@') ? 'ui-' : 'flexradio-'))) {
        assert(registered[n.type], 'Node not installed: ' + n.type);
        assert(fs.existsSync(path.join(path.dirname(pkgPath), registered[n.type])));
    }
    console.log(pkg, meta.version, 'required node types installed');
}
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
const vue = fs.readFileSync(path.join(__dirname, 'dashboard.vue'), 'utf8');
const parsed = parse(vue);
assert.deepEqual(parsed.errors, []);
compileScript(parsed.descriptor, { id: 'dk1aj' });
const compiled = compileTemplate({ source: parsed.descriptor.template.content, filename: 'dashboard.vue', id: 'dk1aj' });
assert.deepEqual(compiled.errors, []);
console.log('PASS: parser, slices, status, metadata, units, expiry, disconnect, requests, references, disabled tabs, and Vue compilation.');
