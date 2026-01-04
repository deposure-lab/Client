const inquirer = require('inquirer').default;
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

const deamon_background = require('../daemon/background.deamon.js');

function application_start(name, configuration) {
    if (!configuration) {
        console.error('No configuration provided. Cannot start application.');
        return;
    }

    if (configuration.token === '') {
        console.log('[ ERROR ] Authentication token is missing. Add it using: deposure add-token <token>');
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

    deamon_background.deamon_ws_run(token, appId, scheme, addr, inspect).catch(err => {
        console.error('Failed to start connection:', err.message || err);
    });
}

async function create_application() {
    const questions = [
        { type: 'input', name: 'name', message: 'Application name:' },
        { type: 'input', name: 'appId', message: 'Application ID (UUID):' },
        { type: 'input', name: 'port', message: 'Port:' },
        { type: 'list', name: 'scheme', message: 'Protocol:', choices: ['http', 'tcp', 'udp'], default: 'http' },
        { type: 'confirm', name: 'inspect', message: 'Enable inspect (live request inspection)?', default: true },
    ];

    const answers = await inquirer.prompt(questions);

    const configPath = process.platform === 'win32'
        ? 'C:/deposure/deposure.yml'
        : '/etc/deposure/deposure.yml';

    const dir = path.dirname(configPath);

    if (!fs.existsSync(dir)) {
        console.log(`Directory "${dir}" not found. Creating...`);
        fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(configPath)) {
        console.log(`Config file not found. Creating new one at: ${configPath}`);
        fs.writeFileSync(configPath, yaml.dump({}), 'utf8');
    }

    let config = {};
    try {
        const content = fs.readFileSync(configPath, 'utf8');
        if (content.trim()) config = yaml.load(content) || {};
    } catch (err) {
        console.error('Error reading configuration, using empty default config.');
    }

    config.version = config.version || "3";
    config.token = config.token || "";
    config.region = config.region || "default";
    config.console_ui = config.console_ui !== undefined ? config.console_ui : true;
    config.applications = config.applications || {};
    config.meta = config.meta || {};

    config.applications[answers.name] = {
        appId: answers.appId,
        addr: answers.port,
        scheme: answers.scheme,
        inspect: answers.inspect,
        authorization: answers.authorization
    };

    fs.writeFileSync(configPath, yaml.dump(config), 'utf8');
    console.log(`Application "${answers.name}" added successfully to ${configPath}`);
}

async function set_token(token) {
    const configPath = process.platform === 'win32'
        ? 'C:/deposure/deposure.yml'
        : '/etc/deposure/deposure.yml';

    if (!fs.existsSync(configPath)) {
        console.error('Configuration file not found. Use create first.');
        return;
    }

    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    config.token = token;

    fs.writeFileSync(configPath, yaml.dump(config), 'utf8');
    console.log(`Token updated successfully in ${configPath}`);
}

module.exports = { application_start, create_application, set_token };
