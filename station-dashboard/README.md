# DK1AJ STATION — prepared import, not deployed

Import **dk1aj-station.flow.json** into the existing Node-RED editor. It adds one
Dashboard 2.0 page and two **disabled** flow tabs: dashboard and diagnostics.
No existing node/configuration is included in the import or overwritten.

URL after manual deployment:
**http://dietpi.fritz.box:1880/dashboard/dk1aj-station**

## Evidence and current limits

Read `AGENTS.md` before implementation. The current `flows.json` has 37 nodes,
including `TEST - Flex Basic Status`; the repository guidelines' 51-node inventory
is outdated. Inspected its request and status Functions, the installed FlexRadio
node implementations, meter scaling, parser, and upstream meter/status fixtures.
These fixtures are examples from other Flex radios, **not Aurora measurements**.

Live discovery/status inspection could not be completed: localhost port 1880
refused connection and `dietpi.fritz.box` did not resolve in this execution
environment. No real Aurora `meter list` response or status capture was available.
Consequently **no value is claimed to have been verified on the live radio**.
The diagnostic step below obtains the actual list before selecting any meter IDs.

Reuses existing radio `7fbf2bfc9badc7d3`, Dashboard base `ff_au510m_base`, and theme
`ff_au510m_theme`. No additional radio connection is configured. The existing
radio config uses automatic discovery: confirm that it is connected to the
intended Aurora before interpreting any readings. Existing pages remain intact;
this import adds only the requested station page.

## Display behavior

| Value | Input and conditions | When N/A |
|---|---|---|
| Radio connection | Existing FlexRadio node status, refreshed by integration every 5 s; TCP connection events | Unknown or status older than 12 s; explicit disconnect is shown as disconnected |
| Frequency / mode | `slice/<id>.RF_frequency` (MHz) and `.mode`; unique active slice, otherwise sole slice | Missing fields or multiple slices without a unique active slice |
| RX/TX | `interlock.state`: TRANSMITTING → TX; RECEIVE/READY → RX | Missing or other state; other states are displayed literally alongside N/A |
| TX Power SET | `transmit.rfpower` only; raw radio setting with an explicit unverified-unit label | Missing setting. **Watt conversion remains unverified** |
| Forward Power ACTUAL | Exactly one `FWDPWR` with unit dBm or Watts in actual meter list | Missing/ambiguous meter, invalid value, or no fresh sample |
| Reflected Power | Exactly one `REFPWR` with unit dBm or Watts | Same conditions as forward power |
| SWR | Exactly one `SWR` meter with unit SWR | Missing/ambiguous meter, value below 1, or no fresh sample |
| Temperatures | All listed meters reporting degC or degF, with their reported name/source | No matching units or no fresh sample; available temperature meters are shown individually |
| ATU | Omitted | No verified reliable Aurora status field/semantics available |

Meter IDs are taken exclusively from successful `meter list` responses, never
hard-coded. Names FWDPWR/REFPWR/SWR come from the installed integration's fixtures;
they are used only when the radio actually reports them with supported units.
Unrecognized Aurora-specific names need review of the diagnostic capture; the
flow does not guess their meaning. Multiple power/SWR matches require source
confirmation and intentionally produce N/A instead of selecting an arbitrary PA.

The integration already decodes the wire scaling. The dashboard only converts
decoded dBm to watts (`10 ** ((dBm - 30) / 10)`) and degF to degC. It does not
apply scaling twice, estimate power from the setting, calculate SWR, or force
zero during RX. Meter samples expire after 15 seconds; gauges disappear on N/A.
Slice/transmit status is change-driven and retained while the connection is
confirmed; all telemetry is cleared on disconnect/reconnect. Re-run the manual
diagnostic inject after reconnect to rebuild metadata and subscriptions.

The existing FRStack percent-times-five convention was not applied to direct
`transmit.rfpower`: it is not evidence of the Aurora TCP field's units. Until a
real capture and radio documentation confirm that mapping, SET shows the received
raw setting, not invented watts. There is no FRStack dependency in this flow.

Rendering uses the installed Dashboard 2.0 `ui-template` widget for large text
values and native HTML meter gauges. This supports a variable number of actual
temperature meters and removes gauges entirely when data is unavailable. Only
forward power, SWR and temperatures have gauges. Display scales expand to include
values and are not equipment limits or alarm thresholds. No dashboard events,
buttons, form inputs, or outgoing UI wires can reach the radio. The browser hides
cached values if dashboard snapshots stop for 10 seconds (browser/host clocks
should be synchronized).

## Exact manual import and test procedure

1. Open `http://dietpi.fritz.box:1880`. Export the current flows for your normal
   backup. Import `station-dashboard/dk1aj-station.flow.json` using **Import → file**.
   Both new tabs must initially be disabled. Do not replace existing flows or
   import historical backups. No deployment has been performed by this work.
2. Inspect the import. Confirm exactly one new page, **DK1AJ STATION**; confirm
   both FlexRadio inputs and the request node reference existing config
   `7fbf2bfc9badc7d3`. Confirm the page uses the existing `/dashboard` base/theme.
   No nodes should be unknown/red for missing types or configuration. If those
   existing config IDs are absent, stop and select the corresponding existing
   configs in the editor; do not create a second automatic radio connection.
3. When ready to test, manually enable the two new tabs and deploy **Modified
   Flows**. Confirm no missing-node/configuration errors in the editor/runtime log.
   Verify the existing FlexRadio connection belongs to the intended Aurora.
   Wait at least 5 seconds for connection status; open the station URL above.
   It should show connected (if connected), and N/A for unavailable telemetry.
4. In **DIAGNOSTICS — DK1AJ STATION**, enable the debug node **Actual radio status
   (enable to capture)**. Click **Read telemetry (manual / after reconnect)** once.
   This sends only `sub slice all`, `sub tx all`, and `meter list`. After a successful
   list response it sends `sub meter <id>` for discovered supported meters.
   These subscribe this client to telemetry; they do not tune, set power, or TX.
5. Inspect **Meter list / subscription responses**. Save the complete `meter list`
   response and representative raw `slice/<id>`, `transmit`, and `interlock`
   messages. Each subscription should have `status_code: 0`. If any command is
   rejected, retain the response for diagnosis; do not substitute setting commands.
   Compare meter IDs, names, sources, units, and displayed labels with this response.
6. Compare frequency/mode with the same selected slice in SmartSDR. Compare RX/TX
   with the received interlock state. Compare raw TX SET with `transmit.rfpower`;
   do not interpret it as watts yet. Confirm forward/reflected samples against
   decoded meter values, including the documented dBm conversion. Confirm all
   temperature meters in degC/degF appear individually. ATU must remain absent.
   Inspect the page at desktop width: two columns, large frequency, SET and ACTUAL
   side by side. No sliders/buttons/transmit controls should exist.
7. If the station is already transmitting during independently authorized normal
   operation, observe the existing telemetry passively. **Do not initiate TX,
   tune, change radio settings, or disconnect the radio for this test.** In RX,
   power/SWR may correctly be N/A if the radio does not publish them. TX-only
   readings remain unverified until naturally available.
8. To test stale meters without touching radio settings, temporarily disable only
   the new **Decoded meters with metadata** node in the editor and deploy Modified
   Nodes. After 15 seconds, sampled power/SWR/temperature readings must show N/A
   with no gauge. Re-enable that node and deploy Modified Nodes to resume samples.
   A naturally occurring connection loss should clear all readings; after
   reconnect, click the diagnostic inject again. Do not force a radio restart.
9. Disable the raw-status debug node when capture is complete. Leave the diagnostic
   inject manual. For rollback, disable just the two newly imported tabs and
   manually deploy Modified Flows; no original flow or config needs restoration.

## Files and offline verification

- `dk1aj-station.flow.json`: importable disabled dashboard/diagnostics flow.
- `state.js`: telemetry state/normalization logic, embedded by the builder.
- `dashboard.vue`: Dashboard 2.0 presentation, embedded by the builder.
- `build.js`: rebuilds only the import artifact.
- `test.js`: offline behavior, request safety, reference, and Vue compilation checks.
- `README.md`: evidence, limitations and manual procedure.

From `/mnt/dietpi_userdata/node-red`:

```sh
node station-dashboard/build.js
node station-dashboard/test.js
node -e "JSON.parse(require('fs').readFileSync('flows.json'))"
node --check stream-deck-plugin/src/com.dk1aj.rfpower.sdPlugin/plugin.js
```

Checks passed during preparation: required Dashboard 2.0 types (`ui-page`,
`ui-group`, `ui-template`, plus existing `ui-base`/`ui-theme`) are installed in
`@flowfuse/node-red-dashboard` 1.30.2; required FlexRadio types are installed in
1.2.5. Tests cover parser-shaped status, slice ambiguity/removal, band-status
isolation, unit conversion, meter expiry, connection loss, invalid samples,
ambiguous meters, command allowlisting, node/reference collisions and Vue
compilation. Production JSON and plugin syntax checks passed. Checksums verified
`flows.json`, `package.json`, and `package-lock.json` unchanged.

No npm package was added or required. No service was started/restarted, no flow
was deployed, and no radio command was sent by this work. Browser appearance and
live radio availability remain manual checks, not claimed as passed.
