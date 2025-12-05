#!/usr/bin/env node
const { handleCommandsCLI } = require('./src/deposure/commands.js');
const { LoadConfiguration } = require('./src/deposure/utils.js');

const config = LoadConfiguration();
handleCommandsCLI(config);