/*
 * Seeder: the store's admin account (already email-verified).
 * The email and password come from .env (ADMIN_EMAIL, ADMIN_PASSWORD), so no
 * real admin password is ever written in code or committed to GitHub.
 */
'use strict';

require('dotenv').config({ quiet: true });
const bcrypt = require('bcryptjs');

/*
 * readAdminEnv()
 * Receives: nothing (reads process.env).
 * Returns: { email, password }. Throws a clear error if either is missing or
 *          the password is shorter than 8 characters.
 */
function readAdminEnv() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || password.length < 8) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 8 characters) in .env before seeding.');
  }
  return { email, password };
}

module.exports = {
  async up(queryInterface) {
    const { email, password } = readAdminEnv();
    const now = new Date();
    await queryInterface.bulkInsert('Users', [
      {
        name: 'Store Admin',
        email,
        // Cost factor 12: slow enough to make guessing expensive for attackers.
        passwordHash: await bcrypt.hash(password, 12),
        isAdmin: true,
        emailVerifiedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(queryInterface) {
    const { email } = readAdminEnv();
    await queryInterface.bulkDelete('Users', { email });
  },
};
