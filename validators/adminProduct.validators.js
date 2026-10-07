/*
 * validators/adminProduct.validators.js
 *
 * Zod schemas for admin product management (BE23): the list filters, and
 * the bodies for adding and editing a product.
 *
 * Rules worth knowing:
 *   - Money is whole pesewas (12000 = GH₵ 120.00); numbers must be real JSON
 *     numbers, never text like "12000".
 *   - Images must be ImageKit addresses: we never store photos from elsewhere.
 *   - Unknown fields are dropped by Zod, so a request can't sneak in fields
 *     like "id" or "createdAt" (mass assignment).
 */
const { z } = require('zod');
const { blankToUndefined, page } = require('./common.validators');

const IMAGEKIT_PREFIX = 'https://ik.imagekit.io/';

// GET /api/admin/products?search=&category=&status=&page=
const adminProductsQuery = z.object({
  search: z.preprocess(
    blankToUndefined,
    z.string().trim().max(100, { error: 'Search must be 100 characters or fewer.' }).optional()
  ),
  category: z.preprocess(
    blankToUndefined,
    z.string().trim().regex(/^[a-z0-9-]{1,50}$/, { error: 'Category must be a valid category slug, e.g. "bags".' }).optional()
  ),
  status: z.preprocess(
    blankToUndefined,
    z.enum(['active', 'inactive'], { error: 'Status must be active or inactive.' }).optional()
  ),
  page,
});

/*
 * withoutUpdatedAt(url)
 * Receives: an image address.
 * Returns: the same address without ImageKit's "?updatedAt=…" part (added
 *          when you copy a link from the ImageKit website). Other parts stay.
 */
function withoutUpdatedAt(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('updatedAt');
    return parsed.toString();
  } catch {
    return url; // not a valid address: the prefix check below rejects it
  }
}

// The product's main image: an ImageKit address plus a description of the photo.
const image = z.object(
  {
    url: z
      .string({ error: 'Use an image address from the store\'s ImageKit.' })
      .trim()
      .transform(withoutUpdatedAt)
      .refine((url) => url.startsWith(IMAGEKIT_PREFIX) && url.length <= 500, {
        error: 'Use an image address from the store\'s ImageKit.',
      }),
    altText: z
      .string({ error: 'Describe the photo (up to 200 characters).' })
      .trim()
      .min(1, { error: 'Describe the photo (up to 200 characters).' })
      .max(200, { error: 'Describe the photo (up to 200 characters).' }),
  },
  { error: 'Add the main image: its ImageKit address and a description.' }
);

const name = z
  .string({ error: 'Enter a product name.' })
  .trim()
  .min(2, { error: 'The name must be 2–150 characters.' })
  .max(150, { error: 'The name must be 2–150 characters.' });

const description = z
  .string({ error: 'Enter a description.' })
  .trim()
  .min(1, { error: 'Enter a description.' })
  .max(2000, { error: 'The description must be 2,000 characters or fewer.' });

const categoryId = z
  .number({ error: 'Choose a category.' })
  .int({ error: 'Choose a category.' })
  .positive({ error: 'Choose a category.' });

// Whole pesewas, from 1 (GH₵ 0.01) to 100,000,000 (GH₵ 1,000,000).
const priceGhs = z
  .number({ error: 'Enter a price greater than 0.' })
  .int({ error: 'The price must be a whole number of pesewas.' })
  .min(1, { error: 'Enter a price greater than 0.' })
  .max(100000000, { error: 'The price can be at most GH₵ 1,000,000 (100000000 pesewas).' });

const stock = z
  .number({ error: 'Enter a whole number from 0 to 100,000.' })
  .int({ error: 'Enter a whole number from 0 to 100,000.' })
  .min(0, { error: 'Enter a whole number from 0 to 100,000.' })
  .max(100000, { error: 'Enter a whole number from 0 to 100,000.' });

const isActive = z.boolean({ error: 'isActive must be true or false.' });

// POST /api/admin/products
const createProductBody = z.object({
  name,
  description,
  categoryId,
  priceGhs,
  stock,
  isActive: isActive.default(true),
  image,
});

// The fields an edit can change (expectedStock is a check, not a change).
const EDITABLE = ['name', 'description', 'categoryId', 'priceGhs', 'stock', 'isActive', 'image'];

// PATCH /api/admin/products/:id
const updateProductBody = z
  .object({
    name: name.optional(),
    description: description.optional(),
    categoryId: categoryId.optional(),
    priceGhs: priceGhs.optional(),
    stock: stock.optional(),
    isActive: isActive.optional(),
    image: image.optional(),
    // The stock the admin saw when they opened the product (see the service).
    expectedStock: z
      .number({ error: 'expectedStock must be a whole number.' })
      .int({ error: 'expectedStock must be a whole number.' })
      .min(0, { error: 'expectedStock must be a whole number.' })
      .optional(),
  })
  .superRefine((body, ctx) => {
    if (!EDITABLE.some((field) => body[field] !== undefined)) {
      ctx.addIssue({ code: 'custom', path: ['_'], message: 'Send at least one field to change.' });
    }
    if (body.stock !== undefined && body.expectedStock === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['expectedStock'],
        message: 'Send expectedStock (the stock you saw when you opened the product) when changing stock.',
      });
    }
  });

module.exports = { adminProductsQuery, createProductBody, updateProductBody, EDITABLE };
