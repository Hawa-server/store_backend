/*
 * middleware/optionalAuth.js
 *
 * For public routes that show a little extra when someone is logged in (e.g.
 * product details say whether YOU can review the product). Unlike requireAuth,
 * it never rejects the request: a missing or bad cookie just means "guest".
 */
const { findUserFromRequest } = require('../services/auth/currentUser');

/*
 * optionalAuth(req, res, next)
 * Receives: the Express request/response and `next`.
 * Returns: nothing. Sets req.user to the logged-in user, or null for guests,
 *          then always calls next().
 */
async function optionalAuth(req, res, next) {
  req.user = await findUserFromRequest(req);
  next();
}

module.exports = optionalAuth;
