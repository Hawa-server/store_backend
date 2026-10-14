/*
 * services/account/deleteAccount.service.js
 *
 * A shopper deletes their own account (BE27).
 *
 * It's a "soft" delete: the Users row is KEPT as an empty shell, because past
 * orders (and logs) point at its id, and the store needs its sales and refund
 * records. Everything personal that belongs to the ACCOUNT goes:
 *
 *   User         kept as a shell: name "Deleted user", a made-up email (so
 *                the real one is free to register again), an unusable
 *                password, deletedAt set, and signed out everywhere
 *   Orders       kept, with their delivery details, still on the shell
 *   Reviews      deleted (they showed the shopper's name; ratings update
 *                automatically, because they're always calculated)
 *   Cart, EmailTokens  deleted
 *
 * Refused for admins (the store must never lose its last admin by accident),
 * and while anything is still in progress (orders not yet delivered or
 * cancelled, or a payment that's still being made).
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { sequelize, User, Order, Checkout, Review, Cart, EmailToken } = require('../../models');
const AppError = require('../../utils/AppError');
const withDeadlockRetry = require('../../utils/withDeadlockRetry');
// Used as emailService.sendEmailSafely(...) (not destructured), so tests can replace it.
const emailService = require('../email/email.service');
const accountDeletedEmail = require('../email/templates/accountDeleted');

// A checkout this recent that is still 'open' may be a payment the shopper is
// making right now: its order could appear after the account is gone.
const OPEN_CHECKOUT_MINUTES = 30;

/*
 * deleteAccount(userId, password)
 * Receives: the logged-in user's id, and the password they typed again.
 * Returns: nothing. The account is deleted and a goodbye email is sent to the
 *          address it had.
 * Throws: 403 for an admin; 401 WRONG_PASSWORD; 409 ORDERS_IN_PROGRESS.
 *         Nothing changes when it throws.
 */
async function deleteAccount(userId, password) {
  const before = await withDeadlockRetry(() =>
    sequelize.transaction(async (transaction) => {
      // Lock the user row: two delete requests at once take turns, and a login
      // can't slip in halfway.
      const user = await User.scope('withPassword').findByPk(userId, { lock: transaction.LOCK.UPDATE, transaction });

      if (user.isAdmin) throw new AppError(403, 'FORBIDDEN', "Admin accounts can't be deleted here.");
      // Typing the password again proves it's really the owner (not someone
      // using a phone that was left logged in).
      if (!(await bcrypt.compare(password, user.passwordHash))) {
        throw new AppError(401, 'WRONG_PASSWORD', 'Your password is incorrect.');
      }

      // Orders still on their way (Pending or Shipped), or a payment that may
      // still turn into an order, must finish first: otherwise the shopper
      // could no longer follow, cancel or receive emails about them.
      const inProgress = await Order.count({ where: { userId, status: ['Pending', 'Shipped'] }, transaction });
      const paying = await Checkout.count({
        where: { userId, status: 'open', createdAt: { [Op.gt]: new Date(Date.now() - OPEN_CHECKOUT_MINUTES * 60 * 1000) } },
        transaction,
      });
      if (inProgress || paying) {
        throw new AppError(
          409,
          'ORDERS_IN_PROGRESS',
          "You have orders that haven't been delivered yet. You can delete your account once they're delivered or cancelled."
        );
      }

      // Remember where to send the goodbye email BEFORE the address is replaced.
      const goodbye = { email: user.email, name: user.name };

      await Review.destroy({ where: { userId }, transaction });
      await Cart.destroy({ where: { userId }, transaction }); // cart lines go with it (ON DELETE CASCADE)
      await EmailToken.destroy({ where: { userId }, transaction });

      await user.update(
        {
          name: 'Deleted user',
          // A unique, made-up address on the reserved ".invalid" domain (it can
          // never receive email). The real address is now free to register again.
          email: `deleted-${crypto.randomUUID()}@deleted.invalid`,
          // Not a bcrypt hash at all, so no password can ever match it.
          passwordHash: `!deleted:${crypto.randomBytes(32).toString('hex')}`,
          deletedAt: new Date(),
          // Every login token on every device stops working.
          sessionVersion: user.sessionVersion + 1,
        },
        { transaction }
      );
      return goodbye;
    })
  );

  // After the commit: the goodbye email, to the address the account had.
  emailService.sendEmailSafely({ to: before.email, ...accountDeletedEmail({ name: before.name }) }, 'account deleted');
}

module.exports = { deleteAccount };
