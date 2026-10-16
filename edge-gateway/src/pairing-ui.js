'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const secretStore = require('./secretStore');

const cloudUrl = String(process.env.ONLINESCADA_CLOUD_URL || 'https://onlinescada-api.onrender.com').replace(/\/+$/, '');
const dataDir = process.env.ONLINESCADA_DATA_DIR || path.join(process.env.ProgramData || path.join(__dirname, '..'), 'OnlineSCADA', 'Factory Connector');

async function requestJson(endpoint, body) {
    const response = await fetch(`${cloudUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    let result = null;
    try { result = await response.json(); } catch (_) { }
    return { statusCode: response.status, result };
}

async function startAuthorization() {
    const response = await requestJson('/api/device-authorization/start', { os: process.platform, hostname: os.hostname() });
    if (response.statusCode < 200 || response.statusCode >= 300 || !response.result?.success) {
        throw new Error(response.result?.message || `Authorization session could not start (HTTP ${response.statusCode})`);
    }
    return response.result.data;
}

async function pollAuthorization(session) {
    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
        const response = await requestJson('/api/device-authorization/poll', { pollingId: session.pollingId, pollingSecret: session.pollingSecret });
        if (response.statusCode === 401) throw new Error('Connector authorization session is invalid. Restart the installer.');
        if (response.result?.success && response.result.data?.status === 'consumed' && response.result.data.apiKey) return response.result.data;
        if (response.result?.data?.status === 'expired') throw new Error('Connector authorization expired. Restart the installer.');
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error('Connector authorization timed out after 10 minutes.');
}

async function run() {
    try {
        console.log('[i] Opening OnlineSCADA sign-in page...');
        const session = await startAuthorization();
        await new Promise((resolve, reject) => {
            execFile('rundll32.exe', ['url.dll,FileProtocolHandler', session.verificationUrl], { windowsHide: true }, (error) => error ? reject(new Error('Could not open the OnlineSCADA browser approval page')) : resolve());
        });
        console.log('[i] Sign in to OnlineSCADA in your browser and approve this connector.');
        const data = await pollAuthorization(session);
        fs.mkdirSync(dataDir, { recursive: true });
        const configPath = path.join(dataDir, 'config.json');
        secretStore.saveSecret({ cloudUrl: data.cloudUrl || cloudUrl, namespace: data.namespace || '/edge', companyId: data.companyId, gatewayId: String(data.gatewayId), plcs: data.plcs || [] }, { configPath }, data.apiKey);
        console.log('[+] Factory Connector authorized and protected configuration saved.');
        return true;
    } catch (error) {
        console.error(`[x] ${error.message}`);
        return false;
    }
}

if (require.main === module) run().then((success) => { if (!success) process.exitCode = 1; });
module.exports = { startAuthorization, pollAuthorization, run };
