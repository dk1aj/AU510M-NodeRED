# METER Stage C — historical simulation

Stage C (v4.10) established synthetic needle controls, a shared calibration
and mathematically generated SWR guide intersections. Its former fixed-Watt
simulation limits and calculated visible SWR are obsolete and must not be
reused as current meter rules.

The current authoritative model is documented in [cross-needle-meter.md](cross-needle-meter.md).
Both needles normalize against the central 20/200/2000 W FORWARD range.
Fixed printed FORWARD 0–20 and REFLECTED 0–4 are reference-supported base
scales with common range multipliers. Both needles now use canonical live
FWDPWR/REFPWR Watts; Stage-C presets belong to the historical simulation only
and have been removed from the live UI. Visible numeric SWR is canonical live
radio SWR only. See the [current handoff](handoff-2026-10-03-v4.19.md).

Historical validation is not acceptance of a later runtime version. The
physical kiosk/touch and fresh TX/RX checks remain separate requirements.
