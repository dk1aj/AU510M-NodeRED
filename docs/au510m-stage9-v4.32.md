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
5. Stage E: normal RX/TX/TUNE baseline measurement and review only.
6. Stage F: explicitly approved candidate-rule review/activation.
7. Stage G: final regression and acceptance.

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
PA health OK: until later approved numeric rules are connected it remains UNKNOWN with
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

## Candidate numeric draft — inactive, baseline approval pending

The earlier draft claims a controlled passive observation on 9 October 2026 retained 271 RX, 19 TX
and 10 TUNE samples. A matching retained baseline artifact and approval have not been established by the forensic audit; these draft ranges are not approved baseline evidence. The draft reports connection stayed CONNECTED with Slice A, SQLite READY,
no active capture and no incident. Observed ranges were:

| Context | Observed values |
| --- | --- |
| RX | PA 23.89–23.98 °C; FET1/FET2 25 °C; current 0–0.14 A; supplies 11.99–12.04 / 12.32–12.44 V; fan 988–996 RPM |
| TX | forward 85.90–436.52 W; reflected 0.53–2.31 W; SWR 1.00–1.20; current 0.13–3.82 A; efficiency 0–80% |
| TUNE | forward 5.56–20.14 W; reflected 0.36–9.25 W; SWR 1.32–9.04; current 0.30–1.94 A; efficiency 57–74% |

The high TUNE SWR observations occurred below 25 W. SWR and efficiency rules
therefore require a fresh canonical TX sample with at least 25 W forward power.
This gate is part of the project diagnostic policy; it is not a radio or
manufacturer limit.

All numeric rules below are **CANDIDATE PROJECT_WARNING_THRESHOLD** values. Baseline approval is **PENDING** and numeric activation is **DISABLED**. They are
conservative project choices based on the controlled normal observation and
are not presented as manufacturer limits:

| Reason | Enter | Clear |
| --- | ---: | ---: |
| PA_TEMP_HIGH | PA temperature ≥ 75 °C | ≤ 70 °C |
| FET_TEMP_HIGH | either FET temperature ≥ 75 °C | both ≤ 70 °C |
| FET_IMBALANCE | absolute FET delta ≥ 15 °C | ≤ 10 °C |
| SWR_HIGH | SWR ≥ 2.0 at forward power ≥ 25 W | SWR ≤ 1.8 or below the power gate |
| SUPPLY_LOW | either supply ≤ 11.5 V | both ≥ 11.8 V |
| SUPPLY_IMBALANCE | absolute supply delta ≥ 1.0 V | ≤ 0.7 V |
| PA_CURRENT_HIGH | PA current ≥ 20 A | ≤ 18 A |
| PA_EFFICIENCY_LOW | efficiency ≤ 40% at forward power ≥ 25 W | ≥ 45% or below the power gate |

Each numeric reason must remain beyond its enter threshold for 2 seconds. A
latched numeric reason must remain beyond its clear threshold for 3 seconds
before recovery. On startup or after unavailable data, the minimum fresh input
set must remain complete for 3 seconds before PA HEALTH becomes OK. RX requires
fresh PA/FET temperatures, PA current, efficiency, both supplies and MAINFAN.
TX additionally requires fresh canonical FWDPWR, REFPWR and SWR from the
current TX interval. Missing, stale, invalid or disconnected input yields
UNKNOWN. MAINFAN remains part of the freshness set and visible evidence, but no
fan anomaly is asserted because zero/RPM operating semantics are unproven.

Priority is direct PA fault, PA temperature, FET temperature, FET imbalance,
SWR, low supply, supply imbalance, high PA current, then low efficiency. The original candidate draft independently checked
`TX_FAULT`, `TIMEOUT` and `STUCK_INPUT`. D2 supersedes that competing fault
check with the freshness/latching-gated canonical PA_FAULT reducer. A fresh
canonical FAULT bypasses numeric debounce and produces CRITICAL / PA FAULT. Numeric reasons produce
WARNING. Multiple active reasons remain in the bounded reason list; the card
shows the first reason and `+N` for the remainder.

The classifier consumes only the existing canonical HEALTH and Interlock
evidence. It emits a compact `PA_HEALTH_CHANGE` record into the existing RAM
EVENT lane only when state or active reasons change. The record contains old
and new state, primary/active reasons, bounded observed values, threshold
provenance, state confidence and the source HEALTH sequence. Existing incident
capture may retain a sanitized event when it falls inside an already active
window. PA HEALTH does not open an incident, create a table, or continuously
write health history to SQLite. It sends no radio, PA, TUNE or protection
command. Trend warning markers were omitted in v4.32 because the compact LIVE
card and EVENT record satisfy the requested observation path without widening
the accepted TREND component.

## Stage D2 — safe PA HEALTH hold

The salvage decision retains one classifier and all candidate threshold values,
but the single authoritative `PA_HEALTH_CONFIG.numericRulesEnabled` gate in
`diagnostics/au510m-pa-health.cjs` defaults to false. Numeric activation is
DISABLED; baseline approval is PENDING. Normal fresh RX/TX displays gray
`UNKNOWN / NUMERIC RULES PENDING / DERIVED`; no simulation is present. TUNE
is not a classifier input and remains subject to the existing canonical TX/RX
context; a candidate TUNE observation does not prove actual radio TUNE state.
No Stage E measurement or Stage F activation is authorized by this hold.

PA HEALTH consumes the existing METER `paFaultStatus()` reducer through one
shared evaluator, unchanged. It is the authority for freshness and fault
latching; raw cached Interlock states no longer independently force CRITICAL.
Only a current canonical FAULT under valid connection/freshness gates can
produce CRITICAL / PA FAULT. Unknown or stale fault evidence produces UNKNOWN.
Classification confidence is DERIVED; fault-source evidence is separately
DIRECT. The bounded vocabulary is DIRECT / DERIVED / UNKNOWN, independent
of command-origin confidence.

Any future OK requires numeric activation approval, connected canonical radio
and fresh canonical PA_FAULT READY, known RX/TX context, the full required
fresh HEALTH set (plus current-TX-interval power/SWR during TX), the documented
warmup, and no active warning. UNKNOWN TX/RX cannot yield OK.

PA_HEALTH_CHANGE retains bounded active reasons, allowlisted numeric observed
values, candidate threshold provenance/status, immediate flag, source evidence
confidence and source/derivation sequence references. SQLite uses its existing
TEXT event_value column for a JSON evidence envelope; no schema change is made.
Incident capture, legacy JSONL and ZIP export preserve the safe envelope. ZIP
events also retain source_event_seq and derived_from_seq. Session/runtime
identifiers, paths, client addresses and arbitrary fields are excluded.
Existing incident triggers, HISTORY and HEALTH-only TREND are unchanged.

D2 remains within the explicitly requested v4.32 staging work: Old v4.31 / New
v4.32. AGC-T remains ignored by user instruction. Commit/push and Stage E are
held for review. Offline, CodeGraph, deployment/live and kiosk validation
results are recorded below after validation; historical stage acceptances
above do not imply current D2 acceptance.

### D2 validation — 12 October 2026

- Deterministic D2 tests: PASS for disabled RX/TX/extreme numeric inputs, fresh
  and transition-latched canonical fault, stale fault, UNKNOWN context,
  disconnect/reconnect, confidence and bounded SQLite/export evidence.
- Full repository validation: PASS, including Function/Vue compatibility,
  canonical meters, radio-state paths, incident persistence, HISTORY, TREND
  and EXPORT. Whitespace and required JSON/plugin syntax checks: PASS.
- CodeGraph MCP post-change verification: one PaHealthClassifier definition
  and one production instance; shared createFaultEvaluator reaches the
  unchanged canonical METER reducer, runtime/core and LIVE. PA_HEALTH_CHANGE
  reaches the existing EVENT/ring/capture path and safe export projection.
  No new connection, subscription, meter parser or numeric classifier.
- Flow scope: only two initialization fields changed relative to the saved
  pre-D2 working tree. All Vue formats, node IDs and wiring are unchanged.
- Deployment: PASS, 99 nodes, revision
  `188c2eed7de6f1c4715bffed0464e39256821ee2d07de31f779d6a9b473bbf55`.
  Runtime/source flow equality: PASS.
- Agent passive RX validation: CONNECTED, Slice A, RADIO_RX, canonical
  PA_FAULT READY, PA HEALTH UNKNOWN / NUMERIC RULES PENDING / DERIVED,
  eight valid RX health values and all eleven TREND series. HISTORY returned
  HTTP 200 / READY with no incidents. SQLite READY, queue/drop/error counts
  zero, no active capture and zero incidents. Twenty passive status reads
  over 11.443 seconds showed no warning; RADIO/METER each received 117
  updates, PA received 11 and DIAG received 33. No baseline values collected.
- Physical 800x480 and normal-operation acceptance: PASS, explicitly confirmed
  by the user after deployment. Gray UNKNOWN / NUMERIC RULES PENDING · DERIVED,
  no SIMULATION/clipping/overlap/scrollbar; RADIO/PA/METER and LIVE/HISTORY/TREND
  work; no PA HEALTH warning in normal TX/TUNE. These TX/TUNE checks are user
  observations, not an agent telemetry validation of canonical TUNE state.
- AGC-T: IGNORED BY USER INSTRUCTION. Baseline approval: PENDING. Numeric
  activation: DISABLED. Old v4.31 / New v4.32 retained by explicit instruction.
  No commit/push. STOP FOR REVIEW BEFORE STAGE E.

## Stage E — retained baseline observation, review pending

The user explicitly approved passive Stage E measurement after accepting D2.
The first readiness check found no canonical active slice, frequency or mode,
so capture did not start. No runtime instrumentation or deployment was added.
After Slice A returned, a planned three-minute read-only capture ran from
11:40:32 to 11:43:35 UTC on 12 October 2026 (actual duration approximately
183 seconds). Existing retained ring records were also recovered separately;
they are pre-capture evidence, not newly observed operation.

Retained evidence and checksums are in
[the baseline summary](measurements/au510m-pa-health-stage-e-2026-10-12-summary.json),
with separate capture and pre-window files. Records preserve source run,
sequence, timestamps, canonical quality gates and derivation references.
The context API previews only 1,000 array slots, so individual retained slots
were read to avoid treating that preview as a complete ring. No Flex connection,
subscription, parser, conversion, runtime configuration or threshold changed.

The deduplicated observation spans 11:37:06.296–11:43:34.549 UTC: 909 canonical
EVENT/HEALTH records, including 421 HEALTH samples (370 RX, 51 TX). There are
no sequence gaps, missing recovered slots or capture errors. Only FRESH meter
values contribute to these ranges; one initial TX power/SWR sample was excluded
as PREVIOUS_TX_INTERVAL. RX power/SWR values remain excluded by their canonical
RX gate.

| Measurement | RX fresh range | TX fresh range |
| --- | --- | --- |
| PA temperature | 23.47–23.98 °C | 23.91–23.98 °C |
| FET1 / FET2 temperature | 25 / 25 °C | 25 / 25 °C |
| PA current | 0–1.09 A | 0–1.17 A |
| Supply A / B | 11.98–12.02 / 12.07–12.42 V | 11.98–12.02 / 12.07–12.37 V |
| MAINFAN | 988–992 RPM | 988 RPM |
| Forward / reflected power | not a TX measurement | 3.71–14.03 / 0.20–3.16 W |
| Canonical radio SWR | not a TX measurement | 1.00–6.42 |
| PA efficiency | 0% | 0–80% |

All 51 TX HEALTH samples coincide with fresh TUNE-candidate=1. Candidate
on/off pairs were retained at 11:40:12.013/11:40:21.062 and
11:40:48.809/11:40:50.262 UTC. The user reported “tune,” but supplied no exact
operation timestamp; individual record linkage is not established. These are
DIRECT candidate observations, not confirmed canonical radio TUNE. Canonical
TUNE remains UNKNOWN. Ordinary TX with fresh TUNE-candidate=0 was not captured.

No eligible sample crossed the six temperature/current/supply candidate entry
values. SWR_HIGH and PA_EFFICIENCY_LOW had zero eligible samples because all
fresh TX forward power was below the existing 25 W gate. These offline entry
comparisons neither activate rules nor simulate debounce/latching, and cannot
approve thresholds. Short observation coverage does not establish thermal,
load or environmental operating limits; normal non-TUNE TX coverage remains
pending. None of the candidates is a manufacturer limit.

Across all 36 capture status reads: CONNECTED with active Slice A, PA HEALTH
UNKNOWN / NUMERIC RULES PENDING / DERIVED, SQLite READY, zero logger errors,
incidents, count/memory drops and source overflow. This is sampled status
evidence, not proof that an unobserved transient never occurred.

Stage E observation: retained, coverage incomplete. Baseline approval: PENDING.
Numeric activation: DISABLED. Stage F: not started. Old v4.31 / New v4.32;
no runtime change, deployment, commit or push. Stop for baseline review.

### Stage E additional ordinary TX observation

The user explicitly approved a second passive capture for usual non-TUNE TX.
It ran 11:46:49.175–11:49:52.311 UTC on 12 October 2026 without runtime
changes. The separate
[TX summary](measurements/au510m-pa-health-stage-e-2026-10-12-tx-summary.json)
records the capture checksum and source-run/sequence evidence; the original
observation files remain unchanged. The interval between the two captures was
not observed and is not claimed as continuous coverage.

The second window retains 477 canonical records, sequences 3699–4175, with
218 HEALTH samples: 166 RX and 52 TX. All 52 TX samples have fresh
TUNE-candidate=0. Canonical TX/RX remains derived from Interlock, independent
of RF power. Canonical TUNE remains UNKNOWN; candidate=0 does not independently
prove actual radio TUNE state. There are no sequence gaps or capture errors.
Two initial TX power/SWR samples were excluded by canonical quality gates;
the remaining 50 fresh TX samples give these ranges:

| Measurement | Additional TX fresh range |
| --- | --- |
| Forward / reflected power | 0.00652–0.83176 / 0.00251–0.01109 W |
| Canonical radio SWR | 1.00 |
| PA / FET1 / FET2 temperature | 23.98 / 25 / 25 °C |
| PA current / efficiency | 0–0.11 A / 0–1% |
| Supply A / B | 11.98–12.02 / 12.32–12.37 V |
| MAINFAN | 988–992 RPM |

The six temperature/current/supply candidate entry values were not crossed.
Forward power stayed below the existing 25 W gate throughout, so SWR_HIGH and
PA_EFFICIENCY_LOW again have zero eligible samples. Low efficiency at this
power does not establish a candidate-rule warning. Ordinary TX state coverage
is now retained, while meaningful-load coverage for those two rules remains
pending. No thresholds, gates, debounce or latching rules were changed.

All 36 additional status reads show CONNECTED, active Slice A, PA HEALTH
UNKNOWN / NUMERIC RULES PENDING / DERIVED and SQLite READY. Logger errors,
incidents, count/memory drops and source overflow remain zero. These are sampled
checks, not a claim of continuous UI or fault-state observation. Combined
HEALTH sample counts across the separately retained windows are 536 RX and
103 TX (51 TX with fresh candidate=1, 52 with fresh candidate=0).

Baseline approval remains PENDING; numeric activation remains DISABLED.
Stage F has not started. Old v4.31 / New v4.32, no deployment, commit or push.
JSON, required static and whitespace checks plus full repository validation:
PASS after this documentation-only addition. Stop for baseline review.

### Stage E meaningful-power extension — 12 October 2026

The user authorized normal >25 W operation and an optional normal short TUNE,
with numeric activation disabled. The first passive attempt, 12:10:33.013–
12:11:04.568 UTC, stopped on canonical active-slice loss. It retained 31 RX
HEALTH samples and no TX. A DIRECT SLICE_REMOVED record precedes the loss;
this stopped interval is retained separately and excluded from normal TX
baseline. No runtime instrumentation was installed, so no runtime rollback
was needed or performed.

After Slice A returned and the user confirmed readiness, a separate capture
ran 12:12:43.631–12:15:43 UTC. It also recovered existing pre-window records
to retain pre-TX evidence. The
[meaningful-power summary](measurements/au510m-pa-health-stage-e-2026-10-12-meaningful-summary.json)
includes input checksums, source epoch, sequence references, state transitions,
quality gates and pre/post references. No radio command, connection, parser,
subscription, conversion, threshold, version or deployment was changed.

Only records from the last retained Slice-A restoration, sequence 7120 at
12:11:30.984 UTC, are used for this extension's normal-operation review.
The deduplicated window ends at sequence 8189 at 12:15:42.948 UTC, with no
sequence gaps, missing recovered slots or capture errors. It contains 196 RX
and 236 TX HEALTH samples; 65 HEALTH samples have fresh TUNE-candidate=1.
Candidate samples overlap TX/RX and are not confirmed TUNE samples. Canonical
TUNE remains UNKNOWN; confirmed TUNE sample count is zero.

There are 69 canonical TX samples with fresh forward power strictly above
25 W and all eleven HEALTH values FRESH. Both SWR_HIGH and PA_EFFICIENCY_LOW
therefore have 69 eligible context samples. The maximum forward power is
423.643 W. The sum of consecutive qualifying sample spans is 8.318 seconds;
isolated samples contribute zero to that estimate. This is sampled duration
evidence, not exact continuous RF duration. The longest qualifying sample
span is 1.228 seconds; no continuous two-second high-power interval is proved.
That limitation affects later debounce review, not the truth of the retained
normal-TX measurements.

Ranges below use only the 69 complete fresh >25 W TX samples. “Typical” means
the sample median. Derived FET and supply values preserve their source HEALTH
sequence and use the paired fresh values in each sample.

| Measurement | Minimum–maximum | Typical median |
| --- | --- | --- |
| FWDPWR | 25.003–423.643 W | 105.925 W |
| REFPWR | 0.809–24.210 W | 4.920 W |
| Canonical SWR | 1.00–1.79 | 1.45 |
| PA current | 0–4.46 A | 0.13 A |
| PA efficiency | 0–79% | 48% |
| PA temperature | 23.98 °C | 23.98 °C |
| FET1 / FET2 / FET_TEMP_MAX | 25 / 25 / 25 °C | 25 / 25 / 25 °C |
| FET_TEMP_DELTA | 0 °C | 0 °C |
| Supply A | 11.98–12.02 V | 12.01 V |
| Supply B | 12.32–12.39 V | 12.35 V |
| SUPPLY_DELTA | 0.31–0.40 V | 0.34 V |
| MAINFAN | 988–992 RPM | 988 RPM |

MAINFAN control/zero semantics remain unproven. No sample crosses the SWR
candidate entry value; 31 eligible samples are at or below the 40% efficiency
candidate entry value. Those low samples remain in the evidence. They do not
activate a rule or establish a sustained warning; no debounce/latch simulation
or threshold approval is performed.

All 170 live status checks show canonical PA_FAULT READY, SQLite READY and
PA HEALTH UNKNOWN / NUMERIC RULES PENDING. Incidents, logger errors, limit and
memory drops, and source overflow are zero. Canonical Interlock fault records
and offline observation guard events are absent. These live checks cover the
second capture; the pre-window was recovered retrospectively. UNKNOWN gaps
in the retained normalized TX/RX transitions remain UNKNOWN and are not erased.

Repeated candidate TUNE on/off cycles were retained around 12:12:29–12:12:53
and 12:15:28–12:15:33 UTC. They do not prove canonical TUNE/RX oscillation.
The user explicitly confirmed: “Yes, intentional; operation was normal,”
including no unexpected cycling, fault, supply or temperature anomaly.
This is operator confirmation, separate from canonical radio-state evidence.
Stage E technical coverage: PASS. Existing normal RX/TX evidence is retained,
meaningful-power context now exists for both gated rules, pre/post records are
present, no abnormal fault or incident was recorded, SQLite is READY, and
repository validation passes. Canonical TUNE remains UNKNOWN as an explicit
limitation. Baseline/threshold approval remains PENDING; technical completion
does not approve or activate any candidate rule.

Numeric rules remain DISABLED, all candidate thresholds are unchanged, Stage F
has not started, and Old v4.31 / New v4.32 is retained. No deployment, commit
or push. Baseline JSON, required static/whitespace checks and full repository
validation: PASS. Stop for review before Stage F.

## Stage F — controlled warnings and DIAG LIVE instruments

**Status: stopped at the kiosk gate and rolled back to Stage D2.** Numeric
rules are currently DISABLED and the new gauges are absent. The following
describes the attempted Stage F configuration, not the current live runtime.

Stage F is explicitly authorized by the subsequent implementation request.
It supersedes the historical DISABLED/PENDING gate above, while retaining
Old v4.31 / New v4.32. No additional version increment is made.

The single `PaHealthClassifier` now enables exactly six rules. All thresholds
are `PROJECT_WARNING_THRESHOLD`, not manufacturer limits or protection actions.

| Enabled rule | Enter | Clear |
| --- | --- | --- |
| SWR_HIGH | SWR ≥ 2.0, canonical TX and fresh FWDPWR ≥ 25 W | SWR ≤ 1.8 or eligible TX/power context ends |
| PA_TEMP_HIGH | PATEMP ≥ 75 °C | PATEMP ≤ 70 °C |
| FET_TEMP_HIGH | max(FET1, FET2) ≥ 75 °C | maximum ≤ 70 °C |
| FET_IMBALANCE | absolute FET difference ≥ 15 °C | difference ≤ 10 °C |
| SUPPLY_LOW | minimum supply voltage ≤ 11.5 V | minimum ≥ 11.8 V |
| SUPPLY_IMBALANCE | absolute supply difference ≥ 1.0 V | difference ≤ 0.7 V |

Entry remains centralized at 2 seconds; recovery and fresh-data warmup are
3 seconds. Fresh canonical PA_FAULT is immediately CRITICAL / PA FAULT;
stale fault evidence is UNKNOWN. Fresh sufficient normal context is green
OK / NO ACTIVE WARNING. Insufficient evidence remains UNKNOWN.
Canonical TUNE remains UNKNOWN. A directly observed TUNE candidate is
shown separately and cannot substitute for canonical TX or establish TUNE state.

PA_CURRENT_HIGH, PA_EFFICIENCY_LOW and FAN_ANOMALY remain explicitly DISABLED.
The baseline current semantics are insufficiently robust; efficiency spans
0–79% with median 48% and needs timing/context study. The baseline table above
retains all values, including low efficiency. MAINFAN control and failure
semantics remain unproven; no fan warning or control is implemented.

TEMP consumes the existing DIAG LIVE health projection, with needle and primary
numeric value `FET_TEMP_MAX = max(FET1, FET2)` when both inputs are fresh.
PA, F1 and F2 remain separate compact numeric values; PA is not included in the
FET maximum and temperatures are never averaged. The fixed scale is 0–100 °C,
with green 0–70, amber 70–75 and red ≥75 visual project context. The marker
reads “75 °C PROJECT WARNING”; the dial creates no independent alarm.

FAN consumes canonical MAINFAN from that same projection. The retained Stage E
baseline has 912–996 RPM across its fresh samples, including 988–992 RPM in
meaningful TX. No documented manufacturer maximum was found. The neutral
0–2000 RPM dial is DISPLAY SCALE ONLY, not a warning or manufacturer limit.
Numbers remain truthful beyond full scale; only needle angles clamp.

Both SVG instruments reuse the project's dashboard needle approach without
new dependencies, subscriptions, parsers or data pipelines. They occupy one
side-by-side row in DIAG LIVE; existing health, state, capture and persistence
values remain present. HISTORY, TREND, EXPORT and existing radio pages retain
their paths. Missing/stale input displays `--`, UNKNOWN and gray styling;
the needle retains its last valid angle without presenting its old number as fresh.
The existing delivery-freshness gate also covers lost dashboard updates.

PA_HEALTH_CHANGE remains an EVENT record. Its bounded persistence/export
payload preserves active and primary reasons, project threshold provenance,
immediate flag, values and source/derived sequence references. No schema,
incident class, continuous SQLite health logging or radio protection is added.
The diagnostic observer is redeployed through its existing module-cache reload
initializer to activate the changed classifier. Canonical owners remain unchanged.

Deployment stages: minimal placeholders; static SVG scales; clearly marked
browser-only SIMULATION fixture; live TEMP only; finally live FAN and removal
of all fixture code. Each stage requires repository/Vue validation and read-only
live checks. The DIAG template's authorized contract hash is refreshed; every
other canonical-node hash remains unchanged. The pre-F Stage-D2 snapshot is
retained locally for a feature-only rollback without destroying prior work.

Offline rule, persistence/export and gauge candidate tests: PASS. The minimal
physical kiosk layout was confirmed PASS by the operator. The subsequent
browser-only SIMULATION dial stage failed the operator's layout/page check;
the exact affected area is awaiting clarification. Feature development stopped
immediately. The saved pre-F Stage-D2 v4.32 files were restored for rollback,
including the disabled numeric-rule configuration and original DIAG template.
Stage F candidate files are retained locally under /tmp for review, not deployed
as a completed feature. Rollback repository validation: PASS. The Admin API confirms exact equality
with the saved Stage-D2 flows, revision
`188c2eed7de6f1c4715bffed0464e39256821ee2d07de31f779d6a9b473bbf55`.
After initial unavailable connection evidence, live RX recovered at
13:04:44.813 UTC: slice A, 7.143 MHz/LSB, Interlock READY, PA HEALTH UNKNOWN /
NUMERIC RULES PENDING, SQLite READY, zero incidents/errors/drops, and continuing
updates for RADIO/PA/METER/DIAG. HISTORY returns READY with zero incidents.
Physical kiosk recovery was subsequently confirmed by the operator. The reported
defect was text extending outside the lower health-value cards.

The 180-second Stage F passive status window retained 304 checks, with no
WARNING/CRITICAL or capture errors. It included healthy RX, brief UNKNOWN
contexts and four TX/UNKNOWN observations; no fresh TUNE-candidate=1 samples
were retained. A separate earlier live check showed TX 244.343 W / SWR 1.17 /
PA HEALTH OK. These observations do not complete required normal TX/TUNE
validation and are not complete event-rate measurements. Stage F remains FAIL
at the kiosk gate, not approved for commit.
No Stage F commit or push. AGC-T is excluded by the current user instruction.


### Stage F retry — lower value-row containment

The operator reissued the Stage F implementation request after confirming the
Stage-D2 rollback. The failed screenshot has 12 px of extra LIVE-main inset,
consistent with inherited dashboard main padding. It left approximately 32 px
per health-value card, insufficient for label, numeric value/unit and padding.
The retry explicitly resets LIVE-main padding/margin to zero and reserves at
least 96 px for the two health rows; the dial row is 96 px and grid gaps 4 px.
Within the existing 800×480 frame, the 366 px main region then allocates 102 px
to the health grid, or 48 px per card after its 6 px row gap. Font sizes remain
unchanged. Only the DIAG LIVE template is affected; HISTORY/TREND and other
page templates retain their styles. Physical verification remains required.

The retry starts with static dials and numeric warnings disabled. Warning
activation will follow verified display stages. Old v4.31 / New v4.32 remains
unchanged; commit/push are still held until all Stage F checks pass.

Retry static-layout physical kiosk check: PASS, operator confirmed both lower
value rows contained, no clipping/overlap/scrollbar and existing pages working.
Retry browser-only SIMULATION dial check: PASS, operator confirmed readable
needles/scales/numbers and existing RADIO/PA/METER/LIVE/HISTORY/TREND.
Static retry revision: `2bdfd6f03021178f14131f2cd3950cd0d2d83676699ac81a014bc852c703fcc6`.
SIMULATION retry revision: `dcba8062b02792f653d82d6428d59ce8546acf8d99516dad7e755db107fb30fd`.

The next TEMP-only candidate passes repository validation, but is not deployed:
the post-SIMULATION backend checks still show DISCONNECTED with no active slice.
Live integration and numeric activation are paused pending fresh canonical
connection/slice evidence. SQLite/HISTORY remain READY with zero incidents/errors.
No radio reconnect command, protection action, commit or push was performed.
