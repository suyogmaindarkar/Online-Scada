const DeviceAuthorizationSession = require('../models/DeviceAuthorizationSession');
const EdgeGateway = require('../models/EdgeGateway');

const TTL_MS = 10 * 60 * 1000;
const RESULT_TTL_MS = 60 * 60 * 1000;
const cleanDeviceValue = (value, fallback, maxLength) => String(value || fallback).replace(/[\r\n\t]/g, ' ').trim().slice(0, maxLength);
const statusFor = (session) => {
  if (!session) return 'expired';
  if (session.status === 'pending' && session.isExpired()) return 'expired';
  return session.status;
};

const createDeviceAuthorization = async (req, res) => {
  const credentials = DeviceAuthorizationSession.generatePollingCredentials();
  const userCode = DeviceAuthorizationSession.generateUserCode();
  const session = await DeviceAuthorizationSession.create({ companyId: req.companyId, userCode, ...credentials, expiresAt: new Date(Date.now() + TTL_MS), deviceHostname: cleanDeviceValue(req.body?.hostname, 'Factory computer', 128), devicePlatform: cleanDeviceValue(req.body?.os, 'Windows', 64) });
  const base = (process.env.FRONTEND_URL || process.env.APP_URL || '').replace(/\/+$/, '');
  res.status(201).json({ success: true, data: { verificationUrl: `${base}/connector/authorize?user_code=${encodeURIComponent(userCode)}`, userCode, pollingId: session.pollingId, pollingSecret: credentials.pollingSecret, expiresAt: session.expiresAt } });
};

const startDeviceAuthorization = async (req, res) => {
  const credentials = DeviceAuthorizationSession.generatePollingCredentials();
  const userCode = DeviceAuthorizationSession.generateUserCode();
  const session = await DeviceAuthorizationSession.create({ userCode, ...credentials, expiresAt: new Date(Date.now() + TTL_MS), deviceHostname: cleanDeviceValue(req.body?.hostname, 'Factory computer', 128), devicePlatform: cleanDeviceValue(req.body?.os, 'Windows', 64) });
  const base = (process.env.FRONTEND_URL || process.env.APP_URL || '').replace(/\/+$/, '');
  res.status(201).json({ success: true, data: { verificationUrl: `${base}/connector/authorize?user_code=${encodeURIComponent(userCode)}`, userCode, pollingId: session.pollingId, pollingSecret: credentials.pollingSecret, expiresAt: session.expiresAt } });
};

const approveDeviceAuthorization = async (req, res) => {
  const userCode = String(req.body?.userCode || req.body?.user_code || '').trim().toUpperCase();
  if (!userCode) return res.status(400).json({ success: false, message: 'User code is required' });
  const session = await DeviceAuthorizationSession.findOne({ userCode });
  if (!session || session.isExpired()) return res.status(410).json({ success: false, code: 'EXPIRED', message: 'Authorization code has expired' });
  if (session.status !== 'pending') return res.status(409).json({ success: false, code: 'ALREADY_APPROVED', message: 'Authorization has already been approved or consumed' });
  const approved = await DeviceAuthorizationSession.findOneAndUpdate({ _id: session._id, status: 'pending', expiresAt: { $gt: new Date() } }, { $set: { status: 'approved', companyId: req.companyId, approvedBy: req.user._id, approvedAt: new Date() } }, { new: true });
  if (!approved) return res.status(409).json({ success: false, code: 'ALREADY_APPROVED', message: 'Authorization has already been approved or consumed' });
  res.json({ success: true, data: { status: 'approved' } });
};

const getDeviceAuthorizationDetails = async (req, res) => {
  const userCode = String(req.query?.userCode || '').trim().toUpperCase();
  if (!userCode) return res.status(400).json({ success: false, message: 'User code is required' });
  const session = await DeviceAuthorizationSession.findOne({ userCode });
  if (!session || session.isExpired()) return res.status(410).json({ success: false, code: 'EXPIRED', message: 'Authorization code has expired' });
  res.json({ success: true, data: { status: statusFor(session), expiresAt: session.expiresAt, deviceHostname: session.deviceHostname || 'Factory computer', devicePlatform: session.devicePlatform || 'Windows' } });
};

const pollDeviceAuthorization = async (req, res) => {
  const { pollingId, pollingSecret } = req.body || {};
  if (!pollingId || !pollingSecret) return res.status(400).json({ success: false, message: 'Polling credentials are required' });
  const session = await DeviceAuthorizationSession.findOne({ pollingId }).select('+pollingSecretHash +encryptedApiKey');
  if (!session || !DeviceAuthorizationSession.constantTimeSecretMatch(pollingSecret, session.pollingSecretHash)) return res.status(401).json({ success: false, code: 'INVALID_POLLING_CREDENTIALS', message: 'Invalid polling credentials' });
  if (session.status === 'pending' && session.isExpired()) { await DeviceAuthorizationSession.updateOne({ _id: session._id, status: 'pending' }, { $set: { status: 'expired' } }); return res.json({ success: true, data: { status: 'expired' } }); }
  if (session.status === 'pending' || session.status === 'expired') return res.json({ success: true, data: { status: session.status } });
  if (session.status === 'consumed') {
    if (!session.encryptedApiKey || !session.resultExpiresAt || new Date(session.resultExpiresAt).getTime() <= Date.now()) return res.json({ success: true, data: { status: 'consumed' } });
    const apiKey = DeviceAuthorizationSession.decryptApiKey(session.encryptedApiKey);
    return res.json({ success: true, data: { status: 'consumed', gatewayId: session.gatewayId, companyId: String(session.companyId), apiKey, apiKeyPrefix: apiKey.slice(0, 11), cloudUrl: (process.env.BACKEND_URL || '').replace(/\/+$/, '') || null, namespace: '/edge' } });
  }
  const claimed = await DeviceAuthorizationSession.findOneAndUpdate({ _id: session._id, status: 'approved' }, { $set: { status: 'consumed', consumedAt: new Date() } }, { new: true });
  if (!claimed) return res.json({ success: true, data: { status: 'consumed' } });
  const key = EdgeGateway.generateApiKey();
  const gateway = await EdgeGateway.create({ companyId: claimed.companyId, name: `Factory Connector ${claimed.userCode}`, apiKeyHash: key.hash, apiKeyPrefix: key.prefix, status: 'never_connected', hostname: claimed.deviceHostname, os: claimed.devicePlatform });
  await DeviceAuthorizationSession.updateOne({ _id: claimed._id, companyId: claimed.companyId }, { $set: { gatewayId: gateway._id, encryptedApiKey: DeviceAuthorizationSession.encryptApiKey(key.rawKey), resultExpiresAt: new Date(Date.now() + RESULT_TTL_MS) } });
  res.json({ success: true, data: { status: 'consumed', gatewayId: gateway._id, companyId: String(claimed.companyId), apiKey: key.rawKey, apiKeyPrefix: key.prefix, cloudUrl: (process.env.BACKEND_URL || '').replace(/\/+$/, '') || null, namespace: '/edge' } });
};

module.exports = { createDeviceAuthorization, startDeviceAuthorization, approveDeviceAuthorization, getDeviceAuthorizationDetails, pollDeviceAuthorization, statusFor };
