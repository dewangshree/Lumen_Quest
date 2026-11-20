const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const adminOnly = authorizeRoles('admin');

// Authenticated user routes
router.get('/me', authenticateToken, userController.getMyProfile);
router.put('/me', authenticateToken, userController.updateMyProfile);
router.delete('/me', authenticateToken, userController.deleteMyAccount);

// Admin-only routes
router.get('/', authenticateToken, adminOnly, userController.getAllUsers);
router.get('/:id', authenticateToken, adminOnly, userController.getUserById);

module.exports = router;
