export const isEquipmentEnabled = (equipment) => equipment.isActive !== false;

export function mergeEquipmentStatus(equipment, live, now = Date.now()) {
  if (!isEquipmentEnabled(equipment)) {
    return { ...equipment, isConnected: false, connectionState: 'stopped', connectionMessage: 'Connection is disabled' };
  }
  if (!live || now - live.receivedAt > 12000 || equipment.connectionState === 'connector_offline') return equipment;
  return { ...equipment, isConnected: live.isConnected, connectionState: live.state, connectionMessage: live.message, lastDataAt: live.lastDataAt };
}

export function selectConnector(gateways) {
  return gateways.find((gateway) => gateway.status === 'online') || gateways[0] || null;
}

export const isTerminalScan = (phase) => ['done', 'failed', 'cancelled'].includes(phase);
export const isKnownScanPhase = (phase) => ['queued', 'pinging', 'probing', 'done', 'failed', 'cancelled'].includes(phase);

export function matchesCommand(pending, result) {
  return Boolean(pending && result && pending.requestId && pending.equipmentId === result.equipmentId && pending.action === result.action && pending.requestId === result.requestId);
}
