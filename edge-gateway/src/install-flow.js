'use strict';

const path = require('path');
const { spawn } = require('child_process');
const { run: runPairing } = require('./pairing-ui');

async function install({ pair = runPairing, spawnProcess = spawn, reportError = console.error, installDir = process.argv[2] || path.resolve(__dirname, '..') } = {}) {
    const paired = await pair();
    if (!paired) {
        reportError('[x] Factory Connector authorization did not finish. Service startup was not confirmed.');
        return false;
    }

    return new Promise((resolve) => {
        let settled = false;
        const finish = (success, message) => {
            if (settled) return;
            settled = true;
            if (message) reportError(message);
            resolve(success);
        };
        try {
            const child = spawnProcess(process.execPath, [path.join(__dirname, 'service-install.js'), installDir], {
                windowsHide: true,
                stdio: 'inherit',
            });
            child.once('error', () => finish(false, '[x] Could not launch Factory Connector service setup. Run the installer as an administrator.'));
            child.once('close', (code) => finish(code === 0, code === 0 ? null : `[x] Factory Connector service setup failed (exit code ${Number.isInteger(code) ? code : 'unavailable'}). Service startup was not confirmed.`));
        } catch (_) {
            finish(false, '[x] Could not launch Factory Connector service setup. Run the installer as an administrator.');
        }
    });
}

if (require.main === module) install().then((success) => { if (!success) process.exitCode = 1; }).catch(() => {
    console.error('[x] Factory Connector setup did not complete. Run the installer again.');
    process.exitCode = 1;
});
module.exports = { install };
