/*
 * validators/auth.validators.js
 *
 * Zod schemas describing valid request bodies for the /api/auth endpoints.
 * Used with middleware/validate.js. Any extra fields are dropped.
 */
const { z } = require('zod');

// Emails are trimmed and lowercased so "Ama@Example.com " and
// "ama@example.com" are treated as the same account.
const email = z
  .string({ error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .max(255, { error: 'Email is too long.' })
  .pipe(z.email({ error: 'Enter a valid email address.' }));

const registerSchema = z.object({
  name: z
    .string({ error: 'Name is required.' })
    .trim()
    .min(1, { error: 'Name is required.' })
    .max(100, { error: 'Name must be 100 characters or fewer.' }),
  email,
  // Min 8 per the plan. Max 72 because bcrypt ignores anything after 72 bytes.
  password: z
    .string({ error: 'Password is required.' })
    .min(8, { error: 'Password must be at least 8 characters.' })
    .max(72, { error: 'Password must be 72 characters or fewer.' }),
});

const verifySchema = z.object({
  // Our tokens are always exactly 64 hex characters (see utils/tokens.js).
  token: z
    .string({ error: 'Token is required.' })
    .regex(/^[a-f0-9]{64}$/, { error: 'This link is invalid or has already been used.' }),
});

const resendSchema = z.object({ email });

const loginSchema = z.object({
  email,
  // No minimum length here: a wrong password should get "incorrect", not a hint about the rules.
  password: z
    .string({ error: 'Password is required.' })
    .min(1, { error: 'Password is required.' })
    .max(72, { error: 'Email or password is incorrect.' }),
});

// POST /api/auth/login/verify-code: exactly 6 digits, as text ("048213"), so
// leading zeros aren't lost.
const verifyCodeSchema = z.object({
  code: z
    .string({ error: 'Enter the 6-digit code.' })
    .trim()
    .regex(/^\d{6}$/, { error: 'Enter the 6-digit code.' }),
});

module.exports = { registerSchema, verifySchema, resendSchema, loginSchema, verifyCodeSchema };
