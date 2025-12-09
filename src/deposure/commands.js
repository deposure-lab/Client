// Modified commands.js with sudo check
const inquirer = require('inquirer').default;
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
const { ApplicationDisable, ApplicationEnable, ApplicationStart, ApplicationStop, ApplicationSetup, ApplicationStatus } = require('./utils.js');

let configuration;

function ensureSudo() {
    if (process.platform !== 'win32' && process.getuid && process.getuid() !== 0) {
        console.error('This command must be run as sudo/root.');
        process.exit(1);
    }
}

async function handleCommandsCLI(config) {
    configuration = config;

    ensureSudo();

    const args = process.argv.slice(2);
    const command = args[0];
    const target = args[1]; 

    switch(command) {
        case 'start':
            ApplicationStart(target, configuration);
            break;

        case 'stop':
            ApplicationStop(target);
            break;

        case 'enable':
            ApplicationEnable(target);
            break;

        case 'disable':
            ApplicationDisable(target);
            break;

        case 'status':
            ApplicationStatus();
            break;

        case 'create':
            await createApplication();
            break;

        case 'add-token':
            if (!target) return console.error('Provide a token: add-token {token}');
            await setToken(target);
            break;
            
        default:
            console.log('Available commands: start, stop, enable, disable, status, create, add-token');
            break;
    }
}

async function createApplication() {
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

async function setToken(token) {
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


module.exports = { handleCommandsCLI, ApplicationStart, ApplicationEnable, ApplicationDisable, ApplicationSetup };
