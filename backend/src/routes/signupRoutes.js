// ═══════════════════════════════════════════════════════════
// Signup Routes — Public Self-Service Signup
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router  = express.Router();
const { manualSignup, googleSignup } = require('../controllers/signupController');

// Public endpoints
router.post('/manual', manualSignup);
router.post('/google', googleSignup);

module.exports = router;