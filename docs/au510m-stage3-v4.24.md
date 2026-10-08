# AU-510M Stage 3 — v4.24 RAM incident detector

Old v4.23 / New v4.24. Runtime baseline d45410b; evidence baseline 54e12ac.
The user explicitly authorized finishing and deploying v4.24 after slice recovery.
Stage 2, original radio/parser/subscription/data paths and active-slice handling
remain unchanged. Live acceptance is recorded in the linked measurement below.

## Current status: stopped and rolled back

At 2026-10-07 18:11:51.904 Europe/Berlin the read-only deployment supervisor
observed canonical active slice disappearance and restored the exact saved v4.23
runtime through the standard deploy command (87 nodes, revision
4dbcd98127bec88e51bee713b6270417205d1b9da1dbaa8a80f054858506dc75).
This gate failure does not prove the deployment caused the slice disappearance.
Normal TX/TUNE acceptance had not passed. No commit or push was made.
The detector module below remains a draft; its live core/flow integration was
removed by rollback. Current runtime is v4.23, not v4.24.

A subsequent natural episode at 18:32:24.815–18:32:35.572 was secured under v4.23:
58 complete cycles / 10.757 seconds, 41 RX returns with fresh TUNE=1. Offline replay
with the unchanged v4.24 detector produces one incident, third-cycle trigger after
1616 ms, first abnormal TUNE_REACTIVATED_AFTER_RX seq 3542. No qualifying precursor
fault was observed in its ten-second lookback; reason and causal client UNKNOWN.
Slice removal seq 4569 occurred at 18:32:35.537, then reappeared at 18:33:26.661.
Current read-only checks show RX, TUNE=0 fresh, slice A / 7.032 MHz / CW and canonical
page data. Browser rendering remains unverified.

See [new incident report](au510m-natural-oscillation-2026-10-07-1832.md).
STOP FOR REVIEW. No further deployment, persistence or UI implementation.

## Existing input and cycle definition

`diagnostics/au510m-incident-detector.cjs` consumes Stage-1 records and Stage-2
DIAG_STATE_CHANGE records in sequence order. Source records reach the detector
before the existing reducer; nested state outputs therefore retain sequence order.
The detector has no radio access, parser, subscription, timer or file writer.
There is one existing 240-second / 12000-record forensic ring, unchanged.

A cycle starts on the first TUNE_REQUESTED, TX_REQUESTED or TRANSMITTING and must
actually reach TRANSMITTING, then UNKEY_REQUESTED and/or RETURN_TO_RX, and finally
RADIO_RX. Repeated requests, intermediate transitions, duplicate RX and cancelled
TUNE without transmission are not extra cycles. UNKNOWN/FAULT/BLOCKED or connection
changes discard incomplete candidates; no state is fabricated or inferred from power.

## Rule, TUNE evidence and deduplication

At least three complete start-to-RX spans must fit in an inclusive rolling five
seconds. Monotonic time controls this window, duration, quiet interval and POST
deadline. Additionally, fresh TUNE=1 must occur at a completed RX return, or a
fresh direct 0→1 TUNE_CANDIDATE must occur after an RX return and before the next
cycle, with both cycles inside the window. UNKNOWN→1 or activation during TX is
not proven RX reactivation. Rapid unrelated PTT alone never qualifies.

Each candidate preserves tune value/freshness at start and RX return, actual TX
sequence, reactivation evidence/sequence, preceding cycle, and exact start/end
records. Active TUNE during RX, off before RX, reactivation and UNKNOWN remain
distinct. First abnormal event is the earliest evidence-supported
RX_RETURN_WHILE_TUNE_ACTIVE or TUNE_REACTIVATED_AFTER_RX inside the incident.

One burst produces one active incident and one compact trigger-only Debug message.
Additional qualifying cycles update count, duration, last sequence and TUNE metadata.
Oscillation becomes QUIET after five seconds without a qualifying cycle; deduplication
continues through the active POST lifecycle. Exactly one active and one last incident
are retained. Candidate and incident cycle metadata lists each have a hard cap of
256, with explicit overflow counters. There is no second forensic buffer.

## Precursor search: bounded 10-second ring lookback

Default precursorLookbackMs=10000; configurable bounds are >0 and <=240000 ms.
The value is exposed as incidentDetector.config.precursor_lookback_ms. At a new
incident trigger, a generator traverses only the existing ring's latest lookback
interval, in reverse order, without copying history. A second bounded traversal
retrieves clearance and reason for the chosen fault. No scan runs per normal
input or per additional cycle. Maximum traversal is bounded by the existing
12000-record cap and monotonic slot age; wall age is also checked conservatively.

Only direct INTERLOCK_STATE TX_FAULT/TIMEOUT/STUCK_INPUT records before the first
incident cycle qualify. Explicit DERIVED/UNKNOWN/confidence or an unrecognized
source cannot be promoted. The compact historical fixture omitted
observation_confidence; its exact au510m_live_state/state/INTERLOCK_STATE source
contract is verified as direct in unchanged Stage 1. Raw-source availability is
recorded; no missing TCP packet is reconstructed. Connection epochs bound the search.

Incident fields include precursor_fault, ts, seq, age_ms, source, reason, confidence,
clearance and active_at_trigger, plus lookback and explicit context_not_causality.
Missing evidence remains UNKNOWN/null. Precursor is frozen at trigger and remains
separate from first_abnormal_event. A fault outside ten seconds is excluded even
if still present in the 240-second ring. No fault incident type or causal detector
is added. last_precursor_fault exposes the last incident's selected precursor.

## Incident context, snapshot, provenance and Debug

IDs combine the existing run UUID and a local counter. Trigger_seq is the actual
third completed qualifying RADIO_RX record. Frequency/mode/slice, first/last cycle,
duration, TUNE context and first abnormal evidence accompany the incident.

One compact snapshot copies the latest existing Health observation, its sequence,
all eleven canonical topic keys, values, seen timestamps, units and quality, plus
current state context. Health quality is that of the referenced Health observation,
not a fabricated new measurement at trigger. Missing values remain null/UNKNOWN.
No historical Health series is duplicated and no polling or conversion is added.

Trigger/command/client origin remains UNKNOWN/null without an explicit proven
link. Client presence, Interlock source labels and time proximity never prove
causality. A DIRECT precursor proves only the radio-reported fault state.

One active Debug output receives AU510M INCIDENT with type, count, duration,
frequency/mode, TUNE active/reactivated, precursor/age, first abnormal event and
UNKNOWN origin/confidence. Original optional lifecycle Debug stays separate.
No continuous detector Debug is emitted.

Metrics: incident_detector_status, candidate_cycle_count, active_incident_id,
total_incidents, last_incident_ts/type/cycles and last_precursor_fault. Overflow,
rejection and order counters remain inside the existing diagnostic namespace.

## PRE reference and POST RAM lifecycle

At trigger preserve [trigger−120 s, trigger] reference boundaries and available
seconds. PRE complete requires 120 seconds by wall and monotonic boundary coverage,
with no known count/memory/source/error gaps. Cumulative gap counters deliberately
make completeness conservative. Normal age eviction outside the interval is separate.
No PRE records are copied or pinned.

POST becomes COLLECTING, then COMPLETE at the first existing input at or after
original trigger +120 seconds, normally within one RX Health interval. The explicitly
requested original-trigger deadline is not extended by retriggers in this stage;
it overrides the earlier general persistence plan. Quiet and collecting are distinct.
Disconnect/reconnect, logger shutdown/redeploy or source order violation before
completion marks INCOMPLETE and post_trigger_complete=false. Restart discards RAM.

Completion means RAM lifecycle elapsed, not a lossless exported archive. Incident
post_semantics says RAM_LIFECYCLE_ONLY_HISTORY_NOT_PINNED; references can age out and
ring drop/coverage metrics stay authoritative. There is no filesystem incident writer.

## Natural replay and validation

[Immutable natural evidence](measurements/au510m-natural-oscillation-2026-10-07.json)
SHA-256 remains 6f35714df7e0ae2f4a1895664a6bf4a38dea5bcf6720fe36470a8951b23a3dde.
`scripts/replay-au510m-natural-incident.mjs` opens this manifest and its linked actual
fixture and verifies SHA before/after, input immutability and expected evidence.
Result: one TUNE_RX_OSCILLATION; third qualifying cycle triggers at seq 18264 in
792 ms; total 38 cycles in 10.117 s. Precursor TX_FAULT, seq 18185, DIRECT, reason
UNKNOWN, age 5993 ms; cleared seq 18202. First abnormal remains
RX_RETURN_WHILE_TUNE_ACTIVE, seq 18227. Causal client UNKNOWN.

Replay uses recorded nondecreasing wall timestamps because original monotonic slot
times were not captured. Historical Health values and a full 120-second POST window
were not captured and are not retroactively invented. This is offline replay,
not a live v4.24 incident. The original evidence and earlier slice analysis are immutable.

All original 27 deterministic cases are retained, plus outside-ten-second,
configurable/bounded lookback and explicit-derived-source exclusion: 30 PASS.
Coverage includes normal RX/TX/TUNE, unrelated PTT, both TUNE patterns, cancellation,
stale/unknown, disconnect/restart, deduplication, PRE gaps, missing Health, original
POST deadline, exact five-second boundary, bounded stress and actual natural replay.
Full repository checks also protect original nodes, UI compatibility, versions,
Stage-1 rates/buffer and unchanged Stage-2 behavior.

[Current deployment/live/performance evidence](measurements/au510m-stage3-v4.24-validation.json)
distinguishes offline and live checks. Stable RX, normal TX and normal safe TUNE
must not trigger. No oscillation is deliberately induced. Existing RADIO/PA/AGC-T/
METER payloads, actual RX Vue projection and active slice are checked; visual browser
rendering is unverified on this host.

## Limits and scope

The known READY↔RECEIVE diagnostic UNKNOWN linkage gap remains unchanged. It clears
candidate cycles conservatively when evidence is insufficient; it does not create a
false incident. It is not repaired as part of Stage 3. New incomplete spans cannot be
reconstructed without evidence. No origin attribution or lossless-history claim.

An earlier deployment attempt during radio unavailability was rolled back to v4.23.
The slice later recovered without diagnostic intervention; this deployment is now
explicitly authorized after that recovery. See the separate historical slice report.

SQLite: NOT IMPLEMENTED. Incident JSONL/CSV files: NOT IMPLEMENTED.
DIAG dashboard UI: NOT IMPLEMENTED. Next stage: STOP FOR REVIEW.
