import test from 'node:test';
import assert from 'node:assert/strict';
import { isEquipmentEnabled, mergeEquipmentStatus, selectConnector, isTerminalScan, isKnownScanPhase, matchesCommand } from '../src/utils/equipmentState.mjs';

test('unreachable enabled equipment still offers Stop, disabled equipment offers Start', () => {
  assert.equal(isEquipmentEnabled({ isActive: true, isConnected: false }), true);
  assert.equal(isEquipmentEnabled({ isActive: false, isConnected: true }), false);
});

test('HTTP disabled/offline states and expired socket reports cannot be masked', () => {
  const live = { state: 'streaming', isConnected: true, receivedAt: 1000 };
  assert.equal(mergeEquipmentStatus({ isActive: false }, live, 1001).connectionState, 'stopped');
  assert.equal(mergeEquipmentStatus({ connectionState: 'connector_offline' }, live, 1001).connectionState, 'connector_offline');
  assert.equal(mergeEquipmentStatus({ connectionState: 'failed' }, live, 14000).connectionState, 'failed');
  assert.equal(mergeEquipmentStatus({ connectionState: 'pending' }, live, 1001).connectionState, 'streaming');
});

test('connector overview selects an online connector even if a newer offline profile exists', () => {
  assert.equal(selectConnector([{ _id: 'new', status: 'offline' }, { _id: 'live', status: 'online' }])._id, 'live');
});

test('all terminal discovery states stop polling', () => {
  for (const phase of ['done', 'failed', 'cancelled']) assert.equal(isTerminalScan(phase), true);
  assert.equal(isTerminalScan('probing'), false);
  for (const phase of ['queued', 'pinging', 'probing', 'done', 'failed', 'cancelled']) assert.equal(isKnownScanPhase(phase), true);
});

test('command acknowledgements must match equipment, action and assigned request', () => {
  const pending = { equipmentId: 'a', action: 'stop', requestId: 'one' };
  assert.equal(matchesCommand(pending, { ...pending }), true);
  assert.equal(matchesCommand(pending, { ...pending, requestId: 'two' }), false);
  assert.equal(matchesCommand(pending, { ...pending, equipmentId: 'b' }), false);
  assert.equal(matchesCommand({ ...pending, requestId: null }, { equipmentId: 'a', action: 'stop' }), false);
});
