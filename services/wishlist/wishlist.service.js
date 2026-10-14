/*
 * services/wishlist/wishlist.service.js
 *
 * The wishlist (BE28): logged-in shoppers save products for later (♡).
 *
 * Rules:
 *   - Every query filters by the logged-in user's id, so nobody can see or
 *     change another shopper's list.
 *   - A product is saved at most once (UNIQUE index); saving again is fine.
 *   - At most 100 products per shopper (409 WISHLIST_FULL).
 *   - Only ACTIVE products can be saved. A saved product that's deactivated
 *     later stays in the list, marked isActive: false, so the shopper sees why
 *     it can't be bought.
 *   - Nothing is reserved and no price is stored: the list always shows the
 *     product's CURRENT price and stock.
 *   - Products are identified by their public UUID; the counting number
 *     Products.id stays inside the server.
 */
const { UniqueConstraintError } = require('sequelize');
const { sequelize, WishlistItem, Product, ProductImage, Category, User } = require('../../models');
const AppError = require('../../utils/AppError');
const stockLabel = require('../../utils/stockLabel');
const { toUsdCents } = require('../../utils/currency');
const { toLimitOffset, toPage } = require('../../utils/pagination');
const { pickMainImage } = require('../catalog/catalog.service');
const { getUsdRate } = require('../settings/settings.service');

const PAGE_SIZE = 20;
const MAX_ITEMS = 100;

/*
 * toItemView(item, pesewasPerUsd)
 * Receives: a WishlistItem loaded with its Product (and the product's Category
 *           and images), and the USD rate as pesewas per dollar.
 * Returns: what the Wishlist page shows, with the product's CURRENT details.
 */
function toItemView(item, pesewasPerUsd) {
  const product = item.Product;
  return {
    productId: product.publicId,
    name: product.name,
    priceGhs: product.priceGhs,
    priceUsd: toUsdCents(product.priceGhs, pesewasPerUsd),
    stock: product.stock,
    stockLabel: stockLabel(product.stock),
    // false = removed from the shop since it was saved: show "No longer available".
    isActive: product.isActive,
    category: { name: product.Category.name, slug: product.Category.slug },
    mainImage: pickMainImage([...product.images].sort((a, b) => a.sortOrder - b.sortOrder)),
    savedAt: item.createdAt,
  };
}

/*
 * listWishlist(userId, page)
 * Receives: the logged-in user's id and the page number.
 * Returns: the standard page object, 20 per page, newest saves first.
 */
async function listWishlist(userId, page) {
  const { count, rows } = await WishlistItem.findAndCountAll({
    where: { userId },
    include: [
      {
        model: Product,
        include: [
          { model: Category, attributes: ['name', 'slug'] },
          { model: ProductImage, as: 'images', attributes: ['url', 'altText', 'sortOrder', 'isMain'] },
        ],
      },
    ],
    // `distinct` makes the count count wishlist rows, not image rows.
    distinct: true,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    ...toLimitOffset(page, PAGE_SIZE),
  });
  const { pesewasPerUsd } = await getUsdRate();
  return toPage(rows.map((item) => toItemView(item, pesewasPerUsd)), { page, pageSize: PAGE_SIZE, totalItems: count });
}

/*
 * listIds(userId)
 * Receives: the logged-in user's id.
 * Returns: { productIds }: the UUIDs of every saved product (at most 100), so
 *          product lists can show a filled ♡ on the ones already saved.
 */
async function listIds(userId) {
  const rows = await WishlistItem.findAll({
    where: { userId },
    include: [{ model: Product, attributes: ['publicId'] }],
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
  });
  return { productIds: rows.map((row) => row.Product.publicId) };
}

/*
 * saveProduct(userId, publicId)
 * Receives: the logged-in user's id and a product's public UUID (or null if
 *           the address didn't hold one).
 * Returns: { productId, saved: true, count }, whether it was just saved or
 *          already saved (count = how many products are now saved).
 * Throws: 404 for an unknown or inactive product; 409 WISHLIST_FULL at 100.
 */
async function saveProduct(userId, publicId) {
  const product = publicId ? await Product.findOne({ where: { publicId, isActive: true }, attributes: ['id', 'publicId'] }) : null;
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found.');

  try {
    await sequelize.transaction(async (transaction) => {
      // Lock the shopper's user row first: saves from the same shopper then
      // take turns here, so two quick taps at 99 items can't both see "99"
      // and end up with 101.
      await User.findByPk(userId, { attributes: ['id'], lock: transaction.LOCK.UPDATE, transaction });

      const existing = await WishlistItem.findOne({ where: { userId, productId: product.id }, attributes: ['id'], transaction });
      if (existing) return; // already saved: nothing to do

      const count = await WishlistItem.count({ where: { userId }, transaction });
      if (count >= MAX_ITEMS) {
        throw new AppError(409, 'WISHLIST_FULL', 'Your wishlist is full. Remove something to add more.');
      }
      await WishlistItem.create({ userId, productId: product.id }, { transaction });
    });
  } catch (err) {
    // The UNIQUE (userId, productId) index refused a duplicate: the product
    // IS saved, which is what the shopper wanted. Never a 500.
    if (!(err instanceof UniqueConstraintError)) throw err;
  }

  return { productId: product.publicId, saved: true, count: await WishlistItem.count({ where: { userId } }) };
}

/*
 * removeProduct(userId, publicId)
 * Receives: the logged-in user's id and a product's public UUID (or null).
 * Returns: { productId, saved: false, count }. Removing something that isn't
 *          saved (or doesn't exist) is still a success: the product is "not
 *          in the wishlist", which is what the shopper wanted.
 */
async function removeProduct(userId, publicId) {
  const product = publicId ? await Product.findOne({ where: { publicId }, attributes: ['id'] }) : null;
  if (product) await WishlistItem.destroy({ where: { userId, productId: product.id } });
  return { productId: publicId, saved: false, count: await WishlistItem.count({ where: { userId } }) };
}

module.exports = { listWishlist, listIds, saveProduct, removeProduct, MAX_ITEMS };
