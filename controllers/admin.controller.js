/*
 * controllers/admin.controller.js
 *
 * Handles the HTTP side of /api/admin. Every route here has already passed
 * requireAuth + requireAdmin (see routes/admin.routes.js).
 * BE14: orders list and details. Later tasks add status changes (BE15),
 * refunds (BE17), review moderation (BE19) and the dashboard (BE20).
 */
const adminOrderService = require('../services/order/adminOrder.service');
const orderStatusService = require('../services/order/orderStatus.service');
const cancellationService = require('../services/order/cancellation.service');
const adminRefundService = require('../services/refund/adminRefund.service');
const moderationService = require('../services/review/reviewModeration.service');
const dashboardService = require('../services/dashboard/dashboard.service');
const settingsService = require('../services/settings/settings.service');
const AppError = require('../utils/AppError');

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
  const order = await adminOrderService.getOrder(req.valid.params.id);
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
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
  const { id } = req.valid.params;
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
  const refund = await adminRefundService.issueRefund({ orderId: req.valid.params.id, ...req.valid.body, adminId: req.user.id });
  const order = await adminOrderService.getOrder(req.valid.params.id);
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
  const refund = await adminRefundService.retryRefund({ orderId: req.valid.params.id, refundId: req.valid.params.refundId });
  const order = await adminOrderService.getOrder(req.valid.params.id);
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

module.exports = {
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
};
