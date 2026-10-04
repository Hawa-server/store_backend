/*
 * controllers/webhook.controller.js
 *
 * Receives Paystack's webhooks: messages Paystack's servers send to us when
 * something happens to a payment (e.g. "charge.success"). This is the third
 * layer of payment confirmation: even if the shopper closes the browser before
 * our verify call, Paystack still tells us, and the order is still created.
 *
 * Security: ANYONE on the internet can send a request to this URL. So before
 * trusting anything, we check the signature: Paystack signs every webhook
 * with our secret key (HMAC SHA512 of the raw body, sent in the
 * x-paystack-signature header). Only Paystack and we know that key.
 */
const crypto = require('crypto');
const { PaymentEvent } = require('../models');
const AppError = require('../utils/AppError');
const paymentService = require('../services/payment/payment.service');

/*
 * hasValidSignature(req)
 * Receives: the Express request (needs req.rawBody, kept by express.json in app.js).
 * Returns: true only if the x-paystack-signature header matches our own HMAC
 *          of the exact raw bytes that were received.
 */
function hasValidSignature(req) {
  const signature = req.get('x-paystack-signature');
  if (!req.rawBody || !signature) return false;

  // Recalculate the signature ourselves from the RAW bytes. Parsed-then-
  // re-encoded JSON could differ by a single space and fail the check.
  const expected = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(req.rawBody).digest('hex');

  // timingSafeEqual compares in constant time, so an attacker can't learn the
  // correct signature character by character from how fast we reply.
  // It needs two buffers of equal length, so check the length first.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/*
 * processEvent(eventRow, event)
 * Runs AFTER we've already replied 200 to Paystack.
 * Receives: the saved PaymentEvent row and the parsed webhook body.
 * Returns: nothing. Records what happened in the PaymentEvent (processedAt,
 *          outcome). Never throws; errors are logged and recorded.
 */
async function processEvent(eventRow, event) {
  let outcome;
  try {
    if (event.event === 'charge.success' && eventRow.reference) {
      // The SAME function the verify endpoint uses. It asks Paystack's API
      // again and checks amount/currency, rather than trusting the webhook
      // body. Duplicates are harmless: the second call finds the order made.
      const result = await paymentService.confirmPayment(eventRow.reference);
      // e.g. 'fulfilled', or 'refunded (duplicate)' so the log says why.
      outcome = result.kind ? `${result.outcome} (${result.kind})` : result.outcome;
    } else {
      outcome = 'ignored';
    }
  } catch (err) {
    console.error(`[webhook] processing ${eventRow.eventType} for ${eventRow.reference} failed:`, err.message);
    outcome = `error: ${err.message}`.slice(0, 100);
  }
  await eventRow.update({ processedAt: new Date(), outcome }).catch((err) => {
    console.error('[webhook] could not record outcome:', err.message);
  });
}

/*
 * POST /api/webhooks/paystack
 * Receives: a webhook from Paystack.
 * Returns: 401 if the signature is missing or wrong (nothing is recorded).
 *          Otherwise records the event, replies 200 straight away (Paystack
 *          retries if we're slow), then processes it in the background.
 */
async function paystackWebhook(req, res) {
  if (!hasValidSignature(req)) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid signature.');
  }

  const event = req.body || {};
  const data = event.data || {};
  // Record only what we need to troubleshoot: never card or wallet details.
  const eventRow = await PaymentEvent.create({
    provider: 'paystack',
    eventType: String(event.event || 'unknown').slice(0, 50),
    reference: typeof data.reference === 'string' ? data.reference.slice(0, 100) : null,
    receivedAt: new Date(),
  });

  res.status(200).json({ received: true });

  // Process after replying, so Paystack never waits for our database work.
  setImmediate(() => processEvent(eventRow, event));
}

module.exports = { paystackWebhook };
