/*
 * routes/products.routes.js
 *
 * Product URLs, mounted at /api/products in app.js. Public: no login needed.
 * Product details use optionalAuth so logged-in shoppers get a little extra
 * (whether they can review the product), while guests still get the page.
 * Reviews (BE18): the list is public; writing one needs a login.
 */
const express = require('express');
const controller = require('../controllers/catalog.controller');
const validate = require('../middleware/validate');
const optionalAuth = require('../middleware/optionalAuth');
const { productListQuery, productIdParams } = require('../validators/catalog.validators');
const reviewController = require('../controllers/review.controller');
const requireAuth = require('../middleware/requireAuth');
const { reviewLimiter } = require('../middleware/rateLimits');
const { listReviewsQuery, createReviewBody } = require('../validators/review.validators');

const router = express.Router();

router.get('/', validate({ query: productListQuery }), controller.listProducts);
router.get('/:id', validate({ params: productIdParams }), optionalAuth, controller.getProduct);
router.get('/:id/reviews', validate({ params: productIdParams, query: listReviewsQuery }), reviewController.listForProduct);
router.post(
  '/:id/reviews',
  reviewLimiter,
  requireAuth,
  validate({ params: productIdParams, body: createReviewBody }),
  reviewController.create
);

module.exports = router;
