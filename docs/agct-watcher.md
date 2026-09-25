# Auto AGC-T Watcher

Current release: 3.8. `agct-watcher-version.json` is the release source; the core publishes `uiVersion` to both UIs.

## Scan

Every automatic and one-shot calibration saves the current AGC-T, sets AGC-T to 100, waits 300 ms, then measures the post-AGC `SLC/<active-slice>/AGC` and `SLC/<active-slice>/LEVEL`. The AGC median at 100 is the plateau reference. The internal `AGC+` status key and optional legacy meter fallback remain for compatibility; meter inventory selects the actual post-AGC source.

The coarse pass measures 100, 90, 80 and so on, never below the configured minimum. It stops at the first point whose AGC median is at least 2.0 dB below the reference while LEVEL is stable. That point and the preceding stable point bracket the knee. The fine pass measures only inside the bracket in 2-point steps and stops at its first confirmed knee. The already measured coarse falling point is used if no intermediate fine point qualifies. There is no speculative extra scan below the bracket.

Every measured point gets 300 ms settling, 700 ms measurement, and at least five samples per meter. The window's LEVEL spread and its median drift from the reference must each stay within 2.0 dB. Only measured points appear in the trace. The configured final offset remains -1, bounded by the configured minimum and 100. The result displays start 100, measured knee, final AGC-T, measurement count and elapsed scan time. No band result or prior AGC-T is used as a start value.

## Safety

The only radio write is `slice s <active-slice> agc_threshold=<0..100>`, behind an expiring single-use RX permit. ACK is followed by `sub slice all`; matching live slice readback is required. TX, changed slice, frequency, mode, band, receive settings, stale AGC or LEVEL, unstable LEVEL and request errors abort. The saved original AGC-T is queued for restoration after an abort. Restoration waits until RX and the original slice are current; it never writes during TX or to a different active slice. A disconnected or changed slice can therefore leave restoration pending until the required live status returns. The watcher never writes frequency, mode, antenna, RF power or ATU.

A quiet frequency must be configured and active. Settings remain in the excluded `agct-watcher-settings.json`; older persisted scan-start values are normalized to 100. Auto is OFF by default. The `start100` action remains an alias for one-shot start.

## Validation and deployment

Run `node scripts/test-agct-watcher.mjs`, `node scripts/test-agct-dashboard.mjs`, and `bash scripts/validate-repository.sh`. Offline tests use synthetic meter samples and do not validate the physical knee. The full current configuration uses `bash scripts/deploy-all-flows.sh` for deployment.
