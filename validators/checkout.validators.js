/*
 * validators/checkout.validators.js
 *
 * Zod schema for POST /api/checkout. The body holds only the shopper's contact
 * and delivery details, and the chosen delivery region and town (BE24). Any
 * amounts the client sends (total, price, delivery fee...) are dropped here
 * and never reach the code: the server calculates all money.
 */
const { z } = require('zod');

// Ghana numbers only: 0XXXXXXXXX or +233XXXXXXXXX (spaces and dashes are
// allowed while typing). Stored in one format, the 10-digit local form, so the
// same number is always saved the same way.
const phone = z
  .string({ error: 'Phone number is required.' })
  .transform((value) => value.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^(0|\+233)\d{9}$/, { error: 'Enter a Ghana phone number, e.g. 0241234567.' }))
  .transform((value) => `0${value.slice(-9)}`);

const checkoutBody = z.object({
  name: z
    .string({ error: 'Name is required.' })
    .trim()
    .min(1, { error: 'Name is required.' })
    .max(100, { error: 'Name must be 100 characters or fewer.' }),
  email: z
    .string({ error: 'Email is required.' })
    .trim()
    .toLowerCase()
    .max(255, { error: 'Email is too long.' })
    .pipe(z.email({ error: 'Enter a valid email address.' })),
  phone,
  address: z
    .string({ error: 'Delivery address is required.' })
    .trim()
    .min(5, { error: 'Enter your full delivery address.' })
    .max(500, { error: 'Address must be 500 characters or fewer.' }),
  // Where it's going (BE24): ids from GET /api/delivery-areas. The fee is
  // worked out by the server from these; a fee sent by the browser is dropped.
  deliveryRegionId: z
    .number({ error: 'Choose a delivery region.' })
    .int({ error: 'Choose a delivery region.' })
    .positive({ error: 'Choose a delivery region.' }),
  // Missing or null = "Other town in this region" (the region's fee applies).
  deliveryTownId: z
    .number({ error: 'Choose a town from the list, or "Other town in this region".' })
    .int({ error: 'Choose a town from the list, or "Other town in this region".' })
    .positive({ error: 'Choose a town from the list, or "Other town in this region".' })
    .nullable()
    .optional(),
});

// POST /api/checkout/verify. A payment reference only ever contains letters,
// numbers and - . = (Paystack's rule), so anything else is rejected early.
const verifyBody = z.object({
  reference: z
    .string({ error: 'Payment reference is required.' })
    .trim()
    .regex(/^[A-Za-z0-9.=-]{1,100}$/, { error: 'Payment reference is not valid.' }),
});

module.exports = { checkoutBody, verifyBody };
