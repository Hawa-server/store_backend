/*
 * middleware/requireJson.js
 *
 * The API only accepts JSON request bodies. Rejecting other formats (HTML form
 * posts, plain text) closes another route for cross-site form attacks and keeps
 * input handling simple: every body goes through the JSON parser and then Zod.
 */
const AppError = require('../utils/AppError');

/*
 * requireJson(req, res, next)
 * Receives: the Express request/response and `next`.
 * Returns: nothing. Calls next() if there's no body or the body is JSON;
 *          otherwise passes a 415 error to the error handler.
 */
function requireJson(req, res, next) {
  // An empty body is fine (e.g. POST /api/auth/logout has nothing to send).
  // Many clients send "Content-Length: 0" for an empty POST, so we only count
  // the body as present if it actually has content (or is being streamed).
  const hasBody =
    req.headers['transfer-encoding'] !== undefined || Number(req.headers['content-length']) > 0;
  if (hasBody && !req.is('application/json')) {
    return next(new AppError(415, 'INVALID_REQUEST', 'Request body must be JSON (Content-Type: application/json).'));
  }
  next();
}

module.exports = requireJson;
