/*
 * utils/money.js
 *
 * Turns whole pesewas into text people read, e.g. 317000 → "GHS 3,170.00".
 * Used for emails and messages only: all money is STORED and CALCULATED as
 * whole pesewas, and this never changes an amount.
 */

/*
 * formatGhs(pesewas)
 * Receives: an amount in whole pesewas (an integer).
 * Returns: a string like "GHS 3,170.00".
 * Uses whole-number maths (division and remainder), never floating point, so
 * the digits shown are always exact.
 */
function formatGhs(pesewas) {
  const cedis = Math.floor(pesewas / 100);
  const rest = String(pesewas % 100).padStart(2, '0');
  return `GHS ${cedis.toLocaleString('en-GB')}.${rest}`;
}

module.exports = { formatGhs };
