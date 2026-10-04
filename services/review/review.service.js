/*
 * services/review/review.service.js
 *
 * Product reviews (BE18): who may review, writing / editing / deleting your
 * own review, and the public list for a product page.
 *
 * Rules:
 *   - Only shoppers who RECEIVED the product may review it: they own (in
 *     their account) a Delivered order containing it.
 *   - One review per user per product (the database's UNIQUE rule backs this up).
 *   - You can only edit or delete your OWN review; anyone else's is "not found".
 *   - Hidden reviews (hidden by an admin, BE19) never appear publicly and never
 *     count in averages; editing a hidden review keeps it hidden.
 *   - Reviewers are shown as "First L." only: never their email or full name.
 */
const { UniqueConstraintError } = require('sequelize');
const { Review, Product, Order, OrderItem, User } = require('../../models');
const AppError = require('../../utils/AppError');
const { toLimitOffset, toPage } = require('../../utils/pagination');
const { getReviewSummary } = require('./reviewStats');

const PAGE_SIZE = 5;
const SORTS = {
  recent: [['createdAt', 'DESC'], ['id', 'DESC']],
  highest: [['rating', 'DESC'], ['createdAt', 'DESC'], ['id', 'DESC']],
  lowest: [['rating', 'ASC'], ['createdAt', 'DESC'], ['id', 'DESC']],
};
const DUPLICATE_MESSAGE = "You've already reviewed this product. You can edit your review instead.";

/*
 * deliveredBuyers(productId, userIds)
 * Receives: a product id and a list of user ids.
 * Returns: a Set of the user ids (from that list) who own a Delivered order
 *          containing the product. ONE query for the whole list, so a page of
 *          reviews costs the same whether it has 1 review or 5 (no "N+1").
 */
async function deliveredBuyers(productId, userIds) {
  if (!userIds.length) return new Set();
  const rows = await Order.findAll({
    attributes: ['userId'],
    where: { userId: userIds, status: 'Delivered' },
    include: [{ model: OrderItem, as: 'items', attributes: [], where: { productId }, required: true }],
    raw: true,
  });
  return new Set(rows.map((row) => row.userId));
}

/*
 * isEligible(userId, productId)
 * Receives: a user id and a product id.
 * Returns: true if the user has received the product (a Delivered order in
 *          their account that contains it). Guest orders don't count: they
 *          aren't linked to any account.
 */
async function isEligible(userId, productId) {
  return (await deliveredBuyers(productId, [userId])).has(userId);
}

/*
 * reviewerName(fullName)
 * Receives: the reviewer's name, e.g. "Ama Mensah".
 * Returns: the public version, first name and last initial: "Ama M.".
 *          A one-word name is shown as it is.
 */
function reviewerName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Customer';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/*
 * toOwnReview(review)
 * Receives: a Review. Returns: how the reviewer sees their own review,
 *           including whether the store has hidden it.
 */
function toOwnReview(review) {
  return {
    id: review.id,
    productId: review.productId,
    rating: review.rating,
    text: review.text,
    createdAt: review.createdAt,
    editedAt: review.editedAt,
    isHidden: review.isHidden,
  };
}

/*
 * findActiveProduct(productId)
 * Receives: a product id. Returns: the product. Throws 404 if it doesn't
 *           exist or has been removed from the shop.
 */
async function findActiveProduct(productId) {
  const product = await Product.findOne({ where: { id: productId, isActive: true }, attributes: ['id'] });
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found.');
  return product;
}

/*
 * listProductReviews(productId, { sort, page })
 * Receives: a product id, the sort ('recent' | 'highest' | 'lowest') and page.
 * Returns: the standard page object of VISIBLE reviews (5 per page), plus
 *          `summary` = { average, count, breakdown }. Each item:
 *          { id, rating, text, reviewerName, verifiedPurchase, createdAt, editedAt }.
 */
async function listProductReviews(productId, { sort, page }) {
  await findActiveProduct(productId);

  const { count, rows } = await Review.findAndCountAll({
    where: { productId, isHidden: false },
    include: [{ model: User, as: 'reviewer', attributes: ['name'] }],
    order: SORTS[sort],
    ...toLimitOffset(page, PAGE_SIZE),
  });

  // "Verified purchase" for the whole page in ONE query.
  const verified = await deliveredBuyers(productId, [...new Set(rows.map((r) => r.userId))]);
  const items = rows.map((review) => ({
    id: review.id,
    rating: review.rating,
    text: review.text,
    reviewerName: reviewerName(review.reviewer && review.reviewer.name),
    verifiedPurchase: verified.has(review.userId),
    createdAt: review.createdAt,
    editedAt: review.editedAt,
  }));

  return { ...toPage(items, { page, pageSize: PAGE_SIZE, totalItems: count }), summary: await getReviewSummary(productId) };
}

/*
 * createReview(user, productId, { rating, text })
 * Receives: the logged-in user, the product id, and the validated rating
 *           (1–5) and text (or null).
 * Returns: the new review (own view).
 * Throws: 404 unknown/inactive product; 409 already reviewed; 403 if the
 *         user hasn't received the product.
 */
async function createReview(user, productId, { rating, text }) {
  await findActiveProduct(productId);

  if (await Review.findOne({ where: { userId: user.id, productId }, attributes: ['id'] })) {
    throw new AppError(409, 'CONFLICT', DUPLICATE_MESSAGE);
  }
  if (!(await isEligible(user.id, productId))) {
    throw new AppError(403, 'FORBIDDEN', 'You can review a product after it has been delivered to you.');
  }

  try {
    const review = await Review.create({ userId: user.id, productId, rating, text: text ?? null });
    return toOwnReview(review);
  } catch (err) {
    // Two "submit" clicks at the same moment: both passed the check above,
    // but the database's UNIQUE (userId, productId) rule lets only one in.
    if (err instanceof UniqueConstraintError) throw new AppError(409, 'CONFLICT', DUPLICATE_MESSAGE);
    throw err;
  }
}

/*
 * findOwnReview(user, reviewId)
 * Receives: the logged-in user and a review id.
 * Returns: the review, only if it's THEIRS. Throws 404 otherwise, the same
 *          answer as a review that doesn't exist.
 */
async function findOwnReview(user, reviewId) {
  const review = await Review.findOne({ where: { id: reviewId, userId: user.id } });
  if (!review) throw new AppError(404, 'NOT_FOUND', 'Review not found.');
  return review;
}

/*
 * updateReview(user, reviewId, changes)
 * Receives: the user, the review id, and { rating?, text? } (at least one).
 * Returns: the updated review (own view). editedAt is set to now. isHidden is
 *          never touched: a review the store hid stays hidden after an edit.
 */
async function updateReview(user, reviewId, changes) {
  const review = await findOwnReview(user, reviewId);
  const update = { editedAt: new Date() };
  if (changes.rating !== undefined) update.rating = changes.rating;
  if (changes.text !== undefined) update.text = changes.text;
  await review.update(update);
  return toOwnReview(review);
}

/*
 * deleteReview(user, reviewId)
 * Receives: the user and the review id. Returns: nothing.
 * Deleting is permanent; the product's average updates straight away
 * because averages are always calculated from the reviews that exist.
 */
async function deleteReview(user, reviewId) {
  const review = await findOwnReview(user, reviewId);
  await review.destroy();
}

/*
 * getViewer(user, productId)
 * Receives: the logged-in user (or null) and a product id.
 * Returns: null for guests; otherwise { canReview, myReview } for the product
 *          page. myReview includes isHidden, so a reviewer can see that the
 *          store hid their review. canReview is false once they've reviewed.
 */
async function getViewer(user, productId) {
  if (!user) return null;
  const mine = await Review.findOne({ where: { userId: user.id, productId } });
  return {
    canReview: !mine && (await isEligible(user.id, productId)),
    myReview: mine ? toOwnReview(mine) : null,
  };
}

module.exports = { listProductReviews, createReview, updateReview, deleteReview, getViewer, reviewerName };
