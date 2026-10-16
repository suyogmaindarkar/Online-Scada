const test = require('node:test');
const assert = require('node:assert/strict');

test('metrics snapshot has stable request and edge fields', () => {
  const metrics = require('../src/utils/metrics');
  metrics.recordRequest(12, 200);
  metrics.recordRequest(8, 500);
  metrics.increment('tagsReceived', 3);
  const snapshot = metrics.snapshot();
  assert.equal(snapshot.requests.errors >= 1, true);
  assert.equal(typeof snapshot.requests.durationMs, 'number');
  assert.equal(snapshot.edge.tagsReceived >= 3, true);
  assert.equal(typeof snapshot.edge.pendingMongoQueueSize, 'number');
});

test('structured logger writes parseable JSON', () => {
  const logger = require('../src/utils/logger');
  const originalWrite = process.stdout.write;
  let output = '';
  process.stdout.write = (value) => { output += value; return true; };
  try { logger.info('test.event', { requestId: 'test-request' }); } finally { process.stdout.write = originalWrite; }
  const entry = JSON.parse(output);
  assert.equal(entry.level, 'info');
  assert.equal(entry.message, 'test.event');
  assert.equal(entry.requestId, 'test-request');
});
