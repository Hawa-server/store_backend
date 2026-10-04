/*
 * controllers/checkout.controller.js
 *
 * Handles the HTTP side of /api/checkout:
 *   - starting a checkout (payment) for the current cart;
 *   - verifying a payment afterwards and returning the order.
 */
const checkoutService = require('../services/checkout/checkout.service');
const paymentService = require('../services/payment/payment.service');
const AppError = require('../utils/AppError');
const { formatGhs } = require('../utils/money');
const { readGuestCartToken } = require('../utils/guestCartCookie');

// What the shopper sees when no money was taken (BE10). The `reason` is also
// sent, so the frontend can react without reading the text.
const FAILED_MESSAGES = {
  declined:
    'Your payment was declined. This can happen with a wrong PIN or not enough money in your wallet. Please try again.',
  not_completed: "Your payment wasn't completed. It may have timed out. Please try again.",
  reversed: 'Your payment was reversed, so no order was placed. Please try again.',
  closed: 'Your payment was not successful. Please try again.',
};

/*
 * POST /api/checkout
 * Receives: req.valid.body = { name, email, phone, address }, plus req.user
 *           (or null) and the guest cart cookie.
 * Returns: 201 { checkout } with the Paystack reference, access code,
 *          payment page URL and the server-calculated amounts.
 */
async function startCheckout(req, res) {
  const checkout = await checkoutService.startCheckout({
    user: req.user,
    guestToken: readGuestCartToken(req),
    details: req.valid.body,
  });
  res.status(201).json({ checkout });
}

/*
 * POST /api/checkout/verify
 * Receives: req.valid.body = { reference }.
 * Returns: 200 { order } once the payment is confirmed (the same order every
 *          time it's called again), or an error explaining what happened.
 *          Paystack statuses become clear HTTP answers here.
 */
async function verifyPayment(req, res) {
  let result;
  try {
    result = await paymentService.confirmPayment(req.valid.body.reference);
  } catch (err) {
    // Paystack couldn't be reached or answered with an error. Nothing was
    // changed on our side, so asking again later is safe.
    console.error('[payment] verify failed:', err.message);
    throw new AppError(503, 'SERVER_ERROR', "We couldn't confirm your payment right now. Please try again.");
  }

  switch (result.outcome) {
    case 'fulfilled':
    case 'already_fulfilled': {
      const { order } = result;
      return res.json({
        order: {
          orderNumber: order.orderNumber,
          confirmationToken: order.confirmationToken,
          status: order.status,
          totalGhs: order.total,
        },
      });
    }
    case 'pending':
      // 202 "Accepted": the request is fine, but the payment isn't finished yet.
      return res.status(202).json({
        error: { code: 'PAYMENT_PENDING', message: 'Your payment is still being processed. Please wait a moment.' },
      });
    case 'refunded': {
      // Paid, but no order: the full amount is being refunded (see payment.service.js).
      const refundNote = `Your payment of ${formatGhs(
        result.refund.amount
      )} will be refunded to your mobile money wallet, usually within a few business days.`;
      if (result.kind === 'duplicate') {
        // A late second payment for a cart that was already ordered (BE10).
        throw new AppError(409, 'CONFLICT', `You already paid for this order with another payment. ${refundNote}`);
      }
      // The item sold out before this payment was confirmed (BE9).
      throw new AppError(
        409,
        'OUT_OF_STOCK',
        `Sorry, an item in your order sold out before your payment was confirmed. ${refundNote}`
      );
    }
    case 'failed':
      throw new AppError(402, 'PAYMENT_FAILED', FAILED_MESSAGES[result.reason], undefined, { reason: result.reason });
    case 'mismatch':
      throw new AppError(402, 'PAYMENT_FAILED', "We couldn't confirm your payment. Please contact us.");
    default: // 'unknown_reference'
      throw new AppError(404, 'NOT_FOUND', 'Payment not found.');
  }
}

module.exports = { startCheckout, verifyPayment };
