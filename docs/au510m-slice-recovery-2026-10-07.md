# AU-510M: TX_FAULT precursor and active-slice recovery analysis

Runtime stays **v4.23**. v4.24 is an undeployed design. No radio command,
slice creation, reconnect, new subscription, version bump or deployment was
performed for this analysis. Current status observed 7 October 2026,
16:56:48 Europe/Berlin. New analysis is separate from the immutable original.

## Evidence protection

The original [natural oscillation evidence](measurements/au510m-natural-oscillation-2026-10-07.json)
remains byte-identical, SHA-256:
`6f35714df7e0ae2f4a1895664a6bf4a38dea5bcf6720fe36470a8951b23a3dde`.
Original sequence numbers, millisecond timestamps, state names, TUNE freshness,
TX_FAULT and available provenance are preserved. The source run is
`2677c58f-e32f-40ec-b46d-112fce8c6e13`. The temporary compact capture contains
1298 records with no missing sequence in its captured interval. It omitted
meter payloads and wire strings; those omissions cannot be recovered from the
now-expired ring. The existing fixture preserves relevant original records;
command/ACK/client record types were explicitly omitted from that fixture.
The separate analysis includes the actually captured client-disconnect record.

New [complete analysis](measurements/au510m-slice-recovery-2026-10-07.json) and
[precursor replay result](measurements/au510m-precursor-replay-2026-10-07.json)
add context without rewriting the original evidence.

## Active-slice recovery: all seven questions

1. **Does the radio report a slice? YES.** The existing decoded-status canonical
   cache contains slice 0/A, in_use=1, active=1, RF_frequency=10.141, mode=DIGU.
   This is the existing shared radio input, not a second independent query.
2. **Present but inactive? NO at the current observation.** Exactly one cached
   slice exists and is marked active. No multiple-active ambiguity is present.
3. **Canonical active cache stale? No indication currently.** Bridge has A at
   10.141 MHz/DIGU, RX; Watcher has active slice 0 and matching frequency.
   Bridge age was 77 ms, Watcher age 814 ms, connection heartbeat age 2423 ms;
   the active slice's SLC/0/LEVEL is fresh. Slice status is change-driven, so an
   independent timestamp of its last complete raw status is unavailable. The
   historical disappearance is supported by explicit slice removal, not merely
   a display/cache blank. A separate diagnostic TX/RX linkage limitation exists.
4. **Was slice removal observed? YES.** Seq 18949 at 16:38:12.917,
   source 7fbf2bfc9badc7d3, topic slice/0, PRESENT→REMOVED. The exact original
   wire form (`removed` versus in_use=0) was not retained. Canonical active A
   cleared 18 ms later at 16:38:12.935, seq 18967; frequency/mode also cleared.
   These are distinct observations. The original report's `slice_loss_seq=18967`
   means canonical field loss; the earlier decoded membership event is 18949.
5. **Did reconnect clear diagnostic state correctly?** No radio TCP connection
   loss/reconnect record appears in the captured fault/oscillation window, so
   no actual reset claim can be made for that window. Existing core.connection
   resets latestState, slices, tune and health on connection changes, and the
   installed adapter/offline tests verify reset/repopulation. Current canonical
   connection is true, epoch 3; its exact prior recovery timestamp is UNKNOWN.
6. **Are existing pages receiving fresh data? YES at backend level.** RADIO/PA
   retain their canonical payload path, AGC-T has fresh slice/frequency/status,
   METER receives the unchanged canonical power/SWR projection. Actual Vue RX
   projection gives both needles zero and blank gated SWR. Existing widget
   receive counters advance and routes pass. Browser visual rendering remains
   unverified; route HTTP 200 alone was not used as acceptance.
7. **No physical slice, or only Node-RED issue?** The missing-slice condition
   is currently resolved without our intervention. Historically the radio's
   decoded removal of slice 0 was observed. The complete historical inventory
   of any other slices is UNKNOWN. Do not claim a Node-RED-only failure or an
   empty whole-radio inventory. Exact slice restoration time aged out; it was
   confirmed present by the first recovery read at 16:53:42.040.

Client handle 0x693C7243 was reported disconnected at 16:38:12.914, seq 18945.
The captured previous session identity was SmartSDR-Win on DESKTOP-S7JCL8S;
that is cached prior client identity, not the command sender or physical trigger.
Slice removal follows 3 ms later, but timing alone proves no causal link.
The current slice handle differs (0x07540F15); program/trigger mapping is UNKNOWN.
No radio disconnect is inferred from a GUI/client disconnect.

## Exact TX_FAULT source and semantics

Source chain verified in installed code:

- `node_modules/flexradio-js/Radio.js`: TCP `_receiveData` splits lines;
  `_receiveMessage` calls `flex.decode` and emits decoded status.
- `node_modules/flexradio-js/flex.js:decode` calls the generated
  `flex-parser.js`, from `flex-parser.pegjs` Status/makePayload/Space_KV rules.
  A string state token is preserved; the parser does not invent TX_FAULT.
- `node_modules/node-red-contrib-flexradio/flexradio-radio.js` emits status
  through the existing shared owner 7fbf2bfc9badc7d3.
- `flexradio-message` node au510m_live_messages forwards topic `interlock`.
- The existing onReceive hook in diagnostics/au510m-stage1-runtime.cjs observes
  au510m_live_state input and calls DiagnosticBuffer.interlock(msg.payload).
- diagnostics/au510m-stage1-core.cjs directly appends INTERLOCK_STATE from
  payload.state, with observation_confidence=DIRECT. The state machine's later
  FAULT record is a separate assessment of that same evidence.

Exact observed field: **interlock.payload.state = TX_FAULT**;
record seq **18185**, source node **au510m_live_state**, time **16:37:57.616**.
Confidence is **DIRECT for the reported radio state**, not for an unknown cause.
The original TCP line, status-header handle and compact record raw_source were
not preserved: UNKNOWN. No invented wire packet or client mapping is provided.
The compact projection omitted observation_confidence; DIRECT is supported by
its exact typed Stage-1 event/source contract and verified unmodified core code.

First and last distinct direct TX_FAULT state observation are both
16:37:57.616 (one state-change record). The last cached Health context carrying
TX_FAULT is 16:38:02.755 (seq 18201), not an independent new wire observation.
Next direct state is NOT_READY at **16:38:02.770**, seq 18202; READY follows
16:38:02.816, seq 18206. Thus TX_FAULT was cleared **before** the oscillation
window starts 16:38:02.817 and is not present during that burst.
Accompanying reason/code: **UNKNOWN**; no reason event exists in the captured
window. tx_allowed=0 was observed at seq 18188, but is not a fault code or cause.
Interlock source strings SW / TUNE / SW,TUNE are radio status labels and do not
identify SmartControl, Stream Deck or another program.

**TX_FAULT observed 5993 ms before the detector trigger**, and 5201 ms before
the first incident-cycle start. This is precursor context, not a causal claim.

## Compact timeline: 16:37:55–16:38:15 Europe/Berlin

All timestamps below are exact original event times; no fabricated boundary
event is inserted. The requested interval is retained in the JSON analysis,
with its first/last available Health snapshots at 16:37:55.953/16:38:15.509.
Ordered partial updates are preserved: e.g. the direct TX_FAULT event still has
cached TX until the later canonical TX_RX update sets UNKNOWN. No retrospective
normalization of those fields was performed.

**For every row**, historical FWDPWR, REFPWR, SWR, PATEMP, PAFETQ1TEMP,
PAFETQ2TEMP, PACURRENT, PAEFF, +13.8A, +13.8B and MAINFAN are **UNKNOWN**.
The compact capture dropped all eleven meter payloads. Current measurements
were not substituted for historical values. Interlock reason/fault code are
also UNKNOWN. No radio loss/reconnect record occurs in this interval;
client-disconnect evidence is included separately, without causal attribution.

| Local time | Seq | Event/value | Interlock | TUNE/freshness | TX/RX | Slice | Frequency / mode |
|---|---:|---|---|---|---|---|---|
| 16:37:55.953 | 18169 | HEALTH: UNKNOWN | READY | 0/fresh | RX | A | 21.095 MHz / DIGU |
| 16:37:56.813 | 18174 | CANONICAL_STATE: 21.096 MHz | READY | 0/fresh | RX | A | 21.096 MHz / DIGU |
| 16:37:57.101 | 18176 | INTERLOCK_STATE: PTT_REQUESTED | PTT_REQUESTED | 0/fresh | RX | A | 21.096 MHz / DIGU |
| 16:37:57.120 | 18180 | INTERLOCK_STATE: TRANSMITTING | TRANSMITTING | 0/fresh | UNKNOWN | A | 21.096 MHz / DIGU |
| 16:37:57.616 | 18185 | INTERLOCK_STATE: TX_FAULT | TX_FAULT | 0/fresh | TX | A | 21.096 MHz / DIGU |
| 16:37:57.617 | 18186 | DIAG_STATE_CHANGE: FAULT | TX_FAULT | 0/fresh | TX | A | 21.096 MHz / DIGU |
| 16:37:57.617 | 18188 | INTERLOCK_FIELD: 0 | TX_FAULT | 0/fresh | TX | A | 21.096 MHz / DIGU |
| 16:37:57.618 | 18189 | TX_RX: UNKNOWN | TX_FAULT | 0/fresh | UNKNOWN | A | 21.096 MHz / DIGU |
| 16:37:59.213 | 18191 | CANONICAL_STATE: 21.095 MHz | TX_FAULT | 0/fresh | UNKNOWN | A | 21.095 MHz / DIGU |
| 16:38:02.703 | 18200 | TUNE_CANDIDATE: 1 | TX_FAULT | 1/fresh | UNKNOWN | A | 21.095 MHz / DIGU |
| 16:38:02.755 | 18201 | HEALTH: UNKNOWN | TX_FAULT | 1/fresh | UNKNOWN | A | 21.095 MHz / DIGU |
| 16:38:02.770 | 18202 | INTERLOCK_STATE: NOT_READY | NOT_READY | 1/fresh | UNKNOWN | A | 21.095 MHz / DIGU |
| 16:38:02.816 | 18206 | INTERLOCK_STATE: READY | READY | 1/fresh | UNKNOWN | A | 21.095 MHz / DIGU |
| 16:38:02.817 | 18209 | DIAG_STATE_CHANGE: TUNE_REQUESTED | READY | 1/fresh | RX | A | 21.095 MHz / DIGU |
| 16:38:02.846 | 18214 | INTERLOCK_STATE: TRANSMITTING | TRANSMITTING | 1/fresh | UNKNOWN | A | 21.095 MHz / DIGU |
| 16:38:03.127 | 18227 | DIAG_STATE_CHANGE: RADIO_RX | READY | 1/fresh | RX | A | 21.095 MHz / DIGU |
| 16:38:03.609 | 18264 | DIAG_STATE_CHANGE: RADIO_RX | READY | 0/fresh | RX | A | 21.095 MHz / DIGU |
| 16:38:12.914 | 18945 | CLIENT_SESSION: disconnected handle 0x693C7243 | READY | 1/fresh | RX | A | 21.095 MHz / DIGU |
| 16:38:12.917 | 18949 | SLICE_REMOVED: REMOVED | READY | 0/fresh | RX | A | 21.095 MHz / DIGU |
| 16:38:12.934 | 18964 | DIAG_STATE_CHANGE: RADIO_RX | READY | 0/fresh | RX | A | 21.095 MHz / DIGU |
| 16:38:12.935 | 18965 | CANONICAL_STATE: UNKNOWN | READY | 0/fresh | RX | A | UNKNOWN / DIGU |
| 16:38:12.935 | 18966 | CANONICAL_STATE: UNKNOWN | READY | 0/fresh | RX | A | UNKNOWN / UNKNOWN |
| 16:38:12.935 | 18967 | CANONICAL_STATE: UNKNOWN | READY | 0/fresh | RX | UNKNOWN | UNKNOWN / UNKNOWN |
| 16:38:12.954 | 18968 | INTERLOCK_STATE: RECEIVE | RECEIVE | 0/fresh | RX | UNKNOWN | UNKNOWN / UNKNOWN |
| 16:38:13.488 | 18973 | DIAG_STATE_CHANGE: UNKNOWN | RECEIVE | 0/fresh | RX | UNKNOWN | UNKNOWN / UNKNOWN |
| 16:38:15.509 | 18975 | HEALTH: UNKNOWN | RECEIVE | 0/fresh | RX | UNKNOWN | UNKNOWN / UNKNOWN |

The repeated middle interval contains 38 complete cycles in 10.117 s, including
24 RX returns with fresh active TUNE and 16 proven reactivations. Original raw
state records remain in the fixture; the compact table does not substitute an
aggregate for their exact ordering.

## Prepared v4.24 precursor model — no deploy

The unactivated draft detector retains one latest fault per run/connection epoch.
Only existing INTERLOCK_STATE records TX_FAULT/TIMEOUT/STUCK_INPUT supply it;
no new fault detector or incident type is added. It records a subsequent reason
only while that exact fault is active and retains reason sequence. A later direct
state marks clearance without deleting precursor context. Connection changes or
logger start reset it. There is no arbitrary age cutoff: age and the scope
LATEST_OBSERVED_FAULT_IN_CURRENT_RUN_CONNECTION_EPOCH are explicit.

At incident creation, a precursor must precede the first candidate cycle's seq.
The incident freezes precursor_fault, ts, seq, age_ms, source/availability,
reason/reason_seq, confidence, cleared_ts/seq and active_at_trigger. Missing
observations stay UNKNOWN/null. DIRECT requires explicit direct observation or
the verified typed Stage-1 direct-event contract; an unknown source is not promoted.
New later faults do not rewrite the incident's first precursor snapshot.

For this actual replay: precursor TX_FAULT, seq 18185, age **5993 ms**, DIRECT,
reason UNKNOWN, cleared by seq 18202, active_at_trigger=false. The first abnormal
incident event remains **RX_RETURN_WHILE_TUNE_ACTIVE**, seq **18227** at
16:38:03.127; it is not replaced by TX_FAULT. One incident triggers at
16:38:03.609, seq 18264, after three cycles in 792 ms. This is offline replay
using nondecreasing recorded wall times; no live v4.24 incident is claimed.
All 27 offline cases pass, including real replay, reason linkage, connection-epoch
reset, no direct promotion for an unknown source and original false-positive tests.

## Safety gate and remaining limitation

Slice safety option **A: PASS** — active slice is restored and canonical page
data are healthy. Option B is unnecessary. **v4.24 deployment remains BLOCKED**
by the explicit instruction not to deploy yet and pending review of the separate
v4.23 diagnostic UNKNOWN limitation. A READY↔RECEIVE change invalidates Stage-2
TX/RX linkage; unchanged canonical RX emits no replacement TX_RX record. This
reproduces offline with current v4.23 while active slice A stays healthy. No
Stage-2 fix, radio command or redeploy was applied to hide it.

Runtime remains v4.23; central OLD_VERSION=4.22 / NEW_VERSION=4.23 stays unchanged.
The new precursor code/test modifications are an uncommitted, inactive draft.
Documentation/evidence may be committed separately. STOP FOR REVIEW.
