/*
 * Migration: link guest orders to accounts (BE25).
 *
 * When someone pays as a guest and later creates (and verifies) an account
 * with the same email, their guest orders are moved into that account.
 *
 * Changes:
 *   - Orders.linkedAt: WHEN a guest order was linked to an account (NULL for
 *     orders placed while logged in, and for guest orders not linked yet).
 *   - Index Orders (email, userId): linking looks for "this email, no account
 *     yet" orders. Without an index MySQL would read, and lock, every order.
 *   - Index Checkouts (email, status): finds the guest carts behind PAID
 *     checkouts with that email.
 *
 * Emails have always been saved lower-cased and trimmed (the Zod rules), but
 * this makes sure of it once for any older row, so linking can compare with a
 * plain `email = ?` that uses the index. (Wrapping the column in LOWER(TRIM())
 * would stop MySQL using the index.) Changing only the letter case/spaces of
 * an email loses nothing, so "down" doesn't undo it.
 */
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    for (const table of ['Orders', 'Checkouts']) {
      await q(`UPDATE ${table} SET email = LOWER(TRIM(email)) WHERE BINARY email <> BINARY LOWER(TRIM(email))`);
    }

    await queryInterface.addColumn('Orders', 'linkedAt', { type: Sequelize.DATE, allowNull: true, after: 'userId' });
    await queryInterface.addIndex('Orders', ['email', 'userId'], { name: 'orders_email_user' });
    await queryInterface.addIndex('Checkouts', ['email', 'status'], { name: 'checkouts_email_status' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Checkouts', 'checkouts_email_status');
    await queryInterface.removeIndex('Orders', 'orders_email_user');
    await queryInterface.removeColumn('Orders', 'linkedAt');
  },
};
