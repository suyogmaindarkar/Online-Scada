// ═══════════════════════════════════════════════════════════
// Alarm Routes
//
// Task Bundle applied:
//   ✅ T021  — GET /alarms/export for CSV download
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
const { protect, authorize } = require('../middleware/auth');

// All routes need login
router.use(protect);

// Create alarm (admin/engineer only)
router.post('/', authorize('admin', 'engineer'), createAlarm);

// Get all alarms
router.get('/', getAllAlarms);

// Get active alarms only
router.get('/active', getActiveAlarms);

// Get alarm history
router.get('/history', getAlarmHistory);

// ✅ T021: Export alarms as CSV
router.get('/export', exportAlarmsCSV);

// Acknowledge ALL alarms at once
router.post('/acknowledge-all', acknowledgeAllAlarms);

// Get single alarm by ID
router.get('/:id', getAlarm);

// Acknowledge single alarm
router.post('/:id/acknowledge', acknowledgeAlarm);

// Update alarm (admin/engineer only)
router.put('/:id', authorize('admin', 'engineer'), updateAlarm);

// Delete alarm (admin/engineer only)
router.delete('/:id', authorize('admin', 'engineer'), deleteAlarm);

module.exports = router;