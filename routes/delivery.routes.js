/*
 * routes/delivery.routes.js
 *
 * Delivery area URLs, mounted at /api/delivery-areas in app.js (BE24).
 * Public: no login needed, because guests check out too.
 * (Changing fees and towns is on the admin router.)
 */
const express = require('express');
const controller = require('../controllers/delivery.controller');

const router = express.Router();

router.get('/', controller.listAreas);

module.exports = router;
