#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node -e "JSON.parse(require('fs').readFileSync('flows.json'))"
node --check settings.js
node --check stream-deck-plugin/src/com.dk1aj.rfpower.sdPlugin/plugin.js
while IFS= read -r -d '' file; do node --check "$file"; done < <(find scripts diagnostics radio-status archive/station-dashboard stream-deck-plugin/src streamdeck-rfpower -type d -name node_modules -prune -o -type f \( -name '*.js' -o -name '*.mjs' -o -name '*.cjs' \) -print0)
while IFS= read -r -d '' file; do bash -n "$file"; done < <(find scripts -type f -name '*.sh' -print0)
node --experimental-vm-modules --disable-warning=ExperimentalWarning scripts/validate-repository.mjs
node scripts/export-repository-flows.mjs --check
node scripts/test-agct-watcher.mjs
node scripts/test-agct-dashboard.mjs
node scripts/test-au510m-diag.mjs
node scripts/test-au510m-diag-runtime.mjs
node scripts/test-au510m-state-machine.mjs
node scripts/test-au510m-persistence.mjs
node scripts/test-au510m-persistence-runtime.mjs
node scripts/test-meter-pa-fault.mjs
if [[ -f scripts/test-au510m-incident-detector.mjs ]] && rg -q 'IncidentDetector' diagnostics/au510m-stage1-core.cjs; then
  node scripts/test-au510m-incident-detector.mjs
else
  echo 'SKIP: historical Stage-3 core-integration test draft; active persistence and detector tested above'
fi
if [[ -f scripts/replay-au510m-natural-incident.mjs ]]; then
  node scripts/replay-au510m-natural-incident.mjs
fi
node radio-status/live-test.cjs
node radio-status/average-test.cjs
node archive/station-dashboard/test.js
