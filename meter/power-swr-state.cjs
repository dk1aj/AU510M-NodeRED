// Read-only display state for the AU-510M cross-needle meter.
// Each dBm sample is converted to watts before entering the 500 ms window.
function updatePowerSWR(state, msg, now) {
    const topics = {
        'TX-/1/FWDPWR': 'forward',
        'TX-/2/REFPWR': 'reflected',
        'TX-/3/SWR': 'swr'
    };
    const empty = () => ({ forward: [], reflected: [], swr: [] });
    state ||= { tx: false, statusAt: 0, samples: empty() };
    const reset = () => { state.samples = empty(); };
    const valid = value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value));

    if (msg.topic === '__radio_status') {
        const tx = msg.payload?.connected === true && msg.payload?.fields?.['TX/RX'] === 'TX';
        if (!tx || tx !== state.tx) reset();
        state.tx = tx;
        state.statusAt = now;
    } else if (Object.hasOwn(topics, msg.topic) && state.tx && now - state.statusAt <= 3000) {
        const key = topics[msg.topic];
        const raw = msg.payload?.value;
        const unit = String(msg.payload?.unit || '').toLowerCase();
        if (valid(raw) && (key === 'swr' || unit === 'dbm')) {
            const value = key === 'swr' ? Number(raw) : 10 ** ((Number(raw) - 30) / 10);
            if (Number.isFinite(value) && value >= 0 && (key !== 'swr' || value >= 1)) {
                state.samples[key].push({ at: now, value });
            }
        }
    }

    if (msg.topic !== '__power_swr_tick') return { state, snapshot: null };
    if (now - state.statusAt > 3000) { state.tx = false; reset(); }
    const value = key => {
        const samples = state.samples[key] = state.samples[key].filter(x => x.at > now - 500 && x.at <= now);
        return samples.length ? samples.reduce((sum, x) => sum + x.value, 0) / samples.length : null;
    };
    const forward = value('forward');
    const reflected = value('reflected');
    const swr = value('swr');
    return { state, snapshot: {
        at: now,
        tx: state.tx,
        forwardWatts: state.tx ? forward : 0,
        reflectedWatts: state.tx ? reflected : 0,
        swr: state.tx ? swr : null
    } };
}
module.exports = updatePowerSWR;
