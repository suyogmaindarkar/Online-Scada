'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const EdgeService = require('../src/services/edgeService');
const Tag = require('../src/models/Tag');
const metrics = require('../src/utils/metrics');

test('synthetic 1/10/50 equipment tag batches update edge metrics and flush in batches', async () => {
    const edge = EdgeService;
    edge.tagCache.clear();
    edge.pendingDbWrites.clear();
    const emitted = [];
    edge.mainIo = { to: () => ({ emit: (event, data) => emitted.push({ event, data }) }) };
    const originalBulkWrite = Tag.bulkWrite;
    let bulkWriteCalls = 0;
    Tag.bulkWrite = async (operations) => { bulkWriteCalls += 1; assert.ok(operations.length <= 500); };

    const before = metrics.snapshot();
    try {
        for (const equipmentCount of [1, 10, 50]) {
            for (let equipment = 0; equipment < equipmentCount; equipment += 1) {
                const tags = Array.from({ length: 10 }, (_, tagIndex) => ({
                    tagId: `load-${equipmentCount}-${equipment}-${tagIndex}`,
                    tagName: `equipment-${equipment}-tag-${tagIndex}`,
                    value: tagIndex,
                    quality: 'GOOD',
                    timestamp: Date.now(),
                }));
                edge._handleTagValues({ companyId: `load-company-${equipmentCount}` }, { tags });
            }
        }
        await edge._flushToDatabase();
    } finally {
        Tag.bulkWrite = originalBulkWrite;
    }

    const after = metrics.snapshot();
    assert.equal(after.edge.tagBatchesReceived - before.edge.tagBatchesReceived, 61);
    assert.equal(after.edge.tagsReceived - before.edge.tagsReceived, 610);
    assert.equal(after.edge.broadcasts - before.edge.broadcasts, 61);
    assert.equal(after.edge.flushes - before.edge.flushes, 1);
    assert.equal(after.edge.pendingMongoQueueSize, 0);
    assert.equal(bulkWriteCalls, 2);
    assert.equal(emitted.length, 61);
});
