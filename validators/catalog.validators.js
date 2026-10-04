/*
 * validators/catalog.validators.js
 *
 * Zod schemas for the public browsing endpoints (/api/categories, /api/products).
 */
const { z } = require('zod');

// GET /api/products?category=<slug>. The category is optional; a slug is
// lowercase letters, numbers and dashes (e.g. "bags").
const productListQuery = z.object({
  category: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,50}$/, { error: 'Category must be a valid category slug, e.g. "bags".' })
    .optional(),
});

// GET /api/products/:id. URL parameters always arrive as text, so coerce
// "12" to the number 12, then insist on a positive whole number.
const productIdParams = z.object({
  id: z.coerce
    .number({ error: 'Product id must be a number.' })
    .int({ error: 'Product id must be a whole number.' })
    .positive({ error: 'Product id must be a positive number.' }),
});

module.exports = { productListQuery, productIdParams };
