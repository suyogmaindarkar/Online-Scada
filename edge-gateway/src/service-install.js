'use strict';

const path = require('path');
const fs = require('fs');
const Service = require('node-windows').Service;
const secretStore = require('./secretStore');

const installDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..');
const configPath = path.join(process.env.ProgramData || path.join(installDir, 'data'), 'OnlineSCADA', 'Factory Connector', 'config.json');
if (!fs.existsSync(configPath)) {
    console.error('[x] Pairing was not completed. The Factory Connector service was not installed.');
    process.exit(2);
}
try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!config.cloudUrl || !config.gatewayId || !config.apiKeyProtected) throw new Error('Protected connector configuration is incomplete');
    secretStore.loadSecret(config, { configPath });
} catch (error) {
    console.error(`[x] Protected connector configuration is invalid: ${error.message}`);
    process.exit(2);
}
const service = new Service({
    name: 'OnlineSCADAFactoryConnector',
    description: 'Runs the OnlineSCADA Factory Connector in the background.',
    script: path.join(installDir, 'src', 'service-entry.js'),
    execPath: path.join(installDir, 'runtime', 'node.exe'),
    workingDirectory: installDir,
    nodeOptions: ['--max-old-space-size=4096'],
});

let settled = false;
let timeout;
const fail = (error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    console.error(`[x] Service installation failed: ${error?.message || error}`);
    process.exitCode = 1;
};
service.on('install', () => service.start());
service.on('alreadyinstalled', () => service.start());
service.on('start', () => { settled = true; clearTimeout(timeout); });
service.on('error', fail);
timeout = setTimeout(() => { if (!settled) fail(new Error('Timed out waiting for the Windows service to start')); }, 30000);
service.install();
