/*
 * services/review/reviewModeration.service.js
 *
 * Admin moderation of reviews (BE19): list all reviews, hide, unhide, delete.
 *
 * Every action is recorded in ReviewModerationLogs IN THE SAME TRANSACTION as
 * the action itself: the change and its record are saved together or not at
 * all, so there's never an unrecorded moderation (or a record of one that
 * didn't happen). Each log row keeps a copy of the review's rating and text,
 * because after a delete the review is gone.
 *
 * Averages need no work here: they're always calculated from the VISIBLE
 * reviews that exist (reviewStats.js), so they update straight away.
 */
const { sequelize, Review, ReviewModerationLog, Product, User } = require('../../models');
const AppError = require('../../utils/AppError');
const { toLimitOffset, toPage } = require('../../utils/pagination');

const ADMIN_PAGE_SIZE = 20;

const INCLUDES = [
  { model: Product, attributes: ['id', 'name'] },
  { model: User, as: 'reviewer', attributes: ['id', 'name', 'email'] },
  { model: User, as: 'hiddenBy', attributes: ['id', 'name'] },
];

/*
 * toAdminReview(review)
 * Receives: a Review loaded with INCLUDES.
 * Returns: the admin's view: product, reviewer (full name and email: only
 *          admins see these), rating, text, dates, and hidden details.
 */
function toAdminReview(review) {
  return {
    id: review.id,
    product: review.Product ? { id: review.Product.id, name: review.Product.name } : null,
    reviewer: review.reviewer ? { id: review.reviewer.id, name: review.reviewer.name, email: review.reviewer.email } : null,
    rating: review.rating,
    text: review.text,
    createdAt: review.createdAt,
    editedAt: review.editedAt,
    status: review.isHidden ? 'hidden' : 'visible',
    hiddenReason: review.hiddenReason,
    hiddenAt: review.hiddenAt,
    hiddenBy: review.hiddenBy ? { id: review.hiddenBy.id, name: review.hiddenBy.name } : null,
  };
}

/*
 * logAction(review, action, reason, adminId, transaction)
 * Receives: the review (as it is BEFORE the action), 'hide' | 'unhide' |
 *           'delete', the reason (or null), the admin's id, the transaction.
 * Returns: nothing. Adds one ReviewModerationLogs row, with a copy of the
 *          review's rating and text as they were.
 */
async function logAction(review, action, reason, adminId, transaction) {
  await ReviewModerationLog.create(
    {
      reviewId: review.id,
      productId: review.productId,
      reviewerUserId: review.userId,
      action,
      reason: reason || null,
      adminUserId: adminId,
      reviewCopy: { rating: review.rating, text: review.text, createdAt: review.createdAt, wasHidden: review.isHidden },
    },
    { transaction }
  );
}

/*
 * lockReview(reviewId, transaction)
 * Receives: a review id and the open transaction.
 * Returns: the review, locked until the transaction ends, so two admins
 *          acting on it at once take turns. Throws 404 if it doesn't exist.
 */
async function lockReview(reviewId, transaction) {
  const review = await Review.findByPk(reviewId, { lock: transaction.LOCK.UPDATE, transaction });
  if (!review) throw new AppError(404, 'NOT_FOUND', 'Review not found.');
  return review;
}

/*
 * loadAdminReview(reviewId)
 * Receives: a review id. Returns: the admin view of the review.
 */
async function loadAdminReview(reviewId) {
  return toAdminReview(await Review.findByPk(reviewId, { include: INCLUDES }));
}

/*
 * listReviews({ status, page })
 * Receives: an optional status ('visible' | 'hidden'; none = all) and the page.
 * Returns: the standard page object, 20 per page, newest first.
 */
async function listReviews({ status, page }) {
  const where = {};
  if (status) where.isHidden = status === 'hidden';
  const { count, rows } = await Review.findAndCountAll({
    where,
    include: INCLUDES,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    ...toLimitOffset(page, ADMIN_PAGE_SIZE),
  });
  return toPage(rows.map(toAdminReview), { page, pageSize: ADMIN_PAGE_SIZE, totalItems: count });
}

/*
 * hideReview(reviewId, reason, adminId)
 * Receives: the review id, the reason (required, ≤ 200), the admin's id.
 * Returns: the review (admin view), now hidden. Throws 404, or 409 if it's
 *          already hidden.
 */
async function hideReview(reviewId, reason, adminId) {
  await sequelize.transaction(async (transaction) => {
    const review = await lockReview(reviewId, transaction);
    if (review.isHidden) throw new AppError(409, 'CONFLICT', 'This review is already hidden.');
    await logAction(review, 'hide', reason, adminId, transaction);
    await review.update({ isHidden: true, hiddenReason: reason, hiddenAt: new Date(), hiddenByUserId: adminId }, { transaction });
  });
  return loadAdminReview(reviewId);
}

/*
 * unhideReview(reviewId, reason, adminId)
 * Receives: the review id, an optional reason, the admin's id.
 * Returns: the review (admin view), visible again. Throws 404, or 409 if it
 *          isn't hidden.
 */
async function unhideReview(reviewId, reason, adminId) {
  await sequelize.transaction(async (transaction) => {
    const review = await lockReview(reviewId, transaction);
    if (!review.isHidden) throw new AppError(409, 'CONFLICT', "This review isn't hidden.");
    await logAction(review, 'unhide', reason, adminId, transaction);
    await review.update({ isHidden: false, hiddenReason: null, hiddenAt: null, hiddenByUserId: null }, { transaction });
  });
  return loadAdminReview(reviewId);
}

/*
 * deleteReview(reviewId, reason, adminId)
 * Receives: the review id, the reason (required), the admin's id.
 * Returns: nothing. The review is deleted PERMANENTLY; the log row (with its
 *          copy of the rating and text) is the only record left.
 */
async function deleteReview(reviewId, reason, adminId) {
  await sequelize.transaction(async (transaction) => {
    const review = await lockReview(reviewId, transaction);
    await logAction(review, 'delete', reason, adminId, transaction);
    await review.destroy({ transaction });
  });
}

module.exports = { listReviews, hideReview, unhideReview, deleteReview };
