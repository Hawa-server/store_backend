/*
 * routes/discounts.routes.js
 *
 * Discount code preview (BE29), mounted at /api/discounts in app.js.
 * Guests and logged-in shoppers (optionalAuth). Rate-limited per IP, so
 * nobody can try thousands of codes to guess one.
 */
const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/discount.controller');
const validate = require('../middleware/validate');
const optionalAuth = require('../middleware/optionalAuth');
const { discountCheckLimiter } = require('../middleware/rateLimits');

const router = express.Router();

// Only the shape is checked here; the rules live in discount.service.js.
const checkBody = z.object({
  code: z
    .string({ error: 'Enter a discount code.' })
    .trim()
    .min(1, { error: 'Enter a discount code.' })
    .max(50, { error: "This code isn't valid." }),
});

router.post('/check', discountCheckLimiter, optionalAuth, validate({ body: checkBody }), controller.check);

module.exports = router;
