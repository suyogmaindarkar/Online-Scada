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

    // Attempt to route the command to the /edge namespace room for this company
    // This supports standard Express architectures where IO is bound globally
    let edgeNamespace = null;
    if (global.edgeIo) {
        edgeNamespace = global.edgeIo;
    } else if (global.io) {
        edgeNamespace = global.io.of('/edge');
    }

    if (edgeNamespace) {
        edgeNamespace.to(`company:${companyId}`).emit('edge:startDiscovery', options);
    } else {
        console.warn('[WARNING] Socket.io namespace not found globally. Discovery command dropped.');
    }
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