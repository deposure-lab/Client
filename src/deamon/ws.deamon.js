const WebSocket = require('ws');
const axios = require('axios');
const os = require('os');
const https = require('https');
const { stat } = require('fs');

let active_websockets = {};


function get_system_name() {
    const type = os.type();

    if (type === 'Linux') {
        try {
            const data = fs.readFileSync('/etc/os-release', 'utf8');
            const match = data.match(/^PRETTY_NAME="(.+?)"/m);
            if (match) return match[1];
        } catch (err) {
            return 'Linux';
        }
    }

    if (type === 'Darwin') return 'macOS';
    if (type === 'Windows_NT') return 'Windows 10/11';

    return type;
}

async function run_inspect(websocket_uri, localbase_uri, public_uri) {
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

    const regionName = regions[websocket_uri] || "Unknown Region";
    const httpBaseURL = urls[websocket_uri];

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
        "Local URL": `${colors.white}${localbase_uri}${colors.reset}`,
        "Public URL": `${colors.purple}${colors.underline}${public_uri}${colors.reset}`
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

async function get_public_ip(best_latency_domain) {
    return new Promise((resolve, reject) => {
        https.get(`https://${best_latency_domain}.deposure.com/location`, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.location.ip);
                } catch (err) {
                    reject(err);
                }
            });
        }).on('error', reject);
    });
}

async function get_application_info(session, applicationId, best_latency_domain) {
    try {
        const res = await axios.get(`https://${best_latency_domain}.deposure.com/handler?event=applications_info_event&applicationId=${applicationId}`, {
            headers: { Authorization: `Bearer ${session}` },
            timeout: 15000
        });

        const data = res.data.data;

        return data;
    } catch (err) {
        return err;
    }
} 

async function run_live_ws(options = {}) {
    const { applicationId, websocket_uri, localbase_uri, best_latency_domain, session, metrics, inspect } = options;

    let reconnectDelay = 3000;
    let ws;

    async function connect() {
        try {
            const application_info = await get_application_info(session, applicationId, best_latency_domain);

            ws = new WebSocket(websocket_uri);
            let analytics = metrics || {};

            ws.on('open', async () => {
                const port = localbase_uri.split(':').pop();

                let host;
                try {
                    host = await get_public_ip(best_latency_domain);
                } catch (err) {
                    host = `127.0.0.1`;
                }

                ws.send(JSON.stringify({
                    type: 'init',
                    appId: applicationId,
                    port,
                    token: session,
                    host: get_system_name(),
                    ip_address: host
                }));

                analytics.forwarding.tunnel = `https://${application_info.normalized_name}-${applicationId.split('-')[0]}.deposure.live`;

                if (inspect) {
                    run_inspect(websocket_uri, localbase_uri, analytics.forwarding.tunnel).catch(err => console.error('Inspect Error', err));
                }

            });

            ws.on('message', (data) => {
                let msg;

                try {
                    msg = JSON.parse(data);
                } catch (err) {
                    process.exit(1);
                }

                if (msg.type === 'http-request') {
                    handle_request(msg, localbase_uri, metrics, ws).catch(err => console.error('Request Error'));
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

async function handle_request(msg, localbase_uri, metrics, ws) {
    const rawBody = msg.body || '';
    const { method, path = '', requestId, headers } = msg;
    const url = `${localbase_uri}/${path}`;
    
    const proxiedHeaders = { ...headers };

    if (metrics.recentRequests.length > 50) metrics.recentRequests.shift();

    const skip = [
        'host',
        'content-length',
        'transfer-encoding',
        'upgrade-insecure-requests',
        'connection'
    ];

    for (const h of skip) {
        delete proxiedHeaders[h];
        delete proxiedHeaders[h.toLowerCase()];
    }

    proxiedHeaders['host'] = localbase_uri.replace(/^http:\/\/|^https:\/\//, '').toLowerCase();

    let parsed = rawBody;
    if (rawBody) {
        parsed = JSON.parse(rawBody);
        parsed = JSON.stringify(parsed, null, 2)
    }

    let status, respHeaders, bodyB64;
    try {        
        const resp = await axios({
            method,
            url,
            headers: proxiedHeaders,
            data: parsed || undefined,
            transformRequest: [(data) => data],
            responseType: 'arraybuffer',
            maxRedirects: 0,
            validateStatus: () => true
        });

        status = resp.status;
        respHeaders = { ...resp.headers };
        
        bodyB64 = Buffer.from(resp.data).toString('base64');

        metrics.recentRequests.push({ method, path: `${url.replace(`${localbase_uri}`, '')}`, status });
        console.log(`${method} ${url.replace(`${localbase_uri}`, '')} ${status}`);
    } catch (err) {
        status = 10013;
        respHeaders = { 'content-type': 'text/plain' };

        bodyB64 = Buffer.from(String(err)).toString('base64');

        metrics.recentRequests.push({ method, path: `${url.replace(`${localbase_uri}`, '')}`, status });
        console.log(`${method} ${url.replace(`${localbase_uri}`, '')} ${status}`);
    }

    const responseMsg = {
        type: 'http-response',
        requestId,
        statusCode: status,
        headers: respHeaders,
        body: bodyB64
    };

    ws.send(JSON.stringify(responseMsg));
}

module.exports = { run_live_ws };
