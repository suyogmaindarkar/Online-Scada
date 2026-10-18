'use strict';

const { execFile } = require('child_process');

// node-windows uses its lower-case executable name as the WinSW service ID.
const SERVICE_NAME = 'onlinescadafactoryconnector.exe';
const STATE = Object.freeze({ STOPPED: 1, START_PENDING: 2, STOP_PENDING: 3, RUNNING: 4, CONTINUE_PENDING: 5, PAUSE_PENDING: 6, PAUSED: 7 });

function createScm({ execute = execFile, commandTimeoutMs = 15000 } = {}) {
    function command(action) {
        return new Promise((resolve, reject) => {
            execute('sc.exe', [action, SERVICE_NAME], { windowsHide: true, encoding: 'utf8', timeout: commandTimeoutMs }, (error, stdout = '') => {
                if (error) {
                    // Do not forward command output or arbitrary error messages to logs.
                    const failure = new Error(`Windows service ${action} failed (code ${Number.isInteger(error.code) ? error.code : 'unavailable'}). Run setup as an administrator and check Windows Services.`);
                    failure.code = error.code;
                    reject(failure);
                } else {
                    resolve(stdout);
                }
            });
        });
    }
    return {
        async query() {
            let output;
            try { output = await command('query'); } catch (error) {
                if (error.code === 1060) return null;
                throw error;
            }
            const match = output.match(/^\s*STATE\s*:\s*([1-7])\b/m);
            if (!match) throw new Error('Windows did not return a recognizable Factory Connector service state. Check Windows Services.');
            return Number(match[1]);
        },
        async start() {
            try { await command('start'); } catch (error) {
                if (error.code !== 1056) throw error; // Already running; caller still verifies SCM.
            }
        },
        async stop() {
            try { await command('stop'); } catch (error) {
                if (error.code !== 1062) throw error; // Already stopped; caller still verifies SCM.
            }
        },
    };
}

function registerService(service, { timeoutMs = 45000 } = {}) {
    return new Promise((resolve, reject) => {
        const cleanup = () => {
            clearTimeout(timer);
            for (const [event, listener] of listeners) service.removeListener(event, listener);
        };
        const complete = (error) => { cleanup(); error ? reject(error) : resolve(); };
        const listeners = [
            ['install', () => complete()],
            ['alreadyinstalled', () => complete(new Error('Service wrapper files already exist, but the Windows service is not registered. Repair the Factory Connector installation.'))],
            ['invalidinstallation', () => complete(new Error('The Factory Connector service installation is incomplete. Repair the installation.'))],
            ['error', () => complete(new Error('Windows could not register the Factory Connector service. Run setup as an administrator and check Windows Services.'))],
        ];
        const timer = setTimeout(() => complete(new Error('Timed out registering the Factory Connector Windows service. Check Windows Services before retrying.')), timeoutMs);
        for (const [event, listener] of listeners) service.once(event, listener);
        try { service.install(); } catch (_) { complete(new Error('The Factory Connector service could not be registered. Run setup as an administrator.')); }
    });
}

async function ensureRunning({ scm, register, timeoutMs = 60000, pollIntervalMs = 500, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), report = () => {} }) {
    async function waitFor(accept, description) {
        const deadline = now() + timeoutMs;
        while (true) {
            const state = await scm.query();
            if (accept(state)) return state;
            if (now() >= deadline) throw new Error(`Timed out waiting for the Factory Connector service to ${description}. Check Windows Services and connector logs.`);
            await sleep(pollIntervalMs);
        }
    }

    let state = await scm.query();
    if (state === null) {
        report('[i] Registering the Factory Connector Windows service...');
        await register();
        // node-windows install events are not proof of SCM registration.
        state = await waitFor((value) => value !== null, 'be registered');
    }
    if ([STATE.START_PENDING, STATE.CONTINUE_PENDING, STATE.PAUSE_PENDING].includes(state)) {
        state = await waitFor((value) => [STATE.RUNNING, STATE.STOPPED, STATE.PAUSED].includes(value), 'finish its pending transition');
    }
    if (state === STATE.STOP_PENDING) {
        state = await waitFor((value) => value === STATE.STOPPED, 'stop');
    }
    if ([STATE.RUNNING, STATE.PAUSED].includes(state)) {
        report('[i] Restarting the Factory Connector to load the saved authorization...');
        await scm.stop();
        state = await waitFor((value) => value === STATE.STOPPED, 'stop');
    }
    if (state !== STATE.STOPPED) throw new Error('The Factory Connector service is not in a startable state. Check Windows Services.');
    report('[i] Starting the Factory Connector Windows service...');
    await scm.start();
    await waitFor((value) => value === STATE.RUNNING, 'reach RUNNING');
    report('[+] Windows confirms the Factory Connector service is running. Cloud connection is verified separately in OnlineSCADA.');
    return true;
}

module.exports = { SERVICE_NAME, STATE, createScm, registerService, ensureRunning };
