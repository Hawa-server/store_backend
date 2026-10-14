/*
 * controllers/wishlist.controller.js
 *
 * Handles the HTTP side of /api/wishlist (BE28). Every route has passed
 * requireAuth, so req.user is the logged-in shopper, and every service call
 * uses req.user.id: a shopper can only ever see or change their OWN list.
 */
const wishlistService = require('../services/wishlist/wishlist.service');

/*
 * GET /api/wishlist?page=
 * Receives: req.user and req.valid.query.page.
 * Returns: 200 with the standard page object (20 per page, newest first).
 */
async function list(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json(await wishlistService.listWishlist(req.user.id, req.valid.query.page));
}

/*
 * GET /api/wishlist/ids
 * Receives: req.user.
 * Returns: 200 { productIds }: the saved products' UUIDs (for the ♡ on lists).
 */
async function ids(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json(await wishlistService.listIds(req.user.id));
}

/*
 * PUT /api/wishlist/:productId
 * Receives: req.user and req.valid.params.productId (a UUID, or null).
 * Returns: 200 { productId, saved: true, count }, also when it was already saved.
 */
async function save(req, res) {
  res.json(await wishlistService.saveProduct(req.user.id, req.valid.params.productId));
}

/*
 * DELETE /api/wishlist/:productId
 * Receives: req.user and req.valid.params.productId.
 * Returns: 200 { productId, saved: false, count }, also when it wasn't saved.
 */
async function remove(req, res) {
  res.json(await wishlistService.removeProduct(req.user.id, req.valid.params.productId));
}

module.exports = { list, ids, save, remove };
