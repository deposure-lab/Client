const { StartWebsocket } = require('./websocket.js');

process.on('message', async (data) => {
    const {
        appId,
        token,
        scheme,
        addr,
        BEST_LATENCY_DOMAIN,
        metrics
    } = data;

    const LOCAL_BASE = `${scheme}://127.0.0.1:${addr}`;

    try {
        await StartWebsocket({
            appId,
            TUNNEL_WS: `wss://${BEST_LATENCY_DOMAIN}.deposure.com/tunnel`,
            LOCAL_BASE,
            BEST_LATENCY_DOMAIN,
            token,
            metrics
        });
    } catch (err) {
        console.error(`[${appId}] Websocket crashed:`, err.message);
    }
});
