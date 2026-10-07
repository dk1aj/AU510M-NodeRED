# DIAG replaces EXT — Stage A, v4.28

Old v4.27 / New v4.28. Known-good checkpoint:
596fb9249bc37e013aaeb8b4d9173ae252a1bea9.
A clean isolated worktree at that commit was used for preparation, preserving
unrelated diagnostic drafts in the production directory.

EXT is the existing internal kiosk navigation slot, not a separate FlowFuse page.
Its sole widget is `9b1bcb4b21cd24ff`, formerly `EXTERNAL · 1 meters`, in
`ff_group_au510m_meter` on `ff_au510m_page`. Widget order stays 4. The visible
navigation remains RADIO, PA, TX, RX, DIAG, AGC-T, METER; DIAG replaces the fifth
EXT label in every existing navigation bar. No page, widget or flow node is added.
The internal `external` key, browser event name, session-storage key and widget
ID remain unchanged, so existing navigation and saved selections continue working.

Safety inspection found shared runtime dependencies: YES. Existing source
`2702052aa13cacd0` owns meter inventory/subscriptions/snapshots used by other
widgets and is preserved byte-for-byte, as are its wires, the radio connection,
parsers and all meter processing. FreeDV_SNR remains in the canonical inventory;
its subscription and snapshot generation are not removed. The EXT widget has
no output consumers (`wires: [[]]`, passthru false). References in historical
exports and display-maintenance scripts do not require keeping its old visible
meter card. Diagnostics widget-delivery accounting continues using the same ID.
Shared nodes preserved: YES.

Only the EXT presentation is replaced with a minimal DIAG placeholder showing
that no diagnostic values are displayed yet. No fabricated diagnostic state or
synthetic/live diagnostic values are shown. This is Stage A only; additional
layout or live DIAG integration requires a subsequent authorized stage.
The footer renders the central old/new release values from the existing watcher
status endpoint. The release pair is maintained only in
`agct-watcher-version.json`. No new radio connection or subscription is created.

Validation includes the complete repository suite, Vue single-export
compatibility, seven navigation keys and visible labels, unchanged node IDs and
counts, unchanged non-UI nodes, and exact label-only changes in other widgets.
The canonical hash contract is updated only for these explicitly authorized UI
changes; its non-UI protections remain unchanged. Runtime/kiosk acceptance is
recorded after deployment, before commit/push.

## Deployment and runtime acceptance

Full repository validation passed in the clean preparation checkout and again in
the production directory before deployment. Standard deployment succeeded with
88 existing nodes, revision
`8e5618bd0824c8993e7789c2c17326f1db7fc266726bbfa321d617ad67a96f33`.
No nodes were added or removed. Central release status reports Old v4.27 / New
v4.28. Runtime verification at 23:06:57–23:07:11 Europe/Berlin on 7 October
2026 found active flows equal to the reviewed local configuration, exactly one
DIAG widget, and no EXT navigation label in any active ui-template.

AU-510M remained CONNECTED with active slice A; watcher stayed IDLE/RX, SQLite
READY, zero diagnostic errors/incidents and queue 0. RADIO/PA, TX, RX, DIAG and
METER widget delivery counters all increased. Existing radio, PA, power and
watcher timestamps stayed fresh. Shared runtime nodes and wires remain unchanged.

EXT replaced by DIAG: PASS in deployed configuration.
EXT shared logic preserved: PASS.
Duplicate DIAG tab: NO.
Visual kiosk verification: PASS, explicitly confirmed by the user. DIAG opens at
the kiosk; RADIO, PA, AGC-T and METER all continue working. The deployed minimal
Stage A is accepted. No further DIAG feature stage is started. The final
repository validation is run before committing and pushing this stage; the
active deployment remains unchanged during release closure.
