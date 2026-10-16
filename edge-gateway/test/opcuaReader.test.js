'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const OPCUAReader = require('../src/readers/opcuaReader');

test('OPC UA reader rejects malformed NodeIds without invalidating valid tags', async () => {
    const reader = new OPCUAReader({});
    reader.isConnected = true;
    reader.session = {
        read: async (nodes) => nodes.map((node) => ({
            value: { value: node.nodeId === 'ns=3;s=valid.boolean' ? true : null },
            statusCode: { isGood: () => node.nodeId === 'ns=3;s=valid.boolean' },
        })),
    };
    const results = await reader.readTags([
        { tagId: 'good', tagName: 'Good', address: 'ns=3;s=valid.boolean' },
        { tagId: 'bad', tagName: 'Bad', address: 'ns=3;s="SCADA_ANIMATION"_DB"; FB' },
    ]);
    assert.equal(results[0].value, true);
    assert.equal(results[0].quality, 'GOOD');
    assert.equal(results[1].value, null);
    assert.equal(results[1].quality, 'BAD');
    assert.equal(results[1].errorCode, 'INVALID_ADDRESS');
});
