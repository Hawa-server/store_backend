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
 * findUserFromRequest(req)
 * Receives: the Express request (reads the login cookie).
 * Returns: the User row if the cookie holds a valid, unexpired token for a
 *          user who still exists and is verified; otherwise null.
 * Never throws for a bad or missing token; the caller decides what to do.
 */
async function findUserFromRequest(req) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return null;

  let payload;
  try {
    // Only accept tokens signed with our secret using HS256. Fixing the
    // algorithm stops attackers from sending tokens signed some other way.
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    // Invalid, tampered-with, or expired token.
    return null;
  }

  // Only real login tokens: they carry a role and no `purpose`. (The BE12
  // login-challenge cookie is signed with a different key anyway, so it fails
  // jwt.verify above; this check is a second lock on the same door.)
  if (!['admin', 'customer'].includes(payload.role) || payload.purpose) return null;

  // Never trust the token alone: load the user to confirm they still exist and
  // are verified. The fresh row also gives the real isAdmin value from the database.
  const user = await User.findByPk(payload.sub);
  if (!user || !user.emailVerifiedAt) return null;
  return user;
}

module.exports = { findUserFromRequest };
