/*
 * middleware/csrfCheck.js
 *
 * Protects against CSRF (cross-site request forgery). Because login uses a
 * cookie, the browser sends that cookie automatically — even when another
 * website secretly submits a form to our API. To block that, every request
 * that changes something (POST, PATCH, DELETE) must carry the header
 *   X-Requested-With: XMLHttpRequest
 * A plain HTML form on another site can't add custom headers, and a script on
 * another site can't add them either unless our CORS settings allow that site.
 */
const AppError = require('../utils/AppError');

const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Paystack's servers call this route directly and can't send our custom header.
// It's protected by its HMAC signature check instead (built in BE8).
const EXEMPT_PATHS = ['/api/webhooks/paystack'];

/*
 * csrfCheck(req, res, next)
 * Receives: the Express request/response and `next`.
 * Returns: nothing. Calls next() if the request is allowed, or passes a 403
 *          FORBIDDEN error to the error handler if the header is missing.
 */
function csrfCheck(req, res, next) {
  if (!STATE_CHANGING_METHODS.includes(req.method) || EXEMPT_PATHS.includes(req.path)) {
    return next();
  }
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return next(new AppError(403, 'FORBIDDEN', 'Missing required X-Requested-With header.'));
  }
  next();
}

module.exports = csrfCheck;
