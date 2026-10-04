/*
 * routes/health.routes.js
 *
 * GET /api/health — a quick "is the API alive?" check. Render uses it to know the
 * service is up, and we open it before a demo to wake the sleeping free-tier
 * server and database. It also checks the database connection.
 */
const express = require('express');
const { sequelize } = require('../models');

const router = express.Router();

/*
 * GET /api/health
 * Receives: nothing.
 * Returns: 200 { status: 'ok', database: 'ok' }, or 503 with the standard error
 *          shape if the database can't be reached.
 */
router.get('/', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ok', database: 'ok' });
  } catch (err) {
    // Don't reveal connection details; just say the database is unavailable.
    console.error('[health] database check failed:', err.message);
    res.status(503).json({
      error: { code: 'SERVER_ERROR', message: 'The database is unavailable. Please try again shortly.' },
    });
  }
});

module.exports = router;
