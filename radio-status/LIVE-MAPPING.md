# Prepared RADIO live bindings (not deployed)

User-specified mappings implemented against decoded `flexradio-message` and
`flexradio-meter` output. No claim of live validation is made before deployment.
There are no saved measurements or screenshot values in the implementation.

`slice/<id>` payloads are merged per numeric ID. The unique slice with `active=1`
is RX; the unique slice with `tx=1` is TX. Missing or ambiguous selections remain
unknown. `index_letter` is displayed literally, never calculated from the ID.

| Display | Topic and payload field / derivation |
|---|---|
| Frequency | active `slice/<id>`: `RF_frequency`, MHz |
| Mode | active `slice/<id>`: `mode` |
| Active slice | active `slice/<id>`: `index_letter` |
| RX antenna | active `slice/<id>`: `rxant` |
| TX antenna | TX `slice/<id>`: `txant` |
| RX filter | active `slice/<id>`: `filter_hi - filter_lo`, Hz; kHz at >=1000 Hz |
| SPLIT | ON if unique active and TX slice IDs differ; OFF if equal; otherwise unknown |
| TX/RX | `interlock`: `state`; TRANSMITTING→TX, READY/RECEIVE→RX; otherwise unknown |
| Lock | active `slice/<id>`: `lock` |
| S-meter | `SLC/<active id>/LEVEL`: `value` and `unit`; retain actual dBm, no S-unit estimate |
| Mute | active `slice/<id>`: `audio_mute` |
| Audio | active `slice/<id>`: `audio_level`, raw level |
| NB / NR / ANF / QSK | active `slice/<id>`: `nb` / `nr` / `anf` / `qsk` |
| RIT on / offset | active `slice/<id>`: `rit_on` / `rit_freq` (Hz) |
| XIT on / offset | active `slice/<id>`: `xit_on` / `xit_freq` (Hz) |
| DAX channel | active `slice/<id>`: `dax` |
| DAX on | active `slice/<id>`: `dax > 0` → ON; `dax = 0` → OFF |
| DSP | `--`: no verified generic DSP field; not inferred from NB/NR/ANF |

Binary fields accept received 0/1 values, displaying OFF/ON. Unknown, invalid,
missing and stale data use `--`. Numeric zero is a real value, not missing.
Slice removal deletes cached status and its meter sample. Disconnect/reconnect
clears all cached status. Connection health comes from the existing integration's
five-second node status heartbeat; status expires after 12 seconds without it.
Change-driven slice fields remain valid while connected. LEVEL expires after
15 seconds. The browser hides radio values if snapshots stop for 10 seconds.

Only `sub slice all` and `sub tx all` are generated. They are sent once connected,
reissued on reconnect, and retried at 15-second intervals until acknowledged.
A passive meter listener reuses existing traffic, including SLC/0/LEVEL. It sends
no meter subscriptions. When another slice is active, only matching received
LEVEL samples are used; absent matching traffic means `--`, never slice 0 fallback.

The existing meter Function code, 35 meter definitions, meter subscription logic,
conversions, radio configuration, PA/TX/RX/EXT templates and RADIO CSS are unchanged.
Only the existing PA/RADIO widget's text bindings are changed; its meter snapshot
wire passes through a bridge that adds radioStatus while preserving all existing
meter snapshot properties. New status nodes use the same radio configuration.

Files: `live-state.cjs`, `enable-live.mjs`, `live-test.cjs`, this mapping document.
Production `flows.json` remains untouched until explicit deployment.

Manual deployment from any directory:

```sh
node /mnt/dietpi_userdata/node-red/radio-status/enable-live.mjs --deploy
```

The deployment uses the current revision and Modified Nodes mode. It refuses
missing/unexpected UI, duplicate status nodes, or concurrent deployment conflicts.
No automatic retry of deployment. Optional `NODE_RED_URL` selects the Admin API.

Validation completed: offline partial-update, slice-switch/ambiguity/removal,
active-slice meter matching, unknown/zero values, DSP fallback, interlock-only TX,
stale data, disconnect/reconnect and fixed subscription-command tests; Vue
compilation; unchanged CSS and unchanged meter backend assertions; required
flows.json parsing and Stream Deck syntax checks. Test data are synthetic and
are never seeded into the deployed state.

Manual checks still required after deployment: confirm both subscription responses
have `status_code: 0` (temporarily enable the new response Debug node), and compare
received topic/payload values to RADIO while the operator makes the requested
SmartSDR frequency, mode, antenna, filter, RIT, XIT, DAX, NB, NR and ANF changes.
The agent has not performed those state changes or deployed this patch.
