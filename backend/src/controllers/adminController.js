const bcrypt = require('bcryptjs');
const repo = require('../database/repo');
const handle = require('../utils/handle');

// GET /api/admin/stats
exports.stats = handle(async (req, res) => {
  res.json(await repo.getStats());
});

// GET /api/admin/customers
exports.customers = handle(async (req, res) => {
  res.json(await repo.getCustomers());
});

// POST /api/admin/customers  { name, email, phone?, plan_id? }
// Creates a customer with a temporary password and optionally subscribes them to a plan.
exports.createCustomer = handle(async (req, res) => {
  const { name, email, phone, plan_id } = req.body || {};
  if (!name || !email) return res.status(400).json({ message: 'name and email are required' });

  const tempPassword = Math.random().toString(36).slice(2, 10) + 'A1';
  const password_hash = await bcrypt.hash(tempPassword, 10);
  const userId = await repo.createUser({ name, email, phone, password_hash, role: 'user' });
  let subscription = null;
  if (plan_id) subscription = (await repo.subscribe(userId, plan_id)).subscription;

  res.status(201).json({ message: 'Customer created', userId, tempPassword, subscription });
});
