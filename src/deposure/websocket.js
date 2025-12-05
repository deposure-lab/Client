const WebSocket = require('ws');
const axios = require('axios');
const os = require('os');
const https = require('https');

const { raw } = require('body-parser');
const { stat } = require('fs');
const { clear } = require('console');
const { config } = require('process');

let active_websockets = {};

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
    const { appId, TUNNEL_WS, LOCAL_BASE, BEST_LATENCY_DOMAIN, token, metrics } = options;

    const application_info = await GetApplicationInfo(appId, token, BEST_LATENCY_DOMAIN);

    const ws = new WebSocket(TUNNEL_WS);

    console.log(`Connected with ${TUNNEL_WS}`);

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
                console.log(err);
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
        analytics.is_alive = false;
        console.clear();

        if (code === 1000 && reason === 'Terminated by user') {
            process.exit(0);
        }

        StartWebsocket({
            appId,
            TUNNEL_WS,
            LOCAL_BASE,
            BEST_LATENCY_DOMAIN,
            token,
            metrics
        });
    });

    ws.on('error', (e) => {
        StartWebsocket({
            appId,
            TUNNEL_WS,
            LOCAL_BASE,
            BEST_LATENCY_DOMAIN,
            token,
            metrics
        });
        process.exit(0);
    });
}

module.exports = { StartWebsocket };