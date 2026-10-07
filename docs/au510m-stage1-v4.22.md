# AU-510M passive diagnostic Stage 1 — v4.22

Implemented on 2026-10-07, Old v4.21 → New v4.22, from known-good
`63f0fc885eb48c51485c66404221015c83b4f5c1`. The central version was bumped once.
[Machine-readable acceptance evidence](measurements/au510m-stage1-v4.22-validation.json).

## Scope and exact sources

One independent Node-RED tab `au510m_diag_tab`, observer Function
`au510m_diag_stage1`, and isolated disabled Debug `au510m_diag_debug`.
The Function loads `diagnostics/au510m-stage1-runtime.cjs` and its testable
`au510m-stage1-core.cjs`. There are no incoming wires and no radio command output.
The installed Node-RED hooks observe existing messages without mutation; owner
listeners observe already decoded statuses. Finalization removes the hooks,
listeners and timer. No second radio connection or new subscription is created.

| Source | Observed information |
|---|---|
| Existing connection `7fbf2bfc9badc7d3` | decoded transmit tune, client/session and slice membership; connected/disconnected/connecting lifecycle |
| Existing reducer `au510m_live_state` | interlock input before reduction and canonical `__radio_status` output; normalized TX/RX, selected frequency, mode and active slice |
| Existing meter processor `2702052aa13cacd0` | latest `meters.rows` context sampled at health cadence, already processed Watts and canonical units |
| Existing request nodes `cb517e1d426fa203`, `1938f24ff5eccb7f`, `185977e7709d7d4d`, `au510m_live_request`, `07c61c6741eb8fad` | separate incoming requests and outgoing callback responses; no new request |

`diagnostics/canonical-contract.json` pins the original 84 nodes, allowing only
the central watcher-version environment update. Tests check original IDs, wires,
functions, UI templates, configs and existing subscriptions. Future intentional
changes to those protected paths require an explicitly reviewed contract update.

## Event and health lanes

Events retain changes to interlock state/reason/source/permission, derived TX/RX,
selected slice/frequency/mode, slice membership, candidate TUNE, client/session,
connection and logger lifecycle. Unchanged statuses do not generate changes.
Existing observable requests and ACKs remain separate records. No full health
snapshot is duplicated into an event and no raw native-rate meter stream is kept.

Health samples eleven canonical meters: FWDPWR, REFPWR, SWR, PATEMP, PAFETQ1TEMP,
PAFETQ2TEMP, PACURRENT, PAEFF, +13.8A, +13.8B and MAINFAN, plus current diagnostic
radio context. Sampling is 1 Hz RX/UNKNOWN and 5 Hz canonical TX or fresh active
TUNE candidate. The 50-ms scheduling timer observes monotonic deadlines; measured
rates reflect actual scheduling latency rather than claiming precise 200-ms timing.
No additional meter parser, dBm conversion or TX inference is introduced.

Each meter has source time and quality. Only post-connection-epoch samples no
older than 15 seconds are eligible; missing/invalid values are null. RX power/SWR
values retain their actual canonical value with explicit RX_NOT_TX_MEASUREMENT
quality. Previous-TX-interval data are separately flagged. The diagnostic quality
flags do not change existing dashboard validity gates or displayed values.

## Ring and memory

One fixed circular array, age retention 240 seconds and hard maximum 12000 records.
Age eviction precedes count eviction; an additional conservative estimated-record
50-MiB ceiling can evict earlier. All evictions are counted separately. A record
at exactly 240 seconds is retained; older records expire on the next 50-ms tick.
Records use bounded metadata: strings 256 characters, object depth 2, at most 16
fields/items; client/slice tracking maps 64 entries, pending request map 256 entries
with 30-second expiry. Truncation/overflow metrics make loss visible.

Sizing prerequisite: [controlled two-lane measurement](au510m-stage1-two-lanes-2026-10-07.md),
23 records/s × 240 s × 2 reserve = 11040, rounded to 12000. Expected representative
mixture about 20 MiB; 50 MiB is an estimate budget for records, not an OS/process
RSS guarantee. Whole Node-RED memory also contains dashboard/runtime/serialization
allocations. New record sources or fanout require the sizing assessment again.

## Startup, freshness and provenance

Each actual Function restart creates a new run UUID, seq=1 LOGGER_START and empty
latest state with UNKNOWN TX/TUNE. History is not persisted. The first canonical
snapshot may provide an explicitly marked INTERLOCK_BASELINE from current canonical
context; it is not fabricated as a new wire observation. TX/RX uses the existing
normalized reducer and references its interlock source sequence with
DERIVED_FROM_INTERLOCK. Sequence is local arrival order, not radio causal order.

TUNE remains `transmit.payload.tune` candidate only. Track value, last-observed
value, last update, age, freshness and source. Configured monotonic timeout: 15 s,
conservatively allowing multiple observed approximately 5-s status refreshes.
There is no documented guaranteed heartbeat; timeout is explicit policy, not a
firmware promise. Expiry sets UNKNOWN and stale; startup/disconnect reset immediately.
Connection loss retains buffered history but clears current state, caches and
freshness. Reconnection requires post-epoch meter observations.

Physical trigger, intermediary, command sender and client identity stay separate.
Unavailable information remains UNKNOWN/null. DIRECT field observation does not
prove a physical origin. Existing Node-RED requests have DIRECT command origin,
unknown trigger. ACK correlation requires the same source/message identifier with
one unambiguous pending request; reused fanout identifiers do not prove a match.
No client handle, radio IP or temporal proximity is used to guess command origin.

## Internal access and Debug

The Function's dedicated context key is `au510mDiag`: run/version/seq, latestState,
latestHealth, tuneCandidate, connectionState, ringBuffer, metrics and adapter
runtime counters. A separate local `au510mDiagHandle` stores only lifecycle cleanup.
Read individual metrics through the existing authenticated/local Node-RED context
API, for example `/context/node/au510m_diag_stage1/au510mDiag.metrics`.
The sparse ring is encoded as an array wrapper by the context API; this is not an
additional runtime buffer. Avoid frequent full-context exports on a live system.

Metrics include logger/connection state, count, oldest age/span, max count,
age/count/memory evictions, events/health counts, truncation/overflow/errors,
sample rate, TX/RX, TUNE candidate/freshness, last event and process-memory deltas.
Only lifecycle/interlock/TXRX/TUNE/slice/error transitions reach the isolated
Debug output; health snapshots never reach it. Debug starts disabled.

## Acceptance and limits

- Full repository validation passes, including existing watcher/dashboard/meter
  tests, Vue compatibility, passive-contract and diagnostic adapter/core tests.
- Live RX: 0.984 Hz (126 samples; 108 within-state intervals). Live TX: 4.844 Hz
  (253 samples; 236 within-state intervals). Seventeen TX entries observed with
  tune candidate 0; all captured TX/RX transitions have source interlock records.
  Command/physical origin of these transmissions remains UNKNOWN.
- Live age test at uptime 290.887 s: oldest 239.875 s, 821 retained records,
  peak 903, age evictions 188, count/memory drops 0, diagnostic errors 0.
- Isolated 12000-record test: actual post-GC heap delta 7,284,888 bytes (6.95 MiB),
  RSS delta 34,435,072 bytes; conservative estimated records 39,360,960 bytes.
  Count overflow and exact age boundaries are also tested offline.
- At live age acceptance: whole-process heap delta −35,001,936 bytes (−33.38 MiB),
  RSS +19,484,672 bytes (+18.58 MiB). Heap fluctuated between approximately
  −66.4 and +106.6 MiB during observation including redeploy/GC/context exports;
  this is not attribution to diagnostic records. No monotonic ring growth past
  retention, overflow or memory eviction was observed. After the diagnostic restart,
  final heap delta was −9,498,928 bytes and RSS +479,232 bytes.
- Actual diagnosis-only Function redeploy proved new run/seq=1, UNKNOWN TX/TUNE,
  and fresh RX/active-slice repopulation. A tab-info-only deploy does not restart
  the Function in this runtime; lifecycle acceptance used an initialize-code
  checkpoint instead. No Node-RED service/radio restart was performed.
- Disconnect/reconnect handling, stale TUNE timeout and no stale TX are verified
  with the adapter/core tests; the live radio connection was deliberately not cut.
- Fresh tune=0 repeats live. A new controlled 0→1→0 TUNE cycle has not yet been
  observed in this acceptance run; candidate-cycle acceptance remains UNKNOWN.
  The previous measurement's successful cycle is historical evidence, not a
  substitute for this implementation's live test.
- RADIO/PA/AGC-T/METER backend delivery and fresh AU-510M state pass; existing
  templates are unchanged. Actual METER Vue logic with live RX payload gives
  both needles zero and no live RX SWR. Watcher status is fresh at v4.22.
  Browser visual rendering was unavailable and is not claimed as verified.
- New FlexRadio connections: NO. Duplicate subscriptions: NO. Deployment: PASS.

Stage 1 is RAM-only. No SQLite, incident detector, incident JSONL, full diagnostic
state machine or DIAG dashboard was implemented. Stop here. The next separately
authorized stage is DIAGNOSTIC STATE MACHINE.
