# Auto AGC-T Watcher

Current release: 3.7. The single release source is agct-watcher-version.json;
version-agct-watcher.mjs copies it to tab environments. Both UIs read uiVersion.

## States

| State | Meaning |
|---|---|
| IDLE | Monitoring; Auto OFF by default |
| BAND_CHANGE | Accepted trigger and setup |
| WAIT_RX | Await RX and consistent slice/band |
| MEASURE_NOISE | Initial four-second window |
| SCAN_AGCT | Start 50, settle, measure, descend by 2 and confirm reduction |
| KNEE_FOUND | Reduction confirmed in two independent windows |
| APPLY | Apply knee minus 1; require ACK and actual readback |
| DONE | One-shot complete; restore prior Auto flag, not original AGC-T |
| ERROR | Abort/failure; revoke permits; no further writes |

CHECK_NOISE, BASELINE, COARSE_SCAN, FINE_SCAN and ABORTED belong to a superseded
prototype. Their concepts are covered by MEASURE_NOISE, SCAN_AGCT and ERROR.
There is no coarse scan of 10, +2 final offset or 2 dB peak-to-peak stability rule.

## Algorithm

The operator chooses a free frequency, appropriate preamp and AGC speed (MED if
uncertain). The watcher leaves preamp and mode unchanged. It implements the
[FlexRadio manual approach](https://helpdesk.flexradio.com/hc/en-us/articles/360029494371-How-does-the-Automatic-Gain-Control-AGC-work-in-SmartSDR)
with start 50, steps 2, 2.5-second settling and four-second median windows with at
least 20 samples. A post-AGC median drop of 1.5 dB from the start reference is
confirmed in another window within 1.5 dB. Final value is knee minus 1, bounded
0–100. The fixed reference detects gradual reductions across steps.

Peak-to-peak spread is diagnostic only. LEVEL median drift above 3 dB holds the
threshold and is rechecked; two consecutive shifted windows abort. Unconfirmed
dips/output increases get at most three retries. Total duration is bounded to
eight minutes. These numerical choices are ours, not FlexRadio specifications.

The actual post-AGC source is SLC/<active-slice>/AGC with dBm and post-AGC metadata,
plus LEVEL. The internal AGC+ alias and legacy fallback remain for compatibility;
AGC-only inventory is supported and tested. Active slice is dynamic.

## Safety and commands

Only `slice s <slice> agc_threshold=<0..100>` can be written through the expiring
single-use permit gate. RX and fresh meters are required. Each successful ACK
triggers `sub slice all`. The target slice must report the requested threshold;
ACK alone or subscription ACK alone cannot advance the scan. ACK and readback
timeouts are distinct. No automatic repeat of the write is inferred.

TX/unknown RX, stale meters, disconnect, slice/frequency/mode/receive-setting
changes and failures abort. OFF revokes writes. **Abort does not restore original
AGC-T**, because that would require another write during potentially unsafe state.
The last applied value remains. No RF-power, frequency, antenna, ATU, preamp or
AGC-mode commands are generated.

Settings live in the excluded agct-watcher-settings.json. Quiet frequencies are
preserved; older scan-start settings normalize to 50. The legacy start100 topic/API
is an alias for the new start at 50. New UI uses start. Saving QRG does not tune
or certify a signal-free frequency.

## Validation

Run scripts/test-agct-watcher.mjs and scripts/test-agct-dashboard.mjs. They cover
fluctuating noise, knee confirmation, source changes, TX/OFF/disconnect, stale
telemetry, command rejection, exact readback, persistence, UI and version checks.
The root README describes the manual radio test. A full successful hardware scan
after the 3.7 fix remains unverified. Repository cleanup performs no deployment.
