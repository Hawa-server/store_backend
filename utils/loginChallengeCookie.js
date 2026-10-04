/*
 * utils/loginChallengeCookie.js
 *
 * The short-lived "login challenge" cookie used by the login code step (BE12).
 * After someone enters the right password (and codes are switched on), they're
 * NOT logged in yet. This cookie remembers "user X has passed the password
 * step" for 15 minutes, so that:
 *   - POST /api/auth/login/verify-code and /resend-code know which user it is
 *     without trusting anything the browser types in;
 *   - the emailed code only works in the browser that entered the password.
 *
 * Security: it's a small JWT signed with a DIFFERENT key from the login token
 * (derived from JWT_SECRET for this one purpose). So it can never be used as
 * a login cookie, even if someone copies it into the `token` cookie.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { cookieOptions } = require('./authCookie');

const COOKIE_NAME = 'loginChallenge';
const CHALLENGE_MINUTES = 15;
const PURPOSE = 'login_code';

/*
 * challengeKey()
 * Receives: nothing (reads JWT_SECRET).
 * Returns: a signing key used ONLY for challenge cookies: an HMAC of a fixed
 *          label with JWT_SECRET. Different purpose → different key.
 */
function challengeKey() {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update('login-code-challenge').digest();
}

/*
 * setLoginChallengeCookie(res, userId)
 * Receives: the Express response and the id of the user who passed the password step.
 * Returns: nothing; sets the HTTP-only cookie for 15 minutes.
 */
function setLoginChallengeCookie(res, userId) {
  const token = jwt.sign({ sub: String(userId), purpose: PURPOSE }, challengeKey(), {
    algorithm: 'HS256',
    expiresIn: `${CHALLENGE_MINUTES}m`,
  });
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: CHALLENGE_MINUTES * 60 * 1000 });
}

/*
 * readLoginChallenge(req)
 * Receives: the Express request.
 * Returns: the user id (number) from a valid, unexpired challenge cookie, or
 *          null if it's missing, tampered with, expired, or for another purpose.
 */
function readLoginChallenge(req) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, challengeKey(), { algorithms: ['HS256'] });
    if (payload.purpose !== PURPOSE) return null;
    const userId = Number(payload.sub);
    return Number.isInteger(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
}

/*
 * clearLoginChallengeCookie(res)
 * Receives: the Express response.
 * Returns: nothing; tells the browser to delete the challenge cookie.
 */
function clearLoginChallengeCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

module.exports = { COOKIE_NAME, setLoginChallengeCookie, readLoginChallenge, clearLoginChallengeCookie };
