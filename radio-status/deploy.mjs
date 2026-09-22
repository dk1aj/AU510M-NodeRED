// Explicit manual deployment of the three prepared display templates only.
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';

async function main() {
    if (process.argv[2] !== '--deploy') throw new Error('Manual use: node radio-status/deploy.mjs --deploy');
    const patch = JSON.parse(await readFile(new URL('./status.patch.json', import.meta.url), 'utf8'));
    const expected = ['9ee3e94e3758b01f', '961ffe09d3da81ac', '80108e5a65682ca7'];
    if (!Array.isArray(patch.replacements) || patch.replacements.length !== expected.length) throw new Error('Invalid patch');
    for (const [i, { before, after }] of patch.replacements.entries()) {
        if (before.id !== expected[i] || before.type !== 'ui-template' ||
            typeof after.format !== 'string' || !isDeepStrictEqual({ ...after, format: before.format }, before)) {
            throw new Error('Patch must change only the three expected template formats');
        }
    }
    const base = process.env.NODE_RED_URL || 'http://127.0.0.1:1880';
    const headers = { 'Node-RED-API-Version': 'v2', 'Content-Type': 'application/json' };
    const current = await fetch(new URL('/flows', base), {
        headers, redirect: 'error', signal: AbortSignal.timeout(10000)
    });
    if (!current.ok) throw new Error('GET /flows: HTTP ' + current.status);
    const snapshot = await current.json();
    if (!Array.isArray(snapshot.flows) || typeof snapshot.rev !== 'string') throw new Error('Expected versioned flows response');
    for (const { before, after } of patch.replacements) {
        const matches = snapshot.flows.filter(n => n.id === before.id);
        if (matches.length !== 1 || !isDeepStrictEqual(matches[0], before)) {
            throw new Error('Template differs from reviewed baseline: ' + before.id + '; nothing deployed');
        }
        matches[0].format = after.format;
    }
    const response = await fetch(new URL('/flows', base), {
        method: 'POST', headers: { ...headers, 'Node-RED-Deployment-Type': 'nodes' },
        body: JSON.stringify({ rev: snapshot.rev, flows: snapshot.flows }),
        redirect: 'error', signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error('POST /flows: HTTP ' + response.status + '; no automatic retry');
    console.log('Deployed only the three changed templates. New status values remain -- pending verified mappings.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
