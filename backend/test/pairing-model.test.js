'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const PairingSession = require('../src/models/PairingSession');

test('pairing codes are formatted and hashed deterministically', () => {
    const code = PairingSession.generateCode();
    assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.equal(PairingSession.hashCode(code), PairingSession.hashCode(` ${code.toLowerCase()} `));
    assert.notEqual(PairingSession.hashCode(code), PairingSession.hashCode('AAAA-0000'));
});

test('pending pairing sessions are valid only before expiry', () => {
    const valid = new PairingSession({ status: 'pending', expiresAt: new Date(Date.now() + 60_000) });
    assert.equal(valid.isValid(), true);
    const expired = new PairingSession({ status: 'pending', expiresAt: new Date(Date.now() - 1) });
    assert.equal(expired.isValid(), false);
    const used = new PairingSession({ status: 'used', expiresAt: new Date(Date.now() + 60_000) });
    assert.equal(used.isValid(), false);
});
