/*
 * routes/wishlist.routes.js
 *
 * The wishlist (BE28), mounted at /api/wishlist in app.js. Logged-in shoppers
 * only: router.use(requireAuth) protects every route below (401 if logged
 * out). Changes are rate-limited per USER, so the limiter comes after
 * requireAuth (which sets req.user).
 */
const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/wishlist.controller');
const requireAuth = require('../middleware/requireAuth');
const validate = require('../middleware/validate');
const { wishlistLimiter } = require('../middleware/rateLimits');
const { page, publicId } = require('../validators/common.validators');

const router = express.Router();
router.use(requireAuth);

// :productId is the product's public UUID; anything else becomes null, so
// saving answers 404 "Product not found." (see common.validators.js).
const productParams = z.object({ productId: publicId });
const listQuery = z.object({ page });

router.get('/', validate({ query: listQuery }), controller.list);
router.get('/ids', controller.ids);
router.put('/:productId', wishlistLimiter, validate({ params: productParams }), controller.save);
router.delete('/:productId', wishlistLimiter, validate({ params: productParams }), controller.remove);

module.exports = router;
