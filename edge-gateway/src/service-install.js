'use strict';

const path = require('path');
const fs = require('fs');
const secretStore = require('./secretStore');
const { createScm, registerService, ensureRunning } = require('./service-lifecycle');

async function installService({ installDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..'), env = process.env, readConfig = (file) => JSON.parse(fs.readFileSync(file, 'utf8')), loadSecret = secretStore.loadSecret, scm = createScm(), createService = (options) => new (require('node-windows').Service)(options), report = console.log } = {}) {
    const configPath = path.join(env.ONLINESCADA_DATA_DIR || path.join(env.ProgramData || installDir, 'OnlineSCADA', 'Factory Connector'), 'config.json');
    try {
        const config = readConfig(configPath);
        if (!config.cloudUrl || !config.gatewayId || !config.apiKeyProtected) throw new Error('Incomplete configuration');
        loadSecret(config, { configPath });
    } catch (_) {
        // JSON/DPAPI errors can include configuration or credential contents.
        throw new Error('Protected connector configuration is missing or invalid. Complete browser authorization again before starting the service.');
    }
    return ensureRunning({
        scm,
        report,
        register: () => registerService(createService({
            name: 'OnlineSCADAFactoryConnector',
            description: 'Runs the OnlineSCADA Factory Connector in the background.',
            script: path.join(installDir, 'src', 'service-entry.js'),
            execPath: path.join(installDir, 'runtime', 'node.exe'),
            workingDirectory: installDir,
            nodeOptions: ['--max-old-space-size=4096'],
        })),
    });
}

if (require.main === module) {
    installService().catch((error) => {
        console.error(`[x] Service installation failed: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = { installService };
