# Cross-needle RF Power/SWR meter

## Canonical live values and range state

Current change set: Old v4.13 / New v4.14. Known-good pre-runtime checkpoint:
`2146f39`. The existing shared FlexRadio stream `7330e8695476df43` feeds meter
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
with fixed labels 0–10 in steps of one, then 14, 16, 18 and 20, and shared ticks.
Interpret printed values directly at 20 W, ×10 at 200 W and ×100 at 2 kW.
No relabeling, label animation or range-specific meter face is allowed.
One small range indicator shows 20 W, 200 W or 2 kW, outside the numeric boxes.

FORWARD needle position uses q = live FWDPWR / activeRange and the existing
piecewise linear calibration table. Inputs of 10/20, 100/200 and 1000/2000
therefore produce the same physical position. Only the angle is clamped;
real numeric power is never clamped and displays W or kW directly.

One shared reference reconstruction uses concealed pivots (430,380) and
(210,380), needle length 329, scale radii 330/319, label radius 347 and
legend radius 367. The zero direction is tilted upward 8 degrees and the
84-degree sweep rescales the existing normalized nonlinear calibration.
Both upper arcs cross near (320,69); the lower strip rises centrally.
Guide paths are regenerated from the new rays and clipped to the usable
lower SWR field (y135–353), rather than drawing over the upper printed scales.
The fixed model uses normalized FORWARD maximum 1 and REFLECTED maximum 0.2.
This scale-invariant model preserves SWR physics; the physical guide paths
are regenerated for the new pivots and sweep.
The synthetic reflected needle keeps its existing 120 W test span and presets;
REF live integration is outside this task. FORWARD and REFLECTED use SVG
textPath on `forward-label-arc` and `reflected-label-arc` in all presentations.

## Internal SWR geometry versus visible radio SWR

For internal geometry only: rho = sqrt(Pr/Pf), SWR = (1+rho)/(1-rho), and
Pr = Pf * ((SWR-1)/(SWR+1))^2. Independently calibrated needle rays intersect;
constant-SWR curves are sampled from those intersections, never drawn by eye.
For pivot separation delta, ray vectors u/v and cross product cross(a,b),
t = cross(delta,v)/cross(u,v), s = cross(delta,u)/cross(u,v). Reject parallel,
non-finite, out-of-range and out-of-face results. The curve sample count and normalized calibration remain shared. Guides
1.2, 1.5, 2, 3, 5 and infinity are regenerated from the new ray model.

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

Styling is implemented natively in SVG/CSS, with one central `themeDefinitions`
object in the existing Vue component. No bitmap background, external image or other reference is used.
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

The v4.13 range/theme implementation is complete. For v4.14 study references
first, verify static geometry and synthetic intersections offline, then deploy
the geometry-only consumer update with unchanged live inputs. Bump once.

## Completed v4.13 validation

Repository checks, Vue compatibility, all exact threshold/boundary tests and
shared-source tests passed. Offline browser checks verified fixed labels/curves,
identical normalized needle positions at 10/20, 100/200 and 1000/2000, direct
transitions, all-range RX retention, and truthful 2.5 kW above analog full scale.
The normalized model preserves every sampled previous arc/curve point to
less than 1e-8 SVG units. No independent geometry or range selector was added.

All three themes passed individual deployed-browser checks at 800×480, including
text bounds, selector/session retention, navigation, footer and no scrollbars.
RADIO, PA, AGC-T, METER and actual AU-510M LEVEL/AGC+ updates continued to work.
Only the documented initial RADIO error occurred once in each browser context;
no additional template/runtime error was observed.

Actual TX examples: 3.944573020752785 W was shown as RADIO 4 W, PA 3.94457 W,
METER 3.9 W, with SWR 2.84 in all three views. At 4.539416166502032 W, RADIO
showed 5 W, PA 4.53942 W and METER 4.5 W; all SWR displays showed 1.58. These
are normal formatting differences of the same canonical samples. The 20 W
range was active, and the latter needle angle 23.81952 degrees matched the
calibrated mapping. RX returned the forward value/needle to zero and SWR to --,
retaining 20 W in all three themes. REF TEST controls preserved live forward
power and the central range. 8619 projected messages matched their originating
RADIO/PA snapshot values, sample timestamps and SWR availability.

The actual station transmission exercised 20 W range; 200 W and 2 kW were
validated offline with the exact project selector and UI mapping. No radio
power or TX control command was issued. The release was bumped once; staged
range and theme deployments both use the same v4.13 release.

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
Printed FORWARD values remain fixed 0–20. REF remains explicitly synthetic with
its existing 120 W test span; it is not a claim of live reflected measurement.
The bitmap's decorative guide strokes are not copied. The mathematical fan
must be generated from the same calibration used for ticks and needles.

Known-good geometry-reconstruction checkpoint: `2146f3968a48b572260a9c8321100afa05b48894`.
Change set: Old v4.13 / New v4.14. Staging: document reference study first,
then verify static SVG and synthetic intersections offline, then deploy the
geometry-only consumer change and check the existing live pages. No new live
value is connected during this reconstruction.

## v4.14 validation and reference comparison

Repository validation passes, including normalized calibration, ray residuals,
mathematically regenerated constant-SWR paths within 0.25 SVG units, complete
needle-tip bounds over the full sweep, fixed printing across all three ranges,
and identical metrology in all three themes. A node-by-node baseline comparison
confirms that only the METER template and central version environment changed;
all existing data paths and the central range selector are byte-equivalent.

Compared directly with all three permitted references: opposing near-quarter
circle scales now cross in the upper central field, outside-arc numerals are
placed by the same calibration, and the lower mechanism is concealed behind
a dark strip with a raised center. Fine tapered needles replace heavy lines.
The mathematically generated guide fan occupies the lower central field.
Bezel, face and lower strip now use proportions closer to the references.
The same geometric result is used in cream, uplight and graphite presentations.
The reference artwork's decorative straight guide strokes are deliberately not
traced: metrological consistency requires intersections from actual ray mapping.

Project-specific deviations: the two live numeric boxes and one active-range
indicator remain, and the synthetic reflected test span remains 120 W rather
than adopting the bitmap's printed 0–4 labels. No live REFPWR is introduced.
Automated static and deployed Chromium checks target 800×480. A physical kiosk
visual check and fresh operator TX/RX comparison are still pending; HTTP success
and automated browser checks do not establish those two external observations.
The user subsequently explicitly requested documenting and committing this
current state (2026-10-03). It is therefore saved as a checkpoint despite the
two open acceptance checks; committing does not mark either check as passed.
