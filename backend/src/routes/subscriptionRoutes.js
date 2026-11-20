const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/subscriptionController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);
router.get('/me', ctrl.getMine);
router.post('/', ctrl.subscribe);
router.post('/:id/cancel', ctrl.cancel);

module.exports = router;
