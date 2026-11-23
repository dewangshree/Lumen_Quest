const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Browsers may only call the API from these origins (comma-separated CORS_ORIGINS overrides).
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'https://dewangshree.github.io,http://localhost:3000')
  .split(',').map((s) => s.trim()).filter(Boolean);

// Any localhost/127.0.0.1 port is allowed for local development
const LOCAL_DEV = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const corsMiddleware = cors({
  origin(origin, cb) {
    // No Origin header = server-to-server, curl, Swagger "try it out" on the same host
    if (!origin || ALLOWED_ORIGINS.includes(origin) || LOCAL_DEV.test(origin)) return cb(null, true);
    return cb(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
});

const tooMany = (message) => (req, res) => res.status(429).json({ message });

// Note: counters are kept in memory per server instance (no shared store).
// Failed sign-ins per email: 5 per 15 minutes; successful logins don't count.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `login:${String((req.body && req.body.email) || '').trim().toLowerCase() || req.ip}`,
  handler: tooMany('Too many failed sign-in attempts. Please try again in 15 minutes.'),
});

// New accounts per IP: 10 per hour
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: tooMany('Too many accounts created from this network. Please try again later.'),
});

// Overall API budget per IP: 600 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: tooMany('Too many requests. Please slow down.'),
});

module.exports = {
  helmetMiddleware: helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }),
  corsMiddleware,
  loginLimiter,
  registerLimiter,
  apiLimiter,
  ALLOWED_ORIGINS,
};
