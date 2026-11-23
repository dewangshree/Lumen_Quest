const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const repo = require('../database/repo');
const { JWT_SECRET, JWT_REFRESH_SECRET } = require('../config');
const { sendWelcomeEmail } = require('../services/email');

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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return res.status(400).json({ message: 'Enter a valid email address' });
    if (String(password).length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
    if (String(name).trim().length > 100) return res.status(400).json({ message: 'Name is too long' });
    const password_hash = await bcrypt.hash(password, 10);
    const userId = await repo.createUser({ name: String(name).trim(), email: String(email).trim(), phone, password_hash, role: 'user' });
    // Awaited so the serverless function doesn't stop mid-send; failures never block signup
    const mail = await sendWelcomeEmail({ name: String(name).trim(), email: String(email).trim() });
    res.status(201).json({ message: 'User registered successfully', userId, welcomeEmailSent: mail.sent });
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

// Sign in with Google (customers only).
// The frontend sends the Google ID token ("credential"); we verify it with Google,
// check it was issued for our client ID, then sign in or create the customer account.
const crypto = require('crypto');
exports.google = async (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(503).json({ message: 'Google sign-in is not configured' });
    const { credential } = req.body || {};
    if (!credential || typeof credential !== 'string') return res.status(400).json({ message: 'credential is required' });

    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!r.ok) return res.status(401).json({ message: 'Invalid Google sign-in. Please try again.' });
    const info = await r.json();
    const validIssuer = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
    const notExpired = Number(info.exp) * 1000 > Date.now();
    if (info.aud !== clientId || !validIssuer || !notExpired) {
      return res.status(401).json({ message: 'Invalid Google sign-in. Please try again.' });
    }
    if (info.email_verified !== 'true' && info.email_verified !== true) {
      return res.status(401).json({ message: 'Your Google email address is not verified.' });
    }

    const email = String(info.email).toLowerCase();
    let user = await repo.findUserByEmail(email);
    let created = false;
    if (user && user.role === 'admin') {
      return res.status(403).json({ message: 'Admins must sign in with their password on the Admin Login screen.' });
    }
    if (!user) {
      const name = String(info.name || email.split('@')[0]).slice(0, 100);
      // Random unusable password: the account signs in with Google (a password can be set later via reset)
      const password_hash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      await repo.createUser({ name, email, phone: null, password_hash, role: 'user' });
      user = await repo.findUserByEmail(email);
      created = true;
      await sendWelcomeEmail({ name, email });
    }
    const { password_hash, ...profile } = user;
    res.status(created ? 201 : 200).json({ ...signTokens(user), user: profile, created });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Internal server error' });
  }
};
