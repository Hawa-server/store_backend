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

module.exports = { blankToUndefined, page };
