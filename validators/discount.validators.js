/*
 * validators/discount.validators.js
 *
 * Zod schemas for the admin discount code endpoints (BE29). Each field's
 * shape is checked here; rules that depend on SEVERAL fields (e.g. a percent
 * must be 1–90 but a fixed amount 100–100,000 pesewas) are checked in
 * adminDiscount.service.js, because an edit may change only one of them.
 *
 * Money is whole pesewas, sent as real JSON numbers.
 * Dates are Ghana calendar days, 'YYYY-MM-DD' (both ends included).
 */
const { z } = require('zod');
const { blankToUndefined, page } = require('./common.validators');

const STATUSES = ['active', 'scheduled', 'expired', 'used_up', 'off'];

// "adorn10 " → "ADORN10". Letters and digits only, so codes are easy to type.
const code = z
  .string({ error: 'Enter a code of 3–20 letters and numbers.' })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{3,20}$/, { error: 'Enter a code of 3–20 letters and numbers.' });

const wholeNumber = (label, min, max) =>
  z
    .number({ error: `${label} must be a whole number.` })
    .int({ error: `${label} must be a whole number.` })
    .min(min, { error: `${label} must be from ${min} to ${max}.` })
    .max(max, { error: `${label} must be from ${min} to ${max}.` });

// A real calendar day, e.g. '2026-12-31' (no 2026-02-30).
const day = z
  .string({ error: 'Use a date like 2026-12-31.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Use a date like 2026-12-31.' })
  .refine((value) => {
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }, { error: 'That date doesn\'t exist.' });

const fields = {
  code,
  type: z.enum(['percent', 'fixed'], { error: 'Type must be "percent" or "fixed".' }),
  // percent: 1–90; fixed: 100–100,000 pesewas (checked with the type, in the service).
  value: wholeNumber('Value', 1, 100000),
  maxDiscountPesewas: wholeNumber('The maximum discount', 1, 100000).nullable(),
  minSubtotalPesewas: wholeNumber('The minimum order', 1, 100000000).nullable(),
  startsOn: day.nullable(),
  endsOn: day.nullable(),
  usageLimit: wholeNumber('The usage limit', 1, 1000000).nullable(),
  oncePerCustomer: z.boolean({ error: 'oncePerCustomer must be true or false.' }),
  isActive: z.boolean({ error: 'isActive must be true or false.' }),
};

// POST /api/admin/discount-codes
const createDiscountBody = z.object({
  code: fields.code,
  type: fields.type,
  value: fields.value,
  maxDiscountPesewas: fields.maxDiscountPesewas.optional().default(null),
  minSubtotalPesewas: fields.minSubtotalPesewas.optional().default(null),
  startsOn: fields.startsOn.optional().default(null),
  endsOn: fields.endsOn.optional().default(null),
  usageLimit: fields.usageLimit.optional().default(null),
  oncePerCustomer: fields.oncePerCustomer.default(true),
  isActive: fields.isActive.default(true),
});

// PATCH /api/admin/discount-codes/:id: any of the fields; null clears an optional one.
const EDITABLE = Object.keys(fields);
const updateDiscountBody = z
  .object(Object.fromEntries(EDITABLE.map((key) => [key, fields[key].optional()])))
  .superRefine((body, ctx) => {
    if (!EDITABLE.some((key) => body[key] !== undefined)) {
      ctx.addIssue({ code: 'custom', path: ['_'], message: 'Send at least one field to change.' });
    }
  });

// GET /api/admin/discount-codes?status=&page=
const discountListQuery = z.object({
  status: z.preprocess(
    blankToUndefined,
    z.enum(STATUSES, { error: `Status must be one of: ${STATUSES.join(', ')}.` }).optional()
  ),
  page,
});

const discountIdParams = z.object({
  id: z.coerce
    .number({ error: 'Discount code id must be a number.' })
    .int({ error: 'Discount code id must be a whole number.' })
    .positive({ error: 'Discount code id must be a positive number.' }),
});

module.exports = { createDiscountBody, updateDiscountBody, discountListQuery, discountIdParams, STATUSES };
