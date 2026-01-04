const axios = require('axios');
const deamon_ws = require('./ws.deamon.js');

const VERSION = '2.11';

const datacenters = [
    'public-api'
];

async function get_lowest_latency() {
    let best_latency = Infinity;
    let best_latency_domain = 'public-api';

    for (const dc of datacenters) {
        const url =  `https://${dc}.deposure.com`;
        
        try {
            const start = Date.now();
            await axios.get(url, { timeout: 3000 });
            const latency = Date.now() - start;

            if (latency < best_latency) {
                best_latency = latency;
                best_latency_domain = dc;
            }
        } catch (err) { }
    }

    return best_latency_domain;
}

async function get_websocket_uri(session, applicationId, best_latency_domain) {
    try {
        const res = await axios.get(`https://${best_latency_domain}.deposure.com/handler?event=applications_datacenter_event&applicationId=${applicationId}`, {
            headers: { Authorization: `Bearer ${session}` },
            timeout: 15000
        });

        const data = res.data.data;
        if (data && (data.public || data.domain) && (data.ws || data.public)) {
            const datacenter_uri = data.domain || data.public;
            const websocket_uri = data.ws ? `wss://${data.ws}`: `ws://${data.public}:3332`;

            return { datacenter_uri, websocket_uri };
        }
    } catch (err) { return err; }

    return null;
}

async function deamon_ws_run(session, applicationId, scheme = 'http', addr = '80', inspect = false, authorization = 'default') {
    const best_latency_domain = await get_lowest_latency();

    const datacenter = await get_websocket_uri(session, applicationId, best_latency_domain);
    if (!datacenter) {
        throw new Error('Failed to resolve datacenter for application'); 
    }

    const { datacenter_uri, websocket_uri } = datacenter;

    const localbase_uri = `${scheme}://127.0.0.1:${addr}`;

    const metrics = {
        latest_version: '',
        mail: '',
        plan: '',
        is_alive: true,
        totalRequests: 0,
        latencies: [],
        latency: 0,
        recentRequests: [],
        forwarding: { local: localbase_uri, tunnel: '' }
    };

    return deamon_ws.run_live_ws({ applicationId, websocket_uri, localbase_uri, best_latency_domain, session, metrics, inspect });
}

module.exports = { deamon_ws_run };
