/*
 * controllers/discount.controller.js
 *
 * Handles the HTTP side of POST /api/discounts/check (BE29).
 */
const { previewDiscount } = require('../services/discount/discountPreview.service');
const { readGuestCartToken } = require('../utils/guestCartCookie');

/*
 * POST /api/discounts/check
 * Receives: req.valid.body = { code }, req.user (or null, optionalAuth) and
 *           the guest cart cookie.
 * Returns: 200 { discount: { code, discountGhs, discountUsd, subtotalGhs, message } },
 *          or 400 DISCOUNT_INVALID with the reason.
 */
async function check(req, res) {
  const discount = await previewDiscount({ user: req.user, guestToken: readGuestCartToken(req), code: req.valid.body.code });
  res.json({ discount });
}

module.exports = { check };
