'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const secretStore = require('./secretStore');
const os = require('os');

const code = String(process.env.ONLINESCADA_PAIRING_CODE || process.argv[2] || '').trim();
const cloudUrl = String(process.env.ONLINESCADA_CLOUD_URL || 'https://onlinescada-api.onrender.com').replace(/\/+$/, '');
const dataDir = process.env.ONLINESCADA_DATA_DIR || path.join(process.env.ProgramData || path.join(__dirname, '..'), 'OnlineSCADA', 'Factory Connector');

if (!code) { console.error('[x] Pairing code is required.'); process.exit(2); }
const body = JSON.stringify({ code, os: process.platform, hostname: os.hostname() });
const url = new URL(`${cloudUrl}/api/edge-pairing/redeem`);
const request = https.request({ hostname: url.hostname, port: url.port || 443, path: `${url.pathname}${url.search}`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (response) => {
    let raw = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => { raw += chunk; });
    response.on('end', () => {
        let result; try { result = JSON.parse(raw); } catch (_) { result = null; }
        if (response.statusCode < 200 || response.statusCode >= 300 || !result?.success || !result.data?.apiKey) { console.error(`[x] Pairing failed: ${result?.message || `HTTP ${response.statusCode}`}`); process.exit(1); }
        fs.mkdirSync(dataDir, { recursive: true });
        const configPath = path.join(dataDir, 'config.json');
        secretStore.saveSecret({ cloudUrl: result.data.cloudUrl || cloudUrl, namespace: result.data.namespace || '/edge', companyId: result.data.companyId, gatewayId: String(result.data.gatewayId), plcs: [] }, { configPath }, result.data.apiKey);
        console.log(`[+] Factory Connector paired. Configuration saved to ${configPath}`);
    });
});
request.on('error', (error) => { console.error(`[x] Pairing request failed: ${error.message}`); process.exit(1); });
request.write(body); request.end();
