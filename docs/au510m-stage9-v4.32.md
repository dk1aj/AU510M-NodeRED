# PA HEALTH EARLY WARNING — v4.32 staged implementation

Old v4.31 / New v4.32. Known-good checkpoint before the first runtime change:
`36e25d7f59f500250b2f91b73446562d0b63c750`, equal to `origin/main`, with a
clean worktree and accepted v4.31 runtime/kiosk state.

PA HEALTH is a read-only derived diagnostic classification. It is never a
manufacturer-provided radio state and never sends a radio or protection
command. The release uses the existing radio connection, parser, subscriptions,
canonical HEALTH samples, 240-second/12,000-record ring, incident capture and
SQLite schema. No new incident type or continuous database logging is added.

Repository review found no documented manufacturer numeric limits for PA/FET
temperature, current, efficiency, supply voltage, SWR, reflected power or fan
behavior. Existing PA gauge ranges are explicitly display scales. Therefore no
numeric value may be labelled `MANUFACTURER_LIMIT`; later numeric rules in this
release must be documented as `PROJECT_WARNING_THRESHOLD`. MAINFAN is currently
canonicalized and displayed as RPM, but zero-at-low-temperature semantics are
not proven, so zero alone cannot assert fan failure.

The staged plan is:

1. Stage A: neutral static PA HEALTH / UNKNOWN card only.
2. Stage B: final static card layout, colors, primary-reason and count slots.
3. Stage C: clearly marked browser-only display simulation.
4. Stage D: direct PA_FAULT/connection evidence only; no numeric warnings.
5. Stage E: numeric warning rules after normal RX/TX/TUNE baseline capture.

## Stage A — minimal derived-status card

DIAG LIVE receives a fifth compact summary card labelled PA HEALTH. It always
shows `UNKNOWN` and `DERIVED · STAGE A`; it has no live binding, classifier,
event output, threshold, timer or new flow node. The existing 68-pixel summary
row is divided into five columns. LIVE, HISTORY and TREND behavior and all
canonical paths remain unchanged.

Technical/full repository validation: PASS. Deployment: PASS, 99 nodes,
revision `8fe8e50f791227e2ab28ecf65282f00795909a080848725ade5574afd9fd5144`.
Runtime and `flows.json` are byte-for-byte equal. The central status reports
Old v4.31 / New v4.32, CONNECTED/RADIO_RX with Slice A. Ten passive seconds
delivered 111 RADIO, 111 PA, 110 METER, ten DIAG LIVE and ten DIAG TREND
updates; all eleven trend series remained present. SQLite stayed READY with
queue 0, ring errors 0, no active capture and zero incidents. Actual 800×480
kiosk acceptance: PASS, explicitly confirmed by the user on 9 October 2026.
PA HEALTH / UNKNOWN / DERIVED · STAGE A and all five summary cards were readable;
there was no overlap, clipping or new scrollbar, and LIVE, HISTORY, TREND,
RADIO, PA, AGC-T and METER remained functional. This is the accepted reversible
checkpoint before Stage B.

Stage-A commit/push: `2f05c239aa42b74f0302d2dcd0be12d9eda6257a`,
`HEAD == origin/main`, clean working tree.

## Stage B — static final card layout

The fifth summary card receives its final static visual hierarchy: PA HEALTH
heading, compact multiple-reason count slot, large state and one-line primary
reason/status slot. Four scoped styles distinguish OK (green), WARNING (amber),
CRITICAL (red) and UNKNOWN (gray). The visible Stage-B fixture remains UNKNOWN,
`PRIMARY -- · STATIC` and `+0`; no style is selected by live data. There is no
classifier, threshold, event, timer or backend path.

Technical/full repository validation: PASS. Deployment: PASS, 99 nodes,
revision `1c1af33fd5ad97d8452b6527818ef03b9f17f55de4c813c1fa64da485b7b5ea9`.
Runtime and source are byte-for-byte equal. Ten passive RX seconds delivered
111 RADIO, 111 PA, 110 METER, ten DIAG LIVE and ten DIAG TREND updates; every
trend series remained intact. SQLite stayed READY with queue 0, ring errors 0,
no active capture and zero incidents. Actual 800×480 kiosk acceptance and the
reversible Git checkpoint: PASS, explicitly confirmed by the user on 9 October
2026. UNKNOWN styling, count slot and primary-reason line were readable; all
five summary cards fit without overlap, clipping or scrollbar, and existing
pages remained functional. This is the accepted reversible checkpoint before
Stage C.

Stage-B commit/push: `794657c452657a2a8304db484ecb3e6916d37b54`,
`HEAD == origin/main`, clean working tree.

## Stage C — display-only simulation

The final card layout receives one fixed browser-only fixture: amber WARNING,
primary reason SWR HIGH and `+2`. The card explicitly says SIMULATION. The
fixture is created once inside the Vue component's `data()` and has no timer,
Node-RED output, live input, classifier, threshold evaluation, ring access,
SQLite access or radio path. It exists only to validate the compact warning
hierarchy and color at 800×480 before any real status is connected.

An initial Stage-C deployment was rolled back immediately when the unrelated
AGC-T runtime reported its persistent `RADIO REQUEST ERROR`; the same error
remained on the byte-identical Stage-B rollback, proving it was not introduced
by PA HEALTH. The user explicitly instructed that AGC-T be ignored for now.
PA HEALTH does not modify or invoke AGC-T, and all other existing pages remain
inside the staged regression checks.

Technical/full repository validation: PASS. Deployment: PASS, 99 nodes,
revision `9885033bd797fae28ad1bd7eb8feeb506ed2acecc0bb7effdca3a278ed54ed0a`.
Runtime and source are byte-for-byte equal. Ten passive RX seconds delivered
107 RADIO, 107 PA, 106 METER, ten DIAG LIVE and ten DIAG TREND updates; all
eleven trend series remained intact. SQLite stayed READY with queue 0, ring
errors 0, no active capture and zero incidents. AGC-T was excluded from this
runtime acceptance by explicit user instruction and was not modified or
invoked. Actual 800×480 kiosk acceptance and the reversible Git checkpoint
are PASS, explicitly confirmed by the user on 9 October 2026. Amber WARNING,
SWR HIGH, `+2` and the SIMULATION label were readable; the five-card row fit
without clipping, overlap or scrollbar, and existing evaluated pages remained
functional. This is the accepted reversible checkpoint before Stage D.

Stage-C commit/push: `7dd2fee3960d8fa6451fd5f8990b6fd3c73e98a5`,
`HEAD == origin/main`, clean working tree.

## Stage D — direct fault evidence only

The browser simulation is removed. The existing read-only DIAG LIVE projector
reuses the already accepted canonical PA_FAULT classification and connection/
freshness gates. A directly observed PA_FAULT `FAULT` is presented as CRITICAL
with primary reason PA FAULT and confidence
`DIRECT_SOURCE / DERIVED_HEALTH_CLASSIFICATION`. READY does not yet claim full
PA health OK: until Stage-E numeric rules are connected it remains UNKNOWN with
`NUMERIC RULES PENDING`. Startup, stale data, disconnect and insufficient direct
evidence remain UNKNOWN. No numeric threshold, health-change event, radio
command, new connection/subscription, ring, SQLite write or incident type is
added in this stage.

Technical/full repository validation: PASS. Deployment: PASS, 99 nodes,
revision `55994f0f2d58632b9782c5da093e708766acf0e95cc38a5955f16da97f2e6cec`.
Runtime and source are byte-for-byte equal. Ten passive RX snapshots reported
PA_FAULT READY and PA HEALTH `UNKNOWN / NUMERIC RULES PENDING / DERIVED`, with
RADIO_RX, Slice A, SQLite READY, queue/drop/ring errors 0, no active capture and
zero incidents. RADIO, PA, METER, DIAG LIVE/HISTORY/TREND and EXPORT paths
remained intact. AGC-T remained excluded by explicit user instruction. Actual
800×480 kiosk acceptance: PASS, explicitly confirmed by the user on 9 October
2026. UNKNOWN, NUMERIC RULES PENDING and DERIVED were readable, no simulation or
false warning was visible, the five-card layout remained intact and all
evaluated existing pages remained functional. This is the accepted reversible
checkpoint before Stage E and baseline-driven numeric classification.
