/*
 * services/account/guestLink.service.js
 *
 * Links a shopper's GUEST activity to their account (BE25). Someone who paid
 * as a guest and later creates an account with the same email gets:
 *   1. their guest orders, in My Orders (with tracking emails, cancelling
 *      while Pending, and reviews once Delivered: all of those simply follow
 *      Orders.userId);
 *   2. what's left in the guest cart they paid from, even if that cart was
 *      on another phone or browser.
 *
 * Safety: only VERIFIED accounts. Orders hold a name, phone number and
 * address, so they must never go to someone who only TYPED an email. A
 * verified account has proved it owns the inbox, and that inbox already
 * received each guest order's confirmation email with its private link, so
 * linking gives the owner nothing they couldn't already open.
 *
 * Called (through linkGuestActivitySafely) right after email verification and
 * on every login (to catch guest orders placed later, while logged out).
 * Safe to repeat: linked orders no longer match "userId IS NULL", and merged
 * guest carts are deleted.
 */
const { Op } = require('sequelize');
const { sequelize, User, Order, Checkout, Cart } = require('../../models');
const withDeadlockRetry = require('../../utils/withDeadlockRetry');
const cartService = require('../cart/cart.service');

const NOTHING_LINKED = { ordersLinked: 0, cartItemsAdded: 0, cartItemsReduced: 0 };

/*
 * linkGuestActivity(userId)
 * Receives: the id of an account.
 * Returns: { ordersLinked, cartItemsAdded, cartItemsReduced } (all 0 if the
 *          account isn't verified, or nothing matched).
 *          cartItemsReduced = guest cart lines whose quantity was capped by
 *          stock, or dropped because the product is switched off or sold out.
 * Throws: if the database work fails (everything is rolled back).
 */
async function linkGuestActivity(userId) {
  const user = await User.findByPk(userId, { attributes: ['id', 'email', 'emailVerifiedAt'] });
  if (!user || !user.emailVerifiedAt) return { ...NOTHING_LINKED };

  // Emails are stored lower-cased and trimmed (Zod, and the BE25 migration for
  // older rows), and the column ignores case, so a plain comparison matches
  // "Ama@Test.com" with "ama@test.com", and can use the (email, ...) indexes.
  const { email } = user;

  const result = await withDeadlockRetry(() =>
    sequelize.transaction(async (transaction) => {
      // 1. Leftover guest carts. A guest cart is tied to a browser cookie, not
      //    an email, so it's found through a PAID checkout with this email:
      //    only a payment shows the guest really used this email. (Carts from
      //    unpaid checkouts are never merged.)
      //    Carts come FIRST, then products, then orders: the same lock order
      //    as payments (fulfilment) and the login merge, to avoid deadlocks.
      const paid = await Checkout.findAll({
        where: { email, status: 'paid', cartId: { [Op.ne]: null } },
        attributes: ['cartId'],
        transaction,
      });
      const cartIds = [...new Set(paid.map((checkout) => checkout.cartId))];
      const guestCarts = cartIds.length
        ? await Cart.findAll({
          // Still a guest cart (not someone's account cart) and not expired.
          where: { id: cartIds, userId: null, updatedAt: { [Op.gt]: cartService.guestCartCutoff() } },
          order: [['id', 'ASC']],
          lock: transaction.LOCK.UPDATE,
          transaction,
        })
        : [];
      const { added, reduced } = await cartService.mergeCartsIntoAccount(guestCarts, user.id, transaction);

      // 2. Guest orders with this email. One UPDATE: the "userId IS NULL"
      //    condition means an order is linked exactly once, even if two logins
      //    run this at the same moment, and an order that already belongs to
      //    ANOTHER account is never touched.
      const [ordersLinked] = await Order.update(
        { userId: user.id, linkedAt: new Date() },
        { where: { email, userId: null }, transaction }
      );

      return { ordersLinked, cartItemsAdded: added, cartItemsReduced: reduced };
    })
  );

  if (result.ordersLinked || result.cartItemsAdded || result.cartItemsReduced) {
    // Counts and the user id only: no email addresses in the logs.
    console.log(`[link] user ${user.id}: ${result.ordersLinked} guest orders, ${result.cartItemsAdded} cart lines added (${result.cartItemsReduced} reduced)`);
  }
  return result;
}

/*
 * linkGuestActivitySafely(userId)
 * Receives: the id of an account.
 * Returns: linkGuestActivity's result, or all zeros if it failed. Linking is
 *          a bonus: it must never stop someone verifying or logging in. A
 *          failure is logged, and the next login simply tries again.
 */
async function linkGuestActivitySafely(userId) {
  try {
    return await guestLink.linkGuestActivity(userId);
  } catch (err) {
    console.error(`[link] linking guest activity failed for user ${userId}:`, err.message);
    return { ...NOTHING_LINKED };
  }
}

// Called through this object (not directly), so tests can replace linkGuestActivity.
const guestLink = { linkGuestActivity, linkGuestActivitySafely };
module.exports = guestLink;
