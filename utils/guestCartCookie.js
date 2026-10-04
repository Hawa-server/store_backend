/*
 * utils/guestCartCookie.js
 *
 * The cookie that lets a guest (not logged in) keep a cart. It holds a long
 * random token that matches Carts.guestToken. The server looks the cart up
 * from this token, so the client never sends a cart id.
 *
 * Same safety settings as the login cookie (utils/authCookie.js): HTTP-only,
 * Secure and SameSite=None in production, SameSite=Lax in development.
 * It lasts 30 days and is renewed every time the cart is used.
 */
const COOKIE_NAME = 'guestCart';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/*
 * cookieOptions()
 * Receives: nothing.
 * Returns: the options shared by setting and clearing the cookie.
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
 * readGuestCartToken(req)
 * Receives: the Express request.
 * Returns: the token if the cookie holds one in our format (64 hex
 *          characters), otherwise null. Anything else is ignored rather
 *          than sent to the database.
 */
function readGuestCartToken(req) {
  const token = req.cookies[COOKIE_NAME];
  return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

/*
 * setGuestCartCookie(res, token)
 * Receives: the Express response and the guest cart token.
 * Returns: nothing; sets (or renews) the cookie for another 30 days.
 */
function setGuestCartCookie(res, token) {
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: MAX_AGE_MS });
}

/*
 * clearGuestCartCookie(res)
 * Receives: the Express response.
 * Returns: nothing; tells the browser to delete the cookie.
 */
function clearGuestCartCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

module.exports = { COOKIE_NAME, readGuestCartToken, setGuestCartCookie, clearGuestCartCookie };
