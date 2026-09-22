<template>
  <main class="dk1aj-station">
    <div class="station-banner"><strong>DK1AJ STATION</strong><span>READ ONLY · {{ live ? d.connection : 'N/A — dashboard data unavailable' }}</span></div>
    <div class="station-columns">
      <section aria-label="Radio status">
        <article class="station-card frequency"><label>FREQUENCY</label><strong>{{ field('frequency').text }}</strong><small>{{ field('frequency').reason }}</small></article>
        <div class="station-pair">
          <article class="station-card"><label>MODE</label><strong>{{ field('mode').text }}</strong></article>
          <article class="station-card" :class="{ transmitting: field('rxTx').text === 'TX' }"><label>RX / TX</label><strong>{{ field('rxTx').text }}</strong></article>
        </div>
        <article class="station-card"><label>RADIO CONNECTION</label><strong>{{ live ? d.connection : 'N/A' }}</strong><small>Frequency and mode follow the unique active slice, or the sole reported slice.</small></article>
        <article class="station-card"><label>REFLECTED POWER</label><strong>{{ field('reflected').text }}</strong><small>{{ field('reflected').reason || field('reflected').source }}</small></article>
      </section>
      <section aria-label="Power and temperature">
        <div class="station-pair">
          <article class="station-card"><label>TX POWER SET</label><strong>{{ field('set').text }}</strong><small>{{ field('set').reason }}</small></article>
          <article class="station-card"><label>FORWARD POWER ACTUAL</label><strong>{{ field('forward').text }}</strong><small>{{ field('forward').reason || field('forward').source }}</small></article>
        </div>
        <article class="station-card"><label>ACTUAL FORWARD POWER</label>
          <meter v-if="valid('forward')" min="0" :max="powerMax" :value="field('forward').value" aria-label="Actual forward power in watts"></meter>
          <strong v-else>N/A</strong><small>{{ valid('forward') ? '0–' + powerMax + ' W · display scale' : field('forward').reason }}</small>
        </article>
        <article class="station-card"><label>SWR</label><strong>{{ field('swr').text }}</strong>
          <meter v-if="valid('swr')" min="1" :max="swrMax" :value="field('swr').value" aria-label="SWR"></meter>
          <small>{{ valid('swr') ? '1–' + swrMax + ' · display scale' : field('swr').reason }}</small>
        </article>
        <article v-for="t in temperatures" :key="t.id" class="station-card"><label>{{ t.label }}</label><strong>{{ t.text }}</strong>
          <meter v-if="t.value !== null" :min="Math.min(0, Math.floor(t.value / 10) * 10)" :max="Math.max(100, Math.ceil(t.value / 10) * 10)" :value="t.value" :aria-label="t.label + ' in degrees Celsius'"></meter>
          <small>{{ t.reason || 'Temperature · °C · display scale, not an alarm threshold' }}</small>
        </article>
        <article v-if="!temperatures.length" class="station-card"><label>RADIO / PA TEMPERATURE</label><strong>N/A</strong><small>{{ live ? d.temperatureReason : 'Waiting for radio telemetry' }}</small></article>
      </section>
    </div>
  </main>
</template>
<script>
export default {
  data() { return { now: Date.now(), timer: null }; },
  mounted() { this.timer = setInterval(() => { this.now = Date.now(); }, 1000); },
  unmounted() { clearInterval(this.timer); },
  computed: {
    d() { return this.msg?.payload || {}; },
    live() { return Number.isFinite(this.d.at) && Math.abs(this.now - this.d.at) < 10000; },
    temperatures() { return this.live ? (this.d.temperatures || []) : []; },
    powerMax() { return Math.max(500, Math.ceil((this.field('forward').value || 0) / 100) * 100); },
    swrMax() { return Math.max(3, Math.ceil(this.field('swr').value || 1)); }
  },
  methods: {
    field(key) { return this.live && this.d[key] ? this.d[key] : { text: 'N/A', value: null, reason: 'Waiting for radio telemetry' }; },
    valid(key) { return Number.isFinite(this.field(key).value); }
  }
};
</script>
<style>
.dk1aj-station { color: #eef4ff; padding: 8px; font-variant-numeric: tabular-nums; }
.dk1aj-station .station-banner { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 8px 0 20px; }
.dk1aj-station .station-banner span { color: #bac8dc; }
.dk1aj-station .station-columns { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 20px; }
.dk1aj-station section { min-width: 0; }
.dk1aj-station .station-pair { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 12px; }
.dk1aj-station .station-card { background: #182230; border: 1px solid #35475c; border-radius: 10px; padding: 20px; margin-bottom: 14px; overflow-wrap: anywhere; }
.dk1aj-station label, .dk1aj-station small { display: block; color: #bdccdf; }
.dk1aj-station label { font-size: 14px; letter-spacing: .07em; margin-bottom: 10px; }
.dk1aj-station strong { display: block; font-size: 30px; line-height: 1.3; }
.dk1aj-station .frequency strong { font-size: clamp(32px,3.7vw,64px); color: #8dceff; }
.dk1aj-station small { margin-top: 10px; font-size: 13px; }
.dk1aj-station .transmitting { border-color: #ff9980; }
.dk1aj-station meter { width: 100%; height: 30px; margin-top: 10px; accent-color: #65baff; }
@media(max-width: 850px) { .dk1aj-station .station-columns { grid-template-columns: 1fr; } }
</style>
