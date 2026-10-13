/*
 * services/cart/cart.service.js
 *
 * The rules for shopping carts: finding the right cart, adding items, and
 * building the cart the shopper sees.
 *
 * Who owns a cart:
 *   - a logged-in user: found by Carts.userId (one cart per user);
 *   - a guest: found by Carts.guestToken, the random value in their
 *     `guestCart` cookie.
 * The client never sends a cart id, so nobody can open someone else's cart by
 * guessing a number.
 *
 * Money: prices always come from the Products table at the moment the cart is
 * shown. Carts store only product ids and quantities, never prices.
 */
const { UniqueConstraintError, Op } = require('sequelize');
const { sequelize, Cart, CartItem, Product, ProductImage, Category } = require('../../models');
const AppError = require('../../utils/AppError');
const stockLabel = require('../../utils/stockLabel');
const { createRandomToken } = require('../../utils/tokens');
const withDeadlockRetry = require('../../utils/withDeadlockRetry');
const { pickMainImage } = require('../catalog/catalog.service');
const { getUsdRate } = require('../settings/settings.service');
const { toUsdCents } = require('../../utils/currency');

const MAX_LINE_QUANTITY = 99;
const GUEST_CART_DAYS = 30;

const EMPTY_CART_VIEW = { items: [], itemCount: 0, subtotalGhs: 0, subtotalUsd: 0, hasUnavailableItems: false };

/*
 * guestCartWhere(guestToken)
 * Receives: the guest cookie token.
 * Returns: the Sequelize `where` for a LIVE guest cart: the right token, not
 *          owned by a user, and changed within the last 30 days. Carts are
 *          "touched" on every add/change/remove, so the 30 days restart each time
 *          the shopper uses the cart. An older guest cart is treated as expired.
 */
function guestCartWhere(guestToken) {
  return { guestToken, userId: null, updatedAt: { [Op.gt]: guestCartCutoff() } };
}

/*
 * guestCartCutoff()
 * Receives: nothing.
 * Returns: the Date before which an unused guest cart counts as expired
 *          (30 days ago). Also used by guest linking (BE25).
 */
function guestCartCutoff() {
  return new Date(Date.now() - GUEST_CART_DAYS * 24 * 60 * 60 * 1000);
}

/*
 * findCart({ user, guestToken })
 * Receives: the logged-in user (or null) and the guest cookie token (or null).
 * Returns: the existing Cart, or null. Never creates one.
 * A logged-in user always uses their own account cart, even if a guest cookie
 * is also present (the guest cart is merged into it at login; see mergeGuestCart).
 */
async function findCart({ user, guestToken }) {
  if (user) return Cart.findOne({ where: { userId: user.id } });
  if (guestToken) return Cart.findOne({ where: guestCartWhere(guestToken) });
  return null;
}

/*
 * findOrCreateCart({ user, guestToken })
 * Receives: the logged-in user (or null) and the guest cookie token (or null).
 * Returns: the Cart to use, creating one if needed. For a new guest cart, the
 *          new token is on cart.guestToken, and the controller puts it in the cookie.
 */
async function findOrCreateCart({ user, guestToken }) {
  const existing = await findCart({ user, guestToken });
  if (existing) return existing;

  if (user) {
    try {
      return await Cart.create({ userId: user.id });
    } catch (err) {
      // Two requests from the same user arrived at once and both tried to
      // create the cart. The UNIQUE rule on userId let only one succeed, so the
      // "loser" simply loads the cart the "winner" created.
      if (err instanceof UniqueConstraintError) return Cart.findOne({ where: { userId: user.id } });
      throw err;
    }
  }

  // A fresh random token: impossible to guess, so nobody can reach this cart but its owner.
  return Cart.create({ guestToken: createRandomToken() });
}

/*
 * toCartView(cart)
 * Receives: a Cart (or null for "no cart yet").
 * Returns: the cart as the shopper sees it, with every price and total
 *          calculated here on the server from current product data:
 *          { items, itemCount, subtotalGhs, subtotalUsd, hasUnavailableItems }.
 *          USD (BE13, display only, in cents): each unit price is converted
 *          first, then multiplied and added, so the USD lines always add up
 *          to the USD subtotal exactly.
 */
async function toCartView(cart) {
  if (!cart) return EMPTY_CART_VIEW;

  const cartItems = await CartItem.findAll({
    where: { cartId: cart.id },
    include: [
      {
        model: Product,
        attributes: ['id', 'publicId', 'name', 'priceGhs', 'stock', 'isActive'],
        include: [
          { model: Category, attributes: ['name', 'slug'] },
          { model: ProductImage, as: 'images', attributes: ['url', 'altText', 'sortOrder', 'isMain'] },
        ],
      },
    ],
    order: [['id', 'ASC']],
  });

  const { pesewasPerUsd } = await getUsdRate();
  let itemCount = 0;
  let subtotalGhs = 0;
  let subtotalUsd = 0;
  let hasUnavailableItems = false;

  const items = cartItems.map((item) => {
    const product = item.Product;
    // A line can't be bought if the product was switched off, or its stock
    // fell below the quantity after it was added. Checkout (BE7) refuses these.
    const isAvailable = product.isActive && product.stock >= item.quantity;
    // Whole pesewas × whole quantity = whole pesewas: no rounding, ever.
    const lineTotalGhs = product.priceGhs * item.quantity;
    // Convert the UNIT price, then multiply (never convert the line total).
    const unitPriceUsd = toUsdCents(product.priceGhs, pesewasPerUsd);
    const lineTotalUsd = unitPriceUsd * item.quantity;

    itemCount += item.quantity;
    if (isAvailable) {
      subtotalGhs += lineTotalGhs;
      subtotalUsd += lineTotalUsd;
    } else hasUnavailableItems = true;

    const images = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      id: item.id,
      productId: product.publicId, // the product's UUID, never the counting number
      name: product.name,
      unitPriceGhs: product.priceGhs,
      unitPriceUsd,
      quantity: item.quantity,
      lineTotalGhs,
      lineTotalUsd,
      stock: product.stock,
      stockLabel: stockLabel(product.stock),
      isAvailable,
      mainImage: pickMainImage(images),
      category: { name: product.Category.name, slug: product.Category.slug },
    };
  });

  return { items, itemCount, subtotalGhs, subtotalUsd, hasUnavailableItems };
}

/*
 * getCart({ user, guestToken })
 * Receives: the logged-in user (or null) and the guest cookie token (or null).
 * Returns: { cart, view }. `cart` is the Cart row or null. Viewing never
 *          creates a cart, so browsing the cart page doesn't fill the
 *          database with empty carts.
 */
async function getCart({ user, guestToken }) {
  const cart = await findCart({ user, guestToken });
  return { cart, view: await toCartView(cart) };
}

/*
 * addItem({ user, guestToken, productId, quantity })
 * Receives: who is asking, and the validated product id and quantity (1–99).
 * Returns: { cart, view }, the updated cart.
 * Throws: 404 if the product doesn't exist or is inactive; 409 OUT_OF_STOCK
 *         if there isn't enough stock; 400 if the line would go over 99.
 * Adding a product that's already in the cart increases that line's quantity.
 */
async function addItem({ user, guestToken, productId, quantity }) {
  const cart = await findOrCreateCart({ user, guestToken });

  await sequelize.transaction(async (transaction) => {
    // Lock this cart's row: if the shopper double-clicks "Add to cart", the
    // second request waits here until the first finishes, so the two can't
    // both read the old quantity and both pass the checks.
    await Cart.findByPk(cart.id, { lock: transaction.LOCK.UPDATE, transaction });

    // productId is the product's public UUID (or null if the body didn't hold
    // one: then nothing matches, and it's the same 404 as an unknown product).
    const product = productId
      ? await Product.findOne({ where: { publicId: productId, isActive: true }, transaction })
      : null;
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found.');
    if (product.stock === 0) throw new AppError(409, 'OUT_OF_STOCK', 'This product is out of stock.');

    const existing = await CartItem.findOne({ where: { cartId: cart.id, productId: product.id }, transaction });
    const newQuantity = (existing ? existing.quantity : 0) + quantity;

    if (newQuantity > MAX_LINE_QUANTITY) {
      throw new AppError(400, 'INVALID_REQUEST', 'You can add up to 99 of this product.');
    }
    // Stock is only checked here, not reserved; it's reduced when an order is paid (BE9).
    if (newQuantity > product.stock) {
      throw new AppError(409, 'OUT_OF_STOCK', `Only ${product.stock} available.`);
    }

    if (existing) await existing.update({ quantity: newQuantity }, { transaction });
    else await CartItem.create({ cartId: cart.id, productId: product.id, quantity }, { transaction });

    await touchCart(cart, transaction);
  });

  return { cart, view: await toCartView(cart) };
}

/*
 * findOwnedItem(cart, itemId, transaction)
 * Receives: the current shopper's cart (or null), the cart LINE id from the
 *           URL, and the open transaction.
 * Returns: the CartItem, but only if it belongs to THIS cart.
 * Throws: 404 "Cart item not found." otherwise.
 *
 * Security (IDOR): we never look a line up by its id alone. Searching by
 * { id, cartId } means that changing the number in the URL can't reach a line
 * in someone else's cart. That case gets the same 404 as an id that doesn't
 * exist at all, so it doesn't even reveal that the other line exists.
 */
async function findOwnedItem(cart, itemId, transaction) {
  const item = cart
    ? await CartItem.findOne({ where: { id: itemId, cartId: cart.id }, transaction })
    : null;
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Cart item not found.');
  return item;
}

/*
 * updateItemQuantity({ user, guestToken, itemId, quantity })
 * Receives: who is asking, the cart line id, and the new quantity (0–99).
 * Returns: { cart, view, message }. `message` is set only when the server had
 *          to change what was asked for (capped to the stock, or removed
 *          because it sold out); otherwise it's undefined.
 * Throws: 404 if the line isn't in this shopper's cart; 409 CONFLICT if the
 *         product has been removed from the shop.
 */
async function updateItemQuantity({ user, guestToken, itemId, quantity }) {
  // Changing an item needs an existing cart; never create one here.
  const cart = await findCart({ user, guestToken });

  const message = await sequelize.transaction(async (transaction) => {
    // Lock the cart row so this change can't interleave with another change
    // or an "add" to the same cart (same pattern as addItem).
    if (cart) await Cart.findByPk(cart.id, { lock: transaction.LOCK.UPDATE, transaction });
    const item = await findOwnedItem(cart, itemId, transaction);

    // Quantity 0 means "remove this line".
    if (quantity === 0) {
      await item.destroy({ transaction });
      return undefined;
    }

    const product = await Product.findByPk(item.productId, { transaction });
    if (!product.isActive) {
      throw new AppError(409, 'CONFLICT', 'This product is no longer available. Please remove it from your cart.');
    }

    // Sold out since it was added: the line can't stay, so remove it and say why.
    if (product.stock === 0) {
      await item.destroy({ transaction });
      return 'This product is out of stock and has been removed from your cart.';
    }

    // Asking for more than is in stock: cap it (the plan says cap, not refuse),
    // so the shopper keeps as many as they can actually buy.
    if (quantity > product.stock) {
      await item.update({ quantity: product.stock }, { transaction });
      return `Only ${product.stock} available.`;
    }

    await item.update({ quantity }, { transaction });
    return undefined;
  });

  // If the line wasn't found, the 404 has already been thrown, so `cart` is a
  // real cart by this point.
  await touchCart(cart);
  return { cart, view: await toCartView(cart), message };
}

/*
 * removeItem({ user, guestToken, itemId })
 * Receives: who is asking and the cart line id.
 * Returns: { cart, view }, the updated cart.
 * Throws: 404 if the line isn't in this shopper's cart.
 */
async function removeItem({ user, guestToken, itemId }) {
  const cart = await findCart({ user, guestToken });

  await sequelize.transaction(async (transaction) => {
    if (cart) await Cart.findByPk(cart.id, { lock: transaction.LOCK.UPDATE, transaction });
    const item = await findOwnedItem(cart, itemId, transaction);
    await item.destroy({ transaction });
  });

  await touchCart(cart);
  return { cart, view: await toCartView(cart) };
}

/*
 * touchCart(cart, transaction)
 * Receives: a Cart, and optionally the open transaction.
 * Returns: nothing. Updates the cart's updatedAt, which records when it was
 *          last used (BE6 uses this for guest cart expiry).
 */
async function touchCart(cart, transaction) {
  cart.changed('updatedAt', true);
  await cart.save({ transaction });
}

/*
 * mergeCartsIntoAccount(guestCarts, userId, transaction)
 * The shared merge step, used by the login merge below (BE6) and by guest
 * linking after verification (BE25, services/account/guestLink.service.js).
 * Receives: guest Carts the CALLER has already locked (in id order), the
 *           account's user id, and the open transaction.
 * Returns: { added, reduced }:
 *   added   = guest lines moved into, or combined with, the account cart;
 *   reduced = lines that couldn't move in full: the quantity was capped by
 *             stock (or 99), or the line was dropped because the product was
 *             switched off or has sold out.
 * The guest carts are deleted at the end (their lines go with them).
 *
 * Rules: quantities of the same product are added together, then capped at
 * the current stock (and at 99). Products that were switched off or have sold
 * out are dropped, because they couldn't be bought anyway.
 */
async function mergeCartsIntoAccount(guestCarts, userId, transaction) {
  const lock = transaction.LOCK.UPDATE;
  if (!guestCarts.length) return { added: 0, reduced: 0 };

  // Lock order: guest carts (already locked by the caller) → account cart →
  // products. Every cart merge takes locks in this order, so two at once
  // queue up instead of deadlocking.
  let accountCart = await Cart.findOne({ where: { userId }, lock, transaction });
  if (!accountCart) accountCart = await Cart.create({ userId }, { transaction });

  const guestItems = await CartItem.findAll({
    where: { cartId: guestCarts.map((cart) => cart.id) },
    order: [['id', 'ASC']],
    transaction,
  });
  const productIds = [...new Set(guestItems.map((item) => item.productId))];

  // Lock the products too, so the stock we cap against can't change mid-merge.
  // Sorted by id so every transaction locks products in the same order.
  const products = await Product.findAll({
    where: { id: productIds },
    order: [['id', 'ASC']],
    lock,
    transaction,
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const accountItems = await CartItem.findAll({
    where: { cartId: accountCart.id, productId: productIds },
    transaction,
  });
  const accountItemByProduct = new Map(accountItems.map((item) => [item.productId, item]));

  let added = 0;
  let reduced = 0;
  for (const guestItem of guestItems) {
    const product = productById.get(guestItem.productId);
    // Can't be bought any more: leave it out rather than carry a dead line over.
    if (!product || !product.isActive || product.stock === 0) {
      reduced += 1;
      continue;
    }

    const existing = accountItemByProduct.get(guestItem.productId);
    const wanted = (existing ? existing.quantity : 0) + guestItem.quantity;
    // Add the two quantities, then cap: never more than is in stock, never over 99.
    const quantity = Math.min(wanted, product.stock, MAX_LINE_QUANTITY);
    if (quantity < wanted) reduced += 1;

    if (existing) {
      await existing.update({ quantity }, { transaction });
    } else {
      // Remember the new line, in case a second guest cart has the same product.
      accountItemByProduct.set(
        guestItem.productId,
        await CartItem.create({ cartId: accountCart.id, productId: guestItem.productId, quantity }, { transaction })
      );
    }
    added += 1;
  }

  // The guest carts' lines are deleted with them (ON DELETE CASCADE).
  for (const guestCart of guestCarts) await guestCart.destroy({ transaction });
  await touchCart(accountCart, transaction);
  return { added, reduced };
}

/*
 * mergeGuestCart(userId, guestToken)
 * Called once per login (from authService.completeLogin), so a shopper keeps
 * what they added before logging in, in THIS browser.
 * Receives: the id of the user who just logged in, and the guest cookie token
 *           (or null).
 * Returns: { merged }: how many guest lines were moved into or combined with
 *          the account cart (0 if there was no live guest cart).
 * Throws: if the database work fails. Everything is then rolled back, so the
 *         guest cart is left exactly as it was and can be merged next time.
 */
async function mergeGuestCart(userId, guestToken) {
  if (!guestToken) return { merged: 0 };

  // The whole merge is one transaction: either every line moves and the guest
  // cart is deleted, or nothing changes at all. If MySQL reports a deadlock,
  // the complete transaction is run once more.
  return withDeadlockRetry(() =>
    sequelize.transaction(async (transaction) => {
      // The guest cart is locked FIRST. Two logins at once with the same
      // cookie then queue up here; the second finds the guest cart already
      // deleted and merges nothing, so nothing is added twice.
      const guestCart = await Cart.findOne({ where: guestCartWhere(guestToken), lock: transaction.LOCK.UPDATE, transaction });
      if (!guestCart) return { merged: 0 };

      const { added } = await mergeCartsIntoAccount([guestCart], userId, transaction);
      return { merged: added };
    })
  );
}

module.exports = {
  findCart,
  findOrCreateCart,
  toCartView,
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  mergeGuestCart,
  // For guest linking (BE25):
  mergeCartsIntoAccount,
  guestCartCutoff,
};
