const repo = require('../database/repo');
const handle = require('../utils/handle');

// GET /api/subscriptions/me
exports.getMine = handle(async (req, res) => {
  res.json(await repo.getSubscriptionsForUser(req.user.id));
});

// POST /api/subscriptions  { plan_id, payment_method? }
exports.subscribe = handle(async (req, res) => {
  const { plan_id, payment_method } = req.body || {};
  if (!plan_id) return res.status(400).json({ message: 'plan_id is required' });
  const allowed = ['credit_card', 'debit_card', 'upi', 'cash'];
  const method = allowed.includes(payment_method) ? payment_method : 'credit_card';
  const result = await repo.subscribe(req.user.id, plan_id, { paymentMethod: method });
  res.status(201).json({ message: 'Subscribed successfully', ...result });
});

// POST /api/subscriptions/:id/cancel
exports.cancel = handle(async (req, res) => {
  const ok = await repo.cancelSubscription(req.user.id, req.params.id);
  if (!ok) return res.status(404).json({ message: 'Active subscription not found' });
  res.json({ message: 'Subscription cancelled' });
});
