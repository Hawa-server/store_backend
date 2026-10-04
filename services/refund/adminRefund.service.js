/*
 * services/refund/adminRefund.service.js
 *
 * Refunds issued by an admin (BE17): a full refund (everything not refunded
 * yet) or a partial one (a chosen amount), plus retrying a refund that failed.
 *
 * Rules:
 *   - Never refund more than was paid: the amount must fit in what's LEFT
 *     (paid minus refunds that aren't 'failed'), checked while the order row
 *     is locked. Cancellation (BE16) takes the same lock, so the two can't
 *     both use the same "amount left".
 *   - Save the Refund first (one short transaction), then call Paystack
 *     after the commit.
 *   - Refunds never change the order's status or its stock.
 *   - The shopper is emailed only once Paystack has accepted the refund.
 *   - A retry first asks Paystack what it already did for that payment, so a
 *     refund is never sent twice (e.g. our first request timed out, but
 *     Paystack had actually made it).
 */
const { sequelize, Order, Refund } = require('../../models');
const AppError = require('../../utils/AppError');
const { formatGhs } = require('../../utils/money');
const refundService = require('./refund.service');

/*
 * lockOrderAndGetLeft(orderId, transaction)
 * Receives: an order id and the open transaction.
 * Returns: { order, left } where `left` is how much can still be refunded
 *          (pesewas). The order row stays locked until the transaction ends.
 * Throws: 404 if the order doesn't exist.
 */
async function lockOrderAndGetLeft(orderId, transaction) {
  const order = await Order.findByPk(orderId, { lock: transaction.LOCK.UPDATE, transaction });
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
  const left = order.total - (await refundService.refundedAmount(orderId, transaction));
  return { order, left };
}

/*
 * issueRefund({ orderId, type, amount, reason, adminId })
 * Receives: the order id; type 'full' (everything left) or 'partial'; the
 *           amount in pesewas (partial only); the reason; the admin's id.
 * Returns: the Refund after trying Paystack: 'processed', or 'failed' with
 *          failureReason (it can then be retried).
 * Throws: 404 unknown order; 409 if nothing is left to refund; 400 (with
 *         fields.amount) if a partial amount is more than what's left.
 */
async function issueRefund({ orderId, type, amount, reason, adminId }) {
  const refund = await sequelize.transaction(async (transaction) => {
    const { left } = await lockOrderAndGetLeft(orderId, transaction);
    if (left <= 0) throw new AppError(409, 'CONFLICT', 'This order has already been refunded in full.');

    const refundAmount = type === 'full' ? left : amount;
    if (refundAmount > left) {
      throw new AppError(400, 'INVALID_REQUEST', 'Please check the highlighted fields.', {
        amount: `You can refund at most ${formatGhs(left)}.`,
      });
    }
    return refundService.createRefund(
      { orderId, amount: refundAmount, type, reason, issuedByUserId: adminId },
      transaction
    );
  });

  // Committed: the refund is on record as 'requested'. Now Paystack.
  const result = await refundService.sendRefundToPaystack(refund.id);
  if (result.status === 'processed') refundService.sendRefundEmail(result);
  return result;
}

/*
 * retryRefund({ orderId, refundId })
 * Receives: the order id and the id of one of its FAILED refunds.
 * Returns: the Refund afterwards: 'processed' (sent now, or found already
 *          made at Paystack), or 'failed' again with the new reason.
 * Throws: 404 if the refund isn't this order's; 409 if it isn't 'failed'
 *         (including another retry already running), or if it no longer
 *         fits in what's left to refund.
 */
async function retryRefund({ orderId, refundId }) {
  // Step 1: claim the refund, under the order's lock. Setting it back to
  // 'requested' means a second retry at the same moment sees 'requested' and
  // is refused, so only one retry ever talks to Paystack.
  const { refund, order } = await sequelize.transaction(async (transaction) => {
    const locked = await lockOrderAndGetLeft(orderId, transaction);
    const found = await Refund.findOne({ where: { id: refundId, orderId }, transaction });
    if (!found) throw new AppError(404, 'NOT_FOUND', 'Refund not found.');
    if (found.status !== 'failed') throw new AppError(409, 'CONFLICT', 'Only failed refunds can be retried.');
    // A failed refund isn't counted in "left", so check it still fits.
    if (found.amount > locked.left) {
      throw new AppError(409, 'CONFLICT', `This refund no longer fits: only ${formatGhs(Math.max(locked.left, 0))} is left to refund.`);
    }
    await found.update({ status: 'requested', failureReason: null }, { transaction });
    return { refund: found, order: locked.order };
  });

  // Step 2: before sending anything, ask Paystack what it has ALREADY
  // refunded for this payment. A "failed" refund may really have gone
  // through (e.g. our request timed out after Paystack accepted it).
  let paystackRefunds;
  try {
    paystackRefunds = await refundService.findPaystackRefundsForPayment({
      reference: order.paymentReference,
      since: order.createdAt,
    });
  } catch (err) {
    // Couldn't check, so don't send: sending blind could refund twice.
    await refund.update({ status: 'failed', failureReason: `Couldn't check Paystack's refunds: ${err.message}`.slice(0, 255) });
    return refund;
  }

  const ours = await Refund.findAll({ where: { orderId, status: 'processed' } });
  const ourTotal = ours.filter((r) => r.providerReference).reduce((sum, r) => sum + r.amount, 0);
  const paystackTotal = paystackRefunds.reduce((sum, r) => sum + r.amount, 0);

  if (paystackTotal > ourTotal) {
    // Paystack holds a refund we never recorded: this is the one. Use a
    // Paystack refund id we haven't already linked, preferring the same amount.
    const used = new Set(ours.map((r) => r.providerReference));
    const unlinked = paystackRefunds.filter((r) => !used.has(String(r.id)));
    const match = unlinked.find((r) => r.amount === refund.amount) || unlinked[0];
    if (match) {
      console.warn(`[refund] refund ${refund.id}: Paystack already made it (refund ${match.id}); not sending again.`);
      await refund.update({ status: 'processed', providerReference: String(match.id), failureReason: null });
      refundService.sendRefundEmail(refund);
      return refund;
    }
  }

  // Paystack hasn't made it: send it now.
  const result = await refundService.sendRefundToPaystack(refund.id);
  if (result.status === 'processed') refundService.sendRefundEmail(result);
  return result;
}

module.exports = { issueRefund, retryRefund };
