# RADIO status and display helpers

See ../docs/architecture.md and ../docs/meters.md for current station behavior.

live-state.cjs merges slice/interlock status and selects the active slice.
average-display.cjs supplies display-only rolling averages. Maintained offline
tests are live-test.cjs and average-test.cjs.

The remaining deployment/preparation scripts, patch JSON files and capture flow
are historical migration artifacts. Their snapshot assertions refer to earlier
flows. Do not replay them as an installation recipe; check.cjs is not a current
runtime check. They remain together to preserve dependencies and history.
LIVE-MAPPING.md records field mappings and historical deployment notes.
Root flows.json is authoritative.
