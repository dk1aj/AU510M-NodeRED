# Cleanup validation record

Repository-only validation, 2026-09-23. No deployment, radio writes, service
restart, dependency install or runtime configuration edit was performed.

- 17 repository JSON files parsed; 43 embedded Function bodies syntax checked.
- 27 Vue templates compiled, including historical artifacts.
- Flow IDs, wires, shared config references and literal local module/URL paths checked.
- JavaScript helpers/plugin syntax and shell syntax passed.
- Disabled exports match their sources.
- Watcher state-machine, fluctuating-noise, TX/OFF/disconnect, meter-source,
  persistence, exact readback and timeout tests passed.
- Dashboard navigation, QRG saving, HTTP guards and version tests passed.
- RADIO status, display averaging and archived station prototype tests passed.
- AGC-only inventory is covered; no hard-coded active Slice 0 is introduced.
  AGC+ compatibility aliases remain intentionally, as documented.
- 139 historical Git blobs and publication candidates were scanned for secrets.
  No unresolved findings; commented settings.js default examples were reviewed
  as inactive examples. Protected runtime credential files were never opened.
- Root flows.json, settings.js, package.json, package-lock.json and watcher version
  checksums matched the pre-cleanup snapshot.

Existing live behavior and historical Git commits are preserved. This is not an
end-to-end hardware calibration result. The reusable check is
`bash scripts/validate-repository.sh`; it does not run historical migration tools.
