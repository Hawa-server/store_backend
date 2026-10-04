/*
 * validators/admin.validators.js
 *
 * Zod schemas for the admin dashboard and settings (BE20).
 */
const { z } = require('zod');
const { blankToUndefined } = require('./common.validators');

// GET /api/admin/dashboard?period=  (default 7d)
const dashboardQuery = z.object({
  period: z.preprocess(
    blankToUndefined,
    z.enum(['today', '7d', '30d', 'all'], { error: 'Period must be today, 7d, 30d or all.' }).default('7d')
  ),
});

// PATCH /api/admin/settings/low-stock-threshold  { "value": 5 }
// A real JSON whole number (not "5" or 2.5) from 0 to 1,000.
const thresholdBody = z.object({
  value: z
    .number({ error: 'The threshold must be a number.' })
    .int({ error: 'The threshold must be a whole number.' })
    .min(0, { error: 'The threshold must be from 0 to 1,000.' })
    .max(1000, { error: 'The threshold must be from 0 to 1,000.' }),
});

module.exports = { dashboardQuery, thresholdBody };
