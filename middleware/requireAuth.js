/*
 * middleware/requireAuth.js
 *
 * Protects routes that need a logged-in user. Put it before the controller:
 *   router.get('/me', requireAuth, controller.me);
 *
 * The checks themselves (token signature and expiry, user still exists and is
 * verified) live in services/auth/currentUser.js. req.user is a fresh database
 * row, so admin checks later use the database's isAdmin, not the token's claim.
 */
const AppError = require('../utils/AppError');
const { findUserFromRequest } = require('../services/auth/currentUser');

/*
 * requireAuth(req, res, next)
 * Receives: the Express request/response and `next`.
 * Returns: nothing. Sets req.user and calls next(), or passes a 401
 *          UNAUTHENTICATED error to the error handler.
 */
async function requireAuth(req, res, next) {
  const user = await findUserFromRequest(req);
  if (!user) return next(new AppError(401, 'UNAUTHENTICATED', 'Please log in to continue.'));
  req.user = user;
  next();
}

module.exports = requireAuth;
