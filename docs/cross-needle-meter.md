# Cross-needle RF Power/SWR meter

## Canonical live values and range state

Current change set: Old v4.12 / New v4.13. Known-good pre-runtime checkpoint:
`48e9dc1`. The existing shared FlexRadio stream `7330e8695476df43` feeds meter
processing `2702052aa13cacd0`; `au510m_live_bridge` supplies existing RADIO/PA
consumer `9ee3e94e3758b01f` and the METER projection `au510m_meter_forward_only`.
The backend converts dBm to Watts once, using W = 10^((dBm - 30)/10).
METER consumes the same processed FWDPWR and SWR without a second connection,
subscription, conversion, parser or normalization pipeline.

The AU-510M/project supplied no active 20/200/2000 W range field, including in
stored radio/interlock and meter context. The user explicitly defined one
project-derived selector in `au510m_meter_forward_only`. Its memory-only
`meterActiveRange` context is the canonical state; every browser/theme receives
`payload.activeRange` from that same selector. On process restart it starts at
20 W. No theme or browser computes its own range.

| Current range | Transition | Exact condition |
| --- | --- | --- |
| 20 W | 200 W | FWDPWR > 20 W |
| 200 W | 2 kW | FWDPWR > 200 W |
| 2 kW | 200 W | FWDPWR < 160 W |
| 200 W | 20 W | FWDPWR < 16 W |

Equality retains the current range. Both steps are evaluated in one update:
20 W + 500 W goes directly to 2 kW, and 2 kW + 10 W to 20 W. Hysteresis is
exactly as specified, with no additional switching timers. RX and zero power
retain the last range. Offline, invalid, stale and previous-TX-interval samples
cannot switch it. Selection resumes immediately on a fresh positive TX sample,
using the existing normalized TX/RX signal and freshness gates.

## Fixed printed face and calibrated geometry

The cross-needle METER uses a fixed printed multi-range scale. Automatic
20 W / 200 W / 2 kW range selection changes only the power-to-angle mapping,
not the visible scale labels. The printed FORWARD scale is permanently 0–20,
with readable labels 0, 5, 10, 15 and 20 at fixed positions and shared ticks.
Interpret printed values directly at 20 W, ×10 at 200 W and ×100 at 2 kW.
No relabeling, label animation or range-specific meter face is allowed.
One small range indicator shows 20 W, 200 W or 2 kW, outside the numeric boxes.

FORWARD needle position uses q = live FWDPWR / activeRange and the existing
piecewise linear calibration table. Inputs of 10/20, 100/200 and 1000/2000
therefore produce the same physical position. Only the angle is clamped;
real numeric power is never clamped and displays W or kW directly.

One common geometry preserves pivots (450,340) and (190,340), needle length
378, radii 378/360/342, label arcs 410, tick positions and the 50-degree sweep.
The fixed model uses normalized FORWARD maximum 1 and REFLECTED maximum 0.2.
This scale-invariant model preserves the established physical SWR curves.
The synthetic reflected needle keeps its existing 120 W test span and presets;
REF live integration is outside this task. FORWARD and REFLECTED use SVG
textPath on `forward-label-arc` and `reflected-label-arc` in all presentations.

## Internal SWR geometry versus visible radio SWR

For internal geometry only: rho = sqrt(Pr/Pf), SWR = (1+rho)/(1-rho), and
Pr = Pf * ((SWR-1)/(SWR+1))^2. Independently calibrated needle rays intersect;
constant-SWR curves are sampled from those intersections, never drawn by eye.
For pivot separation delta, ray vectors u/v and cross product cross(a,b),
t = cross(delta,v)/cross(u,v), s = cross(delta,u)/cross(u,v). Reject parallel,
non-finite, out-of-range and out-of-face results. The existing curve sample
count, calibration, guide labels and physical paths remain shared.

The visible red numeric box ALWAYS uses existing live `TX-/3/SWR`, with RADIO's
TX-cycle/freshness validity. RX/unavailable displays --. The PA page retains its
existing raw-meter presentation on RX. Synthetic REF and calculated geometry
SWR never influence the visible SWR value. There is no visible calculated SWR
in the side panel. The blue numeric box remains canonical FWDPWR: RX is 0 W,
unavailable is --, below 10 W at most one decimal, larger W rounded, and kW
compactly formatted. Both numeric boxes contain values only.

## Themes and permitted references

| Theme ID | Sole reference | Visual direction |
| --- | --- | --- |
| classic-warm | docs/reference/pwr-meter-classic-warm.png | Cream/ivory face, dark printed scales and bezel, restrained instrument depth. |
| dark-room-uplight | docs/reference/pwr-meter-dark-room-uplight.png | Warm illumination from below, amber face and controlled readable contrast. |
| graphite-dark | docs/reference/pwr-meter-graphite-dark.png | Dark graphite face, pale warm scales, muted copper curves and subtle lower illumination. |

Recreate styling natively in SVG/CSS, with one central definition in the existing
Vue component. No bitmap background, external image or other reference is used.
Themes share one geometry, data model, range state and fixed scale. A compact
selector defaults to classic-warm and remembers the current browser/session.
Theme selection changes styling only; no radio commands or messages are sent.

## Validation and deployment

Run repository validation and the meter geometry, live-source and auto-range
tests. These cover exact boundaries, direct transitions, startup/RX/stale
retention, numeric truth, calibration and constant-SWR intersection tolerance
(0.25 SVG units). Vue export default must remain the only top-level statement.
Before each deployment compare shared RADIO/PA/AGC-T and existing source wiring.
Validate at 800×480 without clipping or scrollbars, and verify each theme,
textPath, numeric box, fixed labels and indicator. Use actual radio data for
live comparisons; synthetic inputs are offline tests only. If an existing page
breaks, restore only this task's runtime changes and redeploy known-good flows.

Implement in reversible stages: central range/fixed face first, presentation
and theme selector next. The user requires one v4.13 bump for the whole task;
all stages in this change set share the same centrally published release.
