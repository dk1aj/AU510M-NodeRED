# DIAG LIVE and later HISTORY — v4.29 internal stages

Old v4.28 / New v4.29. Known-good pushed checkpoint:
`033739f604ee9c840c09c5721193836a5330c968`.

The actual v4.28 deployment contained the accepted DIAG placeholder, not a LIVE
view. SQLite contained zero incidents. The user authorized completing and
validating DIAG LIVE first, then HISTORY, as two internal stages of the same
v4.29 change set. There is no additional version bump between these internal
stages. Commit and push wait for LIVE, HISTORY, actual kiosk and repository
acceptance. Existing unrelated diagnostic drafts remain untouched.

Preparation uses a clean isolated worktree at the known-good pushed checkpoint.
The initial static layout was deployed separately and passed technical checks;
it was not claimed to have passed physical kiosk acceptance. This document now
describes the subsequent real LIVE implementation.

## Existing page and layout

DIAG remains widget `9b1bcb4b21cd24ff`, internal key `external`, order 4, in
`ff_group_au510m_meter` on `ff_au510m_page` (`/dashboard/au510m`). No top-level
Dashboard page/group is added. The fixed 800×480 Teleport frame retains navigation,
heading and central Old/New footer. Its content area is 784×366 px. Scoped
DIAG styling fits summary, radio fields, reason, current incident, a compact
six-column/two-row health matrix and a ring-status line inside that area.

LIVE displays DIAG state and evidence confidence, PA_FAULT, diagnostic TUNE
candidate/freshness, connection, Interlock state and reason, active slice,
frequency, mode, current capture status, SQLite state/queue/drops and ring
status/count/capacity/span/loss/error counters. The eleven canonical health
values are PWR, REF, SWR, PA TEMP, FET1, FET2, PA CURRENT, PA EFF, 13.8A, 13.8B
and FAN. No control/reset buttons or radio commands are present.

## Read-only canonical data adapter

`au510m_diag_live_tick` reads at 1 Hz through `au510m_diag_live_project`.
The projection module is `diagnostics/au510m-diag-live.cjs`. It reads existing
`au510mDiag` context from `au510m_diag_stage1`, canonical processed meter/radio
snapshots from `au510m_live_bridge` and the existing global PA_FAULT sample.
No original node or wire is changed, apart from the DIAG presentation itself
and the central watcher release environment. The old external meter feed is
preserved; the DIAG component only accepts the explicitly tagged LIVE payload.
The diagnostic observer, ring, detector, writer, radio owners, subscriptions,
parsers and conversions remain unchanged.

PA_FAULT invokes the existing METER component's `paFaultStatus` computed method
and `freshForwardTimestamp` helper directly. Its trusted local component options
are evaluated once when the adapter initializes; no component lifecycle or
`data()` is executed. This avoids copying, refactoring or reimplementing the
canonical state logic and leaves the METER component unchanged.

Interlock reason comes from the existing processed PA_FAULT sample only when
it is fresh and matches the current Interlock state. Reasons from an older state
are not presented as current. Diagnostic state and TUNE freshness are projected
from their existing owners. TUNE remains explicitly a diagnostic candidate;
it is not promoted to a newly proven canonical radio state.

Health uses existing `latestHealth` values only when their canonical quality is
FRESH. Existing freshness and current-TX-interval gates remain authoritative;
there is no dBm conversion. RX PWR/REF/SWR are `--`, not fabricated zero/1.00.
Missing, stale, disconnected or invalid values are `--`/UNKNOWN. A stale or
missing UI delivery expires after the existing 15-second display freshness
window, using browser receipt time rather than comparing server/browser clocks.

The current incident area projects the persistent capture owner's active-count
metric. Positive counts show the existing incident type and COLLECTING. Zero
means NO ACTIVE CAPTURE, not proof that no historical incident exists. No
COMPLETE capture status is invented. SQLite errors affect only its status;
LIVE reads no database. The adapter publishes only explicit summary fields,
never ring records, client/session identifiers, raw packets or source objects.

## Validation gate before HISTORY

`test-au510m-diag-live.mjs` exercises the real diagnostic core through RX, normal
TX, normal TUNE, return to RX, stale TUNE/health, disconnect/reconnect and fault.
It invokes the unchanged METER PA_FAULT implementation and checks SQLite failure
isolation, capture status, immutable input, privacy filtering and UI delivery
expiry. The mandatory repository suite includes this test and the existing
single-default-export Vue compatibility check.

Before proceeding to HISTORY, real RX, normal operator TX/TUNE and physical
800×480 kiosk acceptance must pass. The agent never keys the radio. Required
kiosk checks: complete LIVE fields/navigation/footer, readable health/status,
no scrollbars/clipping/overlap, touch navigation and continued RADIO/PA/AGC-T/
METER operation. API success alone is not physical acceptance. If LIVE fails,
stop and restore only the current feature changes using the recorded checkpoint.

## HISTORY implementation — internal Stage B

The user confirmed LIVE's actual kiosk visual PASS after RX/TX acceptance and
the recorded successful short TUNE. DIAG LIVE is fully accepted. HISTORY starts
only after that gate, within the same v4.29 release pair; no extra version bump
or intermediate commit/push is made. The accepted LIVE flows were saved to a
local feature rollback checkpoint before editing.

The existing DIAG widget now has browser-local LIVE/HISTORY selectors in its
heading. Default is LIVE after loading the page. The accepted LIVE content
remains; switching views sends no widget/radio action and persists no view state.
HISTORY uses the existing 784×366 content area: left column has five recent
rows and the five-point textual timeline, right column has selected metadata
and a compact ten-value health matrix. No new Dashboard page/group, graph,
modal, control, reset, export or raw viewer is added.

### Read-only API and SQL

GET /au510m-diag/history returns at most five sanitized recent incidents.
GET /au510m-diag/incident/:id returns only the requested incident detail; IDs
are strictly validated and all values are SQL parameters. The HTTP nodes feed
one isolated reader, never a radio command node. The function fails with 503
HISTORY UNAVAILABLE if the canonical persistence status is not READY.

The worker opens the existing database with readOnly:true for each request and
closes it afterward. Every prepared statement is SELECT, with explicit columns:

- incidents ordered by trigger_ts_ms DESC, incident_id DESC LIMIT 5;
- selected incidents WHERE incident_id=? LIMIT 1;
- selected state_events WHERE incident_id=? AND seq IN (?,?) LIMIT 2, for
  first-abnormal and last-cycle timestamps;
- selected health_samples WHERE incident_id=? AND seq<trigger_seq AND
  ts_ms<=trigger_ts_ms, newest first LIMIT 1.

No table/schema/write/retention operation is exposed by this API. A serialized
worker keeps SQLite work off the Node-RED event loop. Pending requests are
bounded to four, identical in-flight reads are coalesced, cache is bounded to
six results, timeout is three seconds, and errors expose no paths/stack traces.
The 15-second server cache is invalidated by the existing SQLite last-write
revision; it introduces no timer or database polling.

### Refresh and selection

The browser loads the list once at initialization, then at most every 45 s
while HISTORY is visible. Entry within 30 s reuses the list. Selecting a row
loads only that ID, cancels the previous detail fetch and rejects stale/mismatched
responses. Selection stays if the ID remains in the latest five; otherwise it
selects the newest. Empty production history shows NO INCIDENTS. No replay or
synthetic row is inserted in the live database.

The existing 1-Hz LIVE projection additionally forwards SQLite lastWrite. Its
underlying update rate and data owners remain unchanged. A capture-count drop
refreshes history; a changed write revision with zero active captures and an
empty writer queue refreshes again after persisted completion. This covers the
writer completing after the first display update. These are bounded event-driven
reads, never one database query per LIVE tick.

### Stored detail and evidence

Rows show TIME, TYPE, CYCLES and PRECURSOR, plus COLLECTING when persisted.
Details retain stored type/time/cycles/duration, frequency/mode/slice, PRECURSOR
and age, first abnormal event, TUNE active/fresh, separate trigger/command
origins and stored origin confidence. Unknown stays UNKNOWN/--. Neither a
precursor nor time proximity identifies a cause or causal client. Technical
client/session metadata and raw event records are never returned.

PRE/POST flags remain YES/NO/UNKNOWN and terminal states come from actual stored
fields. COLLECTING is never called complete. Inconsistent COMPLETE with a false
completeness flag is rendered INCOMPLETE. Timeline has at most five points and
uses actual persisted precursor, first-abnormal, trigger, last-cycle and terminal
timestamps. Missing retained event detail stays --. Interrupted/partial captures
are labeled accordingly, never CAPTURE COMPLETE. Display times use Europe/Berlin.

There is no separately persisted trigger-health snapshot in the current schema.
The detail therefore explicitly labels HEALTH ≤ TRIGGER with the actual last
stored sample time. It uses only a preceding sample within the canonical
health freshness interval, with its stored numerical values unchanged. Old or
missing samples and historical NULL measurements remain --; no values are
interpolated, calculated or recovered from synthetic/reference data.

SQLite/history failure clears only the history presentation; LIVE remains
independent and updating. Pending requests/timers are cleaned up on unmount
and the worker is terminated on flow close.

### Offline acceptance

The test suite verifies actual immutable natural replay: 38 cycles, TX_FAULT
PRECURSOR, RX_RETURN_WHILE_TUNE_ACTIVE first abnormal, UNKNOWN origin/client
and missing historical health. Additional temporary SQLite fixtures test empty
history, newest-five ordering, selection, actual timestamps, every capture state,
NULL/zero/stale health, read-only failure, parameter rejection, bounded worker
queue/cache, request coalescing and source table immutability. Vue method tests
cover local switching, missing values, completion refresh and history failure
isolation. Fixtures/evidence/databases remain outside the release commit.

## Acceptance status

Full implementation offline/repository validation: PASS.
LIVE deployment/runtime observation: PASS technically; physical acceptance pending.
Actual RX/TX: PASS (user confirmed). Normal short TUNE: PASS (live validated).
Actual LIVE 800×480 kiosk: PASS, explicitly confirmed by the user.
HISTORY 800×480 kiosk: PENDING; release acceptance withheld.
HISTORY: implemented; technical/runtime PASS, actual HISTORY kiosk PENDING.
Commit/push: withheld until both internal stages and all acceptance gates pass.

## LIVE technical deployment observation

The complete repository suite passed in preparation and in production,
including the new LIVE regression test and FlowFuse single-export rule.
Production-path reader initialization also passed offline. The standard deploy
succeeded with 90 nodes, revision
`fb30b0f08e8f852ca1d11bff2863e795743829d52627ef167083773cef7a62d1`.
The central release remains Old v4.28 / New v4.29. Active flows exactly match
the reviewed files, and the new reader function is initialized in the runtime.

Existing radio/PA/METER/DIAG widget-delivery counters and canonical health
timestamps continued advancing; AU-510M remained CONNECTED with displayed
slice A, SQLite READY, zero diagnostic errors and zero incidents. An initial
post-deploy observation caught TRANSMITTING/TX, but this alone does not prove
the required controlled normal-TX/TUNE acceptance. A passive Dashboard-channel
observation receives real LIVE payloads (not reconstructed status), including
RADIO_RX, READY, fresh TUNE candidate 0 and NO ACTIVE CAPTURE.

Actual 800×480 visual and normal operator TX/TUNE acceptance remain pending
the user's results. HISTORY has not started. No commit or push is performed.

## Final LIVE reload and observation

The focused test now also asserts that switching the existing normalized state
to RX immediately blanks PWR/REF/SWR, even before the next HEALTH sample.
The full repository suite and final flow/template compatibility checks passed.
The display reader initialization annotation forces its module to reload.
Latest deployment revision:
`07f39743dda676f65d524d4dfa898274c200d413d85e9fd9d4cabada89f6ed57`.
Version remains v4.29.

The final reload proceeded after a failed RX precheck because the shell command
did not stop on that failure. This execution mistake was reported to the user.
Immediate follow-up checks found active/local flow equality, CONNECTED AU-510M,
RX, fresh canonical health and existing widget delivery, SQLite READY, zero
diagnostic errors and zero incidents. A subsequent ten-second passive Dashboard
observation received ten LIVE payloads in TRANSMITTING with TUNE candidate 0
and all eleven actual health fields available, with NO ACTIVE CAPTURE. No
radio-control actions or synthetic incidents were generated by these checks.

Technical observation covers actual RX and TX data delivery, but normal
operator TUNE and physical kiosk acceptance remain pending. HISTORY, commit
and push remain withheld under the user's explicit two-stage acceptance gate.

## Remaining LIVE validation — 8 October 2026

RX PASS and normal TX PASS were explicitly confirmed by the user. The user
then explicitly authorized one normal short TUNE through the existing control
path. No implementation, flow changes, deployment, version bump, commit or push
was performed during this validation.

TUNE: PASS. One FRStack TUNE-on request and explicit TUNE-off after
2008 ms, with the OFF watchdog armed before ON.
Direct observed TUNE candidate on at 08/10/2026, 11:11:42
and off at 08/10/2026, 11:11:45, Europe/Berlin. Existing tune power
was read as 4 and left unchanged; no frequency/mode/power configuration changed.
The established FRStack API semantics are documented by the manufacturer:
[FRStack WebAPI](https://www.mkcmsoftware.com/download/FRStackWebApiReadme.html).

Complete bounded retrieval of the new canonical ring records for this short
window confirmed the actual diagnostic state-machine sequence:
TUNE_REQUESTED -> TX_REQUESTED -> TRANSMITTING -> UNKEY_REQUESTED ->
RETURN_TO_RX -> RADIO_RX. The source sequence was contiguous within this
validation window. This is operation validation, not an event-rate sizing
measurement or a claim about forensic PRE/POST capture completeness.

Eight actual Dashboard LIVE payloads included fresh TUNE 1 while TRANSMITTING
and fresh TUNE 0 after returning to RADIO_RX. Every sampled displayed DIAG
state matched the actual recorded state machine at that timestamp. PA_FAULT
remained READY; Interlock showed TRANSMITTING during TUNE and READY afterward.
Its observed reason was explicitly empty, displayed as --. Connection remained
CONNECTED, active slice A, 14.074 MHz DIGU. SQLite remained READY, diagnostic
errors stayed zero, and persistent incident count remained 0 -> 0. The current
incident display remained NO ACTIVE CAPTURE. Existing RADIO/PA/METER widget
messages and AGC-T status continued advancing.

At the end of the TUNE validation, kiosk acceptance was PENDING. This execution
environment has no browser, active display
server, screenshot tool or configured kiosk remote-control tool; the X11 socket
directory is empty. No headless result is substituted for real physical kiosk
acceptance. The actual 800×480 readability, scrollbars, clipping, overlap, touch
navigation and visual correctness of existing pages initially awaited the
user's check. The user subsequently confirmed the LIVE visual PASS, fully
accepting DIAG LIVE before HISTORY implementation began (see below).
Local validation evidence remains under /tmp and is not committed.

## HISTORY deployment and runtime acceptance

LIVE kiosk PASS was explicitly confirmed by the user before HISTORY began.
HISTORY technical validation and full repository checks passed. The standard
deployment ran only after checking the accepted LIVE flow checkpoint, CONNECTED
RX, TUNE off and no active capture. Deployment succeeded with 94 nodes, revision
`4437608cf76f2021c369f9eafb2654a523cfe956f2b450493e577262a3e3a04c`.
Old v4.28 / New v4.29 remains unchanged.

Runtime GET history returns READY and zero rows, matching the production
SELECT count of zero incidents. Five repeated requests used the existing cache;
the worker query counter remained unchanged during the following five seconds
with normal LIVE traffic. There is no 1-Hz database polling. Missing selected
ID returns 404; invalid ID returns 400; POST is rejected; all responses are
no-store. Production incident count remains zero and no test fixture was
inserted. Full selected detail/ordering/precursor/health acceptance uses only
the temporary offline SQLite fixture and immutable natural replay.

Active flow configuration exactly matches the reviewed source. After deployment
AU-510M remains CONNECTED, slice A, RADIO_RX; SQLite READY, errors zero and
incidents zero. RADIO/PA/METER/DIAG deliveries and health timestamps continue
advancing. Ten passive Dashboard payloads also confirmed the independent LIVE
feed, including fresh TUNE 0, READY and NO ACTIVE CAPTURE. The existing AGC-T
status endpoint remains available with its active slice and central version.

Actual HISTORY kiosk visual/switching acceptance is pending the user's check
of the newly deployed view. Previous LIVE visual acceptance is not silently
extended to HISTORY. Commit/push remain withheld until that required gate.
All unrelated diagnostic drafts remain outside the release changes.

Final HISTORY correction: unrecognized terminal capture evidence is displayed
as UNKNOWN; COMPLETE with unknown completion evidence remains UNKNOWN. Offline
fixtures cover both cases. The complete repository validation passed again,
then the authorized standard deployment succeeded with 94 nodes, revision
`0bf8a105857fc226394cd2f4cef919798486e44f50014eea45b8224241d7e7e8`.
Read-only HISTORY/cache/error checks, unchanged zero incident count, canonical
RX/SQLite continuity and ten passive LIVE socket updates passed again. This
internal correction retains Old v4.28 / New v4.29. HISTORY kiosk acceptance
remains PENDING; no commit or push has been performed.

## Final release acceptance

The user explicitly confirmed **HISTORY Kiosk: PASS** after the final deployed
HISTORY correction. Both LIVE and HISTORY have therefore passed their required
actual 800×480 kiosk acceptance; technical/runtime and repository validation
have passed. Old v4.28 / New v4.29 remains the completed release version.

Before finalization, the repository and origin/main were found already at
`899bccb9a8c11bece6f3ebfc14fb64baa9c71fd4` (`brute force`), containing the
implementation and the previously separate diagnostic drafts. That published
commit is preserved without rewriting history. This acceptance record is a
documentation-only follow-up; no additional runtime change or deploy is needed.
