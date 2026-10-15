# Flex command forensics and safe logging — v4.34

## Scope and baseline

Old v4.33, New v4.34. Initial HEAD: `aec46cc82c7483d4d7ca6d5e384a54965964daf1`.
The initial working tree contained existing PA-health classification, DIAG gauge/layout,
sanitization/export and measurement changes. The user explicitly authorized finishing
that existing work together with command logging. The original on-disk flow nodes
matched GET /flows before this change. This is an observer change, not a new page or
new live-data pipeline. RADIO/PA/METER producers, subscriptions, TUNE controls,
reconnect logic, incident detector and PA thresholds are unchanged by this task.
Numeric PA-health rules remain disabled as in the supplied working state.

## Producer map

Eight logical command producers: five flow paths (four active, one disabled), plus
three library startup paths. There are five Flex request terminals, four active.
All use the existing owner `7fbf2bfc9badc7d3`. No second connection is introduced.
Cadences below describe code conditions, not promises about successful transmission.

| Producer / node ID | Terminal / module | Purpose and trigger | Cadence / commands | Active deployed baseline |
|---|---|---|---|---|
| manual Inject `aed8c933591fa103` | Request `cb517e1d426fa203` | manual inventory experiment | manual only; `meter list` | NO: tab `276c40932e135fc4` disabled |
| manual Inject `6ac62913256d631c` | Request `1938f24ff5eccb7f` | manual meter inventory | manual only; `meter list` | YES; no automatic Inject |
| Function `2702052aa13cacd0`, “35-meter inventory, subscriptions and display snapshots” | Request `185977e7709d7d4d` | clock `aaab92d1a9534d53`, existing inventory and ACK messages | 1 s evaluation; `meter list` initially / 60 s after success / 15 s unavailable retry; queued `sub meter <id>` after discovery / timeout | YES |
| Function `au510m_live_state`, “state” | Request `au510m_live_request` | clock `au510m_live_tick`, decoded status/connection, ACKs | `sub slice all`, `sub tx all` when missing; failed subscriptions retry after 15 s; successful subscriptions are not 5 s polling | YES |
| Function `5c67eccefec66e09`, “Watcher + separated configuration”; guard `a2e5d60332cdb49a` | Request `07c61c6741eb8fad` | clock `41838b67edd44f75`; watcher UI HTTP controls via `e7fad9b7ada1fd50`; manual auto/calibrate Injects `299efe7bbf8ca636`, `eb4f166622744515`, `6b2adfc046f7bc82`; existing status/meter/ACK inputs | 5 s pair `sub tx all` + `sub radio all`; 60 s group `sub client all`, `sub slice all`, `sub tx all`, `sub pan all`, `meter list`; inventory ACK can add numeric meter subscriptions; guarded RX AGC scan/restoration writes `slice s <index> agc_threshold=<0..100>`, ACK-driven slice readback, restoration queries at ≥1 s | YES; baseline auto=false and ERROR, fresh meter input still present |
| `Radio._connectToRadio`, no separate flow node ID | `node_modules/flexradio-js/Radio.js` | existing TCP setup, including reconnect | once per setup: `client set enforce_network_mtu=1`, `client set send_reduced_bw_dax=0` | YES when connected/reconnecting |
| `Radio._getMeterList`, no separate flow node ID | same module | existing setup inventory | once per setup: `meter list` | YES on setup |
| `Radio._startRealtimeListener`, no separate flow node ID | same module | existing UDP listening callback during setup | once per setup: `client udpport <runtime port>` | YES on setup |

`flexradio-request` calls `flexradio-radio.send(msg, callback)`. That bridge expands
named `sub meter <topic>` expressions into existing numeric subscriptions and fans
out arrays before calling `Radio.send` / `_sendRequest`. Current production
Functions emit numeric subscriptions. There is no active named MAINFAN Inject in
the current 99-node deployment; MAINFAN belongs to the existing inventory consumer.
The installed request node's own 5000 ms status timer reads `connectionState()`
only: it sends no Flex commands. Meter/message/stream nodes receive existing data.
The other radio config `de18e07b81aedd38` has no active consumers.

PA health, METER projection, DIAG LIVE/HISTORY/TREND, incident capture, SQLite and
EXPORT do not produce radio commands. UI refresh consumes existing data. The
watcher UI controls can initiate its guarded AGC scan, not TUNE. The disabled
RFPOWER flow uses FRStack HTTP and is not a Flex-client producer. Repository
preparation/replay/test scripts are offline tooling; no active Function loads a
second radio-command script. The production diagnostics module does not call a
radio command API to create traffic.

## Historical evidence and timing

Original: `data/exports/AU510M-20261014-084537-TUNE_RX_OSCILLATION-e1b76a640dbcd841ead02fb6df13ef28.zip`.
SHA-256 before/after:
`c4fc6798745da4349b1a7bf22e20886e761edcc08f3a9ddcf39edf400ca48238`.

79 cycles, 17289.124433 ms, 14.074 MHz, DIGU, slice A. PRE/POST complete,
zero reported dropped records. Precursor fault is null (no recorded precursor),
not proof that no physical fault occurred. First abnormal event:
TUNE_REACTIVATED_AFTER_RX, seq 5858 at **08:45:37.425 UTC**. Detector trigger:
seq 5880 at **08:45:37.444 UTC**, 19 ms later. TUNE fields are the existing
candidate observations; this task does not promote them to canonical TUNE state.

There are 130 COMMAND_REQUEST records and 128 ACK_RESPONSE records, all 128 with
status 0. Only four ACKs in the whole archive have `derived_from_seq`; 124 cannot
be linked exactly. The critical ±5 s window has four requests and four unlinked
ACKs, both when anchored on the first abnormal event and on detector time.
No historical request preserves command text, protocol sequence or producer ID.
All historical identities remain **UNKNOWN_COMMAND**.

Pairs at approximately 5 s match the watcher's two-subscription branch in code.
The nearby burst starts with seq 5697 at 08:45:31.786, then seven requests starting
08:45:32.043 (seqs 5701–5705 and 5711–5712). This is consistent with separate
60 s inventory plus watcher inventory/subscription fanout; its identities cannot
be proven. That seven-request group is 5382 ms before first abnormal, just outside
the requested ±5 s window. Similar groups recur near 08:44:31 and 08:46:32.
Other possible burst sources are inventory recovery, subscription retries,
watcher AGC readback/restoration, and library reconnect/setup. A reconnect is a
candidate code path, not established historical evidence. PA health/METER/DIAG
refresh are not command-producer candidates.

Compact chronological excerpt (2026-10-14 UTC; complete ordered tables contain
400 rows each):

| Time | Seq | Observation | Command identity / exact link |
|---|---|---|---|
| 08:45:33.048 | 5725, 5726 | two COMMAND_REQUEST; TX / TRANSMITTING, candidate tune=1 | UNKNOWN_COMMAND |
| 08:45:33.404, .406 | 5732, 5733 | successful ACKs, status=0 | request UNKNOWN; proximity is not linkage |
| 08:45:37.423 | 5855 | candidate TUNE 0, READY / RX | no command attribution |
| 08:45:37.425 | 5858 | candidate TUNE 1, READY / RX; first abnormal | no command attribution |
| 08:45:37.433 | 5860 | candidate TUNE 0 | no command attribution |
| 08:45:37.437 | 5863, 5865 | Interlock PTT_REQUESTED; source field TUNE | does not identify command sender / trigger |
| 08:45:37.439 | 5867 | Interlock TRANSMITTING | DIRECT interlock observation |
| 08:45:37.440 | 5869 | TX | DERIVED_FROM_INTERLOCK, seq 5867 |
| 08:45:37.441 | 5871 | Interlock UNKEY_REQUESTED | DIRECT interlock observation |
| 08:45:37.443 | 5876 | Interlock READY | DIRECT interlock observation |
| 08:45:37.444 | 5878; trigger 5880 | RX; detector trigger | RX derived from seq 5876 |
| 08:45:39.047, .048 | 6016, 6017 | two COMMAND_REQUEST | UNKNOWN_COMMAND |
| 08:45:39.231, .232 | 6109, 6110 | successful ACKs | request UNKNOWN |

Machine-readable results:
[summary](measurements/au510m-command-forensics-2026-10-14/summary.json),
[first-abnormal ±5 s](measurements/au510m-command-forensics-2026-10-14/first-abnormal.csv),
[detector-trigger ±5 s](measurements/au510m-command-forensics-2026-10-14/detector-trigger.csv).
`request_seq` in those tables is populated for ACK linkage only; the separate
`derived_from_seq` column preserves Interlock/TX-RX derivation without conflating it
with a request link. Run `scripts/analyze-au510m-command-incident.mjs` to reproduce.
Neither frequency nor timing establishes command causality or a human trigger.

## Before / after and exact origin semantics

BEFORE: `command_origin=NODE_RED` was assigned by `DiagnosticBuffer.request` when
an onReceive hook observed a message destined for one of five fixed request-node
IDs. This proved a **local input to that Node-RED request node**, including a
potential rejected/not-connected request; it was not observation of arbitrary
traffic on a Node-RED-owned socket. It did not identify a human/UI trigger,
external client, actual written command, or all internal library setup traffic.
The RAM record retained payload and sometimes `_msgid`; the persistence sanitizer
lost lowercase command content and export omitted both command identity and source.

AFTER: COMMAND_REQUEST observes the existing `_sendRequest` invocation immediately
before original protocol encoding/write. It is a **send attempt**, not an ACK or
proof that a radio accepted or applied a command. NODE_RED means this existing
local Flex-client API path was invoked. It never attributes an external client's
commands or identifies who caused a resulting TUNE/Interlock change.

A passive `preDeliver` hook captures the immediate producer's node ID by direct
message-object identity after Node-RED's routing clone. The receive hook can fall
back to the directly observed Request endpoint. Metadata stays in a WeakMap,
never in the original message or its radio payload. For watcher commands the
immediate producer is the guard, not an invented human initiator or inferred
upstream UI. For direct library calls, node ID/name are UNKNOWN and the observed
module is `flexradio-js/Radio.js`. Unknown/unlisted source IDs remain UNKNOWN.
The source catalogue contains only reviewed production nodes and fixed names.
This is direct immediate-producer attribution, not a full trigger/intermediary trace.

The observer delegates each original call once, preserving argument, callback,
return, ordering and original exceptions. It adds no commands, timers, polling,
subscriptions or retries. It restores methods/listeners on close. A library
instance absent when the observer starts is attached on its first existing bridge
send or connected event; earliest bootstrap requests before attachment are not
reconstructed. Already attached, reused clients cover future reconnect setup.
Observation is bounded by that lifecycle and its error/overflow metrics.

ACKs use the existing protocol callback closure AND exact `sequence_number`, not
nearest time or `_msgid`. `command_seq` is the existing outbound protocol number;
`ack_seq` is the reply protocol number; `request_seq` is the diagnostic request
record's seq within this logger run. `derived_from_seq` duplicates that proven
request link on ACKs only. `ack_latency_ms` uses a monotonic clock. Pending entries
remain bounded at 256 and expire after 30 s as before; reconnect clears them;
late/mismatched/overflowed replies remain unlinked. ACK status 0 means successful
protocol response, not causality or successful resulting TX/TUNE state.

## Safe schema and persistence

One closed policy in `diagnostics/au510m-command-policy.cjs` defines
`command_family`, `command_name`, `command_args_safe` (JSON text),
`command_text_safe`, node ID/name/module, `command_seq`, `request_seq`, `ack_seq`,
`ack_status`, and `ack_latency_ms`. Values survive EVENT lane, bounded RAM ring,
incident Capture, SQLite state_events, legacy incident JSONL and ZIP events.jsonl.
The existing table gains nullable columns; no historical row is backfilled or
rewritten. Existing incident/health tables, detector and PRE/POST rules are unchanged.

Only exact reviewed strings and numeric forms survive: current meter inventory,
numeric subscriptions, explicit subscription targets with `all`, guarded AGC
threshold writes, two known bootstrap booleans. The exact `transmit tune [01]`
form is supported for diagnostic identity/testing only; no such command is created
or added. This does not claim every other Flex tune syntax is recognized.
`client udpport <port>` retains identity only and drops the runtime port.
Unknown profile/info/interlock/client arguments retain at most a fixed family and
UNKNOWN_COMMAND; no arbitrary name, free-form argument or raw line is retained.
Control characters/multiline/oversized/non-string input is omitted. No passwords,
auth, sessions, client handles, raw ACK payloads or `_msgid` are logged by this path.
The sanitizer and exporter independently reapply the same policy, including
COMMAND_REQUEST event_value. No command-family frequency is presented as causality.

## Validation

Deterministic A–H tests cover allowlisting/redaction, direct/unknown source,
shared-message arrays and out-of-order ACKs, epoch/mismatch rejection, observer
failure isolation and cleanup, actual installed Flex encoder with an in-memory
socket, incident Capture, SQLite/JSONL/ZIP persistence, and additive old-table
migration without modifying original rows. No hardware is contacted by these tests.
The entire repository suite also validates all Function bodies/Vue components,
including the Dashboard 1.30.2 single-export-default compatibility rule, canonical
paths, incident semantics, PA-health disabled gate, history, trends and exports.

Live validation results, deployment revision and measured efficiency are recorded
below after execution. RX only; no test-induced TX/TUNE or oscillation.

## Executed acceptance and review status

- Full `bash scripts/validate-repository.sh`: PASS, including command A–H,
  watcher/dashboard, canonical METER, PA health, incident persistence/history,
  export/trend, real worker, reconnect and Vue compatibility checks. One documented
  historical Stage-3 test draft remains intentionally skipped by the existing suite;
  active detector/persistence behavior is covered by its current tests.
- Automatic deployment: PASS, 99 nodes, revision
  `09053e0fd114e9f7afae49d33fbaf8fb6cc2500a98bcc0f515b05bb915626c6f`.
- Live RX: CONNECTED, slice A, logger RUNNING, SQLite READY; zero observer errors,
  logger errors, SQLite drops or active captures. All five existing UI consumers
  received messages after deployment. Dashboard HTTP 200. RADIO/PA/METER/DIAG
  data paths PASS. Watcher v4.34, RX, IDLE, fresh LEVEL/AGC on recheck.
  Browser/kiosk rendering was not checked: no browser is available on this host.
- Steady 60 s before/after counts are identical: **32 requests**, comprising
  `sub tx all` 13, `sub radio all` 12, `meter list` 2, and one each of
  `sub client all`, `sub slice all`, `sub pan all`, `sub meter 19`, `sub meter 20`.
  The extra tx subscription is the existing minute inventory. No duplicate
  protocol sequences; all **32/32** after ACKs have exact request/protocol links.
  Deployment startup requests were observed separately and are not claimed to be
  absent. No new radio traffic/cadence or subscriptions were introduced.
- A normal external band/frequency change was observed during validation. LEVEL
  briefly became unavailable, then recovered with fresh health and slice data;
  no command was sent to provoke it. Neither TX/TUNE nor oscillation was induced.
- Safe logging/source attribution/ACK linkage/incident persistence/ZIP export:
  PASS within the documented lifecycle and source scope. Unsafe data leakage:
  NO in deterministic adversarial tests and the allowlisted live command sample.
  Historical command identity UNKNOWN; original ZIP hash unchanged, no evidence
  row backfill. No claim of causal attribution is made.
- Existing PA-health/DIAG work was included with the user's explicit authorization;
  the numerical classification activation gate remains disabled. Generated
  `.codegraph/` stays local via Git's local exclude; RTK.md is included as the
  project-referenced tooling instructions.

Recorded validation artifacts:
[live before](measurements/au510m-command-forensics-2026-10-14/live-before.json),
[live after](measurements/au510m-command-forensics-2026-10-14/live-after.json),
[freshness recheck](measurements/au510m-command-forensics-2026-10-14/freshness-recheck.json),
[efficiency](measurements/au510m-command-forensics-2026-10-14/efficiency.json).

RTK measurement from `rtk gain --project --format json`: cumulative project scope,
173 commands; input 228260 tokens; output 188967 tokens; saved 39312 tokens,
17.2225%. These are RTK compression estimates, **not API billing**; the displayed
aggregate counters are reported as measured, not recomputed. CodeGraph: 7 queries,
covering producer/core/runtime, persistence/export/history, canonical interlock/
TUNE/PA-health, new observer integration and final impact. CodeGraph token savings
are unavailable and were not estimated.

Next: **STOP FOR REVIEW**. Commit/push identity is reported by the completion message.
