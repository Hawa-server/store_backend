/*
 * controllers/catalog.controller.js
 *
 * Handles the HTTP side of browsing (/api/categories, /api/products): reads the
 * validated input, calls the catalog service, and sends JSON.
 */
const catalogService = require('../services/catalog/catalog.service');

/*
 * GET /api/categories
 * Receives: nothing.
 * Returns: 200 { categories }.
 */
async function listCategories(req, res) {
  res.json({ categories: await catalogService.listCategories() });
}

/*
 * GET /api/products?category=<slug>
 * Receives: req.valid.query = { category? }.
 * Returns: 200 { products }.
 */
async function listProducts(req, res) {
  res.json({ products: await catalogService.listProducts(req.valid.query) });
}

/*
 * GET /api/products/:id
 * Receives: req.valid.params = { id }, and req.user (null for guests) from optionalAuth.
 * Returns: 200 { product }.
 */
async function getProduct(req, res) {
  res.json({ product: await catalogService.getProductDetails(req.valid.params.id, req.user) });
}

module.exports = { listCategories, listProducts, getProduct };
