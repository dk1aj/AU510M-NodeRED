# Cross-needle RF Power/SWR meter

## Physical principle and project ranges

A directional coupler measures RF power travelling toward the load (forward
power Pf) and returning from the load (reflected power Pr). In a traditional
cross-needle meter the two movements are independent: the FORWARD angle depends
only on Pf; the REFLECTED angle only on Pr. Read SWR at the intersection of the
needle lines using guides that are loci of constant SWR. SWR does not drive a
third needle and does not independently set either power needle.

This project requires FORWARD **0–600 W**, with 600 W the hard full scale, and
REFLECTED **0–120 W**, initially. The latter is centrally configurable. The 5:1
range relationship follows the common cross-needle convention (for example
300/60 W or 3000/600 W); it is a display range choice, not an SWR equation.
The maintained configuration is `meterGeometry` inside `data()` of
`meter/power-swr-static-template.vue`: `FORWARD_FULL_SCALE_W` and
`REFLECTED_FULL_SCALE_W`. The flow embeds that same component; no second scale
configuration is maintained. Both full-scale endpoints must remain visible.

## Physics and special conditions

For power measurements with the same reference impedance and at the same
measurement plane, the magnitude of the voltage reflection coefficient is:

```
rho = sqrt(Pr / Pf)
SWR = (1 + rho) / (1 - rho)
    = (sqrt(Pf) + sqrt(Pr)) / (sqrt(Pf) - sqrt(Pr))
```

The ordinary finite equation is valid for Pf > 0 and 0 <= Pr < Pf. For a given
finite SWR S the inverse is:

```
rho = (S - 1) / (S + 1)
Pr / Pf = rho^2
Pr = Pf * ((S - 1) / (S + 1))^2
```

Pr = 0 with Pf > 0 means SWR 1.0. As Pr approaches Pf from below, SWR tends to
infinity. Pf <= 0 makes SWR undefined, including Pf = Pr = 0. Negative powers,
nonfinite inputs and Pr >= Pf are unusable for the ordinary numeric display.
`calculatedSwr()` returns null for these cases and the display uses `--`;
NaN/Infinity are never formatted as ordinary numeric text. The optional infinity
*guide* is a geometric limit with Pr = Pf, not a finite SWR reading.

## Inspected starting SVG (v4.9 / e3e7053)

| Property | FORWARD | REFLECTED |
| --- | --- | --- |
| Pivot (SVG units) | F = (450, 340) | R = (190, 340) |
| Absolute zero direction | 180° (left) | 0° (right) |
| Absolute full-scale direction | 230° (up-left) | −50° (up-right) |
| CSS rotation from rest | 0° to +50° | 0° to −50° |
| Needle length / outer scale radius | 378 | 378 |
| Inner scale radius | 360 | 360 |
| Label arc radius | 410 | 410 |
| textPath target | forward-label-arc | reflected-label-arc |

SVG viewBox: `0 0 640 390`. Face: (13,14), width 614, height 330.
Frame, pivots, rest endpoints, lengths, 50° sweep, viewBox and textPath paths are
preserved. Existing scale numbers were 0–500 / 0–100 W. They are replaced by the
required 0–600 / 0–120 W numbers. The old SWR paths are replaced, because their
relationship to the current needle mapping was not guaranteed.

The visual reference `docs/reference/power-swr-meter-reference.jpg` informs
appearance and label placement only; it cannot override the physics.

## One canonical power-angle calibration

The old scale is clearly nonlinear: the 100 W tick on a 500 W range lies at
22.36068°, rather than the linear 10°. Its normalized sweep follows 50 sqrt(q),
where q is power/full-scale. Preserve this character using **one explicit
normalized calibration table**, `meterGeometry.calibration`, and piecewise
linear interpolation between its points. The table captures the previous
forward minor-tick fractions in increments of 0.04 and reflected fractions in
increments of 0.05, plus additional points at 0.5-degree sweep intervals to resolve low power
and avoid visually coarse interpolation corners. Angle entries are recorded values, not separately evaluated
formulas in the display. The endpoints are exactly (0,0°) and (1,50°).

For q between table points (q0,a0) and (q1,a1):

```
angle(q) = a0 + (q - q0) * (a1 - a0) / (q1 - q0)
```

`forwardWattsToAngle(Pf)` interpolates q = Pf / FORWARD_FULL_SCALE_W;
`reflectedWattsToAngle(Pr)` interpolates q = Pr / REFLECTED_FULL_SCALE_W and
negates the result. Both clamp finite power to their display range; invalid
angle inputs go to rest. SWR uses the original powers, not clamped readings.

All scale marks, scale arcs, needle rotations and SWR-curve sample directions
use these same methods. No independent tick mapping or decorative SWR paths
remain. Watt labels and tick divisions belong to the same configuration. A
change to reflected full scale updates its labels, directions and SWR guides.

## Proper line/ray intersection

Use SVG coordinates (positive y down). For mapped rotations aF and aR:

```
u = (−cos(aF), −sin(aF))
v = ( cos(aR),  sin(aR))
P = F + t*u = R + s*v
cross(a,b) = a.x*b.y - a.y*b.x
D = cross(u,v)
t = cross(R-F,v) / D
s = cross(R-F,u) / D
P = F + t*u
```

Angles in the trig functions are radians. If abs(D) < 1e-9, return no point;
zero/rest needles are parallel/collinear, so their intersection is not unique.
Reject nonfinite points, negative ray distances and intersections past either
378-unit needle tip. Curve points must also lie within the meter face. Pivots
are not moved to simplify this calculation.

## Mathematically generated SWR guides

For S = 1.2, 1.5, 2, 3, 5 and 8, calculate k = ((S−1)/(S+1))^2. Sample Pf from
positive power up to min(600,120/k), then set Pr = Pf*k. Include the endpoint
exactly. Feed Pf/Pr through the canonical angle methods and intersect the
resulting rays. Reject impossible/out-of-range/parallel geometry. Connect the
valid sample points as an SVG polyline path (M/L commands). Dense sampling gives
a smooth rendered curve without guessing Bézier control points or overshooting.
Generated points retain Pf/Pr metadata for offline validation.

The infinity guide is derived only from Pr = Pf over 0 < Pf <= 120 W, the
range representable on both scales. It is optional if crowding prevents a
readable label. Finite guide 8 and infinity use spaced labels in the interior;
label placement changes their annotation, never the underlying curve points.

Scale/guide computed values depend only on `meterGeometry`, so selecting a
preset updates needle transforms and numeric readout, without replacing the
SVG, scale or curve elements. CSS transition is 250 ms; no animation library
or continuous timer is needed.

## Synthetic validation cases

| Preset | Pf W | Pr W | Expected SWR |
| --- | ---: | ---: | ---: |
| ZERO | 0 | 0 | -- (undefined) |
| GOOD | 100 | 1 | 1.222222… |
| MEDIUM | 200 | 10 | 1.576014… |
| HIGH | 400 | 40 | 1.924951… |
| FULL-SCALE | 600 | 120 | 2.618034… |

The component derives every displayed SWR from Pf/Pr; presets do not carry an
independent SWR value. `scripts/test-cross-needle-meter.mjs` validates physics,
calibration, tick/needle agreement, endpoint geometry, line-intersection
residuals and guide generation. For each nonzero preset, compute its intersection
and the theoretical guide for its calculated SWR, then measure distance to that
sampled polyline. The tolerance is 0.25 SVG units, well below one rendered pixel.
Test intermediate powers not present in curve samples and deliberate perturbed
intersections too, so a large mismatch must fail. ZERO must give no intersection.

The same routine checks finite guide 8 and the infinity guide (Pf = Pr <= 120),
parallel safety, invalid power readings and that changing the reflected range
propagates through geometry. Browser validation additionally checks retained DOM
identity, smooth transition, all presets, 600/120 endpoint labels and 800×480.

## Future AU-510M integration

No live data enters this component yet. A future graphical SWR and the AU-510M
numeric SWR should agree when derived from simultaneous Pf/Pr readings at the
same measurement plane and with compatible averaging, units and calibration.
Radio-provided SWR must not reposition either needle. Differences may reflect
sample timing, averaging, detector limits or raw dBm-to-W conversion. At zero
power the UI must not infer SWR 1 from absent measurements. Stage D is FWDPWR
only and requires a separate request; Pr/SWR stay unconnected.

## Sources and scope

[Bird RF measurement fundamentals](https://birdrf.com/rf-fundamentals-engineers-guide)
explains directional forward/reflected power measurement.
[Bird VSWR and return-loss guidance](https://birdrf.zendesk.com/hc/en-us/articles/4415495986967-Practical-Guidance-on-VSWR-Return-Loss)
covers mismatch and the infinite-reflection limit. The geometry, calibration
and numerical validation above are project-derived, not manufacturer calibration
claims. This display is a simulation, not a calibrated RF measurement instrument.
