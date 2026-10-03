# Cross-needle RF Power/SWR meter

## Physical principle and project ranges

A directional coupler measures RF power travelling toward the load (forward
power Pf) and returning from the load (reflected power Pr). In a traditional
cross-needle meter the two movements are independent: the FORWARD angle depends
only on Pf; the REFLECTED angle only on Pr. Read SWR at the intersection of the
needle lines using guides that are loci of constant SWR. SWR does not drive a
third needle and does not independently set either power needle.

The currently deployed v4.12 uses legacy FORWARD **0–600 W** and REFLECTED
**0–120 W**. These describe the existing runtime, not the new permanent FORWARD
range requirement. The corrected fixed-scale design is documented below; its
runtime implementation is stopped until a canonical active range source exists. The 5:1
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
remain. In the legacy runtime, Watt labels and tick divisions belong to the same
static configuration. For the corrected multi-range design, printed FORWARD
labels and tick positions are fixed independently of the active range. Changing
20/200/2000 W range must never regenerate or relabel the printed scale. REFLECTED
geometry and its labels are outside this range correction.

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

Stage D connects only canonical processed FWDPWR. A future graphical SWR and the AU-510M
numeric SWR should agree when derived from simultaneous Pf/Pr readings at the
same measurement plane and with compatible averaging, units and calibration.
Radio-provided SWR must not reposition either needle. Differences may reflect
sample timing, averaging, detector limits or raw dBm-to-W conversion. At zero
power the UI must not infer SWR 1 from absent measurements. Stage D is FWDPWR only; Pr and radio SWR stay unconnected.

## Sources and scope

[Bird RF measurement fundamentals](https://birdrf.com/rf-fundamentals-engineers-guide)
explains directional forward/reflected power measurement.
[Bird VSWR and return-loss guidance](https://birdrf.zendesk.com/hc/en-us/articles/4415495986967-Practical-Guidance-on-VSWR-Return-Loss)
covers mismatch and the infinite-reflection limit. The geometry, calibration
and numerical validation above are project-derived, not manufacturer calibration
claims. This display is a simulation, not a calibrated RF measurement instrument.


## Stage D - Live FWDPWR integration

Old version: 4.10; New version: 4.11. Runtime rollback checkpoint: `9d375a1`;
permanent-rules documentation checkpoint: `acd16de`.

### Inspected canonical path

- Source: `7330e8695476df43`, the existing shared FlexRadio meter stream.
- Processing: `2702052aa13cacd0`, "35-meter inventory, subscriptions and display
  snapshots", binds the existing `TX-/1/FWDPWR` meter. Its numeric sample is
  converted once to `row.watts = 10 ** ((raw - 30) / 10)` when the unit is dBm.
  It publishes full meter snapshots on the existing one-second clock.
- Bridge: `au510m_live_bridge` combines the untouched snapshot with
  `radioStatus` from `au510m_live_state`. That existing state node normalizes
  radio/interlock TX/RX. METER never infers TX from power.
- Existing RADIO and PA consumer: `9ee3e94e3758b01f`, the common RADIO/PA widget.
  RADIO's `radioCardMeter()` reads `row.watts`, gates on normalized TX/RX,
  connection/freshness and the current TX interval, and formats whole Watts.
  PA's `reading(row)` reads the same `row.watts` with six significant digits;
  PA retains its existing raw/freshness presentation behavior, including RX.
- The historical `au510m_display_average` has no incoming wires and empty
  outputs. It is not in the working path. No live Watt averaging is performed
  by that node; its historical dBm-mean behavior was not modified. If averaging
  is introduced later, each sample must be converted to W before averaging.

```
existing meter stream -> existing inventory/conversion -> existing bridge
                                                         |-> RADIO / PA (unchanged)
                                                         |-> METER FWDPWR-only projection
                                                             -> METER forward needle
```

The only added branch is from `au510m_live_bridge` to
`au510m_meter_forward_only`. The latter projects the existing `row.watts` and
`row.seen`, online/snapshot timestamps and existing normalized TX/RX state.
It never copies REFPWR, SWR, raw dBm or other radio fields into METER, never
converts power and never sends commands. RADIO/PA remain directly connected to
the bridge. There are no new FlexRadio connections, subscriptions, meter lists
or raw FWDPWR parsers.

### Presentation, gating and truthfulness

FORWARD source is LIVE; REFLECTED source is TEST. `forwardWatts` consumes the
canonical projected value directly. No numeric offsets, correction factors,
alternate conversion or extra power averaging are applied. Snapshots already
arrive at one-second cadence; the existing 250 ms needle transition is retained.
A low-rate one-second browser clock expires stale state even if messages stop;
it does not smooth or fabricate power samples.

The consumer uses the existing normalized RX/TX value with connection and
freshness checks. In RX the live forward numeric display/needle returns to zero.
In TX it requires a valid current-cycle sample (same gate as RADIO), with
10-second snapshot/status freshness and 15-second sample freshness. A previous
TX interval's samples cannot leak into a new interval. Missing, uninitialized,
invalid, disconnected or stale state shows `--` and a resting needle. A new
normalization of interlock events is not implemented.

The numeric value remains the original processed Watt value, formatted to six
significant digits like PA. For example 625 W is still 625 W; only
`forwardWattsToAngle()` clamps the graphical sweep to the 600 W endpoint.
Geometry/calibration, ticks, pivots, lengths, textPath arcs and SWR curves are
unchanged from Stage C. REF remains synthetic and can be changed with the
marked REF TEST presets. Those presets contain no forward values and cannot
override the live needle. The optional SWR readout combines live Pf with TEST Pr
and is explicitly marked CALC TEST; radio-provided live SWR is not connected.

### Validation and next stage

`scripts/test-meter-forward-live.mjs` checks projection immutability, exclusive
FWDPWR forwarding, above-full-scale truthfulness, RX clearing, new-TX-cycle
safety, stale/invalid/uninitialized data and TEST isolation. Existing geometry,
watcher and dashboard tests remain required. Runtime checks compare canonical
messages and real numeric/needle displays on RADIO, PA and METER during TX,
then verify RX clearing, existing pages, connection freshness and 800×480.

Stage D ends after successful deployment, live validation, commit and push.
The next permitted stage is **REFPWR only**. Live SWR comparison is a later
stage, after both live power needles are proven.

### Stage-D result — 3 October 2026

All repository, Function/Vue compatibility, geometry and live-forward tests
passed. Isolated browser fixtures verified missing/invalid inputs, REF TEST
isolation, RX clearing and numeric 625 W with the needle clamped at 600 W;
these fixtures never entered the live Node-RED/radio path.

Automatic deployment succeeded with 84 nodes, revision
`58527e1a7f1433cd82b270768a734ee8618f584e7e4e6edd8eb79dc7207ccded`.
In three simultaneous real Dashboard browser sessions, operator TX produced
canonical FWDPWR 115.61122421920993 W: RADIO displayed 116 W, PA 115.611 W and
METER 115.611 W. The forward needle measured 21.947448° on the unchanged
calibration. Two matching TX observations and the subsequent RX transition
were recorded: RADIO/METER returned to 0 W and the forward needle to rest.
No transmit or power command was sent by the tests. One operating power level
was observed; above-range behavior was checked offline rather than forcing
higher transmitter power.

The control test initially assumed RX throughout; another actual TX transition
invalidated that test assumption. The test was corrected to accept the actual
normalized RX/TX state and require canonical live forward values. The previously
passed real TX/needle/RX observations were retained; the corrected final
control, provenance and freshness checks also passed. 153 live METER messages
matched the RADIO/PA canonical message values exactly. No runtime compensation
or feature-code change was made in response to the test assumption.

Existing FWDPWR, REFPWR and SWR rows remained fresh; PA reported 12/12 live
meters. AGC-T and advancing AU-510M LEVEL/AGC+ timestamps passed. The 800×480
instrument, full-scale labels, textPaths, controls, navigation and footer were
verified without clipping or scrolling. The known initial RADIO/AGC-T
`radioStatus` console error appeared once per browser context (three contexts);
no additional initialization/template errors were observed. METER itself had
no errors. Permanent-rule commit `acd16de` was separately pushed without a
version change or deployment. Stage D stops here; REFPWR-only is next.


## Numeric top boxes (v4.12)

The initial calculated TEST-SWR display described here was superseded by the
canonical live-SWR correction below within the same uncommitted change set.

Old version: 4.11; New version: 4.12. Known-good checkpoint: `12beeca`.
The v4.11 template had no top boxes; the user authorized adding two boxes
without changing the existing meter geometry. Both are 90×34 SVG units at
(24,22) and (526,22), near the outer left/right face edges, above the needle sweeps.

The cyan box displays only canonical live FWDPWR plus W. At least 10 W rounds
to whole Watts; lower powers display at most one decimal. RX displays 0 W;
unavailable data displays -- without a unit. Formatting never changes the
underlying Watt value. A 625 W sample displays 625 W while the needle clamps
at its unchanged 600 W limit. The duplicate side-panel FWD readout is removed.

The red box displays only the existing calculated TEST SWR, with two decimals
or -- for invalid conditions. REF remains synthetic, controlled by the existing
TEST presets. Source attributes and the footer retain the LIVE / TEST distinction.
No REFPWR or radio SWR is connected. RADIO, PA, AGC-T, shared data handling,
needle calibration, curves, pivots and textPath arcs are unchanged.

Validation status for this change:
- Repository validation, Vue compatibility, unchanged shared flow paths and
  unchanged geometry passed. Both complete needle sweeps clear the new boxes.
- Browser checks at 800×480 passed: RX reset, invalid inputs, all REF presets,
  compact formatting and truthful 625 W with a 600 W needle limit. Final text
  bounds also passed for 0, 4.2, 124, 487, 625 and 10000 W.
- Final validated configuration deployed successfully. RADIO, PA, METER RX and
  AGC-T worked; actual LEVEL/AGC+ updates advanced. Only the documented existing
  RADIO initialization issue was observed; no additional runtime errors.
- No operator TX was observed during the five-minute final observation window.
  The simultaneous live TX comparison and subsequent RX return are pending.
  Commit and push must wait for that successful check.

The user subsequently requested positioning only within the same uncommitted
v4.12 change set: both boxes moved to the outer edges, at (24,22) and (526,22).
Their 90×34 dimensions and vertical alignment are preserved. Only four horizontal
SVG coordinates changed; the component script, CSS, data paths and other flow
nodes are identical to the previously deployed v4.12 configuration. No version
bump, commit or push was performed, as explicitly requested.

After the edge adjustment, repository validation and browser checks at 800×480
passed. Equal frame margins, text bounds, scales, ticks, labels, textPaths, SWR
curves and both complete needle sweeps were checked for overlap. The configuration
was redeployed successfully and matched the validated local flows. RADIO, PA,
METER RX and AGC-T worked with fresh AU-510M data; no additional runtime errors
were observed beyond the documented initial RADIO error. TX comparison, commit
and push remain pending.


## Correction: visible SWR is canonical live radio SWR (same v4.12 change set)

The user superseded the earlier calculated TEST-SWR display requirement. This
correction is now permanent in AGENTS.md. The red numeric box consumes the
already processed `TX-/3/SWR` row from the same existing RADIO/PA bridge as
FWDPWR. The existing projection adds only value, sample timestamp and availability
for SWR. There is no new radio connection, subscription, parser or normalization.
RADIO/PA and their pipelines remain unchanged. METER follows RADIO's TX-cycle
and freshness validity: RX or unavailable live SWR displays --. PA retains its
existing raw-meter presentation in RX.

All visible calculated SWR has been removed, including the side-panel SWR.
Calculations remain internal for offline geometry checks only. REF presets
continue to control the synthetic reflected needle and never alter live SWR.
The blue FWDPWR box, both box positions/sizes, geometry and scales are preserved.
Footer: FWD / SWR LIVE · REF TEST. Old v4.11 / New v4.12 remain unchanged because
the complete v4.12 change set has not yet passed TX validation or been committed.

Final corrected v4.12 validation completed successfully:
- All repository checks passed, including Vue compatibility, canonical live
  SWR equality against existing RADIO/PA methods and synthetic REF isolation.
- 800×480 layout and numeric bounds passed. No additional template errors were
  observed; the three browser contexts each showed the documented existing
  RADIO initialization error once.
- Actual operator TX produced 76.5596606911257 W: RADIO 77 W, PA 76.5597 W,
  METER 77 W. RADIO/PA/METER SWR all showed 1.41. The live FORWARD needle
  measured 17.85915 degrees, matching its unchanged canonical calibration.
- A lower actual TX sample (0.010232929922807547 W) also agreed: RADIO/METER
  0 W, PA 0.0102329 W, and SWR 1 / 1 / 1.00. Formatting accounts for these
  differences; no correction factors are applied.
- RX after TX reset the FORWARD needle and value to zero; RADIO and METER SWR
  returned to --. Synthetic REF controls preserved canonical forward power
  and the independent live-SWR display.
- 3161 projected messages matched their originating canonical RADIO/PA
  snapshots exactly, including SWR value, availability and timestamp.
- Existing PA, AGC-T and fresh AU-510M LEVEL/AGC+ data continued to operate.

The earlier pending-TX notes above describe intermediate historical states;
the complete corrected v4.12 change set now passes the required TX validation.


## Fixed printed multi-range scale: requirement and source audit

The cross-needle METER uses a fixed printed multi-range scale. Automatic
20 W / 200 W / 2 kW range selection changes only the power-to-angle mapping,
not the visible scale labels. This supersedes the former permanent 600 W
FORWARD range requirement; historical 600/120 W validation results above still
describe the deployed v4.12 implementation.

Use one shared set of physical tick positions and fixed printed values, for
example 0–20. Interpret them directly for 20 W, ×10 for 200 W and ×100 for
2000 W. No runtime relabeling, animation of labels or separate range-specific
faces is permitted. Once a canonical range state exists, normalize live Pf by
that active full scale and apply the existing calibrated geometry. Preserve
needle pivot, arcs, tick positions and FORWARD textPath.

Indicate the single active range separately with secondary text: 20 W, 200 W
or 2 kW. Numeric FWDPWR must always show the actual measured power directly,
for example 8.4 W, 86 W, 640 W or 1.35 kW. All themes (classic-warm,
dark-room-uplight, gr/graphite) must share the same fixed printed values, range
logic, calibration and geometry; only visual styling may differ. Visible SWR
continues to use canonical live radio SWR exclusively.

Canonical active range source: **NOT FOUND** in the inspected project and
existing live interfaces. The audit checked:
- Active and disabled flow Function/template/configuration definitions for
  active range, power range, meter range, full scale and 20/200/2000 W state.
- The existing normalized radio-state node `au510m_live_state`, bridge
  `au510m_live_bridge` and RADIO/PA live payload at
  `/dashboard/_debug/datastore/9ee3e94e3758b01f`. Its radio fields contain no
  active meter range. FWDPWR is a measurement, not an active range state.
- METER's existing projection `au510m_meter_forward_only` and its live payload:
  forward, swr, online, timestamp and radio; no range field.
- Current repository source/documentation and installed FlexRadio integration.

Only one METER Vue component is implemented. The three theme images under
`docs/reference/` are references; they do not implement theme selection or
automatic range state. Thus shared theme behavior cannot yet be verified.

Per the user's explicit stop instruction, this correction changes rules and
documentation only. Runtime v4.12 retains its current printed labels, 600/120 W
mapping and live SWR. No automatic range selection, switching thresholds,
range indicator or new printed face is implemented. The next runtime change
requires the authoritative range-state node/path or an explicit specification
from the user; thresholds and hysteresis must never be guessed.
