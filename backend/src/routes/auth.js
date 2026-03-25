const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// All auth routes
router.post('/login', authController.login);
router.post('/google', authController.googleLogin);
router.post('/register', authController.register); // Optional/Superadmin only logic
// router.get('/me', authMiddleware, authController.getMe);

module.exports = router;

