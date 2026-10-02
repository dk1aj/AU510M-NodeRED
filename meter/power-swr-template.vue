<template>
  <Teleport to="body">
    <section v-show="activeTab === 'meter'" class="aurora-kiosk aurora-meter-page" :data-active="activeTab === 'meter'" aria-label="Power and SWR cross-needle meter">
      <nav class="aurora-tabs" role="tablist" aria-label="Aurora meter pages">
        <button v-for="tab in tabs" :key="tab.key" type="button" role="tab"
          :id="'aurora-tab-meter-' + tab.key" :aria-selected="activeTab === tab.key"
          :aria-controls="'aurora-panel-' + tab.key" :tabindex="activeTab === tab.key ? 0 : -1"
          @click="selectTab(tab.key)" @keydown.left.prevent="moveTab(-1)" @keydown.right.prevent="moveTab(1)">{{ tab.label }}</button>
        <span class="aurora-brand">AU-510M <small>POWER / SWR</small></span>
      </nav>
      <svg id="aurora-panel-meter" class="power-swr-face" viewBox="0 0 640 390" role="img" aria-label="Analog forward power, reflected power and SWR meter">
        <defs>
          <linearGradient id="meter-amber" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#8d6847"/><stop offset="0.43" stop-color="#c89a63"/><stop offset="1" stop-color="#edbd73"/>
          </linearGradient>
          <radialGradient id="meter-glow" cx="50%" cy="93%" r="76%">
            <stop offset="0" stop-color="#ffe19b" stop-opacity="0.75"/><stop offset="0.55" stop-color="#f2b66c" stop-opacity="0.19"/><stop offset="1" stop-color="#442b1d" stop-opacity="0.24"/>
          </radialGradient>
          <filter id="needle-shadow"><feGaussianBlur stdDeviation="1.2"/></filter>
        </defs>
        <g id="meter-background">
          <rect x="1" y="1" width="638" height="388" rx="13" fill="#11191d" stroke="#4d5557" stroke-width="2"/>
          <rect x="12" y="13" width="616" height="331" rx="8" fill="url(#meter-amber)" stroke="#171b1b" stroke-width="3"/>
          <rect x="12" y="13" width="616" height="331" rx="8" fill="url(#meter-glow)"/>
          <rect x="18" y="349" width="604" height="31" fill="#182029" stroke="#59606a" stroke-width="1"/>
        </g>
        <g id="forward-scale" fill="#292923" stroke="#272923">
          <path :d="forwardArc" fill="none" stroke-width="2.5"/>
          <path :d="forwardInnerArc" fill="none" stroke-width="1"/>
          <line v-for="mark in forwardMinor" :key="'fm'+mark.value" :x1="mark.x1" :y1="mark.y1" :x2="mark.x2" :y2="mark.y2" stroke-width="0.7"/>
          <g v-for="mark in forwardMarks" :key="'f'+mark.value">
            <line :x1="mark.x1" :y1="mark.y1" :x2="mark.x2" :y2="mark.y2" stroke-width="1.8"/>
            <text :x="mark.tx" :y="mark.ty" text-anchor="middle" stroke="none" font-size="15">{{ mark.value }}</text>
          </g>
        </g>
        <g id="reflected-scale" fill="#292923" stroke="#272923">
          <path :d="reflectedArc" fill="none" stroke-width="2.5"/>
          <path :d="reflectedInnerArc" fill="none" stroke-width="1"/>
          <line v-for="mark in reflectedMinor" :key="'rm'+mark.value" :x1="mark.x1" :y1="mark.y1" :x2="mark.x2" :y2="mark.y2" stroke-width="0.7"/>
          <g v-for="mark in reflectedMarks" :key="'r'+mark.value">
            <line :x1="mark.x1" :y1="mark.y1" :x2="mark.x2" :y2="mark.y2" stroke-width="1.8"/>
            <text :x="mark.tx" :y="mark.ty" text-anchor="middle" stroke="none" font-size="15">{{ mark.value }}</text>
          </g>
        </g>
        <g id="swr-guides" fill="none" stroke="#754831" stroke-width="1.1">
          <path v-for="guide in swrGuides" :key="guide.label" :d="guide.path"/>
        </g>
        <g id="labels" fill="#252824" font-family="Georgia,serif">
          <text x="81" y="222" transform="rotate(-58 81 222)" text-anchor="middle" font-size="20" letter-spacing="1">FORWARD</text>
          <text x="559" y="222" transform="rotate(58 559 222)" text-anchor="middle" font-size="20" letter-spacing="1">REFLECTED</text>
          <text x="166" y="65" font-size="16" font-weight="bold">(W)</text>
          <text x="467" y="65" font-size="16" font-weight="bold">(W)</text>
          <text x="320" y="29" text-anchor="middle" font-size="12" letter-spacing="1.2">POWER &amp; SWR</text>
          <text v-for="guide in swrGuides" :key="'label'+guide.label" :x="guide.labelX" :y="guide.labelY"
            text-anchor="middle" :font-size="guide.fontSize" font-weight="bold">{{ guide.label }}</text>
        </g>
        <g id="forward-needle" :transform="'rotate(' + forwardNeedleAngle + ' 450 340)'" class="meter-needle">
          <path d="M450 340 L72 337 L72 343 Z" fill="#151b1a" opacity="0.3" filter="url(#needle-shadow)"/>
          <path d="M450 340 L72 339 L72 341 Z" fill="#161918"/>
          <circle cx="450" cy="340" r="5" fill="#24231e" stroke="#8b6c47"/>
        </g>
        <g id="reflected-needle" :transform="'rotate(' + reflectedNeedleAngle + ' 190 340)'" class="meter-needle">
          <path d="M190 340 L568 337 L568 343 Z" fill="#151b1a" opacity="0.3" filter="url(#needle-shadow)"/>
          <path d="M190 340 L568 339 L568 341 Z" fill="#161918"/>
          <circle cx="190" cy="340" r="5" fill="#24231e" stroke="#8b6c47"/>
        </g>
        <g id="numeric-readout" font-family="Arial,Helvetica,sans-serif">
          <text x="42" y="372" fill="#f7d895" font-size="14">FWD {{ forwardText }} W</text>
          <text x="490" y="372" fill="#f7d895" font-size="14">REF {{ reflectedText }} W</text>
          <text x="320" y="374" fill="#f5f5f2" font-size="25" font-weight="bold" text-anchor="middle" letter-spacing="3">SWR</text>
          <text x="414" y="374" fill="#f7d895" font-size="14">{{ swrText }}</text>
        </g>
      </svg>
      <footer class="meter-footer"><span>{{ tx ? 'TX · LIVE' : 'RX · NEEDLES AT REST' }}</span><span>Old: v{{ oldVersion }} | New: v{{ newVersion }}</span></footer>
    </section>
  </Teleport>
</template>
<script>
const toRadians = degrees => degrees * Math.PI / 180;
const clamp = (value, max) => Math.max(0, Math.min(max, Number(value) || 0));
function forwardWattsToAngle(watts) { return 50 * Math.sqrt(clamp(watts, 500) / 500); }
function reflectedWattsToAngle(watts) { return -50 * Math.sqrt(clamp(watts, 100) / 100); }
function point(pivot, length, angle, side) {
  const radians = toRadians(Math.abs(angle));
  return { x: pivot.x + side * length * Math.cos(radians), y: pivot.y - length * Math.sin(radians) };
}
const forwardPivot = { x: 450, y: 340 };
const reflectedPivot = { x: 190, y: 340 };
const fixed = value => Number(value.toFixed(2));
function arc(pivot, side, length) {
  return Array.from({ length: 51 }, (_, i) => point(pivot, length, i, side))
    .map((p, i) => (i ? 'L' : 'M') + fixed(p.x) + ' ' + fixed(p.y)).join(' ');
}
function marks(values, max, pivot, side, major) {
  return values.map(value => {
    const angle = 50 * Math.sqrt(value / max);
    const a = point(pivot, 378, angle, side);
    const b = point(pivot, major ? 363 : 370, angle, side);
    const label = point(pivot, 345, angle, side);
    return { value, x1: fixed(a.x), y1: fixed(a.y), x2: fixed(b.x), y2: fixed(b.y), tx: fixed(label.x), ty: fixed(label.y + (value === 0 ? -6 : 5)) };
  });
}
function intersection(forwardWatts, reflectedWatts) {
  const f = toRadians(forwardWattsToAngle(forwardWatts));
  const r = toRadians(-reflectedWattsToAngle(reflectedWatts));
  const ux = -Math.cos(f), uy = -Math.sin(f), vx = Math.cos(r), vy = -Math.sin(r);
  const determinant = ux * -vy - uy * -vx;
  if (Math.abs(determinant) < 1e-6) return null;
  const distance = (reflectedPivot.x - forwardPivot.x) * -vy / determinant;
  const x = forwardPivot.x + distance * ux, y = forwardPivot.y + distance * uy;
  return distance >= 0 && distance <= 378 && x >= 28 && x <= 612 && y >= 45 && y <= 338 ? { x, y } : null;
}
// For each SWR, rho is constant; each path joins needle intersections where Pref = Pfwd * rho².
function swrGuide(swr, index) {
  const rho = swr === Infinity ? 1 : (swr - 1) / (swr + 1);
  const maxForward = Math.min(500, 100 / (rho * rho));
  const points = Array.from({ length: 22 }, (_, i) => {
    const forward = 20 + (maxForward - 20) * i / 21;
    return intersection(forward, forward * rho * rho);
  }).filter(Boolean);
  const labelPoint = points[Math.min(points.length - 1, Math.max(0, Math.floor(points.length * (0.38 + (index % 3) * 0.2))))];
  return { label: swr === Infinity ? '∞' : String(swr),
    path: points.map((p, i) => (i ? 'L' : 'M') + fixed(p.x) + ' ' + fixed(p.y)).join(' '),
    labelX: labelPoint ? fixed(labelPoint.x) : 320,
    labelY: labelPoint ? fixed(labelPoint.y - 8) : 270,
    fontSize: swr >= 4 ? 12 : 13 };
}
const forwardArc = arc(forwardPivot, -1, 378);
const forwardInnerArc = arc(forwardPivot, -1, 360);
const reflectedArc = arc(reflectedPivot, 1, 378);
const reflectedInnerArc = arc(reflectedPivot, 1, 360);
const forwardMarks = marks([0, 50, 100, 150, 200, 300, 400, 500], 500, forwardPivot, -1, true);
const reflectedMarks = marks([0, 10, 20, 40, 60, 80, 100], 100, reflectedPivot, 1, true);
const forwardMinor = marks(Array.from({ length: 26 }, (_, i) => i * 20), 500, forwardPivot, -1, false);
const reflectedMinor = marks(Array.from({ length: 21 }, (_, i) => i * 5), 100, reflectedPivot, 1, false);
const swrGuides = [1.2, 1.3, 1.5, 1.7, 2, 2.5, 3, 4, 5, 8, Infinity].map(swrGuide);

export default {
  data() { return { activeTab: 'radio', tabListener: null, timer: null, versionTimer: null,
    display: { tx: false, forwardWatts: 0, reflectedWatts: 0, swr: null, at: 0 },
    numeric: { forwardWatts: 0, reflectedWatts: 0, swr: null }, oldVersion: '…', newVersion: '…',
    tabs: [{ key: 'radio', label: 'RADIO' }, { key: 'meter', label: 'METER' }, { key: 'pa', label: 'PA' },
      { key: 'tx', label: 'TX' }, { key: 'rx', label: 'RX' }, { key: 'external', label: 'EXT' }, { key: 'agct', label: 'AGC-T' }],
    forwardArc, forwardInnerArc, reflectedArc, reflectedInnerArc, forwardMarks, reflectedMarks,
    forwardMinor, reflectedMinor, swrGuides }; },
  watch: {
    msg: { immediate: true, handler(message) {
      const next = message?.payload;
      if (next && typeof next.tx === 'boolean' && Number.isFinite(next.at)) this.display = next;
    } }
  },
  computed: {
    tx() { return this.display.tx && Date.now() - this.display.at < 2000; },
    forwardNeedleAngle() { return forwardWattsToAngle(this.tx ? this.display.forwardWatts : 0); },
    reflectedNeedleAngle() { return reflectedWattsToAngle(this.tx ? this.display.reflectedWatts : 0); },
    forwardText() { return this.tx && Number.isFinite(this.numeric.forwardWatts) ? this.numeric.forwardWatts.toFixed(0) : this.tx ? '--' : '0'; },
    reflectedText() { return this.tx && Number.isFinite(this.numeric.reflectedWatts) ? this.numeric.reflectedWatts.toFixed(1) : this.tx ? '--' : '0.0'; },
    swrText() { return this.tx && Number.isFinite(this.numeric.swr) ? this.numeric.swr.toFixed(2) : '--'; }
  },
  methods: {
    forwardWattsToAngle, reflectedWattsToAngle,
    selectTab(key) {
      if (!this.tabs.some(tab => tab.key === key)) return;
      try { sessionStorage.setItem('aurora-800x480-tab', key); } catch (_) {}
      window.dispatchEvent(new CustomEvent('aurora-800x480-tab', { detail: key }));
      this.$nextTick(() => document.querySelector('.aurora-kiosk[data-active="true"] button[aria-selected="true"]')?.focus());
    },
    moveTab(delta) {
      const index = this.tabs.findIndex(tab => tab.key === this.activeTab);
      this.selectTab(this.tabs[(index + delta + this.tabs.length) % this.tabs.length].key);
    },
    async refreshVersion() {
      try {
        const response = await fetch('/agct-watcher/status', { cache: 'no-store' });
        if (!response.ok) return;
        const status = await response.json();
        this.oldVersion = status.oldVersion || '…';
        this.newVersion = status.uiVersion || '…';
      } catch (_) {}
    }
  },
  mounted() {
    this.tabListener = event => { if (this.tabs.some(tab => tab.key === event.detail)) this.activeTab = event.detail; };
    window.addEventListener('aurora-800x480-tab', this.tabListener);
    try { const saved = sessionStorage.getItem('aurora-800x480-tab'); if (this.tabs.some(tab => tab.key === saved)) this.activeTab = saved; } catch (_) {}
    this.timer = setInterval(() => {
      this.numeric = { forwardWatts: this.display.forwardWatts, reflectedWatts: this.display.reflectedWatts, swr: this.display.swr };
      if (!this.tx) this.display = { tx: false, forwardWatts: 0, reflectedWatts: 0, swr: null, at: Date.now() };
    }, 250);
    this.refreshVersion();
    this.versionTimer = setInterval(() => this.refreshVersion(), 5000);
  },
  unmounted() {
    clearInterval(this.timer); clearInterval(this.versionTimer);
    window.removeEventListener('aurora-800x480-tab', this.tabListener);
  }
}
</script>
<style>
html:has(.aurora-kiosk),body:has(.aurora-kiosk){overflow:hidden!important}
body:has(.aurora-kiosk) .v-main__scroller{overflow:hidden!important}
.aurora-kiosk.aurora-meter-page{position:fixed;left:0;top:0;width:800px;height:480px;z-index:2500;display:grid;grid-template-rows:42px minmax(0,1fr) 24px;gap:5px;padding:8px;background:#0e151e;color:#edf5fc;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;overflow:hidden}
.aurora-meter-page *{box-sizing:border-box}
.aurora-kiosk.aurora-meter-page .aurora-tabs{display:grid;grid-template-columns:repeat(7,minmax(0,1fr)) 126px;gap:4px;height:42px}
.aurora-kiosk.aurora-meter-page .aurora-tabs button{min-width:0;padding:0;border:1px solid #405268;border-radius:5px;background:#1b2938;color:#cfdfec;font:700 16px/1 Arial,Helvetica,sans-serif;cursor:pointer}
.aurora-meter-page .aurora-tabs button[aria-selected="true"]{color:#06121b;background:#63d1fa;border-color:#63d1fa}
.aurora-meter-page .aurora-tabs button:focus-visible{outline:2px solid white;outline-offset:-4px}
.aurora-meter-page .aurora-brand{display:flex;flex-direction:column;align-items:flex-end;justify-content:center;font-size:15px;white-space:nowrap}
.aurora-meter-page .aurora-brand small{font-size:10px;color:#adc0d1;letter-spacing:1px;margin-top:3px}
.power-swr-face{display:block;width:100%;height:100%;min-height:0;filter:drop-shadow(0 2px 5px #05080b)}
.meter-needle{transition:transform 200ms ease-out;transform-box:view-box}
.meter-footer{display:flex;justify-content:space-between;align-items:center;padding:0 8px;border-top:1px solid #405268;color:#8ddfff;font:700 12px/20px Arial;white-space:nowrap}
</style>
