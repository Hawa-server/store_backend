/*
 * services/order/orderStatus.service.js
 *
 * The ONE place where an order's status changes (BE15). An order moves
 * through a small "state machine":
 *
 *     Pending ──► Shipped ──► Delivered
 *        │
 *        └──► Cancelled   (only through the cancellation service, BE16,
 *                          because it must also restore stock and refund)
 *
 * Anything else (going backwards, skipping a step, changing a Cancelled or
 * Delivered order) is refused. Every change is recorded in OrderStatusChanges
 * with who made it, and the shopper is emailed AFTER the change is saved.
 */
const { sequelize, Order, OrderStatusChange } = require('../../models');
const AppError = require('../../utils/AppError');
// Used as emailService.sendEmailSafely(...) (not destructured) so tests can replace it.
const emailService = require('../email/email.service');
const orderShippedEmail = require('../email/templates/orderShipped');
const orderDeliveredEmail = require('../email/templates/orderDelivered');
const { getConfirmationEmailData } = require('./order.service');

// Which status can follow which. Pending → Cancelled is NOT listed here: it's
// handled by the cancellation service (cancellation.service.js), because
// cancelling must also restore stock and refund, all in one transaction.
const ALLOWED_NEXT = {
  Pending: ['Shipped'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

const EMAIL_TEMPLATES = { Shipped: orderShippedEmail, Delivered: orderDeliveredEmail };

/*
 * orderLink(order, token)
 * Receives: the Order and its confirmation token.
 * Returns: the link for the status email. Shoppers with an account go to the
 *          order in My Orders, which never expires. Guests have no account,
 *          so they get the confirmation page link (valid 30 days from the order).
 */
function orderLink(order, token) {
  return order.userId
    ? `${process.env.CLIENT_URL}/orders/${order.id}`
    : `${process.env.CLIENT_URL}/order/confirmation/${token}`;
}

/*
 * sendStatusEmail(orderId, status)
 * Call AFTER the status change has been committed.
 * Receives: the order id and its new status ('Shipped' or 'Delivered').
 * Returns: a promise that always resolves. A failed email is logged and
 *          never undoes the status change.
 */
async function sendStatusEmail(orderId, status) {
  try {
    const template = EMAIL_TEMPLATES[status];
    const order = await Order.findByPk(orderId);
    const data = await getConfirmationEmailData(orderId);
    if (!template || !order || !data) return;
    await emailService.sendEmailSafely(
      {
        to: data.to,
        ...template({ order: data.view, link: orderLink(order, data.token), hasAccount: Boolean(order.userId) }),
      },
      `order ${status.toLowerCase()}`
    );
  } catch (err) {
    console.error(`[email] order ${status} email failed:`, err.message);
  }
}

/*
 * changeOrderStatus(orderId, toStatus, adminUserId)
 * Receives: the order id, the new status ('Shipped' or 'Delivered'), and the
 *           id of the admin making the change.
 * Returns: nothing once the change is saved (the email is then sent in the
 *          background).
 * Throws: 404 if the order doesn't exist; 409 CONFLICT if the change isn't
 *         allowed from the order's CURRENT status (including "already that
 *         status", so a double click never sends a second email).
 */
async function changeOrderStatus(orderId, toStatus, adminUserId) {
  await sequelize.transaction(async (transaction) => {
    // Lock the order row: if two admins click at the same moment, the second
    // waits here, then sees the NEW status and is refused. No double change,
    // no double email.
    const order = await Order.findByPk(orderId, { lock: transaction.LOCK.UPDATE, transaction });
    if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');

    const fromStatus = order.status;
    if (fromStatus === toStatus) {
      throw new AppError(409, 'CONFLICT', `This order is already ${toStatus}.`);
    }
    if (!ALLOWED_NEXT[fromStatus].includes(toStatus)) {
      throw new AppError(409, 'CONFLICT', `This order can't be changed from ${fromStatus} to ${toStatus}.`);
    }

    await order.update({ status: toStatus }, { transaction });
    // The history entry is saved in the SAME transaction, so a status can
    // never change without a record of who changed it.
    await OrderStatusChange.create({ orderId, fromStatus, toStatus, changedByUserId: adminUserId }, { transaction });
  });

  // Committed. Now the email, in the background (not awaited).
  sendStatusEmail(orderId, toStatus);
}

module.exports = { changeOrderStatus, orderLink, ALLOWED_NEXT };
