# AU-510M Auto AGC-T Watcher

Separate UI: `http://dietpi.fritz.box:1880/agct-watcher`.
The export is disabled and Auto defaults OFF. Existing dashboard flows and radio configuration are not edited.

## Update

```sh
node /mnt/dietpi_userdata/node-red/scripts/deploy-agct-watcher.mjs --check
node /mnt/dietpi_userdata/node-red/scripts/deploy-agct-watcher.mjs --deploy
```

The deploy helper detects the previous measurement-only watcher too, backs up that tab, disables it when active, updates it under the same flow ID and enables the replacement. It uses revision checks and the `flows` deployment type to preserve other flows. It does not start calibration. An unsuccessful replacement after disabling leaves the old watcher disabled rather than running two instances.

## Two-action UI

1. Tune the radio to a clear receive frequency. The sidebar proposes the active slice's frequency. **QRG übernehmen** saves the field value as this band's measurement frequency; it does not retune the radio. An explicitly entered different frequency must subsequently be set on the radio.
2. **Messung starten** performs a single complete run: validate RX and both live meters, measure the baseline without writes, set AGC-T to 50, confirm/read back, settle, descend, locate the knee and apply the final value once. If the actual current threshold is already 50, the unchanged baseline supplies the start reference.

The final confirmed result appears automatically. No separate RX-check, Auto-ON or results button is needed. **Stopp / Auto AUS** aborts. Start remains disabled until the actual radio frequency matches the saved measurement frequency and fresh RX-meter data is present.

The one-shot action temporarily enables the watcher for this run and restores the previous Auto setting after success or abort. It does not silently enable future automatic calibrations. Persistent band-change Auto is a separate option under advanced settings. When the QRG is adopted through this UI, its configured scan start is also saved as 50. Older persisted scan-start values are normalized to 50 when loaded; existing quiet frequencies are preserved. The legacy start100 action/topic remains accepted as an alias for the recommended start at 50.

All per-band quiet frequencies initially remain undefined. The active band's entry can be removed under advanced settings. Settings are saved using a temporary file and atomic rename to `/mnt/dietpi_userdata/node-red/agct-watcher-settings.json`, survive restarts and watcher updates, and contain no credentials. Auto ON is not persisted. Settings cannot be changed during calibration.

No invented frequencies or automatic frequency search. A received station with constant level cannot be distinguished conclusively from noise using just these two meters; selecting a genuinely clear frequency remains necessary. The old editor calibration action retains the measurement-only fallback when no quiet frequency is configured. The new guided Start requires a configured, matching measurement frequency before accepting the request.

## Command verification

The installed status parser's capture output contains `slice/<index>` fields `agc_threshold` and `agc_mode`:
`node_modules/flexradio-js/test/capture/command-samples.out`, lines 738–739.
Read-only inspection of this AU-510M's existing watcher also showed these fields and actual LEVEL / AGC+ samples, both reporting dBm.

The [official FlexRadio TCP/IP slice API](https://github.com/flexradio/smartsdr-api-docs/wiki/TCPIP-slice#SET) specifies SET as `slice s <slice_rx> <parameter=value>` and explicitly lists writable `agc_threshold` in the range 0–100. The installed Node-RED request node forwards the payload through `flexradio-radio.send` to `flexradio-js/Radio._sendRequest`, which uses `flex.encode_request` for the sequence-number framing. An offline socket-stub test verified this installed encoder produces the documented wire request. No dependency was changed.

The only radio write accepted by the watcher is:

```text
slice s <actual_active_slice> agc_threshold=<integer_0_to_100>
```

This verifies the documented API command and installed transport, not successful execution on AU-510M firmware. Every real step requires both a successful command response and a subsequent matching live slice status. A rejection or missing confirmation aborts without guessing another syntax. No live write or calibration has been performed by the coding agent.

## State machine and safeguards

`IDLE → BAND_CHANGE → WAIT_RX → MEASURE_NOISE → SCAN_AGCT → KNEE_FOUND → APPLY → DONE`; safety failures go to `ERROR`.

Only a stable radio-supplied band change or an explicit calibration request starts a run. First slice/band observations establish a baseline. Multiple active slices block selection unless `clientHandle` is explicitly configured in the Function. No slice index is assumed.

The baseline uses four seconds and at least 20 actual samples per meter. Each downward step reduces AGC-T by two, waits for response plus readback, allows 2.5 seconds to settle, and collects a new four-second window. Thresholds and timing remain clearly separated in the core Function configuration object.

The implementation follows the [FlexRadio AGC-T adjustment procedure](https://helpdesk.flexradio.com/hc/en-us/articles/360029494371-How-does-the-Automatic-Gain-Control-AGC-work-in-SmartSDR): choose a free frequency, start around 50, decrease slowly with settling time, find the onset of noise reduction and finish slightly below it. RF preamp and AGC speed must already suit the operating conditions (FlexRadio suggests MED when uncertain); this watcher leaves those operator settings unchanged.

Four-second medians reject isolated sample spikes without a peak-to-peak spread limit. A post-AGC median reduction of at least 1.5 dB relative to the settled start reference must recur in a second independent window, within 1.5 dB of the candidate. The fixed reference allows gradual reductions across multiple steps to accumulate. An unconfirmed dip is remeasured at the same threshold, with at most three retries. A LEVEL median shift greater than 3 dB holds the threshold and is checked again; two consecutive shifted windows abort. An output increase is also retried before aborting. Range/spread remains diagnostic only.

The final value is knee minus 1 (bounded to 0–100), written once and verified by ACK and live threshold readback. The 2-point steps, 2.5-second settling, four-second windows, 1.5/3 dB limits and minus-one offset are our numerical automation choices, not FlexRadio specifications. Synthetic tests validate state transitions and fluctuating-noise handling; they do not prove that the radio's meter-derived knee always equals the audible optimum. Total runtime is bounded to eight minutes.

The actual post-AGC source is bound from inventory: AGC requires dBm metadata describing the signal after AGC; legacy AGC+ remains supported. The internal AGC+ status key is retained for compatibility, while agcMeterName identifies the actual source.

TX/unknown RX, changed slice/frequency/AGC/receive settings, disconnection, stale meters, stale RX status, rejected commands, missing acknowledgements and maximum-duration limits stop the scan. A separate gate checks an expiring single-use command permit immediately before sending. No delayed writes, retunes, transmit, RF-power, mode or antenna commands are allowed. Software cannot recall a command already accepted by the radio just before a TX status arrives.

Auto OFF revokes the permit immediately. On abort the last applied AGC-T remains; there is no restore write during TX. After DONE, received-signal changes do not cause another scan. Missing quiet-frequency configuration and measurement failures remain visible as ERROR, not falsely labelled successful calibration.

## Validation

```sh
node /mnt/dietpi_userdata/node-red/scripts/test-agct-watcher.mjs
```

Offline tests exercise state transitions, single final application, TX/OFF aborts, stale telemetry, radio rejection, configuration acknowledgement and update identity. Explicit artificial test-double messages never enter the export or the live radio. They test software behavior and do not validate physical knee detection.

The high-contrast help panel, compact status and per-band settings are included in the export. Browser interaction and hardware calibration must be checked after the explicit deployment. No automatic deployment is performed.
