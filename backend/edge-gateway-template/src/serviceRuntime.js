'use strict';

const fs = require('fs');
const path = require('path');

function getDataDir() {
    if (process.env.ONLINESCADA_DATA_DIR) return process.env.ONLINESCADA_DATA_DIR;
    if (process.platform === 'win32' && process.env.ProgramData) return path.join(process.env.ProgramData, 'OnlineSCADA', 'Factory Connector');
    return path.join(__dirname, '..');
}
function getPaths() {
    const dataDir = getDataDir();
    return { dataDir, configPath: process.env.ONLINESCADA_CONFIG_PATH || path.join(dataDir, 'config.json'), logDir: path.join(dataDir, 'logs'), lockPath: path.join(dataDir, 'connector.lock') };
}
function ensureRuntimeFolders(paths) { fs.mkdirSync(paths.dataDir, { recursive: true }); fs.mkdirSync(paths.logDir, { recursive: true }); }
function acquireSingleInstance(paths) {
    try { const handle = fs.openSync(paths.lockPath, 'wx'); fs.writeFileSync(handle, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); fs.closeSync(handle); }
    catch (error) { if (error.code === 'EEXIST') throw new Error('Another OnlineSCADA Factory Connector instance is already running.'); throw error; }
    let released = false;
    return () => { if (released) return; released = true; try { fs.unlinkSync(paths.lockPath); } catch (_) { } };
}
function loadConfig(paths) { const fallbackPath = path.join(__dirname, '..', 'config.json'); const configPath = fs.existsSync(paths.configPath) ? paths.configPath : fallbackPath; if (!fs.existsSync(configPath)) throw new Error(`Connector configuration was not found: ${paths.configPath}`); return JSON.parse(fs.readFileSync(configPath, 'utf8')); }
function installShutdownHandlers({ release, stop }) {
    let shuttingDown = false;
    const shutdown = async (signal) => { if (shuttingDown) return; shuttingDown = true; try { await stop(); } finally { release(); process.exit(signal === 'uncaughtException' ? 1 : 0); } };
    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('uncaughtException', (error) => { console.error(`[x] Connector stopped because of an unexpected error: ${error.message}`); shutdown('uncaughtException'); });
    process.once('unhandledRejection', (error) => { console.error(`[x] Connector stopped because of an unexpected promise error: ${error?.message || error}`); shutdown('unhandledRejection'); });
}
module.exports = { getPaths, ensureRuntimeFolders, acquireSingleInstance, loadConfig, installShutdownHandlers };
