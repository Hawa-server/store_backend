/*
 * scripts/seed-production.js
 *
 * Runs the seeders ONCE against the production database (Aiven), from your
 * own computer:   npm run seed:production
 *
 * It reads the production database settings from `.env.production` (never
 * committed: .gitignore ignores every .env.* file except .env.example), then
 * runs `sequelize-cli db:seed:all` with those settings.
 *
 * Why a separate file: your normal `.env` points at your LOCAL database. The
 * production settings are loaded first with `override`, so they win; the
 * app's config (config/database.js) then reads `.env` without overriding, so
 * it can't switch back to the local database by accident.
 *
 * Run it only once, on empty tables: running it again fails on the unique
 * rules (e.g. category slugs), which protects the data from being duplicated.
 */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, '.env.production');

if (!fs.existsSync(FILE)) {
  console.error('Missing .env.production. Create it first (see the README, "Starting data").');
  process.exit(1);
}
dotenv.config({ path: FILE, override: true, quiet: true });
process.env.NODE_ENV = 'production';

// Stop early with a clear message if anything the seeders need is missing.
const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_SSL', 'DB_CA_CERT', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`.env.production is missing: ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.DB_SSL !== 'true') {
  console.error('.env.production must have DB_SSL=true (Aiven requires SSL).');
  process.exit(1);
}

// Show WHERE it's about to write (never the password), so a wrong database is obvious.
console.log(`Seeding ${process.env.DB_NAME} on ${process.env.DB_HOST}:${process.env.DB_PORT} as ${process.env.DB_USER}...`);
const result = spawnSync(
  process.execPath,
  [path.join(ROOT, 'node_modules', 'sequelize-cli', 'lib', 'sequelize'), 'db:seed:all'],
  { cwd: ROOT, stdio: 'inherit', env: process.env }
);
process.exit(result.status === null ? 1 : result.status);
