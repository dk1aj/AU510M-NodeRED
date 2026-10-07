# PA fault indicator v4.26

Old: v4.25. New: v4.26. This change replaces the two-line JA/NEIN display with one visible word: READY (green), FAULT (red), UNKNOWN (gray). The yellow state is removed. The existing 90×38 status control remains at SVG x=24, y=62 beneath the Watt display. No other meter geometry, canonical meter projection, subscription, RADIO/PA/AGC-T path or diagnostic draft changes.

## Actual radio evidence

The original natural incident records these DIRECT `interlock.payload.state` observations on 2026-10-07 (Europe/Berlin):

| Sequence | Time | State | Display classification |
|---|---|---|---|
| 18185 | 16:37:57.616 | TX_FAULT | FAULT |
| 18202 | 16:38:02.770 | NOT_READY | FAULT retained |
| 18206 | 16:38:02.816 | READY | READY |

The first subsequent state was NOT_READY. READY is the observed explicit clearing state. RECEIVE was not present between this TX_FAULT and READY. The indicator classification is DERIVED from the DIRECT state observations; it does not establish the cause of the fault or the origin of a command.

The compact original fixture did not capture reason values. Separately recovered existing node-red.service raw journal lines show `reason=PA_FAULT` continuing through NOT_READY and READY, and even before TX_FAULT. Journal receipt times differ from the original diagnostic times; neither replaces the other. The minimal evidence file preserves selected state fields from both sources separately, with unrelated runtime fields and journal metadata omitted: [evidence](measurements/meter-pa-fault-v4.26-evidence.json). The original natural incident manifest remains unchanged (SHA256 `6f35714df7e0ae2f4a1895664a6bf4a38dea5bcf6720fe36470a8951b23a3dde`). A reason string alone therefore does not prove a currently active fault.

## Status behavior

The existing shared FlexRadio owner/parser feeds `au510m_live_messages`; the display-only branch `au510m_meter_pa_fault_status` consumes its decoded Interlock and connection events without modifying messages or sending commands. The authoritative fault source is `interlock.payload.state` in the existing `au510m_live_state` path.

TX_FAULT marks FAULT. TIMEOUT and STUCK_INPUT retain existing project state-machine compatibility; neither is asserted to have occurred in the selected incident. Explicit READY, RECEIVE or TRANSMITTING statuses prove a non-fault state. Existing transitional PTT_REQUESTED/UNKEY_REQUESTED statuses retain the last proven classification; NOT_READY retains an earlier fault and otherwise displays UNKNOWN. Unsupported states display UNKNOWN.

A previous fault is never cleared by a timer, RX derivation, zero power, TUNE=0, absence of a reason, or absence of repeated TX_FAULT messages. Reason-only updates cannot refresh state freshness. No independent watchdog is added: the existing browser clock, 15-second Interlock freshness, 10-second payload/radio freshness and canonical connectivity gates determine UNKNOWN. Connection events and Function startup/shutdown clear the display cache. Reconnect remains UNKNOWN until a fresh supported Interlock state establishes the status.

## Validation

`scripts/test-meter-pa-fault.mjs` executes the actual Function, METER projector and Vue computed properties offline. It replays the original diagnostic records and selected actual journal state/reason transitions, including sticky PA_FAULT reason through READY. It covers startup, NOT_READY, stale data, reason-only updates, zero Watts, TUNE=0, RX, disconnect/reconnect, unsupported states, and unchanged canonical Watt/SWR values. The complete repository validation passes, including Vue compatibility, watcher/dashboard, meter geometry, range and live-data integrity checks.

Deployment and read-only live validation results are summarized in [validation](measurements/meter-pa-fault-v4.26-validation.json). No fault, transmission, TUNE or disconnect was induced for validation. Actual kiosk visual verification is unavailable in this session; placement is preserved in source but has not been visually verified on the physical 800×480 screen.

## Repository content review

All eleven files in the original change were reviewed. The original evidence, validation data and commit bundle are retained locally outside tracked content. Client handles, run/session identifiers, journal cursors, station settings, frequencies, process metrics and unrelated snapshots were removed from this change. Existing fixed deployment mappings and runtime/code changes are preserved. This repository-only sanitization does not change or redeploy v4.26.
