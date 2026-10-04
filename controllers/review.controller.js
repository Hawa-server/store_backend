/*
 * controllers/review.controller.js
 *
 * Handles the HTTP side of reviews (BE18): the public list for a product,
 * and writing, editing and deleting your own review.
 */
const reviewService = require('../services/review/review.service');

/*
 * GET /api/products/:id/reviews?sort=&page=
 * Receives: req.valid.params.id and req.valid.query = { sort, page }.
 * Returns: 200 with the page of visible reviews plus `summary`.
 */
async function listForProduct(req, res) {
  res.json(await reviewService.listProductReviews(req.valid.params.id, req.valid.query));
}

/*
 * POST /api/products/:id/reviews
 * Receives: req.user, req.valid.params.id and req.valid.body = { rating, text? }.
 * Returns: 201 { review }.
 */
async function create(req, res) {
  const review = await reviewService.createReview(req.user, req.valid.params.id, req.valid.body);
  res.status(201).json({ review });
}

/*
 * PATCH /api/reviews/:id
 * Receives: req.user, req.valid.params.id and req.valid.body = { rating?, text? }.
 * Returns: 200 { review } (your own review, updated).
 */
async function update(req, res) {
  res.json({ review: await reviewService.updateReview(req.user, req.valid.params.id, req.valid.body) });
}

/*
 * DELETE /api/reviews/:id
 * Receives: req.user and req.valid.params.id.
 * Returns: 200 { message }.
 */
async function remove(req, res) {
  await reviewService.deleteReview(req.user, req.valid.params.id);
  res.json({ message: 'Your review has been deleted.' });
}

module.exports = { listForProduct, create, update, remove };
