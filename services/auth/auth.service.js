/*
 * services/auth/auth.service.js
 *
 * The business rules for accounts: registering, verifying an email address,
 * resending the verification link, and logging in.
 *
 * Controllers call these functions and turn the results into HTTP responses.
 * Nothing here knows about req/res, which keeps the rules easy to read and test.
 *
 * Pattern used throughout: do the database work in a short transaction,
 * commit, and only then send emails (never hold a transaction open while
 * waiting for the email server). Emails are sent in the background (not
 * awaited), so a slow or broken email server never slows down or breaks a request.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

const { sequelize, User, EmailToken } = require('../../models');
const AppError = require('../../utils/AppError');
const { createRandomToken, hashToken } = require('../../utils/tokens');
const { formatGhanaDateTime } = require('../../utils/dates');
const { describeUserAgent } = require('../../utils/userAgent');
// Used as emailService.sendEmailSafely(...) (not destructured), so tests can replace it.
const emailService = require('../email/email.service');
// Used as cartService.mergeGuestCart(...) (not destructured), so the whole
// module is one clear dependency of login.
const cartService = require('../cart/cart.service');
const loginCodeService = require('./loginCode.service');
const verificationEmail = require('../email/templates/verification');
const loginAlertEmail = require('../email/templates/loginAlert');

const BCRYPT_COST = 12;
const VERIFY_TOKEN_HOURS = 24;
const MAX_RESENDS_PER_HOUR = 3;
const HOUR_MS = 60 * 60 * 1000;

// A bcrypt hash of a random value nobody knows. When someone logs in with an
// email that doesn't exist, we still compare against this, so the response
// takes as long as a real check and doesn't reveal which emails have accounts.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(createRandomToken(), BCRYPT_COST);

const RESEND_MESSAGE =
  'If that email belongs to an account that still needs verifying, we have sent a new link. Please check your inbox and spam folder.';

/*
 * toSafeUser(user)
 * Receives: a User row.
 * Returns: only the fields that are safe to send to the browser. Never the
 *          password hash, tokens, or internal columns.
 */
function toSafeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
  };
}

/*
 * createVerifyToken(userId, transaction)
 * Receives: the user's id and the open transaction.
 * Returns: the RAW token (to put in the email). Only its hash is saved.
 */
async function createVerifyToken(userId, transaction) {
  const rawToken = createRandomToken();
  await EmailToken.create(
    {
      userId,
      type: 'verify',
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + VERIFY_TOKEN_HOURS * HOUR_MS),
    },
    { transaction }
  );
  return rawToken;
}

/*
 * sendVerificationEmail(user, rawToken)
 * Receives: the user and the raw token.
 * Returns: a promise that always resolves (failures are logged only).
 * The link points to the frontend page, which sends the token to POST /api/auth/verify.
 */
function sendVerificationEmail(user, rawToken) {
  const link = `${process.env.CLIENT_URL}/verify-email?token=${rawToken}`;
  return emailService.sendEmailSafely({ to: user.email, ...verificationEmail({ name: user.name, link }) }, 'verification');
}

/*
 * register({ name, email, password })
 * Receives: validated registration details (email already lowercased).
 * Returns: { message }. Throws 409 CONFLICT if the email is already registered.
 */
async function register({ name, email, password }) {
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new AppError(409, 'CONFLICT', 'An account with this email already exists.');
  }

  // Hash before opening the transaction: bcrypt is deliberately slow
  // (cost 12 ≈ a quarter of a second), and transactions should stay short.
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  // User and token are created together: either both are saved or neither is.
  // (If two sign-ups race with the same email, the UNIQUE constraint rejects
  // the second, and the error handler answers 409 CONFLICT.)
  const { user, rawToken } = await sequelize.transaction(async (transaction) => {
    const user = await User.create({ name, email, passwordHash }, { transaction });
    const rawToken = await createVerifyToken(user.id, transaction);
    return { user, rawToken };
  });

  // Committed; now email, in the background (not awaited): talking to the
  // email server can take seconds, and the user shouldn't wait for it. If it
  // fails, it's logged; the account exists and the user can ask for a new link.
  sendVerificationEmail(user, rawToken);

  return { message: 'Account created. Check your email to verify your account.' };
}

/*
 * verifyEmail(rawToken)
 * Receives: the raw token from the verification link.
 * Returns: { message }. Throws 400 INVALID_REQUEST if the token is unknown,
 *          already used, or expired (with a message saying which).
 */
async function verifyEmail(rawToken) {
  return sequelize.transaction(async (transaction) => {
    // Lock the token row so two clicks at the same moment can't both use it.
    const token = await EmailToken.findOne({
      where: { tokenHash: hashToken(rawToken), type: 'verify' },
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    if (!token || token.usedAt) {
      throw new AppError(400, 'INVALID_REQUEST', 'This link is invalid or has already been used.');
    }
    if (token.expiresAt < new Date()) {
      throw new AppError(400, 'INVALID_REQUEST', 'This link has expired. Request a new one.');
    }

    const now = new Date();
    await token.update({ usedAt: now }, { transaction });
    await User.update(
      { emailVerifiedAt: now },
      { where: { id: token.userId, emailVerifiedAt: null }, transaction }
    );

    return { message: 'Your email is verified. You can now log in.' };
  });
}

/*
 * resendVerification(email)
 * Receives: a validated, lowercased email.
 * Returns: { message }: the SAME message whether or not the account exists
 *          or is already verified, so this can't be used to discover accounts.
 *          Throws 429 RATE_LIMITED after 3 resends in the last hour.
 */
async function resendVerification(email) {
  const result = await sequelize.transaction(async (transaction) => {
    // Lock the user row so two resend requests at once can't both slip under the limit.
    const user = await User.findOne({ where: { email }, lock: transaction.LOCK.UPDATE, transaction });
    if (!user || user.emailVerifiedAt) return null;

    // The first verify token is the registration email; it isn't a "resend".
    const firstToken = await EmailToken.findOne({
      where: { userId: user.id, type: 'verify' },
      order: [['id', 'ASC']],
      transaction,
    });
    const recentResends = await EmailToken.count({
      where: {
        userId: user.id,
        type: 'verify',
        createdAt: { [Op.gt]: new Date(Date.now() - HOUR_MS) },
        ...(firstToken && { id: { [Op.ne]: firstToken.id } }),
      },
      transaction,
    });
    if (recentResends >= MAX_RESENDS_PER_HOUR) {
      throw new AppError(429, 'RATE_LIMITED', 'You can request up to 3 new links per hour. Please try again later.');
    }

    // Only the newest link should work, so switch off any older unused ones.
    await EmailToken.update(
      { usedAt: new Date() },
      { where: { userId: user.id, type: 'verify', usedAt: null }, transaction }
    );
    const rawToken = await createVerifyToken(user.id, transaction);
    return { user, rawToken };
  });

  // Sent in the background (not awaited). Besides being faster, this matters
  // for privacy: if we waited for the email server, real accounts would answer
  // seconds slower than unknown emails, and that delay would reveal which emails
  // have accounts.
  if (result) sendVerificationEmail(result.user, result.rawToken);
  return { message: RESEND_MESSAGE };
}

/*
 * login({ email, password, userAgent, guestToken })
 * Receives: validated email and password, the browser's User-Agent header,
 *           and the guest cart cookie token (or null).
 * Returns: either
 *   - the result of completeLogin() ({ token, expiresAt, user, cartMergeFailed })
 *     when login codes are off, or
 *   - { requiresCode: true, userId } when login codes are on (BE12): a code
 *     has been emailed, and the user is NOT logged in until they enter it.
 * Throws 401 for a wrong email or password (same message for both), or
 * 403 EMAIL_NOT_VERIFIED if the password is right but the email isn't verified.
 * With codes on, it can also throw 429 (too many codes) or 503 (email failed).
 */
async function login({ email, password, userAgent, guestToken }) {
  const user = await User.scope('withPassword').findOne({ where: { email } });

  // Always run bcrypt, even for unknown emails, so timing doesn't reveal accounts.
  const passwordOk = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_PASSWORD_HASH);
  if (!user || !passwordOk) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Email or password is incorrect.');
  }

  // Checked only after the password, so strangers can't learn who is unverified.
  if (!user.emailVerifiedAt) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email before logging in.');
  }

  // Second step (BE12): the password was right, but we don't log in yet.
  // No login cookie, cart merge or login alert until the emailed code is
  // entered (POST /api/auth/login/verify-code).
  if (loginCodeService.isLoginCodeEnabled()) {
    await loginCodeService.sendLoginCode(user.id, { isResend: false });
    return { requiresCode: true, userId: user.id };
  }

  return completeLogin(user, { userAgent, guestToken });
}

/*
 * completeLogin(user, { userAgent, guestToken })
 * The final step of every successful login: merge the guest cart, create the
 * login token, send the login alert. With login codes on (BE12), it's called
 * only after the correct code, so the cart merge also waits for the code.
 * Receives: the User row, the User-Agent header, and the guest cart token (or null).
 * Returns: { token, expiresAt, user, cartMergeFailed } where token is the
 *          signed JWT for the cookie, expiresAt its expiry Date, user the safe
 *          user fields, and cartMergeFailed true if the guest cart couldn't be
 *          merged (the controller then keeps the guest cookie).
 */
async function completeLogin(user, { userAgent, guestToken }) {
  // Move the guest cart's items into the account cart. A cart problem must
  // never stop someone logging in, so a failure is logged and login carries on.
  // The merge is all-or-nothing, so after a failure the guest cart is untouched
  // and will be merged at the next login.
  let cartMergeFailed = false;
  try {
    await cartService.mergeGuestCart(user.id, guestToken);
  } catch (err) {
    cartMergeFailed = true;
    console.error('[cart] guest cart merge failed:', err.message);
  }

  // Minimum claims only: who (sub) and their role. No personal data or secrets.
  const token = jwt.sign(
    { sub: String(user.id), role: user.isAdmin ? 'admin' : 'customer' },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
  const expiresAt = new Date(jwt.decode(token).exp * 1000);

  // Login alert: sent in the background, not awaited, so a slow or failing
  // email server never delays or breaks the login. Failures are logged.
  emailService.sendEmailSafely(
    {
      to: user.email,
      ...loginAlertEmail({
        name: user.name,
        when: formatGhanaDateTime(new Date()),
        device: describeUserAgent(userAgent),
      }),
    },
    'login alert'
  );

  return { token, expiresAt, user: toSafeUser(user), cartMergeFailed };
}

module.exports = { register, verifyEmail, resendVerification, login, completeLogin, toSafeUser };
