/*
 * services/order/adminOrder.service.js
 *
 * Orders as the ADMIN sees them (BE14): every order, with filters, and full
 * details including the payment reference and refunds. Only reachable
 * through /api/admin routes, which require an admin (middleware/requireAdmin.js).
 *
 * Refund status (none / partial / full) is CALCULATED from the order's
 * Refund rows each time, never stored, so it can never disagree with them.
 */
const { fn, col, Op } = require('sequelize');
const { Order, Refund } = require('../../models');
const { toLimitOffset, toPage } = require('../../utils/pagination');
const { accraDayRange } = require('../../utils/dates');
const { loadOrderDetails, toItemView } = require('./order.service');
const { COUNTED_REFUND_STATUSES } = require('../refund/refund.service');

const ADMIN_PAGE_SIZE = 20;

/*
 * refundStatus(totalGhs, refundedGhs)
 * Receives: the order total and the sum of its counted refunds (pesewas).
 * Returns: 'none', 'partial' or 'full'.
 */
function refundStatus(totalGhs, refundedGhs) {
  if (refundedGhs <= 0) return 'none';
  return refundedGhs >= totalGhs ? 'full' : 'partial';
}

/*
 * refundedByOrder(orderIds)
 * Receives: a list of order ids.
 * Returns: a Map orderId → pesewas refunded (requested + processed refunds),
 *          using ONE grouped query for the whole page instead of one per order.
 */
async function refundedByOrder(orderIds) {
  if (!orderIds.length) return new Map();
  const rows = await Refund.findAll({
    attributes: ['orderId', [fn('SUM', col('amount')), 'refunded']],
    where: { orderId: orderIds, status: COUNTED_REFUND_STATUSES },
    group: ['orderId'],
    raw: true,
  });
  return new Map(rows.map((row) => [row.orderId, Number(row.refunded)]));
}

/*
 * listOrders({ status, from, to, page })
 * Receives: validated filters: an optional status, optional Ghana-time days
 *           'YYYY-MM-DD' (both included), and the page number.
 * Returns: the standard page object (20 per page, newest first). Each item:
 *          { id, orderNumber, placedAt, customer, totalGhs, status,
 *            refundStatus, refundedGhs }.
 */
async function listOrders({ status, from, to, page }) {
  const where = {};
  if (status) where.status = status;

  // Days are Ghana days; the database stores UTC. accraDayRange turns
  // "2026-09-01 to 2026-09-30" into [Sep 1 00:00 Accra, Oct 1 00:00 Accra).
  const { start, end } = accraDayRange(from, to);
  if (start || end) {
    where.createdAt = {};
    if (start) where.createdAt[Op.gte] = start;
    if (end) where.createdAt[Op.lt] = end;
  }

  const { count, rows } = await Order.findAndCountAll({
    where,
    attributes: ['id', 'orderNumber', 'createdAt', 'userId', 'name', 'email', 'total', 'status'],
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    ...toLimitOffset(page, ADMIN_PAGE_SIZE),
  });
  const refunded = await refundedByOrder(rows.map((order) => order.id));

  const items = rows.map((order) => {
    const refundedGhs = refunded.get(order.id) || 0;
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      placedAt: order.createdAt,
      customer: { name: order.name, email: order.email, userId: order.userId, isGuest: order.userId === null },
      totalGhs: order.total,
      status: order.status,
      refundStatus: refundStatus(order.total, refundedGhs),
      refundedGhs,
    };
  });
  return toPage(items, { page, pageSize: ADMIN_PAGE_SIZE, totalItems: count });
}

/*
 * getOrder(orderId)
 * Receives: an order id.
 * Returns: everything an admin needs to handle the order, or null if it
 *          doesn't exist: items, contact details and address, payment
 *          reference, status history (who and when), and refunds (including
 *          Paystack's refund id and any failure reason, for staff to act on).
 */
async function getOrder(orderId) {
  const order = await loadOrderDetails({ id: orderId });
  if (!order) return null;

  const refundedGhs = order.refunds
    .filter((refund) => COUNTED_REFUND_STATUSES.includes(refund.status))
    .reduce((sum, refund) => sum + refund.amount, 0);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    placedAt: order.createdAt,
    status: order.status,
    customer: { name: order.name, email: order.email, phone: order.phone, userId: order.userId, isGuest: order.userId === null },
    deliveryAddress: order.address,
    items: order.items.map(toItemView),
    subtotalGhs: order.subtotal,
    deliveryFeeGhs: order.deliveryFee,
    totalGhs: order.total,
    currency: order.currency,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    refundStatus: refundStatus(order.total, refundedGhs),
    refundedGhs,
    statusHistory: order.statusHistory.map((change) => ({
      fromStatus: change.fromStatus,
      toStatus: change.toStatus,
      changedAt: change.createdAt,
      // null = the system (e.g. the order being created after payment).
      changedBy: change.changedBy ? { id: change.changedBy.id, name: change.changedBy.name } : null,
    })),
    refunds: order.refunds.map((refund) => ({
      id: refund.id,
      amountGhs: refund.amount,
      type: refund.type,
      status: refund.status,
      reason: refund.reason,
      providerReference: refund.providerReference,
      failureReason: refund.failureReason,
      issuedBy: refund.issuedBy ? { id: refund.issuedBy.id, name: refund.issuedBy.name } : null,
      createdAt: refund.createdAt,
    })),
  };
}

module.exports = { listOrders, getOrder, refundStatus };
