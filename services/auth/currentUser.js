/*
 * services/auth/currentUser.js
 *
 * Works out who is making a request, from the login cookie. Shared by:
 *   - middleware/requireAuth.js  (login required: rejects if nobody is found)
 *   - middleware/optionalAuth.js (login optional: carries on either way)
 * Keeping the checks in one place means both always apply exactly the same rules.
 */
const jwt = require('jsonwebtoken');
const { User } = require('../../models');
const { COOKIE_NAME } = require('../../utils/authCookie');

/*
 * checkLogin(req)
 * Receives: the Express request (reads the login cookie).
 * Returns: { user, reason }. user is the User row if the cookie holds a valid,
 *          unexpired token for a user who still exists, is verified, isn't
 *          deleted, and hasn't been signed out everywhere since (BE27);
 *          otherwise user is null and reason says why: 'none' (no or bad
 *          cookie) or 'session_ended' (the user's sessions were ended, e.g.
 *          after a password reset), so requireAuth can say "Please log in again."
 * Never throws for a bad or missing token; the caller decides what to do.
 */
async function checkLogin(req) {
  const none = { user: null, reason: 'none' };
  const token = req.cookies[COOKIE_NAME];
  if (!token) return none;

  let payload;
  try {
    // Only accept tokens signed with our secret using HS256. Fixing the
    // algorithm stops attackers from sending tokens signed some other way.
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    // Invalid, tampered-with, or expired token.
    return none;
  }

  // Only real login tokens: they carry a role and no `purpose`. (The BE12
  // login-challenge cookie is signed with a different key anyway, so it fails
  // jwt.verify above; this check is a second lock on the same door.)
  if (!['admin', 'customer'].includes(payload.role) || payload.purpose) return none;

  // Never trust the token alone: load the user to confirm they still exist and
  // are verified. The fresh row also gives the real isAdmin value from the database.
  const user = await User.findByPk(payload.sub);
  if (!user || !user.emailVerifiedAt) return none;

  // Sign out everywhere (BE27). The token remembers the user's sessionVersion
  // from when they logged in ("sv"). A password reset or account deletion adds
  // 1 to the user's sessionVersion, so every OLDER token stops matching, on
  // every phone and browser, even though the token itself hasn't expired.
  // Tokens made before BE27 have no "sv": they count as 0, so the deployment
  // itself logs nobody out.
  if (user.deletedAt || (payload.sv ?? 0) !== user.sessionVersion) return { user: null, reason: 'session_ended' };
  return { user, reason: null };
}

/*
 * findUserFromRequest(req)
 * Receives: the Express request.
 * Returns: the logged-in User row, or null (see checkLogin for the rules).
 */
async function findUserFromRequest(req) {
  return (await checkLogin(req)).user;
}

module.exports = { checkLogin, findUserFromRequest };
