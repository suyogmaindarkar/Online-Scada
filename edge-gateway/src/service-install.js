'use strict';

const path = require('path');
const Service = require('node-windows').Service;

const installDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..');
const service = new Service({
    name: 'OnlineSCADAFactoryConnector',
    description: 'Runs the OnlineSCADA Factory Connector in the background.',
    script: path.join(installDir, 'src', 'service-entry.js'),
    execPath: path.join(installDir, 'runtime', 'node.exe'),
    workingDirectory: installDir,
    nodeOptions: ['--max-old-space-size=4096'],
});

service.on('install', () => service.start());
service.on('alreadyinstalled', () => service.start());
service.on('error', (error) => { console.error(`[x] Service installation failed: ${error.message}`); process.exitCode = 1; });
service.install();
