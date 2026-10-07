/*
 * services/product/adminProduct.service.js
 *
 * Admin product management (BE23): list, view, add and edit products,
 * including stock. Reached only through /api/admin (requireAuth + requireAdmin).
 *
 * Rules:
 *   - No delete. Past orders point at products (the foreign key is RESTRICT),
 *     so a product is DEACTIVATED (isActive = false) instead: hidden from the
 *     shop, unavailable in carts and refused at checkout, by logic that
 *     already exists everywhere isActive is checked.
 *   - Names are unique, ignoring case (a UNIQUE index backs this up).
 *   - Stock safety: an admin's stock change is saved only if the stock is
 *     still what the admin saw (expectedStock), checked under the same row
 *     lock that payments (BE9) and cancellations (BE16) use. Otherwise a sale
 *     happening at that moment could be silently overwritten.
 *   - Money is whole pesewas. Price changes only affect NEW carts and
 *     checkouts: orders and checkouts keep the prices saved with them.
 *   - These are live database changes. Re-running the seeders resets the
 *     products to docs/catalogue.md.
 */
const { Op, UniqueConstraintError } = require('sequelize');
const { sequelize, Product, ProductImage, Category } = require('../../models');
const AppError = require('../../utils/AppError');
const withDeadlockRetry = require('../../utils/withDeadlockRetry');
const { toLimitOffset, toPage } = require('../../utils/pagination');
const { pickMainImage } = require('../catalog/catalog.service');

const ADMIN_PAGE_SIZE = 20;
const DUPLICATE_NAME = 'A product with this name already exists.';

/*
 * sortedImages(product)
 * Receives: a Product loaded with its images. Returns: them by sortOrder.
 */
function sortedImages(product) {
  return [...(product.images || [])].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

/*
 * toListItem(product, mainImage)
 * Receives: a Product loaded with its Category, and its main image (or null).
 * Returns: the admin list shape.
 */
function toListItem(product, mainImage) {
  return {
    id: product.id,
    name: product.name,
    category: { id: product.Category.id, name: product.Category.name, slug: product.Category.slug },
    priceGhs: product.priceGhs,
    stock: product.stock,
    isActive: product.isActive,
    mainImage,
    updatedAt: product.updatedAt,
  };
}

/*
 * toDetail(product)
 * Receives: a Product loaded with its Category and images.
 * Returns: the admin detail shape: the list item plus description,
 *          createdAt and every image.
 */
function toDetail(product) {
  const images = sortedImages(product);
  return {
    ...toListItem(product, pickMainImage(images)),
    description: product.description,
    createdAt: product.createdAt,
    images: images.map((img) => ({ id: img.id, url: img.url, altText: img.altText, sortOrder: img.sortOrder, isMain: img.isMain })),
  };
}

/*
 * loadDetail(id)
 * Receives: a product id. Returns: the admin detail, or throws 404.
 */
async function loadDetail(id) {
  const product = await Product.findByPk(id, {
    include: [
      { model: Category, attributes: ['id', 'name', 'slug'] },
      { model: ProductImage, as: 'images' },
    ],
  });
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found.');
  return toDetail(product);
}

/*
 * escapeLike(text)
 * Receives: search text typed by the admin.
 * Returns: the text with % and _ escaped, so they're matched as normal
 *          characters instead of acting as LIKE wildcards.
 */
function escapeLike(text) {
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/*
 * listProducts({ search, category, status, page })
 * Receives: validated filters (all optional) and the page number.
 * Returns: the standard page object, 20 per page, A–Z by name. Inactive
 *          products are included (unlike the shop), so admins can find and
 *          reactivate them.
 * Throws: 400 (fields.category) for an unknown category slug.
 */
async function listProducts({ search, category, status, page }) {
  const where = {};
  // The name column ignores case, so LIKE '%gloss%' also finds "Pink Lip Gloss".
  if (search) where.name = { [Op.like]: `%${escapeLike(search)}%` };
  if (status) where.isActive = status === 'active';
  if (category) {
    const found = await Category.findOne({ where: { slug: category }, attributes: ['id'] });
    if (!found) {
      throw new AppError(400, 'INVALID_REQUEST', 'Please check the highlighted fields.', { category: 'Unknown category.' });
    }
    where.categoryId = found.id;
  }

  const { count, rows } = await Product.findAndCountAll({
    where,
    include: [{ model: Category, attributes: ['id', 'name', 'slug'] }],
    order: [['name', 'ASC'], ['id', 'ASC']],
    ...toLimitOffset(page, ADMIN_PAGE_SIZE),
  });

  // The page's images in ONE query (not one per product).
  const images = rows.length
    ? await ProductImage.findAll({ where: { productId: rows.map((p) => p.id) }, order: [['sortOrder', 'ASC'], ['id', 'ASC']] })
    : [];
  const items = rows.map((product) => toListItem(product, pickMainImage(images.filter((img) => img.productId === product.id))));
  return toPage(items, { page, pageSize: ADMIN_PAGE_SIZE, totalItems: count });
}

/*
 * getProduct(id)
 * Receives: a product id. Returns: the admin detail (inactive ones too).
 */
async function getProduct(id) {
  return loadDetail(id);
}

/*
 * checkCategory(categoryId, transaction)
 * Receives: a category id. Returns: nothing. Throws 400 (fields.categoryId)
 *           if there is no such category.
 */
async function checkCategory(categoryId, transaction) {
  if (!(await Category.findByPk(categoryId, { attributes: ['id'], transaction }))) {
    throw new AppError(400, 'INVALID_REQUEST', 'Please check the highlighted fields.', { categoryId: 'Choose a category.' });
  }
}

/*
 * checkNameFree(name, exceptId, transaction)
 * Receives: a product name, and the id of the product being edited (or null).
 * Returns: nothing. Throws 409 if ANOTHER product already has that name. The
 *          column ignores case, so "pink lip gloss" matches "Pink Lip Gloss".
 */
async function checkNameFree(name, exceptId, transaction) {
  const where = exceptId ? { name, id: { [Op.ne]: exceptId } } : { name };
  if (await Product.findOne({ where, attributes: ['id'], transaction })) {
    throw new AppError(409, 'CONFLICT', DUPLICATE_NAME);
  }
}

/*
 * duplicateNameAware(work)
 * Receives: an async function that saves a product.
 * Returns: its result. If the database's UNIQUE rule refuses a duplicate name
 *          (two admins saving the same name at the same instant), the answer
 *          is the same friendly 409, never a 500.
 */
async function duplicateNameAware(work) {
  try {
    return await work();
  } catch (err) {
    if (err instanceof UniqueConstraintError) throw new AppError(409, 'CONFLICT', DUPLICATE_NAME);
    throw err;
  }
}

/*
 * createProduct(data, adminId)
 * Receives: the validated body { name, description, categoryId, priceGhs,
 *           stock, isActive, image: { url, altText } } and the admin's id.
 * Returns: the new product (admin detail). The product and its main image
 *          are saved in ONE transaction: both or neither.
 */
async function createProduct(data, adminId) {
  const id = await duplicateNameAware(() =>
    sequelize.transaction(async (transaction) => {
      await checkCategory(data.categoryId, transaction);
      await checkNameFree(data.name, null, transaction);
      const product = await Product.create(
        {
          categoryId: data.categoryId,
          name: data.name,
          description: data.description,
          priceGhs: data.priceGhs,
          stock: data.stock,
          isActive: data.isActive,
        },
        { transaction }
      );
      await ProductImage.create(
        { productId: product.id, url: data.image.url, altText: data.image.altText, sortOrder: 1, isMain: true },
        { transaction }
      );
      return product.id;
    })
  );

  // Who did what, never the request body.
  console.log(`[admin] admin ${adminId} created product ${id} (fields: ${Object.keys(data).join(', ')})`);
  return loadDetail(id);
}

/*
 * updateProduct(id, changes, adminId)
 * Receives: the product id, the validated changes (any of name, description,
 *           categoryId, priceGhs, stock, isActive, image; plus expectedStock
 *           when stock is sent) and the admin's id.
 * Returns: the updated product (admin detail).
 * Throws: 404 unknown product; 400 unknown category; 409 duplicate name;
 *         409 if stock changed since the admin opened the product (with
 *         currentStock in the error). Nothing is saved when it throws.
 */
async function updateProduct(id, changes, adminId) {
  const changed = Object.keys(changes).filter((key) => key !== 'expectedStock');

  await duplicateNameAware(() =>
    withDeadlockRetry(() =>
      sequelize.transaction(async (transaction) => {
        // Lock the product row: a payment (BE9) or cancellation (BE16) changing
        // this product's stock right now has to wait, and vice versa.
        const product = await Product.findByPk(id, { lock: transaction.LOCK.UPDATE, transaction });
        if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found.');

        // Stock safety: only overwrite the stock the admin actually saw.
        if (changes.stock !== undefined && product.stock !== changes.expectedStock) {
          throw new AppError(
            409,
            'CONFLICT',
            `Stock changed since you opened this product (it's now ${product.stock}). Check the number and save again.`,
            undefined,
            { currentStock: product.stock }
          );
        }
        if (changes.categoryId !== undefined) await checkCategory(changes.categoryId, transaction);
        if (changes.name !== undefined) await checkNameFree(changes.name, id, transaction);

        // Only the fields that were sent are copied (never the whole body).
        const update = {};
        for (const field of ['name', 'description', 'categoryId', 'priceGhs', 'stock', 'isActive']) {
          if (changes[field] !== undefined) update[field] = changes[field];
        }
        if (Object.keys(update).length) await product.update(update, { transaction });

        // A new main image replaces the old main one (or is added if there's none).
        if (changes.image) {
          const images = await ProductImage.findAll({
            where: { productId: id },
            order: [['isMain', 'DESC'], ['sortOrder', 'ASC'], ['id', 'ASC']],
            transaction,
          });
          if (images.length) {
            await images[0].update({ url: changes.image.url, altText: changes.image.altText, isMain: true }, { transaction });
          } else {
            await ProductImage.create(
              { productId: id, url: changes.image.url, altText: changes.image.altText, sortOrder: 1, isMain: true },
              { transaction }
            );
          }
          // An image-only change still counts as an update of the product.
          if (!Object.keys(update).length) {
            product.changed('updatedAt', true);
            await product.save({ transaction });
          }
        }
      })
    )
  );

  console.log(`[admin] admin ${adminId} updated product ${id} (fields: ${changed.join(', ')})`);
  return loadDetail(id);
}

module.exports = { listProducts, getProduct, createProduct, updateProduct };
