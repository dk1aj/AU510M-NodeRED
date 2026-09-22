import { readFile, stat } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

// Accept a single-tab editor export or the Admin API single-flow object.
function validateFlow(input) {
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  let flow = input;
  if (Array.isArray(input)) {
    const tabs = input.filter(node => object(node) && node.type === 'tab');
    if (tabs.length !== 1) throw new Error('Expected exactly one tab in the editor export.');
    const tab = tabs[0];
    const nodes = input.filter(node => node !== tab);
    if (typeof tab.id !== 'string' || !tab.id ||
        nodes.some(node => !object(node) || node.z !== tab.id)) {
      throw new Error('All nodes must belong to the one tab; reuse existing configuration nodes.');
    }
    flow = { id: tab.id, label: tab.label, info: tab.info, disabled: tab.disabled, env: tab.env, nodes };
  }
  if (!object(flow) || typeof flow.label !== 'string' || !flow.label.trim() ||
      !Array.isArray(flow.nodes) || flow.nodes.length === 0) {
    throw new Error('Expected a flow with a non-empty label and nodes array.');
  }
  if (flow.configs !== undefined && (!Array.isArray(flow.configs) || flow.configs.length)) {
    throw new Error('Configuration nodes are not supported; reference existing configuration IDs.');
  }
  if (flow.disabled !== undefined && typeof flow.disabled !== 'boolean') {
    throw new Error('Flow disabled must be a boolean.');
  }
  if (flow.info !== undefined && typeof flow.info !== 'string') {
    throw new Error('Flow info must be a string.');
  }
  if (flow.env !== undefined && !Array.isArray(flow.env)) {
    throw new Error('Flow env must be an array.');
  }
  if (flow.id !== undefined && (typeof flow.id !== 'string' || !flow.id.trim())) {
    throw new Error('Flow id must be a non-empty string.');
  }
  const ids = new Set();
  for (const node of flow.nodes) {
    if (!object(node) || typeof node.id !== 'string' || !node.id.trim() ||
        typeof node.type !== 'string' || !node.type.trim() ||
        node.type === 'tab' || node.type === 'subflow' ||
        !(Array.isArray(node.wires) || (node.type === 'group' && node.wires === undefined))) {
      throw new Error('Each node must have an id, type and wires array; tabs/configuration definitions are not allowed in nodes.');
    }
    if (ids.has(node.id) || node.id === flow.id) throw new Error('Duplicate node ID: ' + node.id);
    if (Object.hasOwn(node, 'credentials')) throw new Error('Credentials must not be included.');
    ids.add(node.id);
  }
  for (const node of flow.nodes) {
    if ((node.wires || []).some(output => !Array.isArray(output) ||
        output.some(target => typeof target !== 'string' || !ids.has(target)))) {
      throw new Error('Invalid wiring or wire outside this flow: ' + node.id);
    }
  }
  // The server assigns a new flow ID and node z values.
  return { id: flow.id, label: flow.label, info: flow.info, disabled: flow.disabled, env: flow.env, nodes: flow.nodes };
}

function remapFlow(flow, existing) {
  const oldIds = [...(flow.id ? [flow.id] : []), ...flow.nodes.map(node => node.id)];
  const used = new Set([...existing.map(node => node.id), ...oldIds]);
  const mapping = new Map();
  for (const oldId of oldIds) {
    let newId;
    do { newId = randomBytes(8).toString('hex'); } while (used.has(newId));
    used.add(newId);
    mapping.set(oldId, newId);
    console.log(oldId + ' -> ' + newId);
  }
  // Replace exact ID values, including nested wires, z, g, links and group nodes.
  // IDs outside this file (such as shared radio configs) are not in the map.
  function remap(value) {
    if (typeof value === 'string') return mapping.get(value) ?? value;
    if (Array.isArray(value)) return value.map(remap);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remap(item)]));
    }
    return value;
  }
  return remap(flow);
}

async function request(path, method, data) {
  // Never follow redirects or retry a deployment.
  const response = await fetch('http://127.0.0.1:1880' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
    redirect: 'manual',
    signal: AbortSignal.timeout(15000)
  });
  console.log(('HTTP ' + response.status + ' ' + response.statusText).trim());
  const body = await response.text();
  if (!response.ok) {
    console.error(body || '(empty response body)');
    if (response.status === 401 || response.status === 403 || response.headers.has('www-authenticate')) {
      throw new Error('Authentication or authorization is required. Stopped; this helper does not accept or store credentials.');
    }
    if (response.status >= 300 && response.status < 400) {
      throw new Error('Redirect refused. Authentication may be required; no further request was sent.');
    }
    throw new Error('Node-RED rejected ' + method + ' ' + path + '.');
  }
  let result;
  try {
    result = JSON.parse(body);
  } catch {
    console.error(body || '(empty response body)');
    throw new Error('Expected JSON. If this is a login page, authentication is required. Check Node-RED before retrying.');
  }
  return { result, body };
}

async function main() {
  const filename = process.argv[2];
  if (!filename) throw new Error('Usage: node scripts/deploy-flow.mjs <flow.json>');
  if (!(await stat(filename)).isFile()) throw new Error('Not a regular file: ' + filename);
  const flow = validateFlow(JSON.parse(await readFile(filename, 'utf8')));
  const current = await request('/flows', 'GET');
  const existing = Array.isArray(current.result) ? current.result : current.result?.flows;
  if (!Array.isArray(existing) || existing.some(node => !node || typeof node.id !== 'string')) {
    console.error(current.body);
    throw new Error('Invalid /flows response; deployment stopped.');
  }
  const { result, body } = await request('/flow', 'POST', remapFlow(flow, existing));
  if (typeof result?.id !== 'string' || !result.id) {
    console.error(body || '(empty response body)');
    throw new Error('Missing returned flow ID. Check Node-RED before retrying.');
  }
  console.log('Flow ID: ' + result.id);
}

main().catch(error => {
  console.error('Error: ' + error.message);
  process.exitCode = 1;
});
