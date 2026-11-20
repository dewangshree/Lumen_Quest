const repo = require('../database/repo');

const handle = require('../utils/handle');

// Create a new plan (Admin only)
exports.createPlan = handle(async (req, res) => {
  const { plan_name, price, quota_sessions } = req.body || {};
  if (!plan_name || price === undefined || quota_sessions === undefined) {
    return res.status(400).json({ message: 'plan_name, price and quota_sessions are required' });
  }
  const planId = await repo.createPlan(req.body);
  res.status(201).json({ message: 'Plan created', planId });
});

// Get all plans
exports.getAllPlans = handle(async (req, res) => {
  res.json(await repo.getAllPlans());
});

// Get plan by ID
exports.getPlanById = handle(async (req, res) => {
  const plan = await repo.getPlanById(req.params.id);
  if (!plan) return res.status(404).json({ message: 'Plan not found' });
  res.json(plan);
});

// Update a plan (Admin only)
exports.updatePlan = handle(async (req, res) => {
  const ok = await repo.updatePlan(req.params.id, req.body || {});
  if (!ok) return res.status(404).json({ message: 'Plan not found' });
  res.json({ message: 'Plan updated successfully' });
});

// Delete a plan (Admin only)
exports.deletePlan = handle(async (req, res) => {
  const ok = await repo.deletePlan(req.params.id);
  if (!ok) return res.status(404).json({ message: 'Plan not found' });
  res.json({ message: 'Plan deleted successfully' });
});
