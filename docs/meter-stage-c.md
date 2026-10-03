# METER Stage C — display-only needle test

Version pair: OLD_VERSION 4.8 / NEW_VERSION 4.9, maintained in
`agct-watcher-version.json`. Documentation checkpoint: `cb4a0b6`;
previous known-good runtime: `5571788`.

The existing SVG face, scale paths, SWR guides, centered FORWARD/REFLECTED
textPaths, pivots, frame and 800×480 layout are preserved. Temporary controls
occupy the unused side margins. Both needles use a 250 ms CSS transform transition
around the existing pivots. The existing ticks follow a square-root scale with a
50-degree sweep: FORWARD 0–500 W, REFLECTED 0–100 W in the opposite direction.

| Preset | FWD W | REF W | SWR |
| --- | ---: | ---: | ---: |
| ZERO | 0 | 0 | 1.00 |
| LOW | 50 | 1 | 1.33 |
| MEDIUM | 150 | 5 | 1.45 |
| HIGH | 300 | 20 | 1.70 |
| FULL | 500 | 100 | 2.62 |

Values are Vue-local display state. The METER node has no incoming wires and an
empty output; no radio commands, subscriptions, connection definitions, existing
Function bodies or existing data paths were changed. Only the METER template and
central watcher version environment changed in active flows.

## Validation on 3 October 2026

- Repository validation passed, including Function JavaScript, Vue compilation,
  the single top-level `export default` rule, watcher tests and export consistency.
- Dashboard tests exercise all preset handlers, range clamping, both sweep
  directions, needle endpoints and alignment with the unchanged scale ticks.
- A structural comparison with the checkpoint verified all existing nodes and
  wiring, and the SVG face outside the animated needle block, remain unchanged.
- Local preview and deployed Dashboard were tested in Chromium at 800×480.
  All five presets and their numeric readouts passed. Intermediate animation
  and final angles were checked; SVG and scale DOM elements retained identity.
  Each preset screenshot was visually inspected. The SVG remains 636.7×388 px;
  controls do not overlap it, and navigation/footer remain visible without
  scrolling or clipping. Both textPaths remain unchanged and render correctly.
- Automatic deployment succeeded: 83 nodes, revision
  `a535718132a144927ce228152d10056a9ba9670a3981b8ab8e6147f801064c8b`.
- RADIO, PA and AGC-T show current radio data; PA reports 12/12 live meters.
  Watcher LEVEL/AGC+ timestamps advance and remain fresh. TX, RX and EXT also open;
  their existing stale/unavailable readings were not changed by this feature.
- The METER generated no command requests and no template errors.

An existing initial-render console error in the unchanged RADIO/AGC-T component
reads `Cannot read properties of undefined (reading 'radioStatus')`. It occurs
before initial message state is populated; the pages subsequently display live
data. An isolated browser comparison substituted the old v4.8 METER template
without modifying the server and reproduced the same LOAD error with both old
and new templates. No new runtime errors were observed. This existing issue was
left outside the Stage-C change.

Stage C ends here. Stage D may connect FWDPWR only when separately requested;
REFPWR and SWR remain unconnected to METER.
