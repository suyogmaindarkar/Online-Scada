'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateTagConfiguration } = require('../src/controllers/tagController');

const plc = { protocol: 'OPC_UA' };

test('OPC UA validation rejects malformed symbolic addresses and accepts NodeId forms', () => {
    const malformed = validateTagConfiguration({ dataType: 'BOOL', accessType: 'READ', plcAddress: 'ns=3;s="SCADA_ANIMATION"_DB"; FB' }, plc);
    assert.ok(malformed.errors.some((error) => error.includes('not valid for OPC_UA')));

    for (const plcAddress of ['ns=3;s=SCADA_ANIMATION_DB.FB_SIMULATION', 'ns=3;s="SCADA_ANIMATION_DB".FB_SIMULATION', 'ns=3;i=2258']) {
        const result = validateTagConfiguration({ dataType: 'BOOL', accessType: 'READ', plcAddress }, plc);
        assert.deepEqual(result.errors, []);
    }
});
