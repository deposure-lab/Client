const inquirer = require('inquirer').default;
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

const core_functions = require('../core/functions.core.js');

let configuration;

function ensure_sudo() {
    if (process.platform !== 'win32' && process.getuid && process.getuid() !== 0) {
        console.error('This command must be run as sudo/root.');
        process.exit(1);
    }
}

function cli_cmd_help() {
    console.log(`
Usage:
deposure <command> [options]

Commands:
prepair            Prepair Enviroment for our Client
start <app>        Start application by name
stop <app>         Stop application by name
enable <app>       Enable application on system startup
disable <app>      Disable application on system startup
create             Create a new application interactively
add-token <token>  Save authentication token`);
}

async function handler(config) {
    configuration = config;

    const args = process.argv.slice(2);
    const command = args[0];
    const target = args[1]; 

    switch (command) {
        case 'prepair':
            ensure_sudo();
            break;
        case 'start': 
            core_functions.application_start(target, configuration);
            break;
        case 'stop':
            break;
        case 'enable':
            ensure_sudo();
            break;
        case 'disable':
            ensure_sudo();
            break;
        case 'create':
            ensure_sudo();
            await core_functions.create_application();
            break;
        case 'add-token':
            ensure_sudo();
            if (!target) return console.error('Provide a token: add-token {token}');
            await core_functions.set_token(target)
            break;
        default:
            console.log(`Unknown command: ${command}`);
            cli_cmd_help();
            break;
    }
};

module.exports = { handler };
