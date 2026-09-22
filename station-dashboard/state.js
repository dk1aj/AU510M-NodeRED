// Embedded in a Node-RED Function by build.js. No network or radio commands.
function update(s, msg, now) {
    const empty = () => ({ connection: 'N/A', connectionAt: 0, meters: {}, samples: {}, slices: {}, tx: {}, interlock: null });
    s = s || empty();
    const p = msg.payload;
    const object = p && typeof p === 'object' && !Array.isArray(p);
    const number = v => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v));
    let connection;
    if (msg.topic === 'connection/tcp') connection = p;
    if (msg.status) {
        const st = msg.status;
        connection = st.fill === 'green' && st.shape === 'dot' ? 'connected' :
            st.text === 'connecting' ? 'connecting' :
            ['disconnected', 'closed', 'not configured'].includes(st.text) ? 'disconnected' : undefined;
    }
    if (connection && ['connected', 'connecting', 'disconnected'].includes(connection)) {
        if (connection !== s.connection) s = empty();
        s.connection = connection;
        s.connectionAt = now;
    }
    if (s.connection === 'connected' && now - s.connectionAt > 12000) {
        s = empty();
        s.connection = 'N/A — connection status expired';
    }
    // Metadata must come from a successful meter list, never an assumed ID.
    if (msg.request === 'meter list' && Number(msg.status_code) === 0 && object) {
        s.meters = p;
        s.samples = {};
    }
    if (s.connection === 'connected') {
        if (msg.meter !== undefined && object && s.meters[msg.meter]) {
            s.samples[msg.meter] = { value: number(p.value) ? Number(p.value) : null, at: now };
        }
        const slice = String(msg.topic || '').match(/^slice\/(\d+)$/);
        if (slice) {
            if (p === 'removed' || (object && Number(p.in_use) === 0)) delete s.slices[slice[1]];
            else if (object) s.slices[slice[1]] = { ...s.slices[slice[1]], ...p };
        }
        if (msg.topic === 'transmit' && object) s.tx = { ...s.tx, ...p };
        if (msg.topic === 'interlock' && object && typeof p.state === 'string') s.interlock = p.state;
    }
    const na = reason => ({ value: null, text: 'N/A', reason });
    const value = (v, unit, reason = '') => ({ value: v, text: `${v.toFixed(2).replace(/\.00$/, '')}${unit ? ' ' + unit : ''}`, reason });
    const connected = s.connection === 'connected';
    function meterValue(id, meta) {
        const sample = s.samples[id];
        if (!connected || !sample || sample.value === null || now - sample.at > 15000) return na('No fresh sample (15 second timeout)');
        const v = sample.value;
        const unit = String(meta.unit || '').toLowerCase();
        if (unit === 'dbm') return value(10 ** ((v - 30) / 10), 'W');
        if (unit === 'watts') return v >= 0 ? value(v, 'W') : na('Invalid negative power');
        if (unit === 'swr') return v >= 1 ? value(v, ':1') : na('Invalid SWR');
        if (unit === 'degc') return value(v, '°C');
        if (unit === 'degf') return value((v - 32) * 5 / 9, '°C');
        return na('Unsupported reported meter unit');
    }
    function named(name, units) {
        const matches = Object.entries(s.meters).filter(([, m]) => String(m.nam).toUpperCase() === name && units.includes(String(m.unit).toLowerCase()));
        if (matches.length !== 1) return na(matches.length ? 'Multiple matching meters; source needs confirmation' : `${name} with supported units absent from meter list`);
        const [id, m] = matches[0];
        return { ...meterValue(id, m), source: `${m.src}/${m.num}/${m.nam}` };
    }
    const slices = Object.entries(s.slices);
    const active = slices.filter(([, x]) => Number(x.active) === 1);
    const selected = active.length === 1 ? active[0] : slices.length === 1 ? slices[0] : null;
    const freq = connected && selected && number(selected[1].RF_frequency) ?
        { value: Number(selected[1].RF_frequency), text: `${Number(selected[1].RF_frequency).toFixed(6)} MHz`, reason: `Slice ${selected[0]}` } : na('No unique active slice with reported RF_frequency');
    const mode = connected && selected && typeof selected[1].mode === 'string' ? { text: selected[1].mode } : na('No mode for selected slice');
    const state = String(s.interlock || '').toUpperCase();
    const rxTx = connected && state ? { text: state === 'TRANSMITTING' ? 'TX' : ['RECEIVE', 'READY'].includes(state) ? 'RX' : `N/A — ${state}` } : na('No interlock state received');
    const set = connected && number(s.tx.rfpower) ? { value: Number(s.tx.rfpower), text: String(s.tx.rfpower), reason: 'Radio setting · unit / watt scaling unverified' } : na('No transmit.rfpower received');
    const temperatures = Object.entries(s.meters).filter(([, m]) => ['degc', 'degf'].includes(String(m.unit).toLowerCase()))
        .map(([id, m]) => ({ ...meterValue(id, m), label: `${m.nam} (${m.src}/${m.num})`, id }));
    const snapshot = { at: now, connection: s.connection, frequency: freq, mode, rxTx, set,
        forward: named('FWDPWR', ['dbm', 'watts']), reflected: named('REFPWR', ['dbm', 'watts']),
        swr: named('SWR', ['swr']), temperatures,
        temperatureReason: temperatures.length ? '' : 'No temperature meters with degC / degF units in meter list' };
    return { state: s, snapshot };
}
module.exports = update;
