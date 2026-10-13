/*
 * validators/common.validators.js
 *
 * Small Zod building blocks shared by several validators files, so the same
 * rule (e.g. "what's a valid page number?") is written once.
 */
const { z } = require('zod');

// An empty query value (e.g. "?status=&page=") means "not given". Forms and
// URL builders often send empty values, so treat them as missing, not invalid.
const blankToUndefined = (value) => (value === '' ? undefined : value);

// ?page=2. Optional, defaults to 1. Query values arrive as text, so coerce.
const page = z.preprocess(
  blankToUndefined,
  z.coerce
    .number({ error: 'Page must be a number.' })
    .int({ error: 'Page must be a whole number.' })
    .min(1, { error: 'Page must be 1 or more.' })
    .max(100000, { error: 'Page is too large.' })
    .default(1)
);

// A public id (BE26): the random UUID that orders and products show instead
// of the database's counting number. A valid UUID passes through (trimmed,
// lower-cased); ANYTHING else (an old number like "9", "abc"...) becomes null
// instead of failing here. The lookup then finds nothing and the answer is
// the usual 404 ("Order not found." / "Product not found."), the same as for
// an id that doesn't exist. A 400 "must be a UUID" would hint at what real
// ids look like.
const publicId = z
  .string()
  .transform((value) => (z.uuid().safeParse(value.trim()).success ? value.trim().toLowerCase() : null));

module.exports = { blankToUndefined, page, publicId };
