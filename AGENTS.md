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

## High-risk Dashboard changes

FlowFuse Dashboard version in this project: 1.30.2.

For every new ui-template or major dashboard component:

1. Never implement the complete feature in one deployment.
2. Use staged implementation:
   - Stage A: empty/minimal page.
   - Stage B: static visual layout only.
   - Stage C: synthetic display-only data.
   - Stage D: connect one real live value.
   - Stage E: connect remaining live values.
3. After **every** stage: validate, automatically deploy, verify RADIO still works, verify PA still works, verify AGC-T still works, verify AU-510M connection and live data, verify the new page, commit, and push.
4. If any existing dashboard page stops working, stop immediately. Do not continue feature development. Restore the previous known-good commit.
5. Existing live-data pipelines are immutable unless the task explicitly requires changing them. New dashboard features must consume existing data via branches/links; they must not insert themselves into, replace, or rewrite an existing working data path.
6. Never create a second FlexRadio connection for a display feature.
7. Never create duplicate meter subscriptions when the required meter already exists in the project.
8. FlowFuse Dashboard 1.30.2 ui-template compatibility rule: when using a Vue component `<script>`, the `export default` component object must be the only JavaScript statement in that script block. Do not place `const` declarations, `let` declarations, helper functions, initialization statements, imports, or arbitrary expressions before `export default`. Put required logic inside the component object, for example in `data()`, `methods`, `computed`, `mounted`, or `beforeUnmount`.
9. Run a validation check for the ui-template compatibility rule above before every deployment.
10. A deployment returning HTTP 200 is not sufficient validation. Runtime validation requires existing pages and live AU-510M data to still operate.
11. For high-risk dashboard work, create a Git checkpoint before beginning: `git status` must be clean and current `HEAD` must equal `origin/main`.
12. Record the known-good commit hash before the first runtime modification.
13. If rollback becomes necessary, restore only the feature changes and never destroy unrelated uncommitted work.
14. Implement every high-risk feature in small reversible commits.

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

## METER / CROSS-NEEDLE PERMANENT RULES

### 1. Canonical live meter data

The existing working RADIO/PA meter paths are authoritative. RADIO already uses
FWDPWR and SWR; PA already uses FWDPWR, REFPWR and SWR. METER must reuse these
existing processed values as a new consumer branching from the working path.
Never reroute RADIO or PA through METER. Never create a second FlexRadio
connection, duplicate meter subscriptions (including TX-/1/FWDPWR,
TX-/2/REFPWR or TX-/3/SWR), or an independent duplicate dBm-to-W conversion when
the canonical processed Watt value already exists.

### 2. AU-510M canonical meters

The canonical underlying meters are TX-/1/FWDPWR, TX-/2/REFPWR and TX-/3/SWR.
Where conversion is required, W = 10 ^ ((dBm - 30) / 10). Convert every dBm
sample to Watts FIRST, then average Watts. Never average dBm first and convert
afterward.

### 3. Cross-needle geometry

METER is a real cross-needle Power/SWR instrument. The cross-needle METER uses a
fixed printed multi-range scale. Automatic 20 W / 200 W / 2 kW range selection
changes only the power-to-angle mapping, not the visible scale labels.

Use one fixed printed FORWARD scale (for example 0–20) at shared tick positions:
20 W reads directly, 200 W multiplies printed values by 10, and 2 kW by 100.
Never dynamically replace, redraw or animate scale labels, or create separate
meter faces per range. Keep the single shared pivots, arcs, ticks, calibration
and FORWARD textPath fixed across automatic ranges and themes. The explicitly authorized
v4.14 reference reconstruction replaces the former generic SVG geometry.
The actual live numeric power remains truthful without multipliers.
Show one small active-range indicator separately from the live power box.

The project has no AU-510M-provided 20/200/2000 W range state. The canonical
METER range is derived centrally from live FWDPWR in au510m_meter_forward_only.
There is exactly one selector and one state, shared by all browsers and themes.
UP: 20 -> 200 only above 20 W; 200 -> 2000 only above 200 W.
DOWN: 2000 -> 200 only below 160 W; 200 -> 20 only below 16 W.
Evaluate both steps in one update so large changes select the correct range
immediately. Start at 20 W. RX, zero, unavailable, stale or invalid data retain
the last range; evaluate again on a fresh positive sample during TX. Use the
existing normalized TX/RX and current-TX-interval validity gates. No additional
thresholds, timing rules or independent theme selectors are allowed.
The reference faces print FORWARD 0–20 and REFLECTED 0–4 with shared
range multipliers ×1/×10/×100. Derive reflected normalization from that
printed ratio: Pr / (activeRange * 4/20). Never use a permanent reflected
Watt maximum or independent range selector. Both powers must normalize
against the same active FORWARD range before SWR ray intersection.
REF remains TEST until separately authorized live REFPWR integration;
TEST presets are normalized fractions, not fixed Watt limits.

The exact theme identifiers are classic-warm, dark-room-uplight and graphite-dark. All
share the same fixed printed scale, range logic, calibration and needle geometry;
themes change visual styling only. Implement one central theme definition inside
the existing Vue component; never duplicate data paths, geometry, range logic
or subscriptions. Recreate the themes natively in SVG/CSS, with classic-warm as
the default and one compact selector. Use only these repository references:
- classic-warm: docs/reference/pwr-meter-classic-warm.png
- dark-room-uplight: docs/reference/pwr-meter-dark-room-uplight.png
- graphite-dark: docs/reference/pwr-meter-graphite-dark.png
Do not use bitmap faces, web images or other references. Canonical geometry documentation is docs/cross-needle-meter.md.
Scale ticks, needle movement and SWR curves must use the same canonical
power-to-angle geometry/calibration model. Never independently approximate SWR
curves or redraw them by eye.

### 4. SWR mathematics

Use rho = sqrt(Pr / Pf), SWR = (1 + rho) / (1 - rho), and
Pr = Pf * ((SWR - 1) / (SWR + 1))^2. The graphical needle intersection must
remain consistent with the mathematically generated SWR curves.

### 5. Visual rules

The primary target is 800×480 landscape: no scrollbar, no clipping, navigation
and footer visible, and the complete meter face visible. FORWARD and REFLECTED
must use SVG <textPath> following their curved scale arcs, never rotated normal
text. Preserve the classic analog-meter appearance unless explicitly requested
otherwise.

### 6. FlowFuse Dashboard 1.30.2

For ui-template Vue scripts, export default { ... } must be the ONLY top-level
JavaScript statement. No top-level const, let, function, import or initialization
expressions. All component logic belongs inside that object. Validate this
before every deployment involving ui-template changes.

### 7. Staged live integration

Static cross-needle geometry, mathematical SWR geometry and synthetic needle
validation are completed. Required needle integration order is FWDPWR only, then REFPWR only, followed by
comparison/validation of the cross-needle geometry. The visible numeric SWR field
always consumes canonical live radio SWR, even while the REF needle is synthetic;
this explicit display requirement takes precedence over the earlier SWR staging interpretation.
Never connect multiple new live METER values in one stage unless explicitly
requested. After every stage validate, deploy, live-check existing pages,
commit, push and verify a clean working tree. Do not proceed until the current
stage is confirmed working.

### 8. Existing page protection

Never modify RADIO, PA or AGC-T pages or their data paths incidentally. If a
METER change breaks an existing page, STOP, revert the current METER change,
restore the last known-good state and redeploy before continuing.

### 9. TX/RX state

Never infer TX from RF power. Use the existing normalized radio/interlock TX/RX
state. In RX, the live FORWARD needle must return to zero, and the live REFLECTED
needle must also return to zero once connected. Stale TX power must not remain
displayed.

### 10. Live-data integrity

Never substitute screenshot, reference-image or synthetic values for actual
AU-510M measurements. Synthetic values are allowed only in explicitly marked
TEST/SIMULATION modes. Displayed live numbers must remain truthful. Needles may
clamp at full scale; numeric values must not be altered by graphical clamping.

### 11. Version / deploy / Git

For each runtime change state the Old version, increment the central version
once, state the New version, validate, automatically deploy when technically
possible, perform live runtime checks, commit only after successful runtime
validation, push to origin/main, verify HEAD == origin/main and a clean working
tree. Documentation-only changes require no runtime deployment.

### 12. Known existing issue

The documented RADIO/AGC-T initialization issue is separate from METER work.
Do not opportunistically modify it during unrelated METER development. Any
additional initialization or template error introduced by a new change is a
regression.


## METER SWR DISPLAY RULE

If METER displays an SWR value, that value must always come from the canonical
live AU-510M SWR path already used by RADIO and PA: `TX-/3/SWR`. Reuse the same
existing processed live SWR value without adding a FlexRadio connection, SWR
subscription, independent parser or duplicate normalization path.

Never display calculated, synthetic or test SWR in the normal visible SWR field,
including SWR derived from synthetic REF or mixed live/synthetic sources.
Calculated SWR is allowed only for internal geometry validation, offline tests,
SWR curve verification and development assertions. It must never replace the
radio measurement in the visible red box, side panel or temporary readout.

If no valid live SWR is available, display `--`; never substitute a calculated
value or force 1.00. Reuse existing RADIO SWR validity behavior, including its
TX/RX gate. During intermediate development the REF needle may remain TEST,
but it must never influence visible numeric SWR. The visible METER SWR field
is a LIVE RADIO VALUE ONLY.


## AU-510M DIAG / FORENSIC PROVENANCE PERMANENT RULES

These rules govern the planned AU510M Health Logger and DIAG feature. Planning
and documentation do not authorize runtime implementation. Canonical plan:
`docs/au510m-diag-analysis.md`. Do not implement or deploy the logger until the
user explicitly authorizes implementation and the applicable prerequisites pass.
Documentation-only changes do not deploy or increment the runtime version.

### Forensic buffer and incident windows

- RAM ring buffer: 240 seconds, bounded by BOTH age and a hard maximum record count.
- Incident capture: 120 seconds PRE trigger, the trigger record, and 120 seconds POST trigger.
- Calculate and document the exact integer record-count limit from a complete
  observed event rate BEFORE logger/ring implementation. Record measurement
  coverage, average/peak rate, generated records/fanout, safety factor, formula,
  result and memory estimate. Last-sample polling and dashboard snapshot counts
  are not complete event-rate measurements. Do not invent a count from them.
- If the required observation is unavailable, mark the calculation pending;
  do not bypass this prerequisite with an arbitrary example count.
- Record overflow, dropped records and actual prehistory coverage explicitly;
  never claim a complete capture when records are missing. Retriggers in one
  episode extend POST to the latest trigger + 120 seconds; preserve original PRE.
- SQLite is the planned persistent normal history. Incident snapshots are JSONL.

### Generic command/action provenance

- Preserve every relevant observable action/request origin in an extensible
  model, not a SmartControl-specific design. Potential sources include
  SmartControl, Maestro, SmartSDR, Stream Deck, FRStack, Node-RED, N1MM+, WSJT-X,
  scripts/macros, third-party FlexRadio clients, another PC, hardware controls,
  radio internal logic, interlock/protection logic and UNKNOWN.
- A user/physical trigger and the program sending the radio command can differ.
  Preserve separately, where observable: trigger_origin, trigger_name,
  intermediary (ordered extensible hops), command_origin, command_name,
  client_handle, client_id, client_name, client_program, client_ip, source_node,
  origin_confidence, correlation_id, derived_from_seq and raw_source.
- Unknown origins remain UNKNOWN; unobservable technical identifiers remain
  null with availability/evidence. Never substitute radio IP for client IP or
  assume a client handle identifies a particular program without evidence.
- Origin confidence uses ONLY DIRECT, CORRELATED, INFERRED, UNKNOWN. Preserve
  evidence/confidence separately for trigger, command, intermediary and client
  identity; DIRECT command provenance does not prove an unknown trigger.
- Time proximity alone never proves a source or a causal link. CORRELATED needs
  explicit, defensible linkage; INFERRED needs documented derivation and
  alternatives. Record source/run/epoch/sequence evidence for every derivation.
- Example: if only FRStack is directly observable as command sender, record
  trigger_origin=UNKNOWN, command_origin=FRSTACK, origin_confidence=DIRECT.
  Do not attribute Stream Deck unless its trigger and linkage are observable.
- Keep trigger/action, COMMAND/request, ACK/response, INTERLOCK and resulting
  STATE_CHANGE as separate records, linked by evidence/correlation. Never
  fabricate a command record solely because the radio state changed.

### TX/RX and TUNE integrity

- Current canonical TX/RX is derived from Interlock. Record Interlock as DIRECT
  and TX/RX with derivation=DERIVED_FROM_INTERLOCK and derived_from_seq pointing
  to its Interlock record. This derivation label is not an origin-confidence enum.
  These are not two independent observations of radio causality.
- Confirmed canonical TUNE state is currently missing: tune=UNKNOWN (SQL NULL).
  Do not infer TUNE from TX, power, Interlock TRANSMITTING or button appearance.
  A future directly observed command/event may support an explicitly labeled,
  evidence-backed request/intent inference; it does not by itself prove the
  resulting radio TUNE state or successful transmission.
- Preserve existing canonical radio/meter paths, shared connection and parser.
  No duplicate FlexRadio connection, subscriptions or meter conversions for DIAG.

### Permanent DIAG two-lane retention design

- EVENT LANE retains every relevant actual state change immediately, plus actual
  observable requests and ACKs as separate records. Repeated identical periodic
  state baselines are not new state-change records. Preserve generic provenance.
- HEALTH LANE maintains the latest eleven canonical health values and samples
  one compact complete snapshot: RX 1 Hz, TX 5 Hz, later validated TUNE 5 Hz.
  Future configurable maximum is 10 Hz; 10 Hz is never the default.
- The future 240-second ring contains EVENT LANE records and sampled HEALTH LANE
  snapshots only. Never retain the complete raw/normalized individual meter stream.
- Calculate record limits from measured filtered event-record fanout plus the
  configured health rate, not the former 154 raw records/s. Complete operational
  coverage remains a prerequisite; unknown limits remain pending.
- Event records are compact and event-specific; do not copy all eleven health
  values into unrelated events. Estimate actual JavaScript object memory
  conservatively; full JSON strings are not the RAM-sizing basis.
- `transmit.payload.tune=0` is directly observed candidate evidence only. Canonical
  TUNE remains UNKNOWN until both states and real-operation transitions, source,
  freshness and session behavior are validated. Client presence does not prove
  command origin.
- For a controlled temporary measurement, stop instrumentation immediately if
  the canonical active slice disappears; preserve available evidence and restore
  known-good v4.21 without changing canonical parsers, connections or subscriptions.
