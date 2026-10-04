/*
 * middleware/notFound.js
 *
 * Runs only when no route matched the request. Sends the standard 404 error
 * so the frontend always gets the same error shape, even for typos in URLs.
 */
const AppError = require('../utils/AppError');

/*
 * notFound(req, res, next)
 * Receives: the Express request/response and `next`.
 * Returns: nothing; passes a 404 NOT_FOUND error to the error handler.
 */
function notFound(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', 'The requested resource was not found.'));
}

module.exports = notFound;
