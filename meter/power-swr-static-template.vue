<template>
  <Teleport to="body">
    <section v-if="activeTab === 'meter'" class="aurora-kiosk aurora-meter-static" :data-meter-theme="selectedTheme" :style="{ '--meter-value': theme.text }" data-active="true" aria-label="Live forward power and live reflected power meter">
      <nav class="aurora-tabs" role="tablist" aria-label="Aurora meter pages">
        <button v-for="tab in tabs" :key="tab.key" type="button" role="tab" :aria-selected="activeTab === tab.key" @click="selectTab(tab.key)">{{ tab.label }}</button>
        <span class="aurora-brand">AU-510M <small>LIVE</small></span>
      </nav>
      <div class="meter-test-stage">
        <div class="meter-test-presets" aria-hidden="true"></div>
      <svg id="aurora-panel-meter" class="power-swr-static-svg" viewBox="0 0 640 390" role="img" aria-label="Analog live forward power and live reflected power and SWR">
        <defs>
          <linearGradient id="static-meter-amber" x1="0" y1="0" x2="0" y2="1"><stop offset="0" :stop-color="theme.face[0]"/><stop offset="0.52" :stop-color="theme.face[1]"/><stop offset="1" :stop-color="theme.face[2]"/></linearGradient>
          <radialGradient id="static-meter-glow" cx="50%" cy="94%" r="80%"><stop offset="0" :stop-color="theme.glow" :stop-opacity="theme.glowOpacity"/><stop offset=".6" :stop-color="theme.glow" :stop-opacity="theme.glowOpacity * .22"/><stop offset="1" :stop-color="theme.frame" stop-opacity=".12"/></radialGradient>
          <clipPath id="static-meter-face-clip"><rect x="13" y="14" width="614" height="364" rx="8"/></clipPath>
          <path id="forward-label-arc" :d="labelArc('forward')" fill="none"/>
          <path id="reflected-label-arc" :d="labelArc('reflected')" fill="none"/>
        </defs>
        <rect x="1" y="1" width="638" height="388" rx="13" :fill="theme.frame" :stroke="theme.frameEdge" stroke-width="2"/>
        <rect x="13" y="14" width="614" height="364" rx="8" fill="url(#static-meter-amber)"  :stroke="theme.edge" stroke-width="3"/>
        <rect x="13" y="14" width="614" height="364" rx="8" fill="url(#static-meter-glow)"/>
        <text class="meter-range-value" x="320" y="27" :fill="theme.ink" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="600" text-anchor="middle">{{ activeRangeText }}</text>
        <g class="meter-top-value meter-forward-box" data-fwd-source="LIVE" aria-label="Live forward power">
          <rect x="24" y="22" width="90" height="34" rx="4" fill="#1b2633" stroke="#5bcdf2" stroke-width="2"/>
          <text class="meter-live-value" x="69" y="39" :font-size="forwardBoxText.length > 5 ? 24 * 5 / forwardBoxText.length : 24">{{ forwardBoxText }}</text>
        </g>
        <g class="meter-top-value meter-swr-box" data-swr-source="LIVE" aria-label="Live radio SWR">
          <rect x="526" y="22" width="90" height="34" rx="4" fill="#1b2633" stroke="#ed6666" stroke-width="2"/>
          <text class="meter-swr-value" x="571" y="39" :font-size="liveSwrText.length > 5 ? 26 * 5 / liveSwrText.length : 26">{{ liveSwrText }}</text>
        </g>
        <g class="meter-swr-guides" clip-path="url(#static-meter-face-clip)" fill="none" :stroke="theme.curve" :opacity="theme.curveOpacity" stroke-width="1">
          <path v-for="guide in swrGuides" :key="guide.key" :data-swr="guide.label" :d="guide.path"/>
        </g>
        <g :fill="theme.ink" :stroke="theme.ink" font-family="Georgia,serif">
          <g v-for="scale in meterScales" :key="scale.side" :data-scale="scale.side">
            <path :d="scale.outer" fill="none" stroke-width="1.7"/>
            <path :d="scale.inner" fill="none" stroke-width=".8"/>
            <line v-for="tick in scale.ticks" :key="tick.watts" :data-watts="tick.watts" :x1="tick.start.x" :y1="tick.start.y" :x2="tick.end.x" :y2="tick.end.y" :stroke-width="tick.major ? 1.4 : .6"/>
            <text v-for="label in scale.labels" :key="label.watts" :x="label.x" :y="label.y + (label.watts === 0 ? meterGeometry.zeroLabelBaseline : meterGeometry.labelBaseline)" text-anchor="middle" stroke="none" font-family="Arial,Helvetica,sans-serif" font-size="13">{{ label.printed }}</text>
          </g>
          <text text-anchor="middle" stroke="none" font-size="19" font-family="Arial,Helvetica,sans-serif" font-weight="600" letter-spacing=".5"><textPath href="#forward-label-arc" startOffset="50%">FORWARD</textPath></text>
          <text text-anchor="middle" stroke="none" font-size="19" font-family="Arial,Helvetica,sans-serif" font-weight="600" letter-spacing=".5"><textPath href="#reflected-label-arc" startOffset="50%">REFLECTED</textPath></text>
          <text x="166" y="42" stroke="none" font-size="14" font-weight="bold">W</text>
          <text x="461" y="42" stroke="none" font-size="14" font-weight="bold">W</text>
          <text v-for="guide in swrGuides" :key="guide.key" :x="guide.labelX" :y="guide.labelY" stroke="none" font-size="13" font-weight="bold">{{ guide.label }}</text>
        </g>
        <g aria-hidden="true" clip-path="url(#static-meter-face-clip)">
          <g class="meter-test-needle meter-test-forward" :style="{ transform: `rotate(${forwardWattsToAngle(forwardWatts)}deg)`, transformOrigin: `${meterGeometry.pivots.forward.x}px ${meterGeometry.pivots.forward.y}px` }">
          <path class="meter-needle-outline" :d="needleBlade('forward')" fill="none" :stroke="theme.needleHighlight" stroke-width="2.8" stroke-linejoin="round"/>
          <path class="meter-needle-core" :d="needleBlade('forward')" :fill="theme.needle" :stroke="theme.needle" stroke-width=".65" stroke-linejoin="round"/>
          </g>
          <g class="meter-test-needle meter-test-reflected" :style="{ transform: `rotate(${reflectedWattsToAngle(reflectedWatts)}deg)`, transformOrigin: `${meterGeometry.pivots.reflected.x}px ${meterGeometry.pivots.reflected.y}px` }">
          <path class="meter-needle-outline" :d="needleBlade('reflected')" fill="none" :stroke="theme.needleHighlight" stroke-width="2.8" stroke-linejoin="round"/>
          <path class="meter-needle-core" :d="needleBlade('reflected')" :fill="theme.needle" :stroke="theme.needle" stroke-width=".65" stroke-linejoin="round"/>
          </g>
          <circle :cx="meterGeometry.pivots.forward.x" :cy="meterGeometry.pivots.forward.y" r="5" :fill="theme.pivot" :stroke="theme.pivotEdge"/>
          <circle :cx="meterGeometry.pivots.reflected.x" :cy="meterGeometry.pivots.reflected.y" r="5" :fill="theme.pivot" :stroke="theme.pivotEdge"/>
        </g>
        <path class="meter-lower-bar" d="M24 350 L216 350 Q320 330 424 350 L616 350 L616 378 L24 378 Z" :fill="theme.bar" :stroke="theme.frameEdge" stroke-width=".7"/>
        <text x="320" y="370" :fill="theme.text" font-family="Arial,Helvetica,sans-serif" font-size="23" font-weight="bold" text-anchor="middle" letter-spacing="3">SWR</text>
      </svg>
        <aside class="meter-test-readout" aria-label="Live forward power and live reflected power" aria-live="polite" data-fwd-source="LIVE" data-ref-source="LIVE" data-swr-source="LIVE" :data-active-range="activeRange" :data-forward-state="forwardState" :data-forward-watts="forwardWatts === null ? undefined : forwardWatts" :data-reflected-watts="reflectedWatts === null ? undefined : reflectedWatts">
          <span>REF: <b>{{ reflectedWattsText }}</b><small>LIVE</small></span>
          <label class="meter-theme-select">FACE
            <select v-model="selectedTheme" @change="saveTheme" aria-label="METER face theme">
              <option value="classic-warm">Classic</option>
              <option value="dark-room-uplight">Uplight</option>
              <option value="graphite-dark">Graphite</option>
            </select>
          </label>
        </aside>
      </div>
      <footer class="meter-static-footer"><span>FWD / SWR LIVE</span><span>Old: v{{ oldVersion }} | New: v{{ newVersion }}</span></footer>
    </section>
  </Teleport>
</template>
<script>
export default {
  data() { return {
    activeTab: 'radio', tabListener: null, oldVersion: '…', newVersion: '…',
    selectedTheme: 'classic-warm',
    themeDefinitions: {
      'classic-warm': { face: ['#ded2b1','#fff8e6','#e6d8b9'], frame: '#22292e', frameEdge: '#68706f', edge: '#77715e', glow: '#fff8df', glowOpacity: .24, ink: '#252a2d', curve: '#a65d48', curveOpacity: .88, needle: '#000000', needleHighlight: '#ffffff', pivot: '#252b2d', pivotEdge: '#9a8663', bar: '#22292e', text: '#f1efe5' },
      'dark-room-uplight': { face: ['#9b825f','#b28c59','#dfa965'], frame: '#1a2127', frameEdge: '#525b60', edge: '#5d5141', glow: '#fff0a0', glowOpacity: .66, ink: '#172027', curve: '#914e36', curveOpacity: .92, needle: '#000000', needleHighlight: '#ffffff', pivot: '#222a2c', pivotEdge: '#ac8853', bar: '#1e252b', text: '#fff0c9' },
      'graphite-dark': { face: ['#15191b','#242523','#1c2022'], frame: '#141a1e', frameEdge: '#4f575b', edge: '#444d50', glow: '#a47453', glowOpacity: .18, ink: '#e1d4b4', curve: '#c18a69', curveOpacity: .92, needle: '#ffffff', needleHighlight: '#000000', pivot: '#1a2327', pivotEdge: '#b8a07c', bar: '#141b1f', text: '#e8dbbe' }
    },
    meterGeometry: {
      FORWARD_MODEL_MAX: 1,
      FORWARD_PRINTED_MAX: 20, REFLECTED_PRINTED_MAX: 4,
      pivots: { forward: { x: 430, y: 380 }, reflected: { x: 210, y: 380 } },
      needleLength: 329, outerRadius: 330, innerRadius: 319, labelRadius: 347,
      zeroTilt: 8, sweep: 84, legendRadius: 367,
      labelBaseline: 4, zeroLabelBaseline: 4,
      face: { left: 13, right: 627, top: 14, bottom: 353 },
      swrFieldTop: 135,
      parallelEpsilon: 1e-9, tickDivisions: 80, curveSamples: 1200,
      labels: { forward: [0, .05, .1, .15, .2, .25, .3, .35, .4, .45, .5, .7, .8, .9, 1],
        reflected: [0, .05, .1, .15, .2, .25, .3, .4, .5, .9, 1] },
      guideValues: [1.2, 1.5, 2, 3, 5],
      guideLabelFractions: [.63, .66, .68, .71, .74, .76],
      calibration: [
        [0.0, 0.0],
        [0.0001, 0.5],
        [0.0004, 1.0],
        [0.0009, 1.5],
        [0.0016, 2.0],
        [0.0025, 2.5],
        [0.0036, 3.0],
        [0.0049, 3.5],
        [0.0064, 4.0],
        [0.0081, 4.5],
        [0.01, 5.0],
        [0.0121, 5.5],
        [0.0144, 6.0],
        [0.0169, 6.5],
        [0.0196, 7.0],
        [0.0225, 7.5],
        [0.0256, 8.0],
        [0.0289, 8.5],
        [0.0324, 9.0],
        [0.0361, 9.5],
        [0.04, 10.0],
        [0.0441, 10.5],
        [0.0484, 11.0],
        [0.05, 11.18033989],
        [0.0529, 11.5],
        [0.0576, 12.0],
        [0.0625, 12.5],
        [0.0676, 13.0],
        [0.0729, 13.5],
        [0.0784, 14.0],
        [0.08, 14.14213562],
        [0.0841, 14.5],
        [0.09, 15.0],
        [0.0961, 15.5],
        [0.1, 15.8113883],
        [0.1024, 16.0],
        [0.1089, 16.5],
        [0.1156, 17.0],
        [0.12, 17.32050808],
        [0.1225, 17.5],
        [0.1296, 18.0],
        [0.1369, 18.5],
        [0.1444, 19.0],
        [0.15, 19.36491673],
        [0.1521, 19.5],
        [0.16, 20.0],
        [0.1681, 20.5],
        [0.1764, 21.0],
        [0.1849, 21.5],
        [0.1936, 22.0],
        [0.2, 22.36067977],
        [0.2025, 22.5],
        [0.2116, 23.0],
        [0.2209, 23.5],
        [0.2304, 24.0],
        [0.24, 24.49489743],
        [0.2401, 24.5],
        [0.25, 25.0],
        [0.2601, 25.5],
        [0.2704, 26.0],
        [0.28, 26.45751311],
        [0.2809, 26.5],
        [0.2916, 27.0],
        [0.3, 27.38612788],
        [0.3025, 27.5],
        [0.3136, 28.0],
        [0.32, 28.28427125],
        [0.3249, 28.5],
        [0.3364, 29.0],
        [0.3481, 29.5],
        [0.35, 29.58039892],
        [0.36, 30.0],
        [0.3721, 30.5],
        [0.3844, 31.0],
        [0.3969, 31.5],
        [0.4, 31.6227766],
        [0.4096, 32.0],
        [0.4225, 32.5],
        [0.4356, 33.0],
        [0.44, 33.1662479],
        [0.4489, 33.5],
        [0.45, 33.54101966],
        [0.4624, 34.0],
        [0.4761, 34.5],
        [0.48, 34.64101615],
        [0.49, 35.0],
        [0.5, 35.35533906],
        [0.5041, 35.5],
        [0.5184, 36.0],
        [0.52, 36.05551275],
        [0.5329, 36.5],
        [0.5476, 37.0],
        [0.55, 37.08099244],
        [0.56, 37.41657387],
        [0.5625, 37.5],
        [0.5776, 38.0],
        [0.5929, 38.5],
        [0.6, 38.72983346],
        [0.6084, 39.0],
        [0.6241, 39.5],
        [0.64, 40.0],
        [0.65, 40.31128874],
        [0.6561, 40.5],
        [0.6724, 41.0],
        [0.68, 41.23105626],
        [0.6889, 41.5],
        [0.7, 41.83300133],
        [0.7056, 42.0],
        [0.72, 42.42640687],
        [0.7225, 42.5],
        [0.7396, 43.0],
        [0.75, 43.30127019],
        [0.7569, 43.5],
        [0.76, 43.58898944],
        [0.7744, 44.0],
        [0.7921, 44.5],
        [0.8, 44.72135955],
        [0.81, 45.0],
        [0.8281, 45.5],
        [0.84, 45.82575695],
        [0.8464, 46.0],
        [0.85, 46.09772229],
        [0.8649, 46.5],
        [0.88, 46.9041576],
        [0.8836, 47.0],
        [0.9, 47.4341649],
        [0.9025, 47.5],
        [0.92, 47.95831523],
        [0.9216, 48.0],
        [0.9409, 48.5],
        [0.95, 48.73397172],
        [0.96, 48.98979486],
        [0.9604, 49.0],
        [0.9801, 49.5],
        [1.0, 50.0]
      ]
    },
    forwardSource: 'LIVE', reflectedSource: 'LIVE',
    liveClock: Date.now(), liveClockTimer: null, forwardTxSince: null,
    tabs: [{ key: 'radio', label: 'RADIO' }, { key: 'pa', label: 'PA' }, { key: 'tx', label: 'TX' },
      { key: 'rx', label: 'RX' }, { key: 'external', label: 'EXT' }, { key: 'agct', label: 'AGC-T' }, { key: 'meter', label: 'METER' }]
  }; },
  watch: {
    forwardState: {
      immediate: true,
      flush: 'sync',
      handler(state) { this.forwardTxSince = state === 'TX' ? this.msg?.payload?.radio?.at ?? null : null; }
    }
  },
  computed: {
    reflectedModelMax() { return this.meterGeometry.FORWARD_MODEL_MAX * this.meterGeometry.REFLECTED_PRINTED_MAX / this.meterGeometry.FORWARD_PRINTED_MAX; },
    reflectedFullScaleWatts() { return this.activeRange * this.reflectedModelMax / this.meterGeometry.FORWARD_MODEL_MAX; },
    theme() { return this.themeDefinitions[this.selectedTheme] || this.themeDefinitions['classic-warm']; },
    activeRange() { return [20, 200, 2000].includes(this.msg?.payload?.activeRange) ? this.msg.payload.activeRange : 20; },
    activeRangeText() { return this.activeRange === 2000 ? '2 kW' : `${this.activeRange} W`; },
    forwardState() {
      const payload = this.msg?.payload, radio = payload?.radio;
      if (payload?.online !== true || radio?.connected !== true || !this.freshForwardTimestamp(payload.timestamp, 10000) || !this.freshForwardTimestamp(radio.at, 10000)) return 'UNKNOWN';
      return ['RX', 'TX'].includes(radio.rxTx) ? radio.rxTx : 'UNKNOWN';
    },
    forwardWatts() {
      if (this.forwardState === 'RX') return 0;
      const sample = this.msg?.payload?.forward;
      if (this.forwardState !== 'TX' || !sample || !Number.isFinite(sample.watts) || sample.watts < 0 || !this.freshForwardTimestamp(sample.seen, 15000) || !Number.isFinite(this.forwardTxSince) || sample.seen < this.forwardTxSince) return null;
      return sample.watts;
    },
    reflectedWatts() {
      if (this.forwardState === 'RX') return 0;
      const sample = this.msg?.payload?.reflected;
      if (this.forwardState !== 'TX' || !sample || !Number.isFinite(sample.watts) || sample.watts < 0 || !this.freshForwardTimestamp(sample.seen, 15000) || !Number.isFinite(this.forwardTxSince) || sample.seen < this.forwardTxSince) return null;
      return sample.watts;
    },
    reflectedWattsText() { return this.reflectedWatts === null ? '--' : `${Number(this.reflectedWatts.toFixed(2))} W`; },
    forwardWattsText() {
      const watts = this.forwardWatts;
      if (watts === null) return '--';
      return watts >= 1000 ? Number((watts / 1000).toFixed(2)).toString() : watts >= 10 ? Math.round(watts).toString() : Number(watts.toFixed(1)).toString();
    },
    forwardBoxText() { return this.forwardWatts === null ? '--' : `${this.forwardWattsText} ${this.forwardWatts >= 1000 ? 'kW' : 'W'}`; },
    restEndpoints() { return Object.fromEntries(['forward', 'reflected'].map(side => [side, this.scalePoint(side, 0, this.meterGeometry.needleLength)])); },
    // RADIO's existing SWR validity: TX only, fresh canonical sample in this TX interval.
    liveSwr() {
      const sample = this.msg?.payload?.swr;
      if (this.forwardState !== 'TX' || !sample || sample.available !== true || !Number.isFinite(sample.value) || !this.freshForwardTimestamp(sample.seen, 15000) || !Number.isFinite(this.forwardTxSince) || sample.seen < this.forwardTxSince) return null;
      return sample.value;
    },
    liveSwrText() { return this.liveSwr === null ? '--' : this.liveSwr.toFixed(2); },
    meterScales() { return ['forward', 'reflected'].map(side => this.scaleLayout(side)); },
    swrGuides() { return [...this.meterGeometry.guideValues, Infinity].map((value, index) => this.swrGuide(value, index)); }
  },
  methods: {
    labelArc(side) {
      const max = side === 'forward' ? this.meterGeometry.FORWARD_MODEL_MAX : this.reflectedModelMax;
      const points = Array.from({ length: 80 }, (_, i) => this.scalePoint(side, max * (.015 + .28 * i / 79), this.meterGeometry.legendRadius));
      return this.pointsToPath(side === 'reflected' ? points.reverse() : points);
    },
    needleBlade(side) {
      const p = this.meterGeometry.pivots[side], d = this.needleDirection(side, 0);
      const point = (distance, width) => ({ x: p.x + distance * d.x - width * d.y, y: p.y + distance * d.y + width * d.x });
      // Both high-contrast shafts preserve the calibrated centerline, pivot and tip.
      return this.pointsToPath([point(-7, 1.6), point(14, 1.8), point(this.meterGeometry.needleLength - 10, 1.4), point(this.meterGeometry.needleLength, 0), point(this.meterGeometry.needleLength - 10, -1.4), point(14, -1.8), point(-7, -1.6)]) + ' Z';
    },
    saveTheme() { try { sessionStorage.setItem('aurora-meter-face-theme', this.selectedTheme); } catch (_) {} },
    freshForwardTimestamp(timestamp, ageLimit) {
      const now = Math.max(this.liveClock, Date.now());
      return Number.isFinite(timestamp) && timestamp > 0 && now - timestamp >= 0 && now - timestamp < ageLimit;
    },
    calibratedAngle(watts, fullScale) {
      const value = Number(watts);
      const fraction = Math.min(1, Math.max(0, Number.isFinite(value) ? value / fullScale : 0));
      const points = this.meterGeometry.calibration;
      for (let i = 1; i < points.length; i++) {
        const [q1, a1] = points[i];
        if (fraction <= q1) {
          const [q0, a0] = points[i - 1];
          return (a0 + (fraction - q0) * (a1 - a0) / (q1 - q0)) * this.meterGeometry.sweep / 50;
        }
      }
      return this.meterGeometry.sweep;
    },
    forwardWattsToAngle(watts) {
      return this.calibratedAngle(watts, this.activeRange);
    },
    reflectedWattsToAngle(watts) {
      return -this.calibratedAngle(watts, this.reflectedFullScaleWatts);
    },
    needleDirection(side, watts) {
      const max = side === 'forward' ? this.meterGeometry.FORWARD_MODEL_MAX : this.reflectedModelMax;
      const angle = (side === 'forward' ? 1 : -1) * (this.meterGeometry.zeroTilt + this.calibratedAngle(watts, max)) * Math.PI / 180;
      return side === 'forward' ? { x: -Math.cos(angle), y: -Math.sin(angle) } : { x: Math.cos(angle), y: Math.sin(angle) };
    },
    scalePoint(side, watts, radius) {
      const pivot = this.meterGeometry.pivots[side];
      const direction = this.needleDirection(side, watts);
      return { x: pivot.x + radius * direction.x, y: pivot.y + radius * direction.y };
    },
    scaleLayout(side) {
      const geometry = this.meterGeometry;
      const max = side === 'forward' ? geometry.FORWARD_MODEL_MAX : this.reflectedModelMax;
      const fractions = geometry.labels[side];
      const labels = fractions.map(q => ({ watts: q * max, printed: Number((q * (side === 'forward' ? geometry.FORWARD_PRINTED_MAX : geometry.REFLECTED_PRINTED_MAX)).toFixed(6)), ...this.scalePoint(side, q * max, geometry.labelRadius) }));
      const powers = [...new Set([...Array.from({ length: geometry.tickDivisions + 1 }, (_, i) => i * max / geometry.tickDivisions), ...labels.map(item => item.watts)])].sort((a, b) => a - b);
      const ticks = powers.map(watts => {
        const major = labels.some(label => Math.abs(label.watts - watts) < 1e-6);
        return { watts, major, start: this.scalePoint(side, watts, geometry.outerRadius), end: this.scalePoint(side, watts, geometry.outerRadius - (major ? 14 : 6)) };
      });
      const arc = radius => this.pointsToPath(Array.from({ length: 101 }, (_, i) => this.scalePoint(side, i * max / 100, radius)));
      return { side, ticks, labels, outer: arc(geometry.outerRadius), inner: arc(geometry.innerRadius) };
    },
    calculatedSwr(forward, reflected) {
      if (!Number.isFinite(forward) || !Number.isFinite(reflected) || forward <= 0 || reflected < 0 || reflected >= forward) return null;
      const rho = Math.sqrt(reflected / forward);
      const result = (1 + rho) / (1 - rho);
      return Number.isFinite(result) ? result : null;
    },
    needleIntersection(forward, reflected) {
      const geometry = this.meterGeometry;
      if (!Number.isFinite(forward) || !Number.isFinite(reflected) || forward < 0 || reflected < 0 || forward > geometry.FORWARD_MODEL_MAX || reflected > this.reflectedModelMax) return null;
      const F = geometry.pivots.forward, R = geometry.pivots.reflected;
      const u = this.needleDirection('forward', forward), v = this.needleDirection('reflected', reflected);
      const cross = (a, b) => a.x * b.y - a.y * b.x;
      const denominator = cross(u, v);
      if (Math.abs(denominator) < geometry.parallelEpsilon) return null;
      const delta = { x: R.x - F.x, y: R.y - F.y };
      const t = cross(delta, v) / denominator, s = cross(delta, u) / denominator;
      if (t < 0 || s < 0 || t > geometry.needleLength || s > geometry.needleLength) return null;
      const point = { x: F.x + t * u.x, y: F.y + t * u.y, forward, reflected, t, s };
      return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null;
    },
    swrCurvePoints(swr) {
      const geometry = this.meterGeometry;
      if (swr !== Infinity && (!Number.isFinite(swr) || swr <= 1)) return [];
      const ratio = swr === Infinity ? 1 : ((swr - 1) / (swr + 1)) ** 2;
      const max = Math.min(geometry.FORWARD_MODEL_MAX, this.reflectedModelMax / ratio);
      const points = [];
      for (let i = 1; i <= geometry.curveSamples; i++) {
        const forward = max * i / geometry.curveSamples;
        const reflected = Math.min(this.reflectedModelMax, forward * ratio);
        const point = this.needleIntersection(forward, reflected);
        if (point && point.x >= geometry.face.left && point.x <= geometry.face.right && point.y >= geometry.swrFieldTop && point.y <= geometry.face.bottom) points.push(point);
      }
      return points;
    },
    pointsToPath(points) {
      return points.map((point, i) => `${i ? 'L' : 'M'}${point.x.toFixed(3)} ${point.y.toFixed(3)}`).join(' ');
    },
    swrGuide(value, index) {
      const points = this.swrCurvePoints(value);
      const anchor = points[Math.min(points.length - 1, Math.floor(points.length * this.meterGeometry.guideLabelFractions[index]))];
      return { key: String(value), label: value === Infinity ? '∞' : String(value), path: this.pointsToPath(points), labelX: anchor?.x + 7, labelY: anchor?.y - 3 };
    },
    selectTab(key) {
      if (!this.tabs.some(tab => tab.key === key)) return;
      this.activeTab = key;
      try { sessionStorage.setItem('aurora-800x480-tab', key); } catch (_) {}
      window.dispatchEvent(new CustomEvent('aurora-800x480-tab', { detail: key }));
    }
  },
  mounted() {
    try { const saved = sessionStorage.getItem('aurora-meter-face-theme'); if (Object.hasOwn(this.themeDefinitions, saved)) this.selectedTheme = saved; } catch (_) {}
    this.liveClockTimer = setInterval(() => { this.liveClock = Date.now(); }, 1000);
    this.tabListener = event => { if (this.tabs.some(tab => tab.key === event.detail)) this.activeTab = event.detail; };
    window.addEventListener('aurora-800x480-tab', this.tabListener);
    try { const saved = sessionStorage.getItem('aurora-800x480-tab'); if (this.tabs.some(tab => tab.key === saved)) this.activeTab = saved; } catch (_) {}
    fetch('/agct-watcher/status', { cache: 'no-store' }).then(response => response.ok ? response.json() : null).then(status => {
      if (status) { this.oldVersion = status.oldVersion || '…'; this.newVersion = status.uiVersion || '…'; }
    }).catch(() => {});
  },
  beforeUnmount() { clearInterval(this.liveClockTimer); window.removeEventListener('aurora-800x480-tab', this.tabListener); }
}
</script>
<style>
.aurora-kiosk.aurora-meter-static{position:fixed;left:0;top:0;width:800px;height:480px;z-index:2500;display:grid;grid-template-rows:42px minmax(0,1fr) 24px;gap:5px;padding:8px;background:#0e151e;color:#edf5fc;box-sizing:border-box;overflow:hidden}
.aurora-meter-static *{box-sizing:border-box}
.aurora-kiosk.aurora-meter-static .aurora-tabs{display:grid;grid-template-columns:repeat(7,minmax(0,1fr)) 154px;gap:6px;height:42px}
.aurora-meter-static .aurora-tabs button{min-width:0;padding:0;border:1px solid #405268;border-radius:5px;background:#1b2938;color:#cfdfec;font:700 18px/1 Arial,Helvetica,sans-serif;cursor:pointer;touch-action:manipulation}
.aurora-meter-static .aurora-tabs button[aria-selected="true"]{color:#06121b;background:#63d1fa;border-color:#63d1fa}
.aurora-meter-static .aurora-brand{display:flex;flex-direction:column;align-items:flex-end;justify-content:center;font:17px Arial,Helvetica,sans-serif;white-space:nowrap}
.aurora-meter-static .aurora-brand small{font-size:10px;color:#adc0d1;letter-spacing:1px;margin-top:3px}
.meter-test-stage{position:relative;min-height:0;display:grid;justify-items:center}
.meter-test-presets,.meter-test-readout{position:absolute;top:50%;transform:translateY(-50%);width:68px;font:11px/1.4 Arial,Helvetica,sans-serif}
.meter-test-presets{left:0;display:grid;gap:6px}
.meter-test-presets button{height:30px;padding:0;border:1px solid #405268;border-radius:4px;background:#1b2938;color:#cfdfec;font:700 9px Arial,Helvetica,sans-serif;cursor:pointer;touch-action:manipulation}
.meter-test-presets button[aria-pressed="true"]{border-color:#63d1fa;color:#8ddfff}
.meter-test-readout{right:0;display:grid;gap:12px;color:#adc0d1;text-align:center}
.meter-test-presets small{color:#adc0d1;text-align:center;font:10px/1.4 Arial,Helvetica,sans-serif}
.meter-test-readout small{display:block;font:9px/1.4 Arial,Helvetica,sans-serif;letter-spacing:.5px;color:#e4bd7b}
.meter-top-value text{fill:var(--meter-value,#f2f4f5);font-family:Arial,Helvetica,sans-serif;font-weight:700;text-anchor:middle;dominant-baseline:central}
.meter-test-readout span,.meter-test-readout b{display:block}
.meter-test-readout b{font-weight:400;color:#cfdfec}
.meter-theme-select{display:grid;gap:3px;font:9px/1.4 Arial,Helvetica,sans-serif;color:#adc0d1}
.meter-theme-select select{width:68px;height:25px;padding:2px;border:1px solid #526678;border-radius:4px;background:#1b2837;color:#edf4fa;font:10px Arial,Helvetica,sans-serif}
.meter-test-needle{transform-box:view-box;transition:transform 250ms ease-in-out}
.power-swr-static-svg{display:block;justify-self:center;width:auto;max-width:100%;height:100%;min-height:0;filter:drop-shadow(0 2px 5px #05080b)}
.meter-static-footer{display:flex;justify-content:space-between;align-items:center;padding:0 8px;border-top:1px solid #405268;color:#8ddfff;font:700 12px/20px Arial,Helvetica,sans-serif;white-space:nowrap}
</style>
