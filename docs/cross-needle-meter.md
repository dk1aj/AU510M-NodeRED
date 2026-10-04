# Cross-needle RF Power/SWR meter

Current deployed snapshot: [v4.20 handoff](handoff-2026-10-04-v4.20.md).
The maintained version pair is in `agct-watcher-version.json`.

## Canonical data and range

The shared FlexRadio stream `7330e8695476df43` feeds meter processing
`2702052aa13cacd0`. `au510m_live_bridge` supplies RADIO/PA consumer
`9ee3e94e3758b01f` and projection `au510m_meter_forward_only`.
FWDPWR, REFPWR and visible SWR reuse existing processed samples; no new connection,
subscription, parser, dBm conversion or TX/RX normalization is introduced.
The central active range is received as `payload.activeRange`, shared by all
browsers and themes. Its existing thresholds and validity gates are unchanged:

| Current range | Transition | Condition |
| --- | --- | --- |
| 20 W | 200 W | FWDPWR > 20 W |
| 200 W | 2 kW | FWDPWR > 200 W |
| 2 kW | 200 W | FWDPWR < 160 W |
| 200 W | 20 W | FWDPWR < 16 W |

Equality holds the range. Both transition steps run in one update; initial range
is 20 W. RX, zero, invalid, stale and previous-TX samples retain the range.

## Reference-supported fixed printed scales

Only `pwr-meter-classic-warm.png`, `pwr-meter-dark-room-uplight.png` and
`pwr-meter-graphite-dark.png` in `docs/reference` are design references.
All three visibly print FORWARD 0–20 and REFLECTED 0–4, with a common range
legend 20 W ×1 / 200 W ×10 / 2 kW ×100. REFLECTED labels are
0, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.6, 2, 3.6 and 4.
These are base printed values, not a permanent reflected Watt maximum.
Printed values and ticks never change with range or theme.

| Active FORWARD range | Printed multiplier | REFLECTED scale span |
| --- | --- | --- |
| 20 W | ×1 | 0–4 W |
| 200 W | ×10 | 0–40 W |
| 2 kW | ×100 | 0–400 W |

The component derives the ratio from `REFLECTED_PRINTED_MAX /
FORWARD_PRINTED_MAX` (4/20), rather than assigning another fixed Watt limit.
`reflectedFullScaleWatts = activeRange * 4/20` is a computed value consuming
the existing central range; it is not another selector.
The compact range indicator displays the one active FORWARD range. Numeric
FWDPWR remains the actual live value in W/kW without a multiplier.

## One physical model for needles, ticks and SWR guides

The shared geometry uses pivots (430,380)/(210,380), needle length 329,
scale radii 330/319, label radius 347, legend radius 367, zero tilt 8° and
84° sweep. The existing nonlinear normalized calibration is shared by all
scales, needles and curves. FORWARD and REFLECTED legends use SVG textPath.
All themes share this geometry; they modify SVG/CSS styling only.

For physical powers and active range R, let Pf_model = Pf/R and Pr_model = Pr/R.
FORWARD calibrates Pf_model over 0–1. REFLECTED calibrates Pr_model over
0–(4/20). Equivalently the rendered reflected angle calibrates
Pr / (R * 4/20). This makes the rendered needles and guide-generation model
identical for equal normalized samples at 20, 200 and 2000 W.

For each guide S: rho = (S−1)/(S+1), Pr = Pf * rho².
The calibrated rays are intersected with the cross-product equations
`t = cross(delta,v)/cross(u,v)` and `s = cross(delta,u)/cross(u,v)`.
Invalid/parallel/out-of-reach intersections are rejected. Guides 1.2, 1.5, 2,
3, 5 and infinity are sampled mathematically and clipped to the usable
lower guide field y135–353. No bitmap curves are traced.

At SWR 3 and FORWARD full scale, Pr = R/4: 5, 50 and 500 W respectively.
These samples exceed the reference-supported reflected scale spans 4, 40 and
400 W. The reflected needle clamps at its scale end; physics is not changed.
The SWR-3 guide can extend only through physically reachable intersections,
with Pf at most 0.8R because Pr must stay within 0.2R. Ray reach may limit the
visible guide further. A clamped needle is not an accurate over-range SWR
intersection; it must not be used to replace the canonical numeric SWR.

## Live reflected needle and numeric SWR

Both needles consume existing processed PA Watt values through the METER-only
branch: `TX-/1/FWDPWR` and `TX-/2/REFPWR`. No conversion or subscription is added.
REFLECTED uses the same central range and canonical geometry as FORWARD.
The former TEST buttons are removed from the live UI. Both needles have full-width
shafts with opposite black/white contours for legibility near zero, at their
crossing and over scale lines. Light faces use black cores with white outlines;
graphite uses white cores with black outlines. Both share the central theme
definition. The outline has stroke width 2.8 and the core 0.65 SVG units;
both share the full-width blade. Centerlines, tips, pivots and power-to-angle
calibration are unchanged. The centered lower-bar label is DK1AJ. The upper
red numeric box continues to show measured live radio SWR.

Both needles return to zero in RX. Disconnected, unknown, stale, invalid or
previous-TX samples display -- and rest at zero. REFPWR validity is independent
of FWDPWR and SWR validity; numeric values are never graphically clamped.
The visible red box always uses canonical `TX-/3/SWR` with RADIO's existing
TX-cycle/freshness gates; RX/unavailable shows --. Calculated SWR remains
restricted to internal geometry validation.

## Removed obsolete assumptions

The former independent reflected Watt limit was present in AGENTS.md,
this document, the Stage-C/handoff documentation, Vue constant
`REFLECTED_TEST_FULL_SCALE_W`, fixed TEST Watt presets, reflected-angle and
printed-label mapping, and the geometry/live-source tests. The template copy
in active `flows.json` and disabled `flows/dashboard.json` also contained it.
All operational assumptions and fixed Watt presets are removed. Historical
Stage-C and v4.14 handoff documents now explicitly point to this correction.
Neither sample-count values nor unrelated dimensions/network ports represent
reflected-power scale limits and are unchanged.

## Validation

Repository checks cover shared calibration, exact range boundaries, invalid/
stale/RX gates, truthful numeric display, ray residuals, generated guide distance
below 0.25 SVG units and fixed geometry across all themes/ranges. Range-linked
offline normalized samples and the physical SWR-3 examples 5/50/500 W are verified independently.
Rendered REF angles must equal guide-model angles for Pr/R; only over-range
angles clamp. Live TX/nonzero REF and subsequent RX were observed for the
v4.16 integration. Later style/label releases passed RX browser checks and
isolated synthetic previews; they are not new live TX acceptance. Physical
kiosk/touch acceptance remains open. See the current handoff for evidence.

## Reference Geometry Study

Observed before editing SVG, using only the three permitted 900×582 reference
faces. Coordinates below are approximate, not measured calibration data.
All three images have the same layout; differences are surface and lighting.

| Feature | classic-warm | dark-room-uplight | graphite-dark |
| --- | --- | --- | --- |
| Face / bezel | Face roughly x30–870, y16–566, narrow rounded dark bezel | Same bounds, amber face and lower light | Same bounds, graphite face and pale printing |
| Upper arcs | Broad opposing arcs, crossing near x450, y100 | Same curvature and crossing | Same curvature and crossing |
| Curvature / mechanism | Right-side FORWARD center roughly x600, y550; left-side REFLECTED center around x300, y550; radius about 490 | Same mechanism | Same mechanism |
| FORWARD extent | From about x110,y490 to x620,y65, nearly a quarter circle | Same | Same |
| REFLECTED extent | Mirrored, x790,y490 to x280,y65 | Same | Same |
| Numbers / ticks | Numbers outside arcs, dense nonuniform power spacing; long major and fine minor ticks | Same printing | Same printing |
| Curved legends | Outside the left/right lower scale sections | Same | Same |
| Needles | Thin tapered needles, pivots hidden behind bottom strip; visible reach about one scale radius | Same, warm highlights | Same, pale highlights |
| Crossing / SWR field | Central/lower field with fine red guide fan; sample needles cross around x575,y490 | Same | Same, muted copper |
| Lower bar | x45–855, bottom about y568; top y526 with center raised to about y508 | Same | Same |
| Numeric displays | No numeric boxes in reference; project live boxes retained at upper outer edges | Same project addition | Same project addition |
| Vertical balance | Most face height used by arcs/guide field; thin SWR legend at bottom | Same | Same |

Reconstruction uses one 640×390 viewBox, with approximate right/left pivots
(430,380)/(210,380), scale radius 330, a small upward zero direction and a
near-quarter-circle sweep. These are design parameters, not falsely precise
measurements from pixels. Keep the existing normalized calibration shape,
rescaled to the new sweep, and regenerate every guide from ray intersections.
Printed FORWARD values remain fixed 0–20. Both needles now use live power.
All three references print REFLECTED 0–4 with
shared ×1/×10/×100 interpretation, matching the FORWARD 0–20 base scale.
The bitmap's decorative guide strokes are not copied. The mathematical fan
must be generated from the same calibration used for ticks and needles.

## Historical v4.15 runtime checks

Automatic deployment and subsequent RADIO/PA/AGC-T/METER checks passed with
fresh AU-510M data. Deployed flows match the repository; all three themes were
checked at 800×480 with fixed printed scales. Only the documented initial
RADIO error occurred, with no additional regression. Physical kiosk/touch and
fresh TX/RX comparison remain pending. The user explicitly requested saving
this current state as a documented commit checkpoint.
See the [historical v4.15 handoff](handoff-2026-10-03-v4.15.md) for that
release's evidence. Current behavior and remaining checks are recorded in the
[v4.20 handoff](handoff-2026-10-04-v4.20.md).
