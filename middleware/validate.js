/*
 * middleware/validate.js
 *
 * Checks the request body, query string and URL parameters against Zod
 * schemas (defined in validators/) before the controller runs.
 *
 * Security: Zod objects drop any fields that aren't in the schema, so a client
 * can't sneak in extra fields like "isAdmin": true (mass assignment). Only the
 * cleaned, validated values are passed on, in req.valid.
 *
 * Usage in a route:
 *   router.post('/register', validate({ body: registerSchema }), controller.register);
 *   then in the controller: req.valid.body
 */
const AppError = require('../utils/AppError');

/*
 * toFieldErrors(issues)
 * Receives: Zod's list of problems.
 * Returns: { fieldName: message }, keeping the first message per field so the
 *          frontend can show one clear error next to each input.
 */
function toFieldErrors(issues) {
  const fields = {};
  for (const issue of issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/*
 * validate(schemas)
 * Receives: an object with optional `body`, `query` and `params` Zod schemas.
 * Returns: an Express middleware. It stores the cleaned values in
 *          req.valid = { body, query, params }, or passes a 400
 *          INVALID_REQUEST error (with `fields`) to the error handler.
 *
 * (We don't overwrite req.query because Express 5 makes it read-only.)
 */
function validate(schemas) {
  return (req, res, next) => {
    const valid = {};
    let fields = {};

    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      // A missing body arrives as undefined; treat it as {} so we report
      // "Email is required" instead of a confusing type error.
      const result = schemas[part].safeParse(req[part] ?? {});
      if (result.success) valid[part] = result.data;
      else fields = { ...toFieldErrors(result.error.issues), ...fields };
    }

    if (Object.keys(fields).length) {
      return next(new AppError(400, 'INVALID_REQUEST', 'Please check the highlighted fields.', fields));
    }
    req.valid = valid;
    next();
  };
}

module.exports = validate;
