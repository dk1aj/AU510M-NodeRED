// AU-510M decoded Node-RED messages only. No RF/control commands.
function update(s, msg, now) {
    const empty = () => ({ slices: {}, meters: {}, interlock: null, connected: false, heartbeat: 0, epoch: 0, subscriptions: {} });
    s = s || empty();
    const commands = [];
    const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
    const numeric = v => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v));
    const flag = v => v === 1 || v === '1' ? true : v === 0 || v === '0' ? false : null;
    let connection;
    if (String(msg.topic).startsWith('connection/')) connection = msg.payload === 'connected';
    if (msg.status) connection = msg.status.fill === 'green' && msg.status.shape === 'dot';
    if (connection !== undefined) {
        if (connection !== s.connected) { const epoch = s.epoch + 1; s = empty(); s.epoch = epoch; }
        s.connected = connection;
        s.heartbeat = now;
    }
    if (s.connected && now - s.heartbeat > 12000) { const epoch = s.epoch + 1; s = empty(); s.epoch = epoch; }
    if (s.connected) {
        if (msg._radioEpoch === s.epoch && ['sub slice all', 'sub tx all'].includes(msg.request)) {
            const sub = s.subscriptions[msg.request];
            if (sub && sub.at === msg._radioRequestAt) sub.ok = msg.status_code !== undefined && msg.status_code !== null && Number(msg.status_code) === 0;
        }
        const p = msg.payload;
        const slice = /^slice\/(\d+)$/.exec(String(msg.topic));
        if (slice) {
            const id = String(Number(slice[1]));
            if (p === 'removed' || (object(p) && flag(p.in_use) === false)) { delete s.slices[id]; delete s.meters[id]; }
            else if (object(p)) s.slices[id] = { ...s.slices[id], ...p };
        }
        if (msg.topic === 'interlock' && object(p) && typeof p.state === 'string') s.interlock = p.state;
        const meter = /^SLC\/(\d+)\/LEVEL$/i.exec(String(msg.topic));
        if (meter && object(p)) {
            const id = String(Number(meter[1]));
            s.meters[id] = numeric(p.value) && String(p.unit).toLowerCase() === 'dbm' ? { value: p.value, at: now } : null;
        }
        if (msg.topic === '__radio_tick' || connection === true) {
            for (const request of ['sub slice all', 'sub tx all']) {
                const sub = s.subscriptions[request];
                if (!sub || (!sub.ok && now - sub.at >= 15000)) {
                    s.subscriptions[request] = { at: now, ok: false };
                    commands.push({ payload: request, _radioEpoch: s.epoch, _radioRequestAt: now });
                }
            }
        }
    }
    const fields = Object.fromEntries(['Frequency','Mode','Active slice','RX antenna','TX antenna','RX filter','SPLIT','TX/RX','Lock','S-meter','Mute','Audio','NB','NR','ANF','QSK','DSP','RIT on','RIT offset','XIT on','XIT offset','DAX on','DAX channel'].map(k => [k, '--']));
    const unique = field => { const entries = Object.entries(s.slices).filter(([, p]) => flag(p[field]) === true); return entries.length === 1 ? entries[0] : null; };
    const active = unique('active');
    const tx = unique('tx');
    if (s.connected) {
        if (['TRANSMITTING','READY','RECEIVE'].includes(s.interlock)) fields['TX/RX'] = s.interlock === 'TRANSMITTING' ? 'TX' : 'RX';
        if (tx && typeof tx[1].txant === 'string' && tx[1].txant.trim()) fields['TX antenna'] = tx[1].txant;
        if (active && tx) fields.SPLIT = active[0] === tx[0] ? 'OFF' : 'ON';
        if (active) {
            const [id, p] = active;
            for (const [label, field] of Object.entries({ Mode:'mode', 'Active slice':'index_letter', 'RX antenna':'rxant' })) {
                if (typeof p[field] === 'string' && p[field].trim()) fields[label] = p[field];
            }
            if (numeric(p.RF_frequency)) fields.Frequency = String(p.RF_frequency) + ' MHz';
            if (numeric(p.filter_hi) && numeric(p.filter_lo)) {
                const width = Number(p.filter_hi) - Number(p.filter_lo);
                if (width >= 0) fields['RX filter'] = width >= 1000 ? String(width / 1000) + ' kHz' : String(width) + ' Hz';
            }
            for (const [label, field] of Object.entries({ Lock:'lock', Mute:'audio_mute', NB:'nb', NR:'nr', ANF:'anf', QSK:'qsk', 'RIT on':'rit_on', 'XIT on':'xit_on' })) {
                const value = flag(p[field]);
                if (value !== null) fields[label] = value ? 'ON' : 'OFF';
            }
            if (numeric(p.audio_level)) fields.Audio = String(p.audio_level);
            for (const [label, field] of [['RIT offset','rit_freq'], ['XIT offset','xit_freq']]) if (numeric(p[field])) fields[label] = String(p[field]) + ' Hz';
            if (numeric(p.dax) && Number.isInteger(Number(p.dax)) && Number(p.dax) >= 0) {
                fields['DAX channel'] = String(p.dax);
                fields['DAX on'] = Number(p.dax) > 0 ? 'ON' : 'OFF';
            }
            const sample = s.meters[id];
            if (sample && now - sample.at < 15000) fields['S-meter'] = String(sample.value) + ' dBm';
        }
    }
    return { state: s, commands, snapshot: { at: now, connected: s.connected, fields } };
}
module.exports = update;
