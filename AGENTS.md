# Repository Guidelines

## Runtime and Layout

This is a live Node-RED user directory on DietPi/Debian x86_64. Installed Node-RED is 5.0.0 (`.config.nodes.json` reports `5.0.0-git`); the observed host runtime is Node.js 26.3.0/npm 11.16.0. `settings.js` selects `flows.json`, pretty JSON, and `process.env.PORT || 1880`. No `.env` file or documented service/start command exists.

`flows.json` currently contains 82 nodes and five tabs: disabled rfpower-watt, one disabled and one enabled manual meter-list tab, the enabled 35-meter dashboard and the enabled AGC-T Watcher. Historical TEST/EXPERIMENT labels do not make active flows disposable. Runtime/editor backups are local history, not installation sources. File presence does not prove live hardware health.

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

FlowFuse Dashboard 1.30.2 is configured at `/dashboard` with AU-510M theme and five pages (`/au510m`, `/radio-slice`, and three profile pages), with four active ui-template widgets implementing RADIO/PA/TX/RX/EXT and AGC-T navigation. Legacy Dashboard 3.6.6 and UI add-ons remain installed. Other locked dependencies include FlexRadio 1.2.5, resend, startup-trigger, string, ping, Wake-on-LAN, list, table, LEDs, level, multistate switch, and state inspector. Do not add, upgrade, remove, or replace nodes casually.

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

## Explicit Watcher Deploy Authorization

For the separate AU-510M Auto AGC-T Watcher, do not deploy automatically by default. If the user explicitly instructs “deploy selbst” or otherwise clearly authorizes deployment, validate the changed flows first and then deploy the complete current flow configuration, preserving the existing RADIO/PA/TX/RX/EXT paths.

The live dashboard AGC-T navigation label must use the exact visible form `AGC-T WATCHER · VERSION X.Y`. Increment `X.Y` for every AGC-T watcher, meter-handling, dashboard-tab, or AGC-T UI change, and keep the version synchronized with the standalone watcher UI version.

The user has authorized automatic deployment for AU-510M Auto AGC-T Watcher changes. After validation, deploy watcher changes automatically; do not wait for a separate deploy request unless the user revokes this authorization.

## Deployment Interaction

Do not add an extra project-level confirmation or manual approval step after the user has explicitly authorized an AU-510M Watcher deploy. Proceed with the authorized deployment after validation. This project instruction does not disable or override platform-level safety review controls.

## Central Watcher Version Source

Maintain the watcher release only in `agct-watcher-version.json`.
For each watcher UI, meter handling, dashboard or behavior change run
`node scripts/version-agct-watcher.mjs --bump` once, then validate.
The script copies that value into the watcher tab's `WATCHER_VERSION`
environment setting in the active flow and standalone export. The core publishes
`uiVersion`; both UIs display that status value. Do not hard-code UI versions.
Run `node scripts/test-agct-watcher.mjs` and
`node scripts/test-agct-dashboard.mjs` before deploying.

## Repository Maintenance

Use README.md and docs/ for current architecture. The separate old station prototype
is in archive/station-dashboard/. Run `bash scripts/validate-repository.sh`.
`node scripts/export-repository-flows.mjs` refreshes disabled copies without changing
runtime files. Repository-only cleanup needs no version bump and must not deploy.
Preserve AGC+ compatibility keys; AGC-only radio inventory must remain supported.

## Automatic deployment

- After every successful code or Node-RED flow change, deploy the changes automatically.
- Do not wait for the user to request deployment.
- Run all relevant validation checks before deployment.
- If validation fails, do not deploy; fix the issue first or report the blocker.
- For Node-RED flow changes, use the existing project deployment mechanism.
- Current standard deployment command:

  ```sh
  bash /mnt/dietpi_userdata/node-red/scripts/deploy-all-flows.sh
  ```

- After deployment, verify that the deployment completed successfully.
- Report the deployment result briefly.
- Do not ask the user to manually run the deploy command unless automatic deployment is technically impossible.
- Never deploy partially validated changes.

## Versioning and footer

- Every user-visible/runtime change must increment the project version.
- Before modifying runtime code, determine the currently deployed version.
- Keep both OLD_VERSION and NEW_VERSION.
- Increment the version only once per completed change set.
- Never silently reuse the same version after a runtime change.
- The dashboard footer must always display both versions in compact form:

  `Old: vX.Y | New: vX.Y`

- Never hard-code version text independently in several dashboard nodes.
- Keep version information in one central configuration/source and render the footer from that source.
- After the next successful version, NEW_VERSION becomes OLD_VERSION for the following change.
- Documentation-only changes that do not affect runtime behavior do not require a runtime version increment.
- Every final Codex report must also state Old version, New version, Deployment, Commit, and Push.
