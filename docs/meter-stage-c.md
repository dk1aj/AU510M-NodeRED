# METER Stage C — mathematically defined simulation

Completed Stage-C version pair: OLD_VERSION 4.9 / NEW_VERSION 4.10, maintained in
`agct-watcher-version.json`. Known-good checkpoint before this change: `e3e7053`.
The earlier v4.8/v4.9 wording in the incoming request was stale; the completed
v4.9 simulation was already deployed and pushed, so this correction receives
one new runtime version.

See [cross-needle-meter.md](cross-needle-meter.md) for the physical principle,
canonical geometry, calibration and validation model. This replaces the earlier
500/100 W simulation and independently specified preset SWR values.

FORWARD full scale is 600 W; REFLECTED full scale is centrally configurable,
initially 120 W. Frame, face, pivots, needle lengths, textPath label arcs and
800×480 instrument size are preserved. Ticks, needle angles and SWR guides all
use one interpolated calibration table. Guides 1.2, 1.5, 2, 3, 5 and 8 are
mathematically generated; the infinity guide uses only Pf = Pr <= 120 W.

The compact presets ZERO, GOOD, MEDIUM, HIGH and FULL-SCALE use local Pf/Pr
pairs. Numeric SWR is calculated, with ZERO displaying `--`. Both needles use
250 ms CSS transitions; the controls occupy the unused side margins. No live
radio data, new connections or subscriptions enter METER. Existing live-data
nodes, Function bodies and wiring are unchanged. The METER node remains isolated.

## Validation

Repository validation includes the physical/geometric tests in
`scripts/test-cross-needle-meter.mjs`: calibration, 600/120 W endpoints, ticks,
SWR calculations, line-intersection residuals, parallel/invalid inputs, guide
ratios and distance to corresponding theoretical curves. Maximum accepted
error is 0.25 SVG units. Deliberately shifted crossings must fail. Tests also
verify that changing reflected full scale propagates through geometry.

Chromium tests use an 800×480 viewport and verify every preset/readout, animation,
endpoint labels, actual rendered curve paths, retained SVG/scale/curve DOM nodes,
textPath rendering and full visibility of the instrument, controls, navigation
and footer without scrolling. Screenshots are inspected for readability.

The existing initial-render `radioStatus` error in the unchanged RADIO/AGC-T
component was documented during v4.9. A baseline check before this change
confirmed working RADIO, PA (12/12 live meters), AGC-T and fresh AU-510M values.
The feature does not change that component or its data path.

## Deployment and runtime result — 3 October 2026

All repository checks passed. The automatic deploy succeeded with 83 nodes,
revision `f6e1993bae0e06d8b043bdad95e637fd645efbdb335010fe4cc668cd0eba44d8`.
Deployed Chromium tests passed for all five presets, both 600/120 W endpoint
labels, generated curve paths, actual SVG needle endpoints, smooth animation,
retained DOM identity and 800×480 layout. All preset screenshots were inspected.
RADIO, PA (12/12 live meters), AGC-T and AU-510M freshness checks passed;
TX/RX/EXT also opened. No new browser errors or METER command requests occurred.
The known RADIO/AGC-T LOAD error remains a pre-existing baseline finding. Stage C ends here; Stage D is FWDPWR only and requires a
separate request. REFPWR/SWR stay unconnected to METER.

Stage D now consumes live FWDPWR only; see [Stage D](cross-needle-meter.md#stage-d---live-fwdpwr-integration). Stage-C validation above remains historical.
