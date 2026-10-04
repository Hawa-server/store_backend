/*
 * services/payment/payment.service.js
 *
 * Confirms a payment and, if it succeeded, creates the order. This is the ONE
 * path used by both:
 *   - POST /api/checkout/verify   (the shopper's browser asks after paying)
 *   - POST /api/webhooks/paystack (Paystack tells us directly)
 * Using the same function for both means the checks can never differ, and
 * whichever arrives first creates the order while the other finds it done.
 *
 * Server-side verification: whatever the browser or the webhook says, we ask
 * Paystack's API ourselves and compare its answer with OUR saved checkout.
 *
 * Paid, but it can't become an order: the checkout is marked failed, the
 * shopper is refunded in full, and emailed. This happens when:
 *   - another shopper's payment took the last unit first (BE9);
 *   - it's a late duplicate: a newer checkout for the same cart was already
 *     paid (BE10).
 *
 * Edge cases (BE10): a payment that isn't finished yet is checked again a few
 * times before answering "pending"; every failure gets a clear reason; and if
 * Paystack is slow or unreachable, the check is retried once. The whole check
 * takes at most about 20 seconds.
 *
 * Confirmation email (BE11): sent once, by the request that created the
 * order, after the order is committed. It doesn't matter whether that was
 * verify or the webhook, so shoppers who closed the page still get it.
 */
const { sequelize, Checkout, Order, Refund } = require('../../models');
const paystack = require('./paystack.client');
const { fulfilCheckout } = require('../order/fulfilment.service');
const refundService = require('../refund/refund.service');
const emailService = require('../email/email.service');
const refundEmail = require('../email/templates/refund');
const orderConfirmationEmail = require('../email/templates/orderConfirmation');
const orderService = require('../order/order.service');

// Paystack statuses that mean the payment definitely did not go through,
// and the reason we give the frontend for each.
const FAILURE_REASONS = {
  failed: 'declined', // e.g. wrong PIN or not enough money
  abandoned: 'not_completed', // started but never finished (or it timed out)
  reversed: 'reversed',
};
const FINAL_STATUSES = ['success', ...Object.keys(FAILURE_REASONS)];

// Rechecking a payment that isn't finished yet (BE10).
const MAX_STATUS_CHECKS = 3; // ask Paystack at most 3 times per request
const RECHECK_DELAY_MS = 2000; // wait 2 seconds between checks
const VERIFY_DEADLINE_MS = 20000; // never keep the shopper waiting longer than ~20 s

// The start of a duplicate payment's refund reason. It's also how we later
// recognise a refund as "duplicate" rather than "sold out".
const DUPLICATE_REASON = 'Duplicate payment: your order was already placed.';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/*
 * verifyWithRechecks(reference)
 * Asks Paystack about a payment, patiently. Never called inside a database
 * transaction, so nothing is locked while we wait.
 * Receives: our payment reference.
 * Returns: Paystack's transaction data. Its status is final (success, failed,
 *          abandoned, reversed) or, after 3 checks or ~20 seconds, still pending.
 * Throws: if Paystack can't be reached even after one retry (the caller
 *         answers "try again").
 */
async function verifyWithRechecks(reference) {
  const deadline = Date.now() + VERIFY_DEADLINE_MS;
  let retriedNetworkError = false;
  let checks = 0;

  for (;;) {
    let tx;
    try {
      // Each call gets whatever time is left (and at most 8 seconds).
      tx = await paystack.verifyTransaction(reference, { timeoutMs: Math.max(deadline - Date.now(), 1000) });
    } catch (err) {
      // A network blip or a slow Paystack: try ONCE more if there's time.
      // Safe, because verify only reads; it can never charge anyone twice.
      if (err.retryable && !retriedNetworkError && deadline - Date.now() > 2000) {
        retriedNetworkError = true;
        console.warn(`[payment] verify ${reference}: ${err.message}. Retrying once.`);
        continue;
      }
      throw err;
    }

    checks += 1;
    if (FINAL_STATUSES.includes(tx.status) || checks >= MAX_STATUS_CHECKS) return tx;
    // Still in progress (e.g. waiting for the shopper to approve on their
    // phone). Wait a little and ask again, unless that would pass the deadline.
    if (deadline - Date.now() < RECHECK_DELAY_MS + 3000) return tx;
    await sleep(RECHECK_DELAY_MS);
  }
}

/*
 * refundKind(refund)
 * Receives: a Refund for a checkout.
 * Returns: 'duplicate' or 'sold_out': why this payment was refunded.
 */
function refundKind(refund) {
  return refund.reason.startsWith(DUPLICATE_REASON) ? 'duplicate' : 'sold_out';
}

/*
 * refundPaidCheckout(checkoutId, reason)
 * Called when Paystack confirmed the payment but it can't become an order
 * (sold out, or a duplicate payment).
 * Receives: the checkout id and a sentence explaining why.
 * Returns: { outcome: 'refunded', kind, refund }.
 *
 * Step 1 (one transaction): mark the checkout 'failed' and create ONE full
 *   refund for it. The checkout row is locked, and an existing refund is
 *   reused, so a verify and a webhook arriving together can't refund twice.
 * Step 2 (after commit): send the refund to Paystack, then email the shopper.
 *   Only the request that created the refund does this.
 */
async function refundPaidCheckout(checkoutId, reason) {
  const { refund, created, checkout } = await sequelize.transaction(async (transaction) => {
    const locked = await Checkout.findByPk(checkoutId, { lock: transaction.LOCK.UPDATE, transaction });
    const existing = await Refund.findOne({ where: { checkoutId }, transaction });
    if (existing) return { refund: existing, created: false, checkout: locked };

    await locked.update({ status: 'failed' }, { transaction });
    const newRefund = await refundService.createRefund(
      {
        checkoutId,
        amount: locked.total, // everything they paid, including delivery (pesewas)
        type: 'full',
        reason: `${reason} Your payment has been refunded in full.`,
      },
      transaction
    );
    return { refund: newRefund, created: true, checkout: locked };
  });

  const kind = refundKind(refund);
  if (created) {
    // Outside the transaction: Paystack first, then the email. A failed
    // refund is recorded as 'failed' (for staff to retry); a failed email is
    // only logged. Neither undoes the steps above.
    await refundService.sendRefundToPaystack(refund.id);
    const intro = kind === 'duplicate' ? 'We received two payments for the same order.' : 'Sorry!';
    emailService.sendEmailSafely(
      {
        to: checkout.email,
        ...refundEmail({
          name: checkout.name,
          amount: refund.amount,
          reason: `${intro} ${refund.reason}`,
          reference: checkout.reference,
        }),
      },
      `${kind} refund`
    );
  }
  return { outcome: 'refunded', kind, refund: await refund.reload() };
}

/*
 * sendConfirmationEmail(orderId)
 * Call AFTER the order has been committed.
 * Receives: the new order's id.
 * Returns: a promise that always resolves (never throws): an email problem
 *          must never affect the order.
 */
async function sendConfirmationEmail(orderId) {
  try {
    const data = await orderService.getConfirmationEmailData(orderId);
    if (!data) return;
    const link = `${process.env.CLIENT_URL}/order/confirmation/${data.token}`;
    await emailService.sendEmailSafely(
      { to: data.to, ...orderConfirmationEmail({ order: data.view, link, linkDays: orderService.CONFIRMATION_LINK_DAYS }) },
      'order confirmation'
    );
  } catch (err) {
    console.error('[email] order confirmation email failed:', err.message);
  }
}

/*
 * confirmPayment(reference)
 * Receives: our payment reference (from the browser or the webhook).
 * Returns: { outcome, order?, refund?, kind?, reason? } where outcome is one of:
 *   'fulfilled'          payment confirmed now; order just created
 *   'already_fulfilled'  order had already been created earlier
 *   'refunded'           paid, but refunded instead of becoming an order;
 *                        kind = 'sold_out' (BE9) or 'duplicate' (BE10)
 *   'failed'             no money taken; reason = 'declined' | 'not_completed'
 *                        | 'reversed' | 'closed' (checkout already closed)
 *   'pending'            still not finished after rechecking; ask again shortly
 *   'mismatch'           Paystack says success, but the amount, currency or
 *                        reference doesn't match our checkout: NOT fulfilled
 *   'unknown_reference'  no such checkout
 * Throws: if Paystack can't be reached (the caller answers "try again").
 */
async function confirmPayment(reference) {
  const checkout = await Checkout.findOne({ where: { reference } });
  if (!checkout) return { outcome: 'unknown_reference' };

  // Already done: return the same order every time (idempotent).
  if (checkout.status === 'paid') {
    return { outcome: 'already_fulfilled', order: await Order.findByPk(checkout.orderId) };
  }
  if (checkout.status !== 'open') {
    // A closed checkout that has a refund was paid and refunded: give the
    // same answer every time. Otherwise it never got as far as a payment.
    const refund = await Refund.findOne({ where: { checkoutId: checkout.id } });
    return refund ? { outcome: 'refunded', kind: refundKind(refund), refund } : { outcome: 'failed', reason: 'closed' };
  }

  const tx = await verifyWithRechecks(reference);

  if (tx.status === 'success') {
    // Never fulfil just because Paystack says "success": it must be for OUR
    // amount (pesewas), in GHS, for this exact reference. Otherwise someone
    // could, for example, pay 1 pesewa on another transaction and reuse it.
    const matches = tx.amount === checkout.total && tx.currency === 'GHS' && tx.reference === checkout.reference;
    if (!matches) {
      console.error(
        `[payment] MISMATCH for ${reference}: expected ${checkout.total} GHS, Paystack reports ${tx.amount} ${tx.currency}`
      );
      return { outcome: 'mismatch' };
    }
    try {
      const result = await fulfilCheckout(checkout.id);
      if (result.duplicate) return refundPaidCheckout(checkout.id, DUPLICATE_REASON);
      if (result.alreadyFulfilled) return { outcome: 'already_fulfilled', order: result.order };
      // Only the request that just created the order gets here, so the
      // email goes out exactly once. Not awaited: the shopper's answer
      // shouldn't wait for the mail server, and a failure is only logged.
      sendConfirmationEmail(result.order.id);
      return { outcome: 'fulfilled', order: result.order };
    } catch (err) {
      // The money arrived, but another payment took the last unit first.
      if (err.code === 'OUT_OF_STOCK') return refundPaidCheckout(checkout.id, err.message);
      throw err;
    }
  }

  if (FAILURE_REASONS[tx.status]) {
    // No money was taken, and no order or stock changes happen. The checkout
    // stays 'open' on purpose: a mobile money approval can arrive late, and
    // if Paystack later reports success, this same function still fulfils it.
    // Paystack's own wording (gateway_response) isn't documented, so it's
    // logged for us, not shown to the shopper.
    console.warn(`[payment] ${reference} ${tx.status}: ${tx.gateway_response || 'no details'}`);
    return { outcome: 'failed', reason: FAILURE_REASONS[tx.status] };
  }
  // 'ongoing', 'pending', 'processing', 'queued'...: still not finished.
  return { outcome: 'pending' };
}

module.exports = { confirmPayment };
