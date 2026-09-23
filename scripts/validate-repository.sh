#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node -e "JSON.parse(require('fs').readFileSync('flows.json'))"
node --check settings.js
node --check stream-deck-plugin/src/com.dk1aj.rfpower.sdPlugin/plugin.js
while IFS= read -r -d '' file; do node --check "$file"; done < <(find scripts radio-status archive/station-dashboard stream-deck-plugin/src streamdeck-rfpower -type d -name node_modules -prune -o -type f \( -name '*.js' -o -name '*.mjs' -o -name '*.cjs' \) -print0)
while IFS= read -r -d '' file; do bash -n "$file"; done < <(find scripts -type f -name '*.sh' -print0)
node --experimental-vm-modules --disable-warning=ExperimentalWarning scripts/validate-repository.mjs
node scripts/export-repository-flows.mjs --check
node scripts/test-agct-watcher.mjs
node scripts/test-agct-dashboard.mjs
node radio-status/live-test.cjs
node radio-status/average-test.cjs
node archive/station-dashboard/test.js
