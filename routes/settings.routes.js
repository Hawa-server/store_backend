/*
 * routes/settings.routes.js
 *
 * Public settings URLs, mounted at /api/settings in app.js. No login needed.
 * (Admin changes to settings, such as the low-stock threshold, come in BE20.)
 */
const express = require('express');
const controller = require('../controllers/settings.controller');

const router = express.Router();

router.get('/currency', controller.getCurrency);

module.exports = router;
