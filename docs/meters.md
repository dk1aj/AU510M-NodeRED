# Meter inventory

The METER dashboard is a live SVG cross-needle Power/SWR instrument.
`au510m_live_bridge` branches existing processed PA values into
`au510m_meter_forward_only`, which feeds `au510m_power_swr_static_ui`.
The historical node IDs are preserved although both needles are now live.
FORWARD uses `TX-/1/FWDPWR` Watts, REFLECTED uses `TX-/2/REFPWR` Watts and
visible numeric SWR uses the existing processed `TX-/3/SWR` value.
No additional connection, subscription, parser or Watt conversion is added.
RADIO and PA continue consuming their existing path directly.

Both needles reset to zero in RX and reject stale/invalid samples or samples
from a previous TX interval. Numeric SWR is TX-gated; unavailable/RX shows --.
The centrally selected 20/200/2000 W range uses FORWARD only and applies to
both needles; printed scale labels stay fixed. See
[cross-needle geometry and range rules](cross-needle-meter.md) and the
[current v4.19 handoff](handoff-2026-10-03-v4.19.md).

This table is extracted from the active 35-meter display configuration. It lists
configured identities, not a claim that every one is published or verified in
every mode. Numeric IDs come from radio inventory; never copy old capture IDs.

The current watcher has live-observed SLC/<active-slice>/LEVEL and AGC dBm inputs.
AGC metadata describes the signal after AGC. AGC+ is not required; its internal
alias and legacy fallback remain unchanged. Missing display identities stay
unavailable. The watcher selects the active slice dynamically even though the
historical RX display has some slice-specific rows.

| Section | Configured topic | Label | Configured unit |
|---|---|---|---|
| PA | `RAD/334/+13.8A` | +13.8A | V |
| PA | `RAD/300/PACURRENT` | PACURRENT | A |
| PA | `RAD/0/+13.8B` | +13.8B | V |
| PA | `RAD/3/MAINFAN` | MAINFAN | RPM |
| PA | `RAD/7/PASTAT` | PASTAT | raw |
| PA | `RAD/8/PAFETQ1TEMP` | PAFETQ1TEMP | °C |
| PA | `RAD/9/PAFETQ2TEMP` | PAFETQ2TEMP | °C |
| PA | `TX-/6/PAEFF` | PAEFF | % |
| PA | `TX-/1/FWDPWR` | FWDPWR | dBm |
| PA | `TX-/2/REFPWR` | REFPWR | dBm |
| PA | `TX-/3/SWR` | SWR | radio metadata |
| PA | `TX-/4/PATEMP` | PATEMP | °C |
| TX | `COD-/1/MICPEAK` | MICPEAK | radio metadata |
| TX | `COD-/2/MIC` | MIC | radio metadata |
| TX | `TX-/5/HWALC` | HWALC | radio metadata |
| TX | `TX-/0/CODEC` | CODEC | radio metadata |
| TX | `TX-/0/TXAGC` | TXAGC | radio metadata |
| TX | `TX-/0/SC_MIC` | SC_MIC | radio metadata |
| TX | `TX-/0/AFTEREQ` | AFTEREQ | radio metadata |
| TX | `TX-/0/SC_FILT_0` | SC_FILT_0 | radio metadata |
| TX | `TX-/0/COMPPEAK` | COMPPEAK | radio metadata |
| TX | `TX-/0/SC_FILT_1` | SC_FILT_1 | radio metadata |
| TX | `TX-/0/ALC` | ALC | radio metadata |
| TX | `TX-/0/RM_TX_AGC` | RM_TX_AGC | radio metadata |
| TX | `TX-/0/SC_FILT_2` | SC_FILT_2 | radio metadata |
| TX | `TX-/0/TX_AGC` | TX_AGC | radio metadata |
| TX | `TX-/0/B4RAMP` | B4RAMP | radio metadata |
| TX | `TX-/0/AFRAMP` | AFRAMP | radio metadata |
| TX | `TX-/0/POST_P` | POST_P | radio metadata |
| TX | `TX-/0/ATTN_FPGA` | ATTN_FPGA | radio metadata |
| RX | `SLC/0/24kHz` | 24kHz | radio metadata |
| RX | `SLC/0/ESC` | ESC | radio metadata |
| RX | `SLC/0/LEVEL` | LEVEL | radio metadata |
| RX | `SLC/0/AGC+` | AGC+ | radio metadata |
| EXTERNAL | `EXT_WVF/0x3925F196/FreeDV_SNR` | FreeDV_SNR | radio metadata |

## Units and freshness

The integration already decodes wire scaling. FWDPWR/REFPWR retain dBm and convert
each sample to W with `10 ** ((dBm - 30) / 10)` before averaging Watts.
The table lists configured/source units; the live power readouts display the
existing processed Watt values. PASTAT stays raw, without invented bit decoding.
Gauges are visual scales, not protection thresholds. Display samples normally
expire after 15 s; watcher writes require dBm samples no older than 3 s and current
RX. Display-only averaging does not feed calibration samples. Historical AGC+
display rows are not renamed during repository cleanup.
