# DIAG HISTORY incident export — v4.30

Old v4.29 / New v4.30. Known-good checkpoint:
`5b7f6bf73a6978eeffaa03af9093c29f7162f3eb` (HEAD = origin/main, clean before work).
The release pair remains exclusively in `agct-watcher-version.json`.

## UI and access

The accepted DIAG widget has one compact EXPORT button beside LIVE/HISTORY,
visible only in HISTORY. It is disabled unless the currently selected incident
has loaded successfully, including NO INCIDENTS, unavailable history and an
export in progress. Existing incident rows/content dimensions stay unchanged.
Feedback is EXPORTING, READY or EXPORT ERROR. READY initiates the ZIP download;
a small ZIP link allows a retry without regenerating it. There is no modal.
Switching selection clears the old download link; stale asynchronous responses
cannot present another incident's export. Unmount aborts the UI fetch.

POST `/au510m-diag/incident/:id/export` generates only the selected incident.
GET `/au510m-diag/export/:exportId` streams only a known generated ZIP.
These isolated HTTP nodes never wire to radio/logger commands. The existing
station Node-RED HTTP access boundary is retained; no new authentication system
is introduced. Cross-origin browser POST requests are rejected. Downloads use
an unguessable random 128-bit capability ID and an in-memory bounded registry
(256 entries). There is no export-list endpoint. A restart invalidates old
browser download links; regenerate from the selected incident. Retained files
remain on disk until expiry. Do not expose the station HTTP service publicly.

## Package and strict sanitization

Filename: `AU510M-YYYYMMDD-HHMMSS-TYPE-<random128>.zip`; timestamp is UTC.
ZIP uses standard STORE entries, incremental CRC32, fixed entry names and data
descriptors. No new dependency is installed. Exactly these entries are written:

- `incident.json`: selected metadata, capture evidence, precursor, first abnormal
  event, safe trigger/command origins and confidence, export version, row counts
  and conservative estimated size.
- `events.jsonl`: selected state/event records, ordered by timestamp, sequence
  and row ID.
- `health.jsonl`: selected retained health records in the same chronological order.
- `README.txt`: concise incident/time/cycles/frequency/mode/precursor/first abnormal,
  origin, PRE/POST status, retained row counts and central generating version.
  It states explicitly that a precursor is not proof of causality and that
  missing historical health is not reconstructed.

`diagnostics/au510m-export-policy.cjs` is the explicit export allowlist. It reuses
`au510m-persistence-sanitize.cjs` text, integer, number and bit filtering and the
same classified safe client-name list. Nothing serializes arbitrary messages,
source objects or `SELECT *` rows.

Incident fields: incident_id, incident_type, trigger_ts, trigger_ts_ms, trigger_seq,
cycle_count, duration_ms, frequency_hz, mode, active_slice, precursor_fault,
precursor_fault_ts, precursor_fault_age_ms, precursor_fault_confidence,
first_abnormal_event, first_abnormal_seq, tune_active_at_trigger,
tune_fresh_at_trigger, pre_trigger_complete, post_trigger_complete,
post_capture_state, completed_at, pre_window_available_seconds, dropped_records,
incomplete_reason, trigger_origin, command_origin, origin_confidence.

Common event/health fields: ts, ts_ms, seq, frequency_hz, mode, active_slice,
interlock_state, interlock_reason, tune_value, tune_fresh.
Events additionally: record_type, old_state, new_state, state_confidence,
state_reason, tx_state, event_name, event_value, origin_confidence,
trigger_origin, command_origin, client_name.
Health additionally: FWDPWR_W, REFPWR_W, SWR, PATEMP_C, PAFETQ1TEMP_C,
PAFETQ2TEMP_C, PACURRENT_A, PAEFF_PERCENT, V13_8A, V13_8B, MAINFAN.

Unknown numbers/bits/timestamps remain null; unknown origin/confidence remains
UNKNOWN. Existing measured zero is preserved. Safe client_name is restricted to
SmartSDR, AetherSDR, FRStack, N1MM+, WSJT-X, Maestro, SmartControl, Node-RED and
Stream Deck. No opaque client handles, client/session IDs, raw packets, paths,
PID/process/socket/journal metadata, authentication material or database files
are included. TUNE remains the stored diagnostic candidate; export does not
promote it to an independently proven canonical state.

## Read-only bounds and isolation

A dedicated serialized worker opens SQLite with `readOnly:true`. All SQL is
SELECT with explicit columns and parameterized `WHERE incident_id=?`.
The incident iterator holds a read snapshot while the associated counts and
ordered rows are read. No export flag, UPDATE, schema, retention or radio write
is performed. Existing SQLite retention may have removed some historical health;
only remaining records are exported, never substituted. Capture flags retain
original stored evidence rather than claiming reconstructed completeness.

Before creating a ZIP, measure event/health counts and estimated encoded size.
Limit: 50,000 rows per lane and 16 MiB estimated/actual ZIP size. Estimate includes
sixfold string expansion plus field/row overhead. Incremental JSONL serialization
and ZIP writing avoid assembling the entire export in RAM. One export at a time,
at most two pending worker messages, 30-second timeout; the browser timeout is
35 seconds. Worker failure is isolated from LIVE, HISTORY and SQLite logging.
Internal context `exportMetrics` contains last_export_status, last_export_ts,
last_export_filename, last_export_size_bytes, last_export_error, total_exports.
Errors sent to browsers are fixed diagnostic codes, never paths or stack traces.

## Files, retention and security

Runtime path: `/mnt/dietpi_userdata/node-red/data/exports/`, excluded through
`/data/` in `.gitignore`, created by Node-RED with directory mode 0700/files 0600.
Intermediates are exclusive `export-<random128>.zip.tmp` files in that controlled
runtime directory. Success atomically renames the completed ZIP; any normal
failure closes/unlinks the partial file. Startup and six-hour cleanup remove
owned orphan temp files and generated ZIPs older than seven days. Cleanup never
runs per UI interaction and never removes SQLite incidents, DB/WAL/SHM, legacy
JSONL captures or unrelated files. The worker serializes cleanup and generation.

Incident IDs follow the existing strict history ID contract. Download input is
exactly 32 lowercase hexadecimal characters. No filename/path parameter exists.
The registry maps only successfully generated IDs to strictly validated `.zip`
names. Slashes, backslashes, absolute paths, traversal, encoded traversal,
unexpected extensions and unknown IDs are rejected. Directory symlinks and
file symlinks are rejected (`O_NOFOLLOW`); file type, size and age are checked.
Streaming uses no-store, attachment, application/zip and nosniff headers.

## Validation and acceptance

`node scripts/test-au510m-export.mjs` is part of repository validation. Temporary
SQLite fixtures under `/tmp` cover the immutable natural 38-cycle oscillation
(TUNE_RX_OSCILLATION, TX_FAULT precursor, RX_RETURN_WHILE_TUNE_ACTIVE first
abnormal, UNKNOWN causal client), all four ZIP entries/CRC via `unzip`, ordering,
UNKNOWN/null/zero, strict sanitizer, missing/invalid/empty incidents, size bounds,
disk-failure temp cleanup, retention, ignored runtime artifacts, unchanged source
rows, worker metrics, streamed download/traversal/symlink protection, UI feedback
and failure isolation. No fixture enters production. Existing canonical nodes
are compared against the known-good commit; only DIAG presentation and central
release environment may differ. Its authorized UI fingerprint is updated in the
canonical contract; other protected fingerprints remain unchanged.

Pre-deploy observation initially found no active slice on existing v4.29,
with RADIO placeholders/AGC-T waiting/DIAG UNKNOWN. No initialization path was
changed. After the user started AetherSDR, real slice A/28.475 MHz USB returned,
RADIO_RX/READY/CONNECTED, SQLite READY, zero incidents/errors.

Offline export tests: PASS. Full repository validation: PASS (including Vue
single-export compatibility, canonical node protection and all existing suites).
Standard deployment: PASS, 98 nodes, revision
`67f6735b5058e7c65510d03eb97dba5ddd372da683ced6336d16c67b4ae22e24`.
Post-deploy source/runtime equality, CONNECTED slice A / 28.475 MHz USB,
RADIO_RX / Interlock READY, AGC-T central Old 4.29 / New 4.30 with active
slice, SQLite READY, zero incidents/errors: PASS. New HTTP invalid/missing
incident, cross-origin POST and encoded traversal responses: PASS (400/404/403).
Missing-incident export causes only isolated EXPORT metrics ERROR; independent
LIVE/HISTORY/logger continue. No production fixture or ZIP was generated.
`data/exports` was created by Node-RED as nodered:nodered, mode 0700.

Actual 800×480 physical kiosk acceptance: PASS, explicitly confirmed by the
user on 9 October 2026. HISTORY fits, NO INCIDENTS is shown, EXPORT is readable
and disabled, LIVE/HISTORY switching works, there are no scrollbars, clipping or
overlap, and RADIO/PA/AGC-T/METER remain functional. SQLite READY is displayed
on DIAG LIVE rather than the intentionally compact empty HISTORY view; the
post-kiosk runtime check confirmed SQLite READY, zero incidents, zero diagnostic
errors, CONNECTED, RADIO_RX and active slice A. Next stage: STOP FOR REVIEW.

Final passive Dashboard observation: PASS. Ten actual independent DIAG LIVE
payloads over ten seconds showed RADIO_RX, CONNECTED, SQLite READY, slice A,
fresh TUNE candidate 0 and eleven canonical health fields, with no active
capture. Existing combined RADIO/PA widget received 109 actual messages; METER
received 109; DIAG received 20 (ten LIVE plus its preserved external input).
The observer used the installed Dashboard's normal same-origin Socket.IO polling
handshake and sent no widget action/change/send requests. Frequency changed by
normal operator activity to 14.222 MHz USB and was reflected in LIVE; the export
performed no radio commands. AGC-T status continued to expose its real active
slice and central v4.30. These are technical data-delivery checks, not substitutes
for the required real 800×480 kiosk visual acceptance.
