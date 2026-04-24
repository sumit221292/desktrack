// Triggering fresh build to pick up new env variables
require('dotenv').config();
const app = require('./src/app');
const { pool } = require('./src/config/db');

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// Start server FIRST so Railway health checks pass, then test DB in background
app.listen(PORT, HOST, () => {
  console.log(`Server is running on port ${PORT} (host ${HOST})`);
});

// Test DB Connection (non-blocking)
if (pool) {
  pool.connect()
    .then((client) => {
      console.log('Connected to PostgreSQL database');
      client.release();
    })
    .catch((err) => {
      console.error('Database connection error (continuing anyway):', err.message);
    });
}
