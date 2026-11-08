'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const path = require('path');
const { SERVICE_NAME, STATE, createScm, registerService, ensureRunning } = require('../src/service-lifecycle');
const { installService } = require('../src/service-install');
const { install, checkHasValidConfig } = require('../src/install-flow');

function scenario(states) {
    const calls = [];
    let clock = 0;
    let lastState = states[states.length - 1];
    return {
        calls,
        scm: {
            query: async () => { lastState = states.length ? states.shift() : lastState; calls.push(`query:${lastState}`); return lastState; },
            start: async () => { calls.push('start'); },
            stop: async () => { calls.push('stop'); },
        },
        register: async () => { calls.push('register'); },
        now: () => clock,
        sleep: async (ms) => { clock += ms; },
        timeoutMs: 20,
        pollIntervalMs: 10,
    };
}

test('re-pair of a running service stops the old process before starting with new credentials', async () => {
    const run = scenario([STATE.RUNNING, STATE.STOP_PENDING, STATE.STOPPED, STATE.START_PENDING, STATE.RUNNING]);
    const messages = [];
    await ensureRunning({ ...run, report: (message) => messages.push(message) });
    assert.deepEqual(run.calls, ['query:4', 'stop', 'query:3', 'query:1', 'start', 'query:2', 'query:4']);
    assert.equal(messages.filter((message) => message.startsWith('[+]')).length, 1);
    assert.match(messages.at(-1), /Cloud connection is verified separately/);
});

test('a stopped installed service starts without attempting registration or stop', async () => {
    const run = scenario([STATE.STOPPED, STATE.START_PENDING, STATE.RUNNING]);
    await ensureRunning(run);
    assert.deepEqual(run.calls, ['query:1', 'start', 'query:2', 'query:4']);
});

test('a new service waits for real SCM registration before starting', async () => {
    const run = scenario([null, null, STATE.STOPPED, STATE.START_PENDING, STATE.RUNNING]);
    await ensureRunning(run);
    assert.deepEqual(run.calls, ['query:null', 'register', 'query:null', 'query:1', 'start', 'query:2', 'query:4']);
});

test('registration callback without an actual SCM service cannot report success', async () => {
    const run = scenario([null]);
    const messages = [];
    await assert.rejects(ensureRunning({ ...run, report: (message) => messages.push(message) }), /Timed out.*registered/);
    assert.ok(!run.calls.includes('start'));
    assert.ok(messages.every((message) => !message.startsWith('[+]')));
});

test('a pending start is allowed to finish, then restarted to reload saved authorization', async () => {
    const run = scenario([STATE.START_PENDING, STATE.START_PENDING, STATE.RUNNING, STATE.STOPPED, STATE.RUNNING]);
    await ensureRunning(run);
    assert.deepEqual(run.calls, ['query:2', 'query:2', 'query:4', 'stop', 'query:1', 'start', 'query:4']);
});

test('a pending stop completes before starting, and a paused service is restarted', async () => {
    const stopping = scenario([STATE.STOP_PENDING, STATE.STOP_PENDING, STATE.STOPPED, STATE.RUNNING]);
    await ensureRunning(stopping);
    assert.deepEqual(stopping.calls, ['query:3', 'query:3', 'query:1', 'start', 'query:4']);
    const paused = scenario([STATE.PAUSED, STATE.STOPPED, STATE.RUNNING]);
    await ensureRunning(paused);
    assert.deepEqual(paused.calls, ['query:7', 'stop', 'query:1', 'start', 'query:4']);
});

test('a failed stop never starts another process and a successful command alone is not running proof', async () => {
    const stopping = scenario([STATE.RUNNING]);
    const messages = [];
    await assert.rejects(ensureRunning({ ...stopping, report: (message) => messages.push(message) }), /Timed out.*stop/);
    assert.ok(!stopping.calls.includes('start'));
    const starting = scenario([STATE.STOPPED]);
    await assert.rejects(ensureRunning({ ...starting, report: (message) => messages.push(message) }), /Timed out.*RUNNING/);
    assert.ok(messages.every((message) => !message.startsWith('[+]')));
});

test('SCM failures propagate and cannot be mistaken for a missing service', async () => {
    const run = scenario([STATE.STOPPED]);
    run.scm.query = async () => { throw new Error('Access denied'); };
    await assert.rejects(ensureRunning(run), /Access denied/);
    assert.deepEqual(run.calls, []);
});

test('SCM adapter always uses executable service ID and numeric state, not display name', async () => {
    const calls = [];
    const scm = createScm({ execute: (file, args, options, callback) => {
        calls.push({ file, args, options });
        callback(null, 'SERVICE_NAME: onlinescadafactoryconnector.exe\r\n        TYPE : 10 WIN32_OWN_PROCESS\r\n        STATE : 4 RUNNING\r\n');
    } });
    assert.equal(await scm.query(), STATE.RUNNING);
    await scm.stop();
    await scm.start();
    assert.deepEqual(calls.map(({ args }) => args), [['query', SERVICE_NAME], ['stop', SERVICE_NAME], ['start', SERVICE_NAME]]);
    assert.ok(calls.every(({ file, options }) => file === 'sc.exe' && options.timeout > 0 && options.windowsHide));
    assert.equal(SERVICE_NAME, 'onlinescadafactoryconnector.exe');
});

test('SCM adapter only treats 1060 as missing and redacts raw command errors', async () => {
    let code = 1060;
    const scm = createScm({ execute: (_file, _args, _options, callback) => callback(Object.assign(new Error('apiKey=do-not-log'), { code }), 'do-not-log') });
    assert.equal(await scm.query(), null);
    code = 5;
    await assert.rejects(scm.query(), (error) => error.code === 5 && !error.message.includes('do-not-log'));
    const malformed = createScm({ execute: (_file, _args, _options, callback) => callback(null, 'unknown output') });
    await assert.rejects(malformed.query(), /recognizable/);
});

test('SCM adapter accepts benign start/stop races but does not swallow other failures', async () => {
    let code = 1056;
    const scm = createScm({ execute: (_file, _args, _options, callback) => callback(Object.assign(new Error('failure'), { code })) });
    await scm.start();
    code = 1062;
    await scm.stop();
    code = 5;
    await assert.rejects(scm.start(), /code 5/);
    await assert.rejects(scm.stop(), /code 5/);
});

test('node-windows registration handles success, stale wrapper files, errors, invalid installs, and timeout', async () => {
    const service = (event) => {
        const value = new EventEmitter();
        value.install = () => { if (event) value.emit(event, new Error('secret detail')); };
        return value;
    };
    const good = service('install');
    await registerService(good);
    assert.equal(good.listenerCount('error'), 0);
    await assert.rejects(registerService(service('alreadyinstalled')), /not registered/);
    await assert.rejects(registerService(service('invalidinstallation')), /incomplete/);
    await assert.rejects(registerService(service('error')), (error) => !error.message.includes('secret detail'));
    await assert.rejects(registerService(service(null), { timeoutMs: 5 }), /Timed out/);
});

test('protected configuration is validated before any lifecycle changes and errors redact secret material', async () => {
    let queried = false;
    const scm = { query: async () => { queried = true; return STATE.RUNNING; } };
    await assert.rejects(installService({ scm, readConfig: () => { throw new Error('apiKey=private'); } }), (error) => !error.message.includes('private'));
    await assert.rejects(installService({ scm, readConfig: () => ({ cloudUrl: 'https://example.test', gatewayId: 'id' }) }), /configuration/);
    await assert.rejects(installService({ scm, readConfig: () => ({ cloudUrl: 'https://example.test', gatewayId: 'id', apiKeyProtected: 'encrypted' }), loadSecret: () => { throw new Error('secret'); } }), (error) => !error.message.includes('secret'));
    assert.equal(queried, false);
});

test('service setup uses the pairing data-directory override and decrypts before restarting', async () => {
    const calls = [];
    const states = [STATE.RUNNING, STATE.STOPPED, STATE.RUNNING];
    await installService({
        env: { ONLINESCADA_DATA_DIR: path.resolve('custom-connector-data') },
        readConfig: (file) => {
            assert.equal(file, path.join(path.resolve('custom-connector-data'), 'config.json'));
            return { cloudUrl: 'https://example.test', gatewayId: 'id', apiKeyProtected: 'encrypted' };
        },
        loadSecret: () => { calls.push('decrypt'); return 'never logged'; },
        scm: {
            query: async () => { calls.push('query'); return states.shift(); },
            stop: async () => { calls.push('stop'); },
            start: async () => { calls.push('start'); },
        },
        createService: () => { throw new Error('Existing SCM services must not be re-registered'); },
        report: () => {},
    });
    assert.deepEqual(calls, ['decrypt', 'query', 'stop', 'query', 'start', 'query']);
});

test('install flow waits for pairing before service setup and propagates nonzero exit visibly', async () => {
    const calls = [];
    const child = new EventEmitter();
    const pending = install({
        pair: async () => { calls.push('paired-and-saved'); return true; },
        installDir: path.resolve('connector-test-install'),
        spawnProcess: (_exe, args, options) => {
            calls.push('spawn');
            assert.equal(args[1], path.resolve('connector-test-install'));
            assert.equal(options.stdio, 'inherit');
            return child;
        },
        reportError: (message) => calls.push(message),
    });
    await new Promise((resolve) => setImmediate(resolve));
    child.emit('close', 7);
    assert.equal(await pending, false);
    assert.deepEqual(calls.slice(0, 2), ['paired-and-saved', 'spawn']);
    assert.match(calls[2], /exit code 7.*not confirmed/);
});

test('new-service setup registers node-windows with the correct display name and bundled runtime', async () => {
    const installDir = path.resolve('new-connector-install');
    const states = [null, STATE.STOPPED, STATE.RUNNING];
    let registration;
    await installService({
        installDir,
        env: { ProgramData: path.resolve('test-program-data') },
        readConfig: (file) => {
            assert.equal(file, path.join(path.resolve('test-program-data'), 'OnlineSCADA', 'Factory Connector', 'config.json'));
            return { cloudUrl: 'https://example.test', gatewayId: 'id', apiKeyProtected: 'encrypted' };
        },
        loadSecret: () => 'private',
        scm: { query: async () => states.shift(), start: async () => {} },
        createService: (options) => {
            registration = options;
            const service = new EventEmitter();
            service.install = () => service.emit('install');
            return service;
        },
        report: () => {},
    });
    assert.equal(registration.name, 'OnlineSCADAFactoryConnector');
    assert.equal(registration.name.toLowerCase() + '.exe', SERVICE_NAME);
    assert.equal(registration.script, path.join(installDir, 'src', 'service-entry.js'));
    assert.equal(registration.execPath, path.join(installDir, 'runtime', 'node.exe'));
    assert.equal(registration.workingDirectory, installDir);
});

test('install flow does not start service on failed pairing, and handles spawn failure and success', async () => {
    let spawned = false;
    assert.equal(await install({ pair: async () => false, spawnProcess: () => { spawned = true; }, reportError: () => {} }), false);
    assert.equal(spawned, false);
    for (const outcome of ['error', 'zero', 'signal', 'throw']) {
        const errors = [];
        const pending = install({
            pair: async () => true,
            spawnProcess: () => {
                if (outcome === 'throw') throw new Error('private detail');
                const child = new EventEmitter();
                setImmediate(() => {
                    if (outcome === 'error') child.emit('error', new Error('private detail'));
                    child.emit('close', outcome === 'zero' ? 0 : null);
                });
                return child;
            },
            reportError: (message) => errors.push(message),
        });
        assert.equal(await pending, outcome === 'zero');
        assert.equal(errors.length, outcome === 'zero' ? 0 : 1);
        assert.ok(errors.every((message) => !message.includes('private detail')));
    }
});

test('install flow reuses existing valid configuration when allowed and skips pairing', async () => {
    const calls = [];
    const child = new EventEmitter();
    const pending = install({
        allowExistingConfig: true,
        hasExistingConfig: () => { calls.push('checked-config'); return true; },
        pair: async () => { calls.push('paired'); return true; },
        installDir: path.resolve('existing-install'),
        spawnProcess: (_exe, args) => {
            calls.push('spawn');
            assert.equal(args[1], path.resolve('existing-install'));
            return child;
        },
        reportInfo: (msg) => calls.push(msg),
    });
    await new Promise((resolve) => setImmediate(resolve));
    child.emit('close', 0);
    assert.equal(await pending, true);
    assert.deepEqual(calls.slice(0, 3), ['checked-config', '[+] Existing valid Factory Connector configuration found. Preserving authorization.', 'spawn']);
    assert.ok(!calls.includes('paired'));
});

test('install flow falls back to pairing when existing config is invalid or missing', async () => {
    const calls = [];
    const child = new EventEmitter();
    const pending = install({
        allowExistingConfig: true,
        hasExistingConfig: () => { calls.push('checked-config'); return false; },
        pair: async () => { calls.push('paired'); return true; },
        installDir: path.resolve('fresh-install'),
        spawnProcess: () => {
            calls.push('spawn');
            return child;
        },
    });
    await new Promise((resolve) => setImmediate(resolve));
    child.emit('close', 0);
    assert.equal(await pending, true);
    assert.deepEqual(calls, ['checked-config', 'paired', 'spawn']);
});
