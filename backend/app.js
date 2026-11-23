const express = require('express');
const { helmetMiddleware, corsMiddleware, apiLimiter } = require('./src/middleware/security');
const { openapi, docsHtml } = require('./src/docs/openapi');

const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const planRoutes = require('./src/routes/planRoutes');
const recommendationRoutes = require('./src/routes/recommendationRoutes');
const subscriptionRoutes = require('./src/routes/subscriptionRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const { query } = require('./src/database/pool');

const app = express();

app.set('trust proxy', 1); // behind Vercel's proxy: use the real client IP for rate limits
app.disable('x-powered-by');
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(express.json({ limit: '100kb' }));
app.use('/api', apiLimiter);

app.get('/favicon.ico', (req, res) => res.status(204).end());

// API documentation (OpenAPI 3 + Swagger UI)
app.get('/api/openapi.json', (req, res) => res.json(openapi));
app.get('/api/docs', (req, res) => {
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; connect-src 'self'");
  res.type('html').send(docsHtml);
});

app.get('/', (req, res) => res.json({
  name: 'Lumen Quest API',
  status: 'ok',
  docs: '/api/docs',
  endpoints: ['/api/health', '/api/auth', '/api/users', '/api/plans', '/api/subscriptions', '/api/admin', '/api/recommendations'],
}));
app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (e) {
    res.status(503).json({ status: 'error', database: 'unreachable' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => res.status(404).json({ message: 'Not found' }));

// Malformed JSON / oversized bodies / unexpected errors -> clean JSON responses
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Request body too large' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON body' });
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

module.exports = app;
