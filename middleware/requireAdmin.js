/*
 * middleware/requireAdmin.js
 *
 * Lets only admins through. Always used AFTER requireAuth, which has already
 * checked the login cookie and loaded the user FRESH from the database.
 *
 * We check user.isAdmin from that database row, not the `role` inside the
 * login token: if an admin is demoted, the change applies immediately,
 * without waiting for their token to expire.
 */
const AppError = require('../utils/AppError');

/*
 * requireAdmin(req, res, next)
 * Receives: the request (with req.user set by requireAuth), response, next.
 * Returns: nothing. Calls next() for admins; otherwise passes 403 FORBIDDEN
 *          (or 401 if somehow nobody is logged in).
 */
function requireAdmin(req, res, next) {
  if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Please log in to continue.'));
  if (!req.user.isAdmin) return next(new AppError(403, 'FORBIDDEN', "You don't have permission to do that."));
  next();
}

module.exports = requireAdmin;
