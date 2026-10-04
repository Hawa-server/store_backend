/*
 * routes/auth.routes.js
 *
 * URLs for accounts, mounted at /api/auth in app.js. Each line reads left to
 * right: rate limit → validate the input → controller.
 */
const express = require('express');
const controller = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/requireAuth');
const {
  loginLimiter, registerLimiter, verifyLimiter, resendLimiter, loginCodeLimiter, resendCodeLimiter,
} = require('../middleware/rateLimits');
const {
  registerSchema, verifySchema, resendSchema, loginSchema, verifyCodeSchema,
} = require('../validators/auth.validators');

const router = express.Router();

router.post('/register', registerLimiter, validate({ body: registerSchema }), controller.register);
router.post('/verify', verifyLimiter, validate({ body: verifySchema }), controller.verify);
router.post('/resend-verification', resendLimiter, validate({ body: resendSchema }), controller.resendVerification);
router.post('/login', loginLimiter, validate({ body: loginSchema }), controller.login);
// Login code step (BE12). The user comes from the loginChallenge cookie, not the body.
router.post('/login/verify-code', loginCodeLimiter, validate({ body: verifyCodeSchema }), controller.verifyCode);
router.post('/login/resend-code', resendCodeLimiter, controller.resendCode);
router.post('/logout', controller.logout);
router.get('/me', requireAuth, controller.me);

module.exports = router;
