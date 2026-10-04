/*
 * validators/order.validators.js
 *
 * Zod schemas for the order endpoints (shopper and admin).
 */
const { z } = require('zod');
const { blankToUndefined, page } = require('./common.validators');

const ORDER_STATUSES = ['Pending', 'Shipped', 'Delivered', 'Cancelled'];

// A confirmation token is exactly what utils/tokens.js createRandomToken()
// makes: 64 lowercase hex characters (32 random bytes).
const confirmationToken = z.string().regex(/^[a-f0-9]{64}$/);

// A calendar date 'YYYY-MM-DD' that really exists (no 2026-02-30).
const calendarDate = (label) =>
  z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { error: `${label} must be a date like 2026-09-30.` })
      .refine(
        (value) => {
          const [y, m, d] = value.split('-').map(Number);
          const date = new Date(Date.UTC(y, m - 1, d));
          return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
        },
        { error: `${label} is not a real date.` }
      )
      .optional()
  );

// GET /api/orders?page=
const myOrdersQuery = z.object({ page });

// GET /api/orders/:id and /api/admin/orders/:id
const orderIdParams = z.object({
  id: z.coerce
    .number({ error: 'Order id must be a number.' })
    .int({ error: 'Order id must be a whole number.' })
    .positive({ error: 'Order id must be a positive number.' }),
});

// GET /api/admin/orders?status=&from=&to=&page=
// from/to are days in Ghana time, both included. 'YYYY-MM-DD' strings compare
// correctly as text, so "to before from" is a simple comparison.
const adminOrdersQuery = z
  .object({
    status: z.preprocess(
      blankToUndefined,
      z.enum(ORDER_STATUSES, { error: `Status must be one of: ${ORDER_STATUSES.join(', ')}.` }).optional()
    ),
    from: calendarDate('From date'),
    to: calendarDate('To date'),
    page,
  })
  .refine((q) => !q.from || !q.to || q.to >= q.from, {
    error: 'The end date must be on or after the start date.',
    path: ['to'],
  });

// PATCH /api/admin/orders/:id/status. Shipped and Delivered go through the
// status service (BE15); Cancelled goes through the cancellation service (BE16).
const statusChangeBody = z.object({
  status: z.enum(['Shipped', 'Delivered', 'Cancelled'], { error: 'Status must be Shipped, Delivered or Cancelled.' }),
});

module.exports = { confirmationToken, myOrdersQuery, orderIdParams, adminOrdersQuery, statusChangeBody };
