const express = require('express');
const cors = require('cors');

const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const planRoutes = require('./src/routes/planRoutes');
const recommendationRoutes = require('./src/routes/recommendationRoutes');
const subscriptionRoutes = require('./src/routes/subscriptionRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const { query } = require('./src/database/pool');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({
  name: 'Lumen Quest API',
  status: 'ok',
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

module.exports = app;
