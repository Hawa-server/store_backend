/*
 * routes/checkout.routes.js
 *
 * Checkout URLs, mounted at /api/checkout in app.js. Guests and logged-in
 * shoppers can both check out (optionalAuth). Rate-limited, because every
 * checkout calls Paystack.
 */
const express = require('express');
const controller = require('../controllers/checkout.controller');
const validate = require('../middleware/validate');
const optionalAuth = require('../middleware/optionalAuth');
const { checkoutLimiter, verifyPaymentLimiter } = require('../middleware/rateLimits');
const { checkoutBody, verifyBody } = require('../validators/checkout.validators');

const router = express.Router();

router.post('/', checkoutLimiter, optionalAuth, validate({ body: checkoutBody }), controller.startCheckout);
// No login needed: guests pay too. The unguessable reference identifies the payment.
router.post('/verify', verifyPaymentLimiter, validate({ body: verifyBody }), controller.verifyPayment);

module.exports = router;
