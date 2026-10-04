/*
 * utils/authCookie.js
 *
 * Sets and clears the login cookie that holds the JWT.
 *   - httpOnly: page JavaScript can't read it, so an XSS bug can't steal it.
 *   - secure (production): only sent over HTTPS.
 *   - sameSite: 'lax' in development; 'none' in production, because the
 *     frontend and the API run on different sites (the CSRF header check in
 *     middleware/csrfCheck.js protects us there).
 */
const COOKIE_NAME = 'token';

/*
 * cookieOptions()
 * Receives: nothing.
 * Returns: the options shared by setting and clearing (they must match, or
 *          the browser won't clear the cookie).
 */
function cookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  };
}

/*
 * setAuthCookie(res, token, expiresAt)
 * Receives: the Express response, the signed JWT, and when it expires (Date).
 * Returns: nothing. The cookie expires at the same moment as the JWT.
 */
function setAuthCookie(res, token, expiresAt) {
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), expires: expiresAt });
}

/*
 * clearAuthCookie(res)
 * Receives: the Express response.
 * Returns: nothing; tells the browser to delete the login cookie.
 */
function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

module.exports = { COOKIE_NAME, cookieOptions, setAuthCookie, clearAuthCookie };
