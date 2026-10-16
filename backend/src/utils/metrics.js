const metrics = {
  requests: { total: 0, errors: 0, durationMs: 0 },
  edge: {
    tagBatchesReceived: 0,
    tagsReceived: 0,
    broadcasts: 0,
    pendingMongoQueueSize: 0,
    flushes: 0,
    flushFailures: 0,
    flushDurationMs: 0,
    heartbeatOnline: 0,
    heartbeatOffline: 0,
  },
};

const increment = (name, amount = 1) => { metrics.edge[name] += amount; };

const snapshot = () => ({
  requests: { ...metrics.requests },
  edge: { ...metrics.edge },
});

module.exports = {
  metrics,
  increment,
  snapshot,
  recordRequest(durationMs, statusCode) {
    metrics.requests.total += 1;
    metrics.requests.durationMs += Math.max(0, durationMs);
    if (statusCode >= 400) metrics.requests.errors += 1;
  },
  setPendingMongoQueueSize(size) { metrics.edge.pendingMongoQueueSize = Math.max(0, size); },
};
