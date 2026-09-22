const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parse, compileTemplate, compileScript } = require('@vue/compiler-sfc');
const read = file => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
const patch = read('status.patch.json');
const original = read('../flows.json');
const updated = structuredClone(original);
assert.equal(patch.replacements.length, 3);
for (const { before, after } of patch.replacements) {
    assert.deepEqual(before, original.find(n => n.id === before.id));
    assert.deepEqual({ ...after, format: before.format }, before);
    assert.match(after.format, /width:800px;height:480px/);
    assert.equal((after.format.match(/<dd>--<\/dd>/g) || []).length, 23);
    const { descriptor, errors } = parse(after.format);
    assert.deepEqual(errors, []);
    const compiled = compileTemplate({ source: descriptor.template.content, filename: after.id + '.vue', id: after.id });
    assert.deepEqual(compiled.errors, []);
    compileScript(descriptor, { id: after.id });
    const old = parse(before.format).descriptor;
    assert.equal(descriptor.script.content, old.script.content, 'Existing meter display logic unchanged');
    updated.find(n => n.id === after.id).format = after.format;
}
assert.deepEqual(updated.filter(n => !patch.replacements.some(p => p.before.id === n.id)),
    original.filter(n => !patch.replacements.some(p => p.before.id === n.id)),
    'All meter functions, wiring, subscriptions, config and EXT remain identical');
const capture = read('capture.flow.json');
assert.equal(capture[0].disabled, true);
assert.deepEqual(capture.map(n => n.type), ['tab', 'flexradio-message', 'debug']);
assert.equal(capture[1].radio, '7fbf2bfc9badc7d3');
assert.deepEqual(capture[1].wires, [[capture[2].id]]);
console.log('PASS: three Vue templates compile; 23 unavailable fields each; 800x480; meter backend and all other nodes unchanged; capture is passive and disabled.');
