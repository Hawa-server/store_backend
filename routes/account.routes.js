/*
 * routes/account.routes.js
 *
 * The logged-in user's own account, mounted at /api/account in app.js (BE27).
 * The rate limit is counted per USER, so it must come after requireAuth
 * (which sets req.user).
 */
const express = require('express');
const controller = require('../controllers/account.controller');
const requireAuth = require('../middleware/requireAuth');
const validate = require('../middleware/validate');
const { deleteAccountLimiter } = require('../middleware/rateLimits');
const { deleteAccountSchema } = require('../validators/auth.validators');

const router = express.Router();

router.delete('/', requireAuth, deleteAccountLimiter, validate({ body: deleteAccountSchema }), controller.deleteAccount);

module.exports = router;
