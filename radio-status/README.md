# AU-510M status area — prepared, not deployed

**The layout is prepared; live status mapping is incomplete.** No screenshot
values or unverified API fields are used. All 23 status entries show `--`.
They are deliberately placeholders, not an implemented live status decoder.
Deploying this patch alone will not make them live.

## Actual inspection, 2026-09-18

Read `AGENTS.md` first. Node-RED is reachable at `127.0.0.1:1880` outside the
execution sandbox. Initial sandbox-only connection failures were not a radio
failure. Read-only Admin API inspection established:

- `/flows` matches local `flows.json` exactly at inspection time.
- `/flexradio/discovery` identifies the actual radio as **AU-510M**, at
  `192.168.178.70:4992`. Discovery is from the existing FlexRadio integration;
  Windows/SmartSDR is not a source for this work.
- The existing Node-RED process has a TCP connection to that radio.
- `/context/node/7fbf2bfc9badc7d3?keysOnly=true` has no stored status keys.
- `/context/node/2702052aa13cacd0/meters` contains actual decoded meter state.
  Its exact JSON shape is the Admin API wrapper `msg` (JSON text), then
  `rows[topic].raw`, `.radioUnit`, `.seen`, `.subscription` and `.meterId`.
  The underlying input is `msg.topic` plus `msg.payload.value` and
  `msg.payload.unit`, verified in the existing meter Function/integration.
- All 35 configured meter rows are preserved. They must not all be called
  current/live: several TX diagnostic meters and `SLC/0/LEVEL` / `SLC/0/AGC+`
  had old timestamps; `SLC/0/24kHz` and `SLC/0/ESC` had no sample, and the
  external FreeDV meter was absent from inventory. No subscriptions were changed.
- The only enabled `flexradio-message` input filters `^connection/` and feeds
  the meter collector. It does not collect slice/radio status. Existing manual
  request tabs are disabled. No saved actual slice/radio-status capture exists
  in the inspected application files. Upstream fixtures and the older
  `station-dashboard/state.js` mappings are not AU-510M observations.
- A 25-second passive TCP observation restricted to incoming data on Node-RED's
  existing radio connection produced no payloads. This does **not** prove that
  the radio cannot expose the requested fields, or that its connection is down.

## Source ledger for every new displayed entry

“Unobserved” means no actual received AU-510M message establishes the topic,
field, semantics, or current value. No candidate API field names are fabricated.

| Display entry | Verified AU-510M status topic / field | Result / reason |
|---|---|---|
| Frequency | Unobserved | `--`; no slice status captured |
| Mode | Unobserved | `--`; no slice status captured |
| Active slice | Unobserved | `--`; no active-slice/client association captured |
| RX ant | Unobserved | `--`; no antenna status captured |
| TX ant | Unobserved | `--`; no antenna status captured |
| RX filter | Unobserved | `--`; no bandwidth or filter-edge status captured |
| SPLIT | Unobserved | `--`; no explicit state or verified RX/TX slice association |
| TX/RX | Unobserved | `--`; no transmit/interlock state captured; not inferred from power |
| Lock | Unobserved | `--`; no slice lock status captured |
| S-meter | No verified current-active-slice source | `--`; existing `SLC/0/LEVEL` uses `payload.value` / `payload.unit`, but its sample was stale and slice 0 cannot be assumed active; no S-unit conversion inferred |
| Mute | Unobserved | `--`; no audio/mute status captured |
| Audio | Unobserved | `--`; no audio gain/routing status captured |
| NB | Unobserved | `--`; no NB state captured |
| NR | Unobserved | `--`; no NR state captured |
| ANF | Unobserved | `--`; no ANF state captured |
| QSK | Unobserved | `--`; no QSK state captured |
| DSP | Unobserved | `--`; DSP meter samples do not establish enabled settings |
| RIT on | Unobserved | `--`; no RIT enable state captured |
| RIT offset | Unobserved | `--`; no RIT offset or unit captured |
| XIT on | Unobserved | `--`; no XIT enable state captured |
| XIT offset | Unobserved | `--`; no XIT offset or unit captured |
| DAX on | Unobserved | `--`; no DAX state captured |
| DAX ch | Unobserved | `--`; no DAX channel captured |

No newly requested status field is verified live. No screenshot attachment was
available in this task, so additional corresponding reference fields cannot be
enumerated. The display labels above come only from the written request.

## Prepared files and layout

- `status.patch.json`: before/after replacements for the three existing
  OVERVIEW / PA, TX / AUDIO and RX / SLICE template formats only. IDs, wiring,
  script logic, meter backend, configuration and EXT template remain unchanged.
- `prepare.cjs`: reproducible generator; never writes production `flows.json`.
- `deploy.mjs`: explicit manual deployment with revision conflict protection,
  exact template baseline checks and `Node-RED-Deployment-Type: nodes`.
- `capture.flow.json`: separate **disabled** passive diagnostic tab. It reuses
  radio config `7fbf2bfc9badc7d3`, listens to existing status messages with
  `client: all`, `topic: #`, and sends complete messages only to Debug.
  It contains no request nodes and sends no subscription or setting commands.
- `check.cjs`: Vue compilation, preserved meter logic/wiring and artifact checks.

The frame remains exactly 800 × 480. Status is beside the section title in a
64-pixel header, six columns by four rows. Meter cards use the remaining space.
Static Vue compilation passed; a rendered browser/layout test was not available.

## Exact manual deploy command — placeholders only

From `/mnt/dietpi_userdata/node-red`, after reviewing the incomplete status mapping:

```sh
node radio-status/deploy.mjs --deploy
```

This command has **not** been run. It deploys only changed display templates,
does not import the capture tab, and does not turn placeholders into live values.
An alternate Node-RED address can be specified using `NODE_RED_URL`.
It stops on changed templates, authentication failure or revision conflict;
it does not retry a deployment. The older `scripts/deploy-flow.mjs` adds/remaps
a flow and must not be used to apply these three existing-template replacements.

## Evidence still needed to implement live mappings

Import `capture.flow.json` into the Node-RED editor as a new disabled tab. When
ready, enable only that diagnostic tab and manually deploy Modified Nodes.
Inspect its complete Debug messages (topic, payload, client) from the existing
radio connection. If slice/radio status is not already subscribed, verified
read-only subscriptions must be added; the present artifact does not guess or
send them. Do not change frequency/mode/DSP or transmit just to provoke data.

Once actual messages are available, record their exact topics/fields here and
implement the decoder and necessary read-only subscriptions. Resolve active
slice and client identity explicitly; merge change-driven updates and invalidate
on disconnect/removal. Fresh meter values must match the selected slice; do not
reuse the old slice 0 sample. Unknown fields stay `--`.

Validation run without deployment:

```sh
node radio-status/prepare.cjs
node radio-status/check.cjs
node --check radio-status/deploy.mjs
node -e "JSON.parse(require('fs').readFileSync('flows.json'))"
node --check stream-deck-plugin/src/com.dk1aj.rfpower.sdPlugin/plugin.js
```

All checks passed. No existing files, production flows, dependencies, services,
radio subscriptions or station settings were changed. Deployment health and
live status rendering remain untested.
