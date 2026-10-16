/*
 * services/discount/discount.service.js
 *
 * The rules for discount codes (BE29), in ONE place, used by the preview
 * (POST /api/discounts/check) and by checkout (which checks again: the
 * preview reserves nothing). The server decides everything: whether a code
 * is valid, how much it takes off, and the final total. Nothing about money
 * sent by the browser is used.
 *
 * Money is whole pesewas, and the maths uses whole numbers only.
 * The discount applies to the products' subtotal ONLY, never to delivery:
 *   total = subtotal − discount + deliveryFee   (so total ≥ deliveryFee)
 */
const { DiscountCode, DiscountRedemption } = require('../../models');
const AppError = require('../../utils/AppError');
const { formatGhs } = require('../../utils/money');

/*
 * normalizeCode(text) / normalizeEmail(email)
 * Codes are stored upper-case and emails lower-case, both trimmed, so
 * "adorn10 " = "ADORN10" and "Ama@Test.com " = "ama@test.com" everywhere
 * (checkouts, orders and redemptions all use the same form).
 */
const normalizeCode = (text) => String(text).trim().toUpperCase();
const normalizeEmail = (email) => String(email).trim().toLowerCase();

/*
 * calculateDiscount(code, subtotal)
 * Receives: a DiscountCode and the products' subtotal in pesewas.
 * Returns: the discount in whole pesewas, never more than the subtotal.
 *   percent: floor(subtotal × percent ÷ 100), then capped by maxDiscountPesewas.
 *            Multiplying BEFORE dividing keeps it exact: 15% of 10001 pesewas
 *            = floor(150015 / 100) = 1500 (the shopper never gets a fraction).
 *   fixed:   the amount, but at most the subtotal (products can't go below 0).
 */
function calculateDiscount(code, subtotal) {
  let discount;
  if (code.type === 'percent') {
    discount = Math.floor((subtotal * code.value) / 100);
    if (code.maxDiscountPesewas !== null && code.maxDiscountPesewas !== undefined) {
      discount = Math.min(discount, code.maxDiscountPesewas);
    }
  } else {
    discount = code.value;
  }
  return Math.min(discount, subtotal);
}

/*
 * describe(code, discount)
 * Receives: a DiscountCode and the discount it gives.
 * Returns: the message shown to the shopper, e.g. "20% off: you save GHS 24.00".
 */
function describe(code, discount) {
  const what = code.type === 'percent' ? `${code.value}% off` : `${formatGhs(code.value)} off`;
  return `${what}: you save ${formatGhs(discount)}`;
}

/*
 * statusOf(code, now)
 * Receives: a DiscountCode and the current time.
 * Returns: 'off' | 'scheduled' | 'expired' | 'used_up' | 'active', in that order
 *          of priority (an expired code that was also switched off shows "off").
 *          Only 'active' codes can be used. Shared by the admin list (BE29)
 *          and the announcement bar (BE30), so they always agree.
 */
function statusOf(code, now = new Date()) {
  if (!code.isActive) return 'off';
  if (code.startsAt && now < code.startsAt) return 'scheduled';
  if (code.endsAt && now >= code.endsAt) return 'expired';
  if (code.usageLimit !== null && code.timesUsed >= code.usageLimit) return 'used_up';
  return 'active';
}

/*
 * invalid(message)
 * Receives: the reason to show. Returns: the 400 DISCOUNT_INVALID error.
 */
function invalid(message) {
  return new AppError(400, 'DISCOUNT_INVALID', message);
}

/*
 * checkCode(text, subtotal, { email, transaction })
 * Receives: the code as typed, the products' subtotal (pesewas), and the
 *           shopper's email if known (checkout always knows it; the preview
 *           knows it only for logged-in shoppers).
 * Returns: { code (the DiscountCode), discount (pesewas), message }.
 * Throws: 400 DISCOUNT_INVALID with ONE clear reason, checked in this order:
 *   unknown or switched off → "This code isn't valid." (the same answer, so
 *     guessing can't tell a switched-off code from one that never existed);
 *   not started / ended; under the minimum; used up; already used by this email.
 */
async function checkCode(text, subtotal, { email, transaction } = {}) {
  const code = await DiscountCode.findOne({ where: { code: normalizeCode(text) }, transaction });
  if (!code || !code.isActive) throw invalid("This code isn't valid.");

  const now = new Date();
  if (code.startsAt && now < code.startsAt) throw invalid("This code isn't active yet.");
  if (code.endsAt && now >= code.endsAt) throw invalid('This code has expired.');
  if (code.minSubtotalPesewas && subtotal < code.minSubtotalPesewas) {
    throw invalid(`Spend ${formatGhs(code.minSubtotalPesewas)} or more to use this code.`);
  }
  if (code.usageLimit !== null && code.timesUsed >= code.usageLimit) throw invalid('This code has reached its limit.');
  if (code.oncePerCustomer && email) {
    const used = await DiscountRedemption.findOne({
      where: { discountCodeId: code.id, email: normalizeEmail(email) },
      attributes: ['id'],
      transaction,
    });
    if (used) throw invalid("You've already used this code.");
  }

  const discount = calculateDiscount(code, subtotal);
  return { code, discount, message: describe(code, discount) };
}

module.exports = { normalizeCode, normalizeEmail, calculateDiscount, checkCode, describe, statusOf };
