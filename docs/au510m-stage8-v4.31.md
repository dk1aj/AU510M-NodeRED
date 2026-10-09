# DIAG LIVE TREND — v4.31 staged implementation

Old v4.30 / New v4.31. Known-good checkpoint before the first runtime change:
`3992c9fce70cf62b3db10d5f9f596837c59ae8c9`, equal to `origin/main`, with a
clean worktree and accepted v4.30 runtime/kiosk state.

The feature is built through the mandatory reversible Dashboard stages. The
central release is bumped once for the complete v4.31 change set. Each stage is
validated, deployed, runtime-checked, kiosk-checked, committed and pushed before
the next stage begins. No stage changes the existing radio connection,
subscriptions, meter parser, 1/5-Hz HEALTH acquisition, ring capacity, incident
capture, SQLite history, EXPORT implementation or canonical RADIO/PA/METER paths.

## Stage A — minimal internal view

The existing DIAG component adds a third browser-local selector, TREND. Default
on load remains LIVE. TREND initially contains only a clearly labelled empty
placeholder. It has no data source, timers, API request, database access or
outbound Node-RED wire. LIVE and HISTORY markup and behavior remain unchanged.

Technical validation: PASS, including the full repository suite and Dashboard
1.30.2 single-export compatibility. Deployment: PASS, 98 nodes, revision
`561d85e02b17ea82d4347721a3c4fb2d406270c36911b9bb04cf03bdb7bbcbe0`.
Runtime/source equality, v4.30 -> v4.31, CONNECTED RADIO_RX with slice A,
SQLite READY with zero incidents/errors, empty HISTORY, AGC-T RX and passive
actual RADIO/PA/METER/DIAG delivery all pass. The three historical RFPOWER HTTP
routes returned 404 before any related change was made; they belong to the
disabled rfpower tab and are not modified here. Actual 800×480 Stage-A kiosk
validation: PASS, explicitly confirmed by the user on 9 October 2026: default
LIVE, complete LIVE/HISTORY/TREND selector, readable empty view, unchanged
LIVE/HISTORY and existing pages, footer visible, no scrollbar, clipping or
overlap. This is the accepted reversible checkpoint before Stage B.

## Planned final projection

The final view will read only existing HEALTH-lane records from the canonical
240-second/12,000-record RAM ring. A bounded server projection will retain at
most 480 plotted points per series. Deterministic time buckets will preserve
first, last, minimum and maximum values rather than averaging, so short TX power,
reflected-power, SWR and temperature excursions remain visible. The browser
will replace each snapshot and never accumulate points. Native SVG inside the
existing Vue component avoids a new frontend dependency. Final behavior,
performance, stale/disconnect semantics and acceptance evidence will be recorded
as their stages are completed.
