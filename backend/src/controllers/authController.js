const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const repo = require('../database/repo');
const { JWT_SECRET, JWT_REFRESH_SECRET } = require('../config');

const signTokens = (user) => ({
  accessToken: jwt.sign({ id: user.user_id, role: user.role }, JWT_SECRET, { expiresIn: '15m' }),
  refreshToken: jwt.sign({ id: user.user_id, role: user.role }, JWT_REFRESH_SECRET, { expiresIn: '7d' }),
});

// Register new user (always role "user"; admins are seeded / promoted in DB)
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email and password are required' });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const userId = await repo.createUser({ name, email, phone, password_hash, role: 'user' });
    res.status(201).json({ message: 'User registered successfully', userId });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Internal server error' });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: 'email and password are required' });

    const user = await repo.findUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const { password_hash, ...profile } = user;
    res.json({ ...signTokens(user), user: profile });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Logout user (stateless JWT; client discards tokens)
exports.logout = async (req, res) => {
  res.json({ message: 'Logged out successfully' });
};

// Refresh access token
exports.refreshToken = async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(401).json({ message: 'No token provided' });
  jwt.verify(token, JWT_REFRESH_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    const accessToken = jwt.sign({ id: payload.id, role: payload.role }, JWT_SECRET, { expiresIn: '15m' });
    res.json({ accessToken });
  });
};
