# Cleanup inventory

Inventory date: 2026-09-23. Decisions preserve the live installation.

| Classification | Files | Decision |
|---|---|---|
| KEEP | flows.json, settings.js, package*.json | Preserve runtime paths, IDs, configuration and dependencies |
| KEEP | examples/, scripts/, radio-status/ | Current sources, starter examples, tests and deployment/history helpers |
| KEEP | stream-deck-plugin/, rfpower-icons/ | Existing runtime/plugin contracts |
| KEEP | streamdeck-rfpower/ | Divergent 2.0.0 copy; deployment provenance uncertain |
| KEEP | AGENTS.md, .github/agents/ | Project instructions |
| ARCHIVE | station-dashboard/ -> archive/station-dashboard/ | Separate unused disabled prototype, retained whole |
| ARCHIVE | CODEX_HANDOVER.md -> archive/CODEX_HANDOVER-2026-09-22.md | Historical handoff replaced with current pointer |
| REMOVE | none | Nothing proven both disposable and unnecessary |
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

The requested coarse/fine prototype, +2 offset, fixed 2 dB range criterion,
prototype state names and restore-on-abort are inconsistent with version 3.7.
Document the actual behavior instead of changing it during cleanup. AGC+ is not
a required radio input, but its internal compatibility key/fallback remains;
removing it would change behavior and is out of scope.

Review old plugin copies/releases and migration tools separately before removal.
Establish a documented full hardware calibration and service procedure. No license
was found; only the owner should select a project license. No remote URL is invented.
