/*
 * controllers/order.controller.js
 *
 * Handles the HTTP side of /api/orders: the order confirmation page (BE11)
 * My Orders (BE14), and cancelling your own order (BE16).
 */
const orderService = require('../services/order/order.service');
const cancellationService = require('../services/order/cancellation.service');
const AppError = require('../utils/AppError');

/*
 * GET /api/orders/confirmation/:token
 * Receives: req.params.token, the long random secret from verify / the email.
 * Returns: 200 { order } (the confirmation view), or 404 "Order not found."
 *          for a malformed, unknown or expired (over 30 days) token.
 */
async function getConfirmation(req, res) {
  const order = await orderService.getOrderByConfirmationToken(req.params.token);
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');

  // The page shows a name, phone and address. "no-store" tells browsers and
  // any proxy in between not to keep a copy of it.
  res.set('Cache-Control', 'no-store');
  res.json({ order });
}

/*
 * GET /api/orders?page=
 * Receives: req.user (requireAuth) and req.valid.query.page.
 * Returns: 200 with the standard page object of the user's OWN orders.
 */
async function listMine(req, res) {
  res.json(await orderService.listMyOrders(req.user.id, req.valid.query.page));
}

/*
 * GET /api/orders/:id
 * Receives: req.user and req.valid.params.id.
 * Returns: 200 { order } with details, history and refunds; or 404 if the
 *          order doesn't exist or isn't this user's (the same answer, so
 *          other people's order ids can't be discovered).
 */
async function getMine(req, res) {
  const order = await orderService.getMyOrder(req.user.id, req.valid.params.id);
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
  res.set('Cache-Control', 'no-store');
  res.json({ order });
}

/*
 * POST /api/orders/:id/cancel
 * Receives: req.user and req.valid.params.id. No body.
 * Returns: 200 { order } (the updated My Orders details: Cancelled, with the
 *          refund). If it was already cancelled, nothing changes and the
 *          answer adds message "This order is already cancelled." (so a double
 *          click is harmless).
 * Errors: 404 if it isn't this shopper's order; 409 if it has already shipped.
 */
async function cancelMine(req, res) {
  const { alreadyCancelled } = await cancellationService.cancelOrder({
    orderId: req.valid.params.id,
    actorUserId: req.user.id,
    ownerId: req.user.id, // the shopper can only cancel their OWN order
  });
  const order = await orderService.getMyOrder(req.user.id, req.valid.params.id);
  res.set('Cache-Control', 'no-store');
  res.json(alreadyCancelled ? { order, message: 'This order is already cancelled.' } : { order });
}

module.exports = { getConfirmation, listMine, getMine, cancelMine };
