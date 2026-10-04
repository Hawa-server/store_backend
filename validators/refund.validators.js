/*
 * validators/refund.validators.js
 *
 * Zod schemas for admin refunds (BE17).
 */
const { z } = require('zod');

const positiveId = (label) =>
  z.coerce
    .number({ error: `${label} must be a number.` })
    .int({ error: `${label} must be a whole number.` })
    .positive({ error: `${label} must be a positive number.` });

// POST /api/admin/orders/:id/refunds
// amount is pesewas, as a real JSON whole number (not "100" or 1.5), and is
// only used for partial refunds: a full refund always means "everything left".
const issueRefundBody = z
  .object({
    type: z.enum(['full', 'partial'], { error: 'Type must be "full" or "partial".' }),
    amount: z
      .number({ error: 'Amount must be a number of pesewas.' })
      .int({ error: 'Amount must be a whole number of pesewas.' })
      .positive({ error: 'Amount must be more than 0.' })
      .optional(),
    reason: z
      .string({ error: 'A reason is required.' })
      .trim()
      .min(1, { error: 'A reason is required.' })
      .max(200, { error: 'The reason must be 200 characters or fewer.' }),
  })
  .superRefine((body, ctx) => {
    if (body.type === 'partial' && body.amount === undefined) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Enter the amount to refund, in pesewas.' });
    }
  })
  .transform((body) => (body.type === 'full' ? { type: body.type, reason: body.reason } : body));

// POST /api/admin/orders/:id/refunds/:refundId/retry
const refundParams = z.object({ id: positiveId('Order id'), refundId: positiveId('Refund id') });

module.exports = { issueRefundBody, refundParams };
