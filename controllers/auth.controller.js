/*
 * controllers/auth.controller.js
 *
 * Handles the HTTP side of /api/auth: reads the validated input (req.valid),
 * calls the auth service, and sends the response. Cookies are set here because
 * they're part of the HTTP response, not a business rule.
 *
 * Errors thrown by the service go straight to the error handler (Express 5
 * forwards errors from async functions automatically).
 */
const authService = require('../services/auth/auth.service');
const loginCodeService = require('../services/auth/loginCode.service');
const AppError = require('../utils/AppError');
const { setAuthCookie, clearAuthCookie } = require('../utils/authCookie');
const { COOKIE_NAME: GUEST_CART_COOKIE, readGuestCartToken, clearGuestCartCookie } = require('../utils/guestCartCookie');
const {
  setLoginChallengeCookie, readLoginChallenge, clearLoginChallengeCookie,
} = require('../utils/loginChallengeCookie');

const CHALLENGE_EXPIRED = 'Your login has expired. Please log in again.';

/*
 * finishLogin(req, res, result)
 * The last HTTP step of a successful login (direct, or after the code).
 * Receives: the request, the response, and completeLogin()'s result.
 * Returns: nothing; sets the login cookie and sends 200 { user }.
 */
function finishLogin(req, res, { token, expiresAt, user, cartMergeFailed }) {
  setAuthCookie(res, token, expiresAt);
  clearLoginChallengeCookie(res);

  // The guest cookie is no longer needed once its cart has been merged (or
  // there was nothing to merge). But if the merge FAILED, keep the cookie:
  // the guest cart is still intact, and the next login will try again, so the
  // shopper's items aren't lost.
  if (req.cookies[GUEST_CART_COOKIE] && !cartMergeFailed) clearGuestCartCookie(res);

  res.json({ user });
}

/*
 * POST /api/auth/register
 * Receives: req.valid.body = { name, email, password }.
 * Returns: 201 { message }.
 */
async function register(req, res) {
  const result = await authService.register(req.valid.body);
  res.status(201).json(result);
}

/*
 * POST /api/auth/verify
 * Receives: req.valid.body = { token }.
 * Returns: 200 { message }.
 */
async function verify(req, res) {
  res.json(await authService.verifyEmail(req.valid.body.token));
}

/*
 * POST /api/auth/resend-verification
 * Receives: req.valid.body = { email }.
 * Returns: 200 { message } (always the same message).
 */
async function resendVerification(req, res) {
  res.json(await authService.resendVerification(req.valid.body.email));
}

/*
 * POST /api/auth/login
 * Receives: req.valid.body = { email, password }, and the guest cart cookie if any.
 * Returns: - login codes OFF: 200 { user } and sets the HTTP-only login cookie.
 *            The guest cart is merged during login (authService.completeLogin).
 *          - login codes ON (BE12): 200 { requiresCode: true, message } and sets
 *            only the short-lived loginChallenge cookie. Not logged in yet.
 * The token itself is never put in the JSON body, only in the cookie.
 */
async function login(req, res) {
  const result = await authService.login({
    ...req.valid.body,
    userAgent: req.get('User-Agent'),
    guestToken: readGuestCartToken(req),
  });

  if (result.requiresCode) {
    setLoginChallengeCookie(res, result.userId);
    return res.json({
      requiresCode: true,
      message: `We've emailed you a 6-digit login code. It expires in ${loginCodeService.CODE_MINUTES} minutes.`,
    });
  }
  finishLogin(req, res, result);
}

/*
 * POST /api/auth/login/verify-code
 * Receives: req.valid.body = { code }, plus the loginChallenge cookie (which
 *           says who passed the password step) and the guest cart cookie.
 * Returns: 200 { user } and sets the login cookie, exactly like a direct login.
 *          The guest cart merge and login alert happen now, not before.
 */
async function verifyCode(req, res) {
  const userId = readLoginChallenge(req);
  if (!userId) throw new AppError(401, 'UNAUTHENTICATED', CHALLENGE_EXPIRED);

  const user = await loginCodeService.verifyLoginCode(userId, req.valid.body.code);
  const result = await authService.completeLogin(user, {
    userAgent: req.get('User-Agent'),
    guestToken: readGuestCartToken(req),
  });
  finishLogin(req, res, result);
}

/*
 * POST /api/auth/login/resend-code
 * Receives: the loginChallenge cookie (no body).
 * Returns: 200 { message } after emailing a new code (the old one stops
 *          working). The challenge cookie is renewed for another 15 minutes.
 */
async function resendCode(req, res) {
  const userId = readLoginChallenge(req);
  if (!userId) throw new AppError(401, 'UNAUTHENTICATED', CHALLENGE_EXPIRED);

  await loginCodeService.sendLoginCode(userId, { isResend: true });
  setLoginChallengeCookie(res, userId);
  res.json({ message: `We've emailed you a new code. It expires in ${loginCodeService.CODE_MINUTES} minutes.` });
}

/*
 * POST /api/auth/logout
 * Receives: nothing. Works even if not logged in.
 * Returns: 200 { message } and clears BOTH the login cookie and the guest cart
 *          cookie, so the browser starts fresh with an empty cart. (The account
 *          cart stays saved and comes back at the next login.)
 */
function logout(req, res) {
  clearAuthCookie(res);
  clearLoginChallengeCookie(res);
  clearGuestCartCookie(res);
  res.json({ message: 'You have been logged out.' });
}

/*
 * GET /api/auth/me
 * Receives: req.user, set by requireAuth.
 * Returns: 200 { user } with safe fields only.
 */
function me(req, res) {
  res.json({ user: authService.toSafeUser(req.user) });
}

module.exports = { register, verify, resendVerification, login, verifyCode, resendCode, logout, me };
