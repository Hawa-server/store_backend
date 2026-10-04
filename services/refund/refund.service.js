/*
 * services/refund/refund.service.js
 *
 * Giving money back. Used now for "paid, but the item sold out" (BE9), and
 * later for cancellations (BE16) and admin refunds (BE17).
 *
 * Always two steps, because an outside call must never happen inside a
 * database transaction:
 *   1. createRefund(): INSIDE the caller's transaction, save a Refund row
 *      with status 'requested'. It commits together with the caller's other
 *      changes (e.g. marking the checkout failed), so they can't disagree.
 *   2. sendRefundToPaystack(): AFTER the commit, ask Paystack to send the
 *      money, then record the result ('processed' or 'failed').
 */
const { Refund, Order, Checkout } = require('../../models');
const paystack = require('../payment/paystack.client');
// Used as emailService.sendEmailSafely(...) (not destructured) so tests can replace it.
const emailService = require('../email/email.service');
const refundEmail = require('../email/templates/refund');

// Listing Paystack refunds: how many per page, and a safety limit on pages.
const LIST_PER_PAGE = 100;
const LIST_MAX_PAGES = 10;

// Refunds that count as money going back to the shopper. 'failed' ones don't:
// that money never left. Used for "how much is refunded" and "how much is left".
const COUNTED_REFUND_STATUSES = ['requested', 'processed'];

/*
 * refundedAmount(orderId, transaction)
 * Receives: an order id and (optionally) the open transaction.
 * Returns: the total pesewas already refunded or being refunded for the order
 *          (requested + processed refunds; failed ones don't count).
 * Read it INSIDE the transaction that holds the order's lock, so nobody can
 * add a refund between reading this and creating a new one.
 */
async function refundedAmount(orderId, transaction) {
  const total = await Refund.sum('amount', {
    where: { orderId, status: COUNTED_REFUND_STATUSES },
    transaction,
  });
  return Number(total) || 0;
}

/*
 * createRefund({ orderId, checkoutId, amount, type, reason, issuedByUserId }, transaction)
 * Receives: exactly one of orderId / checkoutId (the database CHECK enforces
 *           this), the amount in whole pesewas, the type ('cancellation' |
 *           'full' | 'partial'), a reason (up to 200 characters), who issued
 *           it (null = the system), and the open transaction.
 * Returns: the new Refund row (status 'requested'). Nothing is sent to Paystack yet.
 */
async function createRefund({ orderId = null, checkoutId = null, amount, type, reason, issuedByUserId = null }, transaction) {
  return Refund.create(
    { orderId, checkoutId, amount, type, reason: reason.slice(0, 200), status: 'requested', issuedByUserId },
    { transaction }
  );
}

/*
 * paymentReferenceFor(refund)
 * Receives: a Refund.
 * Returns: the Paystack reference of the payment being refunded: the order's
 *          paymentReference, or the checkout's reference.
 */
async function paymentReferenceFor(refund) {
  if (refund.orderId) return (await Order.findByPk(refund.orderId)).paymentReference;
  return (await Checkout.findByPk(refund.checkoutId)).reference;
}

/*
 * sendRefundToPaystack(refundId)
 * Call AFTER the transaction that created the refund has committed.
 * Receives: the Refund id.
 * Returns: the updated Refund:
 *   - 'processed' + providerReference (Paystack's refund id) if Paystack
 *     accepted it (Paystack then pays it out; it can take a few business days);
 *   - 'failed' + failureReason if Paystack refused or couldn't be reached.
 *     The row stays, so it can be retried later (BE17) and counted on the
 *     admin dashboard (BE20).
 *
 * Never sends the same refund twice: if Paystack has already accepted it
 * (providerReference is set), it just returns it, so the shopper is never
 * refunded twice for one Refund.
 */
async function sendRefundToPaystack(refundId) {
  const refund = await Refund.findByPk(refundId);
  if (refund.providerReference) return refund;

  try {
    const data = await paystack.createRefund({
      reference: await paymentReferenceFor(refund),
      amount: refund.amount,
      note: refund.reason,
    });
    await refund.update({ status: 'processed', providerReference: String(data.id), failureReason: null });
  } catch (err) {
    // Not an error for the shopper's request: the refund is recorded as failed
    // so staff can see it and retry. The reason is Paystack's message (no secrets).
    console.error(`[refund] refund ${refund.id} failed:`, err.message);
    await refund.update({ status: 'failed', failureReason: err.message.slice(0, 255) });
  }
  return refund;
}

/*
 * sendRefundEmail(refund)
 * Call only once Paystack has ACCEPTED the refund (status 'processed'), so a
 * shopper is never told about money that isn't actually coming.
 * Receives: a Refund that belongs to an order.
 * Returns: a promise that always resolves (failures are logged only).
 */
async function sendRefundEmail(refund) {
  try {
    const order = await Order.findByPk(refund.orderId);
    if (!order) return;
    await emailService.sendEmailSafely(
      {
        to: order.email,
        ...refundEmail({
          name: order.name,
          amount: refund.amount,
          reason: `We've refunded part or all of your order ${order.orderNumber}. Reason: ${refund.reason}`,
          reference: order.orderNumber,
        }),
      },
      'refund'
    );
  } catch (err) {
    console.error('[email] refund email failed:', err.message);
  }
}

/*
 * findPaystackRefundsForPayment({ reference, since })
 * Asks Paystack which refunds it has for one payment, so a retry never sends
 * a refund that Paystack already made (e.g. our first request timed out but
 * Paystack had in fact accepted it).
 * Receives: our payment reference and the date the payment was made (refunds
 *           can't be older than the payment, so we only list from then on).
 * Returns: [{ id, amount, status }] for that payment, leaving out failed ones.
 * Throws: if Paystack can't be reached (the caller then doesn't send anything).
 *
 * Paystack's "list refunds" can't filter by payment, so we list by date and
 * match each refund by its transaction reference, or by Paystack's
 * transaction id (from verify), in case the reference isn't included.
 */
async function findPaystackRefundsForPayment({ reference, since }) {
  const transaction = await paystack.verifyTransaction(reference);
  const transactionId = transaction && transaction.id;
  const matches = [];
  for (let page = 1; page <= LIST_MAX_PAGES; page += 1) {
    const refunds = await paystack.listRefunds({ from: since, page, perPage: LIST_PER_PAGE });
    for (const r of refunds) {
      const isThisPayment = r.transaction_reference === reference || (transactionId && r.transaction === transactionId);
      if (isThisPayment && r.status !== 'failed') matches.push({ id: r.id, amount: r.amount, status: r.status });
    }
    if (refunds.length < LIST_PER_PAGE) break; // the last page
  }
  return matches;
}

module.exports = {
  COUNTED_REFUND_STATUSES,
  refundedAmount,
  createRefund,
  sendRefundToPaystack,
  sendRefundEmail,
  findPaystackRefundsForPayment,
};
