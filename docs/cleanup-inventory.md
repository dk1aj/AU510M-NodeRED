# Cleanup inventory

Inventory updated: 2026-10-03. Decisions preserve the live installation.
Current runtime: v4.19; maintained version source: agct-watcher-version.json.

| Classification | Files | Decision |
|---|---|---|
| KEEP | flows.json, settings.js, package*.json | Preserve runtime paths, IDs, configuration and dependencies |
| KEEP | examples/, scripts/, radio-status/ | Current sources, starter examples, tests and deployment/history helpers |
| KEEP | stream-deck-plugin/, rfpower-icons/ | Existing runtime/plugin contracts |
| KEEP | streamdeck-rfpower/ | Divergent 2.0.0 copy; deployment provenance uncertain |
| KEEP | AGENTS.md, .github/agents/ | Project instructions |
| ARCHIVE | station-dashboard/ -> archive/station-dashboard/ | Separate unused disabled prototype, retained whole |
| ARCHIVE | CODEX_HANDOVER.md -> archive/CODEX_HANDOVER-2026-09-22.md | Historical handoff replaced with current pointer |
| REMOVE | .npm/_cacache/, .npm/_logs/ | Rebuildable npm cache and old npm logs; no npm process was active |
| REMOVE | /tmp/meter-v416 through /tmp/meter-v419, /tmp/document-v419.py | Own temporary browser previews, screenshots and edit/check scripts; results preserved in the v4.19 handoff |
| DO NOT COMMIT | agct-watcher-settings.json | Local state; removed from tracking, preserved on disk |
| DO NOT COMMIT | flows_cred*, .flows_cred*, .config.runtime.*, .config.users.* | Protected Node-RED material; values not inspected |
| DO NOT COMMIT | node_modules/, .npm/, caches, .env*, keys, logs, temporary files | Local/generated or potentially secret |
| DO NOT COMMIT | backups/, flows.json.bak_*, .flows.json.backup | Retained locally; not installation sources |

Manual experiment nodes and unused configs inside the live flow are untouched.
Old radio-status patches/capture/migration scripts remain together with their
code dependencies. Their baseline assertions apply to historical snapshots;
check.cjs is not a current-runtime test. Do not replay these migrations.
Archive documents may describe original paths and historical validation results.

Disabled exports under flows/ are reproducible, deliberately committed copies.
The exporter rejects embedded credential fields and never writes runtime files.

## Security

Publication candidates and release ZIP contents are checked for private keys,
provider tokens, authenticated URLs and credential literals without printing
values. settings.js contains commented default examples, not active credentials.
Protected runtime credential files are excluded by filename and never opened.
Private station IPs/hostnames are required non-secret configuration and retained.
Local watcher settings existed in previous commits; exclusion now does not erase
history. No history is rewritten. Pattern scanning is not a proof against every
possible secret. Authentication configuration is not changed.

## Documentation conflicts and remaining work

The former coarse/fine prototype and version-3.7 cleanup notes are historical.
Current watcher behavior is documented in [agct-watcher.md](agct-watcher.md):
start 100, coarse steps 10, fine steps 2, configured final offset -1.
AGC+ is not a required radio input; its compatibility key/fallback remains.
No behavior was changed during cleanup.

Review old plugin copies/releases and migration tools separately before removal.
Establish a documented full hardware calibration and service procedure. No license
was found; only the owner should select a project license. No remote URL is invented.

## Completed workspace cleanup — 2026-10-03

Git was clean before cleanup. No untracked non-ignored project files were found.
Removed approximately 114 MiB of allocated cache/log and own temporary-preview
storage (about 105 MiB inside the workspace; the rest under /tmp).
No installed dependency, active flow, asset, backup, release bundle, archive,
credential/configuration material or local watcher setting was removed.
The shared browser/test tooling under /tmp/meter-stage-c-tools was retained.
No npm install/cache-clean operation, service restart, version bump or runtime
deployment was performed. The v4.19 handoff retains the validation summary;
its temporary screenshots and ad hoc test scripts are no longer on disk.

## Backup-Deduplizierung — 2026-10-03

Nach separatem Auftrag wurden 49 Backup-/Archivdateien inventarisiert und
fünf identische ältere Watcher-Snapshots entfernt (276 KiB belegter Speicher).
44 Dateien einschließlich des aktuellen, inhaltlich identischen v4.19-Recovery-
Backups bleiben erhalten. Einzigartige historische Stände und geschütztes
Material wurden nicht entfernt. Vollständiges Inventar, Lösch-/Behaltepaare und
Aufbewahrungsprinzip: [Backup-Bereinigung](backup-cleanup-2026-10-03.md).
Keine Runtime-Änderung, kein Versionssprung und kein Deployment.
