const mongoose = require('mongoose');
const crypto = require('crypto');

const schema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  userCode: { type: String, required: true, index: true },
  pollingId: { type: String, required: true, unique: true, index: true },
  pollingSecretHash: { type: String, required: true, select: false },
  status: { type: String, enum: ['pending', 'approved', 'consumed', 'expired'], default: 'pending', index: true },
  deviceHostname: { type: String, default: '', maxlength: 128 },
  devicePlatform: { type: String, default: '', maxlength: 64 },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  consumedAt: { type: Date, default: null },
  gatewayId: { type: mongoose.Schema.Types.ObjectId, ref: 'EdgeGateway', default: null },
  encryptedApiKey: { type: String, default: null, select: false },
  resultExpiresAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true });

schema.methods.isExpired = function (now = Date.now()) { return new Date(this.expiresAt).getTime() <= now; };
schema.statics.generateUserCode = function () {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[crypto.randomInt(chars.length)]).join('').replace(/(.{4})/, '$1-');
};
schema.statics.generatePollingCredentials = function () {
  const secret = crypto.randomBytes(32).toString('base64url');
  return { pollingId: crypto.randomUUID(), pollingSecret: secret, pollingSecretHash: this.hashSecret(secret) };
};
schema.statics.hashSecret = (secret) => crypto.createHash('sha256').update(String(secret)).digest('hex');
schema.statics.constantTimeSecretMatch = (secret, hash) => {
  const actual = Buffer.from(schema.statics.hashSecret(secret), 'hex');
  const expected = Buffer.from(String(hash), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};
schema.statics.encryptApiKey = function (apiKey) {
  const key = crypto.createHash('sha256').update(String(process.env.JWT_SECRET || '')).digest();
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required to encrypt device credentials');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(apiKey), 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
};
schema.statics.decryptApiKey = function (encrypted) {
  const [ivText, tagText, ciphertextText] = String(encrypted || '').split('.');
  if (!ivText || !tagText || !ciphertextText || !process.env.JWT_SECRET) throw new Error('Encrypted device credential is invalid');
  const key = crypto.createHash('sha256').update(String(process.env.JWT_SECRET)).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64url')), decipher.final()]).toString('utf8');
};

module.exports = mongoose.model('DeviceAuthorizationSession', schema);
