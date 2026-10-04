/*
 * services/catalog/catalog.service.js
 *
 * The rules for browsing the store: listing categories, listing products,
 * and showing one product's details.
 *
 * Shoppers only ever see ACTIVE products. Products are deactivated
 * (isActive = false) rather than deleted, because old orders still point to
 * them; deactivated products simply disappear from the shop.
 *
 * Money: priceGhs is whole pesewas, sent exactly as stored. priceUsd (BE13)
 * is the same price in US cents, converted on the server, for display only.
 */
const { fn, col } = require('sequelize');
const { Category, Product, ProductImage } = require('../../models');
const AppError = require('../../utils/AppError');
const stockLabel = require('../../utils/stockLabel');
const { getRatingStats } = require('../review/reviewStats');
const reviewService = require('../review/review.service');
const { getUsdRate } = require('../settings/settings.service');
const { toUsdCents } = require('../../utils/currency');

// What we load for every product, and how we sort its images.
const PRODUCT_INCLUDES = [
  { model: Category, attributes: ['name', 'slug'] },
  { model: ProductImage, as: 'images', attributes: ['url', 'altText', 'sortOrder', 'isMain'] },
];
const IMAGE_ORDER = [
  [{ model: ProductImage, as: 'images' }, 'sortOrder', 'ASC'],
  [{ model: ProductImage, as: 'images' }, 'id', 'ASC'],
];

/*
 * pickMainImage(images)
 * Receives: a product's images, already sorted.
 * Returns: { url, altText } of the image marked main (or the first one if
 *          none is marked), or null if the product has no images.
 */
function pickMainImage(images) {
  const main = images.find((img) => img.isMain) || images[0];
  return main ? { url: main.url, altText: main.altText } : null;
}

/*
 * toProductSummary(product, rating, pesewasPerUsd)
 * Receives: a Product row (with Category and images loaded), its rating
 *           stats, and the USD rate as pesewas per dollar (from getUsdRate).
 * Returns: the short product shape used in lists (product cards).
 */
function toProductSummary(product, rating, pesewasPerUsd) {
  return {
    id: product.id,
    name: product.name,
    priceGhs: product.priceGhs,
    priceUsd: toUsdCents(product.priceGhs, pesewasPerUsd),
    stock: product.stock,
    stockLabel: stockLabel(product.stock),
    category: { name: product.Category.name, slug: product.Category.slug },
    mainImage: pickMainImage(product.images),
    rating,
  };
}

/*
 * listCategories()
 * Receives: nothing.
 * Returns: [{ id, name, slug, productCount }] in display order. productCount
 *          counts only active products, so it matches what shoppers can see.
 */
async function listCategories() {
  const [categories, counts] = await Promise.all([
    Category.findAll({ attributes: ['id', 'name', 'slug'], order: [['sortOrder', 'ASC'], ['id', 'ASC']] }),
    Product.findAll({
      attributes: ['categoryId', [fn('COUNT', col('id')), 'count']],
      where: { isActive: true },
      group: ['categoryId'],
      raw: true,
    }),
  ]);

  const countByCategory = new Map(counts.map((row) => [row.categoryId, Number(row.count)]));
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    productCount: countByCategory.get(c.id) || 0,
  }));
}

/*
 * listProducts({ category })
 * Receives: an optional category slug.
 * Returns: active products (A–Z by name) as summaries. Throws 404 if the slug
 *          doesn't match any category. A real but empty category returns [].
 */
async function listProducts({ category }) {
  const where = { isActive: true };

  if (category) {
    const found = await Category.findOne({ where: { slug: category } });
    if (!found) throw new AppError(404, 'NOT_FOUND', 'Category not found.');
    where.categoryId = found.id;
  }

  const products = await Product.findAll({
    where,
    include: PRODUCT_INCLUDES,
    order: [['name', 'ASC'], ...IMAGE_ORDER],
  });

  const ratings = await getRatingStats(products.map((p) => p.id));
  // Read the rate once per request, not once per product.
  const { pesewasPerUsd } = await getUsdRate();
  return products.map((p) => toProductSummary(p, ratings.get(p.id), pesewasPerUsd));
}

/*
 * getProductDetails(id, viewerUser)
 * Receives: the product id and the logged-in user (or null for guests).
 * Returns: the full product shape. Throws 404 for unknown or inactive products,
 *          so a deactivated product looks exactly like one that never existed.
 */
async function getProductDetails(id, viewerUser) {
  const product = await Product.findOne({
    where: { id, isActive: true },
    include: PRODUCT_INCLUDES,
    order: IMAGE_ORDER,
  });
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found.');

  const ratings = await getRatingStats([product.id]);
  const { pesewasPerUsd } = await getUsdRate();

  return {
    ...toProductSummary(product, ratings.get(product.id), pesewasPerUsd),
    description: product.description,
    images: product.images.map((img) => ({
      url: img.url,
      altText: img.altText,
      sortOrder: img.sortOrder,
      isMain: img.isMain,
    })),
    // Only for logged-in shoppers: can they review it (they received it and
    // haven't reviewed it yet), and their own review if any (BE18).
    viewer: await reviewService.getViewer(viewerUser, product.id),
  };
}

module.exports = { listCategories, listProducts, getProductDetails, pickMainImage };
