'use strict';
const fs = require('fs');
const { spawnSync } = require('child_process');
function dpapi(mode, value) {
    if (process.platform !== 'win32') throw new Error('Windows DPAPI is required for connector secrets');
    const script = mode === 'protect' ? "$b=[Convert]::FromBase64String([Console]::In.ReadToEnd());Add-Type -AssemblyName System.Security;[Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Protect($b,$null,[System.Security.Cryptography.DataProtectionScope]::LocalMachine))" : "$b=[Convert]::FromBase64String([Console]::In.ReadToEnd());Add-Type -AssemblyName System.Security;[Text.Encoding]::UTF8.GetString([System.Security.Cryptography.ProtectedData]::Unprotect($b,$null,[System.Security.Cryptography.DataProtectionScope]::LocalMachine))";
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { input: mode === 'protect' ? Buffer.from(value, 'utf8').toString('base64') : value, encoding: 'utf8', windowsHide: true });
    if (result.status !== 0 || !result.stdout.trim()) throw new Error(`Windows DPAPI failed: ${(result.stderr || '').trim()}`);
    return result.stdout.trim();
}
function loadSecret(config, paths) {
    if (config.apiKeyProtected) return dpapi('unprotect', config.apiKeyProtected);
    if (!config.apiKey) throw new Error('Connector API credential is missing');
    const migrated = { ...config, apiKeyProtected: dpapi('protect', config.apiKey) }; delete migrated.apiKey;
    fs.writeFileSync(paths.configPath, `${JSON.stringify(migrated, null, 2)}\n`, { mode: 0o600 });
    return config.apiKey;
}
function saveSecret(config, paths, apiKey) {
    const protectedConfig = { ...config, apiKeyProtected: dpapi('protect', apiKey) }; delete protectedConfig.apiKey;
    fs.writeFileSync(paths.configPath, `${JSON.stringify(protectedConfig, null, 2)}\n`, { mode: 0o600 });
}
module.exports = { loadSecret, saveSecret };
