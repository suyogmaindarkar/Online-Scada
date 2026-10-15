'use strict';

const path = require('path');
const Service = require('node-windows').Service;
const service = new Service({ name: 'OnlineSCADAFactoryConnector', script: path.join(__dirname, 'service-entry.js') });
service.on('uninstall', () => console.log('[+] OnlineSCADA Factory Connector service removed.'));
service.on('alreadyuninstalled', () => console.log('[+] OnlineSCADA Factory Connector service was not installed.'));
service.on('error', (error) => { console.error(`[x] Service removal failed: ${error.message}`); process.exitCode = 1; });
service.uninstall();
