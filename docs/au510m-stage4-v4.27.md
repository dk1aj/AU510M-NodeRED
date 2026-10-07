# AU-510M persistent incidents — v4.27

Old: v4.26. New: v4.27. This release adds isolated SQLite incident persistence and one sanitized JSONL export per closed incident. No DIAG UI, radio command, connection, subscription, parser or dashboard layout is added. PA_FAULT v4.26 and the v4.23 diagnostic state machine remain unchanged.

## Storage and dependency

The canonical database is `data/au510m-diagnostics.sqlite`; exports are `data/incidents/`. Both resolve under the project root and the entire `/data/` tree is ignored by Git and source validation. Runtime directories use mode 0700; database, WAL/SHM and exports use 0600. Original local evidence under `.git/local-evidence/` remains local.

No npm package is added. The installed Node.js 26.3.0 built-in `node:sqlite` provides SQLite 3.53.1. DatabaseSync runs only inside a worker thread in production, with one serialized writer. Pragmas: `journal_mode=WAL`, `synchronous=NORMAL`, `foreign_keys=ON`, `busy_timeout=5000`. WAL/NORMAL does not guarantee survival of the latest transactions after a power failure. No manual fsync is performed per sample.

## Schema

The exact schema is maintained in `diagnostics/au510m-persistence-store.cjs`:

- `incidents`: incident identity/type, trigger and window timestamps, original trigger sequence, cycle count/duration, first/last cycle, first abnormal event, separate precursor fault evidence/confidence, frequency in Hz, mode/slice, TUNE candidate freshness, safe provenance, capture state/completeness, available PRE coverage, dropped records and incomplete reason.
- `state_events`: only incident-window EVENT records, state transitions and confidence, source/derived sequence links, Interlock state/reason, TX and TUNE candidate, frequency/mode/slice, safe event scalar and provenance. UNIQUE `(incident_id, seq, record_type)`.
- `health_samples`: only incident-window HEALTH records, eleven canonical health values with explicit units in column names, frequency/mode/slice and Interlock/TUNE context. UNIQUE `(incident_id, seq)`. Missing, invalid, stale or non-current-TX measurements become SQL NULL.
- `logger_meta`: schema version. Foreign keys link both record tables to incidents. Incident, timestamp and sequence indexes support retrieval and retention.

The sanitizer uses positive field lists before queuing data. No raw source object, radio packet, arbitrary command argument, client handle/IP/ID, run/session identifier, journal cursor, process ID or temporary path is serialized. Only known software names are eligible as client names. Unknown scalar values use NULL; origin confidence remains the existing DIRECT/CORRELATED/INFERRED/UNKNOWN enum. State evidence confidence is separate. TUNE remains the existing fresh diagnostic candidate, not a newly asserted canonical radio TUNE state. A TX_FAULT precursor is context, not proof of incident causality.

## Capture lifecycle

The previously reviewed detector is activated as a passive consumer of the existing ring's records. The Stage-1 core and state reducer are byte-identical. The adapter observes `add()` after the original insertion and restores it on close; it creates no extra ring records. The existing 50-ms lifecycle tick advances persistence; HEALTH remains RX 1 Hz, TX/fresh diagnostic TUNE 5 Hz. The ring remains 240 seconds and 12,000 records.

At a detector trigger, create an incident and extract only `[trigger - 120 s, trigger]` from the existing ring. A single transaction inserts metadata and the selected PRE records. During POST, batches flush every 200 ms or 200 records, whichever comes first. The final POST batch and terminal metadata share a transaction. Source sequences are not rewritten. Database uniqueness permits retries and the same source record in independent overlapping incidents.

Persistence owns its capture deadline separately from the detector's unchanged RAM lifecycle. Qualifying cycles in the same active detector episode extend storage to the latest qualifying cycle +120 seconds, preserving the original PRE boundary. At most 32 independent captures can overlap; overflow is explicit. The serialized worker queue is bounded to 24,000 row/command units, including the in-flight batch. No second forensic ring is created.

Only continuous coverage with no observed source loss, ordering/clock reversal, disconnect or writer loss can yield COMPLETE / post_trigger_complete=1. Other terminal states preserve INCOMPLETE or INTERRUPTED and false completeness. These closed partial incidents also receive clearly labeled JSONL exports, so useful partial evidence is retained. PRE completeness additionally uses the existing measured ring boundaries/loss metrics. No capture is claimed complete merely because a timer expired.

On graceful stop/redeploy, pending captures are persisted as INTERRUPTED. At startup, leftover COLLECTING rows become INTERRUPTED with false post completeness; missing terminal exports are recovered before retention. An atomic temporary-file rename publishes one JSONL per incident. The first line contains sanitized incident metadata; subsequent event/health lines merge chronologically by timestamp and sequence. Internal SQL row IDs are omitted.

## Retention and failure

At startup and every six hours, delete HEALTH older than 48 hours and EVENT rows older than 30 days, excluding COLLECTING incidents. Incident metadata is retained indefinitely. JSONL incident exports are retained indefinitely for now; their disk usage requires operator management. Recover exports before deleting old database details at startup. Completed exports do not change when database retention later removes their rows.

Initialization, write and worker failures report compact error codes, never filesystem error text. They degrade persistence only; the RAM detector and existing radio/dashboard continue. Failed queue entries are counted; no later complete capture is fabricated. Automatic writer restart/retry is deliberately absent in this release: a runtime restart/redeploy recovers interrupted database state. No database is reconstructed from uncaptured raw traffic.

Internal context `au510mDiag.metrics` exposes SQLite status, last error/write time, incident/event/health counts, total DB+WAL+SHM bytes, queue depth/peak, dropped units and maximum observed write latency. No public route or UI is added.

## Tests and limits

`test-au510m-persistence.mjs` covers WAL/pragmas/schema, insert/uniqueness/NULL, retention and collecting protection, interrupted recovery/export, sanitizer, complete synthetic PRE/POST with retrigger extension, independent overlapping captures, disconnect, immutable natural replay, real worker startup/shutdown and DB failure fallback.

`test-au510m-persistence-runtime.mjs` compares the actual attached RAM core's records against an unattached control through normal RX, TX and TUNE. All source records and sampling behavior remain identical and no false incident is generated. It also exercises bounded queuing and a 5,000-record worker transaction while a main-thread heartbeat runs.

The immutable natural fixture reproduces one TUNE_RX_OSCILLATION, direct TX_FAULT precursor seq 18185, and first abnormal RX_RETURN_WHILE_TUNE_ACTIVE. Historical health measurement values were not captured and stay NULL. Its PRE spans 120 seconds, but the compact fixture explicitly omits command/ACK/client record classes, so PRE completeness is false. Its full 120-second POST is unavailable. Replay exports explicitly INTERRUPTED with both completeness flags false. It does not synthesize missing historical measurements or extrapolate the POST window. A separate synthetic test validates the complete 120-second path.

The offline benchmark measured roughly 206 ms end-to-end / 101 ms worker transaction for 5,000 rows (about 24,300 rows/s); the main event loop remained responsive. This is a local synthetic throughput check, not a claim about actual TX/TUNE traffic rates. Live validation, memory change, database size and any remaining manual validation are recorded in the release acceptance report. Physical kiosk screenshots are unavailable; all dashboard templates remain unchanged.

No DIAG dashboard is implemented. STOP FOR REVIEW before any v4.28 work.

## Final real-operation validation — 7 October 2026

Deployment remains unchanged. Runtime is v4.27, with Old v4.26 / New v4.27.
Read-only observation began at 22:34:33.865 Europe/Berlin (20:34:33.865Z).
Baseline: CONNECTED, active slice A, 7.0672 MHz LSB, RADIO_RX, fresh diagnostic
TUNE candidate 0, PA_FAULT READY, SQLite READY, no error, zero incidents and no
active capture. DB/WAL/SHM total 148,136 bytes.

The user performed ordinary PTT and TUNE operations; the observer sent no radio
commands and created no synthetic incident. All source evidence below comes from
the existing diagnostic RAM ring, sanitized before temporary local recording.

PTT: 22:42:45.833 to 22:42:46.806 Europe/Berlin (20:42:45.833Z to
20:42:46.806Z). Actual diagnostic sequence:
RADIO_RX -> UNKNOWN -> TX_REQUESTED -> TRANSMITTING -> UNKEY_REQUESTED ->
RETURN_TO_RX -> RADIO_RX. The preceding UNKNOWN at 22:42:45.313 carried the
existing AWAIT_LINKED_CANONICAL_TX_RX reason; it is recorded explicitly, not
removed or repaired. Interlock: READY -> PTT_REQUESTED -> TRANSMITTING ->
UNKEY_REQUESTED -> READY. Diagnostic TUNE stayed 0 and fresh. Incidents 0 -> 0;
SQLite READY, no DB error, queue 0, active slice A after TX. Data validation PASS.

TUNE: 22:43:56.381 to 22:43:58.207 Europe/Berlin (20:43:56.381Z to
20:43:58.207Z). Actual diagnostic sequence:
RADIO_RX -> TUNE_REQUESTED -> TX_REQUESTED -> TRANSMITTING -> UNKEY_REQUESTED ->
RETURN_TO_RX -> RADIO_RX. Interlock: READY -> PTT_REQUESTED -> TRANSMITTING ->
UNKEY_REQUESTED -> READY. Direct diagnostic candidate transitioned 0 -> 1 -> 0;
on at 22:43:56.381, off at 22:43:58.203, both fresh; no TUNE_STALE record.
This remains the existing diagnostic signal, not a new assertion of canonical
TUNE state. Incidents 0 -> 0, SQLite READY, no DB error, queue 0, active slice A
preserved. Data validation PASS.

Final read-only database checks: quick_check=ok, no foreign-key violations, WAL
active, zero incident/event/health rows and zero COLLECTING rows. DB 4,096 bytes,
WAL 111,272 bytes, SHM 32,768 bytes; all mode 0600, total unchanged. The writer's
last-write timestamp stayed unchanged, as expected without incidents; no manual
retention run occurred. Retention implementation and schedule are unchanged.

Canonical RADIO, PA, watcher and METER data continued updating. Context reads
around TX took at most 11.254 ms and around TUNE 9.055 ms; normal 1/5-Hz health
sampling continued, queue/dropped-record/observer error counters remained zero.
No sustained monotonic memory growth was observed. Aggregate Node-RED memory at
the post-test check: RSS 297,717,760 bytes, heap used 104,843,728 bytes, versus
runtime-start RSS 391,127,040 and heap 79,295,864 bytes. These are whole-process
values affected by GC and unrelated activity, not a persistence-only measurement.
No live benchmark was performed; the required full repository suite also ran its existing offline worker test.

Visual kiosk verification: PASS, explicitly confirmed by the user on 7 October
2026. RADIO PASS, PA PASS, AGC-T PASS and METER PASS, with no visible stalling
during either TX or TUNE. Combined with the recorded technical checks, live TX
and live TUNE acceptance are PASS; no false incident occurred and SQLite stayed
READY. Final repository validation is required before committing this release.
Existing unrelated diagnostic drafts remain preserved outside the release commit.
No runtime code, layout or deployment changed during this final validation.
