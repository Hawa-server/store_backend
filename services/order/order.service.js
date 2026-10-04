/*
 * services/order/order.service.js
 *
 * Reading orders for shoppers:
 *   - the order confirmation page (BE11), opened with the long random
 *     confirmationToken that verify returns and the confirmation email links to;
 *   - "My Orders" (BE14): a logged-in shopper's own orders, list and details.
 * The loading and shaping helpers here are also used by the admin views
 * (adminOrder.service.js), so both always describe an order the same way.
 *
 * Ownership: My Orders always filters by the logged-in user's id, taken from
 * the login cookie. Another user's order is simply "not found".
 */
const { Order, OrderItem, OrderStatusChange, Refund, User, Product, ProductImage } = require('../../models');
const { toLimitOffset, toPage } = require('../../utils/pagination');
const { pickMainImage } = require('../catalog/catalog.service');
const { confirmationToken: tokenSchema } = require('../../validators/order.validators');

// Confirmation links stop working after this many days. The link is a
// "password" for the order that lives in an inbox; limiting its life limits
// the damage if the email is ever forwarded or the inbox is exposed.
const CONFIRMATION_LINK_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const MY_ORDERS_PAGE_SIZE = 10;

// An order's items, each with its product's images (for the thumbnail).
const ITEMS_INCLUDE = {
  model: OrderItem,
  as: 'items',
  include: [
    {
      model: Product,
      attributes: ['id'],
      include: [{ model: ProductImage, as: 'images', attributes: ['url', 'altText', 'sortOrder', 'isMain'] }],
    },
  ],
};

/*
 * loadOrderWithItems(where)
 * Receives: a Sequelize `where` for one order.
 * Returns: the Order with its items (and each product's images), or null.
 */
function loadOrderWithItems(where) {
  return Order.findOne({
    where,
    include: [ITEMS_INCLUDE],
    order: [[{ model: OrderItem, as: 'items' }, 'id', 'ASC']],
  });
}

/*
 * loadOrderDetails(where)
 * Receives: a Sequelize `where` for one order.
 * Returns: the Order with items, status history (with who made each change)
 *          and refunds (with who issued them), or null. History and refunds
 *          are sorted oldest first, so they read like a timeline.
 */
function loadOrderDetails(where) {
  return Order.findOne({
    where,
    include: [
      ITEMS_INCLUDE,
      {
        model: OrderStatusChange,
        as: 'statusHistory',
        include: [{ model: User, as: 'changedBy', attributes: ['id', 'name'] }],
      },
      { model: Refund, as: 'refunds', include: [{ model: User, as: 'issuedBy', attributes: ['id', 'name'] }] },
    ],
    order: [
      [{ model: OrderItem, as: 'items' }, 'id', 'ASC'],
      [{ model: OrderStatusChange, as: 'statusHistory' }, 'id', 'ASC'],
      [{ model: Refund, as: 'refunds' }, 'id', 'ASC'],
    ],
  });
}

/*
 * toItemView(item)
 * Receives: an OrderItem loaded with its Product's images.
 * Returns: the item as shown to people: the historical name and unit price
 *          (what was paid), the line total, and the product's current main image.
 */
function toItemView(item) {
  const images = item.Product ? [...item.Product.images].sort((a, b) => a.sortOrder - b.sortOrder) : [];
  return {
    productId: item.productId,
    name: item.productName,
    unitPriceGhs: item.unitPrice,
    quantity: item.quantity,
    lineTotalGhs: item.unitPrice * item.quantity,
    image: pickMainImage(images),
  };
}

/*
 * toConfirmationView(order)
 * Receives: an Order loaded with loadOrderWithItems.
 * Returns: the shape the confirmation page (and email) needs. Names and
 *          prices come from OrderItems: what was actually paid, even if the
 *          product's price or name changed later. Money is whole pesewas.
 */
function toConfirmationView(order) {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    placedAt: order.createdAt,
    items: order.items.map(toItemView),
    subtotalGhs: order.subtotal,
    deliveryFeeGhs: order.deliveryFee,
    totalGhs: order.total,
    currency: order.currency,
    paymentMethod: order.paymentMethod,
    email: order.email,
    delivery: { name: order.name, phone: order.phone, address: order.address },
  };
}

/*
 * getOrderByConfirmationToken(token)
 * Receives: the token from the URL (untrusted text).
 * Returns: the confirmation view, or null when the token is malformed,
 *          unknown, or the order is more than 30 days old. The caller answers
 *          the same 404 in all three cases, so a stranger learns nothing
 *          (not even whether a token ever existed).
 */
async function getOrderByConfirmationToken(token) {
  // Check the format before touching the database.
  if (!tokenSchema.safeParse(token).success) return null;

  const order = await loadOrderWithItems({ confirmationToken: token });
  if (!order) return null;
  if (Date.now() - order.createdAt.getTime() > CONFIRMATION_LINK_DAYS * DAY_MS) return null;
  return toConfirmationView(order);
}

/*
 * getConfirmationEmailData(orderId)
 * Receives: an order id (used right after the order is created).
 * Returns: { view, token, to } for the confirmation email, or null if missing.
 */
async function getConfirmationEmailData(orderId) {
  const order = await loadOrderWithItems({ id: orderId });
  if (!order) return null;
  return { view: toConfirmationView(order), token: order.confirmationToken, to: order.email };
}

/*
 * listMyOrders(userId, page)
 * Receives: the logged-in user's id and the page number (from 1).
 * Returns: the standard page object; each item is
 *          { id, orderNumber, placedAt, status, canCancel, totalGhs, itemCount, items },
 *          newest first, 10 per page. Only this user's orders, ever.
 */
async function listMyOrders(userId, page) {
  // Step 1: which orders are on this page (count + ids only; cheap and exact).
  const { count, rows } = await Order.findAndCountAll({
    where: { userId },
    attributes: ['id'],
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    ...toLimitOffset(page, MY_ORDERS_PAGE_SIZE),
  });

  // Step 2: load those orders with their items, then put them back in the
  // page's order (newest first).
  const ids = rows.map((row) => row.id);
  const orders = ids.length
    ? await Order.findAll({ where: { id: ids }, include: [ITEMS_INCLUDE], order: [[{ model: OrderItem, as: 'items' }, 'id', 'ASC']] })
    : [];
  const byId = new Map(orders.map((order) => [order.id, order]));

  const items = ids.map((id) => {
    const order = byId.get(id);
    const itemViews = order.items.map(toItemView);
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      placedAt: order.createdAt,
      status: order.status,
      // Shoppers can cancel only while the order is still Pending (BE16).
      canCancel: order.status === 'Pending',
      totalGhs: order.total,
      itemCount: itemViews.reduce((sum, item) => sum + item.quantity, 0),
      items: itemViews,
    };
  });
  return toPage(items, { page, pageSize: MY_ORDERS_PAGE_SIZE, totalItems: count });
}

/*
 * getMyOrder(userId, orderId)
 * Receives: the logged-in user's id and an order id from the URL.
 * Returns: the order details (the confirmation view plus id, status history
 *          and refunds), or null if it doesn't exist OR belongs to someone
 *          else. Both cases look the same to the caller (404), so nobody can
 *          probe which order ids exist.
 */
async function getMyOrder(userId, orderId) {
  const order = await loadOrderDetails({ id: orderId, userId });
  if (!order) return null;
  return {
    id: order.id,
    ...toConfirmationView(order),
    canCancel: order.status === 'Pending',
    // For shoppers: what changed and when, but not which staff member did it.
    statusHistory: order.statusHistory.map((change) => ({
      fromStatus: change.fromStatus,
      toStatus: change.toStatus,
      changedAt: change.createdAt,
    })),
    // Shoppers see their refunds, but not internal details such as Paystack's
    // refund id or error messages.
    refunds: order.refunds.map((refund) => ({
      id: refund.id,
      amountGhs: refund.amount,
      type: refund.type,
      status: refund.status,
      reason: refund.reason,
      createdAt: refund.createdAt,
    })),
  };
}

module.exports = {
  CONFIRMATION_LINK_DAYS,
  getOrderByConfirmationToken,
  getConfirmationEmailData,
  listMyOrders,
  getMyOrder,
  // Shared with adminOrder.service.js:
  loadOrderDetails,
  toItemView,
};
