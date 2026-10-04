/*
 * utils/currency.js
 *
 * Converting GHS (what we charge) into USD (shown only as a guide, BE13).
 * Every amount is a whole number: GHS in pesewas, USD in cents. The maths
 * uses integers only, so there are no floating-point surprises like
 * 0.1 + 0.2 = 0.30000000000000004.
 */

/*
 * toUsdCents(pesewas, pesewasPerUsd)
 * Receives: a GHS amount in whole pesewas, and the rate as whole pesewas per
 *           1 US dollar (usdRate 15.50 → 1550).
 * Returns: the USD amount in whole cents, rounded to the NEAREST cent (a half
 *          cent rounds up).
 *   cents = pesewas × 100 / pesewasPerUsd
 * Rounding with integers only: adding half the divisor before dividing and
 * dropping the remainder is the same as rounding to the nearest whole number.
 *   e.g. 35000 pesewas (GHS 350.00) → 3,500,000 / 1550 = 2258.06… → 2258 cents (US$ 22.58)
 */
function toUsdCents(pesewas, pesewasPerUsd) {
  return Math.floor((pesewas * 200 + pesewasPerUsd) / (2 * pesewasPerUsd));
}

module.exports = { toUsdCents };
