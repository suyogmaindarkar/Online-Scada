'use strict';

const path = require('path');
const { spawn } = require('child_process');
const { run: runPairing } = require('./pairing-ui');

async function install() {
    const paired = await runPairing();
    if (!paired) return false;

    return new Promise((resolve) => {
        const child = spawn(process.execPath, [path.join(__dirname, 'service-install.js'), process.argv[2] || path.resolve(__dirname, '..')], {
            windowsHide: true,
            stdio: 'ignore',
        });
        child.once('error', () => resolve(false));
        child.once('exit', (code) => resolve(code === 0));
    });
}

if (require.main === module) install().then((success) => { if (!success) process.exitCode = 1; });
module.exports = { install };
