/*
 * routes/reviews.routes.js
 *
 * Your own reviews, mounted at /api/reviews in app.js (BE18). Login needed;
 * the service only ever finds reviews that belong to the logged-in user.
 * Writing a new review lives under /api/products/:id/reviews.
 */
const express = require('express');
const controller = require('../controllers/review.controller');
const requireAuth = require('../middleware/requireAuth');
const validate = require('../middleware/validate');
const { reviewLimiter } = require('../middleware/rateLimits');
const { updateReviewBody, reviewIdParams } = require('../validators/review.validators');

const router = express.Router();

router.patch('/:id', reviewLimiter, requireAuth, validate({ params: reviewIdParams, body: updateReviewBody }), controller.update);
router.delete('/:id', reviewLimiter, requireAuth, validate({ params: reviewIdParams }), controller.remove);

module.exports = router;
