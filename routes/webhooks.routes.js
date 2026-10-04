/*
 * routes/webhooks.routes.js
 *
 * URLs called by outside services (not by our frontend), mounted at
 * /api/webhooks in app.js.
 *
 * /paystack is exempt from the X-Requested-With (CSRF) check, because Paystack
 * can't send that header; it's protected by its signature instead (checked in
 * the controller). app.js keeps the raw request body for this path, which the
 * signature check needs.
 */
const express = require('express');
const controller = require('../controllers/webhook.controller');

const router = express.Router();

router.post('/paystack', controller.paystackWebhook);

module.exports = router;
