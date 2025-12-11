const WebSocket = require('ws');
const axios = require('axios');
const os = require('os');
const https = require('https');

const { raw } = require('body-parser');
const { stat } = require('fs');
const { clear } = require('console');
const { config } = require('process');

let active_websockets = {};

async function Inspect(TUNNEL_WS, LOCAL_BASE, public_url) {
   console.clear();

    const colors = {
        green: "\x1b[32m",
        white: "\x1b[37m",
        blue: "\x1b[34m",
        purple: "\x1b[95m",  
        underline: "\x1b[4m",
        reset: "\x1b[0m"
    };

    const regions = {
        "wss://wss-sfo2-prod.deposure.com": "sfo2 (San Francisco)",
        "wss://wss-01-eu.deposure.com": "fra1 (Frankfurt)"
    };

    const urls = {
        "wss://wss-sfo2-prod.deposure.com": "https://sfo2-prod.deposure.com",
        "wss://wss-01-eu.deposure.com": "https://fra1-prod.deposure.com"
    };

    const regionName = regions[TUNNEL_WS] || "Unknown Region";
    const httpBaseURL = urls[TUNNEL_WS];

    const start = Date.now();
    await axios.get(httpBaseURL, { timeout: 3000 });
    const latency = Date.now() - start;

    const line = "─".repeat(50);

    console.log(line);

    console.log('WEBSOCKET >> DATA');

    const data = {
        'Status': `${colors.green}● Live${colors.reset}`,
        'Region': `${colors.white}${regionName} ${colors.reset} ${latency}ms`,
        'Service': `${colors.blue}http${colors.reset}`,
        "Local URL": `${colors.white}${LOCAL_BASE}${colors.reset}`,
        "Public URL": `${colors.purple}${colors.underline}${public_url}${colors.reset}`
    };

    function printColumns(obj) {
        const longestKey = Math.max(...Object.keys(obj).map(k => k.length));

        for (const [key, value] of Object.entries(obj)) {
            const paddedKey = key.padEnd(longestKey, ' ');
            console.log(`${paddedKey}     ${value}`);
        }
    }

    console.log(line);

    printColumns(data);

    console.log(line);

    console.log('TRAFFIC INSPECTOR');

    console.log(line);
}


async function GetPublicIP(BEST_LATENCY_DOMAIN) {
    return new Promise((resolve, reject) => {
        https.get(`https://${BEST_LATENCY_DOMAIN}.deposure.com/location`, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.location.ip);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function GetApplicationInfo(appId, session, BEST_LATENCY_DOMAIN) {
    try {
        const response = await axios.get(`https://${BEST_LATENCY_DOMAIN}.deposure.com/handler?event=applications_info_event&applicationId=${appId}`, {
            headers: { Authorization: `Bearer ${session}` },
            timeout: 15000
        });

        const data = response.data.data;
        
        return data;
    } catch (err) {
        return err;
    }
}

/**
 * options: { appId, TUNNEL_WS, LOCAL_BASE, token, metrics }
 */
async function StartWebsocket(options = {}) {
    const { appId, TUNNEL_WS, LOCAL_BASE, BEST_LATENCY_DOMAIN, token, metrics, inspect } = options;

    let reconnectDelay = 3000;
    let ws;

    async function connect() {
        try {
            const application_info = await GetApplicationInfo(appId, token, BEST_LATENCY_DOMAIN);

            ws = new WebSocket(TUNNEL_WS);
            let analytics = metrics || {};

            ws.on('open', async () => {
                const port = LOCAL_BASE.split(':').pop();

                let host;
                try {
                    host = await GetPublicIP(BEST_LATENCY_DOMAIN);
                } catch (e) {
                    host = '127.0.0.1'; 
                }

                ws.send(JSON.stringify({
                    type:    'init',
                    appId: appId,
                    port,
                    token,
                    host: `${os.type()} ${os.release()}`,
                    ip_address: host
                }));

                analytics.forwarding.tunnel = `https://${application_info.normalized_name}-${appId.split('-')[0]}.deposure.live`;

                if (inspect) {
                    await Inspect(TUNNEL_WS, LOCAL_BASE, analytics.forwarding.tunnel);
                }
            });

            ws.on('message', async (data) => {
                let msg;

                try {
                    msg = JSON.parse(data);
                } catch (e) {
                    process.exit(1);
                }

                if (msg.type === 'http-request') {
                    const rawBody = msg.body || '';

                    const { method, path = '', requestId, headers } = msg;
                    const url = `${LOCAL_BASE}/${path}`;
                    const proxiedHeaders = { ...headers };

                    if (analytics.recentRequests.length > 50) {
                        analytics.recentRequests.shift();
                    }

                    const skip = [
                        'host',
                        'content-length',
                        'transfer-encoding',
                        'upgrade-insecure-requests',
                        'connection'
                    ];

                    for (const h of skip) {
                        delete proxiedHeaders[h];
                    }

                    const isStripeWebhook = !!headers['stripe-signature'];

                    if (rawBody) {
                        proxiedHeaders['content-type'] = 'application/json';
                    }

                    proxiedHeaders.host = `${LOCAL_BASE.replace('http://', '').toLowerCase()}`;

                    let status, respHeaders, bodyB64;
                    try {
                        const resp = await axios({
                            method,
                            url,
                            headers: proxiedHeaders,
                            data: rawBody || undefined,
                            responseType: 'arraybuffer',
                            validateStatus: () => true 
                        });

                        status = resp.status;
                        respHeaders = resp.headers;
                        bodyB64 = Buffer.from(resp.data).toString('base64');
                        metrics.recentRequests.push({ method, path: `${url.replace(`${LOCAL_BASE}`, '')}`, status });
                        console.log(`${method} ${url.replace(`${LOCAL_BASE}`, '')} ${status}`);
                    } catch (err) {
                        status      = 10013;
                        respHeaders = { 'content-type': 'text/plain' };
                        bodyB64     = Buffer.from(String(err)).toString('base64');
                        metrics.recentRequests.push({ method, path: `${url.replace(`${LOCAL_BASE}`, '')}`, status });
                        console.log(`${method} ${url.replace(`${LOCAL_BASE}`, '')} ${status}`);
                    }

                    const responseMsg = {
                        type: 'http-response',
                        requestId,
                        statusCode: status,
                        headers: respHeaders,
                        body: bodyB64
                    };

                    ws.send(JSON.stringify(responseMsg));
                } else if (msg.type === 'connection_exit') {
                    console.clear(); 
                    process.exit(0);
                }
            });

            ws.on('close', (code, reason) => {
                console.log(`WebSocket closed. Code: ${code}, Reason: ${reason}`);
                reconnect();
            });

            ws.on('error', (err) => {
                console.log("WebSocket error:", err.message);
                reconnect();
            });
        } catch (err) {
            console.log("WebSocket connection failed:", err.message);
            reconnect();
        }
    }

    function reconnect() {
        console.log(`Reconnecting in ${reconnectDelay / 1000}s...`);
        setTimeout(() => {
            connect();
        }, reconnectDelay);
    }

    connect();
}

module.exports = { StartWebsocket };
