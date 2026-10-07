# AU-510M diagnostic state machine — v4.23

Old v4.22 → New v4.23. Known-good before changes:
`a2e64b1eb23723fb73e58906a50ce1b08df8e087`. Stage 2 adds one isolated reducer,
`diagnostics/au510m-state-machine.cjs`, to the existing Stage-1 diagnostic owner.
Runtime acceptance passes with the documented browser-visual limitation below.

## Inputs, output and ordering

The reducer consumes Stage-1 records only: LOGGER_START, connection lifecycle,
INTERLOCK_STATE/BASELINE/FIELD, linked TX_RX, TUNE_CANDIDATE/STALE, HEALTH and
DIAGNOSTIC_ERROR. It never reads radio/context, opens a connection, subscribes,
polls, sends commands or changes existing parsers/pages. Stage-1 stores the source
record before calling the reducer. Every DIAG_STATE_CHANGE is appended through
the existing event append method into the one 240-s/12000-record RAM ring. No
second history/buffer is introduced; original source records remain intact.

Generated records link source_event_seq and derived_from_seq to the triggering
Stage-1 record. interlock_source_seq separately names the underlying Interlock
record. Sequence proves local arrival/publication order only; radio-internal
causality is not guaranteed. Generated records are not fed back into the reducer.
All state-confidence values are DIRECT, DERIVED or UNKNOWN. origin_confidence
retains the independent Stage-1 enum; no DERIVED origin value is introduced.

The directly observed `transmit.payload.tune` is promoted only to
DIAGNOSTIC_TUNE_SIGNAL: TUNE_ACTIVE for fresh 1, TUNE_INACTIVE for fresh 0,
TUNE_UNKNOWN otherwise. It is not a command, physical-origin attribution or
project-wide canonical TUNE replacement. Stage-1's existing 15-s freshness,
startup/disconnect resets and 1/5-Hz sampling remain unchanged.

## Exact state definitions

| State | Entry evidence | Confidence | Exit |
|---|---|---|---|
| UNKNOWN | startup/disconnect, missing/unsupported Interlock, unlinked or contradictory canonical TX/RX, unresolved canonical update at the next health record | UNKNOWN | fresh sufficient Stage-1 evidence |
| RADIO_RX | linked canonical TX_RX=RX, Interlock READY/RECEIVE, no pending new tune activation | DERIVED | direct request, block/fault, canonical TX or loss of evidence |
| TUNE_REQUESTED | fresh TUNE_CANDIDATE becomes 1 (including first fresh active observation after UNKNOWN), known canonical RX and READY/RECEIVE | DIRECT for signal only | PTT/TX, tune inactive/stale, block/fault/disconnect |
| TX_REQUESTED | exact directly observed Interlock PTT_REQUESTED | DIRECT | next explicit Interlock condition; never interpolated if absent |
| TRANSMITTING | canonical TX_RX=TX with DERIVED_FROM_INTERLOCK and derived_from_seq matching current TRANSMITTING observation | DERIVED | unkey/return, block/fault or unknown/contradictory evidence |
| UNKEY_REQUESTED | exact directly observed Interlock UNKEY_REQUESTED | DIRECT | next explicit Interlock condition; never inferred from tune/power |
| RETURN_TO_RX | linked canonical RX after observed TX/unkey, or cancellation of fresh tune while canonical RX remains known | DERIVED | immediate RADIO_RX within the same event reduction |
| INTERLOCK_BLOCKED | exact Interlock NOT_READY; optional reason retained when separately present | DIRECT | subsequent explicit Interlock state |
| FAULT | exact TX_FAULT/TIMEOUT/STUCK_INPUT, or Stage-1 DIAGNOSTIC_ERROR/local record-order violation | DIRECT radio indication; DERIVED diagnostic fault | radio fault clears on explicit valid successor; diagnostic fault remains until lifecycle reset |

PTT_REQUESTED is documented by the [FlexRadio status reference](https://github.com/flexradio/smartsdr-api-docs/wiki/SmartSDR-Status-Responses).
UNKEY_REQUESTED is implemented because it was actually captured on this AU-510M
in the accepted v4.22 cycle (seq 4513); the older API table's omission is not
silently treated as proof of availability on other firmware. NOT_READY and the
three exact fault states are documented API conditions, not live-induced tests.
No free-text reason substring guesses, READY→BLOCKED heuristic or tx_allowed=0
alone is used. Unknown firmware states remain UNKNOWN. Synthetic tests do not
prove that the live radio has emitted block/fault states.

## Reduction details and limits

Priority: disconnect/startup UNKNOWN; defined serious diagnostic fault; explicit
radio fault; explicit block; direct request/unkey; linked canonical TX; known RX
with pending fresh tune; known RX. Interlock records arrive before their canonical
TX_RX result. The reducer awaits that ordered result without inserting artificial
UNKNOWN transitions inside a normally synchronous update. If it remains unresolved
at the next existing health record, state becomes UNKNOWN. No new settling timer
or independent state-freshness policy is added.

Stage 1 retains changes, not continuous Interlock freshness heartbeats. Therefore
the age of an unchanged Interlock event alone cannot prove staleness; Stage 2 does
not invent an Interlock timeout. It honors connection resets, canonical UNKNOWN,
invalid source links and Stage-1 TUNE freshness. A firmware silently failing to
report a state while the existing canonical pipeline still reports it as current
is outside the available evidence. This does not repair the separate initialization
issue in the existing RADIO/AGC-T pipeline.

RETURN_TO_RX emits one transition and immediately settles to RADIO_RX, with both
records pointing to the same source seq. No wall-clock hold or timer. When TX falls
while fresh tune=1 remains, RADIO_RX retains DIAGNOSTIC_TUNE_SIGNAL=TUNE_ACTIVE;
unchanged tune does not repeatedly re-enter TUNE_REQUESTED. A subsequent genuinely
new/stale-to-fresh activation may enter it. No cycles or oscillations are counted.

Unchanged state/confidence/reason emits nothing. Material reason/confidence updates
can emit a same-state DIAG_STATE_CHANGE; state_since_ms retains actual entry time.
state_transition_count counts emitted state-assessment records, including the
initial UNKNOWN and material metadata changes. unknown_state_count counts entry
to UNKNOWN including initial startup. Metrics expose current/previous state,
entry time, transition count, unknown entries, last change/reason. Dedicated context
is `au510mDiag.stateMachine`; metrics stay in `au510mDiag.metrics`. Health record
schema/rate remains unchanged; state transitions reach the existing isolated Debug.

Original retention/count/memory algorithms and 50-MiB estimated-record budget
remain unchanged. State records add event fanout: at most two state outputs per
normal source record (return + settle). Historical Stage-1 reserve cannot be claimed
unchanged under every sustained future workload. Conservative 23 original records/s
plus 2×17 state-change records/s gives 57/s before reserve, so count eviction could
reduce coverage under sustained stress. Actual coverage/drop metrics remain the
truth; no universal lossless 240-s guarantee is made. Live rates, fanout and memory
must be measured again for future persistence/incident work.

## Validation

Offline tests cover startup, repeated RX/no chatter, normal TX with/without direct
precursors, both tune-off/RX event orders, fresh active tune while TX drops, tune
cancellation, block and reason changes, documented fault states, unknown firmware
states, disconnect/reconnect, stale tune, contradictory/unlinked evidence, serious
diagnostic error and source order. The actual v4.22 tune fixture is replayed after
an explicitly synthetic baseline; source records are immutable. Integrated tests
verify one ordered ring, unchanged 1/5-Hz sampling, original 84 protected nodes and
central version synchronization. Full validation: `bash scripts/validate-repository.sh`.

Interim live evidence: [machine-readable acceptance](measurements/au510m-stage2-v4.23-validation.json),
snapshot 2026-10-07T09:53:07.924Z. Startup UNKNOWN → UNKNOWN
(reason update) → RADIO_RX; RX baseline 45.483 s, no state chatter.
Nine completed normal TX cycles each recorded TX_REQUESTED → TRANSMITTING →
UNKEY_REQUESTED → RETURN_TO_RX → RADIO_RX, with direct tune=0.
48 state-assessment records, all source-linked and locally ordered.
Measured RX 0.985 Hz / TX 4.854 Hz. Ring peak 968,
oldest 238.993 s, age evictions 491, count/memory drops 0, errors 0.
The isolated 12000-record mixed-schema test measured 14.21 MiB actual
post-GC heap; conservative estimate 43.53 MiB below 50 MiB.
Process RSS includes allocator/runtime overhead and is not the record-heap budget.
Original RADIO/PA/AGC-T/METER data paths and real RX Vue projection pass, active
slice A preserved; no visual browser rendering test available. Deployment passes.
An initial external validation-helper UUID decoding error caused a precautionary
exact v4.22 rollback; its typed-context reader was fixed and the same validated
v4.23 change set redeployed. No existing-page or state-machine failure was observed.

## Final live TUNE acceptance — PASS

Controlled TUNE on 7 October 2026, 12:43:26.836–12:43:30.527 Europe/Berlin
(10:43:26.836–10:43:30.527 UTC): direct fresh 0→1→0, duration 3.691 s.
Source seq 8862/8901; state records 8863, 8865, 8870, 8893, 8898, 8899.
Actual sequence from RADIO_RX:

RADIO_RX → TUNE_REQUESTED → TX_REQUESTED → TRANSMITTING →
UNKEY_REQUESTED → RETURN_TO_RX → RADIO_RX.

All six state records link their actual source records. TX/RX links the observed
Interlock records. The direct tune signal is not command-origin evidence;
trigger/command origin remains UNKNOWN. 18 fresh health snapshots measured
4.928 Hz; RX briefly preceded tune=0 and retained TUNE_ACTIVE truthfully.
Final RX, fresh tune=0, active slice A, diagnostic errors 0. The cached Interlock
reference predating the TUNE window is not claimed as newly observed; all actual
transmit/return Interlock records for this cycle are present.

The initial supervised validation window contains 138 state-assessment records;
the controlled TUNE adds 6, totaling 144 recorded test-window state records.
The runtime lifetime metric at TUNE completion is 167; the gap between
recording windows is not claimed as a complete trace. Initial RX/TX capture and
final TUNE trace are separate observations, preserved in the linked JSON.
Peak ring count 1000; at TUNE completion age evictions 8380,
count/memory drops 0, oldest 239.877 s. Earlier state/TUNE changes
that aged out before the operator reply were not used as acceptance evidence.
The bounded temporary context-API capture secured this actual TUNE before expiry
and stopped on completion. It adds no runtime file writer or second radio input.

All nine specified states are implemented and tested. INTERLOCK_BLOCKED and
radio FAULT conditions were tested offline, not deliberately induced on hardware.
RADIO/PA/AGC-T/METER canonical delivery and RX projection pass after TUNE; browser
visual rendering remains unverified because no browser tooling is installed.
No unsupported states fabricated, new connection, subscription or origin inference.

No SQLite, incident detector, JSONL captures, DIAG dashboard or Stage 3. Stop for review.
