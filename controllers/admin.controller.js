/*
 * controllers/admin.controller.js
 *
 * Handles the HTTP side of /api/admin. Every route here has already passed
 * requireAuth + requireAdmin (see routes/admin.routes.js).
 * BE14: orders list and details. Later tasks add status changes (BE15),
 * refunds (BE17), review moderation (BE19) and the dashboard (BE20).
 * BE23 adds products; BE24 adds delivery areas (fees and towns).
 */
const adminOrderService = require('../services/order/adminOrder.service');
const orderStatusService = require('../services/order/orderStatus.service');
const cancellationService = require('../services/order/cancellation.service');
const adminRefundService = require('../services/refund/adminRefund.service');
const moderationService = require('../services/review/reviewModeration.service');
const dashboardService = require('../services/dashboard/dashboard.service');
const settingsService = require('../services/settings/settings.service');
const adminProductService = require('../services/product/adminProduct.service');
const adminDeliveryService = require('../services/delivery/adminDelivery.service');
const adminDiscountService = require('../services/discount/adminDiscount.service');
const announcementService = require('../services/announcement/announcement.service');
const AppError = require('../utils/AppError');
const { findOrderId } = require('../services/order/order.service');

/*
 * orderIdFromUrl(req)
 * Receives: the request; req.valid.params.id is the order's public UUID
 *           (BE26), or null if the address didn't hold one.
 * Returns: the order's internal id (the counting number), which the services
 *          use for joins and locks. Throws 404 "Order not found." if there's
 *          no such order, the same answer for "9", "abc" or an unknown UUID.
 */
async function orderIdFromUrl(req) {
  const orderId = await findOrderId(req.valid.params.id, null);
  if (!orderId) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
  return orderId;
}

/*
 * GET /api/admin/orders?status=&from=&to=&page=
 * Receives: req.valid.query = { status?, from?, to?, page }.
 * Returns: 200 with the standard page object (20 per page, newest first).
 */
async function listOrders(req, res) {
  res.json(await adminOrderService.listOrders(req.valid.query));
}

/*
 * GET /api/admin/orders/:id
 * Receives: req.valid.params.id.
 * Returns: 200 { order } with everything staff need, or 404.
 */
async function getOrder(req, res) {
  const order = await adminOrderService.getOrder(await orderIdFromUrl(req));
  res.set('Cache-Control', 'no-store');
  res.json({ order });
}

/*
 * PATCH /api/admin/orders/:id/status
 * Receives: req.valid.params.id, req.valid.body.status ('Shipped',
 *           'Delivered' or 'Cancelled'), and req.user (the admin).
 * Returns: 200 { order } with the updated admin view (new status and history).
 * 'Cancelled' goes through the SAME cancellation service shoppers use
 * (restores stock and refunds). Cancelling an already-cancelled order is a
 * 409, matching the "already Shipped" rule of the other statuses.
 */
async function changeStatus(req, res) {
  const id = await orderIdFromUrl(req);
  if (req.valid.body.status === 'Cancelled') {
    const { alreadyCancelled } = await cancellationService.cancelOrder({ orderId: id, actorUserId: req.user.id, ownerId: null });
    if (alreadyCancelled) throw new AppError(409, 'CONFLICT', 'This order is already Cancelled.');
  } else {
    await orderStatusService.changeOrderStatus(id, req.valid.body.status, req.user.id);
  }
  const order = await adminOrderService.getOrder(id);
  res.set('Cache-Control', 'no-store');
  res.json({ order });
}

/*
 * toRefundView(refund)
 * Receives: a Refund. Returns: the admin's view of it.
 */
function toRefundView(refund) {
  return {
    id: refund.id,
    amountGhs: refund.amount,
    type: refund.type,
    status: refund.status,
    reason: refund.reason,
    providerReference: refund.providerReference,
    failureReason: refund.failureReason,
    createdAt: refund.createdAt,
  };
}

/*
 * POST /api/admin/orders/:id/refunds
 * Receives: req.valid.body = { type: 'full' | 'partial', amount? (pesewas,
 *           partial only), reason }, and req.user (the admin).
 * Returns: 201 { order, refund }. The refund is saved even if Paystack
 *          refuses it: then refund.status is 'failed' with failureReason,
 *          and it can be retried.
 */
async function issueRefund(req, res) {
  const orderId = await orderIdFromUrl(req);
  const refund = await adminRefundService.issueRefund({ orderId, ...req.valid.body, adminId: req.user.id });
  const order = await adminOrderService.getOrder(orderId);
  res.set('Cache-Control', 'no-store');
  res.status(201).json({ order, refund: toRefundView(refund) });
}

/*
 * POST /api/admin/orders/:id/refunds/:refundId/retry
 * Receives: req.valid.params = { id, refundId }.
 * Returns: 200 { order, refund } after the retry ('processed', or 'failed'
 *          again with the new reason).
 */
async function retryRefund(req, res) {
  const orderId = await orderIdFromUrl(req);
  const refund = await adminRefundService.retryRefund({ orderId, refundId: req.valid.params.refundId });
  const order = await adminOrderService.getOrder(orderId);
  res.set('Cache-Control', 'no-store');
  res.json({ order, refund: toRefundView(refund) });
}

/*
 * GET /api/admin/reviews?status=&page=
 * Receives: req.valid.query = { status?, page }.
 * Returns: 200 with the standard page object (20 per page, newest first).
 */
async function listReviews(req, res) {
  res.json(await moderationService.listReviews(req.valid.query));
}

/*
 * PATCH /api/admin/reviews/:id/hide
 * Receives: req.valid.params.id, req.valid.body.reason, req.user (the admin).
 * Returns: 200 { review } (admin view, now hidden).
 */
async function hideReview(req, res) {
  res.json({ review: await moderationService.hideReview(req.valid.params.id, req.valid.body.reason, req.user.id) });
}

/*
 * PATCH /api/admin/reviews/:id/unhide
 * Receives: req.valid.params.id, optional req.valid.body.reason, req.user.
 * Returns: 200 { review } (admin view, visible again).
 */
async function unhideReview(req, res) {
  res.json({ review: await moderationService.unhideReview(req.valid.params.id, req.valid.body.reason, req.user.id) });
}

/*
 * DELETE /api/admin/reviews/:id
 * Receives: req.valid.params.id, req.valid.body.reason, req.user.
 * Returns: 200 { message }. The review is gone permanently.
 */
async function deleteReview(req, res) {
  await moderationService.deleteReview(req.valid.params.id, req.valid.body.reason, req.user.id);
  res.json({ message: 'Review deleted.' });
}

/*
 * GET /api/admin/dashboard?period=today|7d|30d|all
 * Receives: req.valid.query.period (default '7d').
 * Returns: 200 with the dashboard figures (see dashboard.service.js).
 */
async function getDashboard(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json(await dashboardService.getDashboard(req.valid.query.period));
}

/*
 * PATCH /api/admin/settings/low-stock-threshold
 * Receives: req.valid.body.value (whole number 0–1,000).
 * Returns: 200 { lowStockThreshold }.
 */
async function updateLowStockThreshold(req, res) {
  res.json({ lowStockThreshold: await settingsService.setLowStockThreshold(req.valid.body.value) });
}

/*
 * GET /api/admin/products?search=&category=&status=&page=
 * Receives: req.valid.query = { search?, category?, status?, page }.
 * Returns: 200 with the standard page object (20 per page, A–Z).
 */
async function listProducts(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json(await adminProductService.listProducts(req.valid.query));
}

/*
 * GET /api/admin/products/:id
 * Receives: req.valid.params.id.
 * Returns: 200 { product } (admin detail, inactive products too), or 404.
 */
async function getProduct(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ product: await adminProductService.getProduct(req.valid.params.id) });
}

/*
 * POST /api/admin/products
 * Receives: req.valid.body (name, description, categoryId, priceGhs, stock,
 *           isActive, image) and req.user (the admin).
 * Returns: 201 { product }.
 */
async function createProduct(req, res) {
  res.status(201).json({ product: await adminProductService.createProduct(req.valid.body, req.user.id) });
}

/*
 * PATCH /api/admin/products/:id
 * Receives: req.valid.params.id and req.valid.body (any editable fields;
 *           expectedStock when stock is sent), and req.user.
 * Returns: 200 { product }.
 */
async function updateProduct(req, res) {
  res.json({ product: await adminProductService.updateProduct(req.valid.params.id, req.valid.body, req.user.id) });
}

/*
 * GET /api/admin/delivery-areas
 * Receives: nothing.
 * Returns: 200 { regions }: every region and town, hidden ones too, with raw
 *          fees (a town's null fee = it uses the region's fee).
 */
async function listDeliveryAreas(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json(await adminDeliveryService.listAll());
}

/*
 * PATCH /api/admin/delivery-regions/:id
 * Receives: req.valid.params.id, req.valid.body = { feePesewas?, isActive? }, req.user.
 * Returns: 200 { region } (with its towns).
 */
async function updateDeliveryRegion(req, res) {
  res.json({ region: await adminDeliveryService.updateRegion(req.valid.params.id, req.valid.body, req.user.id) });
}

/*
 * POST /api/admin/delivery-towns
 * Receives: req.valid.body = { regionId, name, feePesewas (null = region's fee) }, req.user.
 * Returns: 201 { town }.
 */
async function createDeliveryTown(req, res) {
  res.status(201).json({ town: await adminDeliveryService.createTown(req.valid.body, req.user.id) });
}

/*
 * PATCH /api/admin/delivery-towns/:id
 * Receives: req.valid.params.id, req.valid.body = { name?, feePesewas? (null
 *           allowed), isActive? }, req.user.
 * Returns: 200 { town }.
 */
async function updateDeliveryTown(req, res) {
  res.json({ town: await adminDeliveryService.updateTown(req.valid.params.id, req.valid.body, req.user.id) });
}

/*
 * GET /api/admin/discount-codes?status=&page=   (BE29)
 * Receives: req.valid.query = { status?, page }.
 * Returns: 200 with the standard page object (newest first, 20 per page).
 */
async function listDiscountCodes(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json(await adminDiscountService.listCodes(req.valid.query));
}

/*
 * GET /api/admin/discount-codes/:id   (BE29)
 * Receives: req.valid.params.id. Returns: 200 { discountCode } with its latest redemptions.
 */
async function getDiscountCode(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ discountCode: await adminDiscountService.getCode(req.valid.params.id) });
}

/*
 * POST /api/admin/discount-codes   (BE29)
 * Receives: req.valid.body (the new code) and req.user (the admin).
 * Returns: 201 { discountCode }.
 */
async function createDiscountCode(req, res) {
  res.status(201).json({ discountCode: await adminDiscountService.createCode(req.valid.body, req.user.id) });
}

/*
 * PATCH /api/admin/discount-codes/:id   (BE29)
 * Receives: req.valid.params.id, req.valid.body (fields to change), req.user.
 * Returns: 200 { discountCode }.
 */
async function updateDiscountCode(req, res) {
  res.json({ discountCode: await adminDiscountService.updateCode(req.valid.params.id, req.valid.body, req.user.id) });
}

/*
 * GET /api/admin/announcement   (BE30)
 * Receives: nothing. Returns: 200 { announcement } with the saved settings,
 *           the linked code and whether the bar is showing (and why not).
 */
async function getAnnouncement(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ announcement: await announcementService.adminAnnouncement() });
}

/*
 * PUT /api/admin/announcement   (BE30)
 * Receives: req.valid.body = { enabled, message, codeId, endsAt } and req.user.
 * Returns: 200 { announcement } (the admin view after saving).
 */
async function saveAnnouncement(req, res) {
  res.json({ announcement: await announcementService.saveAnnouncement(req.valid.body, req.user.id) });
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  getDashboard,
  updateLowStockThreshold,
  listOrders,
  getOrder,
  changeStatus,
  issueRefund,
  retryRefund,
  listReviews,
  hideReview,
  unhideReview,
  deleteReview,
  listDeliveryAreas,
  updateDeliveryRegion,
  createDeliveryTown,
  updateDeliveryTown,
  listDiscountCodes,
  getDiscountCode,
  createDiscountCode,
  updateDiscountCode,
  getAnnouncement,
  saveAnnouncement,
};
