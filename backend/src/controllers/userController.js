const bcrypt = require('bcryptjs');
const repo = require('../database/repo');

const handle = require('../utils/handle');

// Get my profile
exports.getMyProfile = handle(async (req, res) => {
  const user = await repo.getUserById(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});

// Update my profile
exports.updateMyProfile = handle(async (req, res) => {
  const { name, phone, password, current_password } = req.body || {};
  const fields = {};
  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ message: 'Name cannot be empty' });
    fields.name = String(name).trim();
  }
  if (phone !== undefined) {
    if (phone && !/^[0-9+\-\s]{7,15}$/.test(phone)) return res.status(400).json({ message: 'Enter a valid phone number' });
    fields.phone = phone || null;
  }
  if (password) {
    if (String(password).length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters' });
    const hash = await repo.getUserPasswordHash(req.user.id);
    if (!hash || !current_password || !(await bcrypt.compare(current_password, hash))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    fields.password_hash = await bcrypt.hash(password, 10);
  }
  if (!Object.keys(fields).length) return res.status(400).json({ message: 'Nothing to update' });

  const ok = await repo.updateUser(req.user.id, fields);
  if (!ok) return res.status(404).json({ message: 'User not found' });
  res.json({ message: 'Profile updated successfully' });
});

// Delete my account
exports.deleteMyAccount = handle(async (req, res) => {
  await repo.deleteUser(req.user.id);
  res.json({ message: 'Account deleted successfully' });
});

// Get user by ID (Admin only)
exports.getUserById = handle(async (req, res) => {
  const user = await repo.getUserById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});

// Get all users (Admin only)
exports.getAllUsers = handle(async (req, res) => {
  res.json(await repo.getAllUsers());
});
