/*
 * services/order/cancellation.service.js
 *
 * Cancelling an order (BE16). ONE service for both:
 *   - a shopper cancelling their own Pending order (POST /api/orders/:id/cancel)
 *   - an admin cancelling any Pending order (PATCH /api/admin/orders/:id/status)
 * so the rules can never differ between the two.
 *
 * Step 1, one transaction (all or nothing):
 *   lock the order → check it's Pending → lock its products → give the stock
 *   back → status Cancelled + history → a Refund for whatever hasn't been
 *   refunded yet (status 'requested').
 * Step 2, after the commit: send the refund to Paystack, then email the shopper.
 *
 * Idempotent: cancelling an already-cancelled order changes nothing (no
 * second stock restore, refund or email). The caller decides how to answer.
 */
const { sequelize, Order, OrderItem, OrderStatusChange, Product } = require('../../models');
const AppError = require('../../utils/AppError');
const withDeadlockRetry = require('../../utils/withDeadlockRetry');
const refundService = require('../refund/refund.service');
// Used as emailService.sendEmailSafely(...) (not destructured) so tests can replace it.
const emailService = require('../email/email.service');
const cancellationEmail = require('../email/templates/cancellation');
const { getConfirmationEmailData } = require('./order.service');
const { orderLink } = require('./orderStatus.service');

/*
 * sendCancellationEmail(orderId, refund)
 * Call AFTER the cancellation has been committed.
 * Receives: the order id and the Refund created (or null if nothing was left
 *           to refund).
 * Returns: a promise that always resolves (failures are logged only).
 */
async function sendCancellationEmail(orderId, refund) {
  try {
    const order = await Order.findByPk(orderId);
    const data = await getConfirmationEmailData(orderId);
    if (!order || !data) return;
    await emailService.sendEmailSafely(
      {
        to: data.to,
        ...cancellationEmail({ order: data.view, link: orderLink(order, data.token), refundAmount: refund ? refund.amount : 0 }),
      },
      'cancellation'
    );
  } catch (err) {
    console.error('[email] cancellation email failed:', err.message);
  }
}

/*
 * cancelOrder({ orderId, actorUserId, ownerId })
 * Receives: the order id; who is cancelling (their user id, recorded in the
 *           history and on the refund); and ownerId: the shopper's own id
 *           for shopper cancellations (the order must be theirs), or null for
 *           admins (any order).
 * Returns: { alreadyCancelled: true } if it was already cancelled (nothing
 *          changed), otherwise { alreadyCancelled: false, refund } where
 *          refund is the new Refund (after trying Paystack), or null if the
 *          order had already been refunded in full.
 * Throws: 404 if the order doesn't exist (or isn't the shopper's); 409 if it
 *         has already shipped or been delivered.
 */
async function cancelOrder({ orderId, actorUserId, ownerId }) {
  const result = await withDeadlockRetry(() =>
    sequelize.transaction(async (transaction) => {
      const lock = transaction.LOCK.UPDATE;

      // 1. Lock the order. Two cancels (or a cancel and an admin "Shipped")
      //    at the same moment take turns here, and the second sees the
      //    first one's result. For shoppers, the order must also be theirs:
      //    someone else's order is simply "not found".
      const where = ownerId ? { id: orderId, userId: ownerId } : { id: orderId };
      const order = await Order.findOne({ where, lock, transaction });
      if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');

      // 2. The status decides what's possible.
      if (order.status === 'Cancelled') return { alreadyCancelled: true };
      if (order.status !== 'Pending') {
        throw new AppError(409, 'CONFLICT', 'This order has already shipped, so it can\'t be cancelled.');
      }

      // 3. Give the stock back. Products are locked in id order, like
      //    everywhere else that locks products, so transactions can't deadlock.
      const items = await OrderItem.findAll({ where: { orderId }, order: [['productId', 'ASC']], transaction });
      const products = await Product.findAll({
        where: { id: items.map((item) => item.productId) },
        order: [['id', 'ASC']],
        lock,
        transaction,
      });
      const productById = new Map(products.map((p) => [p.id, p]));
      for (const item of items) {
        const product = productById.get(item.productId);
        if (product) await product.increment('stock', { by: item.quantity, transaction });
      }

      // 4. The status and its history entry, together.
      await order.update({ status: 'Cancelled' }, { transaction });
      await OrderStatusChange.create(
        { orderId, fromStatus: 'Pending', toStatus: 'Cancelled', changedByUserId: actorUserId },
        { transaction }
      );

      // 5. Refund what's LEFT, not always the full total: an admin may already
      //    have given a partial refund (BE17), and we must never pay back more
      //    than was paid. Read inside this transaction, while the order is locked.
      const left = order.total - (await refundService.refundedAmount(orderId, transaction));
      let refund = null;
      if (left > 0) {
        refund = await refundService.createRefund(
          { orderId, amount: left, type: 'cancellation', reason: 'Order cancelled.', issuedByUserId: actorUserId },
          transaction
        );
      }
      return { alreadyCancelled: false, refund };
    })
  );

  if (result.alreadyCancelled) return result;

  // Committed. Now the outside calls: Paystack first (a failure is recorded
  // on the Refund as 'failed', and the order stays Cancelled), then the email.
  const refund = result.refund ? await refundService.sendRefundToPaystack(result.refund.id) : null;
  sendCancellationEmail(orderId, refund);
  return { alreadyCancelled: false, refund };
}

module.exports = { cancelOrder };
