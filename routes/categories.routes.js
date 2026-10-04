/*
 * routes/categories.routes.js
 *
 * Category URLs, mounted at /api/categories in app.js. Public: no login needed.
 */
const express = require('express');
const controller = require('../controllers/catalog.controller');

const router = express.Router();

router.get('/', controller.listCategories);

module.exports = router;
