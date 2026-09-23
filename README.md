# AU-510M Node-RED Station Dashboard

Node-RED dashboard and automation for FlexRadio Aurora AU-510M.

This repository shares a directory with a live Node-RED installation. Root
`flows.json` remains the deployed station configuration. Do not replace it with
an example or archive. Repository cleanup does not deploy or restart anything.

## Overview and requirements

The 800x480 dashboard provides RADIO / PA / TX / RX / EXT and AGC-T navigation.
It uses a direct radio connection through `node-red-contrib-flexradio`, a
35-identity meter display backend, dynamic meter discovery, radio status handling
and a separate Auto AGC-T Watcher, currently version 3.7.

- Host: DietPi/Debian x86_64; observed Node.js 26.3.0/npm 11.16.0.
- Node-RED 5.0.0 (installed metadata also reports 5.0.0-git).
- node-red-contrib-flexradio 1.2.5 and FlowFuse Dashboard 1.30.2.
- Remaining dependencies: package.json and package-lock.json; do not casually upgrade.
- Node-RED: http://dietpi.fritz.box:1880.
- Dashboard: http://dietpi.fritz.box:1880/dashboard/au510m.
- Standalone watcher: http://dietpi.fritz.box:1880/agct-watcher.
- Shared radio config: `7fbf2bfc9badc7d3`, automatic discovery, blank host/port.
  Confirm that discovery selects the intended radio.
- Runtime paths use `/mnt/dietpi_userdata/node-red/`; preserve them on this host.

The verified current watcher inputs are `SLC/<active-slice>/LEVEL` and
`SLC/<active-slice>/AGC`, both dBm. Numeric meter IDs are discovered, not fixed.
The internal AGC+ compatibility key and optional legacy fallback remain; an actual
AGC+ input is not required. Not every configured dashboard identity is published
by every radio/firmware/mode. Missing/stale data is displayed explicitly.

## AGC-T behavior

The watcher follows the manual [FlexRadio procedure](https://helpdesk.flexradio.com/hc/en-us/articles/360029494371-How-does-the-Automatic-Gain-Control-AGC-work-in-SmartSDR):
choose a free frequency, start around 50, decrease slowly, allow settling, detect
noise reduction and finish slightly below the knee.

Current implementation: start 50, steps 2, settling 2.5 s, four-second median
windows, 1.5 dB noise reduction confirmed twice, final offset -1. LEVEL median
drift over 3 dB is remeasured and aborts only when repeated. These numerical
limits are implementation choices, not FlexRadio's specified automation.

The requested coarse scan 10 / fine scan 2 / knee threshold 2 dB / final offset
+2 / LEVEL peak-to-peak stability 2 dB describes a superseded prototype. Those
settings are not deployed and are not reintroduced by repository cleanup.

TX, stale telemetry, changed slice/frequency/mode/receive settings and command
failures stop writes. **Abort does not restore original AGC-T**; the last applied
value remains, avoiding another write during TX or stale state. Each command
requires ACK and actual threshold readback; after ACK, `sub slice all` is requested.

## Installation

1. On a new host, clone into a separate directory, not over the running installation.
2. Install Node-RED and locked dependencies there. `npm ci` is an installation
   operation, not a validation command for this live host.
3. Configure discovery, Dashboard and station paths. Keep credentials and local
   settings out of Git. settings.js contains commented upstream auth examples,
   not active credentials; configure access controls before exposing a new host.
4. Import `flows/dashboard.json` and `flows/agct-watcher.json`. Both exported tabs
   are disabled. The watcher reuses the radio config supplied by the dashboard.
5. Resolve configuration references in the editor before enabling. Do not create
   duplicate copies of existing station tabs, IDs or HTTP routes.

No GPIO or ATU interface is introduced. Existing FRStack/Stream Deck files are
preserved compatibility material, not the source of the direct-radio dashboard.
Host service start/restart procedures are not documented; do not guess them.

## Validation and deployment

From the repository root:

```sh
bash scripts/validate-repository.sh
```

These checks are offline and do not deploy. Refresh disabled repository exports:

```sh
node scripts/export-repository-flows.mjs
```

For a separately authorized future station deployment:

```sh
bash scripts/deploy-all-flows.sh
```

This submits the complete root flows.json with a revision check and deployment
type `flows`. Existing deployment behavior is unchanged. The specialized
`deploy-agct-watcher.mjs --check|--deploy` updates the standalone watcher; other
patch helpers are historical migrations, not a sequence to replay on the station.

For each watcher/UI/meter behavior change, run
`node scripts/version-agct-watcher.mjs --bump` once, regenerate exports and validate.
Both UIs obtain the version from the status payload. Repository-only cleanup
keeps version 3.7. Never deploy as part of this cleanup.

## Manual AGC-T test

1. Choose RF preamp and AGC speed in SmartSDR; FlexRadio suggests MED when unsure.
2. Tune to a free frequency between stations and remain in RX.
3. Click **QRG übernehmen**, verify the saved MHz and fresh LEVEL/AGC values.
4. Click **Messung ab 50 starten**; observe setting 50, settling, downward steps,
   knee confirmation, final setting and DONE.
5. Compare audible noise reduction with the manual FlexRadio procedure.
6. Auto AUS stops the run. Do not initiate TX solely for a test; offline tests
   cover TX/OFF/disconnect/stale-data behavior.

Earlier work verified live status and deployments, but a successful full hardware
calibration after the 3.7 readback correction has not been established. Synthetic
tests do not prove the audible optimum.

## Troubleshooting

- QRG mismatch: adopt the intended quiet frequency or tune to the saved frequency.
- Missing meter: inspect current inventory and active slice; never hard-code Slice 0.
- ACK timeout: missing write response. Readback timeout: actual threshold failed
  to match in time despite ACK. Inspect command and slice-status logs.
- Sustained input-noise change: repeated median shift; no further writes occur.
- Missing dashboard values: inspect discovery, subscriptions, units and freshness.
- Version: reload and read the AGC-T footer; source is agct-watcher-version.json.

## Repository structure

| Path | Role |
|---|---|
| flows.json / settings.js | Existing runtime locations, deliberately preserved |
| flows/ | Disabled reproducible export copies |
| examples/ | Starter exports and canonical standalone watcher |
| scripts/ | Deploy, validation, export, tests and historical patch helpers |
| radio-status/ | Status/averaging code, tests and retained migration artifacts |
| docs/ | Architecture, watcher, meters and cleanup decisions |
| archive/ | Preserved station prototype and old handoff |
| stream-deck-plugin/ / rfpower-icons/ | Existing plugin source, bundles and runtime assets |
| streamdeck-rfpower/ | Divergent older plugin retained; do not synchronize blindly |

Dependencies, runtime credentials, local watcher settings, caches and backups are
excluded. No project-wide license was found; none is invented. See
[architecture](docs/architecture.md), [watcher](docs/agct-watcher.md),
[meters](docs/meters.md) and [cleanup inventory](docs/cleanup-inventory.md).
