/*
 * utils/AppError.js
 *
 * A custom error type for "expected" errors (bad input, not logged in, not found...).
 * Services and middleware `throw new AppError(...)`; the error handler
 * (middleware/errorHandler.js) turns it into the standard JSON error shape:
 *   { "error": { "code": "...", "message": "...", "fields": { ... } } }
 */
class AppError extends Error {
  /*
   * Receives:
   *   status  - HTTP status code (e.g. 400, 404)
   *   code    - short machine-readable code (e.g. 'NOT_FOUND')
   *   message - human-readable message that is safe to show the user
   *   fields  - optional { fieldName: message } for validation errors
   *   extra   - optional extra safe details added to the error body, e.g.
   *             { reason: 'declined' } so the frontend can react without
   *             reading the message text
   */
  constructor(status, code, message, fields, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.extra = extra;
  }
}

module.exports = AppError;
