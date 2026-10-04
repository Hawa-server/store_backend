/*
 * routes/admin.routes.js
 *
 * Admin URLs, mounted at /api/admin in app.js. The two lines below protect
 * EVERY route in this file: first "are you logged in?" (401 if not), then
 * "are you an admin?" (403 if not). Adding a route here can't forget them.
 */
const express = require('express');
const controller = require('../controllers/admin.controller');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const validate = require('../middleware/validate');
const { adminOrdersQuery, orderIdParams, statusChangeBody } = require('../validators/order.validators');
const { issueRefundBody, refundParams } = require('../validators/refund.validators');
const { dashboardQuery, thresholdBody } = require('../validators/admin.validators');
const {
  adminReviewsQuery, moderationReasonBody, unhideBody, reviewIdParams,
} = require('../validators/review.validators');

const router = express.Router();
router.use(requireAuth, requireAdmin);

// Dashboard and settings (BE20)
router.get('/dashboard', validate({ query: dashboardQuery }), controller.getDashboard);
router.patch('/settings/low-stock-threshold', validate({ body: thresholdBody }), controller.updateLowStockThreshold);

router.get('/orders', validate({ query: adminOrdersQuery }), controller.listOrders);
router.get('/orders/:id', validate({ params: orderIdParams }), controller.getOrder);
router.patch(
  '/orders/:id/status',
  validate({ params: orderIdParams, body: statusChangeBody }),
  controller.changeStatus
);
router.post('/orders/:id/refunds', validate({ params: orderIdParams, body: issueRefundBody }), controller.issueRefund);
router.post('/orders/:id/refunds/:refundId/retry', validate({ params: refundParams }), controller.retryRefund);

// Review moderation (BE19)
router.get('/reviews', validate({ query: adminReviewsQuery }), controller.listReviews);
router.patch('/reviews/:id/hide', validate({ params: reviewIdParams, body: moderationReasonBody }), controller.hideReview);
router.patch('/reviews/:id/unhide', validate({ params: reviewIdParams, body: unhideBody }), controller.unhideReview);
router.delete('/reviews/:id', validate({ params: reviewIdParams, body: moderationReasonBody }), controller.deleteReview);

module.exports = router;
