require('dotenv').config();

const app = require('./app');
const { initSchema } = require('./db/database');

const PORT = parseInt(process.env.PORT, 10) || 3000;

initSchema();

const server = app.listen(PORT, () => {
  console.log(`Event-Driven Notification Dispatcher listening on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Set PORT to a free port and try again.`);
  } else {
    console.error('[server] failed to start:', err);
  }
  process.exit(1);
});

