# Repository Guidelines

## Runtime and Layout

This is a live Node-RED user directory on DietPi/Debian x86_64. Installed Node-RED is 5.0.0 (`.config.nodes.json` reports `5.0.0-git`); the observed host runtime is Node.js 26.3.0/npm 11.16.0. `settings.js` selects `flows.json`, pretty JSON, and `process.env.PORT || 1880`. No `.env` file or documented service/start command exists.

`flows.json` has 51 nodes and two enabled tabs: `rfpower-watt` (read/convert RF power) and `RFPOWER +50 Watt` (step power, icons, plugin download, and MAINFAN). Eight Function nodes contain the application logic. Dated `flows.json.bak_*` files are large historical exports, not active or test flows; `.flows.json.backup` is an editor backup. No flow is explicitly designated as a test flow, and repository files do not prove live hardware health.

`stream-deck-plugin/src/com.dk1aj.rfpower.sdPlugin/` is plugin source; `releases/` contains bundles. `streamdeck-rfpower/` is a divergent 2.0.0 copy, while source is 2.0.2. Do not synchronize it blindly. `rfpower-icons/` and absolute paths under `/mnt/dietpi_userdata/node-red/` are runtime assets/contracts.

## Interfaces and Architecture

Treat these as fixed deployment mappings:

- FRStack WebAPI: `http://192.168.178.27:5025/Radio/RFPOWER`; meter WebSocket is `ws://127.0.0.1:5025/ws/meters` in Node-RED and `ws://dietpi.fritz.box:5025/ws/meters` from Windows.
- Node-RED client base: `http://dietpi.fritz.box:1880`; routes are `/rfpower-watt`, `/rfpower-step`, `/rfpower-icon`, `/rfpower-plugin`, and `/rfpower-mainfan`.
- FlexRadio/SmartSDR uses `node-red-contrib-flexradio`: startup inject subscribes after one second to `RAD/+/MAINFAN`, using shared radio config `7fbf2bfc9badc7d3`. Its host/port are blank in the repository; connection discovery details are therefore undetermined.
- The Windows 10+/Stream Deck 6.4+ plugin (SDK 2, embedded Node 20) receives N1MM RadioInfo XML on loopback UDP `127.0.0.1:12060` and uses PowerShell/Win32 to target the Entry window. Active flows contain no UDP/TCP nodes.
- MQTT config `192.168.50.134:1883`, two FRStack WebSocket configs, and radio config `de18e07b81aedd38` have no active references. Preserve them until all references and intended future use are checked.

RF power is `percent * 5`; stepping advances by 50 W through 450 W, then wraps to 50 W. Icon selection maps to 50--450 W PNGs. Preserve action UUIDs `com.dk1aj.rfpower.*`, meter aliases, routes, node IDs, wiring, and error-output ordering.

## Dashboard, State, and Dependencies

FlowFuse Dashboard 1.30.2 is configured at `/dashboard` with AU-510M theme and five pages (`/au510m`, `/radio-slice`, and three profile pages), but the active export contains configuration/group nodes only—no dashboard widgets. Legacy Dashboard 3.6.6 and UI add-ons remain installed. Other locked dependencies include FlexRadio 1.2.5, resend, startup-trigger, string, ping, Wake-on-LAN, list, table, LEDs, level, multistate switch, and state inspector. Do not add, upgrade, remove, or replace nodes casually.

Context storage is not configured, so `global.rfpowerMainFan` is memory-only and resets on restart. `flows_cred.json`, `.flows_cred.json.backup`, and `.config.runtime.json` contain encrypted/generated credential material; never inspect, expose, overwrite, or hand-edit their values. Projects and runtime start/stop API are disabled; Function external modules are enabled. The plugin vendors `ws` 7.5.10.

## Safe Changes and Validation

Prefer small Node-RED editor changes and deploy only the affected nodes/flows. Before renaming or deleting anything, search IDs across `flows.json`, Function code, plugin files, configuration nodes, and backups. Treat Function and configuration nodes as shared. Keep experiments in a new, clearly named disabled tab; never import a historical backup wholesale over production. A release bump must align manifest version, bundle filename, and the hard-coded `/rfpower-plugin` file path. Stream Deck packaging and production service restart procedures are not documented.

Run static checks after every change:

```sh
node -e "JSON.parse(require('fs').readFileSync('flows.json'))"
node --check stream-deck-plugin/src/com.dk1aj.rfpower.sdPlugin/plugin.js
```

Then confirm deploy has no missing-node/config errors and manually test only affected paths. Use read-only `/rfpower-watt`, `/rfpower-icon`, and `/rfpower-mainfan` first; `/rfpower-step?param=1` changes radio power. Test WebSocket meters, MAINFAN subscription, N1MM focus/key delivery, and Stream Deck actions only when their target systems are available. Do not run `npm ci` merely as a test; it rewrites installed dependencies.

## AU-510M Watcher UI Versioning

The separate AU-510M Auto AGC-T Watcher UI displays its current version in the `uiVersion` chip. Increment that version on every watcher UI or flow behavior change, keep the same version in `examples/05-agct-watcher.json` and the active watcher template in `flows.json`, and do not leave historical labels such as “Alt … · Neu …” in the live UI.
