// ═══════════════════════════════════════════════════════════
// Alarm Routes — Multi-Tenant Update
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const {
  createAlarm,
  getAllAlarms,
  getActiveAlarms,
  getAlarmHistory,
  acknowledgeAlarm,
  acknowledgeAllAlarms,
  updateAlarm,
  deleteAlarm,
  getAlarm,
  exportAlarmsCSV,
} = require('../controllers/alarmController');
const { userProtect, authorize } = require('../middleware/auth');

// ✅ All routes require valid user token (injects req.companyId)
router.use(userProtect);

// Create alarm (admin/engineer only)
router.post('/', authorize('admin', 'engineer'), createAlarm);

// Get all alarms (any role can view)
router.get('/', getAllAlarms);

// Get active alarms only (any role)
router.get('/active', getActiveAlarms);

// Get alarm history (any role)
router.get('/history', getAlarmHistory);

// Export alarms as CSV (admin/engineer)
router.get('/export', authorize('admin', 'engineer'), exportAlarmsCSV);

// ✅ Acknowledge — operators CAN acknowledge, viewers CANNOT
router.post('/acknowledge-all', authorize('admin', 'engineer', 'operator'), acknowledgeAllAlarms);
router.post('/:id/acknowledge', authorize('admin', 'engineer', 'operator'), acknowledgeAlarm);

// Get single alarm by ID
router.get('/:id', getAlarm);

// Update alarm (admin/engineer only)
router.put('/:id', authorize('admin', 'engineer'), updateAlarm);

// Delete alarm (admin/engineer only)
router.delete('/:id', authorize('admin', 'engineer'), deleteAlarm);

module.exports = router;