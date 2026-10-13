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

// GET /api/orders/:id, POST /api/orders/:id/cancel and the /api/admin/orders/:id
// routes. Since BE26 :id is the order's public id, a UUID such as
// "3f2a9c1e-7b4d-4e8a-9f01-6c2d5e8b7a43", never the database's counting number.
// Anything that isn't a UUID (an old number like "9", "abc"...) becomes null
// instead of failing here: the lookup then finds nothing and the answer is the
// same 404 "Order not found." as for a missing order. A 400 "must be a UUID"
// would hint at what real ids look like.
const orderPublicId = z
  .string()
  .transform((value) => (z.uuid().safeParse(value.trim()).success ? value.trim().toLowerCase() : null));
const orderIdParams = z.object({ id: orderPublicId });

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

module.exports = { confirmationToken, myOrdersQuery, orderIdParams, orderPublicId, adminOrdersQuery, statusChangeBody };
