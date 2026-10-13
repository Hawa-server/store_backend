/*
 * validators/cart.validators.js
 *
 * Zod schemas for the cart endpoints. Bodies only ever contain a product id
 * and/or a quantity: never a cart id, price or total, which the server works out.
 */
const { z } = require('zod');
const { publicId } = require('./common.validators');

/*
 * quantity(min)
 * Receives: the smallest allowed quantity (1 when adding, 0 when changing,
 *           because 0 means "remove this line").
 * Returns: a Zod schema for a real JSON whole number from `min` to 99. This
 *          rejects negatives, decimals like 1.5, and text like "2" or "abc".
 */
function quantity(min) {
  return z
    .number({ error: 'Quantity must be a number.' })
    .int({ error: 'Quantity must be a whole number.' })
    .min(min, { error: `Quantity must be at least ${min}.` })
    .max(99, { error: 'You can add up to 99 of this product.' });
}

// POST /api/cart/items
// productId is the product's public UUID (the `id` from GET /api/products).
// A missing one is a 400; anything that isn't a UUID becomes null and gets
// the same 404 "Product not found." as an unknown product.
const addItemBody = z.object({
  // An old numeric id (12) is turned into text first, so it gets the 404 too.
  productId: z.preprocess(
    (value) => (typeof value === 'number' ? String(value) : value),
    z.string({ error: 'Product id is required.' }).pipe(publicId)
  ),
  quantity: quantity(1),
});

// PATCH and DELETE /api/cart/items/:id. The id is the cart LINE id. URL
// parameters arrive as text, so "12" is coerced to the number 12 first.
const cartItemParams = z.object({
  id: z.coerce
    .number({ error: 'Cart item id must be a number.' })
    .int({ error: 'Cart item id must be a whole number.' })
    .positive({ error: 'Cart item id must be a positive number.' }),
});

// PATCH /api/cart/items/:id
const updateItemBody = z.object({ quantity: quantity(0) });

module.exports = { addItemBody, cartItemParams, updateItemBody };
