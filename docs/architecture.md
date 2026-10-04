# Architecture

```mermaid
flowchart LR
 R[FlexRadio AU-510M] --> F[node-red-contrib-flexradio]
 F --> N[Status and meter normalization]
 N --> B[Existing processed meters and radio status bridge]
 B --> D[800x480 RADIO / PA / TX / RX / EXT dashboard]
 B --> P[METER-only projection]
 P --> M[Live cross-needle METER]
 F --> W[AGC-T watcher]
 W --> S[Status cache and HTTP API]
 S --> D
 S --> U[Standalone UI]
 W --> G[RX and single-use write permit]
 G --> F
```

Root flows.json contains 84 nodes and five tabs: disabled rfpower-watt, disabled
and enabled manual meter-list tabs, enabled 35-meter dashboard, enabled watcher.
Historical TEST/EXPERIMENT names do not make live paths disposable. Five ui-template
nodes implement PA/TX/RX/EXT and METER; the PA template also owns RADIO and AGC-T.
Browser navigation events synchronize all mounted widgets. METER is an additional
consumer of the existing processed values, not an intermediate RADIO/PA path.

The backend resolves numeric meter IDs from inventory and preserves source units.
FWDPWR/REFPWR dBm convert to watts with `10 ** ((dBm - 30) / 10)`. Status merges
partial slice updates, selects the unique active slice and uses interlock for
RX/TX. Each dBm power sample converts to Watts before Watt averaging. Display
averaging does not feed the watcher's raw measurements. The METER projection
retains the historical ID `au510m_meter_forward_only` and forwards live FWDPWR,
REFPWR, SWR and normalized TX/RX to `au510m_power_swr_static_ui`. It owns the
one shared 20/200/2000 W range selector. See [meter geometry](cross-needle-meter.md).

Watcher routes: GET /agct-watcher, GET /agct-watcher/status,
POST /agct-watcher/control. Settings controls are same-origin checked and write
agct-watcher-settings.json by atomic rename. Context is memory-only; Auto defaults
OFF. Credential material remains owned by Node-RED.

## Deployment contracts retained

- Host: http://dietpi.fritz.box:1880, Dashboard base /dashboard.
- Radio config 7fbf2bfc9badc7d3 uses automatic discovery; blank host/port.
- FRStack RFPOWER: http://192.168.178.27:5025/Radio/RFPOWER.
- FRStack meters: ws://127.0.0.1:5025/ws/meters on host;
  ws://dietpi.fritz.box:5025/ws/meters from Windows.
- Historical routes: /rfpower-watt, /rfpower-step, /rfpower-icon, /rfpower-plugin,
  /rfpower-mainfan. Only /rfpower-watt exists in today's export and its tab is
  disabled. Do not claim all historical routes are live.
- Stream Deck SDK 2 / embedded Node 20; Windows 10+ / Stream Deck 6.4+;
  N1MM RadioInfo uses Windows loopback UDP 127.0.0.1:12060.
- RFPOWER math, plugin UUIDs, assets and absolute runtime paths remain unchanged.
- Unused MQTT and radio/WebSocket configs remain for compatibility.

No new GPIO, tuning, RF-power, antenna or ATU assumptions were introduced.

Root flows.json remains authoritative. flows/dashboard.json is a dependency-closed
copy with its tab disabled. flows/agct-watcher.json mirrors the disabled example
and reuses the shared radio config. Exporting does not deploy. Historical migration
scripts must not be replayed over the current UI.

The current deployed snapshot and validation limits are recorded in the
[v4.21 handoff](handoff-2026-10-04-v4.21.md). Runtime version values are maintained
only in agct-watcher-version.json and published by watcher status.
