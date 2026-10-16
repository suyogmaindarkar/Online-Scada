const test = require('node:test');
const assert = require('node:assert/strict');
const Session = require('../src/models/DeviceAuthorizationSession');

test('device authorization credentials are distinct and secret hashes verify', () => {
  const c = Session.generatePollingCredentials();
  assert.notEqual(c.pollingId, c.pollingSecret);
  assert.equal(Session.constantTimeSecretMatch(c.pollingSecret, c.pollingSecretHash), true);
  assert.equal(Session.constantTimeSecretMatch('wrong', c.pollingSecretHash), false);
});

test('authorization lifecycle expiration helper', () => {
  const s = new Session({ expiresAt: new Date(Date.now() - 1), status: 'pending' });
  assert.equal(s.isExpired(), true);
  s.status = 'approved';
  assert.equal(s.isExpired(), true);
});

test('approved connector credentials can be recovered without storing plaintext', () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'device-authorization-test-secret';
  try {
    const encrypted = Session.encryptApiKey('eg_test_connector_key');
    assert.notEqual(encrypted, 'eg_test_connector_key');
    assert.equal(Session.decryptApiKey(encrypted), 'eg_test_connector_key');
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});
