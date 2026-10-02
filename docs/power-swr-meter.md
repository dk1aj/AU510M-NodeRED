# Power / SWR cross-needle meter

The METER tab is the seventh-button 800×480 kiosk navigation sequence: RADIO,
METER, PA, TX, RX, EXT, AGC-T. It is a local FlowFuse `ui-template` on the active
dashboard page. Its SVG source is `meter/power-swr-template.vue`; the matching
display-only Function source is `meter/power-swr-state.cjs`. The active copies are
embedded in `flows.json` and checked for equality by `meter/test-power-swr.cjs`.

The visual reference is `reference/power-swr-meter-reference.jpg` (the supplied
file is JPG, despite the request calling it PNG). The native SVG recreates its
anthracite case, warm amber face, opposing power arcs, crossed needles, central
SWR guide field and dark bottom SWR strip. The reference image is not loaded by
the live dashboard. The SVG viewBox is 640×390 and scales within the 800×480 tab.

The existing meter stream supplies `TX-/1/FWDPWR`, `TX-/2/REFPWR` and
`TX-/3/SWR`; the existing normalized radio status supplies TX/RX. The new Function
has no FlexRadio connection, request node or subscription output. Every valid
dBm sample is converted with `10 ** ((dBm - 30) / 10)` before entering its own
500 ms arithmetic Watt window. SWR is averaged from the radio's SWR samples,
never calculated from the two power readings. A 100 ms local display tick sends
the latest window to the UI; numeric values update every 250 ms. The two needle
transforms use 200 ms CSS transitions. RX, disconnect, stale radio status and
the start of a new TX period clear prior samples.

Forward uses 0–500 W and reflected uses 0–100 W. Their SVG angles are graphical
clamps only; numeric source values retain their actual magnitude. The static SWR
guide paths are generated from intersections of the two needle rays. For each
guide, `rho = (SWR - 1) / (SWR + 1)` and reflected power equals forward power
times `rho²`. The displayed SWR number still comes from `TX-/3/SWR`.

`node meter/test-power-swr.cjs` uses synthetic display-only values to verify
sample conversion, smoothing order, TX/RX clearing, staleness, angle bounds and
guide geometry. It sends no message to the radio. A successful offline or HTTP
check does not establish physical calibration or visual behavior in Chromium.
