/*
 * middleware/errorHandler.js
 *
 * The single place where errors become HTTP responses. Every error in the app
 * ends up here (Express 5 also forwards errors thrown in async handlers), and
 * leaves in the same shape:
 *   { "error": { "code": "...", "message": "...", "fields": { ... } } }
 *
 * Security: unexpected errors are logged on the server only. The client gets a
 * generic message — never SQL, Sequelize details, stack traces, or secrets.
 */
const { UniqueConstraintError } = require('sequelize');
const AppError = require('../utils/AppError');

/*
 * toAppError(err)
 * Converts known kinds of errors into an AppError.
 * Receives: any error.
 * Returns: an AppError, or null if the error is unexpected.
 */
function toAppError(err) {
  if (err instanceof AppError) return err;

  // Errors raised by express.json() (the body parser).
  if (err.type === 'entity.parse.failed') {
    return new AppError(400, 'INVALID_REQUEST', 'The request body is not valid JSON.');
  }
  if (err.type === 'entity.too.large') {
    return new AppError(413, 'INVALID_REQUEST', 'The request body is too large.');
  }

  // A unique column (e.g. email) already has this value. We don't echo the
  // column or value back, only that it's a duplicate.
  if (err instanceof UniqueConstraintError) {
    return new AppError(409, 'CONFLICT', 'This record already exists.');
  }

  return null;
}

/*
 * errorHandler(err, req, res, next)
 * Express recognises error handlers by their four parameters.
 * Receives: the error, request, response, and next.
 * Returns: nothing; sends the JSON error response.
 */
function errorHandler(err, req, res, next) {
  const appError = toAppError(err);

  if (!appError) {
    // Log only the stack (name + message + where it happened). Logging the whole
    // error object would also print Sequelize's `sql` and `parameters`, which can
    // contain password hashes, tokens or personal data.
    console.error(`[error] ${req.method} ${req.path}:`, err.stack || err.message);
    return res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' },
    });
  }

  const body = { code: appError.code, message: appError.message };
  if (appError.fields) body.fields = appError.fields;
  if (appError.extra) Object.assign(body, appError.extra);
  res.status(appError.status).json({ error: body });
}

module.exports = errorHandler;
