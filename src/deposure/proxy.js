const axios = require('axios');
const { StartWebsocket } = require('./websocket.js');
const { spawn } = require('child_process');

const VERSION = '2.17.6';

const datacenters = [
    'public-api',
];

async function GetLowestLatency() {
    let bestLatency = Infinity;
    let BEST_LATENCY_DOMAIN = 'api-dev';

    for (const dc of datacenters) {
        const url = `https://${dc}.deposure.com`;
        try {
            const start = Date.now();
            await axios.get(url, { timeout: 3000 });
            const latency = Date.now() - start;

            if (latency < bestLatency) {
                bestLatency = latency;
                BEST_LATENCY_DOMAIN = dc;
            }
        } catch (err) { }
    }

    return BEST_LATENCY_DOMAIN;
}

async function GetWebsocket(token, appId, BEST_LATENCY_DOMAIN) {
    try {
        const response = await axios.get(`https://${BEST_LATENCY_DOMAIN}.deposure.com/handler?event=applications_datacenter_event&applicationId=${appId}`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15000
        });

        const data = response.data.data;
        if (data && (data.public || data.domain) && (data.ws || data.public)) {
            const DATACENTER_URL = data.domain || data.public;
            const TUNNEL_WS = data.ws ? `wss://${data.ws}` : `wss://${data.public}:3332`;

            return { DATACENTER_URL, TUNNEL_WS };
        }
    } catch (err) {
        return err;
    }

    return null;
}

async function RunConnection(appId, token, scheme = 'http', addr = '80', inspect = false, authorization = 'default') {
    const BEST_LATENCY_DOMAIN = await GetLowestLatency();

    const datacenter = await GetWebsocket(token, appId, BEST_LATENCY_DOMAIN);
    if (!datacenter) {
        throw new Error('Failed to resolve datacenter for application');
    }

    const { DATACENTER_URL, TUNNEL_WS } = datacenter;

    console.log(TUNNEL_WS);

    const LOCAL_BASE = `${scheme}://127.0.0.1:${addr}`;

    const metrics = {
        latest_version: '',
        mail: '',
        plan: '',
        is_alive: true,
        totalRequests: 0,
        latencies: [],
        latency: 0,
        recentRequests: [],
        forwarding: { local: `${LOCAL_BASE}`, tunnel: '' }
    };

    if (inspect) {
        Inspect(metrics, appId, DATACENTER_URL, BEST_LATENCY_DOMAIN, TUNNEL_WS, LOCAL_BASE);
    }

    return StartWebsocket({ appId, TUNNEL_WS, LOCAL_BASE, BEST_LATENCY_DOMAIN, token, metrics });
}

function Inspect(metrics, NORMALIZED_NAME, DATACENTER_URL, BEST_LATENCY_DOMAIN, TUNNEL_WS, LOCAL_BASE) {
    const interval = setInterval(() => {
        if (!metrics.is_alive) {
            clearInterval(interval);
            return;
        }

        console.clear();
        console.log(`deposure client — forwarding ${metrics.forwarding.tunnel || 'unknown'} -> ${LOCAL_BASE}`);
        console.log(`latency: ${metrics.latency} ms, requests: ${metrics.totalRequests}`);
    }, 1500);
}

module.exports = { RunConnection };