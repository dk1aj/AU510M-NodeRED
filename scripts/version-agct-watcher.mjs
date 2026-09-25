// The only maintained release pair is agct-watcher-version.json.
// Run --bump once for each watcher/UI/meter change before validation and deployment.
import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const file = new URL('agct-watcher-version.json', root);
const config = JSON.parse(fs.readFileSync(file, 'utf8'));
const version = config.NEW_VERSION ?? config.version;
if (!/^\d+\.\d+$/.test(version)) throw Error('Invalid watcher version');
if (process.argv.includes('--bump')) {
  const [major, minor] = version.split('.').map(Number);
  config.OLD_VERSION = version;
  config.NEW_VERSION = process.argv.includes('--major') ? (major + 1) + '.0' : major + '.' + (minor + 1);
  delete config.version;
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
}
if (!/^\d+\.\d+$/.test(config.OLD_VERSION) || !/^\d+\.\d+$/.test(config.NEW_VERSION)) throw Error('Invalid watcher version pair');
for (const name of ['flows.json', 'examples/05-agct-watcher.json']) {
  const target = new URL(name, root);
  const flows = JSON.parse(fs.readFileSync(target, 'utf8'));
  const core = flows.find(n => n.name === 'Watcher + separated configuration');
  if (!core) throw Error('Watcher core missing');
  const tab = flows.find(n => n.id === core.z);
  tab.env = [...(tab.env || []).filter(e => !['WATCHER_VERSION','WATCHER_OLD_VERSION'].includes(e.name)),
    {name:'WATCHER_OLD_VERSION', value:config.OLD_VERSION, type:'str'},
    {name:'WATCHER_VERSION', value:config.NEW_VERSION, type:'str'}];
  fs.writeFileSync(target, JSON.stringify(flows, null, name === 'flows.json' ? 4 : 2) + '\n');
}
console.log('Watcher version ' + config.OLD_VERSION + ' -> ' + config.NEW_VERSION);
