/*
 * validators/review.validators.js
 *
 * Zod schemas for reviews (BE18).
 */
const { z } = require('zod');
const { blankToUndefined, page } = require('./common.validators');

// A real JSON whole number from 1 to 5 (not "5", not 4.5).
const rating = z
  .number({ error: 'Rating must be a number from 1 to 5.' })
  .int({ error: 'Rating must be a whole number from 1 to 5.' })
  .min(1, { error: 'Rating must be from 1 to 5.' })
  .max(5, { error: 'Rating must be from 1 to 5.' });

// Optional text, up to 1,000 characters. Blank text is stored as null.
const text = z
  .string({ error: 'Review text must be text.' })
  .trim()
  .max(1000, { error: 'Your review must be 1,000 characters or fewer.' })
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

// GET /api/products/:id/reviews?sort=&page=
const listReviewsQuery = z.object({
  sort: z.preprocess(
    blankToUndefined,
    z.enum(['recent', 'highest', 'lowest'], { error: 'Sort must be recent, highest or lowest.' }).default('recent')
  ),
  page,
});

// POST /api/products/:id/reviews
const createReviewBody = z.object({ rating, text });

// PATCH /api/reviews/:id: change the rating, the text, or both.
const updateReviewBody = z
  .object({ rating: rating.optional(), text })
  .refine((body) => body.rating !== undefined || body.text !== undefined, {
    error: 'Send a new rating or text.',
    path: ['rating'],
  });

// /api/reviews/:id
const reviewIdParams = z.object({
  id: z.coerce
    .number({ error: 'Review id must be a number.' })
    .int({ error: 'Review id must be a whole number.' })
    .positive({ error: 'Review id must be a positive number.' }),
});

// --- Admin moderation (BE19) ---

// GET /api/admin/reviews?status=visible|hidden&page=  (no status = all)
const adminReviewsQuery = z.object({
  status: z.preprocess(
    blankToUndefined,
    z.enum(['visible', 'hidden'], { error: 'Status must be visible or hidden.' }).optional()
  ),
  page,
});

const reasonText = z
  .string({ error: 'A reason is required.' })
  .trim()
  .min(1, { error: 'A reason is required.' })
  .max(200, { error: 'The reason must be 200 characters or fewer.' });

// PATCH …/hide and DELETE: a reason is required.
const moderationReasonBody = z.object({ reason: reasonText });

// PATCH …/unhide: a reason is optional (it's recorded in the log if given).
const unhideBody = z.object({ reason: reasonText.optional() });

module.exports = {
  listReviewsQuery,
  createReviewBody,
  updateReviewBody,
  reviewIdParams,
  adminReviewsQuery,
  moderationReasonBody,
  unhideBody,
};
