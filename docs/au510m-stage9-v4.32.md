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
