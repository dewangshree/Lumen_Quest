const express = require('express');
const router = express.Router();
const planController = require('../controllers/planController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const adminOnly = [authenticateToken, authorizeRoles('admin')];

router.get('/', planController.getAllPlans);                        // Public
router.get('/:id', planController.getPlanById);                     // Public
router.post('/', adminOnly, planController.createPlan);             // Admin only
router.put('/:id', adminOnly, planController.updatePlan);           // Admin only
router.delete('/:id', adminOnly, planController.deletePlan);        // Admin only

module.exports = router;
