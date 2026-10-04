/*
 * services/order/fulfilment.service.js
 *
 * Turns a PAID checkout into an order. Called only after Paystack has
 * confirmed the payment on the server (payment.service.js), never before and
 * never inside the Paystack call itself.
 *
 * Everything happens in ONE database transaction: either the order, its items,
 * its first status, the stock changes, the checkout update and the cart
 * clean-up are ALL saved, or none of them are.
 *
 * It's idempotent: calling it again for the same checkout (a second verify,
 * or a duplicate webhook) returns the order that already exists instead of
 * creating another one.
 *
 * BE9 adds what happens when stock ran out after payment (refund + email).
 * BE10 adds late duplicate payments: see step 1b.
 */
const {
  sequelize, Sequelize, Checkout, CheckoutItem, Product, Order, OrderItem, OrderStatusChange, Cart, CartItem,
} = require('../../models');
const AppError = require('../../utils/AppError');
const withDeadlockRetry = require('../../utils/withDeadlockRetry');
const { createRandomToken } = require('../../utils/tokens');
const { createOrderNumber } = require('../../utils/orderNumber');

/*
 * fulfilCheckout(checkoutId)
 * Receives: the id of a checkout whose payment Paystack has confirmed.
 * Returns: { order, alreadyFulfilled }. alreadyFulfilled is true when the
 *          order had already been created by an earlier call.
 *          Or { duplicate: true } (nothing saved) when a NEWER checkout for
 *          the same cart has already been paid: this payment is a late
 *          duplicate, and payment.service.js refunds it.
 * Throws: 409 OUT_OF_STOCK if a product no longer has enough stock (BE9
 *         turns this into a refund). Any error rolls back everything.
 */
async function fulfilCheckout(checkoutId) {
  return withDeadlockRetry(() =>
    sequelize.transaction(async (transaction) => {
      const lock = transaction.LOCK.UPDATE;

      // 1. Lock the checkout row. If verify and the webhook arrive at the same
      //    moment, the second one waits here, then sees 'paid' and stops.
      const checkout = await Checkout.findByPk(checkoutId, { lock, transaction });
      if (checkout.status === 'paid') {
        return { order: await Order.findByPk(checkout.orderId, { transaction }), alreadyFulfilled: true };
      }

      // 1b. Late duplicate payment (BE10). Example: the shopper's first
      //     payment seemed to fail, so they started a new checkout and paid
      //     that one (an order was created). Then the FIRST payment is
      //     approved late on their phone. It's the same cart, so it would be
      //     the same items again: refund it instead of making a second order.
      //     Locking the cart row makes payments for the same cart take turns
      //     here, so the check below always sees the other one's result.
      //     (No cart any more, e.g. a guest cart merged at login: nothing to
      //     compare with, so fulfil normally.)
      if (checkout.cartId) {
        await Cart.findByPk(checkout.cartId, { lock, transaction });
        const newerPaid = await Checkout.findOne({
          where: { cartId: checkout.cartId, status: 'paid', id: { [Sequelize.Op.gt]: checkout.id } },
          lock, // a locking read sees the latest committed rows
          transaction,
        });
        if (newerPaid) return { duplicate: true };
      }

      // 2. What was paid for: the snapshot saved at checkout, not the cart.
      const items = await CheckoutItem.findAll({ where: { checkoutId }, order: [['productId', 'ASC']], transaction });
      if (!items.length) throw new Error(`Checkout ${checkout.reference} has no items.`);

      // Lock the product rows (always in id order, to avoid deadlocks), so no
      // other purchase can change their stock until we commit.
      const products = await Product.findAll({
        where: { id: items.map((item) => item.productId) },
        order: [['id', 'ASC']],
        lock,
        transaction,
      });
      const productById = new Map(products.map((p) => [p.id, p]));

      // 3. Final stock check, now that nobody else can change it.
      for (const item of items) {
        const product = productById.get(item.productId);
        if (product.stock < item.quantity) {
          throw new AppError(409, 'OUT_OF_STOCK', `${item.productName} sold out before your payment was confirmed.`);
        }
      }

      // 4. The order. Contact details and amounts are copied from the checkout,
      //    exactly as they were when the shopper paid.
      const order = await Order.create(
        {
          orderNumber: createOrderNumber(),
          userId: checkout.userId,
          email: checkout.email,
          name: checkout.name,
          phone: checkout.phone,
          address: checkout.address,
          subtotal: checkout.subtotal,
          deliveryFee: checkout.deliveryFee,
          total: checkout.total,
          currency: 'GHS',
          paymentMethod: 'mobile_money',
          // UNIQUE in the database: a second order for the same payment is impossible.
          paymentReference: checkout.reference,
          // Long random secret for the confirmation page link (BE11).
          confirmationToken: createRandomToken(),
          status: 'Pending',
        },
        { transaction }
      );

      // 5. Its items, with the historical names and prices that were paid.
      await OrderItem.bulkCreate(
        items.map((item) => ({
          orderId: order.id,
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        })),
        { transaction }
      );

      // 6. The first entry in the order's history (no "from" status; made by the system).
      await OrderStatusChange.create(
        { orderId: order.id, fromStatus: null, toStatus: 'Pending', changedByUserId: null },
        { transaction }
      );

      // 7. Take the stock. The rows are locked and were just checked, so this
      //    can't go below 0 (the UNSIGNED column would refuse it anyway).
      for (const item of items) {
        await productById.get(item.productId).decrement('stock', { by: item.quantity, transaction });
      }

      // 8. Mark the checkout paid and link it to its order (Checkouts.orderId is UNIQUE).
      await checkout.update({ status: 'paid', orderId: order.id }, { transaction });

      // 9. Clear what was bought from the cart. Only the purchased quantities
      //    are removed, so anything added to the cart after checkout stays.
      //    (If the cart no longer exists, e.g. a guest cart merged at login,
      //    there's nothing to clear.)
      if (checkout.cartId) {
        for (const item of items) {
          const line = await CartItem.findOne({ where: { cartId: checkout.cartId, productId: item.productId }, transaction });
          if (!line) continue;
          if (line.quantity <= item.quantity) await line.destroy({ transaction });
          else await line.update({ quantity: line.quantity - item.quantity }, { transaction });
        }
      }

      return { order, alreadyFulfilled: false };
    })
  );
}

module.exports = { fulfilCheckout };
