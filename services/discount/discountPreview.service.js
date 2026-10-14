/*
 * services/discount/discountPreview.service.js
 *
 * "Does this code work, and how much would I save?" (BE29), for the code box
 * on the cart / checkout page. It checks the code against the shopper's
 * CURRENT cart and only PREVIEWS: nothing is reserved, and checkout checks
 * everything again (prices, stock, and the code) when the shopper pays.
 * (A separate file from discount.service.js, because it needs the cart and
 * checkout services, which themselves use discount.service.js.)
 */
const cartService = require('../cart/cart.service');
const { priceCart } = require('../checkout/checkout.service');
const { checkCode } = require('./discount.service');
const { getUsdRate } = require('../settings/settings.service');
const { toUsdCents } = require('../../utils/currency');

/*
 * previewDiscount({ user, guestToken, code })
 * Receives: the logged-in user (or null), the guest cart token (or null),
 *           and the code as typed.
 * Returns: { code, discountGhs, discountUsd, subtotalGhs, message }.
 * Throws: 400 "Your cart is empty."; 409 OUT_OF_STOCK (as at checkout);
 *         400 DISCOUNT_INVALID with the reason. For a logged-in shopper,
 *         "already used" is checked with their account email; guests only
 *         find out at checkout, where the email is known.
 */
async function previewDiscount({ user, guestToken, code }) {
  const cart = await cartService.findCart({ user, guestToken });
  const { lines, subtotal } = await priceCart(cart);
  const result = await checkCode(code, subtotal, { email: user ? user.email : null });

  // USD (display only), the same way checkout works it out: unit prices first.
  const { pesewasPerUsd } = await getUsdRate();
  const subtotalUsd = lines.reduce((sum, line) => sum + toUsdCents(line.unitPrice, pesewasPerUsd) * line.quantity, 0);
  return {
    code: result.code.code,
    discountGhs: result.discount,
    discountUsd: Math.min(toUsdCents(result.discount, pesewasPerUsd), subtotalUsd),
    subtotalGhs: subtotal,
    message: result.message,
  };
}

module.exports = { previewDiscount };
