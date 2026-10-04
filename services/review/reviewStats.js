/*
 * services/review/reviewStats.js
 *
 * Calculates star ratings for products: average and count for product cards
 * and details, and the full summary with the star breakdown for the reviews
 * list (BE18). Every rating number in the app comes from this one file.
 *
 * Rule: hidden reviews (removed by an admin, BE19) are left out of every
 * average and count, so moderation really removes a review's effect.
 */
const { fn, col } = require('sequelize');
const { Review } = require('../../models');

/*
 * getRatingStats(productIds)
 * Receives: an array of product ids.
 * Returns: a Map of productId → { average, count }. `average` is rounded to
 *          1 decimal place (e.g. 4.5), or null when there are no reviews.
 *
 * Uses ONE grouped query for all the products, instead of one query per
 * product (the "N+1 queries" problem, which gets slow as lists grow).
 */
async function getRatingStats(productIds) {
  const stats = new Map(productIds.map((id) => [id, { average: null, count: 0 }]));
  if (!productIds.length) return stats;

  const rows = await Review.findAll({
    attributes: ['productId', [fn('AVG', col('rating')), 'average'], [fn('COUNT', col('id')), 'count']],
    where: { productId: productIds, isHidden: false },
    group: ['productId'],
    raw: true,
  });

  for (const row of rows) {
    stats.set(row.productId, {
      // MySQL returns AVG as a decimal string like "4.5000"; ratings are a
      // display value (not money), so rounding to 1 decimal is fine here.
      average: Math.round(Number(row.average) * 10) / 10,
      count: Number(row.count),
    });
  }
  return stats;
}

/*
 * getReviewSummary(productId)
 * Receives: one product id.
 * Returns: { average, count, breakdown } where breakdown counts the visible
 *          reviews for each star, e.g. { "5": 3, "4": 1, "3": 0, "2": 0, "1": 0 }.
 *          average is rounded to 1 decimal place, or null with no reviews.
 * One grouped query (one row per star rating), hidden reviews left out.
 */
async function getReviewSummary(productId) {
  const rows = await Review.findAll({
    attributes: ['rating', [fn('COUNT', col('id')), 'count']],
    where: { productId, isHidden: false },
    group: ['rating'],
    raw: true,
  });

  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let count = 0;
  let starsTotal = 0;
  for (const row of rows) {
    const n = Number(row.count);
    breakdown[row.rating] = n;
    count += n;
    starsTotal += row.rating * n;
  }
  return { average: count ? Math.round((starsTotal / count) * 10) / 10 : null, count, breakdown };
}

module.exports = { getRatingStats, getReviewSummary };
