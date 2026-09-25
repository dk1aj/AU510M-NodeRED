# AU-510M Auto AGC-T Watcher

Separate UI: `http://dietpi.fritz.box:1880/agct-watcher`. The export is disabled and Auto defaults OFF. The active flow is in `flows.json`.

1. Tune to a clear receive frequency and choose the desired preamp and AGC speed.
2. Use **QRG übernehmen** to save the active frequency for this band. This does not retune the radio.
3. Use **Messung starten**. The watcher saves the original AGC-T, sets 100, measures the AGC/LEVEL reference, scans downward by 10 to bracket the knee, then scans within that bracket by 2. It stops at the first confirmed knee and applies the configured final offset.

Each point uses 300 ms settling and a 700 ms measurement window with at least five samples per meter. LEVEL spread and median drift must remain within 2.0 dB; the AGC median must fall at least 2.0 dB from the reference. The UI lists only measured points and shows start, knee, final AGC-T, count and scan time on completion. The original threshold is restored after an abort when RX and the saved slice are available. No write occurs during TX.

The actual post-AGC meter is `SLC/<active-slice>/AGC` when inventory identifies it as post-AGC dBm. The internal `AGC+` status key remains for compatibility. Every threshold write requires an ACK and matching live slice readback. No frequency, mode, antenna, RF power or ATU command is generated.

The status and quiet-frequency settings are local to Node-RED. Saving a quiet frequency does not certify that the frequency is free of stations. A full hardware scan has not been performed as part of this change.

The full current flow configuration uses this deployment command:

```sh
bash scripts/deploy-all-flows.sh
```
