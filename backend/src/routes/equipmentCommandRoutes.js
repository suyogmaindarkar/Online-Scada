const express = require('express');
const router = express.Router();
const {
  startEquipment,
  stopEquipment,
  restartEquipment,
  getConnectorStatus,
} = require('../controllers/equipmentCommandController');
const { userProtect, authorize } = require('../middleware/auth');

// All endpoints require a logged-in, company-scoped user
router.use(userProtect);

// Operator can start/stop equipment (noise: technicians), admin+ can do everything
router.post('/:id/start', authorize('admin', 'engineer', 'operator'), startEquipment);
router.post('/:id/stop', authorize('admin', 'engineer', 'operator'), stopEquipment);
router.post('/:id/restart', authorize('admin', 'engineer', 'operator'), restartEquipment);

// Connector overview — any authenticated user
router.get('/status', authorize('admin', 'engineer', 'operator', 'viewer'), getConnectorStatus);

module.exports = router;
