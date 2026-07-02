const express = require('express');
const eventRoutes = require('./routes/eventRoutes');

const app = express();

app.use(express.json());

// Catch malformed JSON bodies (express.json throws a SyntaxError with
// type 'entity.parse.failed' before it ever reaches our routes).
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  next(err);
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Event-Driven Notification Dispatcher is running.',
    health_check: '/health',
    submit_event: 'POST /api/v1/events',
    docs: 'Send JSON with event_type, recipient, and optional data.'
  });
});

app.use('/api/v1', eventRoutes);

// 404 for anything unmatched
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Generic catch-all error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[app] unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
