// utils.js
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Table = require('cli-table3');
const chalk = require('chalk');

const { RunConnection } = require('./proxy.js');

let runningProcesses = {};

function LoadConfiguration(configPath = "") {
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
            console.warn('Error parsing YAML, using default configuration.');
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

function ApplicationStart(name, configuration) {
    if (!configuration) {
        console.error('No configuration provided. Cannot start application.');
        return;
    }

    if (configuration.token === '') {
        console.log('[ ERROR ] Authentication token is missing. Add it using: ./[binary_name] add-token [your_token]');
        return;
    }

    const apps = configuration.applications || {};
    let targetName = name;

    if (!targetName) {
        const keys = Object.keys(apps);
        if (keys.length === 0) {
            console.error('No applications configured to start.');
            return;
        }
        targetName = keys[0];
    }

    const app = apps[targetName];
    if (!app) {
        return;
    }

    const token = configuration.token || '';
    const appId = app.appId;
    const scheme = app.scheme || 'http';
    const addr = app.addr || '80';
    const inspect = !!app.inspect;

    RunConnection(appId, token, scheme, addr, inspect).catch(err => {
        console.error('Failed to start connection:', err.message || err);
    });
}

function ApplicationStop(name) {

}

function ApplicationEnable(name) {
 
}

function ApplicationDisable(name) {

}

function ApplicationSetup(credentials, tunnelConfig) {

}

function ApplicationStatus() {
    const config = LoadConfiguration();
    const apps = Object.entries(config.applications);

    const table = new Table({
        head: [
            chalk.cyanBright('id'),
            chalk.cyanBright('name'),
            chalk.cyanBright('mode'),
            chalk.cyanBright('↺'),
            chalk.cyanBright('status'),
            chalk.cyanBright('cpu'),
            chalk.cyanBright('memory')
        ],
        colWidths: [4, 20, 15, 6, 10, 8, 10]
    });

    apps.forEach(([name, app], index) => {
        const running = runningProcesses[name] || { retries: 0, pid: null };
        const status = running.pid ? chalk.greenBright('online') : chalk.redBright('offline');
        const cpu = running.pid ? `${Math.floor(Math.random()*5)}%` : '0%';
        const memory = running.pid ? `${(Math.random()*100).toFixed(1)}mb` : '0mb';

        table.push([
            chalk.cyanBright(index),
            name,
            chalk.bold.bgWhiteBright.black(app.scheme),
            running.retries,
            status,
            cpu,
            memory
        ]);
    });

    console.log(table.toString());
}

module.exports = { LoadConfiguration, ApplicationStart, ApplicationStop, ApplicationEnable, ApplicationDisable, ApplicationSetup, ApplicationStatus, runningProcesses };
