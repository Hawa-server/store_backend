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

// A NEW password: the same rule for registration and password resets (BE27).
// Min 8 per the plan. Max 72 because bcrypt ignores anything after 72 bytes.
const newPassword = z
  .string({ error: 'Password is required.' })
  .min(8, { error: 'Password must be at least 8 characters.' })
  .max(72, { error: 'Password must be 72 characters or fewer.' });

const registerSchema = z.object({
  name: z
    .string({ error: 'Name is required.' })
    .trim()
    .min(1, { error: 'Name is required.' })
    .max(100, { error: 'Name must be 100 characters or fewer.' }),
  email,
  password: newPassword,
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

// POST /api/auth/forgot-password (BE27)
const forgotSchema = z.object({ email });

// POST /api/auth/reset-password (BE27). Reset tokens are 64 hex characters,
// like verification tokens; anything else is a link that can't work.
const resetSchema = z.object({
  token: z
    .string({ error: 'This link has expired or has already been used. Please ask for a new one.' })
    .regex(/^[a-f0-9]{64}$/, { error: 'This link has expired or has already been used. Please ask for a new one.' }),
  password: newPassword,
});

// DELETE /api/account (BE27): the current password, and the word DELETE
// typed on purpose, so an account is never deleted by a slip.
const deleteAccountSchema = z.object({
  password: z
    .string({ error: 'Enter your password.' })
    .min(1, { error: 'Enter your password.' })
    .max(72, { error: 'Your password is incorrect.' }),
  confirm: z.literal('DELETE', { error: 'Type DELETE to confirm.' }),
});

module.exports = {
  forgotSchema,
  resetSchema,
  deleteAccountSchema, registerSchema, verifySchema, resendSchema, loginSchema, verifyCodeSchema };
