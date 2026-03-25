const express = require('express');
const router = express.Router();
const performanceController = require('../controllers/performanceController');
const { authMiddleware } = require('../middleware/auth');

router.get('/stats', authMiddleware, performanceController.getPerformanceStats);

module.exports = router;
