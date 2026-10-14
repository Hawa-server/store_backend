/*
 * services/auth/passwordReset.service.js
 *
 * "Forgot password" (BE27), in two steps:
 *   1. requestPasswordReset(email): emails a one-use link that works for
 *      30 minutes (only its HASH is stored, like verification links).
 *   2. resetPassword(token, password): checks the link, saves the new
 *      password, and signs the user out on every device.
 *
 * Privacy: step 1 must never reveal whether an account exists. The controller
 * always answers the same message, straight away, and only then runs step 1
 * in the background, so real and unknown emails also take the same time.
 */
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { sequelize, User, EmailToken } = require('../../models');
const AppError = require('../../utils/AppError');
const { createRandomToken, hashToken } = require('../../utils/tokens');
const { formatGhanaDateTime } = require('../../utils/dates');
// Used as emailService.sendEmailSafely(...) (not destructured), so tests can replace it.
const emailService = require('../email/email.service');
const passwordResetEmail = require('../email/templates/passwordReset');
const passwordChangedEmail = require('../email/templates/passwordChanged');

const BCRYPT_COST = 12;
const RESET_MINUTES = 30;
const MAX_RESETS_PER_HOUR = 3;
const HOUR_MS = 60 * 60 * 1000;

const LINK_INVALID = 'This link has expired or has already been used. Please ask for a new one.';

/*
 * requestPasswordReset(email)
 * Receives: a validated, lower-cased email.
 * Returns: nothing useful (the caller has already answered the request).
 *          If an account (not deleted) has this email, and fewer than 3 reset
 *          links were sent to it in the last hour, a new link is emailed.
 *          Otherwise nothing happens: silently, so nobody learns anything.
 */
async function requestPasswordReset(email) {
  const result = await sequelize.transaction(async (transaction) => {
    // Lock the user row, so two requests at once can't both slip under the
    // per-email limit. A deleted account's email was replaced, so it never matches.
    const user = await User.findOne({ where: { email, deletedAt: null }, lock: transaction.LOCK.UPDATE, transaction });
    if (!user) return null;

    // Per email, across all IP addresses: at most 3 links an hour. This stops
    // someone flooding a person's inbox by changing IP address.
    const recent = await EmailToken.count({
      where: { userId: user.id, type: 'passwordReset', createdAt: { [Op.gt]: new Date(Date.now() - HOUR_MS) } },
      transaction,
    });
    if (recent >= MAX_RESETS_PER_HOUR) return null;

    // Only the newest link should work: switch off any older unused ones.
    await EmailToken.update(
      { usedAt: new Date() },
      { where: { userId: user.id, type: 'passwordReset', usedAt: null }, transaction }
    );
    // 32 random bytes; only the hash is saved, so a database leak can't be
    // used to reset anyone's password.
    const rawToken = createRandomToken();
    await EmailToken.create(
      {
        userId: user.id,
        type: 'passwordReset',
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_MINUTES * 60 * 1000),
      },
      { transaction }
    );
    return { user, rawToken };
  });
  if (!result) return;

  // After the commit (never inside the transaction): send the link.
  const link = `${process.env.CLIENT_URL}/reset-password?token=${result.rawToken}`;
  // Development only, like login codes: lets you test without opening the inbox.
  if (process.env.NODE_ENV === 'development') console.log(`[password reset] ${result.user.email}: ${link}`);
  await emailService.sendEmailSafely(
    { to: result.user.email, ...passwordResetEmail({ name: result.user.name, link, minutes: RESET_MINUTES }) },
    'password reset'
  );
}

/*
 * resetPassword(rawToken, password)
 * Receives: the token from the link, and the new password (already checked
 *           with the same rules as registration).
 * Returns: { message }. The user is NOT logged in: they log in with the new
 *          password (and the login code, if that's on).
 * Throws: 400 RESET_LINK_INVALID if the link is unknown, used, replaced by a
 *         newer one, or older than 30 minutes (one message for all of them).
 */
async function resetPassword(rawToken, password) {
  // bcrypt is slow on purpose (cost 12), so hash BEFORE the transaction:
  // row locks are then held for milliseconds, not a quarter of a second.
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const user = await sequelize.transaction(async (transaction) => {
    // Lock the token row: two clicks at the same moment can't both use it.
    const token = await EmailToken.findOne({
      where: { tokenHash: hashToken(rawToken), type: 'passwordReset' },
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    if (!token || token.usedAt || token.expiresAt <= new Date()) {
      throw new AppError(400, 'RESET_LINK_INVALID', LINK_INVALID);
    }
    const found = await User.findByPk(token.userId, { lock: transaction.LOCK.UPDATE, transaction });
    if (!found || found.deletedAt) throw new AppError(400, 'RESET_LINK_INVALID', LINK_INVALID);

    const now = new Date();
    await token.update({ usedAt: now }, { transaction });
    // Any other open reset links or login codes stop working too: whoever
    // had them shouldn't be able to use them after the password changed.
    await EmailToken.update(
      { usedAt: now },
      { where: { userId: found.id, type: ['passwordReset', 'loginCode'], usedAt: null }, transaction }
    );
    await found.update(
      {
        passwordHash,
        // +1 = every existing login token stops working (sign out everywhere).
        sessionVersion: found.sessionVersion + 1,
        // Opening the emailed link proves they own the inbox, so an account
        // that was never verified counts as verified now.
        ...(found.emailVerifiedAt ? {} : { emailVerifiedAt: now }),
      },
      { transaction }
    );
    return found;
  });

  // After the commit: tell the owner, so they notice if it wasn't them.
  emailService.sendEmailSafely(
    { to: user.email, ...passwordChangedEmail({ name: user.name, when: formatGhanaDateTime(new Date()) }) },
    'password changed'
  );
  return { message: 'Your password has been changed. Please log in with your new password.' };
}

module.exports = { requestPasswordReset, resetPassword, RESET_MINUTES };
