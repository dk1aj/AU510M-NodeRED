// Separate presentation cache. Never alters a radio message, subscription or raw row.
function averageDisplay(s, msg, now) {
    s = s || { windows: {}, averages: {}, pages: {}, radio: null, tx: false, txSince: null, lastAverage: null };
    const sections = ['pa','tx','rx','external'];
    const special = ['TX-/1/FWDPWR','TX-/3/SWR'];
    const names = ['FWDPWR','REFPWR','SWR','PATEMP','PAFETQ1TEMP','PAFETQ2TEMP','PACURRENT','+13.8A','+13.8B','MAINFAN','PAEFF','MICPEAK','MIC','HWALC','CODEC','TXAGC','SC_MIC','AFTEREQ','SC_FILT_0','COMPPEAK','SC_FILT_1','ALC','RM_TX_AGC','SC_FILT_2','TX_AGC','B4RAMP','AFRAMP','POST_P','ATTN_FPGA','24kHz','ESC','LEVEL','AGC+','FreeDV_SNR'];
    const canonical = topic => { const p = String(topic).split('/'); if (/^(0x[0-9a-f]+|[0-9]+)$/i.test(p[1] || '')) p[1] = BigInt(p[1]).toString(); return p.join('/'); };
    const valid = v => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v));
    const prune = () => { for (const topic of Object.keys(s.windows)) s.windows[topic] = s.windows[topic].filter(x => x.at > now - 1000 && x.at <= now); };
    prune();
    let publish = [];
    if (msg.topic === '__radio_status') {
        s.radio = structuredClone(msg.payload);
        const tx = s.radio?.connected === true && s.radio.fields?.['TX/RX'] === 'TX';
        if (tx !== s.tx || !tx) {
            for (const topic of special) { delete s.windows[topic]; delete s.averages[topic]; }
            s.txSince = tx ? now : null;
        }
        s.tx = tx;
        if (s.radio?.connected !== true) { s.windows = {}; s.averages = {}; }
        publish = sections;
    } else if (sections.includes(msg.payload?.section) && Array.isArray(msg.payload.rows)) {
        s.pages[msg.payload.section] = structuredClone(msg.payload);
        if (s.lastAverage === null || now - s.lastAverage >= 1000) {
            s.lastAverage = now;
            for (const [topic, samples] of Object.entries(s.windows)) {
                if (!samples.length || (special.includes(topic) && (!s.tx || now - s.txSince < 1000))) continue;
                let mean = 0;
                samples.forEach((sample, i) => { mean = mean * (i / (i + 1)) + sample.value / (i + 1); });
                if (!Number.isFinite(mean)) continue;
                const meta = Object.values(s.pages).flatMap(p => p.rows).find(r => canonical(r.topic) === topic);
                const unit = samples[samples.length - 1].unit || meta?.radioUnit || '';
                const power = /\/(FWDPWR|REFPWR)$/.test(topic);
                const value = meta?.unit === '°C' && unit.toLowerCase() === 'degf' ? (mean - 32) * 5 / 9 : mean;
                const watts = power && (!unit || unit.toLowerCase() === 'dbm') ? 10 ** ((mean - 30) / 10) : null;
                s.averages[topic] = { raw: mean, value, unit, watts: Number.isFinite(watts) ? watts : null, at: now };
            }
        }
        publish = [msg.payload.section];
    } else {
        const topic = canonical(msg.topic || '');
        if (names.includes(topic.split('/').at(-1)) && valid(msg.payload?.value) && (!special.includes(topic) || s.tx)) {
            const unit = typeof msg.payload.unit === 'string' ? msg.payload.unit : '';
            const samples = s.windows[topic] || [];
            // Do not mix two units in one arithmetic mean.
            if (samples.length && samples[samples.length - 1].unit !== unit) samples.length = 0;
            samples.push({ value: Number(msg.payload.value), unit, at: now });
            s.windows[topic] = samples;
        }
    }
    const output = sections.map(section => {
        if (!publish.includes(section) || !s.pages[section]) return null;
        const payload = structuredClone(s.pages[section]);
        payload.radioStatus = s.radio ? structuredClone(s.radio) : null;
        payload.displayTx = s.tx;
        payload.rows = payload.rows.map(row => ({ ...row, average: s.averages[canonical(row.topic)] ? { ...s.averages[canonical(row.topic)] } : null }));
        // RADIO S-meter uses the active slice's averaged LEVEL; state selection stays unchanged.
        if (payload.radioStatus) {
            const id = payload.radioStatus.activeSliceId;
            const level = id !== null && id !== undefined ? s.averages['SLC/' + id + '/LEVEL'] : null;
            payload.radioStatus.fields['S-meter'] = level && level.unit.toLowerCase() === 'dbm' ? String(Number(level.value.toFixed(2))) + ' dBm' : '--';
        }
        return {payload};
    });
    return {state:s, output};
}
module.exports = averageDisplay;
