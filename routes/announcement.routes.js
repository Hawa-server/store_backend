/*
 * routes/announcement.routes.js
 *
 * The announcement bar (BE30), mounted at /api/announcement in app.js.
 * Public: no login needed. (Changing it is on the admin router.)
 */
const express = require('express');
const controller = require('../controllers/announcement.controller');

const router = express.Router();

router.get('/', controller.get);

module.exports = router;
