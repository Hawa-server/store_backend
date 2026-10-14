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
const { adminProductsQuery, createProductBody, updateProductBody } = require('../validators/adminProduct.validators');
const { productIdParams } = require('../validators/catalog.validators');
const {
  regionParams, updateRegionBody, createTownBody, townParams, updateTownBody,
} = require('../validators/delivery.validators');
const {
  createDiscountBody, updateDiscountBody, discountListQuery, discountIdParams,
} = require('../validators/discount.validators');
const {
  adminReviewsQuery, moderationReasonBody, unhideBody, reviewIdParams,
} = require('../validators/review.validators');

const router = express.Router();
router.use(requireAuth, requireAdmin);

// Dashboard and settings (BE20)
router.get('/dashboard', validate({ query: dashboardQuery }), controller.getDashboard);
router.patch('/settings/low-stock-threshold', validate({ body: thresholdBody }), controller.updateLowStockThreshold);

// Products (BE23): list, view, add, edit. No delete: products are deactivated.
router.get('/products', validate({ query: adminProductsQuery }), controller.listProducts);
router.get('/products/:id', validate({ params: productIdParams }), controller.getProduct);
router.post('/products', validate({ body: createProductBody }), controller.createProduct);
router.patch('/products/:id', validate({ params: productIdParams, body: updateProductBody }), controller.updateProduct);

// Delivery areas (BE24): fees, towns, hide/show. No deletes, and regions
// aren't added or renamed (the seeder creates Ghana's 16 regions).
router.get('/delivery-areas', controller.listDeliveryAreas);
router.patch('/delivery-regions/:id', validate({ params: regionParams, body: updateRegionBody }), controller.updateDeliveryRegion);
router.post('/delivery-towns', validate({ body: createTownBody }), controller.createDeliveryTown);
router.patch('/delivery-towns/:id', validate({ params: townParams, body: updateTownBody }), controller.updateDeliveryTown);

// Discount codes (BE29): list, view, create, edit. No deletes (switch off instead).
router.get('/discount-codes', validate({ query: discountListQuery }), controller.listDiscountCodes);
router.get('/discount-codes/:id', validate({ params: discountIdParams }), controller.getDiscountCode);
router.post('/discount-codes', validate({ body: createDiscountBody }), controller.createDiscountCode);
router.patch('/discount-codes/:id', validate({ params: discountIdParams, body: updateDiscountBody }), controller.updateDiscountCode);

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
