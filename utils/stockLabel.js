/*
 * utils/stockLabel.js
 *
 * The stock message shoppers see on product pages. It always uses 5 as the
 * "low" cut-off; this is separate from the admin low-stock threshold (BE20),
 * which admins can change.
 */
const SHOPPER_LOW_STOCK = 5;

/*
 * stockLabel(stock)
 * Receives: the number of units in stock.
 * Returns: "Out of stock", "Only X left" (1–5), or "In stock" (more than 5).
 */
function stockLabel(stock) {
  if (stock <= 0) return 'Out of stock';
  if (stock <= SHOPPER_LOW_STOCK) return `Only ${stock} left`;
  return 'In stock';
}

module.exports = stockLabel;
