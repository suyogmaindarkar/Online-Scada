const activeScans = new Map();

exports.initiateScan = async (companyId, options) => {
    // Reset or initialize scan state for this workspace
    activeScans.set(companyId.toString(), {
        phase: 'pinging',
        scannedIPs: 0,
        aliveHosts: 0,
        devices: [],
        startTime: Date.now()
    });
};

exports.getStatus = (companyId) => {
    return activeScans.get(companyId.toString()) || { phase: 'idle' };
};

exports.updateStatus = (companyId, data) => {
    const current = activeScans.get(companyId.toString()) || {};
    activeScans.set(companyId.toString(), { 
        ...current, 
        ...data.results, 
        phase: data.phase 
    });
};