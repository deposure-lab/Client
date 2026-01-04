const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function load_configuration(configPath = "") {
    if (!configPath) {
        configPath = process.platform === 'win32'
            ? 'C:/deposure/deposure.yml'
            : '/etc/deposure/deposure.yml';
    }

    let config = {};
    if (fs.existsSync(configPath)) {
        const fileContents = fs.readFileSync(configPath, 'utf8');
        try {
            config = yaml.load(fileContents) || {}; 
        } catch (err) {
            config = {};
        }
    }

    config.version = config.version || '3';
    config.token = config.token || '';
    config.region = config.region || 'default';
    config.console_ui = config.console_ui !== undefined ? config.console_ui : true;
    config.applications = config.applications || {};
    config.meta = config.meta || {};

    const normalizedApps = {};
    for (const [name, app] of Object.entries(config.applications)) {
        normalizedApps[name] = {
            appId: app.appId || null,
            scheme: app.scheme || 'http',
            addr: app.addr || null,
            inspect: app.inspect || false,
            authorization: app.authorization || 'public',
            requestHeaderAdd: app.request_header_add || {},
            responseHeaderAdd: app.response_header_add || {}
        };
    }

    return {
        version: config.version,
        token: config.token,
        region: config.region,
        consoleUI: config.console_ui,
        applications: normalizedApps,
        meta: config.meta
    };
}

module.exports = { load_configuration };
