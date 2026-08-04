const express = require('express');
const router = express.Router();
const {
  createScreen,
  getAllScreens,
  getScreen,
  updateScreen,
  deleteScreen,
} = require('../controllers/screenController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.post('/', authorize('admin', 'engineer'), createScreen);
router.get('/', getAllScreens);
router.get('/:id', getScreen);
router.put('/:id', authorize('admin', 'engineer'), updateScreen);
router.delete('/:id', authorize('admin', 'engineer'), deleteScreen);

module.exports = router;