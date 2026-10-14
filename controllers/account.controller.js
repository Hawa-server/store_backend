/*
 * controllers/account.controller.js
 *
 * Handles the HTTP side of /api/account (BE27): deleting your own account.
 */
const deleteAccountService = require('../services/account/deleteAccount.service');
const { clearAuthCookie } = require('../utils/authCookie');
const { clearGuestCartCookie } = require('../utils/guestCartCookie');

/*
 * DELETE /api/account
 * Receives: req.user (requireAuth) and req.valid.body = { password, confirm: "DELETE" }.
 * Returns: 200 { message } and clears the login and cart cookies. The login
 *          token couldn't be used anyway (the account's sessions ended), but
 *          clearing the cookie tidies up this browser straight away.
 */
async function deleteAccount(req, res) {
  await deleteAccountService.deleteAccount(req.user.id, req.valid.body.password);
  clearAuthCookie(res);
  clearGuestCartCookie(res);
  res.json({ message: 'Your account has been deleted.' });
}

module.exports = { deleteAccount };
