const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { loginLimiter, registerLimiter } = require('../middleware/security');

// Auth routes
router.post('/register', registerLimiter, authController.register);           // Register new user
router.post('/login', loginLimiter, authController.login);
router.post('/google', registerLimiter, authController.google);       // Sign in with Google (customers)                 // Login
router.post('/logout', authController.logout);               // Logout
router.post('/refresh', authController.refreshToken);        // Refresh JWT token

module.exports = router;
