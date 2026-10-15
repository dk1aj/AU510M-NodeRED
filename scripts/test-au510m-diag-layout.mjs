import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=JSON.parse(fs.readFileSync('flows.json')).find(n=>n.id==='9b1bcb4b21cd24ff').format;
// Model the physical frame budget. Require an explicit reset so inherited main
// padding cannot silently consume the space reserved for labels and units.
const rules=[...source.matchAll(/\.diag-live-page \.diag-live-content\{([^}]+)\}/g)].map(m=>m[1]);const final=rules.at(-1);
assert(/padding:0(?:;|$)/.test(final));assert(/margin:0(?:;|$)/.test(final));assert(final.includes('minmax(96px,1fr)'));
const frame=480,framePadding=16,nav=42,heading=22,footer=16,outerGaps=18;
const main=frame-framePadding-nav-heading-footer-outerGaps;
const fixedRows=[68,36,24,96,20],gaps=5*4;
const health=main-fixedRows.reduce((a,b)=>a+b,0)-gaps;
assert(health>=96);const card=(health-6)/2;
const label=11*1.2,value=19*1.2,paddingAndBorder=8;
assert(card>=label+value+paddingAndBorder,'Lower health cards cannot contain label, number/unit and padding');
assert.equal(card,48);
console.log('PASS: 800×480 frame budget, explicit inherited-padding reset and 48 px health cards fit existing readable label/value/unit sizes. Physical rendering still requires kiosk verification.');
