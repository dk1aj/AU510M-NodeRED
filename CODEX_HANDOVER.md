# Codex handover

This repository is a live Node-RED RF power / Stream Deck workspace. The working assumptions are documented in AGENTS.md and must be respected during every edit.

## Current status
- Repo initialized locally as a Git repository on branch `main`.
- Static validation passed for the current workspace state:
  - `node -e "JSON.parse(require('fs').readFileSync('flows.json'))"`
  - `node --check stream-deck-plugin/src/com.dk1aj.rfpower.sdPlugin/plugin.js`
  - `node station-dashboard/test.js`
- The project is structurally valid, but live radio / Stream Deck runtime behavior remains unverified unless explicitly checked on the target systems.

## Important rules
- Do not replace the active flow wholesale with historical backups.
- Do not inspect, expose, or modify encrypted credential material in flows_cred.json or related runtime files.
- Preserve route names, UUIDs, and fixed RF-power math contracts.
- Prefer small, targeted edits and re-run the relevant validation commands after changes.
- Do not use `npm ci` as a generic validation step.

## Working approach for future sessions
- Start with the project rules in AGENTS.md.
- Check whether the user request is a live deployment change or a static repo change.
- Only perform minimal edits and validate them immediately.
- If hardware validation is not available, say so explicitly and do not claim live correctness.
