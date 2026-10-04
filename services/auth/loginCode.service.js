/*
 * services/auth/loginCode.service.js
 *
 * The login code step (BE12), switched on with LOGIN_CODE_ENABLED=true.
 * After the right password, instead of logging in we email a 6-digit code;
 * the user is only logged in after typing it (see auth.controller.js).
 *
 * Rules (backend-plan BE12):
 *   - 6 digits from a secure random generator, stored ONLY as a hash;
 *   - expires after 10 minutes; one use;
 *   - 5 wrong attempts and the code is cancelled;
 *   - a new code cancels the old one;
 *   - at least 60 seconds between sends, and at most 5 sends per hour;
 *   - in development only, the code is also printed to the console.
 *
 * The one email that is NOT "log and carry on": without the code the user
 * can't log in, so if sending fails we tell them to try again.
 */
const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, User, EmailToken } = require('../../models');
const AppError = require('../../utils/AppError');
const { hashToken } = require('../../utils/tokens');
// Used as emailService.sendEmail(...) (not destructured) so tests can replace it.
const emailService = require('../email/email.service');
const loginCodeEmail = require('../email/templates/loginCode');

const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_WAIT_SECONDS = 60;
const MAX_SENDS_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

/*
 * isLoginCodeEnabled()
 * Receives: nothing. Returns: true when LOGIN_CODE_ENABLED is exactly "true".
 * Read on every request, so changing .env only needs a server restart.
 */
function isLoginCodeEnabled() {
  return process.env.LOGIN_CODE_ENABLED === 'true';
}

/*
 * createCode()
 * Receives: nothing.
 * Returns: a 6-digit string such as "048213". crypto.randomInt is a secure
 *          random generator (Math.random is predictable and must not be used).
 */
function createCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

/*
 * sendLoginCode(userId, { isResend })
 * Creates and emails a new code, following the send limits.
 * Receives: the user's id, and whether this is the "resend" button (true) or
 *           the login itself (false).
 * Returns: nothing when a code was sent, or when (login only) a code sent
 *          less than 60 seconds ago is still valid, so it's reused instead
 *          of spamming a second email (e.g. a double-clicked login button).
 * Throws: 429 if the user must wait 60 seconds (resend) or has had 5 codes
 *         in the last hour; 503 if the email couldn't be sent.
 */
async function sendLoginCode(userId, { isResend }) {
  const result = await sequelize.transaction(async (transaction) => {
    // Lock the user's row: two requests at the same moment take turns, so
    // they can't both slip under the limits below.
    const user = await User.findByPk(userId, { lock: transaction.LOCK.UPDATE, transaction });
    if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Your login has expired. Please log in again.');

    const now = new Date();
    const latest = await EmailToken.findOne({
      where: { userId, type: 'loginCode' },
      order: [['id', 'DESC']],
      transaction,
    });
    const latestIsActive = latest && !latest.usedAt && latest.expiresAt > now;
    const secondsSinceLatest = latest ? (now - latest.createdAt) / 1000 : Infinity;
    if (latestIsActive && secondsSinceLatest < RESEND_WAIT_SECONDS) {
      if (!isResend) return { reused: true };
      const wait = Math.ceil(RESEND_WAIT_SECONDS - secondsSinceLatest);
      throw new AppError(429, 'RATE_LIMITED', `Please wait ${wait} seconds before requesting a new code.`);
    }

    const sentLastHour = await EmailToken.count({
      where: { userId, type: 'loginCode', createdAt: { [Op.gt]: new Date(now - HOUR_MS) } },
      transaction,
    });
    if (sentLastHour >= MAX_SENDS_PER_HOUR) {
      throw new AppError(429, 'RATE_LIMITED', 'Too many login codes requested. Please try again later.');
    }

    // Only the newest code may work: cancel any older unused ones.
    await EmailToken.update({ usedAt: now }, { where: { userId, type: 'loginCode', usedAt: null }, transaction });

    const code = createCode();
    const row = await EmailToken.create(
      {
        userId,
        type: 'loginCode',
        tokenHash: hashToken(code), // the code itself is never saved
        expiresAt: new Date(now.getTime() + CODE_MINUTES * 60 * 1000),
      },
      { transaction }
    );
    return { user, code, row };
  });

  if (result.reused) return;

  // Development only: makes testing easy without opening the inbox. Never in
  // production, where logs may be seen by other people or services.
  if (process.env.NODE_ENV === 'development') {
    console.log(`[login code] ${result.user.email}: ${result.code}`);
  }

  // After the commit, and AWAITED: the user can't continue without this email.
  try {
    await emailService.sendEmail({
      to: result.user.email,
      ...loginCodeEmail({ name: result.user.name, code: result.code, minutes: CODE_MINUTES }),
    });
  } catch (err) {
    console.error('[email] login code email failed:', err.message);
    // Cancel the code nobody received, so the next try isn't blocked by the
    // 60-second wait.
    await result.row.update({ usedAt: new Date() });
    throw new AppError(503, 'SERVER_ERROR', "We couldn't send your login code. Please try again.");
  }
}

/*
 * verifyLoginCode(userId, code)
 * Receives: the user id from the challenge cookie and the 6 digits typed.
 * Returns: the User when the code is right (the code is then used up).
 * Throws: 400 INVALID_REQUEST with a clear message when there's no valid
 *         code, it expired, it's wrong (with attempts left), or it was
 *         cancelled after 5 wrong tries.
 */
async function verifyLoginCode(userId, code) {
  // The transaction RETURNS the outcome instead of throwing inside it:
  // throwing would roll back, and a wrong guess must still be COUNTED.
  const outcome = await sequelize.transaction(async (transaction) => {
    // Lock the code row, so two guesses at once are counted one after the other.
    const token = await EmailToken.findOne({
      where: { userId, type: 'loginCode', usedAt: null },
      order: [['id', 'DESC']],
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    if (!token) return { status: 'none' };
    if (token.expiresAt <= new Date()) {
      await token.update({ usedAt: new Date() }, { transaction });
      return { status: 'expired' };
    }

    // Compare hashes in constant time, so response timing reveals nothing.
    const matches = crypto.timingSafeEqual(Buffer.from(hashToken(code), 'hex'), Buffer.from(token.tokenHash, 'hex'));
    if (!matches) {
      const attempts = token.attempts + 1;
      const cancelled = attempts >= MAX_ATTEMPTS;
      await token.update({ attempts, ...(cancelled && { usedAt: new Date() }) }, { transaction });
      return { status: cancelled ? 'locked' : 'wrong', attemptsLeft: MAX_ATTEMPTS - attempts };
    }

    await token.update({ usedAt: new Date() }, { transaction });
    return { status: 'ok' };
  });

  switch (outcome.status) {
    case 'ok': {
      const user = await User.findByPk(userId);
      if (!user || !user.emailVerifiedAt) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Your login has expired. Please log in again.');
      }
      return user;
    }
    case 'wrong':
      throw new AppError(
        400,
        'INVALID_REQUEST',
        `That code is incorrect. ${outcome.attemptsLeft} ${outcome.attemptsLeft === 1 ? 'attempt' : 'attempts'} left.`
      );
    case 'locked':
      throw new AppError(400, 'INVALID_REQUEST', 'Too many wrong attempts. Request a new code.');
    case 'expired':
      throw new AppError(400, 'INVALID_REQUEST', 'This code has expired. Request a new code.');
    default:
      throw new AppError(400, 'INVALID_REQUEST', 'This code is no longer valid. Request a new code.');
  }
}

module.exports = { isLoginCodeEnabled, sendLoginCode, verifyLoginCode, CODE_MINUTES };
