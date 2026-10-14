/*
 * middleware/rateLimits.js
 *
 * Limits how often one IP address can call sensitive endpoints. This slows
 * down password guessing, stops people flooding inboxes with emails, and
 * protects the server from abuse. Limits are counted in memory, which is fine
 * for our single Render server.
 *
 * (Per-account limits, like "3 verification emails per hour", are checked in
 * the services using the database, because they must hold across IP addresses.)
 */
const rateLimit = require('express-rate-limit');
const AppError = require('../utils/AppError');

/*
 * createLimiter({ windowMinutes, limit, keyGenerator })
 * Receives: the time window in minutes, the number of requests allowed in it,
 *           and optionally a keyGenerator, to count per something other
 *           than the IP address (e.g. per logged-in user).
 * Returns: an Express middleware that answers 429 RATE_LIMITED (in our
 *          standard error format) once the limit is reached.
 */
function createLimiter({ windowMinutes, limit, keyGenerator }) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    ...(keyGenerator && { keyGenerator }),
    // Send the standard RateLimit headers so clients can see when to retry.
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res, next) => {
      next(new AppError(429, 'RATE_LIMITED', 'Too many attempts. Please wait a while and try again.'));
    },
  });
}

module.exports = {
  loginLimiter: createLimiter({ windowMinutes: 15, limit: 10 }),
  registerLimiter: createLimiter({ windowMinutes: 60, limit: 5 }),
  verifyLimiter: createLimiter({ windowMinutes: 15, limit: 10 }),
  resendLimiter: createLimiter({ windowMinutes: 15, limit: 5 }),
  // Login code step (BE12). Per IP, on top of the per-code limits in
  // loginCode.service.js (5 wrong tries per code, 60 s between sends, 5 per hour).
  loginCodeLimiter: createLimiter({ windowMinutes: 15, limit: 10 }),
  resendCodeLimiter: createLimiter({ windowMinutes: 15, limit: 5 }),
  // Writing, editing and deleting reviews (BE18), shared, to stop spam.
  reviewLimiter: createLimiter({ windowMinutes: 15, limit: 20 }),
  // Every checkout calls Paystack, so limit how fast one IP can start them.
  checkoutLimiter: createLimiter({ windowMinutes: 15, limit: 10 }),
  // Higher, because the frontend asks again every few seconds while a mobile
  // money payment is still pending (BE10).
  verifyPaymentLimiter: createLimiter({ windowMinutes: 15, limit: 30 }),
  // Forgot / reset password (BE27). Forgot is also limited per email in the
  // service (3 links an hour), silently, so the answer never changes.
  forgotLimiter: createLimiter({ windowMinutes: 60, limit: 5 }),
  resetLimiter: createLimiter({ windowMinutes: 15, limit: 10 }),
  // Deleting an account (BE27): counted per USER, not per IP, because it
  // guards a password check for one account. Must come after requireAuth.
  deleteAccountLimiter: createLimiter({ windowMinutes: 15, limit: 5, keyGenerator: (req) => `user:${req.user.id}` }),
  // Wishlist saves and removals (BE28), per USER (after requireAuth): plenty
  // for real use, but stops a script hammering the database.
  wishlistLimiter: createLimiter({ windowMinutes: 15, limit: 60, keyGenerator: (req) => `wishlist:${req.user.id}` }),
};
