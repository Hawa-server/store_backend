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
 * createLimiter({ windowMinutes, limit })
 * Receives: the time window in minutes and the number of requests allowed in it.
 * Returns: an Express middleware that answers 429 RATE_LIMITED (in our
 *          standard error format) once the limit is reached.
 */
function createLimiter({ windowMinutes, limit }) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
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
};
