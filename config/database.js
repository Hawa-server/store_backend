/*
 * config/database.js
 *
 * Database connection settings, read from `.env`.
 * Used in two places:
 *   1. models/index.js — the running app connects to MySQL with these settings.
 *   2. sequelize-cli (via .sequelizerc) — migrations and seeders use the same settings.
 *
 * Locally we connect without SSL. In production (Aiven MySQL) SSL is required,
 * so we pass Aiven's CA certificate and refuse any server we can't verify.
 */
require('dotenv').config({ quiet: true });

/*
 * buildConfig()
 * Builds one Sequelize connection config from environment variables.
 * Receives: nothing (reads process.env).
 * Returns: a plain config object Sequelize understands.
 */
function buildConfig() {
  const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    dialect: 'mysql',
    // Store and read all dates as UTC. Ghana time is applied only when we
    // calculate business dates (dashboard periods, date filters).
    timezone: '+00:00',
    // Don't print every SQL query (it's noisy and could leak data into logs).
    logging: false,
    dialectOptions: {},
  };

  if (process.env.DB_SSL === 'true') {
    // Environment variables are often single-line, so the certificate may be
    // stored with literal "\n" instead of real line breaks. Turn them back.
    const ca = (process.env.DB_CA_CERT || '').replace(/\\n/g, '\n');
    // rejectUnauthorized: only talk to a database whose certificate matches Aiven's CA,
    // so nobody can pretend to be our database.
    config.dialectOptions.ssl = { ca, rejectUnauthorized: true };
  }

  return config;
}

module.exports = {
  development: buildConfig(),
  production: buildConfig(),
};
