/*
 * validators/catalog.validators.js
 *
 * Zod schemas for the public browsing endpoints (/api/categories, /api/products).
 */
const { z } = require('zod');
const { publicId } = require('./common.validators');

// GET /api/products?category=<slug>. The category is optional; a slug is
// lowercase letters, numbers and dashes (e.g. "bags").
const productListQuery = z.object({
  category: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,50}$/, { error: 'Category must be a valid category slug, e.g. "bags".' })
    .optional(),
});

// GET /api/products/:id (and its reviews, and /api/admin/products/:id).
// :id is the product's public UUID, never the database's counting number.
// Anything that isn't a UUID becomes null, and the lookup answers the usual
// 404 "Product not found." (see common.validators.js publicId).
const productIdParams = z.object({ id: publicId });

module.exports = { productListQuery, productIdParams };
