// The only maintained release value is agct-watcher-version.json.
// Run --bump for each watcher/UI/meter change before validation and deployment.
import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const file = new URL('agct-watcher-version.json', root);
const config = JSON.parse(fs.readFileSync(file, 'utf8'));
if (process.argv.includes('--bump')) {
  const [major, minor] = config.version.split('.').map(Number);
  config.version = major + '.' + (minor + 1);
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
}
if (!/^\d+\.\d+$/.test(config.version)) throw Error('Invalid watcher version');
for (const name of ['flows.json', 'examples/05-agct-watcher.json']) {
  const target = new URL(name, root);
  const flows = JSON.parse(fs.readFileSync(target, 'utf8'));
  const core = flows.find(n => n.name === 'Watcher + separated configuration');
  if (!core) throw Error('Watcher core missing');
  const tab = flows.find(n => n.id === core.z);
  tab.env = [...(tab.env || []).filter(e => e.name !== 'WATCHER_VERSION'),
    {name:'WATCHER_VERSION', value:config.version, type:'str'}];
  fs.writeFileSync(target, JSON.stringify(flows, null, name === 'flows.json' ? 4 : 2) + '\n');
}
console.log('Watcher version ' + config.version);
