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

Stage-A commit/push: `18ccaf74b4aa2648c6e409bfbd27a49046e83bed`,
`HEAD == origin/main`, clean working tree.

## Stage B — static visual layout

The empty placeholder is replaced by the final structural regions only: compact
POWER/SWR/TEMP/PA selectors, CURRENT/EFF/SUPPLY/FAN PA subselectors, one large
native SVG plot area with relative -4m through NOW axis, and group-specific
current/minimum/maximum statistic slots. Every value remains `--`; the chart is
explicitly labelled STATIC LAYOUT and has no source, refresh timer or series.
Technical validation: PASS, including full repository validation. Deployment:
PASS, 98 nodes, revision
`b51024fe84df8eeb146dcc36616fd9f65edffd9deb6811e5545382eea9d35a47`.
The immediate post-deploy observation briefly caught the documented existing
DIAG initialization state UNKNOWN; without any action it returned on the first
bounded follow-up observation to CONNECTED/RADIO_RX, slice A, TUNE 0, SQLite
READY and zero incidents/errors. Ten passive Dashboard seconds then delivered
actual RADIO/PA/METER/DIAG traffic and eleven DIAG health fields. LIVE, HISTORY,
AGC-T and v4.30 EXPORT sources are unchanged. Actual Stage-B kiosk validation
PASS, explicitly confirmed by the user on 9 October 2026: all group and PA
subgroup selectors are usable, graph/axes/stat slots/footer fit at 800×480,
LIVE/HISTORY and existing pages remain functional, with no scrollbars, clipping
or overlap. This is the accepted reversible checkpoint before Stage C.

Stage-B commit/push: `f3d7b41f2a9e6956a3eadfc174016058a8e327ae`,
`HEAD == origin/main`, clean working tree.

## Stage C — deterministic display simulation

The static layout receives fixed example series for all groups and PA
subgroups. The toolbar, graph and status area visibly say SIMULATION. Curves,
legend, group-specific scales and current/minimum/maximum calculations execute
only in the browser from fixed arrays. The fixture includes a 240 W forward
burst, 18 W reflected peak, SWR excursion, temperature rise, PA current and
efficiency changes, supply sag and fan ramp. It has no timer, ring access,
network request, SQLite access or Node-RED output and cannot be mistaken for a
live station value. It will be removed before live integration. Technical,
validation: PASS, including the complete repository suite and explicit peak/
statistics assertions. Deployment: PASS, 98 nodes, revision
`b31e09f513ea6e39984cfb3bd7547b58be46d98a77d663de006a1ac6020e95ca`.
Runtime/source equality, CONNECTED/RADIO_RX slice A, SQLite READY with zero
incidents/errors, empty HISTORY and passive actual RADIO/PA/METER/DIAG traffic
all pass. Actual Stage-C kiosk validation: PASS, explicitly confirmed by the
user on 9 October 2026 for every group/subgroup, curves, legends, axes and
statistics, with smooth switching and no scrollbar, clipping or overlap. This
is the accepted reversible checkpoint before Stage D.

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
