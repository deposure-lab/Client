#!/usr/bin/env node
const cli_commands = require('./src/cli/commands.cli.js');
const core_configuration = require('./src/core/configuration.core.js');

const config = core_configuration.load_configuration();
cli_commands.handler(config);
