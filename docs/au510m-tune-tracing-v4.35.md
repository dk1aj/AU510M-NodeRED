# TUNE source evidence and export timestamps — v4.35

Old v4.34 → New v4.35. Known-good initial HEAD:
`1a8196af4f4d1705604aa3133c8fc227d1f2aa5c` (clean, equal to origin/main).
This is an additive observer/export change. No new UI component, dependencies,
radio connection, subscriptions, polling, protection action or TUNE/TX command.

## Producers and attribution

The complete current command producer inventory is maintained in
[the v4.34 producer map](au510m-command-forensics-v4.34.md#producer-map): five flow
paths (one disabled) and three installed-library startup paths, all through the
existing Flex owner `7fbf2bfc9badc7d3`. Four request terminals are active; the fifth
belongs to the disabled manual inventory tab. FRStack HTTP RFPOWER and the Windows
plugin/N1MM control path are separate; their external TUNE commands are not visible
on Node-RED's Flex TCP connection. DIAG/LIVE/HISTORY/TREND/EXPORT are consumers,
not radio command producers. Canonical interlock/TX-RX, meter conversion,
PA_FAULT/PA_HEALTH and RADIO/PA/AGC-T producers are unchanged.

The existing `_sendRequest` observer records every local send attempt **before**
the original encoder/write. It retains exact callback/protocol-sequence ACK linkage.
For transmit/interlock/tune/xmit/tx/ptt commands it adds `diagnostic_metadata`:

- `event_type`, `timestamp`, `tune_state`, `previous_tune_state`, `radio_state`,
  `interlock_state`, `frequency`, `mode`, `slice`;
- `client_handle`, `client_id`, `client_name`, `client_program`, `source_ip`,
  `source_port`, `command`, `raw_command`, `command_family`, `command_name`;
- `command_source_node_id`, `command_source_node_name`, `source_node_id`,
  `source_node_name`, `command_origin`, `trigger_origin`, `origin_confidence`;
- `last_tune_command_timestamp`, `last_tune_command`, `last_tune_command_source`,
  `last_tune_command_node_id`, `last_tune_command_node_name`, `last_known_client`,
  and the command's diagnostic sequence/run/epoch;
- explicit status-header role and command-link confidence/availability.

Node source IDs/names come from the existing post-clone message-identity observer
and reviewed source catalogue; library startup has UNKNOWN node identity. Local
socket address/port describe the observed outgoing Node-RED connection, never an
external client. Local command origin is DIRECT NODE_RED; physical/UI trigger is
UNKNOWN. Client handle is included only when actually available from that client.

Every existing `TUNE_CANDIDATE` change now carries metadata
`event_type=TUNE_STATE_CHANGE`, observed old/new values and context. Repeated
identical fresh status is not a new event. TUNE remains the diagnostic candidate
signal: this change does not promote it into a validated canonical TUNE state.
The existing status parser runs exactly once. A transparent `_receiveMessage`
wrapper exposes its original line only during the synchronous decode/emit call.
Both original methods are restored on close, including inherited method behavior.

A Flex status-header handle does **not** establish command sender or trigger.
It is retained with `STATUS_HEADER_NOT_COMMAND_ORIGIN`. Client presence and temporal
proximity never attribute SmartSDR, Maestro, FRStack, Stream Deck or another client.
Unavailable source metadata is explicitly `UNKNOWN`; no radio address is substituted.

The latest observed local TUNE command is retained within the connection epoch.
Its timestamp/source/sequence/run/epoch are contextual references only:
`command_link_confidence=UNKNOWN`,
`command_link_availability=LAST_OBSERVED_COMMAND_ONLY_NO_CAUSAL_LINK`.
Disconnect/reconnect clears that reference. `TUNE_REACTIVATED_AFTER_RX` keeps the
existing detector conditions and exact reactivation sequence; its first-abnormal
incident metadata carries the tracing metadata from that specific TUNE observation.
The cycle thresholds and PRE/POST capture/retrigger rules are unchanged.

## Evidence storage and limits

Two nullable event columns, `diagnostic_metadata` and `raw_evidence`, and one nullable
incident metadata column are added without rewriting historical rows. Existing
EVENT/HEALTH records and legacy compact `raw_source` stay intact. Capture, SQLite,
legacy incident JSONL and ZIP events.jsonl retain new tracing metadata. JSONL stores
the envelopes as JSON text columns; ZIP export renders those envelopes as objects.

For newly observed TUNE records, raw evidence snapshots the original separated
Flex wire line, decoded status and legacy source fields. Relevant outgoing command
text is retained verbatim separately from the existing safe command projection.
Unknown command syntax remains UNKNOWN in parsed fields; raw text can still be
retained. Existing rejection of control/multiline, oversized and secret-bearing
command text remains; excluded text is UNKNOWN, not fabricated evidence. Raw command
text is bounded at 512 characters. Raw evidence envelopes above 16384 characters
are explicitly marked `OMITTED_SIZE_LIMIT`, with original size, rather than silently
truncated. Ring count/age/memory limits and overflow accounting remain in force.

Historical records lacking raw evidence cannot acquire it retroactively. New export
metadata explicitly says `ONLY_OBSERVED_RECORDS_NO_HISTORICAL_RECONSTRUCTION`.
This is not a full network packet capture; earliest bootstrap traffic before observer
attachment and other clients' private TCP command streams remain unobservable.

## ZIP naming, metadata and lifecycle

The server captures `Date.now()` at entry to `ExportClient.generate()` when handling
the Export POST, before worker queuing. This is server handling time of the click's
request, not an untrusted browser clock or the incident timestamp. The worker formats
that instant using system local time (this host: Europe/Berlin), including milliseconds:

`AU510M-YYYYMMDD-HHMMSS-fff-INCIDENTTYPE-<32 hex characters>.zip`

`export_timestamp` is local ISO 8601 **with explicit UTC offset** (CET/CEST).
Existing `trigger_ts` and `incident_timestamp` preserve original incident UTC evidence.
Both timestamps denote unambiguous instants. Sixteen cryptographically random bytes
ensure unique export IDs even for the same incident/millisecond. Exclusive temporary
creation and atomic no-replace hard-link publication prevent overwriting any older
ZIP; a forced destination or temporary-name collision fails safely without deleting
another export. No dependency is added; temporary and final files share a filesystem.

Four ZIP entries remain: `incident.json`, `events.jsonl`, `health.jsonl`, `README.txt`.
`incident.json` additionally contains `incident_timestamp`, `export_timestamp`,
`zip_filename`, `radio`, `frequency`, `trigger`, `pre_capture_complete`,
`post_capture_complete`, `dropped_records`, `diagnostic_version` and evidence availability.
Incident ID/type/mode and original capture details remain present. Diagnostic `radio`
is the configured project label AU-510M, not an invented serial number.

Temporary path:
`/mnt/dietpi_userdata/node-red/data/exports/export-<exportId>.zip.tmp`.
Final path:
`/mnt/dietpi_userdata/node-red/data/exports/<timestamped filename>.zip`.
Files remain for seven days; existing startup/six-hour cleanup is preserved and accepts
both old and new filename formats. Each successful browser export emits one JSON
`EXPORT_CREATED` line to the Node-RED process log/journal with export timestamp,
incident ID/type, ZIP filename and absolute ZIP path.

The existing UI/HTTP workflow is preserved:
`POST /au510m-diag/incident/:id/export` generates a new file, then
`GET /au510m-diag/export/:exportId` streams the stored file. Content-Disposition
uses exactly the same timestamped filename. Capability/size/age/symlink checks,
row/byte limits and SELECT-only export access remain.

## Verification

`bash scripts/validate-repository.sh` passes, including the new
`scripts/test-au510m-tune-trace.mjs`. It exercises all six requested cases with the
installed Flex encoder/decoder and an in-memory transport: normal on/off,
TUNE→TX→RX, reactivation after RX, repeated cycles, same incident twice, and two
incidents at exactly the same export millisecond. It also verifies source UNKNOWNs,
epoch reset, raw evidence equality through SQLite/JSONL/ZIP, incident reactivation
metadata, winter/summer timezone offsets, forced collisions and attachment headers.
Natural incident fixture replay and existing persistence/detector tests still pass.
No hardware TX/TUNE or oscillation was induced.

Live checks on 2026-10-31: 99 nodes; v4.35; CONNECTED, RX, slice A, logger RUNNING,
SQLite READY, zero logger/observer errors and zero SQLite dropped records. Existing
RADIO/PA/METER/DIAG widgets continued receiving live data; dashboard HTTP 200;
AGC-T v4.35 with fresh LEVEL and IDLE. The pre-change watcher ERROR state was recorded
in the baseline and cleared through its existing initialization on deployment;
no watcher logic was changed. Browser/kiosk rendering was not available on this host.

Three real exports of two existing incidents at 15:00:40.355, .564 and .727 CET
produced distinct server ZIPs and successful downloads, all with matching attachment
filenames, valid CRCs and metadata. The incident table hash was unchanged. Three
matching EXPORT_CREATED entries were verified in the journal. Offline tests, not
live radio operation, verify the TUNE transition cases. Runtime checks do not claim
that any external program's TUNE causality has been identified.

Final deployment revision:
`8ada4c26cfd0ce9f37f261d001b94bfa177530058afed6f141599d17b05a055f`.
The final post-deploy export and runtime checks also passed.
Machine-readable results: [validation](measurements/au510m-v4.35-validation.json).

## Changed nodes/functions and files

Flow nodes: `au510m_diag_stage1` initialization/cache lifecycle;
`au510m_diag_export_service` initialization/cache lifecycle;
existing watcher tab release environment, maintained centrally. No UI template,
control wiring, route or unrelated flow node changed.

Functions: `observe`/send and receive wrappers; `DiagnosticBuffer.traceContext`,
`tune`, `commandRequest`, `connection`; `IncidentDetector.consume`, `abnormal`,
`trigger` metadata only; `Trace.metadata/evidence/columns`; persistence
`record/incident` and additive `Store` migration; export policy projection;
`ExportClient.generate/request`; worker forwarding; `generate/exportClock`.

- `agct-watcher-version.json`
- `diagnostics/au510m-command-observer.cjs`
- `diagnostics/au510m-command-policy.cjs`
- `diagnostics/au510m-export-client.cjs`
- `diagnostics/au510m-export-policy.cjs`
- `diagnostics/au510m-export-worker.cjs`
- `diagnostics/au510m-incident-detector.cjs`
- `diagnostics/au510m-incident-export.cjs`
- `diagnostics/au510m-persistence-sanitize.cjs`
- `diagnostics/au510m-persistence-store.cjs`
- `diagnostics/au510m-stage1-core.cjs`
- `diagnostics/au510m-stage1-runtime.cjs`
- `diagnostics/au510m-trace.cjs`
- `docs/architecture.md`
- `docs/au510m-tune-tracing-v4.35.md`
- `docs/measurements/au510m-v4.35-validation.json`
- `examples/05-agct-watcher.json`
- `flows.json`
- `flows/agct-watcher.json`
- `flows/dashboard.json`
- `scripts/test-au510m-command-logging.mjs`
- `scripts/test-au510m-export.mjs`
- `scripts/test-au510m-tune-trace.mjs`
- `scripts/validate-repository.sh`
